import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download } from 'lucide-react';

export default function ImportadorCashflow({ baseIncome, baseExpense, onImportarSemanas }) {
  const [procesando, setProcesando] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Limpieza de textos
  const normalizarTexto = (texto) => {
    if (!texto) return "";
    return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  };

  // 2. Encuentra el Lunes de cualquier fecha exacta
  const obtenerInicioSemana = (fechaIso) => {
    const dt = new Date(fechaIso + "T00:00:00");
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt.setDate(diff));
    return monday.toISOString().slice(0, 10);
  };

  // 3. Calcula todos los Lunes que existen en un mes específico (ej: "2026-09")
  const obtenerLunesDelMes = (anioMes) => {
    const [year, month] = anioMes.split("-").map(Number);
    const lunes = [];
    
    // Recorremos todos los días posibles del mes
    for (let dia = 1; dia <= 31; dia++) {
      const fecha = new Date(year, month - 1, dia);
      if (fecha.getMonth() !== month - 1) break; // Si el mes cambia, detenemos el ciclo
      
      // Si el día de la semana es 1 (Lunes), lo guardamos
      if (fecha.getDay() === 1) {
        lunes.push(fecha.toISOString().slice(0, 10));
      }
    }
    return lunes;
  };

  // 4. Descarga del archivo modelo
  const descargarModeloPresupuesto = () => {
    const estructuraModelo = [
      { Concepto: "Sueldos oficina", Tipo_Carga: "Mensual", Mes_o_Fecha: "2026-09", Monto_Total: 1000000 },
      { Concepto: "Proveedores", Tipo_Carga: "Exacta", Mes_o_Fecha: "2026-09-15", Monto_Total: 250000 },
      { Concepto: "Cupos Neuquén", Tipo_Carga: "Mensual", Mes_o_Fecha: "2026-10", Monto_Total: 4000000 }
    ];

    const hoja = XLSX.utils.json_to_sheet(estructuraModelo);
    hoja['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Proyecciones");
    XLSX.writeFile(libro, "Modelo_Proyecciones.xlsx");
  };

  // 5. Procesamiento y matemáticas de distribución
  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcesando(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja);

      const semanas = {};

      filas.forEach((fila) => {
        const concepto = normalizarTexto(fila.Concepto);
        const tipoCarga = normalizarTexto(fila.Tipo_Carga);
        const montoTotal = Number(fila.Monto_Total) || 0;

        let mesOFecha = "";

        // ¡NUEVO!: Corrección para fechas seriales de Excel
        if (typeof fila.Mes_o_Fecha === 'number') {
          // Excel cuenta días desde el 1 de enero de 1900. Ajustamos la diferencia matemática.
          const excelDate = new Date(Math.round((fila.Mes_o_Fecha - 25569) * 86400 * 1000));
          mesOFecha = excelDate.toISOString().slice(0, 10);
        } else {
          mesOFecha = String(fila.Mes_o_Fecha).trim();
        }

        if (!mesOFecha || montoTotal === 0) return;

        let semanasAImpactar = [];
        let montoPorSemana = 0;

        // LÓGICA DE LAS DOS VARIABLES
        if (tipoCarga.includes("mensual")) {
          // Extraemos todos los lunes del mes y dividimos el monto
          semanasAImpactar = obtenerLunesDelMes(mesOFecha);
          montoPorSemana = montoTotal / semanasAImpactar.length;
        } else {
          // Buscamos la única semana a la que pertenece la fecha exacta
          semanasAImpactar = [obtenerInicioSemana(mesOFecha)];
          montoPorSemana = montoTotal;
        }

        // Impactamos el dinero en el objeto temporal
        semanasAImpactar.forEach(weekStart => {
          if (!semanas[weekStart]) {
            semanas[weekStart] = {
              id: "w_" + Math.random().toString(36).slice(2, 10),
              week_start: weekStart,
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
            semanas[weekStart].income[ing.key] = (semanas[weekStart].income[ing.key] || 0) + montoPorSemana;
          } else if (eg) {
            semanas[weekStart].expense[eg.key] = (semanas[weekStart].expense[eg.key] || 0) + montoPorSemana;
          }
        });
      });

      // Enviamos a la base de datos (Supabase)
      await onImportarSemanas(Object.values(semanas));
      alert("¡Proyecciones calculadas y guardadas con éxito!");
      
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
          <p style={{ margin: 0, fontSize: 12, color: '#7C8891' }}>Soporta presupuesto mensual prorrateado y fechas exactas de pago.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
