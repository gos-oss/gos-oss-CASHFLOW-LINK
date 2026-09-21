import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Calendar, Filter, ArrowRight, Clock, ShieldCheck } from 'lucide-react';
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
  const partes = isoStr.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return isoStr;
};

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

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

  // Convertir cualquier formato de fecha de Excel a AAAA-MM-DD
  const parsearFechaExcel = (val, anioDefecto = 2026) => {
    if (!val) return null;
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === "number") {
      // Excel serial date to JS Date (40000..60000 corresponden a fechas válidas)
      if (val > 35000 && val < 65000) {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().slice(0, 10);
      }
    }
    const s = String(val).trim();
    // Formato YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return s;
    }
    // Formato D/M/YYYY o DD/MM/YYYY o D/M
    if (s.includes("/")) {
      const partes = s.split("/").map(p => p.trim());
      if (partes.length === 3) {
        let dia = partes[0].padStart(2, '0');
        let mes = partes[1].padStart(2, '0');
        let anio = partes[2];
        if (anio.length === 2) anio = "20" + anio;
        if (anio.length === 3) anio = "2" + anio;
        return `${anio}-${mes}-${dia}`;
      } else if (partes.length === 2) {
        let dia = partes[0].padStart(2, '0');
        let mes = partes[1].padStart(2, '0');
        return `${anioDefecto}-${mes}-${dia}`;
      }
    }
    // Formato D-M-YYYY o D-M (con nombres de mes como sep, oct, etc.)
    if (s.includes("-") && !s.match(/^\d{4}/)) {
      const partes = s.split("-").map(p => p.trim());
      if (partes.length === 3) {
        let dia = partes[0].padStart(2, '0');
        let mes = partes[1].padStart(2, '0');
        let anio = partes[2];
        if (anio.length === 2) anio = "20" + anio;
        return `${anio}-${mes}-${dia}`;
      } else if (partes.length === 2) {
        const mesesNombres = { ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06", jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12" };
        let dia = partes[0].padStart(2, '0');
        let mesStr = partes[1].toLowerCase().slice(0, 3);
        let mes = mesesNombres[mesStr] || partes[1].padStart(2, '0');
        return `${anioDefecto}-${mes}-${dia}`;
      }
    }
    return null;
  };

  // Mapeador amplio de sinónimos para coincidir con la planilla del usuario
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
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (!data || data.length < 2) {
        throw new Error("El archivo no contiene suficientes filas.");
      }

      // 1. Localizar la fila de fechas (cabecera)
      let filaFechasIdx = -1;
      let columnasFechas = [];

      for (let r = 0; r < Math.min(data.length, 6); r++) {
        const fila = data[r];
        if (!fila) continue;

        const fechasEnFila = [];
        for (let c = 1; c < fila.length; c++) {
          const fIso = parsearFechaExcel(fila[c]);
          if (fIso) {
            fechasEnFila.push({ colIdx: c, fechaIso: fIso });
          }
        }

        if (fechasEnFila.length >= 2) {
          filaFechasIdx = r;
          columnasFechas = fechasEnFila;
          break;
        }
      }

      if (filaFechasIdx === -1 || columnasFechas.length === 0) {
        throw new Error("No se detectaron fechas válidas en las columnas (ej: 21/9/2026, 22/9/2026). Verifica la cabecera.");
      }

      setRawParsedData({ data, filaFechasIdx, columnasFechas });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el archivo Excel.");
    } finally {
      setCargando(false);
    }
  };

  // Computar resumen y semanas basado en el filtro de fecha actual
  const resumen = useMemo(() => {
    if (!rawParsedData) return null;
    const { data, filaFechasIdx, columnasFechas } = rawParsedData;

    // Filtrar fechas según la opción seleccionada: desde el día de la fecha en adelante, o todo
    const columnasAProcesar = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso >= fechaCorte)
      : columnasFechas;

    const columnasOmitidas = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso < fechaCorte)
      : [];

    if (columnasAProcesar.length === 0) {
      return {
        error: `No hay columnas con fecha igual o posterior al corte (${formatDate(fechaCorte)}). Desmarca la opción o ajusta la fecha.`,
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
      if (!fila || !fila[0]) continue;

      const nombreFila = String(fila[0]).trim();
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
          const cleanStr = String(rawVal).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
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
    if (!resumen || !resumen.semanasActualizadas || resumen.error) return;
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
              Sube tu planilla Excel. Incorpora automáticamente el día de la fecha y todas las semanas/días proyectados a futuro.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.textMuted }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* SELECTOR DE MODO DE INCORPORACIÓN */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: tokens.ink }}>
            <input
              type="checkbox"
              checked={soloDesdeHoy}
              onChange={(e) => setSoloDesdeHoy(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: tokens.gold, cursor: "pointer" }}
            />
            <span>Incorporar desde el día de la fecha y proyectado hacia adelante</span>
          </label>
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

      {!resumen || resumen.error ? (
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

          {resumen?.error && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, color: "#92400E", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} /> {resumen.error}
            </div>
          )}
        </div>
      ) : (
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
                  {resumen.columnasOmitidas.length > 0 && ` (${resumen.columnasOmitidas.length} columnas históricas anteriores a ${formatDate(fechaCorte)} fueron omitidas para no alterar el pasado)`}
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

          {/* VISTA PREVIA DEL ANÁLISIS EN TARJETAS */}
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
                {resumen.conceptosIgnorados.length === 0 ? "100% reconocidos" : "Filas vacías o no categorizadas"}
              </div>
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
