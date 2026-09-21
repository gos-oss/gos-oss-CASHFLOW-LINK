import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Calendar, Filter, ArrowRight, Clock, ShieldCheck, Layers, RefreshCw } from 'lucide-react';
import { tokens } from './tokens';

const todayISO = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

const formatDate = (isoStr) => {
  if (!isoStr) return "";
  const partes = String(isoStr).split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return isoStr;
};

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

// Convertir cualquier formato de fecha de Excel a AAAA-MM-DD
export const parsearFechaUniversal = (val, anioDefecto = 2026) => {
  if (val === null || val === undefined || val === "") return null;

  // 1. Objeto Date nativo de JS
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    // Corrección por offset horario si el Date se generó en UTC
    if (val.getUTCHours() >= 20) {
      const ly = val.getFullYear();
      const lm = String(val.getMonth() + 1).padStart(2, "0");
      const ld = String(val.getDate()).padStart(2, "0");
      return `${ly}-${lm}-${ld}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 2. Número de serie de Excel (40000..70000 = años ~2009 a ~2091)
  if (typeof val === "number" && val > 30000 && val < 70000) {
    if (XLSX.SSF && XLSX.SSF.parse_date_code) {
      const dc = XLSX.SSF.parse_date_code(val);
      if (dc && dc.y && dc.m && dc.d) {
        let y = dc.y;
        if (y === 226 || y === 26) y = 2026;
        return `${y}-${String(dc.m).padStart(2, "0")}-${String(dc.d).padStart(2, "0")}`;
      }
    }
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  // 3. Cadena de texto
  let s = String(val).trim().replace(/[\r\n\t]+/g, " ");

  // Si la celda contiene fecha + hora (ej: "21/9/2026 00:00:00" o "2026-09-21 00:00"), separar fecha
  const spaceIdx = s.indexOf(" ");
  if (spaceIdx > 0 && (s.includes("/") || s.includes("-"))) {
    const candidate = s.slice(0, spaceIdx).trim();
    if (candidate.length >= 3) s = candidate;
  }

  // Formato ISO: YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    let y = isoMatch[1];
    let m = isoMatch[2].padStart(2, "0");
    let d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Formato con separador (/ o - o .)
  const parts = s.split(/[/.-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 3) {
    let p1 = parts[0];
    let p2 = parts[1];
    let p3 = parts[2].replace(/[^0-9]/g, "");

    // Caso YYYY/MM/DD
    if (p1.length === 4) {
      let y = p1;
      let m = p2.padStart(2, "0");
      let d = p3.padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    let d = p1.padStart(2, "0");
    let m = p2.padStart(2, "0");
    let y = p3;

    // Nombres de meses en español
    const meses = {
      ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
      jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12"
    };
    if (isNaN(Number(m))) {
      const mesKey = p2.toLowerCase().slice(0, 3);
      if (meses[mesKey]) m = meses[mesKey];
    }

    // Corrección inteligente de errores tipográficos en el año (ej: "226" -> 2026)
    if (y === "226" || y === "26") {
      y = "2026";
    } else if (y.length === 2) {
      y = "20" + y;
    } else if (y.length === 3 && y.startsWith("2")) {
      y = "20" + y.slice(1);
    } else if (y.length === 1) {
      y = "202" + y;
    }

    return `${y}-${m}-${d}`;
  } else if (parts.length === 2) {
    let d = parts[0].padStart(2, "0");
    let m = parts[1].padStart(2, "0");
    const meses = {
      ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
      jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12"
    };
    if (isNaN(Number(m))) {
      const mesKey = parts[1].toLowerCase().slice(0, 3);
      if (meses[mesKey]) m = meses[mesKey];
    }
    return `${anioDefecto}-${m}-${d}`;
  }

  return null;
};

export default function ImportadorMatrizExcel({
  incomeCats = [],
  expenseCats = [],
  weeks = [],
  onImportarMatriz,
  onClose
}) {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [soloDesdeHoy, setSoloDesdeHoy] = useState(true);
  const [fechaCorte, setFechaCorte] = useState(todayISO());
  const [rawParsedData, setRawParsedData] = useState(null);
  const [saldoManual, setSaldoManual] = useState(null);
  const [hojasDisponibles, setHojasDisponibles] = useState([]);
  const [hojaSeleccionada, setHojaSeleccionada] = useState("");
  const workbookRef = useRef(null);
  const fileInputRef = useRef(null);

  // Normalizador de texto para comparar conceptos (ignora mayúsculas, tildes, signos)
  const normalizar = (str) => {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  // Mapeador de sinónimos para vincular filas del Excel con categorías del sistema
  const mapaSinonimos = {
    // Ingresos
    "cuposneuquen": "cuposNeuquen",
    "cuposboulevard": "cuposBoulevard",
    "cupoduo": "cupoDuo",
    "cuposduo": "cupoDuo",
    "cupos300": "cupos300",
    "otrosingresos": "otrosIngresos",
    "otrosingreso": "otrosIngresos",
    "posiblesventas": "posiblesVentas",
    "posibleventa": "posiblesVentas",
    "ventas": "posiblesVentas",
    "cobranzascuotas": "cobranzasCuotas",
    "cobranzascuota": "cobranzasCuotas",
    "cobranzas": "cobranzasCuotas",
    "cuotas": "cobranzasCuotas",

    // Egresos
    "socios": "socios",
    "socio": "socios",
    "chequesemitidos": "chequesEmitidos",
    "cheques": "chequesEmitidos",
    "prestamos": "prestamos",
    "prestamo": "prestamos",
    "sueldosoficina": "sueldosOficina",
    "sueldos": "sueldosOficina",
    "cargassocialesazlepiysigma": "cargasSociales",
    "cargassociales": "cargasSociales",
    "quincenaobra": "quincenaObra",
    "quincena": "quincenaObra",
    "planesdepagoimpuestos": "planesImpuestos",
    "planesdepago": "planesImpuestos",
    "impuestos": "planesImpuestos",
    "afip": "planesImpuestos",
    "tarjetas": "tarjetas",
    "tarjeta": "tarjetas",
    "externos": "externos",
    "honorarios": "externos",
    "seguros": "seguros",
    "seguro": "seguros",
    "mensuales": "mensuales",
    "rentaanticipada": "rentaAnticipada",
    "bajaclientes": "bajaClientes",
    "terrenoneuquen": "terrenoNeuquen",
    "colonia": "colonia",
    "pagosdeldia": "pagosDia",
    "pagosdia": "pagosDia",
    "otros": "otros",
    "rrhh": "rrhh",
    "mkt": "mkt",
    "marketing": "mkt",
    "tdyset": "tdys",
    "tdys": "tdys",
    "cx": "cx",
    "postventa": "postVenta",
    "contratistas": "contratistas",
    "contratista": "contratistas",
    "obras": "contratistas",
    "proveedores": "proveedores",
    "proveedor": "proveedores"
  };

  const buscarConcepto = (nombreFila) => {
    const norm = normalizar(nombreFila);
    if (!norm) return null;

    if (mapaSinonimos[norm]) {
      const key = mapaSinonimos[norm];
      const esIngreso = incomeCats.some(c => c.key === key);
      return { key, tipo: esIngreso ? "ingreso" : "egreso" };
    }

    const catIng = incomeCats.find(c => normalizar(c.label) === norm || normalizar(c.key) === norm);
    if (catIng) return { key: catIng.key, tipo: "ingreso" };

    const catEg = expenseCats.find(c => normalizar(c.label) === norm || normalizar(c.key) === norm);
    if (catEg) return { key: catEg.key, tipo: "egreso" };

    return null;
  };

  // Función para procesar una hoja específica del workbook
  const procesarHoja = (wb, targetSheetName) => {
    const sheet = wb.Sheets[targetSheetName];
    if (!sheet) throw new Error(`No se encontró la hoja "${targetSheetName}".`);

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!data || data.length < 2) {
      throw new Error(`La hoja "${targetSheetName}" no contiene suficientes datos.`);
    }

    // Localizar la fila de fechas escaneando las primeras 30 filas
    let mejorFilaFechasIdx = -1;
    let mejoresColumnasFechas = [];

    for (let r = 0; r < Math.min(data.length, 30); r++) {
      const fila = data[r];
      if (!fila) continue;

      const fechasEnFila = [];
      for (let c = 1; c < fila.length; c++) {
        const fIso = parsearFechaUniversal(fila[c]);
        if (fIso) {
          fechasEnFila.push({ colIdx: c, fechaIso: fIso, original: fila[c] });
        }
      }

      if (fechasEnFila.length > mejoresColumnasFechas.length && fechasEnFila.length >= 2) {
        mejorFilaFechasIdx = r;
        mejoresColumnasFechas = fechasEnFila;
      }
    }

    if (mejorFilaFechasIdx === -1 || mejoresColumnasFechas.length === 0) {
      throw new Error(`No se detectaron cabeceras de fechas válidas en la hoja "${targetSheetName}". Verifica que contenga columnas con fechas (ej: 21/9/2026).`);
    }

    setRawParsedData({
      data,
      filaFechasIdx: mejorFilaFechasIdx,
      columnasFechas: mejoresColumnasFechas,
      hoja: targetSheetName
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    setCargando(true);
    setErrorMsg(null);
    setSaldoManual(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      workbookRef.current = workbook;

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error("El archivo Excel no contiene hojas de cálculo.");
      }

      // Analizar cada hoja para auto-seleccionar la mejor
      const hojasAnalizadas = sheetNames.map(name => {
        const s = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: null });
        let dateCount = 0;
        let tieneCashEmpresa = false;

        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r];
          if (!row) continue;
          if (row.some(cell => String(cell).toLowerCase().includes("cash empresa") || String(cell).toLowerCase().includes("saldo inicial"))) {
            tieneCashEmpresa = true;
          }
          let datesInRow = 0;
          for (let c = 1; c < (row.length || 0); c++) {
            if (parsearFechaUniversal(row[c])) datesInRow++;
          }
          if (datesInRow > dateCount) dateCount = datesInRow;
        }

        const nameLower = name.toLowerCase();
        let score = dateCount * 2;
        if (tieneCashEmpresa) score += 50;
        if (nameLower.includes("cash") || nameLower.includes("empresa")) score += 30;
        if (nameLower.includes("2026") || nameLower.includes("septiembre") || nameLower.includes("actual")) score += 20;

        return { name, dateCount, tieneCashEmpresa, score };
      });

      setHojasDisponibles(hojasAnalizadas);

      // Ordenar por score descendente
      hojasAnalizadas.sort((a, b) => b.score - a.score);
      const mejorHoja = hojasAnalizadas[0]?.name || sheetNames[0];

      setHojaSeleccionada(mejorHoja);
      procesarHoja(workbook, mejorHoja);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el archivo Excel.");
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarHoja = (nuevaHoja) => {
    setHojaSeleccionada(nuevaHoja);
    if (workbookRef.current) {
      setErrorMsg(null);
      try {
        procesarHoja(workbookRef.current, nuevaHoja);
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
  };

  // Computar resumen y semanas basado en el filtro de fecha actual
  const resumen = useMemo(() => {
    if (!rawParsedData) return null;
    const { data, filaFechasIdx, columnasFechas, hoja } = rawParsedData;

    // Fechas límites detectadas en el archivo
    const todasFechasIso = columnasFechas.map(c => c.fechaIso).sort();
    const minFechaArchivo = todasFechasIso[0];
    const maxFechaArchivo = todasFechasIso[todasFechasIso.length - 1];

    // Filtrar fechas según la opción seleccionada
    const columnasAProcesar = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso >= fechaCorte)
      : columnasFechas;

    const columnasOmitidas = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso < fechaCorte)
      : [];

    // Si el filtro de corte excluye todas las fechas, no bloquear con error ciego
    if (columnasAProcesar.length === 0) {
      return {
        corteDesfasado: true,
        hoja,
        minFechaArchivo,
        maxFechaArchivo,
        totalDetectadas: columnasFechas.length,
        columnasFechas,
        columnasOmitidas
      };
    }

    // Identificar saldo inicial de la primera fecha a procesar
    let saldoInicialDetectado = null;
    const primeraColIdx = columnasAProcesar[0]?.colIdx;
    const fechaSaldoInicial = columnasAProcesar[0]?.fechaIso;

    // Diccionario de semanas
    const semanasDict = {};

    // Precargar semanas existentes que caigan dentro del rango para mergear sin destruir
    weeks.forEach(w => {
      if (columnasAProcesar.some(c => c.fechaIso === w.week_start)) {
        semanasDict[w.week_start] = {
          ...w,
          income: { ...(w.income || {}) },
          expense: { ...(w.expense || {}) }
        };
      }
    });

    // Asegurar que todas las fechas a procesar existan en el dict
    columnasAProcesar.forEach(cf => {
      if (!semanasDict[cf.fechaIso]) {
        semanasDict[cf.fechaIso] = {
          id: cf.fechaIso,
          week_start: cf.fechaIso,
          status: "proyectado",
          income: {},
          expense: {},
          notes: "{}"
        };
      }
    });

    let totalMovimientosProcesados = 0;
    const conceptosDetectados = new Set();
    const conceptosIgnorados = new Set();

    for (let r = filaFechasIdx + 1; r < data.length; r++) {
      const fila = data[r];
      if (!fila || fila[0] === null || fila[0] === undefined) continue;

      const nombreFila = String(fila[0]).trim();
      if (!nombreFila) continue;
      const norm = normalizar(nombreFila);

      // Fila de saldo inicial / bancos
      if (norm.includes("saldoinicial") || norm.includes("saldobancos") || norm.includes("saldocredimas") || norm.includes("saldocaja")) {
        if (primeraColIdx !== undefined && fila[primeraColIdx] !== null && fila[primeraColIdx] !== undefined) {
          const num = Number(String(fila[primeraColIdx]).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(num) && num !== 0 && saldoInicialDetectado === null) {
            saldoInicialDetectado = num;
          }
        }
        continue;
      }

      // Fila de totales o cálculos (ignorar para no duplicar sumas)
      if (norm.includes("totalingresos") || norm.includes("totalegresos") || norm.includes("posiciondeldia") || norm.includes("saldoacumulado")) {
        continue;
      }

      const match = buscarConcepto(nombreFila);
      if (!match) {
        conceptosIgnorados.add(nombreFila);
        continue;
      }

      conceptosDetectados.add(nombreFila);

      // Leer importes para cada columna a procesar
      columnasAProcesar.forEach(cf => {
        const rawVal = fila[cf.colIdx];
        if (rawVal === null || rawVal === undefined || rawVal === "") return;

        let monto = 0;
        if (typeof rawVal === "number") {
          monto = rawVal;
        } else {
          const cleanStr = String(rawVal).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/\s/g, "").trim();
          monto = parseFloat(cleanStr);
        }

        if (isNaN(monto) || monto === 0) return;

        const semanaObj = semanasDict[cf.fechaIso];
        const field = match.tipo === "ingreso" ? "income" : "expense";

        semanaObj[field][match.key] = {
          ars: Math.abs(monto),
          usd: 0
        };

        totalMovimientosProcesados++;
      });
    }

    const saldoFinal = saldoManual !== null ? Number(saldoManual) : saldoInicialDetectado;

    return {
      corteDesfasado: false,
      hoja,
      fechasTotal: columnasAProcesar.length,
      primeraFecha: columnasAProcesar[0]?.fechaIso,
      ultimaFecha: columnasAProcesar[columnasAProcesar.length - 1]?.fechaIso,
      columnasAProcesar,
      columnasOmitidas,
      totalMovimientos: totalMovimientosProcesados,
      conceptosDetectados: Array.from(conceptosDetectados),
      conceptosIgnorados: Array.from(conceptosIgnorados),
      saldoInicialDetectado: saldoFinal,
      fechaSaldoInicial,
      semanasActualizadas: Object.values(semanasDict)
    };
  }, [rawParsedData, soloDesdeHoy, fechaCorte, saldoManual, weeks]);

  const confirmarImportacion = async () => {
    if (!resumen || !resumen.semanasActualizadas || resumen.corteDesfasado) return;
    setCargando(true);
    try {
      await onImportarMatriz({
        semanas: resumen.semanasActualizadas,
        saldoInicial: resumen.saldoInicialDetectado,
        fechaSaldoInicial: resumen.fechaSaldoInicial
      });
      alert(`¡Éxito! Se sincronizaron ${resumen.totalMovimientos} movimientos en ${resumen.fechasTotal} días (${formatDate(resumen.primeraFecha)} a ${formatDate(resumen.ultimaFecha)}).`);
      if (onClose) onClose();
    } catch (e) {
      alert("Error al guardar los datos: " + e.message);
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
      boxShadow: "0 8px 24px rgba(14,21,36,0.12)",
      marginBottom: 20
    }}>
      {/* CABECERA DEL MODAL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: tokens.goldSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={22} color={tokens.gold} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: tokens.ink }}>
              Incorporar Excel de Cashflow (Día de la fecha y Proyectado)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: tokens.textMuted }}>
              Sube tu planilla Excel de CASH EMPRESA. Incorpora automáticamente el día de la fecha y todas las semanas/días proyectados.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.textMuted, padding: 4 }}
            title="Cerrar importador"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* SELECTOR DE HOJA Y FECHA DE CORTE */}
      <div style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: tokens.ink }}>
            <input
              type="checkbox"
              checked={soloDesdeHoy}
              onChange={(e) => setSoloDesdeHoy(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: tokens.gold, cursor: "pointer" }}
            />
            <span>Incorporar desde el día de la fecha y proyectado</span>
          </label>

          {/* Selector de Hoja si el Excel tiene múltiples pestañas */}
          {hojasDisponibles.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginLeft: 8 }}>
              <Layers size={14} color={tokens.gold} />
              <span style={{ color: tokens.textMuted, fontWeight: 600 }}>Hoja:</span>
              <select
                value={hojaSeleccionada}
                onChange={(e) => handleCambiarHoja(e.target.value)}
                style={{
                  padding: "4px 8px",
                  border: `1px solid ${tokens.gold}`,
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tokens.ink,
                  background: "#fff",
                  cursor: "pointer"
                }}
              >
                {hojasDisponibles.map(h => (
                  <option key={h.name} value={h.name}>
                    {h.name} {h.dateCount > 0 ? `(${h.dateCount} fechas)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {soloDesdeHoy && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: tokens.textMuted }}>Día de la fecha (corte):</span>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              style={{
                padding: "4px 8px",
                border: "1px solid #CBD5E1",
                borderRadius: 5,
                fontFamily: tokens.fontMono,
                fontSize: 12,
                fontWeight: 600,
                color: tokens.ink
              }}
            />
            <button
              type="button"
              onClick={() => setFechaCorte(todayISO())}
              style={{
                padding: "3px 8px",
                background: "#E2E8F0",
                border: "none",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                color: tokens.ink
              }}
            >
              Hoy ({formatDate(todayISO())})
            </button>
          </div>
        )}
      </div>

      {/* DROPZONE / CARGADOR */}
      {!rawParsedData ? (
        <div>
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
              {cargando ? "Leyendo y analizando archivo Excel..." : "Haz clic o arrastra tu archivo Excel aquí"}
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              Compatible con archivos .xlsx y .xls (formato matricial de CASH EMPRESA)
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {errorMsg && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEE2E2", border: "1px solid #F87171", borderRadius: 6, color: "#B91C1C", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
        </div>
      ) : resumen?.corteDesfasado ? (
        /* PANEL PROACTIVO CUANDO LAS FECHAS DEL EXCEL SON ANTERIORES AL CORTE */
        <div style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 8,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertTriangle size={20} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>
                Fechas detectadas en la planilla: del {formatDate(resumen.minFechaArchivo)} al {formatDate(resumen.maxFechaArchivo)}
              </div>
              <div style={{ fontSize: 12.5, color: "#78350F", marginTop: 4 }}>
                La opción de corte está configurada en <strong>{formatDate(fechaCorte)}</strong>, por lo que las {resumen.totalDetectadas} columnas detectadas quedaron fuera del rango. Elige una acción para incorporar los datos:
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
            <button
              onClick={() => {
                setFechaCorte(resumen.minFechaArchivo);
                setSoloDesdeHoy(true);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", background: tokens.ink, color: "#fff",
                border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <Calendar size={14} color={tokens.gold} />
              Ajustar fecha de corte al inicio de la planilla ({formatDate(resumen.minFechaArchivo)})
            </button>

            <button
              onClick={() => setSoloDesdeHoy(false)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", background: "#fff", color: tokens.ink,
                border: "1px solid #D97706", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <CheckCircle2 size={14} color="#D97706" />
              Incorporar todas las fechas sin aplicar corte ({resumen.totalDetectadas} días)
            </button>

            <button
              onClick={() => {
                setRawParsedData(null);
                setArchivo(null);
              }}
              style={{
                padding: "8px 14px", background: "transparent",
                border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 12.5,
                color: tokens.textMuted, cursor: "pointer", fontWeight: 600
              }}
            >
              Subir otro archivo
            </button>
          </div>
        </div>
      ) : (
        /* VISTA PREVIA Y CONFIRMACIÓN DE IMPORTACIÓN */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* BANNER DE RESUMEN DEL RANGO */}
          <div style={{
            background: "rgba(201, 174, 107, 0.12)",
            border: `1px solid rgba(201, 174, 107, 0.4)`,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldCheck size={20} color={tokens.gold} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink }}>
                  {soloDesdeHoy ? `Incorporando Día de la Fecha y Proyecciones` : `Incorporando Todo el Histórico del Excel`}
                </div>
                <div style={{ fontSize: 12, color: tokens.textMuted }}>
                  Se cargarán <strong>{resumen.fechasTotal} columnas</strong>: desde <strong>{formatDate(resumen.primeraFecha)}</strong> hasta <strong>{formatDate(resumen.ultimaFecha)}</strong>.
                  {resumen.columnasOmitidas.length > 0 && ` (${resumen.columnasOmitidas.length} columnas anteriores a ${formatDate(fechaCorte)} omitidas para proteger el histórico)`}
                </div>
              </div>
            </div>

            {/* Ajuste opcional de saldo inicial detectado */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ color: tokens.ink, fontWeight: 600 }}>Saldo inicial ({formatDate(resumen.fechaSaldoInicial)}):</span>
              <input
                type="number"
                value={resumen.saldoInicialDetectado !== null && resumen.saldoInicialDetectado !== undefined ? resumen.saldoInicialDetectado : ""}
                placeholder="0"
                onChange={(e) => setSaldoManual(e.target.value ? Number(e.target.value) : 0)}
                style={{
                  width: 140,
                  padding: "4px 8px",
                  border: "1px solid #CBD5E1",
                  borderRadius: 5,
                  fontFamily: tokens.fontMono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tokens.positive,
                  textAlign: "right"
                }}
              />
            </div>
          </div>

          {/* TARJETAS KPI DE DIAGNÓSTICO */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Días a Incorporar</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.ink, fontFamily: tokens.fontMono }}>
                {resumen.fechasTotal} días
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                {formatDate(resumen.primeraFecha)} → {formatDate(resumen.ultimaFecha)}
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Movimientos Válidos</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.positive, fontFamily: tokens.fontMono }}>
                {resumen.totalMovimientos} importes
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                En {resumen.conceptosDetectados.length} conceptos asignados
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Conceptos Sin Mapear</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: resumen.conceptosIgnorados.length > 0 ? tokens.negative : tokens.textMuted, fontFamily: tokens.fontMono }}>
                {resumen.conceptosIgnorados.length}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                {resumen.conceptosIgnorados.length === 0 ? "100% reconocidos" : "Filas no categorizadas"}
              </div>
            </div>
          </div>

          {/* LISTA DE COLUMNAS DE FECHAS DETECTADAS */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: tokens.ink, marginBottom: 6 }}>
              Columnas reconocidas en la planilla ({resumen.columnasAProcesar.length}):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {resumen.columnasAProcesar.map(cf => (
                <span
                  key={cf.fechaIso}
                  style={{
                    background: "#fff",
                    border: "1px solid #CBD5E1",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11.5,
                    fontFamily: tokens.fontMono,
                    fontWeight: 600,
                    color: tokens.ink
                  }}
                >
                  {formatDate(cf.fechaIso)}
                </span>
              ))}
            </div>
          </div>

          {resumen.conceptosIgnorados.length > 0 && (
            <div style={{ padding: 10, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, fontSize: 12, color: "#92400E" }}>
              <strong>Nota:</strong> Filas no mapeadas: <em>{resumen.conceptosIgnorados.slice(0, 6).join(", ")}</em>. Si corresponden a un nuevo concepto, puedes agregarlo en la pestaña "Conceptos".
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              onClick={() => { setRawParsedData(null); setArchivo(null); }}
              style={{ padding: "8px 16px", background: "transparent", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600, color: tokens.textMuted }}
            >
              Cambiar Archivo
            </button>
            <button
              onClick={confirmarImportacion}
              disabled={cargando}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", background: tokens.ink, color: "#fff",
                border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              <CheckCircle2 size={16} color={tokens.gold} /> {cargando ? "Guardando en Cashflow..." : "Confirmar e Incorporar al Cashflow"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
