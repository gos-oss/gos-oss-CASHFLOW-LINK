import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { tokens } from './tokens';

export default function ImportadorMatrizExcel({
  incomeCats = [],
  expenseCats = [],
  weeks = [],
  onImportarMatriz,
  onClose
}) {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
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

  // Convertir fecha de Excel a AAAA-MM-DD
  const parsearFechaExcel = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === "number") {
      // Excel serial date to JS Date
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    // Formato D/M/YYYY o DD/MM/YYYY
    if (s.includes("/")) {
      const partes = s.split("/");
      if (partes.length === 3) {
        let dia = partes[0].padStart(2, '0');
        let mes = partes[1].padStart(2, '0');
        let anio = partes[2];
        if (anio.length === 2) anio = "20" + anio;
        if (anio.length === 3) anio = "2" + anio; // caso raro como 226
        return `${anio}-${mes}-${dia}`;
      }
    }
    // Formato YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return s;
    }
    return null;
  };

  // Mapeador de conceptos de la planilla a claves de la app
  const mapaSinonimos = {
    // Ingresos
    "cuposneuquen": "cuposNeuquen",
    "cuposboulevard": "cuposBoulevard",
    "cupoduo": "cupoDuo",
    "cuposduo": "cupoDuo",
    "cupos300": "cupos300",
    "otrosingresos": "otrosIngresos",
    "posiblesventas": "posiblesVentas",
    "cobranzascuotas": "cobranzasCuotas",

    // Egresos
    "socios": "socios",
    "chequesemitidos": "chequesEmitidos",
    "prestamos": "prestamos",
    "sueldosoficina": "sueldosOficina",
    "cargassocialesazlepiysigma": "cargasSociales",
    "cargassociales": "cargasSociales",
    "quincenaobra": "quincenaObra",
    "planesdepagoimpuestos": "planesImpuestos",
    "planesdepago": "planesImpuestos",
    "impuestos": "planesImpuestos",
    "tarjetas": "tarjetas",
    "externos": "externos",
    "seguros": "seguros",
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
    "tdyset": "tdys",
    "tdys": "tdys",
    "cx": "cx",
    "postventa": "postVenta",
    "contratistas": "contratistas",
    "proveedores": "proveedores"
  };

  const buscarConcepto = (nombreFila) => {
    const norm = normalizar(nombreFila);
    if (!norm) return null;

    // 1. Ver en sinonimos
    if (mapaSinonimos[norm]) {
      const key = mapaSinonimos[norm];
      const esIngreso = incomeCats.some(c => c.key === key);
      return { key, tipo: esIngreso ? "ingreso" : "egreso" };
    }

    // 2. Buscar en incomeCats
    const catIng = incomeCats.find(c => normalizar(c.label) === norm || normalizar(c.key) === norm);
    if (catIng) return { key: catIng.key, tipo: "ingreso" };

    // 3. Buscar en expenseCats
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

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convertir a matriz 2D (filas x columnas)
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      if (!data || data.length < 2) {
        throw new Error("El archivo no contiene suficientes filas.");
      }

      // 1. Localizar la fila de fechas (cabecera). Puede ser la fila 0 o 1.
      let filaFechasIdx = -1;
      let columnasFechas = []; // { colIdx, fechaIso }

      for (let r = 0; r < Math.min(data.length, 5); r++) {
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
        throw new Error("No se detectaron fechas válidas en las columnas (ej: 18/9/2026, 21/9/2026). Verifica la cabecera.");
      }

      // 2. Extraer saldos iniciales (arqueo) si existen
      let saldoInicialDetectado = null;
      let fechaSaldoInicial = columnasFechas[0]?.fechaIso;

      // 3. Procesar las filas de movimientos
      // Agrupamos en un diccionario: { [fechaIso]: { week_start, income: {}, expense: {} } }
      const semanasDict = {};

      // Precargar semanas existentes para mergear sin destruir
      weeks.forEach(w => {
        semanasDict[w.week_start] = {
          ...w,
          income: { ...(w.income || {}) },
          expense: { ...(w.expense || {}) }
        };
      });

      // Asegurar que todas las fechas del Excel existan en el dict
      columnasFechas.forEach(cf => {
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
      let conceptosDetectados = new Set();
      let conceptosIgnorados = new Set();

      for (let r = filaFechasIdx + 1; r < data.length; r++) {
        const fila = data[r];
        if (!fila || !fila[0]) continue;

        const nombreFila = String(fila[0]).trim();
        const norm = normalizar(nombreFila);

        // Fila de saldo inicial
        if (norm.includes("saldoinicial") || norm.includes("saldobancos") || norm.includes("saldocredimas")) {
          // Si encontramos el saldo inicial del primer día
          const primerCol = columnasFechas[0]?.colIdx;
          if (primerCol !== undefined && fila[primerCol] !== null && fila[primerCol] !== undefined) {
            const num = Number(String(fila[primerCol]).replace(/[^0-9.-]+/g, ""));
            if (!isNaN(num) && num !== 0 && saldoInicialDetectado === null) {
              saldoInicialDetectado = num;
            }
          }
          continue;
        }

        // Fila de totales o cálculos (ignorar)
        if (norm.includes("totalingresos") || norm.includes("totalegresos") || norm.includes("posiciondeldia") || norm.includes("saldoacumulado")) {
          continue;
        }

        const match = buscarConcepto(nombreFila);
        if (!match) {
          conceptosIgnorados.add(nombreFila);
          continue;
        }

        conceptosDetectados.add(nombreFila);

        // Para cada fecha en las columnas, leer el monto si existe
        columnasFechas.forEach(cf => {
          const rawVal = fila[cf.colIdx];
          if (rawVal === null || rawVal === undefined || rawVal === "") return;

          // Parsear número (soportando formato texto o numérico)
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

          // Guardamos con estructura { ars: monto, usd: 0 }
          semanaObj[field][match.key] = {
            ars: Math.abs(monto),
            usd: 0
          };

          totalMovimientosProcesados++;
        });
      }

      setResumen({
        fechasTotal: columnasFechas.length,
        primeraFecha: columnasFechas[0]?.fechaIso,
        ultimaFecha: columnasFechas[columnasFechas.length - 1]?.fechaIso,
        totalMovimientos: totalMovimientosProcesados,
        conceptosDetectados: Array.from(conceptosDetectados),
        conceptosIgnorados: Array.from(conceptosIgnorados),
        saldoInicialDetectado,
        fechaSaldoInicial,
        semanasActualizadas: Object.values(semanasDict).filter(s => columnasFechas.some(c => c.fechaIso === s.week_start))
      });

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el archivo Excel.");
    } finally {
      setCargando(false);
    }
  };

  const confirmarImportacion = async () => {
    if (!resumen || !resumen.semanasActualizadas) return;
    setCargando(true);
    try {
      await onImportarMatriz({
        semanas: resumen.semanasActualizadas,
        saldoInicial: resumen.saldoInicialDetectado,
        fechaSaldoInicial: resumen.fechaSaldoInicial
      });
      alert(`¡Éxito! Se sincronizaron ${resumen.totalMovimientos} movimientos en ${resumen.fechasTotal} días.`);
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
              Importar Matriz de Cashflow (Excel Diario)
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>
              Sube directamente tu archivo Excel con las columnas por día (18/9, 21/9, 22/9...) y las filas por concepto.
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

      {!resumen ? (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed #CBD5E1`,
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
              {cargando ? "Leyendo y analizando matriz Excel..." : "Haz clic o arrastra tu archivo Excel aquí"}
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              Compatible con archivos .xlsx y .xls (formato idéntico a tu captura de CASH EMPRESA)
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* VISTA PREVIA DEL ANÁLISIS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Días Detectados</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tokens.ink, fontFamily: tokens.fontMono }}>
                {resumen.fechasTotal} días
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                Desde {resumen.primeraFecha} al {resumen.ultimaFecha}
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
              <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Conceptos Ignorados</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: resumen.conceptosIgnorados.length > 0 ? tokens.negative : tokens.textMuted, fontFamily: tokens.fontMono }}>
                {resumen.conceptosIgnorados.length}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted }}>
                {resumen.conceptosIgnorados.length === 0 ? "100% de conceptos mapeados" : "Sin mapear (filas vacías o no categorizadas)"}
              </div>
            </div>
          </div>

          {resumen.conceptosIgnorados.length > 0 && (
            <div style={{ padding: 10, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, fontSize: 12, color: "#92400E" }}>
              <strong>Nota:</strong> No se mapearon las filas: <em>{resumen.conceptosIgnorados.slice(0, 5).join(", ")}</em>. Si corresponden a un nuevo concepto, puedes crearlo en la pestaña "Conceptos".
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              onClick={() => { setResumen(null); setArchivo(null); }}
              style={{ padding: "8px 16px", background: "transparent", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600, color: tokens.textMuted }}
            >
              Cancelar y Subir Otro
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
              <CheckCircle2 size={16} color={tokens.gold} /> {cargando ? "Guardando en Cashflow..." : "Confirmar e Impactar en Movimientos"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
