import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download } from 'lucide-react';

export default function ImportadorCashflow({ baseIncome, baseExpense, onImportarSemanas }) {
  const [procesando, setProcesando] = useState(false);
  const fileInputRef = useRef(null);

  // Normaliza texto eliminando acentos, mayúsculas y caracteres especiales
  const normalizarTexto = (texto) => {
    if (!texto) return "";
    return String(texto)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
  };

  // Obtiene la fecha exacta del Lunes para una fecha ISO dada
  const obtenerInicioSemana = (fechaIso) => {
    const dt = new Date(fechaIso + "T00:00:00");
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt.setDate(diff));
    return monday.toISOString().slice(0, 10);
  };

  // Suma días a una fecha para el cálculo de prorrateos
  const sumarDias = (fechaIso, dias) => {
    const dt = new Date(fechaIso + "T00:00:00");
    dt.setDate(dt.getDate() + dias);
    return dt.toISOString().slice(0, 10);
  };

  // Genera y descarga el archivo Excel modelo
  const descargarPlantilla = () => {
    const ejemplo = [
      { Fecha: "2026-08-11", Concepto: "Cupos Neuquén", Monto: 150000, Semanas_Prorrateo: 1 },
      { Fecha: "2026-08-11", Concepto: "Proveedores", Monto: 200000, Semanas_Prorrateo: 4 },
      { Fecha: "2026-08-18", Concepto: "Sueldos oficina", Monto: 80000, Semanas_Prorrateo: 1 }
    ];
    const hoja = XLSX.utils.json_to_sheet(ejemplo);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Plantilla");
    XLSX.writeFile(libro, "Plantilla_Cashflow.xlsx");
  };

  // Lee el archivo Excel subido e impacta las semanas
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
        const fecha = fila.Fecha;
        const concepto = normalizarTexto(fila.Concepto);
        const montoTotal = Number(fila.Monto) || 0;
        const prorrateo = Math.max(1, Number(fila.Semanas_Prorrateo) || 1);

        if (!fecha || montoTotal === 0) return;

        const montoSemanal = montoTotal / prorrateo;
        const fechaBase = obtenerInicioSemana(fecha);

        for (let i = 0; i < prorrateo; i++) {
          const weekStart = sumarDias(fechaBase, i * 7);

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
            semanas[weekStart].income[ing.key] = (semanas[weekStart].income[ing.key] || 0) + montoSemanal;
          } else if (eg) {
            semanas[weekStart].expense[eg.key] = (semanas[weekStart].expense[eg.key] || 0) + montoSemanal;
          }
        }
      });

      const arregloSemanas = Object.values(semanas);
      await onImportarSemanas(arregloSemanas);
      alert("¡Importación e impacto en Supabase completado con éxito!");
    } catch (err) {
      console.error(err);
      alert("Error al procesar el archivo Excel.");
    } finally {
      setProcesando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ background: '#FBFAF8', padding: 16, border: '1px solid #DEDAD0', borderRadius: 8, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#12181F' }}>Importador Masivo por Fecha / Prorrateo</h4>
          <p style={{ margin: 0, fontSize: 12, color: '#7C8891' }}>Sube tu archivo para impactar directamente en Supabase.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={descargarPlantilla} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #C7C2B8', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={14} /> Plantilla Ejemplo
          </button>
          <input type="file" accept=".xlsx, .xls, .csv" onChange={procesarArchivo} ref={fileInputRef} style={{ display: 'none' }} id="file-input" />
          <label htmlFor="file-input" style={{ padding: '8px 14px', background: '#0E6E5D', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Upload size={14} /> {procesando ? "Guardando en Supabase..." : "Subir Excel"}
          </label>
        </div>
      </div>
    </div>
  );
}
