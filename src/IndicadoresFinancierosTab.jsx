import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine
} from "recharts";
import {
  RefreshCw, AlertTriangle, Pencil, Save, TrendingUp, TrendingDown,
  Info, Calendar, Filter, HelpCircle, CheckCircle2, ArrowUpRight,
  DollarSign, Building2, HardHat, FileText, Activity
} from "lucide-react";

const colorLineaSuave = "#E2E8F0";
const colorLineaFuerte = "#CBD5E1";
const colorTablaBg = "#F8FAFC";

const fmtNum = (v, dec = 1) => {
  if (v == null || v === "" || isNaN(v)) return "—";
  return Number(v).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const fmtMiles = (v) => {
  if (v == null || v === "" || isNaN(v)) return "—";
  const n = Number(v);
  return fmtNum(n >= 1000 ? n / 1000 : n, 1) + " mil";
};

const isStale = (savedAt) => {
  if (!savedAt) return false;
  return (Date.now() - new Date(savedAt).getTime()) / (1000 * 60 * 60 * 24) > 45;
};

/* ══════════════════════════════════════════════════════════════════════════
   DEFINICIÓN Y EXPLICACIÓN CONCEPTUAL DE CADA INDICADOR
   (Responde con precisión a "¿Qué representan estos datos y para qué sirven?")
   ══════════════════════════════════════════════════════════════════════════ */
const INDICADORES_GLOSARIO = {
  // Dólares
  blue: {
    nombre: "Dólar Blue (Informal)",
    queRepresenta: "Cotización del mercado paralelo libre billete en Argentina.",
    unidad: "ARS por USD",
    impactoCashflow: "Referencia para cobros en dólares billete, operaciones inmobiliarias al contado y pago de ciertos honorarios o subcontratistas en plaza local.",
    tipo: "cambiario"
  },
  bolsa: {
    nombre: "Dólar MEP / Bolsa",
    queRepresenta: "Tipo de cambio implícito resultante de la compra y venta de bonos soberanos en la bolsa local (mercado blanco y bancarizado).",
    unidad: "ARS por USD",
    impactoCashflow: "Es la cotización estándar que utiliza la tesorería de Link Inversiones para convertir y valuar excedentes bancarios entre cuentas ARS y USD.",
    tipo: "cambiario"
  },
  contadoconliqui: {
    nombre: "Dólar CCL (Contado con Liquidación)",
    queRepresenta: "Tipo de cambio implícito para transferir divisas al exterior mediante liquidación de activos en cuentas foráneas.",
    unidad: "ARS por USD",
    impactoCashflow: "Referencia para pagos de insumos de origen internacional, equipamiento importado y costo de reposición en dólares libres.",
    tipo: "cambiario"
  },
  oficial: {
    nombre: "Dólar Oficial (Minorista / BNA)",
    queRepresenta: "Tipo de cambio regulado por el BCRA sin impuestos adicionales ni recargos del mercado libre.",
    unidad: "ARS por USD",
    impactoCashflow: "Referencia para contratos de locación indexados a tipo de cambio oficial y para el seguimiento de la brecha cambiaria con el MEP/Blue.",
    tipo: "cambiario"
  },
  mayorista: {
    nombre: "Dólar Mayorista (A3500)",
    queRepresenta: "Cotización de comercio exterior y liquidación de exportaciones/importaciones del BCRA.",
    unidad: "ARS por USD",
    impactoCashflow: "Determina el costo oficial de nacionalización de insumos y materiales con licencia de importación.",
    tipo: "cambiario"
  },
  cripto: {
    nombre: "Dólar Cripto (USDT/USDC)",
    queRepresenta: "Cotización de stablecoins emparejadas al dólar 24/7 en plataformas P2P y exchanges.",
    unidad: "ARS por USDT",
    impactoCashflow: "Termómetro de cotización durante fines de semana y feriados cuando el mercado bursátil está cerrado.",
    tipo: "cambiario"
  },

  // BCRA Macro
  ipc: {
    nombre: "IPC Mensual (Inflación)",
    queRepresenta: "Variación mensual del Índice de Precios al Consumidor publicado por el INDEC.",
    unidad: "% mensual",
    impactoCashflow: "Ajuste de contratos comerciales, gastos de estructura corporativa, paritarias salariales y mantenimiento de oficinas.",
    tipo: "macro"
  },
  ipcInteranual: {
    nombre: "IPC Interanual (12 Meses)",
    queRepresenta: "Acumulado de inflación de los últimos 12 meses corridos en Argentina.",
    unidad: "% anual",
    impactoCashflow: "Base para presupuestación anual, proyección de tasas de descuento y costo real del capital en pesos.",
    tipo: "macro"
  },
  badlar: {
    nombre: "Tasa BADLAR Bancos Privados",
    queRepresenta: "Tasa pasiva nominal anual por plazos fijos de más de $1.000.000 a 30-35 días en bancos comerciales.",
    unidad: "% TNA",
    impactoCashflow: "Costo de oportunidad de los saldos a la vista en bancos y costo testigo de financiamiento bancario a corto plazo.",
    tipo: "macro"
  },
  riesgoPais: {
    nombre: "Riesgo País (EMBI JP Morgan)",
    queRepresenta: "Sobretasa en puntos básicos que pagan los bonos argentinos respecto de los bonos del Tesoro de EE.UU.",
    unidad: "puntos básicos (pb)",
    impactoCashflow: "Indica la percepción de riesgo macroeconómico y la probabilidad de apertura del crédito hipotecario o corporativo a largo plazo.",
    tipo: "macro"
  },
  reservas: {
    nombre: "Reservas Internacionales BCRA",
    queRepresenta: "Volumen total de activos en moneda extranjera administrados por el Banco Central.",
    unidad: "Millones de USD",
    impactoCashflow: "Indicador clave de estabilidad cambiaria. Caídas abruptas anticipan devaluaciones que encarecen insumos de construcción en dólares.",
    tipo: "macro"
  },

  // Construcción
  cac: {
    nombre: "Índice CAC General (Costo Construcción)",
    queRepresenta: "Indicador oficial de la Cámara Argentina de la Construcción que pondera materiales, mano de obra y equipos de edificación.",
    unidad: "Puntos índice",
    impactoCashflow: "Índice rector para la actualización de cuotas de preventa inmobiliaria a los clientes y certificados de contratistas en fideicomisos al costo.",
    tipo: "obra"
  },
  mat: {
    nombre: "Índice CAC — Materiales",
    queRepresenta: "Subíndice específico que mide exclusivamente la evolución de insumos de obra (hierro, cemento, ladrillos, cañerías, aberturas).",
    unidad: "Puntos índice",
    impactoCashflow: "Permite aislar la inflación de insumos para auditar si los presupuestos de compras y acopios de obra están dentro de mercado.",
    tipo: "obra"
  },
  mo: {
    nombre: "Índice CAC — Mano de Obra",
    queRepresenta: "Subíndice que mide el costo salarial homologado por UOCRA y cargas sociales directas de obra civil.",
    unidad: "Puntos índice",
    impactoCashflow: "Determina los reajustes de jornales y subcontratos de albañilería, estructura, sanitarios y yesería en los desarrollos.",
    tipo: "obra"
  },
  h21: {
    nombre: "Hormigón Elaborado H-21",
    queRepresenta: "Precio de mercado del metro cúbico (m³) de hormigón bombeado puesto en obra de calidad estructural H-21.",
    unidad: "ARS por m³",
    impactoCashflow: "Es el insumo crítico líder en fase de fundaciones y estructura de hormigón armado (obras Duo, Boulevard, Torre Green). Termómetro de costo en tiempo real.",
    tipo: "obra"
  }
};

/* ═══════ Dólares configurados ═══════ */
const DOLAR_TIPOS = [
  { slug: "blue", label: "Blue", key: "blue", color: tokens.gold },
  { slug: "bolsa", label: "MEP", key: "bolsa", color: "#6B5FA6" },
  { slug: "contadoconliqui", label: "CCL", key: "contadoconliqui", color: "#C97B3D" },
  { slug: "oficial", label: "Oficial", key: "oficial", color: tokens.positive },
  { slug: "mayorista", label: "Mayorista", key: "mayorista", color: "#A6588E" },
  { slug: "cripto", label: "Cripto", key: "cripto", color: "#B8862A" },
];

/* ═══════ Indicadores BCRA ═══════ */
const BCRA_CFG = {
  ipc:           { endpoint: "ipc", label: "IPC Mensual", unit: "%" },
  ipcInteranual: { endpoint: "ipcInteranual", label: "IPC Interanual", unit: "%" },
  badlar:        { endpoint: "badlar", label: "Tasa BADLAR", unit: "%" },
  riesgoPais:    { endpoint: "riesgoPais", label: "Riesgo País (EMBI)", unit: "pb" },
  reservas:      { endpoint: "reservas", label: "Reservas BCRA", unit: "USD M" },
};

/* ═══════ Histórico CAC con Fechas ISO para Segmentación ═══════ */
const HIST_CAC = [
  { mes: "Jul-25", fecha: "2025-07-20", valor: 16939.5, variacion: 3.2 },
  { mes: "Ago-25", fecha: "2025-08-20", valor: 17187.6, variacion: 1.5 },
  { mes: "Sep-25", fecha: "2025-09-20", valor: 17762.3, variacion: 3.3 },
  { mes: "Oct-25", fecha: "2025-10-20", valor: 18172.8, variacion: 2.3 },
  { mes: "Nov-25", fecha: "2025-11-20", valor: 18534.9, variacion: 2.0 },
  { mes: "Dic-25", fecha: "2025-12-20", valor: 18776.5, variacion: 1.3 },
  { mes: "Ene-26", fecha: "2026-01-20", valor: 19209.4, variacion: 2.3 },
  { mes: "Feb-26", fecha: "2026-02-20", valor: 19453.0, variacion: 1.3 },
  { mes: "Mar-26", fecha: "2026-03-20", valor: 19771.2, variacion: 1.6 },
  { mes: "Abr-26", fecha: "2026-04-20", valor: 20493.2, variacion: 3.7 },
  { mes: "May-26", fecha: "2026-05-20", valor: 21035.6, variacion: 2.6 },
  { mes: "Jun-26", fecha: "2026-06-20", valor: 21641.1, variacion: 2.9 },
  { mes: "Jul-26", fecha: "2026-07-20", valor: 21960.7, variacion: 1.5 },
  { mes: "Ago-26", fecha: "2026-08-20", valor: 22480.2, variacion: 2.4 },
  { mes: "Sep-26", fecha: "2026-09-20", valor: 22950.0, variacion: 2.1 },
];

const HIST_MAT = [
  { mes: "Jul-25", fecha: "2025-07-20", valor: 19141.7, variacion: 3.0 },
  { mes: "Ago-25", fecha: "2025-08-20", valor: 19490.0, variacion: 1.8 },
  { mes: "Sep-25", fecha: "2025-09-20", valor: 20187.5, variacion: 3.6 },
  { mes: "Oct-25", fecha: "2025-10-20", valor: 20740.8, variacion: 2.7 },
  { mes: "Nov-25", fecha: "2025-11-20", valor: 21055.9, variacion: 1.5 },
  { mes: "Dic-25", fecha: "2025-12-20", valor: 21335.3, variacion: 1.3 },
  { mes: "Ene-26", fecha: "2026-01-20", valor: 21778.0, variacion: 2.1 },
  { mes: "Feb-26", fecha: "2026-02-20", valor: 22007.9, variacion: 1.1 },
  { mes: "Mar-26", fecha: "2026-03-20", valor: 22204.2, variacion: 0.9 },
  { mes: "Abr-26", fecha: "2026-04-20", valor: 22870.0, variacion: 3.0 },
  { mes: "May-26", fecha: "2026-05-20", valor: 23500.2, variacion: 2.8 },
  { mes: "Jun-26", fecha: "2026-06-20", valor: 23901.9, variacion: 1.7 },
  { mes: "Jul-26", fecha: "2026-07-20", valor: 24149.4, variacion: 1.0 },
  { mes: "Ago-26", fecha: "2026-08-20", valor: 24690.0, variacion: 2.2 },
  { mes: "Sep-26", fecha: "2026-09-20", valor: 25150.0, variacion: 1.9 },
];

const HIST_MO = [
  { mes: "Jul-25", fecha: "2025-07-20", valor: 13711.8, variacion: 3.5 },
  { mes: "Ago-25", fecha: "2025-08-20", valor: 13812.6, variacion: 0.7 },
  { mes: "Sep-25", fecha: "2025-09-20", valor: 14207.5, variacion: 2.9 },
  { mes: "Oct-25", fecha: "2025-10-20", valor: 14408.8, variacion: 1.4 },
  { mes: "Nov-25", fecha: "2025-11-20", valor: 14839.9, variacion: 3.0 },
  { mes: "Dic-25", fecha: "2025-12-20", valor: 15026.2, variacion: 1.3 },
  { mes: "Ene-26", fecha: "2026-01-20", valor: 15444.4, variacion: 2.8 },
  { mes: "Feb-26", fecha: "2026-02-20", valor: 15708.2, variacion: 1.7 },
  { mes: "Mar-26", fecha: "2026-03-20", valor: 16205.2, variacion: 3.2 },
  { mes: "Abr-26", fecha: "2026-04-20", valor: 17009.6, variacion: 5.0 },
  { mes: "May-26", fecha: "2026-05-20", valor: 17423.2, variacion: 2.4 },
  { mes: "Jun-26", fecha: "2026-06-20", valor: 18327.3, variacion: 5.2 },
  { mes: "Jul-26", fecha: "2026-07-20", valor: 18752.8, variacion: 2.3 },
  { mes: "Ago-26", fecha: "2026-08-20", valor: 19280.0, variacion: 2.8 },
  { mes: "Sep-26", fecha: "2026-09-20", valor: 19800.0, variacion: 2.7 },
];

/* ═══════ Histórico Base de Hormigón H-21 ═══════ */
const DEFAULT_HIST_H21 = [
  { id_mes: "2025-07", etiqueta: "Jul-25", fecha: "2025-07-15", valor: 118500 },
  { id_mes: "2025-08", etiqueta: "Ago-25", fecha: "2025-08-15", valor: 122400 },
  { id_mes: "2025-09", etiqueta: "Sep-25", fecha: "2025-09-15", valor: 127800 },
  { id_mes: "2025-10", etiqueta: "Oct-25", fecha: "2025-10-15", valor: 131500 },
  { id_mes: "2025-11", etiqueta: "Nov-25", fecha: "2025-11-15", valor: 135200 },
  { id_mes: "2025-12", etiqueta: "Dic-25", fecha: "2025-12-15", valor: 139800 },
  { id_mes: "2026-01", etiqueta: "Ene-26", fecha: "2026-01-15", valor: 144500 },
  { id_mes: "2026-02", etiqueta: "Feb-26", fecha: "2026-02-15", valor: 148900 },
  { id_mes: "2026-03", etiqueta: "Mar-26", fecha: "2026-03-15", valor: 153200 },
  { id_mes: "2026-04", etiqueta: "Abr-26", fecha: "2026-04-15", valor: 158700 },
  { id_mes: "2026-05", etiqueta: "May-26", fecha: "2026-05-15", valor: 164200 },
  { id_mes: "2026-06", etiqueta: "Jun-26", fecha: "2026-06-15", valor: 169800 },
  { id_mes: "2026-07", etiqueta: "Jul-26", fecha: "2026-07-15", valor: 174500 },
  { id_mes: "2026-08", etiqueta: "Ago-26", fecha: "2026-08-15", valor: 179200 },
  { id_mes: "2026-09", etiqueta: "Sep-26", fecha: "2026-09-15", valor: 184500 },
];

const CAC_META = {
  cac: { label: "Índice CAC — General", hist: HIST_CAC, key: "cac" },
  mat: { label: "Índice CAC — Materiales", hist: HIST_MAT, key: "mat" },
  mo:  { label: "Índice CAC — Mano de Obra", hist: HIST_MO, key: "mo" },
};

/* ══════════════════════════════════════════════════════════════════════════
   FILTRADO MATEMÁTICO POR SEGMENTACIÓN DE PERÍODOS
   ══════════════════════════════════════════════════════════════════════════ */
function filtrarPorPeriodo(arrayDatos, periodo = "1A") {
  if (!arrayDatos || !arrayDatos.length) return [];
  if (periodo === "todo") return arrayDatos;

  // Si no tienen fecha pero tienen mes o id_mes
  const normalizados = arrayDatos.map(item => {
    let fStr = item.fecha || item.id_mes || "";
    if (!fStr && item.mes) {
      // ej: "Jul-25" -> "2025-07-01"
      const mMatch = item.mes.toLowerCase();
      const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      let mIdx = meses.findIndex(m => mMatch.includes(m));
      let yMatch = item.mes.match(/\d{2,4}/);
      let year = yMatch ? Number(yMatch[0]) : 2026;
      if (year < 100) year += 2000;
      fStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-01`;
    }
    return { ...item, _sortDate: fStr };
  });

  const hoy = new Date("2026-09-21"); // Fecha del sistema
  let diasAtras = 365;

  if (periodo === "1M") diasAtras = 35;
  else if (periodo === "3M") diasAtras = 95;
  else if (periodo === "6M") diasAtras = 185;
  else if (periodo === "1A") diasAtras = 366;
  else if (periodo === "2026") {
    return normalizados.filter(d => d._sortDate && d._sortDate.startsWith("2026"));
  }

  const fechaCorte = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);
  const corteISO = fechaCorte.toISOString().slice(0, 10);

  const filtrados = normalizados.filter(d => (d._sortDate || "") >= corteISO);
  // Garantizar al menos 2 puntos para visualización
  return filtrados.length >= 2 ? filtrados : normalizados.slice(-4);
}

export default function IndicadoresFinancierosTab({ onSyncTC }) {
  // Estado de segmentación por períodos general
  // '1M' (30 días), '3M' (Trimestre), '6M' (Semestre), '1A' (Último Año), '2026' (Año en curso), 'todo' (Histórico)
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("1A");

  // Filtro de categoría temática: 'todos', 'cambiario', 'macro', 'obra', 'matriz'
  const [seccionFiltro, setSeccionFiltro] = useState("todos");

  // Control para mostrar/ocultar el explicativo "¿Qué representa?"
  const [mostrarExplicativos, setMostrarExplicativos] = useState(true);

  // Estados de datos
  const [dolares, setDolares] = useState([]);
  const [macro, setMacro] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const [cac, setCac] = useState({});
  const [h21, setH21] = useState(DEFAULT_HIST_H21);
  const [formOpen, setFormOpen] = useState({});
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState("");

  const handleApplyTC = (valor, label) => {
    if (!valor) return;
    if (onSyncTC) {
      onSyncTC(valor, label);
    }
    setToast(`Dólar ${label} ($${fmtNum(valor, 0)}) vinculado al Cashflow`);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchDolares = useCallback(async () => {
    try {
      const r = await fetch("https://dolarapi.com/v1/dolares");
      if (!r.ok) throw new Error();
      setDolares(await r.json());
    } catch {
      setError("No se pudieron cargar las cotizaciones del dólar en vivo.");
    }
  }, []);

  const fetchMacro = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(BCRA_CFG).map(async ([key, cfg]) => {
        try {
          const r = await fetch(`/api/proxy?endpoint=${cfg.endpoint}`);
          if (!r.ok) throw new Error();
          const json = await r.json();
          return [key, json.results || []];
        } catch {
          return [key, []];
        }
      })
    );
    setMacro(Object.fromEntries(entries));
  }, []);

  const loadCAC = useCallback(async () => {
    try {
      const { data } = await supabase.from("cf_cac_indicadores").select("*");
      const byKey = {};
      (data || []).forEach((row) => { byKey[row.indicador] = row; });
      setCac(byKey);
    } catch (e) {
      console.error("Error al cargar CAC:", e);
    }
  }, []);

  const loadH21 = useCallback(async () => {
    try {
      const { data } = await supabase.from("cf_h21_precios").select("*").order("id_mes", { ascending: true });
      if (data && data.length > 0) {
        setH21(data);
      } else {
        setH21(DEFAULT_HIST_H21);
      }
    } catch (e) {
      console.error("Error al cargar H21:", e);
      setH21(DEFAULT_HIST_H21);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchDolares(), fetchMacro(), loadCAC(), loadH21()]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [fetchDolares, fetchMacro, loadCAC, loadH21]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleForm = (id) => setFormOpen((p) => ({ ...p, [id]: !p[id] }));

  const saveCAC = async (id) => {
    const d = draft[id] || {};
    const valor = parseFloat(d.valor);
    if (!valor) return;
    const variacion = d.variacion ? parseFloat(d.variacion) : null;
    const mes = d.mes || "";
    const row = { indicador: id, valor, variacion, mes, updated_at: new Date().toISOString() };
    await supabase.from("cf_cac_indicadores").upsert(row);
    setCac((p) => ({ ...p, [id]: row }));
    toggleForm(id);
    setToast(`${id.toUpperCase()} actualizado`);
    setTimeout(() => setToast(""), 2500);
  };

  const saveH21 = async () => {
    const d = draft.h21 || {};
    let rawVal = parseFloat(d.valor);
    if (!d.mes || isNaN(rawVal)) return;
    const valor = rawVal < 1000 ? rawVal * 1000 : rawVal;
    const row = { id_mes: d.mes, etiqueta: d.label || d.mes, valor, updated_at: new Date().toISOString() };
    await supabase.from("cf_h21_precios").upsert(row);
    setH21((p) => [...p.filter((x) => x.id_mes !== row.id_mes), row].sort((a, b) => a.id_mes.localeCompare(b.id_mes)));
    toggleForm("h21");
    setDraft((p) => ({ ...p, h21: {} }));
    setToast("Hormigón H-21 actualizado con éxito");
    setTimeout(() => setToast(""), 2500);
  };

  const setD = (id, field, value) => setDraft((p) => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } }));

  // SERIES SEGMENTADAS POR PERÍODO
  const h21Filtrado = useMemo(() => filtrarPorPeriodo(h21, periodoSeleccionado), [h21, periodoSeleccionado]);
  
  const h21Last = h21Filtrado[h21Filtrado.length - 1] || h21[h21.length - 1];
  const h21First = h21Filtrado[0] || h21[0];
  const h21VarPeriodo = (h21First && h21Last && h21First.valor > 0)
    ? ((h21Last.valor - h21First.valor) / h21First.valor) * 100
    : 0;

  // CÁLCULO DE LA BRECHA CAMBIARIA (Blue vs Oficial y MEP vs Oficial)
  const dolarOficial = dolares.find(x => x.casa === "oficial")?.venta || 0;
  const dolarBlue = dolares.find(x => x.casa === "blue")?.venta || 0;
  const dolarMep = dolares.find(x => x.casa === "bolsa")?.venta || 0;
  const brechaBlue = (dolarOficial > 0 && dolarBlue > 0) ? ((dolarBlue - dolarOficial) / dolarOficial) * 100 : 0;
  const brechaMep = (dolarOficial > 0 && dolarMep > 0) ? ((dolarMep - dolarOficial) / dolarOficial) * 100 : 0;

  // MATRIZ MENSUAL COMPARATIVA POR PERÍODOS (Últimos meses para auditoría rápida)
  const matrizHistorica = useMemo(() => {
    return [
      { periodo: "Sep 2026", fecha: "2026-09-01", mep: 1310, blue: 1325, ipc: 2.3, cacGral: 22950, cacVar: 2.1, h21: 184500 },
      { periodo: "Ago 2026", fecha: "2026-08-01", mep: 1295, blue: 1305, ipc: 2.4, cacGral: 22480, cacVar: 2.4, h21: 179200 },
      { periodo: "Jul 2026", fecha: "2026-07-01", mep: 1280, blue: 1290, ipc: 2.5, cacGral: 21960, cacVar: 1.5, h21: 174500 },
      { periodo: "Jun 2026", fecha: "2026-06-01", mep: 1260, blue: 1275, ipc: 2.8, cacGral: 21641, cacVar: 2.9, h21: 169800 },
      { periodo: "May 2026", fecha: "2026-05-01", mep: 1240, blue: 1250, ipc: 3.0, cacGral: 21035, cacVar: 2.6, h21: 164200 },
      { periodo: "Abr 2026", fecha: "2026-04-01", mep: 1215, blue: 1225, ipc: 3.2, cacGral: 20493, cacVar: 3.7, h21: 158700 },
      { periodo: "Mar 2026", fecha: "2026-03-01", mep: 1190, blue: 1205, ipc: 3.5, cacGral: 19771, cacVar: 1.6, h21: 153200 },
      { periodo: "Feb 2026", fecha: "2026-02-01", mep: 1175, blue: 1190, ipc: 3.6, cacGral: 19453, cacVar: 1.3, h21: 148900 },
      { periodo: "Ene 2026", fecha: "2026-01-01", mep: 1160, blue: 1175, ipc: 3.8, cacGral: 19209, cacVar: 2.3, h21: 144500 },
      { periodo: "Dic 2025", fecha: "2025-12-01", mep: 1140, blue: 1150, ipc: 4.1, cacGral: 18776, cacVar: 1.3, h21: 139800 },
      { periodo: "Nov 2025", fecha: "2025-11-01", mep: 1120, blue: 1130, ipc: 4.3, cacGral: 18534, cacVar: 2.0, h21: 135200 },
      { periodo: "Oct 2025", fecha: "2025-10-01", mep: 1100, blue: 1115, ipc: 4.5, cacGral: 18172, cacVar: 2.3, h21: 131500 },
    ];
  }, []);

  const matrizFiltrada = useMemo(() => {
    if (periodoSeleccionado === "1M") return matrizHistorica.slice(0, 2);
    if (periodoSeleccionado === "3M") return matrizHistorica.slice(0, 4);
    if (periodoSeleccionado === "6M") return matrizHistorica.slice(0, 7);
    if (periodoSeleccionado === "2026") return matrizHistorica.filter(m => m.periodo.includes("2026"));
    return matrizHistorica;
  }, [matrizHistorica, periodoSeleccionado]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1280 }}>
      
      {/* ═══════════════════════════════════════════════════════════════════
          BARRA DE CONTROL: TÍTULO, PERÍODOS Y GLOSARIO
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: tokens.surface,
        border: `1px solid ${colorLineaFuerte}`,
        borderRadius: 12,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                background: "rgba(201, 174, 107, 0.15)",
                color: tokens.gold,
                padding: "2px 8px",
                borderRadius: 4
              }}>
                Mercado & Macroeconomía
              </span>
              <span style={{ fontSize: 11.5, color: tokens.textMuted }}>
                {loading ? "Sincronizando fuentes oficiales…" : lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString("es-AR")} hs` : ""}
              </span>
            </div>
            <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 700, color: tokens.ink }}>
              Monitor Financiero e Indicadores de Costos
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: tokens.textMuted, maxWidth: 760 }}>
              Seguimiento periódico de variables clave para valuación de tesorería, reajuste de cuotas de preventa (CAC) y costos directos de obra (H-21).
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setMostrarExplicativos(!mostrarExplicativos)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: mostrarExplicativos ? tokens.goldSoft : "transparent",
                border: `1px solid ${mostrarExplicativos ? tokens.gold : colorLineaFuerte}`,
                color: mostrarExplicativos ? tokens.gold : tokens.textMuted,
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
              title="Muestra u oculta la explicación de qué representa cada variable para Link Inversiones"
            >
              <HelpCircle size={14} />
              {mostrarExplicativos ? "Ocultar Explicativos" : "¿Qué representa cada dato?"}
            </button>

            <button
              onClick={fetchAll}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: tokens.ink,
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw size={13} className={loading ? "spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {/* SELECTOR DE SEGMENTACIÓN POR PERÍODOS */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderTop: `1px solid ${colorLineaSuave}`,
          paddingTop: 12
        }}>
          {/* Segmentación Temporal */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <Calendar size={14} color={tokens.gold} />
              <span>Segmentación por Período:</span>
            </div>

            <div style={{ display: "flex", background: colorTablaBg, padding: 3, borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
              {[
                { id: "1M", label: "1 Mes (30D)" },
                { id: "3M", label: "3 Meses (Trimestre)" },
                { id: "6M", label: "6 Meses (Semestre)" },
                { id: "2026", label: "Año 2026" },
                { id: "1A", label: "1 Año (12M)" },
                { id: "todo", label: "Histórico Completo" },
              ].map((p) => {
                const activo = periodoSeleccionado === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPeriodoSeleccionado(p.id)}
                    style={{
                      padding: "5px 11px",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: activo ? 700 : 500,
                      cursor: "pointer",
                      background: activo ? tokens.ink : "transparent",
                      color: activo ? "#FFFFFF" : tokens.textMuted,
                      transition: "all 0.15s"
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro de Módulos */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={13} color={tokens.textMuted} />
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "todos", label: "Ver Todo" },
                { id: "cambiario", label: "Dólares" },
                { id: "obra", label: "CAC & Obra (H-21)" },
                { id: "macro", label: "BCRA & Tasas" },
                { id: "matriz", label: "Matriz Periódica" },
              ].map((s) => {
                const activo = seccionFiltro === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSeccionFiltro(s.id)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: activo ? 700 : 500,
                      border: `1px solid ${activo ? tokens.gold : colorLineaSuave}`,
                      background: activo ? tokens.goldSoft : "transparent",
                      color: activo ? tokens.gold : tokens.textMuted,
                      cursor: "pointer"
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: tokens.negativeSoft,
          border: `1px solid ${tokens.negative}33`,
          color: tokens.negative,
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12.5
        }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 1: MERCADO CAMBIARIO Y COTIZACIONES DEL DÓLAR
          ═══════════════════════════════════════════════════════════════════ */}
      {(seccionFiltro === "todos" || seccionFiltro === "cambiario") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            title="Mercado Cambiario · Cotizaciones Spot y Brecha"
            badge="Dólares en tiempo real"
            desc="Valuaciones cambiarias utilizadas para tesorería, conversión de cobros y costos de reposición."
          />

          {/* TARJETAS RESUMEN DE BRECHA CAMBIARIA */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <div style={{ background: "#FFFFFF", border: `1px solid ${colorLineaFuerte}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
                Brecha Cambiaria Blue vs Oficial
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 700, color: tokens.ink }}>
                  {fmtNum(brechaBlue, 1)}%
                </span>
                <span style={{ fontSize: 11.5, color: tokens.textMuted }}>
                  Oficial: ${fmtNum(dolarOficial, 0)} → Blue: ${fmtNum(dolarBlue, 0)}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: tokens.textFaint }}>
                Presión de distorsión en cobros inmobiliarios al contado.
              </p>
            </div>

            <div style={{ background: "#FFFFFF", border: `1px solid ${colorLineaFuerte}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
                Brecha Financiera MEP vs Oficial
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 700, color: "#6B5FA6" }}>
                  {fmtNum(brechaMep, 1)}%
                </span>
                <span style={{ fontSize: 11.5, color: tokens.textMuted }}>
                  Dólar MEP Bolsa: ${fmtNum(dolarMep, 0)}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: tokens.textFaint }}>
                Spread bancarizado para arbitrajes y pagos de tesorería corporativa.
              </p>
            </div>
          </div>

          {/* GRID DE COTIZACIONES */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 12 }}>
            {DOLAR_TIPOS.map((t) => {
              const d = dolares.find((x) => x.casa === t.slug);
              const venta = d?.venta ? "$" + fmtNum(d.venta, 0) : "—";
              const compra = d?.compra ? "$" + fmtNum(d.compra, 0) : "—";
              const info = INDICADORES_GLOSARIO[t.key] || {};

              return (
                <div
                  key={t.slug}
                  style={{
                    background: tokens.surface,
                    border: `1px solid ${colorLineaFuerte}`,
                    borderRadius: 10,
                    padding: "14px",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.color, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
                  
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: tokens.textMuted }}>
                        USD {t.label}
                      </span>
                      <span style={{ fontSize: 9.5, background: colorTablaBg, padding: "1px 5px", borderRadius: 4, color: tokens.textFaint }}>
                        Spot
                      </span>
                    </div>

                    <div style={{ fontFamily: tokens.fontDisplay, fontSize: 26, color: t.color, fontWeight: 700 }}>
                      {venta}
                    </div>

                    <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                      Compra: {compra}
                    </div>

                    {mostrarExplicativos && (
                      <div style={{
                        marginTop: 8,
                        background: colorTablaBg,
                        borderRadius: 6,
                        padding: "6px 8px",
                        fontSize: 10.5,
                        color: tokens.textMuted,
                        lineHeight: 1.3
                      }}>
                        <strong style={{ color: tokens.ink, display: "block", marginBottom: 2 }}>Qué representa:</strong>
                        {info.queRepresenta}
                      </div>
                    )}
                  </div>

                  {d?.venta && (
                    <button
                      onClick={() => handleApplyTC(d.venta, t.label)}
                      title={`Fijar $${d.venta} como Tipo de Cambio en el Cashflow`}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        background: "rgba(201, 174, 107, 0.12)",
                        border: "1px solid rgba(201, 174, 107, 0.4)",
                        borderRadius: 6,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: tokens.ink,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201, 174, 107, 0.28)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(201, 174, 107, 0.12)")}
                    >
                      <TrendingUp size={12} color={tokens.gold} /> Fijar en Cashflow
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 2: COSTOS DE CONSTRUCCIÓN (CAC & HORMIGÓN H-21)
          ═══════════════════════════════════════════════════════════════════ */}
      {(seccionFiltro === "todos" || seccionFiltro === "obra") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionHeader
            title="Costos Directos de Construcción e Índices CAC"
            badge="Actualización periódica"
            desc="Parámetros indispensables para indexar contratos de venta a clientes, certificar contratistas y presupuestar coladas de hormigón."
          />

          {/* TARJETA DESTACADA: HORMIGÓN ELABORADO H-21 */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaFuerte}`,
            borderRadius: 12,
            padding: "20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <HardHat size={15} color={tokens.gold} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: tokens.textMuted }}>
                    Insumo Crítico Estructural
                  </span>
                </div>

                <h3 style={{ margin: "2px 0 6px", fontFamily: tokens.fontDisplay, fontSize: 20, fontWeight: 700, color: tokens.ink }}>
                  Hormigón Elaborado H-21 ($/m³)
                </h3>

                <div style={{ fontFamily: tokens.fontDisplay, fontSize: 32, color: tokens.gold, fontWeight: 700, marginTop: 4 }}>
                  {h21Last ? "$ " + fmtMiles(h21Last.valor) : "—"}
                </div>
                
                <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2 }}>
                  Valor real: <strong>${fmtNum(h21Last?.valor, 0)} ARS por m³</strong>
                </div>

                {mostrarExplicativos && (
                  <div style={{
                    marginTop: 10,
                    background: colorTablaBg,
                    border: `1px solid ${colorLineaSuave}`,
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 11,
                    color: tokens.textMuted,
                    lineHeight: 1.4
                  }}>
                    <strong style={{ color: tokens.ink, display: "block", marginBottom: 2 }}>
                      ¿Qué representa este dato?
                    </strong>
                    {INDICADORES_GLOSARIO.h21.queRepresenta}
                    <div style={{ marginTop: 4, color: tokens.ink, fontWeight: 600 }}>
                      Impacto: {INDICADORES_GLOSARIO.h21.impactoCashflow}
                    </div>
                  </div>
                )}

                {/* Métricas del período seleccionado */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <StatBox label={`Var. Período (${periodoSeleccionado})`} value={`${h21VarPeriodo >= 0 ? "+" : ""}${fmtNum(h21VarPeriodo, 1)}%`} highlight={h21VarPeriodo > 0 ? tokens.negative : tokens.positive} />
                  <StatBox label="Base Período" value={h21First ? "$ " + fmtMiles(h21First.valor) : "—"} />
                  <StatBox label="Mínimo Período" value={h21Filtrado.length ? "$ " + fmtMiles(Math.min(...h21Filtrado.map(d => d.valor))) : "—"} />
                  <StatBox label="Máximo Período" value={h21Filtrado.length ? "$ " + fmtMiles(Math.max(...h21Filtrado.map(d => d.valor))) : "—"} />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => toggleForm("h21")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: tokens.paper,
                      border: `1px solid ${colorLineaFuerte}`,
                      color: tokens.ink,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    <Pencil size={13} /> Cargar nuevo mes
                  </button>
                </div>

                {formOpen.h21 && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" placeholder="Mes (YYYY-MM)" onChange={(e) => setD("h21", "mes", e.target.value)} style={inputStyle} />
                      <input type="text" placeholder="Etiqueta (ej: Oct 2026)" onChange={(e) => setD("h21", "label", e.target.value)} style={inputStyle} />
                    </div>
                    <input type="number" step="100" placeholder="Valor ($ m³ ej: 189000)" onChange={(e) => setD("h21", "valor", e.target.value)} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveH21} style={saveBtnStyle}><Save size={13} /> Guardar</button>
                      <button onClick={() => toggleForm("h21")} style={cancelBtnStyle}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* GRÁFICO INTERACTIVO SEGMENTADO DE H-21 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Evolución del precio H-21 · Segmento: <strong>{periodoSeleccionado}</strong> ({h21Filtrado.length} períodos)
                  </span>
                  <span style={{ fontSize: 10.5, color: tokens.textFaint }}>
                    Fuente: Referencia proveedor de hormigón elaborado
                  </span>
                </div>

                <div style={{ height: 210, background: colorTablaBg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${colorLineaSuave}` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={h21Filtrado} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad-h21" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={tokens.gold} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={tokens.gold} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 10.5, fill: tokens.textMuted }} stroke="#CBD5E1" />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10, fill: tokens.textMuted }}
                        tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                        stroke="#CBD5E1"
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          fontFamily: tokens.fontBody,
                          border: `1px solid ${colorLineaFuerte}`,
                          borderRadius: 8,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                        }}
                        formatter={(val) => [`$ ${Number(val).toLocaleString("es-AR")} / m³`, "Precio Hormigón H-21"]}
                        labelFormatter={(lbl) => `Período: ${lbl}`}
                      />
                      <Area type="monotone" dataKey="valor" stroke={tokens.gold} strokeWidth={2.5} fill="url(#grad-h21)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ÍNDICES DE LA CÁMARA ARGENTINA DE LA CONSTRUCCIÓN (CAC) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {Object.entries(CAC_META).map(([id, meta]) => {
              const data = cac[id] || {};
              const histCompleto = meta.hist;
              const histFiltrado = filtrarPorPeriodo(histCompleto, periodoSeleccionado);
              const ultimoDato = histFiltrado[histFiltrado.length - 1] || histCompleto[histCompleto.length - 1];
              const primerDato = histFiltrado[0] || histCompleto[0];
              const varPeriodo = (primerDato && ultimoDato && primerDato.valor > 0)
                ? ((ultimoDato.valor - primerDato.valor) / primerDato.valor) * 100
                : 0;

              const open = !!formOpen[id];
              const info = INDICADORES_GLOSARIO[meta.key] || {};

              return (
                <div
                  key={id}
                  style={{
                    background: tokens.surface,
                    border: `1px solid ${colorLineaFuerte}`,
                    borderRadius: 10,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, letterSpacing: "0.8px", textTransform: "uppercase", color: tokens.textMuted, fontWeight: 700 }}>
                          Cámara Arg. Construcción
                        </span>
                        <h4 style={{ margin: "2px 0 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 700, color: tokens.ink }}>
                          {meta.label}
                        </h4>
                      </div>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: "rgba(201, 174, 107, 0.15)",
                        color: tokens.gold,
                        padding: "2px 6px",
                        borderRadius: 4
                      }}>
                        {data.mes || ultimoDato?.mes || "Ago-26"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span style={{ fontFamily: tokens.fontDisplay, fontSize: 26, color: tokens.gold, fontWeight: 700 }}>
                        {fmtNum(data.valor ?? ultimoDato?.valor, 1)}
                      </span>
                      <span style={{ fontSize: 11.5, color: tokens.textMuted }}>
                        puntos índice
                      </span>
                    </div>

                    <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4 }}>
                      Var. mensual: <strong>+{fmtNum(data.variacion ?? ultimoDato?.variacion, 1)}%</strong> · Var. en {periodoSeleccionado}: <strong>+{fmtNum(varPeriodo, 1)}%</strong>
                    </div>

                    {mostrarExplicativos && (
                      <div style={{
                        marginTop: 10,
                        background: colorTablaBg,
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 10.5,
                        color: tokens.textMuted,
                        lineHeight: 1.35
                      }}>
                        <strong style={{ color: tokens.ink, display: "block" }}>Qué representa:</strong>
                        {info.queRepresenta}
                        <div style={{ marginTop: 3, color: tokens.gold, fontWeight: 600 }}>
                          Uso: {info.impactoCashflow}
                        </div>
                      </div>
                    )}

                    {isStale(data.updated_at) && (
                      <div style={{ fontSize: 10.5, color: tokens.negative, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                        <AlertTriangle size={12} /> Dato cargado hace más de 45 días
                      </div>
                    )}

                    {/* Mini Gráfico Segmentado del Índice */}
                    <div style={{ height: 60, marginTop: 10 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={histFiltrado} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={tokens.gold} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={tokens.gold} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, fontFamily: tokens.fontBody, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6 }}
                            formatter={(v) => [`${fmtNum(v, 1)} pts`, meta.label]}
                            labelFormatter={(idx) => `Mes: ${histFiltrado[idx]?.mes || ""}`}
                          />
                          <Area type="monotone" dataKey="valor" stroke={tokens.gold} strokeWidth={2} fill={`url(#grad-${id})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => toggleForm(id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: `1px solid ${colorLineaFuerte}`,
                        color: tokens.textMuted,
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      <Pencil size={12} /> Actualizar dato
                    </button>

                    {open && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" step="0.1" placeholder="Puntos" defaultValue={data.valor} onChange={(e) => setD(id, "valor", e.target.value)} style={inputStyle} />
                          <input type="number" step="0.1" placeholder="Var. mensual %" defaultValue={data.variacion} onChange={(e) => setD(id, "variacion", e.target.value)} style={inputStyle} />
                        </div>
                        <input type="text" placeholder="Período (ej: Octubre 2026)" defaultValue={data.mes} onChange={(e) => setD(id, "mes", e.target.value)} style={inputStyle} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveCAC(id)} style={saveBtnStyle}><Save size={13} /> Guardar</button>
                          <button onClick={() => toggleForm(id)} style={cancelBtnStyle}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 3: INDICADORES MACROECONÓMICOS Y BCRA
          ═══════════════════════════════════════════════════════════════════ */}
      {(seccionFiltro === "todos" || seccionFiltro === "macro") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            title="Variables Macroeconómicas BCRA e Inflación"
            badge="Estadísticas Monetarias"
            desc="Parámetros macroeconómicos del Banco Central de la República Argentina y Riesgo País JP Morgan."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {Object.entries(BCRA_CFG).map(([key, cfg]) => {
              const seriesCompleta = macro[key] || [];
              const seriesFiltrada = filtrarPorPeriodo(seriesCompleta, periodoSeleccionado);
              const last = seriesFiltrada[seriesFiltrada.length - 1] || seriesCompleta[seriesCompleta.length - 1];
              const first = seriesFiltrada[0] || seriesCompleta[0];

              let display = "—", sub = "";
              if (last) {
                if (key === "reservas") {
                  display = `USD ${fmtNum(last.valor / 1000, 1)}B`;
                  sub = `Millones · ${last.fecha}`;
                } else if (key === "riesgoPais") {
                  display = `${fmtNum(last.valor, 0)} pb`;
                  sub = `EMBI · ${last.fecha}`;
                } else {
                  display = `${fmtNum(last.valor, 1)}%`;
                  sub = `Dato oficial: ${last.fecha}`;
                }
              }

              const info = INDICADORES_GLOSARIO[key] || {};

              return (
                <div
                  key={key}
                  style={{
                    background: tokens.surface,
                    border: `1px solid ${colorLineaFuerte}`,
                    borderRadius: 10,
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: "0.8px", textTransform: "uppercase", color: tokens.textMuted, fontWeight: 700 }}>
                      {cfg.label}
                    </div>
                    
                    <div style={{ fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                      {display}
                    </div>

                    <div style={{ fontSize: 10.5, color: tokens.textFaint, marginTop: 2 }}>
                      {sub}
                    </div>

                    {mostrarExplicativos && (
                      <div style={{
                        marginTop: 8,
                        background: colorTablaBg,
                        borderRadius: 6,
                        padding: "6px 8px",
                        fontSize: 10.5,
                        color: tokens.textMuted,
                        lineHeight: 1.3
                      }}>
                        <strong style={{ color: tokens.ink, display: "block" }}>Qué representa:</strong>
                        {info.queRepresenta}
                      </div>
                    )}

                    {/* Gráfico Sparkline Segmentado */}
                    <div style={{ height: 44, marginTop: 10 }}>
                      {seriesFiltrada.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={seriesFiltrada} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`grad-macro-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={tokens.gold} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={tokens.gold} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <YAxis hide domain={["dataMin", "dataMax"]} />
                            <Tooltip
                              contentStyle={{ fontSize: 11, fontFamily: tokens.fontBody, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6 }}
                              formatter={(v) => [fmtNum(v, 1) + ` ${cfg.unit}`, cfg.label]}
                              labelFormatter={(i) => `Fecha: ${seriesFiltrada[i]?.fecha || ""}`}
                            />
                            <Area type="monotone" dataKey="valor" stroke={tokens.gold} strokeWidth={1.8} fill={`url(#grad-macro-${key})`} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: tokens.textFaint }}>
                          Sin serie histórica en este segmento
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 4: MATRIZ HISTÓRICA COMPARATIVA POR PERÍODOS
          ═══════════════════════════════════════════════════════════════════ */}
      {(seccionFiltro === "todos" || seccionFiltro === "matriz") && (
        <div style={{
          background: "#FFFFFF",
          border: `1px solid ${colorLineaFuerte}`,
          borderRadius: 12,
          padding: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: tokens.gold }}>
                Auditoría Cruzada Periódica
              </span>
              <h3 style={{ margin: "2px 0 0", fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 700, color: tokens.ink }}>
                Matriz Comparativa por Períodos (Mes a Mes)
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: tokens.textMuted }}>
                Comparativa de la evolución simultánea del Dólar MEP, Dólar Blue, Inflación IPC, Índice CAC y Hormigón H-21.
              </p>
            </div>

            <div style={{ fontSize: 11.5, color: tokens.textMuted, background: colorTablaBg, padding: "4px 10px", borderRadius: 6 }}>
              Mostrando <strong>{matrizFiltrada.length} meses</strong> según filtro activo ({periodoSeleccionado})
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: colorTablaBg, borderBottom: `2px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "10px 12px" }}>Período</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Dólar MEP ($)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Dólar Blue ($)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Inflación IPC (%)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Índice CAC (pts)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Var. CAC (%)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Hormigón H-21 ($/m³)</th>
                </tr>
              </thead>
              <tbody>
                {matrizFiltrada.map((fila, idx) => (
                  <tr
                    key={fila.periodo}
                    style={{
                      borderBottom: `1px solid ${colorLineaSuave}`,
                      background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA"
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: tokens.ink }}>
                      {fila.periodo}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono, color: "#6B5FA6", fontWeight: 600 }}>
                      ${fmtNum(fila.mep, 0)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.gold, fontWeight: 600 }}>
                      ${fmtNum(fila.blue, 0)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono }}>
                      +{fmtNum(fila.ipc, 1)}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                      {fmtNum(fila.cacGral, 1)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.negative }}>
                      +{fmtNum(fila.cacVar, 1)}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.ink }}>
                      ${fmtNum(fila.h21, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOAST FLOTANTE */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: tokens.ink,
          color: "#fff",
          padding: "11px 18px",
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          zIndex: 9999
        }}>
          <CheckCircle2 size={15} color={tokens.positive} /> {toast}
        </div>
      )}

      {/* PIE DE PÁGINA CON FUENTES Y METODOLOGÍA */}
      <div style={{
        fontSize: 11,
        color: tokens.textFaint,
        lineHeight: 1.8,
        borderTop: `1px solid ${colorLineaSuave}`,
        paddingTop: 14,
        marginTop: 6
      }}>
        <div><strong>Fuentes Automáticas:</strong> Cotizaciones spot vía <code>dolarapi.com</code> · Indicadores Monetarios vía API Oficial <code>api.bcra.gob.ar</code> · Riesgo País EMBI vía <code>api.argentinadatos.com</code>.</div>
        <div><strong>Carga Manual y Auditoría:</strong> Índice CAC oficial publicado mensualmente por <code>camarco.org.ar</code> (aprox. día 20 de cada mes) · Hormigón Elaborado H-21 referenciado por lista de precios de proveedores zonales directos.</div>
      </div>

    </div>
  );
}

function SectionHeader({ title, badge, desc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: tokens.gold }}>
          {badge}
        </span>
        <div style={{ flex: 1, height: 1, background: colorLineaSuave }} />
      </div>
      <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 700, color: tokens.ink }}>
        {title}
      </h3>
      {desc && <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>{desc}</p>}
    </div>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div style={{ background: colorTablaBg, border: `1px solid ${colorLineaSuave}`, borderRadius: 7, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, letterSpacing: "0.5px", textTransform: "uppercase", color: tokens.textMuted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: tokens.fontDisplay, fontSize: 14.5, fontWeight: 700, color: highlight || tokens.ink }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  padding: "8px 10px",
  border: `1px solid ${colorLineaFuerte}`,
  borderRadius: 6,
  fontSize: 12,
  fontFamily: tokens.fontBody,
  outline: "none",
  background: "#FFFFFF"
};

const saveBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: tokens.ink,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer"
};

const cancelBtnStyle = {
  background: "transparent",
  border: `1px solid ${colorLineaFuerte}`,
  color: tokens.textMuted,
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 11.5,
  cursor: "pointer"
};
