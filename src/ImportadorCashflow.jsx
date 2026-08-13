import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Trash2 } from 'lucide-react';

export default function ImportadorCashflow({ baseIncome, baseExpense, onImportarSemanas, onBorrarDatos }) {
  const [procesando, setProcesando] = useState(false);
  const fileInputRef = useRef(null);

  const normalizarTexto = (texto) => {
    if (!texto) return "";
    return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  };

  // Función segura para extraer todos los lunes de un mes (Para presupuestos mensuales)
  const obtenerLunesDelMes = (anioMes) => {
    const [year, month] = anioMes.split("-").map(Number);
    const lunes = [];
    for (let dia = 1; dia <= 31; dia++) {
      const fecha = new Date(year, month - 1, dia);
      if (fecha.getMonth() !== month - 1) break;
      if (fecha.getDay() === 1) {
        const mm = String(month).padStart(2, '0');
        const dd = String(dia).padStart(2, '0');
        lunes.push(`${year}-${mm}-${dd}`);
      }
    }
    return lunes;
  };

  // NUEVO: Funciones matemáticas para proyectar meses futuros exactos
  const sumarMesesExactos = (fechaIso, mesesAdicionales) => {
    const [y, m, d] = fechaIso.split("-").map(Number);
    let newM = m - 1 + mesesAdicionales;
    let newY = y + Math.floor(newM / 12);
    newM = newM % 12;
    if (newM < 0) { newM += 12; }
    
    const lastDay = new Date(newY, newM + 1, 0).getDate();
    const finalD = Math.min(d, lastDay);
    
    const mm = String(newM + 1).padStart(2, '0');
    const dd = String(finalD).padStart(2, '0');
    return `${newY}-${mm}-${dd}`;
  };

  const sumarMesesAnioMes = (anioMes, mesesAdicionales) => {
    const [y, m] = anioMes.split("-").map(Number);
    let newM = m - 1 + mesesAdicionales;
    let newY = y + Math.floor(newM / 12);
    newM = newM % 12;
    if (newM < 0) { newM += 12; }
    
    const mm = String(newM + 1).padStart(2, '0');
    return `${newY}-${mm}`;
  };

  // NUEVO: El modelo descargable ahora incluye la columna "Repeticiones"
  const descargarModeloPresupuesto = () => {
    const estructuraModelo = [
      { Concepto: "Sueldos oficina", Tipo_Carga: "Mensual", Mes_o_Fecha: "2026-09", Monto_Total: 1000000, Repeticiones: 3 },
      { Concepto: "Proveedores", Tipo_Carga: "Exacta", Mes_o_Fecha: "2026-09-15", Monto_Total: 250000, Repeticiones: 1 },
      { Concepto: "Cupos Neuquen", Tipo_Carga: "Mensual", Mes_o_Fecha: "2026-10", Monto_Total: 4000000, Repeticiones: 12 }
    ];

    const hoja = XLSX.utils.json_to_sheet(estructuraModelo);
    hoja['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Proyecciones");
    XLSX.writeFile(libro, "Modelo_Proyecciones.xlsx");
  };

  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcesando(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja);

      const periodos = {};
      const noReconocidos = new Set(); 

      filas.forEach((fila) => {
        const concepto = normalizarTexto(fila.Concepto);
        const tipoCarga = normalizarTexto(fila.Tipo_Carga);
        const montoTotal = Number(fila.Monto_Total) || 0;
        
        // NUEVO: Lee las repeticiones (Si está vacío, asume 1)
        const repeticiones = Number(fila.Repeticiones) || 1; 

        let mesOFechaBase = "";

        if (typeof fila.Mes_o_Fecha === 'number') {
          const excelDate = new Date(Math.round((fila.Mes_o_Fecha - 25569) * 86400 * 1000));
          mesOFechaBase = excelDate.toISOString().slice(0, 10);
        } else {
          mesOFechaBase = String(fila.Mes_o_Fecha).trim();
        }

        if (!mesOFechaBase || montoTotal === 0) return;

        // BUCLE DE REPETICIONES AUTOMÁTICAS
        for (let i = 0; i < repeticiones; i++) {
          let fechasAImpactar = [];
          let montoPorFecha = 0;

          if (tipoCarga.includes("mensual")) {
            // Si es mensual, proyecta para el mes correspondiente
            const mesProyectado = sumarMesesAnioMes(mesOFechaBase, i);
            fechasAImpactar = obtenerLunesDelMes(mesProyectado);
            montoPorFecha = montoTotal / fechasAImpactar.length;
          } else {
            // NUEVO: Si es fecha exacta, respeta el día y suma meses según repetición
            const fechaProyectada = sumarMesesExactos(mesOFechaBase, i);
            fechasAImpactar = [fechaProyectada]; 
            montoPorFecha = montoTotal;
          }

          fechasAImpactar.forEach(fechaStart => {
            if (!periodos[fechaStart]) {
              periodos[fechaStart] = {
                id: "w_" + Math.random().toString(36).slice(2, 10),
                week_start: fechaStart, // Ahora guarda la fecha EXACTA
                status: "proyectado",
                saldo_inicial: 0,
                saldo_bancos: 0,
                saldo_credimas: 0,
                income: {},
                expense: {},
                notes: ""
              };
            }

            const ing = baseIncome.find(c => normalizarTexto(c.label) === concepto || normalizarTexto(c.key) === concepto);
            const eg = baseExpense.find(c => normalizarTexto(c.label) === concepto || normalizarTexto(c.key) === concepto);

            if (ing) {
              periodos[fechaStart].income[ing.key] = (periodos[fechaStart].income[ing.key] || 0) + montoPorFecha;
            } else if (eg) {
              periodos[fechaStart].expense[eg.key] = (periodos[fechaStart].expense[eg.key] || 0) + montoPorFecha;
            } else {
              noReconocidos.add(fila.Concepto); 
            }
          });
        }
      });

      await onImportarSemanas(Object.values(periodos));
      
      if (noReconocidos.size > 0) {
        alert("Atención: Los siguientes conceptos fueron ignorados porque no existen en tu configuración:\n\n" + Array.from(noReconocidos).join(", "));
      } else {
        alert("¡Proyecciones calculadas y guardadas con éxito!");
      }
      
    } catch (err) {
      console.error(err);
      alert("Error leyendo el archivo. Asegúrate de respetar el modelo.");
    } finally {
      setProcesando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ background: '#FBFAF8', padding: 16, border: '1px solid #DEDAD0', borderRadius: 8, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#12181F' }}>Generador de Proyecciones</h4>
          <p style={{ margin: 0, fontSize: 12, color: '#7C8891' }}>Soporta carga diaria exacta y repeticiones mensuales automáticas.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          
          <button onClick={onBorrarDatos} style={{ padding: '8px 12px', background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={14} /> Limpiar Datos
          </button>
          
          <button onClick={descargarModeloPresupuesto} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #C7C2B8', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={14} /> Modelo Proyecciones
          </button>
          
          <input type="file" accept=".xlsx, .xls, .csv" onChange={procesarArchivo} ref={fileInputRef} style={{ display: 'none' }} id="file-input" />
          <label htmlFor="file-input" style={{ padding: '8px 14px', background: '#0E6E5D', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Upload size={14} /> {procesando ? "Calculando..." : "Subir Proyección"}
          </label>
        </div>
      </div>
    </div>
  );
}
