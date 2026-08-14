import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Trash2 } from 'lucide-react';

export default function ImportadorCashflow({ baseIncome, baseExpense, onImportarSemanas, onBorrarDatos, semanasExistentes = [] }) {
  const [procesando, setProcesando] = useState(false);
  const fileInputRef = useRef(null);

  const normalizarTexto = (texto) => {
    if (!texto) return "";
    return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  };

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

  const descargarModeloPresupuesto = () => {
    const estructuraModelo = [
      { Concepto: "Sueldos oficina", Tipo_Carga: "Mensual", Mes_o_Fecha: "2026-09", Monto_Total: 1000000, Repeticiones: 3 },
      { Concepto: "Proveedores", Tipo_Carga: "Exacta", Mes_o_Fecha: "2026-09-15", Monto_Total: 250000, Repeticiones: 1 }
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

      // 1. Objeto temporal para agrupar únicamente lo que viene en el Excel
      const excelData = {};
      const noReconocidos = new Set(); 

      filas.forEach((fila) => {
        const concepto = normalizarTexto(fila.Concepto);
        const tipoCarga = normalizarTexto(fila.Tipo_Carga);
        const montoTotal = Number(fila.Monto_Total) || 0;
        const repeticiones = Number(fila.Repeticiones) || 1; 

        let mesOFechaBase = "";

        if (typeof fila.Mes_o_Fecha === 'number') {
          const excelDate = new Date(Math.round((fila.Mes_o_Fecha - 25569) * 86400 * 1000));
          mesOFechaBase = excelDate.toISOString().slice(0, 10);
        } else {
          mesOFechaBase = String(fila.Mes_o_Fecha).trim();
        }

        if (!mesOFechaBase || montoTotal === 0) return;

        for (let i = 0; i < repeticiones; i++) {
          let fechasAImpactar = [];
          let montoPorFecha = 0;

          if (tipoCarga.includes("mensual")) {
            const mesProyectado = sumarMesesAnioMes(mesOFechaBase, i);
            fechasAImpactar = obtenerLunesDelMes(mesProyectado);
            montoPorFecha = montoTotal / fechasAImpactar.length;
          } else {
            const fechaProyectada = sumarMesesExactos(mesOFechaBase, i);
            fechasAImpactar = [fechaProyectada]; 
            montoPorFecha = montoTotal;
          }

          fechasAImpactar.forEach(fechaStart => {
            if (!excelData[fechaStart]) {
              excelData[fechaStart] = { income: {}, expense: {} };
            }

            const ing = baseIncome.find(c => normalizarTexto(c.label) === concepto || normalizarTexto(c.key) === concepto);
            const eg = baseExpense.find(c => normalizarTexto(c.label) === concepto || normalizarTexto(c.key) === concepto);

            // Sumamos DENTRO del mismo archivo Excel por si tienes dos filas iguales en el documento
            if (ing) {
              excelData[fechaStart].income[ing.key] = (excelData[fechaStart].income[ing.key] || 0) + montoPorFecha;
            } else if (eg) {
              excelData[fechaStart].expense[eg.key] = (excelData[fechaStart].expense[eg.key] || 0) + montoPorFecha;
            } else {
              noReconocidos.add(fila.Concepto); 
            }
          });
        }
      });

      // 2. FUSIÓN INTELIGENTE: Reemplazamos la base de datos con los datos del Excel
      const periodosArray = Object.keys(excelData).map(fechaStart => {
        // Traemos lo que ya existía en la base de datos para no borrar otros conceptos
        const semanaPrevia = semanasExistentes.find(w => w.week_start === fechaStart);
        
        const objFinal = {
          id: fechaStart,
          week_start: fechaStart,
          status: "proyectado",
          saldo_inicial: semanaPrevia?.saldo_inicial || 0,
          saldo_bancos: semanaPrevia?.saldo_bancos || 0,
          saldo_credimas: semanaPrevia?.saldo_credimas || 0,
          income: semanaPrevia?.income ? { ...semanaPrevia.income } : {},
          expense: semanaPrevia?.expense ? { ...semanaPrevia.expense } : {},
          notes: semanaPrevia?.notes || ""
        };

        // LÓGICA DE PROTECCIÓN: Sobrescribimos (reemplazamos) el valor viejo por el nuevo
        // Así, si subes el mismo archivo, simplemente reemplaza el número por el mismo número, sin duplicarlo.
        Object.keys(excelData[fechaStart].income).forEach(key => {
          objFinal.income[key] = excelData[fechaStart].income[key];
        });
        
        Object.keys(excelData[fechaStart].expense).forEach(key => {
          objFinal.expense[key] = excelData[fechaStart].expense[key];
        });

        return objFinal;
      });

      // 3. Enviamos los datos limpios y seguros a Supabase
      await onImportarSemanas(periodosArray);
      
      if (noReconocidos.size > 0) {
        alert("Atención: Los siguientes conceptos fueron ignorados porque no existen en tu configuración:\n\n" + Array.from(noReconocidos).join(", "));
      } else {
        alert("¡Proyecciones calculadas y actualizadas con éxito!");
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
    <div style={{ padding: 16, border: 'none', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Importador Seguro</h4>
          <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Sube tu Excel. Reemplaza sin duplicar.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          
          <button onClick={onBorrarDatos} style={{ padding: '8px 12px', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={14} /> Limpiar Todo
          </button>
          
          <button onClick={descargarModeloPresupuesto} style={{ padding: '8px 12px', background: '#F8FAFC', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={14} /> Modelo
          </button>
          
          <input type="file" accept=".xlsx, .xls, .csv" onChange={procesarArchivo} ref={fileInputRef} style={{ display: 'none' }} id="file-input" />
          <label htmlFor="file-input" style={{ padding: '8px 14px', background: '#10B981', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Upload size={14} /> {procesando ? "Calculando..." : "Subir Proyección"}
          </label>
        </div>
      </div>
    </div>
  );
}
