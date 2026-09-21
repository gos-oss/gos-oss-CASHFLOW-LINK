import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Calendar, ArrowRight, Clipboard, Save, HelpCircle, Layers } from 'lucide-react';
import { tokens } from './tokens';

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

const MESES_MAP = {
  "ene": "01", "enero": "01", "jan": "01", "january": "01", "1": "01", "01": "01",
  "feb": "02", "febrero": "02", "february": "02", "2": "02", "02": "02",
  "mar": "03", "marzo": "03", "march": "03", "3": "03", "03": "03",
  "abr": "04", "abril": "04", "apr": "04", "april": "04", "4": "04", "04": "04",
  "may": "05", "mayo": "05", "5": "05", "05": "05",
  "jun": "06", "junio": "06", "june": "06", "6": "06", "06": "06",
  "jul": "07", "julio": "07", "july": "07", "7": "07", "07": "07",
  "ago": "08", "agosto": "08", "aug": "08", "august": "08", "8": "08", "08": "08",
  "sep": "09", "septiembre": "09", "setiembre": "09", "sept": "09", "september": "09", "9": "09", "09": "09",
  "oct": "10", "octubre": "10", "october": "10", "10": "10",
  "nov": "11", "noviembre": "11", "november": "11", "11": "11",
  "dic": "12", "diciembre": "12", "december": "12", "dec": "12", "12": "12"
};

const normalizar = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

// Diccionario amplio para presupuesto 2027
const SINONIMOS_PRESUPUESTO = {
  // INGRESOS
  "cupossocios": "custom_cupos-socios",
  "cupos": "custom_cupos-socios",
  "socios": "custom_cupos-socios",
  "cuotasmensuales": "custom_cuotas-mensuales",
  "cuotas": "custom_cuotas-mensuales",
  "cobranzas": "custom_cuotas-mensuales",
  "ventascdo": "custom_ventas-cdo",
  "ventas": "custom_ventas-cdo",
  "ventascontado": "custom_ventas-cdo",
  "posiblesventas": "custom_ventas-cdo",
  "pesa": "custom_pesa",
  "aportes": "custom_aportes",
  "aportescapital": "custom_aportes",

  // PROYECTOS
  "torreblue": "proy_torre-blue",
  "blue": "proy_torre-blue",
  "zoe": "proy_zoe",
  "torrered": "proy_torre-red",
  "red": "proy_torre-red",
  "isaura": "proy_isaura",
  "duo": "proy_duo",
  "300": "proy_300",
  "torre300": "proy_300",
  "boulevard": "proy_boulevard",
  "torregreen": "proy_torre-green",
  "green": "proy_torre-green",
  "masduo": "proy_mas-duo",
  "duo2": "proy_mas-duo",
  "auria": "proy_auria",
  "neuquen": "proy_neuquen",
  "300t3am": "proy_300-t3-am",
  "300t4am": "proy_300-t4-am",

  // EGRESOS ESTRUCTURA
  "rrhh": "custom_rrhh",
  "sueldos": "custom_rrhh",
  "sueldosycargas": "custom_rrhh",
  "personal": "custom_rrhh",
  "cargassociales": "custom_rrhh",
  "administracion": "custom_administracion",
  "gastosdeestructura": "custom_administracion",
  "estructura": "custom_administracion",
  "gastosfijos": "custom_administracion",
  "inversiones": "custom_inversiones",
  "inversion": "custom_inversiones",
  "pasivosfinancieros": "custom_pasivos-financieros",
  "pasivos": "custom_pasivos-financieros",
  "prestamos": "custom_pasivos-financieros",
  "deudas": "custom_pasivos-financieros",
  "bancos": "custom_pasivos-financieros"
};

export default function ImportadorPresupuestoExcel({
  year = "2027",
  planIncomeCats = [],
  planExpenseCats = [],
  onGuardarPlan,
  onClose
}) {
  const [modo, setModo] = useState("archivo"); // 'archivo' o 'pegar'
  const [textoPegado, setTextoPegado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sheetsList, setSheetsList] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [workbookCache, setWorkbookCache] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [mapeosManuales, setMapeosManuales] = useState({});
  const fileInputRef = useRef(null);

  const todasLasCategorias = useMemo(() => {
    const list = [];
    planIncomeCats.forEach(c => list.push({ key: c.key, label: c.label, tipo: "ingreso" }));
    planExpenseCats.forEach(c => list.push({ key: c.key, label: c.label, tipo: "egreso" }));
    return list;
  }, [planIncomeCats, planExpenseCats]);

  const detectarConcepto = (nombreFila) => {
    const norm = normalizar(nombreFila);
    if (!norm) return null;

    if (SINONIMOS_PRESUPUESTO[norm]) {
      const key = SINONIMOS_PRESUPUESTO[norm];
      const match = todasLasCategorias.find(c => c.key === key);
      if (match) return match;
    }

    const matchDirecto = todasLasCategorias.find(c => normalizar(c.label) === norm || normalizar(c.key) === norm);
    if (matchDirecto) return matchDirecto;

    const matchParcial = todasLasCategorias.find(c => {
      const cNorm = normalizar(c.label);
      return norm.includes(cNorm) || cNorm.includes(norm);
    });
    if (matchParcial) return matchParcial;

    return null;
  };

  const procesarTablaMatriz = (rows) => {
    if (!rows || rows.length < 2) {
      throw new Error("La planilla no contiene suficientes filas para analizar.");
    }

    // 1. Detectar fila de cabecera con meses (Ene, Feb, Mar...)
    let filaMesesIdx = -1;
    let columnasMeses = []; // { colIdx, mesKey, label }

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const fila = rows[r];
      if (!fila) continue;

      const mesesDetectados = [];
      for (let c = 1; c < fila.length; c++) {
        const val = String(fila[c] || "").trim().toLowerCase();
        // Verificar si contiene nombre de mes
        for (const [patron, codMes] of Object.entries(MESES_MAP)) {
          if (val === patron || val.startsWith(patron) || val.includes(` ${patron}`) || val.includes(`-${patron}`)) {
            // Evitar duplicar columna
            if (!mesesDetectados.some(m => m.colIdx === c)) {
              mesesDetectados.push({ colIdx: c, mesKey: codMes, label: String(fila[c]).trim() });
            }
            break;
          }
        }
      }

      if (mesesDetectados.length >= 4) { // Si encontró al menos 4 meses en esa fila
        filaMesesIdx = r;
        columnasMeses = mesesDetectados;
        break;
      }
    }

    // Si no encontró cabecera con nombres de mes, intentar asignar columnas consecutivas 1..12
    if (filaMesesIdx === -1 || columnasMeses.length < 4) {
      // Buscar primera fila con datos numéricos de ancho >= 12
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const fila = rows[r];
        if (!fila) continue;
        let numCols = 0;
        for (let c = 1; c < fila.length; c++) {
          const num = Number(String(fila[c]).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(num) && num > 0) numCols++;
        }
        if (numCols >= 8) {
          filaMesesIdx = r - 1 >= 0 ? r - 1 : 0;
          columnasMeses = [];
          for (let m = 1; m <= 12; m++) {
            const col = m;
            const cod = String(m).padStart(2, '0');
            columnasMeses.push({ colIdx: col, mesKey: cod, label: `Mes ${m}` });
          }
          break;
        }
      }
    }

    if (columnasMeses.length === 0) {
      throw new Error("No se detectaron las columnas de meses (Enero a Diciembre). Revisa que la planilla contenga encabezados mensuales.");
    }

    // 2. Analizar filas de conceptos
    const filasAnalizadas = [];
    const planResult = { ingreso: {}, egreso: {} };

    // Inicializar categorías en 0 para los 12 meses
    planIncomeCats.forEach(c => {
      planResult.ingreso[c.key] = { "01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,"10":0,"11":0,"12":0 };
    });
    planExpenseCats.forEach(c => {
      planResult.egreso[c.key] = { "01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,"10":0,"11":0,"12":0 };
    });

    for (let r = filaMesesIdx + 1; r < rows.length; r++) {
      const fila = rows[r];
      if (!fila || !fila[0]) continue;

      const nombreOriginal = String(fila[0]).trim();
      const norm = normalizar(nombreOriginal);

      // Descartar subtotales o encabezados de sección vacíos
      if (norm.includes("total") || norm.includes("saldo") || norm.includes("posicion") || norm.includes("flujo") || norm === "ingresos" || norm === "egresos") {
        continue;
      }

      // Extraer valores mensuales
      const valoresPorMes = { "01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,"10":0,"11":0,"12":0 };
      let sumaAnual = 0;

      columnasMeses.forEach(cm => {
        const raw = fila[cm.colIdx];
        let val = 0;
        if (typeof raw === "number") {
          val = raw;
        } else if (raw) {
          const cleanStr = String(raw).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
          val = parseFloat(cleanStr) || 0;
        }
        if (!isNaN(val)) {
          valoresPorMes[cm.mesKey] = Math.abs(val);
          sumaAnual += Math.abs(val);
        }
      });

      if (sumaAnual === 0) continue; // Fila sin importes

      const detected = detectarConcepto(nombreOriginal);

      filasAnalizadas.push({
        id: `fila_${r}`,
        nombreOriginal,
        detectedKey: detected ? detected.key : null,
        detectedLabel: detected ? detected.label : null,
        tipo: detected ? detected.tipo : (norm.includes("venta") || norm.includes("cuota") || norm.includes("cobro") ? "ingreso" : "egreso"),
        valoresPorMes,
        sumaAnual
      });
    }

    return {
      filaMesesIdx,
      columnasMeses,
      filasAnalizadas,
      planResult
    };
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    setErrorMsg(null);
    setAnalisis(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      setWorkbookCache(wb);
      setSheetsList(wb.SheetNames);
      
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      
      const ws = wb.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const resultado = procesarTablaMatriz(rows);
      setAnalisis(resultado);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el archivo Excel.");
    } finally {
      setCargando(false);
    }
  };

  const handleSelectSheet = (sheetName) => {
    if (!workbookCache) return;
    setSelectedSheet(sheetName);
    try {
      const ws = workbookCache.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const resultado = procesarTablaMatriz(rows);
      setAnalisis(resultado);
      setErrorMsg(null);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Error al analizar la hoja "${sheetName}": ${err.message}`);
    }
  };

  const handleProcesarTextoPegado = () => {
    if (!textoPegado.trim()) {
      setErrorMsg("Pega los datos de la planilla Excel en el cuadro de texto.");
      return;
    }
    setCargando(true);
    setErrorMsg(null);
    try {
      // Parsear líneas separadas por tabulación o punto y coma
      const lineas = textoPegado.split(/\r?\n/).filter(l => l.trim().length > 0);
      const rows = lineas.map(linea => {
        if (linea.includes("\t")) {
          return linea.split("\t");
        }
        if (linea.includes(";")) {
          return linea.split(";");
        }
        return linea.split(",");
      });

      const resultado = procesarTablaMatriz(rows);
      setAnalisis(resultado);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al interpretar las celdas pegadas.");
    } finally {
      setCargando(false);
    }
  };

  // Computar plan final aplicando mapeos manuales si los hay
  const planFinalConstruido = useMemo(() => {
    if (!analisis) return null;

    const plan = JSON.parse(JSON.stringify(analisis.planResult));

    analisis.filasAnalizadas.forEach(fila => {
      const targetKey = mapeosManuales[fila.id] !== undefined ? mapeosManuales[fila.id] : fila.detectedKey;
      if (!targetKey || targetKey === "ignorar") return;

      const catInfo = todasLasCategorias.find(c => c.key === targetKey);
      if (!catInfo) return;

      const tipo = catInfo.tipo;
      if (!plan[tipo][targetKey]) {
        plan[tipo][targetKey] = { "01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,"10":0,"11":0,"12":0 };
      }

      // Sumar valores
      Object.entries(fila.valoresPorMes).forEach(([m, val]) => {
        plan[tipo][targetKey][m] = (plan[tipo][targetKey][m] || 0) + val;
      });
    });

    let totalIng = 0;
    let totalEg = 0;
    Object.values(plan.ingreso).forEach(meses => {
      Object.values(meses).forEach(v => { totalIng += (v || 0); });
    });
    Object.values(plan.egreso).forEach(meses => {
      Object.values(meses).forEach(v => { totalEg += (v || 0); });
    });

    return {
      plan,
      totalIng,
      totalEg,
      resultadoNeto: totalIng - totalEg
    };
  }, [analisis, mapeosManuales, todasLasCategorias]);

  const confirmarYGuardar = async () => {
    if (!planFinalConstruido) return;
    setCargando(true);
    try {
      await onGuardarPlan(planFinalConstruido.plan, year);
      alert(`¡Presupuesto ${year} actualizado con éxito! Se cargaron $ ${fmt(planFinalConstruido.totalIng)} en Ingresos y $ ${fmt(planFinalConstruido.totalEg)} en Egresos.`);
      if (onClose) onClose();
    } catch (e) {
      alert("Error al guardar presupuesto: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      background: tokens.surface,
      border: `1px solid ${tokens.gold}`,
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 10px 30px rgba(14,21,36,0.12)",
      marginBottom: 20
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: tokens.goldSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={24} color={tokens.gold} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: tokens.ink }}>
              Analizador e Importador de Presupuesto Anual ({year})
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: tokens.textMuted }}>
              Sube tu planilla Excel de presupuesto o pega las celdas. Mapea obras, sueldos, cupos y ventas automáticamente.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.textMuted }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* TABS DE MODO DE ENTRADA */}
      {!analisis && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => { setModo("archivo"); setErrorMsg(null); }}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: `1px solid ${modo === 'archivo' ? tokens.gold : '#E2E8F0'}`,
              background: modo === 'archivo' ? tokens.goldSoft : '#fff',
              color: modo === 'archivo' ? tokens.ink : tokens.textMuted,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Upload size={15} color={tokens.gold} /> Subir archivo .xlsx / .xls
          </button>

          <button
            onClick={() => { setModo("pegar"); setErrorMsg(null); }}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: `1px solid ${modo === 'pegar' ? tokens.gold : '#E2E8F0'}`,
              background: modo === 'pegar' ? tokens.goldSoft : '#fff',
              color: modo === 'pegar' ? tokens.ink : tokens.textMuted,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Clipboard size={15} color={tokens.gold} /> Pegar celdas copiadas de Excel
          </button>
        </div>
      )}

      {/* ÁREA DE CARGA O PEGADO */}
      {!analisis ? (
        <div>
          {modo === "archivo" ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${errorMsg ? '#F87171' : '#CBD5E1'}`,
                borderRadius: 8,
                padding: "36px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: "#F8FAFC",
                transition: "all 0.2s"
              }}
            >
              <Upload size={32} color={tokens.gold} style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.ink }}>
                {cargando ? "Leyendo y analizando archivo..." : `Haz clic o arrastra tu archivo Excel del Presupuesto ${year}`}
              </div>
              <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                Soporta planillas .xlsx y .xls con columnas mensuales (Enero a Diciembre)
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>
                Abre tu Excel, selecciona la tabla (con cabeceras de meses e importes), presiona <strong>Ctrl+C</strong> y pégala aquí abajo con <strong>Ctrl+V</strong>:
              </p>
              <textarea
                rows={6}
                value={textoPegado}
                onChange={(e) => setTextoPegado(e.target.value)}
                placeholder="Pega aquí las celdas copiadas de Excel (tablas separadas por tabulación)..."
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  fontFamily: tokens.fontMono,
                  fontSize: 12,
                  boxSizing: "border-box"
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleProcesarTextoPegado}
                  disabled={cargando}
                  style={{
                    padding: "8px 18px",
                    background: tokens.ink,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {cargando ? "Procesando..." : "Analizar Celdas Pegadas"}
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEE2E2", border: "1px solid #F87171", borderRadius: 6, color: "#B91C1C", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
        </div>
      ) : (
        /* VISTA PREVIA Y MAPEADOR DE FILAS */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* BARRA DE HOJAS SI HAY MÚLTIPLES */}
          {sheetsList.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F1F5F9", padding: "8px 12px", borderRadius: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.ink }}>Hoja analizada:</span>
              <select
                value={selectedSheet}
                onChange={(e) => handleSelectSheet(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600 }}
              >
                {sheetsList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* TOTALES DETECTADOS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Ingresos Anuales ({year})</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.positive, fontFamily: tokens.fontMono }}>
                $ {fmt(planFinalConstruido?.totalIng)}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>Total proyectado del año</div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Egresos Totales ({year})</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.negative, fontFamily: tokens.fontMono }}>
                $ {fmt(planFinalConstruido?.totalEg)}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>Obras + RRHH + Estructura</div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Resultado Neto Anual</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (planFinalConstruido?.resultadoNeto || 0) >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono }}>
                $ {fmt(planFinalConstruido?.resultadoNeto)}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>Superávit / Déficit {year}</div>
            </div>
          </div>

          {/* TABLA DE REVISIÓN Y ASIGNACIÓN DE FILAS */}
          <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F1F5F9", textAlign: "left", borderBottom: "1px solid #CBD5E1" }}>
                  <th style={{ padding: "8px 12px" }}>Concepto en Excel</th>
                  <th style={{ padding: "8px 12px" }}>Categoría Asignada en Presupuesto</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Anual</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {analisis.filasAnalizadas.map(f => {
                  const valorMapeado = mapeosManuales[f.id] !== undefined ? mapeosManuales[f.id] : f.detectedKey;
                  const esMapeado = !!valorMapeado && valorMapeado !== "ignorar";

                  return (
                    <tr key={f.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: tokens.ink }}>
                        {f.nombreOriginal}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <select
                          value={valorMapeado || "ignorar"}
                          onChange={(e) => setMapeosManuales(prev => ({ ...prev, [f.id]: e.target.value }))}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: `1px solid ${esMapeado ? tokens.gold : '#CBD5E1'}`,
                            fontSize: 12,
                            fontWeight: 600,
                            background: esMapeado ? "#FEF9C3" : "#F8FAFC",
                            width: "100%",
                            maxWidth: 260
                          }}
                        >
                          <option value="ignorar">-- Ignorar fila --</option>
                          <optgroup label="INGRESOS">
                            {planIncomeCats.map(c => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="PROYECTOS / OBRAS">
                            {planExpenseCats.filter(c => c.key.startsWith("proy_")).map(c => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="ESTRUCTURA Y FINANZAS">
                            {planExpenseCats.filter(c => !c.key.startsWith("proy_")).map(c => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700 }}>
                        $ {fmt(f.sumaAnual)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        {esMapeado ? (
                          <span style={{ color: tokens.positive, fontSize: 11, fontWeight: 700 }}>✓ Asignado</span>
                        ) : (
                          <span style={{ color: tokens.textMuted, fontSize: 11 }}>Omitido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { setAnalisis(null); setTextoPegado(""); }}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
                color: tokens.textMuted
              }}
            >
              Cargar Otro Archivo
            </button>
            <button
              onClick={confirmarYGuardar}
              disabled={cargando}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 20px", background: tokens.ink, color: "#fff",
                border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.15)"
              }}
            >
              <Save size={16} color={tokens.gold} /> {cargando ? "Guardando en Supabase..." : `Confirmar y Aplicar a Presupuesto ${year}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
