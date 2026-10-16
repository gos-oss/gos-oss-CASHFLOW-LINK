import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Filter,
  ArrowRight,
  Clock,
  ShieldCheck,
  Layers,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { tokens } from './tokens';
import { slugify, humanize } from './categories';

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

const MESES_DICT = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", set: "09", oct: "10", nov: "11", dic: "12",
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
  jan: "01", apr: "04", aug: "08", dec: "12"
};

// Convertir cualquier formato de fecha de Excel a AAAA-MM-DD
export const parsearFechaUniversal = (val, anioDefecto = 2026) => {
  if (val === null || val === undefined || val === "") return null;

  // 1. Objeto Date nativo de JS
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    if (val.getUTCHours() >= 20) {
      const ly = val.getFullYear();
      const lm = String(val.getMonth() + 1).padStart(2, "0");
      const ld = String(val.getDate()).padStart(2, "0");
      return `${ly}-${lm}-${ld}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 2. Número de serie de Excel (30000..70000)
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
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  // 3. Cadena de texto
  let s = String(val).trim().replace(/[\r\n\t]+/g, " ");

  // Remover nombres de días de la semana en español al inicio o al final
  s = s.replace(/^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?\s+/i, "");
  s = s.replace(/\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?$/i, "");
  s = s.replace(/\((lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?\)/i, "").trim();

  // Remover palabras comunes como "Semana", "Día", "Dia"
  s = s.replace(/^(semana|d[ií]a)\s+/i, "");

  // Si contiene fecha + hora (ej: "21/9/2026 00:00:00"), separar hora
  const spaceIdx = s.indexOf(" ");
  if (spaceIdx > 0 && (s.includes("/") || s.includes("-"))) {
    const candidate = s.slice(0, spaceIdx).trim();
    if (candidate.length >= 3 && /\d/.test(candidate)) s = candidate;
  }

  // Formato ISO: YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // Formatos con "de" (ej: "16 de octubre", "16 de Octubre de 2026")
  const deMatch = s.match(/^(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)(?:\s+de\s+(\d{2,4}))?$/i);
  if (deMatch) {
    const d = deMatch[1].padStart(2, "0");
    const mesNom = deMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let m = MESES_DICT[mesNom] || MESES_DICT[mesNom.slice(0, 3)];
    let y = deMatch[3] ? deMatch[3] : String(anioDefecto);
    if (y.length === 2) y = "20" + y;
    if (m && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // Formato con separadores (/ o - o .)
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

    if (isNaN(Number(m))) {
      const mesKey = p2.toLowerCase().slice(0, 3);
      if (MESES_DICT[mesKey]) m = MESES_DICT[mesKey];
    }

    if (y === "226" || y === "26") y = "2026";
    else if (y.length === 2) y = "20" + y;
    else if (y.length === 3 && y.startsWith("2")) y = "20" + y.slice(1);
    else if (y.length === 1) y = "202" + y;

    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  } else if (parts.length === 2) {
    let d = parts[0].padStart(2, "0");
    let m = parts[1].padStart(2, "0");

    if (isNaN(Number(m))) {
      const mesKey = parts[1].toLowerCase().slice(0, 3);
      if (MESES_DICT[mesKey]) m = MESES_DICT[mesKey];
    }

    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${anioDefecto}-${m}-${d}`;
    }
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
  const [successMsg, setSuccessMsg] = useState(null);
  const [soloDesdeHoy, setSoloDesdeHoy] = useState(false); // Carga completa por defecto para no excluir días
  const [fechaCorte, setFechaCorte] = useState(todayISO());
  const [modoReemplazo, setModoReemplazo] = useState("completo"); // "completo" | "conceptos" | "fusionar"
  const [rawParsedData, setRawParsedData] = useState(null);
  const [saldoManual, setSaldoManual] = useState(null);
  const [hojasDisponibles, setHojasDisponibles] = useState([]);
  const [hojaSeleccionada, setHojaSeleccionada] = useState("");
  const [isDragging, setIsDragging] = useState(false);
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

  // Mapeador amplio de sinónimos para vincular filas del Excel con categorías del sistema
  const mapaSinonimos = {
    // Ingresos
    "cuposneuquen": "cuposNeuquen",
    "cuposnqn": "cuposNeuquen",
    "cuponeuquen": "cuposNeuquen",
    "cuponqn": "cuposNeuquen",
    "neuquen": "cuposNeuquen",
    "nqn": "cuposNeuquen",
    "cuposboulevard": "cuposBoulevard",
    "cuposblvd": "cuposBoulevard",
    "cupoboulevard": "cuposBoulevard",
    "cupoblvd": "cuposBoulevard",
    "boulevard": "cuposBoulevard",
    "blvd": "cuposBoulevard",
    "cupoduo": "cupoDuo",
    "cuposduo": "cupoDuo",
    "duo": "cupoDuo",
    "masduo": "cupoDuo",
    "cupos300": "cupos300",
    "cupo300": "cupos300",
    "torre300": "cupos300",
    "link300": "cupos300",
    "300": "cupos300",
    "otrosingresos": "otrosIngresos",
    "otrosingreso": "otrosIngresos",
    "ingresosvarios": "otrosIngresos",
    "ingresovarios": "otrosIngresos",
    "variosingresos": "otrosIngresos",
    "otrosingresosvarios": "otrosIngresos",
    "varios": "otrosIngresos",
    "posiblesventas": "posiblesVentas",
    "posibleventa": "posiblesVentas",
    "ventas": "posiblesVentas",
    "ventasproyectadas": "posiblesVentas",
    "ventaproyectada": "posiblesVentas",
    "ventasmostrador": "posiblesVentas",
    "mostrador": "posiblesVentas",
    "ventaspaquetes": "posiblesVentas",
    "paquetes": "posiblesVentas",
    "ventascanjes": "posiblesVentas",
    "canjes": "posiblesVentas",
    "venta": "posiblesVentas",
    "cobranzascuotas": "cobranzasCuotas",
    "cobranzascuota": "cobranzasCuotas",
    "cobranzacuotas": "cobranzasCuotas",
    "cobranzacuota": "cobranzasCuotas",
    "cobranzas": "cobranzasCuotas",
    "cobranza": "cobranzasCuotas",
    "cuotas": "cobranzasCuotas",
    "cuota": "cobranzasCuotas",
    "cuotasclientes": "cobranzasCuotas",
    "cuotaclientes": "cobranzasCuotas",
    "cuotascliente": "cobranzasCuotas",
    "cuentascorrientes": "cobranzasCuotas",
    "cuentacorriente": "cobranzasCuotas",
    "ccclientes": "cobranzasCuotas",
    "honorariosproyectos": "honorarios",
    "honorarios": "honorarios",
    "sigmapropios": "sigmaPropios",
    "sigmasocios": "sigmaSocios",
    "sigma": "sigmaPropios",
    "comercializacion": "comercializacion",

    // Egresos
    "socios": "socios",
    "socio": "socios",
    "retirosocios": "socios",
    "retirossocios": "socios",
    "retirodesocios": "socios",
    "honorariossocios": "socios",
    "chequesemitidos": "chequesEmitidos",
    "cheques": "chequesEmitidos",
    "cheque": "chequesEmitidos",
    "chequese": "chequesEmitidos",
    "chemitidos": "chequesEmitidos",
    "prestamos": "prestamos",
    "prestamo": "prestamos",
    "creditos": "prestamos",
    "credito": "prestamos",
    "prestamosbancarios": "prestamos",
    "sueldosoficina": "sueldosOficina",
    "sueldosdeoficina": "sueldosOficina",
    "sueldooficina": "sueldosOficina",
    "sueldos": "sueldosOficina",
    "sueldo": "sueldosOficina",
    "haberes": "sueldosOficina",
    "haberesoficina": "sueldosOficina",
    "sueldosazlepi": "sueldosOficina",
    "sueldoscomercial": "sueldosOficina",
    "cargassocialesazlepiysigma": "cargasSociales",
    "cargassociales": "cargasSociales",
    "cargasocial": "cargasSociales",
    "f931": "cargasSociales",
    "931": "cargasSociales",
    "afip931": "cargasSociales",
    "cargassocialesazlepi": "cargasSociales",
    "cargassocialescomercial": "cargasSociales",
    "quincenaobra": "quincenaObra",
    "quincenadeobra": "quincenaObra",
    "quincenas": "quincenaObra",
    "quincena": "quincenaObra",
    "jornales": "quincenaObra",
    "jornal": "quincenaObra",
    "operarios": "quincenaObra",
    "planesdepagoimpuestos": "planesImpuestos",
    "planesdepago": "planesImpuestos",
    "planespago": "planesImpuestos",
    "plandepago": "planesImpuestos",
    "impuestos": "planesImpuestos",
    "impuesto": "planesImpuestos",
    "afip": "planesImpuestos",
    "arba": "planesImpuestos",
    "dgr": "planesImpuestos",
    "rentas": "planesImpuestos",
    "iibb": "planesImpuestos",
    "tarjetas": "tarjetas",
    "tarjeta": "tarjetas",
    "tarjetascredito": "tarjetas",
    "tarjetasdecredito": "tarjetas",
    "externos": "externos",
    "honorariosexternos": "externos",
    "profesionales": "externos",
    "seguros": "seguros",
    "seguro": "seguros",
    "polizas": "seguros",
    "poliza": "seguros",
    "mensuales": "mensuales",
    "gastosmensuales": "mensuales",
    "servicios": "mensuales",
    "rentaanticipada": "rentaAnticipada",
    "rentasanticipadas": "rentaAnticipada",
    "renta": "rentaAnticipada",
    "bajaclientes": "bajaClientes",
    "bajasclientes": "bajaClientes",
    "devoluciones": "bajaClientes",
    "devolucion": "bajaClientes",
    "rescisiones": "bajaClientes",
    "terrenoneuquen": "terrenoNeuquen",
    "terrenonqn": "terrenoNeuquen",
    "terreno": "terrenoNeuquen",
    "colonia": "colonia",
    "pagosdeldia": "pagosDia",
    "pagosdia": "pagosDia",
    "pagodia": "pagosDia",
    "pagos": "pagosDia",
    "salidasdeldia": "pagosDia",
    "otros": "otros",
    "otrosgastos": "otros",
    "otrosegresos": "otros",
    "gastosvarios": "otros",
    "egresosvarios": "otros",
    "rrhh": "rrhh",
    "recursoshumanos": "rrhh",
    "mkt": "mkt",
    "marketing": "mkt",
    "publicidad": "mkt",
    "tdyset": "tdys",
    "tdys": "tdys",
    "cx": "cx",
    "customerexperience": "cx",
    "postventa": "postVenta",
    "postventas": "postVenta",
    "post-venta": "postVenta",
    "contratistas": "contratistas",
    "contratista": "contratistas",
    "obras": "contratistas",
    "obra": "contratistas",
    "subcontratistas": "contratistas",
    "certificaciones": "contratistas",
    "proveedores": "proveedores",
    "proveedor": "proveedores",
    "pagosproveedores": "proveedores",
    "compras": "proveedores",
    "torregreen": "contratistas",
    "green": "contratistas",
    "auria": "contratistas"
  };

  const buscarConcepto = (nombreFila, seccionContexto = null) => {
    const norm = normalizar(nombreFila);
    if (!norm) return null;

    if (mapaSinonimos[norm]) {
      const key = mapaSinonimos[norm];
      const esIngreso = incomeCats.some(c => c.key === key);
      return { key, tipo: esIngreso ? "ingreso" : "egreso", label: nombreFila };
    }

    const catIng = incomeCats.find(c => {
      const nKey = normalizar(c.key);
      const nLab = normalizar(c.label);
      return nKey === norm || nLab === norm || (norm.length >= 4 && (nLab.includes(norm) || norm.includes(nLab)));
    });
    if (catIng) return { key: catIng.key, tipo: "ingreso", label: catIng.label };

    const catEg = expenseCats.find(c => {
      const nKey = normalizar(c.key);
      const nLab = normalizar(c.label);
      return nKey === norm || nLab === norm || (norm.length >= 4 && (nLab.includes(norm) || norm.includes(nLab)));
    });
    if (catEg) return { key: catEg.key, tipo: "egreso", label: catEg.label };

    // Si no está en el mapa, pero tenemos la sección detectada, lo creamos automáticamente como categoría personalizada
    if (seccionContexto) {
      const slug = slugify(nombreFila);
      return {
        key: `custom_${slug}`,
        tipo: seccionContexto,
        label: nombreFila,
        isCustom: true
      };
    }

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

    // A. DETECCIÓN DE FORMATO TABULAR (LISTA DE MOVIMIENTOS: Fecha | Concepto | Monto)
    let esTabular = false;
    let colFechaIdx = -1;
    let colConceptoIdx = -1;
    let colMontoIdx = -1;
    let colTipoIdx = -1;
    let filaCabeceraTabular = -1;

    for (let r = 0; r < Math.min(data.length, 25); r++) {
      const fila = data[r];
      if (!fila || !Array.isArray(fila)) continue;

      let fIdx = -1, cIdx = -1, mIdx = -1, tIdx = -1;
      fila.forEach((cell, idx) => {
        const s = normalizar(cell);
        if (s.includes("fecha") || s.includes("date") || s === "dia") fIdx = idx;
        else if (s.includes("concepto") || s.includes("rubro") || s.includes("categoria") || s.includes("detalle") || s.includes("descripcion")) cIdx = idx;
        else if (s.includes("monto") || s.includes("importe") || s.includes("total") || s.includes("valor")) mIdx = idx;
        else if (s.includes("tipo") || s.includes("flujo")) tIdx = idx;
      });

      if (fIdx !== -1 && (cIdx !== -1 || mIdx !== -1)) {
        esTabular = true;
        colFechaIdx = fIdx;
        colConceptoIdx = cIdx;
        colMontoIdx = mIdx;
        colTipoIdx = tIdx;
        filaCabeceraTabular = r;
        break;
      }
    }

    if (esTabular && colFechaIdx !== -1 && colMontoIdx !== -1) {
      // PROCESAR FORMATO TABULAR (LISTA)
      const fechasMap = {}; // fechaIso => { colIdx, fechaIso, original }
      const filasData = [];

      for (let r = filaCabeceraTabular + 1; r < data.length; r++) {
        const fila = data[r];
        if (!fila) continue;

        const fIso = parsearFechaUniversal(fila[colFechaIdx]);
        if (!fIso) continue;

        const rawVal = fila[colMontoIdx];
        let monto = 0;
        if (typeof rawVal === "number") monto = rawVal;
        else if (rawVal) {
          const cleanStr = String(rawVal).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/\s/g, "").trim();
          monto = parseFloat(cleanStr);
        }
        if (isNaN(monto) || monto === 0) continue;

        const conceptoStr = colConceptoIdx !== -1 && fila[colConceptoIdx] ? String(fila[colConceptoIdx]).trim() : "Varios";
        const tipoStr = colTipoIdx !== -1 && fila[colTipoIdx] ? String(fila[colTipoIdx]).toLowerCase() : null;
        let tipoFinal = tipoStr && (tipoStr.includes("ing") || tipoStr.includes("cobro")) ? "ingreso" : (tipoStr && (tipoStr.includes("egr") || tipoStr.includes("pago")) ? "egreso" : null);

        if (!fechasMap[fIso]) {
          fechasMap[fIso] = { colIdx: fIso, fechaIso: fIso, original: String(fila[colFechaIdx]) };
        }

        filasData.push({
          fechaIso: fIso,
          conceptoStr,
          monto,
          tipoFinal
        });
      }

      const columnasFechas = Object.values(fechasMap).sort((a, b) => a.fechaIso.localeCompare(b.fechaIso));
      if (columnasFechas.length === 0) {
        throw new Error(`Se detectó formato de lista en "${targetSheetName}", pero no se encontraron filas con fechas y montos válidos.`);
      }

      setRawParsedData({
        isTabular: true,
        filasData,
        columnasFechas,
        hoja: targetSheetName
      });
      return;
    }

    // B. FORMATO MATRICIAL (CASH EMPRESA - FECHAS EN COLUMNAS, CONCEPTOS EN FILAS)
    let mejorFilaFechasIdx = -1;
    let mejoresColumnasFechas = [];

    // Escanear hasta 50 filas buscando la fila de fechas
    for (let r = 0; r < Math.min(data.length, 50); r++) {
      const fila = data[r];
      if (!fila || !Array.isArray(fila)) continue;

      const fechasEnFila = [];
      // Escanear todas las columnas (desde 0)
      for (let c = 0; c < fila.length; c++) {
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
      throw new Error(`No se detectaron cabeceras de fechas válidas en la hoja "${targetSheetName}". Verifica que la planilla contenga columnas con fechas (ej: "16/10", "Vie 16/10", "21/09/2026").`);
    }

    setRawParsedData({
      isTabular: false,
      data,
      filaFechasIdx: mejorFilaFechasIdx,
      columnasFechas: mejoresColumnasFechas,
      hoja: targetSheetName
    });
  };

  const procesarArchivo = async (file) => {
    if (!file) return;
    setArchivo(file);
    setCargando(true);
    setErrorMsg(null);
    setSuccessMsg(null);
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

        for (let r = 0; r < Math.min(rows.length, 25); r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row)) continue;
          if (row.some(cell => {
            const str = String(cell || "").toLowerCase();
            return str.includes("cash empresa") || str.includes("saldo inicial") || str.includes("cash flow");
          })) {
            tieneCashEmpresa = true;
          }
          let datesInRow = 0;
          for (let c = 0; c < (row.length || 0); c++) {
            if (parsearFechaUniversal(row[c])) datesInRow++;
          }
          if (datesInRow > dateCount) dateCount = datesInRow;
        }

        const nameLower = name.toLowerCase();
        let score = dateCount * 2;
        if (tieneCashEmpresa) score += 50;
        if (nameLower.includes("cash") || nameLower.includes("empresa") || nameLower.includes("diario")) score += 30;
        if (nameLower.includes("2026") || nameLower.includes("actual") || nameLower.includes("movimientos")) score += 20;

        return { name, dateCount, tieneCashEmpresa, score };
      });

      setHojasDisponibles(hojasAnalizadas);
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

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleCambiarHoja = (nuevaHoja) => {
    setHojaSeleccionada(nuevaHoja);
    if (workbookRef.current) {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        procesarHoja(workbookRef.current, nuevaHoja);
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
  };

  // Computar resumen y semanas basado en la planilla y política de reemplazo
  const resumen = useMemo(() => {
    if (!rawParsedData) return null;

    const { isTabular, data, filasData, filaFechasIdx, columnasFechas, hoja } = rawParsedData;

    // Fechas ordenadas
    const todasFechasIso = columnasFechas.map(c => c.fechaIso).sort();
    const minFechaArchivo = todasFechasIso[0];
    const maxFechaArchivo = todasFechasIso[todasFechasIso.length - 1];

    // Filtrar fechas según corte si soloDesdeHoy está activo
    let columnasAProcesar = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso >= fechaCorte)
      : columnasFechas;
    const columnasOmitidas = soloDesdeHoy
      ? columnasFechas.filter(cf => cf.fechaIso < fechaCorte)
      : [];

    // Si el filtro de corte excluyó todas las fechas, auto-ajustar al mínimo en lugar de bloquear
    if (columnasAProcesar.length === 0) {
      columnasAProcesar = columnasFechas;
    }

    const semanasDict = {};
    const conceptosDetectados = new Set();
    const conceptosIgnorados = new Set();
    const mapaConceptosTipo = {};
    let saldoInicialDetectado = null;
    let fechaSaldoInicial = columnasAProcesar[0]?.fechaIso;
    let totalMovimientosProcesados = 0;

    // Precargar semanas y aplicar política de reemplazo
    columnasAProcesar.forEach(cf => {
      const wExistente = weeks.find(w => w.week_start === cf.fechaIso);
      if (wExistente) {
        semanasDict[cf.fechaIso] = {
          ...wExistente,
          income: { ...(wExistente.income || {}) },
          expense: { ...(wExistente.expense || {}) }
        };
      } else {
        semanasDict[cf.fechaIso] = {
          id: cf.fechaIso,
          week_start: cf.fechaIso,
          status: "proyectado",
          income: {},
          expense: {},
          notes: "{}"
        };
      }

      // Aplicar política de reemplazo sobre las fechas a procesar
      if (modoReemplazo === "completo") {
        // Reemplazo total: vacía completamente los movimientos en esta fecha para reflejar 100% el Excel
        semanasDict[cf.fechaIso].income = {};
        semanasDict[cf.fechaIso].expense = {};
      }
    });

    if (isTabular) {
      // ══════════════════════════════════════════════════════════════
      // FORMATO TABULAR (LISTA)
      // ══════════════════════════════════════════════════════════════
      filasData.forEach(item => {
        if (!semanasDict[item.fechaIso]) return;

        let match = buscarConcepto(item.conceptoStr, item.tipoFinal || "egreso");
        if (!match) {
          conceptosIgnorados.add(item.conceptoStr);
          return;
        }

        conceptosDetectados.add(match.label || item.conceptoStr);
        mapaConceptosTipo[match.key] = match.tipo;

        const semanaObj = semanasDict[item.fechaIso];
        const field = match.tipo === "ingreso" ? "income" : "expense";
        const prev = typeof semanaObj[field][match.key] === "object"
          ? (semanaObj[field][match.key]?.ars || 0)
          : Number(semanaObj[field][match.key] || 0);

        semanaObj[field][match.key] = {
          ars: prev + Math.abs(item.monto),
          usd: 0
        };
        totalMovimientosProcesados++;
      });
    } else {
      // ══════════════════════════════════════════════════════════════
      // FORMATO MATRICIAL (CASH EMPRESA)
      // ══════════════════════════════════════════════════════════════
      const primeraColIdx = columnasAProcesar[0]?.colIdx;
      const filasConceptos = [];
      let seccionActual = "ingreso"; // "ingreso" o "egreso"

      for (let r = filaFechasIdx + 1; r < data.length; r++) {
        const fila = data[r];
        if (!fila || !Array.isArray(fila)) continue;

        // Buscar el nombre del concepto en las primeras columnas antes de las fechas
        let nombreFila = "";
        const maxColText = typeof primeraColIdx === "number" ? Math.max(primeraColIdx, 1) : 3;
        for (let c = 0; c < maxColText; c++) {
          if (fila[c] !== null && fila[c] !== undefined && String(fila[c]).trim().length > 0) {
            const strVal = String(fila[c]).trim();
            // Ignorar números puros como IDs o índices de fila
            if (isNaN(Number(strVal.replace(/[^0-9]/g, ""))) || strVal.length > 5 || /[a-zA-Z]/.test(strVal)) {
              nombreFila = strVal;
              break;
            }
          }
        }

        if (!nombreFila) continue;
        const norm = normalizar(nombreFila);

        // Detectar cambio de sección en el Excel
        if (norm.includes("ingreso") && !norm.includes("total") && !norm.includes("otro")) {
          seccionActual = "ingreso";
          continue;
        }
        if (norm.includes("egreso") && !norm.includes("total") && !norm.includes("otro")) {
          seccionActual = "egreso";
          continue;
        }

        // Saldo inicial / bancos
        if (norm.includes("saldoinicial") || norm.includes("saldobancos") || norm.includes("saldocredimas") || norm.includes("saldocaja")) {
          if (primeraColIdx !== undefined && fila[primeraColIdx] !== null && fila[primeraColIdx] !== undefined) {
            const num = Number(String(fila[primeraColIdx]).replace(/[^0-9.-]+/g, ""));
            if (!isNaN(num) && num !== 0 && saldoInicialDetectado === null) {
              saldoInicialDetectado = num;
            }
          }
          continue;
        }

        // Totales o balances de fila (ignorar para no duplicar sumas)
        if (norm.includes("totalingresos") || norm.includes("totalegresos") || norm.includes("posiciondeldia") || norm.includes("saldoacumulado") || norm === "total") {
          continue;
        }

        const match = buscarConcepto(nombreFila, seccionActual);
        if (!match) {
          conceptosIgnorados.add(nombreFila);
          continue;
        }

        conceptosDetectados.add(match.label || nombreFila);
        mapaConceptosTipo[match.key] = match.tipo;
        filasConceptos.push({ rowIdx: r, fila, match });
      }

      // Si el modo es "conceptos", vaciamos solo los conceptos que figuran en el Excel
      if (modoReemplazo === "conceptos") {
        columnasAProcesar.forEach(cf => {
          Object.keys(mapaConceptosTipo).forEach(conceptKey => {
            const field = mapaConceptosTipo[conceptKey] === "ingreso" ? "income" : "expense";
            delete semanasDict[cf.fechaIso][field][conceptKey];
          });
        });
      }

      // En modo reemplazo completo, limpiar fechas intermedias dentro del rango si no están en el nuevo Excel
      if (modoReemplazo === "completo" && columnasAProcesar.length > 0) {
        const pFecha = columnasAProcesar[0].fechaIso;
        const uFecha = columnasAProcesar[columnasAProcesar.length - 1].fechaIso;
        weeks.forEach(w => {
          if (w.week_start >= pFecha && w.week_start <= uFecha && !semanasDict[w.week_start]) {
            semanasDict[w.week_start] = {
              ...w,
              income: {},
              expense: {}
            };
          }
        });
      }

      // Procesar importes de cada celda
      const yaAsignadoEnCorrida = {};
      filasConceptos.forEach(({ fila, match }) => {
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
          const claveCorrida = `${cf.fechaIso}_${field}_${match.key}`;

          if (modoReemplazo === "fusionar") {
            const prev = typeof semanaObj[field][match.key] === "object"
              ? (semanaObj[field][match.key]?.ars || 0)
              : Number(semanaObj[field][match.key] || 0);
            semanaObj[field][match.key] = {
              ars: prev + Math.abs(monto),
              usd: 0
            };
          } else {
            if (!yaAsignadoEnCorrida[claveCorrida]) {
              semanaObj[field][match.key] = {
                ars: Math.abs(monto),
                usd: 0
              };
              yaAsignadoEnCorrida[claveCorrida] = true;
            } else {
              semanaObj[field][match.key].ars += Math.abs(monto);
            }
          }
          totalMovimientosProcesados++;
        });
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
      modoReemplazo,
      semanasActualizadas: Object.values(semanasDict)
    };
  }, [rawParsedData, soloDesdeHoy, fechaCorte, modoReemplazo, saldoManual, weeks]);

  const confirmarImportacion = async () => {
    if (!resumen || !resumen.semanasActualizadas) return;
    setCargando(true);
    setErrorMsg(null);
    try {
      await onImportarMatriz({
        semanas: resumen.semanasActualizadas,
        saldoInicial: resumen.saldoInicialDetectado,
        fechaSaldoInicial: resumen.fechaSaldoInicial
      });
      setSuccessMsg({
        movimientos: resumen.totalMovimientos,
        fechas: resumen.fechasTotal,
        inicio: formatDate(resumen.primeraFecha),
        fin: formatDate(resumen.ultimaFecha)
      });
    } catch (e) {
      console.error(e);
      setErrorMsg("Error al guardar los datos: " + (e.message || String(e)));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      background: tokens.surface,
      border: `1.5px solid ${tokens.gold}`,
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 8px 24px rgba(14,21,36,0.12)",
      marginBottom: 20
    }}>
      {/* CABECERA DEL MODAL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: tokens.goldSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={24} color={tokens.gold} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: tokens.ink }}>
              Importador Inteligente de Movimientos (Excel Cashflow)
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: tokens.textMuted }}>
              Sube tu planilla de CASH EMPRESA o listado de movimientos. Compatible con formatos matriciales y tabulares.
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

      {/* MENSAJE DE ÉXITO IN-UI TRAS IMPORTAR */}
      {successMsg ? (
        <div style={{
          background: "#F0FDF4",
          border: "1.5px solid #86EFAC",
          borderRadius: 8,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={24} color="#16A34A" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#14532D" }}>
                ¡Movimientos Sincronizados y Reemplazados con Éxito!
              </div>
              <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>
                Se procesaron <strong>{successMsg.movimientos} importes</strong> en <strong>{successMsg.fechas} días</strong> (del {successMsg.inicio} al {successMsg.fin}).
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => {
                setSuccessMsg(null);
                setRawParsedData(null);
                setArchivo(null);
                if (onClose) onClose();
              }}
              style={{
                padding: "8px 16px",
                background: "#16A34A",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Listo, ver Cashflow
            </button>
            <button
              onClick={() => {
                setSuccessMsg(null);
                setRawParsedData(null);
                setArchivo(null);
              }}
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: "#166534",
                border: "1px solid #86EFAC",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Cargar otro archivo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TRATAMIENTO DE MOVIMIENTOS: SELECTOR DE POLÍTICA */}
          <div style={{
            background: modoReemplazo !== "fusionar" ? "#F0FDF4" : "#F8FAFC",
            border: `1.5px solid ${modoReemplazo !== "fusionar" ? "#86EFAC" : "#E2E8F0"}`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RefreshCw size={15} color={modoReemplazo !== "fusionar" ? "#15803D" : tokens.textMuted} />
                <span style={{ fontSize: 13, fontWeight: 700, color: modoReemplazo !== "fusionar" ? "#166534" : tokens.ink }}>
                  Modo de actualización en Cashflow:
                </span>
              </div>
              <span style={{
                fontSize: 11.5,
                background: modoReemplazo === "completo" ? "#DCFCE7" : modoReemplazo === "conceptos" ? "#FEF9C3" : "#E2E8F0",
                color: modoReemplazo === "completo" ? "#15803D" : modoReemplazo === "conceptos" ? "#854D0E" : tokens.textMuted,
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 700
              }}>
                {modoReemplazo === "completo" ? "✓ Reemplazo total (100% como el Excel)" : modoReemplazo === "conceptos" ? "Reemplazar conceptos detectados" : "Fusionar / Acumular"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: tokens.ink }}>
                <input
                  type="radio"
                  name="modoReemplazo"
                  value="completo"
                  checked={modoReemplazo === "completo"}
                  onChange={() => setModoReemplazo("completo")}
                  style={{ accentColor: "#15803D", cursor: "pointer" }}
                />
                <span><strong>Reemplazo total</strong> <span style={{ color: "#166534", fontWeight: 600 }}>(Recomendado: sobrescribe y reemplaza con los importes del Excel)</span></span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: tokens.ink }}>
                <input
                  type="radio"
                  name="modoReemplazo"
                  value="conceptos"
                  checked={modoReemplazo === "conceptos"}
                  onChange={() => setModoReemplazo("conceptos")}
                  style={{ accentColor: tokens.gold, cursor: "pointer" }}
                />
                <span><strong>Reemplazar conceptos detectados</strong> <span style={{ color: tokens.textMuted }}>(Solo actualiza los conceptos presentes)</span></span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: tokens.ink }}>
                <input
                  type="radio"
                  name="modoReemplazo"
                  value="fusionar"
                  checked={modoReemplazo === "fusionar"}
                  onChange={() => setModoReemplazo("fusionar")}
                  style={{ accentColor: tokens.gold, cursor: "pointer" }}
                />
                <span><strong>Solo fusionar / sumar</strong> <span style={{ color: tokens.textMuted }}>(Suma sin borrar nada)</span></span>
              </label>
            </div>
          </div>

          {/* SELECTOR DE HOJA Y FILTRO OPCIONAL DE CORTE */}
          <div style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: tokens.ink }}>
                <input
                  type="checkbox"
                  checked={soloDesdeHoy}
                  onChange={(e) => setSoloDesdeHoy(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: tokens.gold, cursor: "pointer" }}
                />
                <span>Limitar importación desde una fecha de corte</span>
              </label>

              {hojasDisponibles.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginLeft: 8 }}>
                  <Layers size={14} color={tokens.gold} />
                  <span style={{ color: tokens.textMuted, fontWeight: 600 }}>Pestaña Excel:</span>
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
                <span style={{ color: tokens.textMuted }}>Fecha corte:</span>
                <input
                  type="date"
                  value={fechaCorte}
                  onChange={(e) => setFechaCorte(e.target.value)}
                  style={{
                    padding: "3px 8px",
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
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                    fileInputRef.current.click();
                  }
                }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? tokens.gold : errorMsg ? '#F87171' : '#CBD5E1'}`,
                  borderRadius: 8,
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: isDragging ? "rgba(201, 174, 107, 0.08)" : "#F8FAFC",
                  transition: "all 0.2s"
                }}
              >
                <Upload size={32} color={tokens.gold} style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: tokens.ink }}>
                  {cargando ? "Leyendo y analizando archivo Excel..." : "Haz clic o arrastra tu archivo Excel aquí"}
                </div>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                  Compatible con .xlsx, .xls, .xlsm y .csv (CASH EMPRESA diario o listados de movimientos)
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .xlsm, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onClick={(e) => { e.target.value = null; }}
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>

              {errorMsg && (
                <div style={{ marginTop: 14, padding: "12px 16px", background: "#FEE2E2", border: "1px solid #F87171", borderRadius: 6, color: "#B91C1C", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>No se pudo procesar el archivo:</strong> {errorMsg}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* VISTA PREVIA Y CONFIRMACIÓN DE IMPORTACIÓN */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  <ShieldCheck size={22} color={tokens.gold} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink }}>
                      Archivo cargado: <strong>{archivo?.name || resumen.hoja}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: tokens.textMuted }}>
                      Se incorporarán <strong>{resumen.fechasTotal} días</strong>: desde <strong>{formatDate(resumen.primeraFecha)}</strong> hasta <strong>{formatDate(resumen.ultimaFecha)}</strong>.
                      {resumen.columnasOmitidas.length > 0 && ` (${resumen.columnasOmitidas.length} días anteriores omitidos)`}
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
                      width: 130,
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Días Reconocidos</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: tokens.ink, fontFamily: tokens.fontMono }}>
                    {resumen.fechasTotal} días
                  </div>
                  <div style={{ fontSize: 11, color: tokens.textMuted }}>
                    {formatDate(resumen.primeraFecha)} → {formatDate(resumen.ultimaFecha)}
                  </div>
                </div>

                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Movimientos a Reemplazar</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16A34A", fontFamily: tokens.fontMono }}>
                    {resumen.totalMovimientos} importes
                  </div>
                  <div style={{ fontSize: 11, color: tokens.textMuted }}>
                    En {resumen.conceptosDetectados.length} conceptos asignados
                  </div>
                </div>

                <div style={{
                  background: modoReemplazo === "completo" ? "#F0FDF4" : modoReemplazo === "conceptos" ? "#FEFCE8" : "#F8FAFC",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${modoReemplazo === "completo" ? "#BBF7D0" : modoReemplazo === "conceptos" ? "#FEF08A" : "#E2E8F0"}`
                }}>
                  <div style={{ fontSize: 11, color: modoReemplazo === "completo" ? "#166534" : modoReemplazo === "conceptos" ? "#854D0E" : tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>
                    Modo Activo
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: modoReemplazo === "completo" ? "#15803D" : modoReemplazo === "conceptos" ? "#A16207" : tokens.ink, marginTop: 2 }}>
                    {modoReemplazo === "completo" ? "Reemplazo Total (100%)" : modoReemplazo === "conceptos" ? "Reemplazo Parcial" : "Fusión"}
                  </div>
                  <div style={{ fontSize: 11, color: modoReemplazo === "completo" ? "#166534" : modoReemplazo === "conceptos" ? "#854D0E" : tokens.textMuted, marginTop: 2 }}>
                    {modoReemplazo === "completo" ? "Sobrescribe y reemplaza los movimientos" : modoReemplazo === "conceptos" ? "Solo conceptos presentes" : "Suma a lo preexistente"}
                  </div>
                </div>

                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: tokens.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Conceptos Sin Mapear</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: resumen.conceptosIgnorados.length > 0 ? tokens.negative : tokens.textMuted, fontFamily: tokens.fontMono }}>
                    {resumen.conceptosIgnorados.length}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.textMuted }}>
                    {resumen.conceptosIgnorados.length === 0 ? "100% categorizados" : "Filas no categorizadas"}
                  </div>
                </div>
              </div>

              {/* LISTA DE COLUMNAS DE FECHAS DETECTADAS */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "10px 14px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: tokens.ink, marginBottom: 6 }}>
                  Días y columnas reconocidas ({resumen.columnasAProcesar.length}):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 90, overflowY: "auto" }}>
                  {resumen.columnasAProcesar.map(cf => (
                    <span
                      key={cf.fechaIso}
                      style={{
                        background: "#fff",
                        border: "1px solid #CBD5E1",
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 11,
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
                  <strong>Nota:</strong> Filas ignoradas: <em>{resumen.conceptosIgnorados.slice(0, 6).join(", ")}</em>.
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #F87171", borderRadius: 6, color: "#B91C1C", fontSize: 13 }}>
                  <AlertTriangle size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  {errorMsg}
                </div>
              )}

              {/* BOTONES DE ACCIÓN */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setRawParsedData(null);
                    setArchivo(null);
                    setErrorMsg(null);
                  }}
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
                  Cambiar Archivo
                </button>
                <button
                  type="button"
                  onClick={confirmarImportacion}
                  disabled={cargando}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 20px",
                    background: modoReemplazo === "completo" ? "#15803D" : tokens.ink,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: cargando ? "wait" : "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                  }}
                >
                  <CheckCircle2 size={16} color="#fff" />
                  {cargando ? "Guardando y reemplazando movimientos..." : `Confirmar y ${modoReemplazo === "completo" ? "Reemplazar" : "Guardar"} en Cashflow`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
