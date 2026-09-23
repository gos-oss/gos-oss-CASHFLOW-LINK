import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { tokens } from "./tokens";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  X, HelpCircle, Layers, Check, ArrowRight, Clipboard, RefreshCw,
  Building2, DollarSign, Info
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

// Normalización de texto para coincidencia de columnas
const normalizarColumna = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

// Limpieza de números (elimina símbolos $, USD, espacios, gestiona comas/puntos decimales)
const limpiarNumero = (val) => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim()
    .replace(/[$uusd\s]/gi, "")
    .replace(/m2|m²/gi, "");

  // Si tiene formato latino con puntos de miles y coma decimal (ej: 120.500,50 o 120.000)
  if (str.includes(".") && str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    // Si sólo tiene coma, asumimos decimal o miles según posición
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      str = parts.join(""); // Miles ej: 120,000
    } else {
      str = str.replace(",", "."); // Decimal ej: 68,5
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Mapeo inteligente de nombres de columnas a propiedades del modelo
const MAPA_COLUMNAS = {
  proyecto: [
    "proyecto", "edificio", "obra", "emprendimiento", "desarrollo", "project", "torre", "complejo"
  ],
  unidad: [
    "unidad", "depto", "departamento", "nro", "numero", "identificacion", "unit", "inmueble", "codigo", "nombreunidad", "numunidad"
  ],
  tipologia: [
    "tipologia", "tipologiaunidad", "tipo", "ambientes", "dormitorios", "dpto", "categoria", "type"
  ],
  piso: [
    "piso", "nivel", "floor", "planta"
  ],
  orientacion: [
    "orientacion", "orientacionunidad", "disposicion", "vista", "frente", "orientation"
  ],
  m2_propios: [
    "m2propios", "m2propio", "suppropia", "superficiepropia", "m2cubiertos", "areapropia", "m2utiles", "cubiertos", "m2p"
  ],
  m2_totales: [
    "m2totales", "m2total", "suptotal", "superficietotal", "areatotal", "m2construidos", "m2t", "m2"
  ],
  precio_usd: [
    "preciousd", "precio", "valorusd", "valuacionusd", "valor", "montousd", "importeusd", "preciodelista", "valorus", "precioenusd", "price", "valuacion"
  ],
  precio_m2_usd: [
    "preciom2usd", "usdm2", "preciom2", "valorm2", "m2usd", "usdpm2", "valorm2usd"
  ],
  estado: [
    "estado", "status", "condicion", "situacion", "disponibilidad"
  ],
  entrega_estimada: [
    "entregaestimada", "entrega", "fechaentrega", "plazoentrega", "plazodeentrega", "posesion"
  ],
  observaciones: [
    "observaciones", "observacion", "notas", "nota", "descripcion", "comentarios", "detalle"
  ]
};

// Detectar a qué campo del modelo corresponde una columna del archivo
const detectarCampo = (nombreColumnaOriginal) => {
  const norm = normalizarColumna(nombreColumnaOriginal);
  for (const [campo, sinonimos] of Object.entries(MAPA_COLUMNAS)) {
    if (sinonimos.includes(norm)) return campo;
  }
  return null;
};

export default function ImportadorStockModal({
  onImportar,
  onClose,
  unidadesActualesCount = 0
}) {
  const [tab, setTab] = useState("archivo"); // 'archivo' | 'pegar' | 'guia'
  const [archivoNombre, setArchivoNombre] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [filasParsed, setFilasParsed] = useState(null);
  const [columnasDetectadas, setColumnasDetectadas] = useState([]);
  const [modoImportacion, setModoImportacion] = useState("reemplazar"); // 'reemplazar' | 'agregar'
  const [textoPegado, setTextoPegado] = useState("");

  const fileInputRef = useRef(null);

  // Descargar Plantilla Excel Formateada
  const descargarPlantillaExcel = () => {
    const datosEjemplo = [
      {
        "Proyecto": "+ DUO Proyecto",
        "Unidad": "Torre 1 · Piso 02 - Depto A",
        "Tipologia": "2 Dormitorios",
        "Piso": "Piso 2",
        "Orientacion": "Frente Norte",
        "M2_Propios": 68.5,
        "M2_Totales": 78.0,
        "Valuacion_USD": 126725,
        "USD_M2": 1850,
        "Estado": "Disponible",
        "Entrega_Estimada": "Diciembre 2027",
        "Observaciones": "Balcón con asador, suite principal."
      },
      {
        "Proyecto": "+ DUO Proyecto",
        "Unidad": "Torre 1 · Piso 03 - Depto B",
        "Tipologia": "1 Dormitorio",
        "Piso": "Piso 3",
        "Orientacion": "Contrafrente",
        "M2_Propios": 48.0,
        "M2_Totales": 55.0,
        "Valuacion_USD": 88800,
        "USD_M2": 1850,
        "Estado": "Disponible",
        "Entrega_Estimada": "Diciembre 2027",
        "Observaciones": "Cocina integrada equipada, balcón corrido."
      },
      {
        "Proyecto": "Torre Green Proyecto",
        "Unidad": "Piso 04 - Depto 402",
        "Tipologia": "2 Dormitorios",
        "Piso": "Piso 4",
        "Orientacion": "Frente",
        "M2_Propios": 74.0,
        "M2_Totales": 85.0,
        "Valuacion_USD": 144300,
        "USD_M2": 1950,
        "Estado": "Disponible",
        "Entrega_Estimada": "Noviembre 2027",
        "Observaciones": "Balcón terraza con parrilla y cochera."
      },
      {
        "Proyecto": "Auria Proyecto",
        "Unidad": "Piso 06 - Depto B",
        "Tipologia": "1 Dormitorio",
        "Piso": "Piso 6",
        "Orientacion": "Norte Panorámica",
        "M2_Propios": 50.0,
        "M2_Totales": 58.0,
        "Valuacion_USD": 97500,
        "USD_M2": 1950,
        "Estado": "Disponible",
        "Entrega_Estimada": "Diciembre 2027",
        "Observaciones": "Vista al parque, aberturas DVH."
      },
      {
        "Proyecto": "Cupo Link # 300",
        "Unidad": "Torre 2 · Piso 08 - 801",
        "Tipologia": "2 Dormitorios",
        "Piso": "Piso 8",
        "Orientacion": "Esquina",
        "M2_Propios": 71.5,
        "M2_Totales": 82.0,
        "Valuacion_USD": 143000,
        "USD_M2": 2000,
        "Estado": "Disponible",
        "Entrega_Estimada": "Junio 2027",
        "Observaciones": "Piso alto, cochera cubierta incluida."
      },
      {
        "Proyecto": "Cupo Link Neuquén",
        "Unidad": "Piso 03 - Depto 302",
        "Tipologia": "Monoambiente",
        "Piso": "Piso 3",
        "Orientacion": "Frente",
        "M2_Propios": 35.0,
        "M2_Totales": 41.0,
        "Valuacion_USD": 66500,
        "USD_M2": 1900,
        "Estado": "Disponible",
        "Entrega_Estimada": "Diciembre 2027",
        "Observaciones": "Ideal renta corporativa."
      }
    ];

    const hoja = XLSX.utils.json_to_sheet(datosEjemplo);
    hoja["!cols"] = [
      { wch: 22 }, // Proyecto
      { wch: 28 }, // Unidad
      { wch: 18 }, // Tipologia
      { wch: 12 }, // Piso
      { wch: 18 }, // Orientacion
      { wch: 14 }, // M2_Propios
      { wch: 14 }, // M2_Totales
      { wch: 16 }, // Valuacion_USD
      { wch: 12 }, // USD_M2
      { wch: 16 }, // Estado
      { wch: 18 }, // Entrega_Estimada
      { wch: 35 }  // Observaciones
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock_Disponibles");
    XLSX.writeFile(libro, "Plantilla_Stock_Disponibles_Link.xlsx");
  };

  // Descargar Plantilla CSV
  const descargarPlantillaCSV = () => {
    const csvContent =
`Proyecto,Unidad,Tipologia,Piso,Orientacion,M2_Propios,M2_Totales,Valuacion_USD,USD_M2,Estado,Entrega_Estimada,Observaciones
"+ DUO Proyecto","Torre 1 · Piso 02 - Depto A","2 Dormitorios","Piso 2","Frente Norte",68.5,78.0,126725,1850,"Disponible","Diciembre 2027","Balcón con asador, suite principal."
"+ DUO Proyecto","Torre 1 · Piso 03 - Depto B","1 Dormitorio","Piso 3","Contrafrente",48.0,55.0,88800,1850,"Disponible","Diciembre 2027","Cocina integrada, balcón corrido."
"Torre Green Proyecto","Piso 04 - Depto 402","2 Dormitorios","Piso 4","Frente",74.0,85.0,144300,1950,"Disponible","Noviembre 2027","Balcón terraza con parrilla."
"Auria Proyecto","Piso 06 - Depto B","1 Dormitorio","Piso 6","Norte Panorámica",50.0,58.0,97500,1950,"Disponible","Diciembre 2027","Vista al parque, DVH."
"Cupo Link # 300","Torre 2 · Piso 08 - 801","2 Dormitorios","Piso 8","Esquina",71.5,82.0,143000,2000,"Disponible","Junio 2027","Piso alto, cochera incluida."
"Cupo Link Neuquén","Piso 03 - Depto 302","Monoambiente","Piso 3","Frente",35.0,41.0,66500,1900,"Disponible","Diciembre 2027","Ideal renta corporativa."`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Plantilla_Stock_Disponibles_Link.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Procesador general de filas (desde JSON extraído de Excel o de texto pegado)
  const procesarMatrizDatos = (filasBrutas, nombreOrigen = "archivo") => {
    if (!filasBrutas || filasBrutas.length === 0) {
      setErrorMsg("El archivo o texto no contiene filas de datos para procesar.");
      return;
    }

    // Tomar los encabezados de la primera fila
    const primeraFila = filasBrutas[0];
    const columnasOriginales = Object.keys(primeraFila);

    // Mapear columnas originales a campos del modelo
    const mapeo = {};
    const colsDetectadas = [];

    columnasOriginales.forEach(col => {
      const campo = detectarCampo(col);
      if (campo) {
        mapeo[col] = campo;
        colsDetectadas.push({ original: col, campo });
      }
    });

    setColumnasDetectadas(colsDetectadas);

    // Validar si encontramos al menos columnas clave (Proyecto o Unidad o Precio)
    const camposEncontrados = Object.values(mapeo);
    const tieneIdentificador = camposEncontrados.includes("unidad") || camposEncontrados.includes("proyecto");
    const tienePrecio = camposEncontrados.includes("precio_usd") || camposEncontrados.includes("precio_m2_usd");

    if (!tieneIdentificador && !tienePrecio) {
      setErrorMsg("No se detectaron columnas estándar en el archivo (se requiere al menos 'Proyecto', 'Unidad' o 'Valuacion_USD'). Revisa la guía de columnas o descarga la plantilla oficial.");
      return;
    }

    // Transformar cada fila en una unidad normalizada
    const unidadesProcesadas = [];
    const timestamp = Date.now();

    filasBrutas.forEach((fila, idx) => {
      const u = {};

      // Cargar valores mapeados
      for (const [colOriginal, campo] of Object.entries(mapeo)) {
        u[campo] = fila[colOriginal];
      }

      // Limpieza y cálculo de campos numéricos
      const m2_propios = limpiarNumero(u.m2_propios);
      const m2_totales = limpiarNumero(u.m2_totales) || m2_propios;
      let precio_usd = limpiarNumero(u.precio_usd);
      let precio_m2_usd = limpiarNumero(u.precio_m2_usd);

      // Auto-cálculo de precio si falta precio_usd o precio_m2_usd
      if (precio_usd > 0 && m2_propios > 0 && precio_m2_usd === 0) {
        precio_m2_usd = Math.round(precio_usd / m2_propios);
      } else if (precio_m2_usd > 0 && m2_propios > 0 && precio_usd === 0) {
        precio_usd = Math.round(precio_m2_usd * m2_propios);
      }

      // Nombre de proyecto y unidad
      const proyecto = String(u.proyecto || "Proyecto Link").trim();
      const unidad = String(u.unidad || `Unidad ${idx + 1}`).trim();

      // Descartar filas completamente vacías
      if (!proyecto && !unidad && precio_usd === 0 && m2_propios === 0) {
        return;
      }

      // Normalizar estado
      let estado = String(u.estado || "Disponible").trim();
      const estadoNorm = normalizarColumna(estado);
      if (estadoNorm.includes("reserv")) estado = "Reservado";
      else if (estadoNorm.includes("negoc")) estado = "En Negociación";
      else if (estadoNorm.includes("bloq")) estado = "Bloqueado";
      else estado = "Disponible";

      // Tipología
      let tipologia = String(u.tipologia || "2 Dormitorios").trim();
      const tipNorm = normalizarColumna(tipologia);
      if (tipNorm.includes("mono")) tipologia = "Monoambiente";
      else if (tipNorm.includes("1dorm") || tipNorm === "1d" || tipNorm.includes("1amb")) tipologia = "1 Dormitorio";
      else if (tipNorm.includes("2dorm") || tipNorm === "2d" || tipNorm.includes("2amb")) tipologia = "2 Dormitorios";
      else if (tipNorm.includes("3dorm") || tipNorm === "3d" || tipNorm.includes("3amb")) tipologia = "3 Dormitorios";
      else if (tipNorm.includes("coch") || tipNorm.includes("garage")) tipologia = "Cochera";
      else if (tipNorm.includes("local") || tipNorm.includes("comerc")) tipologia = "Local Comercial";
      else if (tipNorm.includes("ofic")) tipologia = "Oficina";

      unidadesProcesadas.push({
        id: `import-${timestamp}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        proyecto,
        unidad,
        tipologia,
        piso: String(u.piso || "Piso 1").trim(),
        orientacion: String(u.orientacion || "Frente").trim(),
        m2_propios,
        m2_totales,
        precio_usd,
        precio_m2_usd,
        estado,
        observaciones: String(u.observaciones || "").trim(),
        entrega_estimada: String(u.entrega_estimada || "2027").trim()
      });
    });

    if (unidadesProcesadas.length === 0) {
      setErrorMsg("No se pudieron extraer unidades válidas del archivo provisto.");
      return;
    }

    setFilasParsed(unidadesProcesadas);
    setArchivoNombre(nombreOrigen);
    setErrorMsg(null);
  };

  // Manejador de subida de archivo (.xlsx, .xls, .csv)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setErrorMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const primerSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primerSheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      procesarMatrizDatos(data, file.name);
    } catch (err) {
      console.error("Error al procesar archivo:", err);
      setErrorMsg(`Error al leer el archivo: ${err.message || "Formato no válido"}`);
    } finally {
      setCargando(false);
    }
  };

  // Manejador de texto pegado (TSV / CSV)
  const handleProcesarTextoPegado = () => {
    if (!textoPegado.trim()) {
      setErrorMsg("Pega el contenido copiado de tu planilla antes de procesar.");
      return;
    }

    setCargando(true);
    setErrorMsg(null);

    try {
      const lineas = textoPegado.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lineas.length < 2) {
        setErrorMsg("El texto pegado debe contener al menos una fila de encabezados y una fila de datos.");
        setCargando(false);
        return;
      }

      // Detectar separador (tabulador \t para copiado directo de Excel o coma/punto y coma)
      const primera = lineas[0];
      let sep = "\t";
      if (primera.includes("\t")) sep = "\t";
      else if (primera.includes(";")) sep = ";";
      else if (primera.includes(",")) sep = ",";

      const headers = primera.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ""));
      const data = [];

      for (let i = 1; i < lineas.length; i++) {
        const rowVals = lineas[i].split(sep).map(v => v.trim().replace(/^["']|["']$/g, ""));
        const rowObj = {};
        headers.forEach((h, hIdx) => {
          rowObj[h] = rowVals[hIdx] !== undefined ? rowVals[hIdx] : "";
        });
        data.push(rowObj);
      }

      procesarMatrizDatos(data, "Texto copiado del portapapeles");
    } catch (err) {
      console.error("Error al procesar texto pegado:", err);
      setErrorMsg(`Error al procesar datos: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // Estadísticas del lote a importar
  const resumenPreview = useMemo(() => {
    if (!filasParsed || filasParsed.length === 0) return null;

    const totalUSD = filasParsed.reduce((acc, u) => acc + (u.precio_usd || 0), 0);
    const totalM2 = filasParsed.reduce((acc, u) => acc + (u.m2_propios || 0), 0);
    const pm2Prom = totalM2 > 0 ? totalUSD / totalM2 : 0;

    const porProyecto = {};
    const porEstado = {};

    filasParsed.forEach(u => {
      porProyecto[u.proyecto] = (porProyecto[u.proyecto] || 0) + 1;
      porEstado[u.estado] = (porEstado[u.estado] || 0) + 1;
    });

    return {
      totalUnidades: filasParsed.length,
      totalUSD,
      totalM2,
      pm2Prom,
      porProyecto,
      porEstado
    };
  }, [filasParsed]);

  // Confirmar e Importar
  const handleConfirmarImportacion = () => {
    if (!filasParsed || filasParsed.length === 0) return;
    onImportar(filasParsed, modoImportacion);
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: "#FFFFFF",
        borderRadius: 14,
        width: "100%",
        maxWidth: 960,
        maxHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        overflow: "hidden",
        border: "1px solid #E2E8F0"
      }}>
        
        {/* ── ENCABEZADO MODAL ── */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid #E2E8F0",
          background: "#F8FAFC",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                Importador de Stock de Unidades Disponibles
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "#64748B" }}>
                Carga el inventario de unidades a la venta desde Excel, CSV o copia y pega de tu planilla.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={descargarPlantillaExcel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                background: "#ECFDF5",
                color: "#065F46",
                border: "1px solid #A7F3D0",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
              title="Descargar archivo Excel .xlsx con el formato oficial y ejemplos listos para rellenar"
            >
              <Download size={14} /> Plantilla Excel (.xlsx)
            </button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 6,
                borderRadius: 6,
                color: "#64748B"
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── SELECTOR DE PESTAÑAS ── */}
        {!filasParsed && (
          <div style={{
            display: "flex",
            borderBottom: "1px solid #E2E8F0",
            padding: "0 24px",
            background: "#FFFFFF",
            gap: 20
          }}>
            <button
              type="button"
              onClick={() => setTab("archivo")}
              style={{
                padding: "12px 4px",
                fontSize: 13,
                fontWeight: 700,
                color: tab === "archivo" ? "#059669" : "#64748B",
                border: "none",
                background: "transparent",
                borderBottom: tab === "archivo" ? "3px solid #059669" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7
              }}
            >
              <Upload size={16} /> Subir Archivo (.xlsx / .csv)
            </button>

            <button
              type="button"
              onClick={() => setTab("pegar")}
              style={{
                padding: "12px 4px",
                fontSize: 13,
                fontWeight: 700,
                color: tab === "pegar" ? "#059669" : "#64748B",
                border: "none",
                background: "transparent",
                borderBottom: tab === "pegar" ? "3px solid #059669" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7
              }}
            >
              <Clipboard size={16} /> Copiar y Pegar Celdas
            </button>

            <button
              type="button"
              onClick={() => setTab("guia")}
              style={{
                padding: "12px 4px",
                fontSize: 13,
                fontWeight: 700,
                color: tab === "guia" ? "#059669" : "#64748B",
                border: "none",
                background: "transparent",
                borderBottom: tab === "guia" ? "3px solid #059669" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7
              }}
            >
              <HelpCircle size={16} /> Formato y Columnas Permitidas
            </button>
          </div>
        )}

        {/* ── CUERPO MODAL (CON SCROLL) ── */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          
          {errorMsg && (
            <div style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "12px 16px",
              color: "#991B1B",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* VISTA 1: CARGA DE ARCHIVO O TEXTO (SI TODAVÍA NO SE PARSEÓ) */}
          {!filasParsed && (
            <>
              {tab === "archivo" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* DROPZONE */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #CBD5E1",
                      borderRadius: 12,
                      padding: "40px 20px",
                      textAlign: "center",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "#059669"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "#CBD5E1"}
                  >
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "#ECFDF5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px auto",
                      color: "#059669"
                    }}>
                      <Upload size={26} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      Haz clic aquí para seleccionar tu archivo Excel o CSV
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748B" }}>
                      Soporta formatos <strong>.xlsx, .xls y .csv</strong> con columnas de Proyecto, Unidad, M², Valuación, etc.
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </div>

                  {/* NOTA CON DESCARGAS */}
                  <div style={{
                    background: "#F1F5F9",
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Info size={18} color="#475569" />
                      <span style={{ fontSize: 12.5, color: "#334155" }}>
                        ¿No tienes una planilla armada? Descarga la plantilla oficial prediseñada:
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={descargarPlantillaExcel}
                        style={{
                          padding: "6px 12px",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0F172A",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5
                        }}
                      >
                        <Download size={13} /> Plantilla .xlsx
                      </button>
                      <button
                        type="button"
                        onClick={descargarPlantillaCSV}
                        style={{
                          padding: "6px 12px",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0F172A",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5
                        }}
                      >
                        <Download size={13} /> Plantilla .csv
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "pegar" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    Copia las filas y columnas desde tu archivo de Excel o Google Sheets (incluyendo la fila de encabezados) y pégalas en el cuadro siguiente:
                  </div>

                  <textarea
                    value={textoPegado}
                    onChange={(e) => setTextoPegado(e.target.value)}
                    placeholder="Proyecto	Unidad	Tipologia	Piso	M2_Propios	Valuacion_USD	Estado
+ DUO Proyecto	Torre 1 · Piso 02 - Depto A	2 Dormitorios	Piso 2	68.5	126725	Disponible
Torre Green	Piso 04 - 402	2 Dormitorios	Piso 4	74	144300	Disponible..."
                    rows={10}
                    style={{
                      width: "100%",
                      fontFamily: tokens.fontMono,
                      fontSize: 12,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setTextoPegado("")}
                      style={{
                        padding: "8px 14px",
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#64748B",
                        cursor: "pointer"
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleProcesarTextoPegado}
                      disabled={cargando || !textoPegado.trim()}
                      style={{
                        padding: "8px 18px",
                        background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: cargando || !textoPegado.trim() ? "not-allowed" : "pointer",
                        opacity: cargando || !textoPegado.trim() ? 0.6 : 1
                      }}
                    >
                      Procesar Datos Pegados
                    </button>
                  </div>
                </div>
              )}

              {tab === "guia" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 16
                  }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      Columnas soportadas y sinónimos automáticos
                    </h4>
                    <p style={{ margin: "0 0 12px 0", fontSize: 12.5, color: "#64748B" }}>
                      El importador reconoce automáticamente columnas con mayúsculas, minúsculas, acentos o espacios.
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Proyecto *</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Edificio, Obra, Emprendimiento, Torre</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Unidad *</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Depto, Departamento, Nro, Identificación</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Valuacion_USD *</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Precio USD, Precio, Valor USD, Monto USD</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>M2_Propios</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Sup Propia, M2 Cubiertos, M2 Útiles</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>M2_Totales</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Sup Total, Superficie Total, M2</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>USD_M2</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Sinónimos: Precio M2, Valor M2 (autocalculable)</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Tipología</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Monoambiente, 1 Dorm, 2 Dorm, Cochera, Local...</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Estado</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Disponible, Reservado, En Negociación, Bloqueado</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A" }}>Entrega_Estimada</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Ejemplo: "Diciembre 2027", "2027", "Inmediata"</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* VISTA 2: PREVIEW Y VALIDACIÓN DE DATOS (CUANDO YA SE PARSEÓ) */}
          {filasParsed && resumenPreview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* BARRA SUPERIOR DE ORIGEN Y ACCIÓN DE REINICIAR */}
              <div style={{
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: 10,
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={20} color="#059669" />
                  <div>
                    <div style={{ fontWeight: 700, color: "#065F46", fontSize: 13.5 }}>
                      Datos leídos correctamente desde: {archivoNombre}
                    </div>
                    <div style={{ fontSize: 12, color: "#047857" }}>
                      Se detectaron <strong>{resumenPreview.totalUnidades} unidades</strong> listas para incorporar al sistema.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFilasParsed(null);
                    setArchivoNombre(null);
                    setTextoPegado("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    background: "#FFFFFF",
                    border: "1px solid #A7F3D0",
                    borderRadius: 6,
                    color: "#065F46",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  <RefreshCw size={13} /> Cargar otro archivo
                </button>
              </div>

              {/* KPIS DEL LOTE A IMPORTAR */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Unidades en Archivo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {resumenPreview.totalUnidades}
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Valuación Total USD</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#10B981", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    USD {fmt(resumenPreview.totalUSD)}
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>M² Propios Totales</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#3B82F6", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {resumenPreview.totalM2.toFixed(1)} m²
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Promedio USD/M²</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: tokens.gold, fontFamily: tokens.fontMono, marginTop: 4 }}>
                    USD {fmt(resumenPreview.pm2Prom)}
                  </div>
                </div>
              </div>

              {/* DESGLOSE POR PROYECTO DETECTADO */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8, textTransform: "uppercase" }}>
                  Proyectos Detectados ({Object.keys(resumenPreview.porProyecto).length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(resumenPreview.porProyecto).map(([proy, cant]) => (
                    <span
                      key={proy}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0F172A",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Building2 size={13} color="#2563EB" />
                      {proy}
                      <span style={{ background: "#DBEAFE", color: "#1D4ED8", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {cant} u.
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* SELECTOR DE MODO DE IMPORTACIÓN */}
              <div style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "16px 18px"
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                  Selecciona cómo deseas aplicar esta importación:
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: modoImportacion === "reemplazar" ? "#F0FDF4" : "#F8FAFC",
                    border: modoImportacion === "reemplazar" ? "1.5px solid #10B981" : "1px solid #E2E8F0",
                    cursor: "pointer"
                  }}>
                    <input
                      type="radio"
                      name="modoImportacion"
                      value="reemplazar"
                      checked={modoImportacion === "reemplazar"}
                      onChange={() => setModoImportacion("reemplazar")}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                        Reemplazar todo el inventario existente ({unidadesActualesCount} unidades actuales)
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        Recomendado para actualizar la lista de stock completa y sincronizar los disponibles exactos de este mes.
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: modoImportacion === "agregar" ? "#F0FDF4" : "#F8FAFC",
                    border: modoImportacion === "agregar" ? "1.5px solid #10B981" : "1px solid #E2E8F0",
                    cursor: "pointer"
                  }}>
                    <input
                      type="radio"
                      name="modoImportacion"
                      value="agregar"
                      checked={modoImportacion === "agregar"}
                      onChange={() => setModoImportacion("agregar")}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                        Agregar al inventario actual (Conservar las {unidadesActualesCount} unidades y sumar estas {resumenPreview.totalUnidades})
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        Útil si estás cargando un proyecto adicional o un nuevo lote sin borrar el stock previo.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* TABLA PREVIA DE LAS PRIMERAS FILAS */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                  Vista previa de unidades (primeras 10 de {resumenPreview.totalUnidades}):
                </div>
                
                <div style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  overflow: "hidden",
                  maxHeight: 240,
                  overflowY: "auto"
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead style={{ background: "#F1F5F9", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569" }}>Proyecto</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569" }}>Unidad</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569" }}>Tipología</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569" }}>M² Prop</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Valuación USD</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569", textAlign: "right" }}>USD/M²</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasParsed.slice(0, 10).map((u, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "7px 12px", fontWeight: 600, color: "#0F172A" }}>{u.proyecto}</td>
                          <td style={{ padding: "7px 12px", color: "#334155" }}>{u.unidad}</td>
                          <td style={{ padding: "7px 12px", color: "#64748B" }}>{u.tipologia}</td>
                          <td style={{ padding: "7px 12px", fontFamily: tokens.fontMono }}>{u.m2_propios}</td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: "#166534" }}>
                            USD {fmt(u.precio_usd)}
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: tokens.fontMono, color: "#64748B" }}>
                            ${fmt(u.precio_m2_usd)}
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "center" }}>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: u.estado === "Disponible" ? "#ECFDF5" : "#FFFBEB",
                              color: u.estado === "Disponible" ? "#065F46" : "#B45309"
                            }}>
                              {u.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── FOOTER ACCIONES ── */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid #E2E8F0",
          background: "#F8FAFC",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>

          {filasParsed ? (
            <button
              type="button"
              onClick={handleConfirmarImportacion}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 20px",
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)"
              }}
            >
              <Check size={16} /> Confirmar e Importar {resumenPreview?.totalUnidades} Unidades
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "#64748B" }}>
              Selecciona o pega un archivo para previsualizar antes de importar.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
