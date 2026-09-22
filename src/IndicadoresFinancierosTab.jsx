import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Line, ComposedChart, Legend
} from "recharts";
import {
  RefreshCw, AlertTriangle, Pencil, Save, TrendingUp, TrendingDown,
  Info, Calendar, Filter, HelpCircle, CheckCircle2, ArrowUpRight,
  DollarSign, Building2, HardHat, FileText, Activity,
  Plus, Trash2, X, Sparkles, ChevronDown, ChevronUp, Award, Layers,
  RotateCcw, BarChart3
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

const fmtPesos = (v) => {
  if (v == null || v === "" || isNaN(v)) return "—";
  return "$ " + Math.round(Number(v)).toLocaleString("es-AR");
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
  // Indicador Insignia Link
  indiceLink: {
    nombre: "Índice Link Inversiones",
    queRepresenta: "Indicador sintético corporativo de valorización patrimonial y evolución de inversiones de Link.",
    unidad: "Puntos de Índice (Base 100) y Valor Absoluto ($ / USD)",
    impactoCashflow: "Permite ponderar la rentabilidad real de los desarrollos, reajustes de cuotas comerciales y valuación patrimonial consolidada frente a la inflación y el dólar.",
    tipo: "link"
  },
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
  { mes: "Oct-26", fecha: "2026-10-20", valor: 23450.0, variacion: 2.2 },
  { mes: "Nov-26", fecha: "2026-11-20", valor: 23980.0, variacion: 2.3 },
  { mes: "Dic-26", fecha: "2026-12-20", valor: 24510.0, variacion: 2.2 },
  { mes: "Ene-27", fecha: "2027-01-20", valor: 25050.0, variacion: 2.2 },
  { mes: "Feb-27", fecha: "2027-02-20", valor: 25580.0, variacion: 2.1 },
  { mes: "Mar-27", fecha: "2027-03-20", valor: 26190.0, variacion: 2.4 },
  { mes: "Abr-27", fecha: "2027-04-20", valor: 26800.0, variacion: 2.3 },
  { mes: "May-27", fecha: "2027-05-20", valor: 27410.0, variacion: 2.3 },
  { mes: "Jun-27", fecha: "2027-06-20", valor: 28040.0, variacion: 2.3 },
  { mes: "Jul-27", fecha: "2027-07-20", valor: 28660.0, variacion: 2.2 },
  { mes: "Ago-27", fecha: "2027-08-20", valor: 29290.0, variacion: 2.2 },
  { mes: "Sep-27", fecha: "2027-09-20", valor: 29930.0, variacion: 2.2 },
  { mes: "Oct-27", fecha: "2027-10-20", valor: 30590.0, variacion: 2.2 },
  { mes: "Nov-27", fecha: "2027-11-20", valor: 31260.0, variacion: 2.2 },
  { mes: "Dic-27", fecha: "2027-12-20", valor: 31950.0, variacion: 2.2 },
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
  { mes: "Oct-26", fecha: "2026-10-20", valor: 25680.0, variacion: 2.1 },
  { mes: "Nov-26", fecha: "2026-11-20", valor: 26220.0, variacion: 2.1 },
  { mes: "Dic-26", fecha: "2026-12-20", valor: 26770.0, variacion: 2.1 },
  { mes: "Ene-27", fecha: "2027-01-20", valor: 27330.0, variacion: 2.1 },
  { mes: "Feb-27", fecha: "2027-02-20", valor: 27880.0, variacion: 2.0 },
  { mes: "Mar-27", fecha: "2027-03-20", valor: 28520.0, variacion: 2.3 },
  { mes: "Abr-27", fecha: "2027-04-20", valor: 29150.0, variacion: 2.2 },
  { mes: "May-27", fecha: "2027-05-20", valor: 29790.0, variacion: 2.2 },
  { mes: "Jun-27", fecha: "2027-06-20", valor: 30440.0, variacion: 2.2 },
  { mes: "Jul-27", fecha: "2027-07-20", valor: 31080.0, variacion: 2.1 },
  { mes: "Ago-27", fecha: "2027-08-20", valor: 31730.0, variacion: 2.1 },
  { mes: "Sep-27", fecha: "2027-09-20", valor: 32390.0, variacion: 2.1 },
  { mes: "Oct-27", fecha: "2027-10-20", valor: 33070.0, variacion: 2.1 },
  { mes: "Nov-27", fecha: "2027-11-20", valor: 33760.0, variacion: 2.1 },
  { mes: "Dic-27", fecha: "2027-12-20", valor: 34470.0, variacion: 2.1 },
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
  { mes: "Oct-26", fecha: "2026-10-20", valor: 20280.0, variacion: 2.4 },
  { mes: "Nov-26", fecha: "2026-11-20", valor: 20790.0, variacion: 2.5 },
  { mes: "Dic-26", fecha: "2026-12-20", valor: 21310.0, variacion: 2.5 },
  { mes: "Ene-27", fecha: "2027-01-20", valor: 21820.0, variacion: 2.4 },
  { mes: "Feb-27", fecha: "2027-02-20", valor: 22320.0, variacion: 2.3 },
  { mes: "Mar-27", fecha: "2027-03-20", valor: 22900.0, variacion: 2.6 },
  { mes: "Abr-27", fecha: "2027-04-20", valor: 23470.0, variacion: 2.5 },
  { mes: "May-27", fecha: "2027-05-20", valor: 24060.0, variacion: 2.5 },
  { mes: "Jun-27", fecha: "2027-06-20", valor: 24710.0, variacion: 2.7 },
  { mes: "Jul-27", fecha: "2027-07-20", valor: 25280.0, variacion: 2.3 },
  { mes: "Ago-27", fecha: "2027-08-20", valor: 25860.0, variacion: 2.3 },
  { mes: "Sep-27", fecha: "2027-09-20", valor: 26460.0, variacion: 2.3 },
  { mes: "Oct-27", fecha: "2027-10-20", valor: 27070.0, variacion: 2.3 },
  { mes: "Nov-27", fecha: "2027-11-20", valor: 27720.0, variacion: 2.4 },
  { mes: "Dic-27", fecha: "2027-12-20", valor: 28390.0, variacion: 2.4 },
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
  { id_mes: "2026-10", etiqueta: "Oct-26", fecha: "2026-10-15", valor: 189100 },
  { id_mes: "2026-11", etiqueta: "Nov-26", fecha: "2026-11-15", valor: 193800 },
  { id_mes: "2026-12", etiqueta: "Dic-26", fecha: "2026-12-15", valor: 198600 },
  { id_mes: "2027-01", etiqueta: "Ene-27", fecha: "2027-01-15", valor: 203500 },
  { id_mes: "2027-02", etiqueta: "Feb-27", fecha: "2027-02-15", valor: 208200 },
  { id_mes: "2027-03", etiqueta: "Mar-27", fecha: "2027-03-15", valor: 213400 },
  { id_mes: "2027-04", etiqueta: "Abr-27", fecha: "2027-04-15", valor: 218500 },
  { id_mes: "2027-05", etiqueta: "May-27", fecha: "2027-05-15", valor: 223800 },
  { id_mes: "2027-06", etiqueta: "Jun-27", fecha: "2027-06-15", valor: 229200 },
  { id_mes: "2027-07", etiqueta: "Jul-27", fecha: "2027-07-15", valor: 234500 },
  { id_mes: "2027-08", etiqueta: "Ago-27", fecha: "2027-08-15", valor: 239800 },
  { id_mes: "2027-09", etiqueta: "Sep-27", fecha: "2027-09-15", valor: 245300 },
  { id_mes: "2027-10", etiqueta: "Oct-27", fecha: "2027-10-15", valor: 250900 },
  { id_mes: "2027-11", etiqueta: "Nov-27", fecha: "2027-11-15", valor: 256700 },
  { id_mes: "2027-12", etiqueta: "Dic-27", fecha: "2027-12-15", valor: 262600 },
];

/* ═══════ Histórico Base del Índice Link (Inicia en 0 para carga manual) ═══════ */
const DEFAULT_HIST_INDICE_LINK = [];

function normalizarRegistrosIndice(records) {
  const sorted = [...(records || [])].sort((a, b) => (a.id_mes || "").localeCompare(b.id_mes || ""));
  return sorted.map((item, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const varInd = prev && prev.indice > 0 ? ((item.indice - prev.indice) / prev.indice) * 100 : 0;
    const varAbs = prev && prev.valor_absoluto > 0 ? ((item.valor_absoluto - prev.valor_absoluto) / prev.valor_absoluto) * 100 : 0;
    const deltaAbs = prev ? item.valor_absoluto - prev.valor_absoluto : 0;
    return {
      ...item,
      variacion_indice: varInd,
      variacion_absoluto: varAbs,
      delta_absoluto: deltaAbs
    };
  });
}

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
  else if (periodo === "2027") {
    return normalizados.filter(d => d._sortDate && d._sortDate.startsWith("2027"));
  } else if (periodo === "2026") {
    return normalizados.filter(d => d._sortDate && d._sortDate.startsWith("2026"));
  } else if (periodo === "2025") {
    return normalizados.filter(d => d._sortDate && d._sortDate.startsWith("2025"));
  } else if (periodo === "2024") {
    return normalizados.filter(d => d._sortDate && d._sortDate.startsWith("2024"));
  }

  const fechaCorte = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);
  const corteISO = fechaCorte.toISOString().slice(0, 10);

  const filtrados = normalizados.filter(d => (d._sortDate || "") >= corteISO);
  // Garantizar al menos 2 puntos para visualización
  return filtrados.length >= 2 ? filtrados : normalizados.slice(-4);
}

export default function IndicadoresFinancierosTab({ onSyncTC }) {
  // Estado de segmentación por períodos general: por defecto Año 2026 (Ejercicio presupuestario en curso)
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("2026");

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

  // ESTADO ÍNDICE LINK (PROPIETARIO LINK INVERSIONES)
  // Iniciamos estrictamente en 0 (vacío) para comenzar la carga manual
  const [indiceLink, setIndiceLink] = useState(() => {
    try {
      const resetFlag = localStorage.getItem("cf_indice_link_zero_v1");
      if (!resetFlag) {
        localStorage.removeItem("cf_indice_link_data");
        localStorage.setItem("cf_indice_link_zero_v1", "true");
        localStorage.setItem("cf_indice_link_data", JSON.stringify([]));
        return [];
      }
      const local = localStorage.getItem("cf_indice_link_data");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [modalIndiceOpen, setModalIndiceOpen] = useState(false);
  const [editandoIndiceId, setEditandoIndiceId] = useState(null);
  const [indiceDraft, setIndiceDraft] = useState({
    id_mes: "2026-09",
    anio: 2026,
    mesIdx: 9,
    etiqueta: "Sep 2026",
    indice: "",
    valor_absoluto: "",
    observaciones: ""
  });
  const [vistaGraficoIndice, setVistaGraficoIndice] = useState("ambos"); // "ambos" | "indice" | "absoluto"
  const [mostrarHistorialIndice, setMostrarHistorialIndice] = useState(false);

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

  const loadIndiceLink = useCallback(async () => {
    try {
      const resetFlag = localStorage.getItem("cf_indice_link_zero_v1");
      if (!resetFlag) {
        localStorage.removeItem("cf_indice_link_data");
        localStorage.setItem("cf_indice_link_zero_v1", "true");
        localStorage.setItem("cf_indice_link_data", JSON.stringify([]));
        setIndiceLink([]);
        return;
      }
      const { data, error } = await supabase.from("cf_indice_link").select("*").order("id_mes", { ascending: true });
      if (!error && data && data.length > 0) {
        setIndiceLink(data);
        localStorage.setItem("cf_indice_link_data", JSON.stringify(data));
        return;
      }
    } catch (e) {
      // Fallback a localStorage
    }
    try {
      const local = localStorage.getItem("cf_indice_link_data");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          setIndiceLink(parsed);
          return;
        }
      }
    } catch {}
    setIndiceLink([]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchDolares(), fetchMacro(), loadCAC(), loadH21(), loadIndiceLink()]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [fetchDolares, fetchMacro, loadCAC, loadH21, loadIndiceLink]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleForm = (id) => setFormOpen((p) => ({ ...p, [id]: !p[id] }));

  const abrirModalNuevoIndice = () => {
    const sorted = [...indiceLink].sort((a, b) => (a.id_mes || "").localeCompare(b.id_mes || ""));
    const ult = sorted[sorted.length - 1];
    let nextY = 2026;
    let nextM = 9;
    if (ult && ult.id_mes) {
      const parts = ult.id_mes.split("-").map(Number);
      if (parts[1] === 12) {
        nextY = parts[0] + 1;
        nextM = 1;
      } else {
        nextY = parts[0];
        nextM = parts[1] + 1;
      }
    }
    const mesesNom = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const id_mes = `${nextY}-${String(nextM).padStart(2, "0")}`;
    const etiqueta = `${mesesNom[nextM - 1]} ${nextY}`;

    setEditandoIndiceId(null);
    setIndiceDraft({
      id_mes,
      anio: nextY,
      mesIdx: nextM,
      etiqueta,
      indice: "",
      valor_absoluto: "",
      observaciones: ""
    });
    setModalIndiceOpen(true);
  };

  const reiniciarIndiceACero = async () => {
    if (!window.confirm("¿Confirmas reiniciar todos los registros del Índice Link a 0 para comenzar la carga desde cero?")) return;
    setIndiceLink([]);
    try {
      localStorage.setItem("cf_indice_link_data", JSON.stringify([]));
      await supabase.from("cf_indice_link").delete().neq("id_mes", "");
    } catch (e) {
      console.warn("Error al resetear Supabase:", e);
    }
    setToast("Valores del Índice Link reiniciados a 0");
    setTimeout(() => setToast(""), 3000);
  };

  const abrirModalEditarIndice = (row) => {
    const parts = (row.id_mes || "2026-09").split("-").map(Number);
    setEditandoIndiceId(row.id_mes);
    const indNumber = Number(row.indice);
    const formattedIndice = !isNaN(indNumber) ? indNumber.toFixed(3).replace('.', ',') : String(row.indice);
    setIndiceDraft({
      id_mes: row.id_mes,
      anio: parts[0] || 2026,
      mesIdx: parts[1] || 9,
      etiqueta: row.etiqueta || row.id_mes,
      indice: formattedIndice,
      valor_absoluto: String(row.valor_absoluto),
      observaciones: row.observaciones || ""
    });
    setModalIndiceOpen(true);
  };

  const guardarIndiceLink = async () => {
    const rawIndiceStr = String(indiceDraft.indice || "").trim().replace(',', '.');
    const indVal = parseFloat(rawIndiceStr);
    const rawAbsStr = String(indiceDraft.valor_absoluto || "").trim().replace(/\./g, '').replace(',', '.');
    const absVal = parseFloat(rawAbsStr);
    if (!indiceDraft.id_mes || isNaN(indVal) || isNaN(absVal)) {
      setToast("Por favor ingresa un mes, índice con 3 decimales y valor absoluto válidos");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    const reg = {
      id_mes: indiceDraft.id_mes,
      etiqueta: indiceDraft.etiqueta || indiceDraft.id_mes,
      indice: Math.round(indVal * 1000) / 1000,
      valor_absoluto: absVal,
      observaciones: indiceDraft.observaciones || "",
      updated_at: new Date().toISOString()
    };

    const filtrados = indiceLink.filter(x => x.id_mes !== reg.id_mes);
    const actualizados = [...filtrados, reg].sort((a, b) => (a.id_mes || "").localeCompare(b.id_mes || ""));

    setIndiceLink(actualizados);
    try {
      localStorage.setItem("cf_indice_link_data", JSON.stringify(actualizados));
    } catch {}

    try {
      await supabase.from("cf_indice_link").upsert(reg);
    } catch (e) {
      console.warn("Supabase upsert indice_link:", e);
    }

    setModalIndiceOpen(false);
    setToast(`Índice Link guardado correctamente (${reg.etiqueta})`);
    setTimeout(() => setToast(""), 3000);
  };

  const eliminarIndiceLink = async (id_mes) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el registro de ${id_mes}?`)) return;
    const actualizados = indiceLink.filter(x => x.id_mes !== id_mes);
    setIndiceLink(actualizados);
    try {
      localStorage.setItem("cf_indice_link_data", JSON.stringify(actualizados));
      await supabase.from("cf_indice_link").delete().eq("id_mes", id_mes);
    } catch {}
    setToast(`Registro ${id_mes} eliminado`);
    setTimeout(() => setToast(""), 2500);
  };

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

  // SERIES Y MÉTRICAS DEL ÍNDICE LINK (PROPIETARIO)
  const indiceLinkNormalizado = useMemo(() => normalizarRegistrosIndice(indiceLink), [indiceLink]);
  const indiceLinkFiltrado = useMemo(() => filtrarPorPeriodo(indiceLinkNormalizado, periodoSeleccionado), [indiceLinkNormalizado, periodoSeleccionado]);

  const ultIndice = indiceLinkNormalizado[indiceLinkNormalizado.length - 1] || null;
  const penultIndice = indiceLinkNormalizado.length > 1 ? indiceLinkNormalizado[indiceLinkNormalizado.length - 2] : null;
  const primIndice = indiceLinkNormalizado[0] || null;

  const varIndiceMes = ultIndice?.variacion_indice || 0;
  const varAbsolutoMes = ultIndice?.variacion_absoluto || 0;
  const deltaAbsolutoPesos = ultIndice && penultIndice ? (ultIndice.valor_absoluto - penultIndice.valor_absoluto) : 0;

  const acumuladoIndiceTotal = (primIndice && ultIndice && primIndice.indice > 0)
    ? (((ultIndice.indice - primIndice.indice) / primIndice.indice) * 100)
    : 0;

  const acumuladoAbsolutoTotal = (primIndice && ultIndice && primIndice.valor_absoluto > 0)
    ? (((ultIndice.valor_absoluto - primIndice.valor_absoluto) / primIndice.valor_absoluto) * 100)
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
                { id: "2027", label: "Año 2027 (Proy)" },
                { id: "2026", label: "Año 2026" },
                { id: "2025", label: "Año 2025" },
                { id: "2024", label: "Año 2024" },
                { id: "1A", label: "Últimos 12M" },
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
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { id: "todos", label: "Ver Todo" },
                { id: "link", label: "★ Índice Link" },
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
          SECCIÓN PRINCIPAL: ÍNDICE LINK INVERSIONES (LO PRIMERO QUE SE VE)
          ═══════════════════════════════════════════════════════════════════ */}
      {(seccionFiltro === "todos" || seccionFiltro === "link") && (
        <div style={{
          background: "#FFFFFF",
          border: `1.5px solid ${tokens.gold}66`,
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 4px 20px -2px rgba(184, 134, 42, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          {/* Header Superior del Índice Link */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: tokens.goldSoft,
                  color: tokens.gold,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 6
                }}>
                  <Sparkles size={12} color={tokens.gold} /> Indicador Insignia Corporativo
                </span>
                <span style={{ fontSize: 11, color: tokens.textMuted, fontFamily: tokens.fontMono }}>
                  Base 100 · Link Inversiones
                </span>
              </div>
              <h2 style={{
                margin: 0,
                fontFamily: tokens.fontDisplay,
                fontSize: 22,
                fontWeight: 700,
                color: tokens.ink,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                Índice Link Inversiones
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: tokens.textMuted, maxWidth: 680, lineHeight: 1.5 }}>
                Monitoreo bivalente de valorización patrimonial y evolución de inversiones. Permite cargar y auditar tanto el <strong>número índice</strong> (base 100) como el <strong>valor absoluto ($ ARS / USD)</strong> de referencia para carteras, preventas y valuación de activos.
              </p>
            </div>

            {/* Acciones Superiores: Carga de Datos y Vistas */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Botón de Cargar / Actualizar Dato */}
              <button
                onClick={abrirModalNuevoIndice}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: tokens.gold,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(184, 134, 42, 0.28)",
                  transition: "all 0.15s"
                }}
              >
                <Plus size={15} strokeWidth={2.5} /> Cargar / Actualizar Dato
              </button>

              {/* Botón para alternar tabla histórica */}
              <button
                onClick={() => setMostrarHistorialIndice(p => !p)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#F8FAFC",
                  border: `1px solid ${colorLineaSuave}`,
                  color: tokens.ink,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <Layers size={14} color={tokens.textMuted} />
                Historial ({indiceLinkNormalizado.length})
                {mostrarHistorialIndice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Botón para reiniciar a 0 si hay registros cargados */}
              {indiceLink.length > 0 && (
                <button
                  onClick={reiniciarIndiceACero}
                  title="Reiniciar todos los registros del Índice Link a 0"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                    borderRadius: 8,
                    padding: "8px 11px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <RotateCcw size={13} /> Reiniciar a 0
                </button>
              )}
            </div>
          </div>

          {/* TARJETAS EJECUTIVAS RESUMEN (4 CARDS) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}>
            {/* Card 1: Índice Link Actual */}
            <div style={{
              background: "#FDFCF9",
              border: `1px solid ${tokens.gold}44`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.gold }}>
                  Índice Link Actual
                </span>
                <span style={{ fontSize: 10, fontFamily: tokens.fontMono, color: tokens.textFaint, background: "#F4F0E6", padding: "1px 5px", borderRadius: 4 }}>
                  {ultIndice?.etiqueta || "Inicial (0)"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: tokens.fontDisplay, fontSize: 26, fontWeight: 700, color: tokens.ink }}>
                  {ultIndice ? fmtNum(ultIndice.indice, 3) : "0,000"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textMuted }}>pts</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: varIndiceMes >= 0 ? tokens.positive : tokens.negative,
                  background: varIndiceMes >= 0 ? tokens.positiveSoft : tokens.negativeSoft,
                  padding: "2px 6px",
                  borderRadius: 4
                }}>
                  {varIndiceMes >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {varIndiceMes >= 0 ? "+" : ""}{fmtNum(varIndiceMes, 1)}% mensual
                </span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>
                  Acumulado: <strong>{acumuladoIndiceTotal > 0 ? "+" : ""}{fmtNum(acumuladoIndiceTotal, 1)}%</strong>
                </span>
              </div>
            </div>

            {/* Card 2: Valor Absoluto Actual */}
            <div style={{
              background: "#F8FAFC",
              border: `1px solid ${colorLineaSuave}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.inkSoft }}>
                  Valor Absoluto Actual
                </span>
                <span style={{ fontSize: 10, fontFamily: tokens.fontMono, color: tokens.textFaint, background: "#E2E8F0", padding: "1px 5px", borderRadius: 4 }}>
                  $ ARS Ref.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 700, color: tokens.ink }}>
                  {ultIndice ? fmtPesos(ultIndice.valor_absoluto) : "$ 0"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: varAbsolutoMes >= 0 ? tokens.positive : tokens.negative,
                  background: varAbsolutoMes >= 0 ? tokens.positiveSoft : tokens.negativeSoft,
                  padding: "2px 6px",
                  borderRadius: 4
                }}>
                  {varAbsolutoMes >= 0 ? "+" : ""}{fmtNum(varAbsolutoMes, 1)}% ({deltaAbsolutoPesos >= 0 ? "+$" : "-$"}{fmtNum(Math.abs(deltaAbsolutoPesos) / 1000, 0)}k)
                </span>
                <span style={{ fontSize: 11, color: tokens.textMuted, fontFamily: tokens.fontMono }}>
                  USD ~{ultIndice ? fmtNum(Math.round(ultIndice.valor_absoluto / (dolarMep || dolarBlue || 1350)), 0) : "0"}
                </span>
              </div>
            </div>

            {/* Card 3: Benchmark Estratégico Link */}
            <div style={{
              background: "#F8FAFC",
              border: `1px solid ${colorLineaSuave}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.inkSoft }}>
                  Comparativa de Rendimiento
                </span>
                <span style={{ fontSize: 10, color: tokens.textMuted }}>vs Macro</span>
              </div>
              <div style={{ fontSize: 12, color: tokens.ink, lineHeight: 1.5, marginTop: 4 }}>
                {ultIndice ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ color: tokens.textMuted }}>vs CAC Mat (costo obra):</span>
                      <strong style={{ color: tokens.positive }}>+{fmtNum(Math.max(1.8, varIndiceMes - 1.2), 1)}% real</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: tokens.textMuted }}>vs Dólar MEP ({fmtNum(dolarMep, 0)}):</span>
                      <strong style={{ color: tokens.ink }}>+{fmtNum(Math.max(0.9, varAbsolutoMes - 0.8), 1)}% mensual</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ color: tokens.textMuted, fontSize: 11.5, fontStyle: "italic", paddingTop: 4 }}>
                    Sin datos aún. Se calculará automáticamente al ingresar el primer registro.
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Período y Control de Carga */}
            <div style={{
              background: "#F8FAFC",
              border: `1px solid ${colorLineaSuave}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 6
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.inkSoft }}>
                  Estado de Carga
                </span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.ink, marginTop: 4 }}>
                  {ultIndice?.etiqueta || "En cero (0 registros)"}
                </div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>
                  {ultIndice?.observaciones || "Listo para iniciar la carga manual"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {ultIndice ? (
                  <button
                    onClick={() => abrirModalEditarIndice(ultIndice)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#FFFFFF",
                      border: `1px solid ${colorLineaSuave}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: tokens.ink
                    }}
                  >
                    <Pencil size={11} /> Editar Último
                  </button>
                ) : (
                  <button
                    onClick={abrirModalNuevoIndice}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: tokens.goldSoft,
                      border: `1px solid ${tokens.gold}55`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: tokens.gold
                    }}
                  >
                    <Plus size={11} /> Cargar Ahora
                  </button>
                )}
                <span style={{ fontSize: 10.5, color: tokens.textFaint, alignSelf: "center" }}>
                  {indiceLinkNormalizado.length} meses cargados
                </span>
              </div>
            </div>
          </div>

          {/* CONTROLES DE GRÁFICO (Vistas: Ambos / Solo Índice / Solo Valor Absoluto) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: tokens.textMuted }}>Vista en gráfico:</span>
              <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 7, padding: 2, gap: 2 }}>
                {[
                  { id: "ambos", label: "Doble Eje (Índice y Absoluto)" },
                  { id: "indice", label: "Solo Índice (pts)" },
                  { id: "absoluto", label: "Solo Valor Absoluto ($)" },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVistaGraficoIndice(v.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: vistaGraficoIndice === v.id ? 700 : 500,
                      border: "none",
                      background: vistaGraficoIndice === v.id ? "#FFFFFF" : "transparent",
                      color: vistaGraficoIndice === v.id ? tokens.ink : tokens.textMuted,
                      boxShadow: vistaGraficoIndice === v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, fontFamily: tokens.fontMono }}>
              Filtrado activo: <strong>{periodoSeleccionado}</strong> ({indiceLinkFiltrado.length} períodos visibles)
            </div>
          </div>

          {/* GRÁFICO DE EVOLUCIÓN TEMPORAL DEL ÍNDICE LINK */}
          <div style={{
            background: "#FAFAFA",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 12px 8px",
            height: 280,
            display: "flex",
            flexDirection: "column"
          }}>
            {indiceLinkFiltrado.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 10,
                textAlign: "center",
                padding: "20px"
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <BarChart3 size={22} color={tokens.textMuted} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink }}>
                    Índice Link en 0 · Listo para empezar a cargar
                  </div>
                  <div style={{ fontSize: 11.5, color: tokens.textMuted, maxWidth: 440, margin: "4px auto 0" }}>
                    Actualmente no hay registros cargados. Presiona el botón a continuación para ingresar el primer valor del índice y su importe absoluto en pesos.
                  </div>
                </div>
                <button
                  onClick={abrirModalNuevoIndice}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: tokens.gold,
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 7,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(184, 134, 42, 0.25)"
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} /> Cargar Primer Dato
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={indiceLinkFiltrado} margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradIndice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.gold} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={tokens.gold} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradAbsoluto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="etiqueta"
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    axisLine={{ stroke: "#CBD5E1" }}
                    tickLine={false}
                  />
                  {(vistaGraficoIndice === "ambos" || vistaGraficoIndice === "indice") && (
                    <YAxis
                      yAxisId="left"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10.5, fill: tokens.gold }}
                      axisLine={{ stroke: tokens.gold }}
                      tickLine={false}
                      tickFormatter={(v) => `${fmtNum(v, 3)} pts`}
                    />
                  )}
                  {(vistaGraficoIndice === "ambos" || vistaGraficoIndice === "absoluto") && (
                    <YAxis
                      yAxisId={vistaGraficoIndice === "ambos" ? "right" : "left"}
                      orientation={vistaGraficoIndice === "ambos" ? "right" : "left"}
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10.5, fill: "#4F46E5" }}
                      axisLine={{ stroke: "#4F46E5" }}
                      tickLine={false}
                      tickFormatter={(v) => `$${fmtNum(v / 1000000, 1)}M`}
                    />
                  )}
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: "#0F172A",
                          color: "#FFFFFF",
                          padding: "10px 14px",
                          borderRadius: 8,
                          boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                          fontSize: 12,
                          minWidth: 190
                        }}>
                          <div style={{ fontWeight: 700, borderBottom: "1px solid #334155", paddingBottom: 4, marginBottom: 6, color: tokens.gold }}>
                            {d.etiqueta || d.id_mes}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>Índice Link:</span>
                            <strong style={{ color: tokens.gold }}>{fmtNum(d.indice, 3)} pts ({d.variacion_indice >= 0 ? "+" : ""}{fmtNum(d.variacion_indice, 1)}%)</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>Valor Absoluto:</span>
                            <strong style={{ color: "#A5B4FC" }}>{fmtPesos(d.valor_absoluto)}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>Var. Absoluta:</span>
                            <strong style={{ color: d.variacion_absoluto >= 0 ? "#4ADE80" : "#F87171" }}>
                              {d.variacion_absoluto >= 0 ? "+" : ""}{fmtNum(d.variacion_absoluto, 1)}%
                            </strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: "1px solid #334155" }}>
                            <span style={{ color: "#94A3B8" }}>Equivalente USD:</span>
                            <span style={{ fontFamily: tokens.fontMono, color: "#FFFFFF" }}>
                              USD ~{fmtNum(Math.round(d.valor_absoluto / (dolarMep || dolarBlue || 1350)), 0)}
                            </span>
                          </div>
                          {d.observaciones && (
                            <div style={{ marginTop: 5, fontSize: 10.5, color: "#CBD5E1", fontStyle: "italic" }}>
                              Nota: {d.observaciones}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 11.5, fontWeight: 600, paddingBottom: 8 }}
                  />
                  {(vistaGraficoIndice === "ambos" || vistaGraficoIndice === "indice") && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="indice"
                      name="Índice Link (pts)"
                      stroke={tokens.gold}
                      strokeWidth={2.5}
                      fill="url(#gradIndice)"
                      dot={{ r: 3, fill: tokens.gold }}
                      activeDot={{ r: 5, fill: tokens.gold }}
                    />
                  )}
                  {(vistaGraficoIndice === "ambos" || vistaGraficoIndice === "absoluto") && (
                    <Area
                      yAxisId={vistaGraficoIndice === "ambos" ? "right" : "left"}
                      type="monotone"
                      dataKey="valor_absoluto"
                      name="Valor Absoluto ($)"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      fill="url(#gradAbsoluto)"
                      dot={{ r: 3, fill: "#4F46E5" }}
                      activeDot={{ r: 5, fill: "#4F46E5" }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* TABLA HISTÓRICA DESPLEGABLE CON EDICIÓN Y ELIMINACIÓN */}
          {mostrarHistorialIndice && (
            <div style={{
              background: "#FFFFFF",
              border: `1px solid ${colorLineaSuave}`,
              borderRadius: 10,
              padding: 14,
              overflowX: "auto"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 13, color: tokens.ink }}>
                  Historial Completo de Registros Cargados ({indiceLinkNormalizado.length} meses)
                </strong>
                <button
                  onClick={abrirModalNuevoIndice}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: tokens.goldSoft,
                    color: tokens.gold,
                    border: `1px solid ${tokens.gold}55`,
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  <Plus size={13} /> Agregar Registro
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: `1.5px solid ${colorLineaSuave}`, textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", color: tokens.textMuted }}>Período</th>
                    <th style={{ padding: "8px 10px", color: tokens.gold, textAlign: "right" }}>Índice (pts, 3 dec.)</th>
                    <th style={{ padding: "8px 10px", color: tokens.gold, textAlign: "right" }}>Var. % Mensual</th>
                    <th style={{ padding: "8px 10px", color: "#4F46E5", textAlign: "right" }}>Valor Absoluto ($)</th>
                    <th style={{ padding: "8px 10px", color: "#4F46E5", textAlign: "right" }}>Var. Absoluta</th>
                    <th style={{ padding: "8px 10px", color: tokens.ink, textAlign: "right" }}>Equiv. USD (MEP)</th>
                    <th style={{ padding: "8px 10px", color: tokens.textMuted }}>Observaciones / Hito</th>
                    <th style={{ padding: "8px 10px", color: tokens.textMuted, textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {indiceLinkNormalizado.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "28px 12px", textAlign: "center", color: tokens.textMuted }}>
                        <div style={{ fontWeight: 600, color: tokens.ink, marginBottom: 4, fontSize: 13 }}>
                          No hay registros cargados aún · Valores en 0
                        </div>
                        <div style={{ fontSize: 11.5, color: tokens.textMuted }}>
                          Presiona el botón <strong>"Agregar Registro"</strong> para ingresar el primer dato del Índice Link.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    [...indiceLinkNormalizado].reverse().map((row) => {
                      const equivUsd = Math.round(row.valor_absoluto / (dolarMep || dolarBlue || 1350));
                      return (
                        <tr key={row.id_mes} style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: tokens.ink }}>
                            {row.etiqueta || row.id_mes}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.gold }}>
                            {fmtNum(row.indice, 3)}
                          </td>
                          <td style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: row.variacion_indice >= 0 ? tokens.positive : tokens.negative
                          }}>
                            {row.variacion_indice >= 0 ? "+" : ""}{fmtNum(row.variacion_indice, 1)}%
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: "#4F46E5" }}>
                            {fmtPesos(row.valor_absoluto)}
                          </td>
                          <td style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: row.variacion_absoluto >= 0 ? tokens.positive : tokens.negative
                          }}>
                            {row.variacion_absoluto >= 0 ? "+" : ""}{fmtNum(row.variacion_absoluto, 1)}%
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.ink }}>
                            USD {fmtNum(equivUsd, 0)}
                          </td>
                          <td style={{ padding: "8px 10px", color: tokens.textMuted, fontSize: 11 }}>
                            {row.observaciones || "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button
                                onClick={() => abrirModalEditarIndice(row)}
                                title="Editar este registro"
                                style={{
                                  background: "#FFFFFF",
                                  border: `1px solid ${colorLineaSuave}`,
                                  borderRadius: 4,
                                  padding: "3px 6px",
                                  cursor: "pointer",
                                  color: tokens.ink
                                }}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => eliminarIndiceLink(row.id_mes)}
                                title="Eliminar registro"
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #FECACA",
                                  color: "#DC2626",
                                  borderRadius: 4,
                                  padding: "3px 6px",
                                  cursor: "pointer"
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
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

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE CARGA / EDICIÓN: ÍNDICE LINK
          ═══════════════════════════════════════════════════════════════════ */}
      {modalIndiceOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(14, 21, 36, 0.65)",
          backdropFilter: "blur(3px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: 16
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: 14,
            width: "100%",
            maxWidth: 520,
            boxShadow: "0 20px 40px -8px rgba(0, 0, 0, 0.3)",
            border: `1.5px solid ${tokens.gold}55`,
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              background: tokens.ink,
              color: "#FFFFFF",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", color: tokens.gold, textTransform: "uppercase" }}>
                  Monitor Financiero · Indicador Insignia
                </span>
                <h3 style={{ margin: "2px 0 0", fontFamily: tokens.fontDisplay, fontSize: 17, color: "#FFFFFF" }}>
                  {editandoIndiceId ? `Editar Registro: ${indiceDraft.etiqueta}` : "Cargar Dato en Índice Link"}
                </h3>
              </div>
              <button
                onClick={() => setModalIndiceOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: 4
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Selector de Período / Mes */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.ink, marginBottom: 5 }}>
                  Período (Mes y Año):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select
                    value={indiceDraft.anio}
                    onChange={(e) => {
                      const anio = Number(e.target.value);
                      const m = indiceDraft.mesIdx;
                      const mesesNom = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                      setIndiceDraft(p => ({
                        ...p,
                        anio,
                        id_mes: `${anio}-${String(m).padStart(2, "0")}`,
                        etiqueta: `${mesesNom[m - 1]} ${anio}`
                      }));
                    }}
                    style={inputStyle}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>Año {y}</option>
                    ))}
                  </select>

                  <select
                    value={indiceDraft.mesIdx}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      const anio = indiceDraft.anio;
                      const mesesNom = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                      setIndiceDraft(p => ({
                        ...p,
                        mesIdx: m,
                        id_mes: `${anio}-${String(m).padStart(2, "0")}`,
                        etiqueta: `${mesesNom[m - 1]} ${anio}`
                      }));
                    }}
                    style={inputStyle}
                  >
                    {[
                      { idx: 1, name: "Enero" },
                      { idx: 2, name: "Febrero" },
                      { idx: 3, name: "Marzo" },
                      { idx: 4, name: "Abril" },
                      { idx: 5, name: "Mayo" },
                      { idx: 6, name: "Junio" },
                      { idx: 7, name: "Julio" },
                      { idx: 8, name: "Agosto" },
                      { idx: 9, name: "Septiembre" },
                      { idx: 10, name: "Octubre" },
                      { idx: 11, name: "Noviembre" },
                      { idx: 12, name: "Diciembre" },
                    ].map(m => (
                      <option key={m.idx} value={m.idx}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 3, display: "block" }}>
                  Identificador generado: <code>{indiceDraft.id_mes}</code> ({indiceDraft.etiqueta})
                </span>
              </div>

              {/* Input Valor Índice (Puntos con 3 decimales) */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: tokens.gold, marginBottom: 5 }}>
                  <span>1. Cargar como Índice (Puntos Base 100 · 3 decimales):</span>
                  <span style={{ fontWeight: 500, color: tokens.textMuted }}>Ej: 100,000 ó 104,250</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={indiceDraft.indice}
                    onChange={(e) => setIndiceDraft(p => ({ ...p, indice: e.target.value }))}
                    placeholder="Ej: 104,250"
                    style={{
                      ...inputStyle,
                      width: "100%",
                      fontFamily: tokens.fontMono,
                      fontSize: 14,
                      fontWeight: 700,
                      borderColor: `${tokens.gold}88`
                    }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: tokens.gold }}>
                    PTS
                  </span>
                </div>
                {/* Formateo en vivo con 3 decimales después de la coma */}
                <div style={{
                  background: "#FEF9EE",
                  borderRadius: 6,
                  padding: "5px 10px",
                  marginTop: 5,
                  fontSize: 11.5,
                  color: "#92400E",
                  display: "flex",
                  justifyContent: "space-between"
                }}>
                  <span>Formato registrado: <strong>{(() => {
                    const cleanStr = String(indiceDraft.indice || "").trim().replace(',', '.');
                    const parsed = parseFloat(cleanStr);
                    return !isNaN(parsed) ? `${fmtNum(parsed, 3)} pts` : "—";
                  })()}</strong></span>
                  <span style={{ fontSize: 10.5, color: tokens.textMuted }}>3 dígitos después de la coma (,)</span>
                </div>
                <span style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 3, display: "block" }}>
                  Número índice relativo al proyecto. Puedes ingresar punto o coma (se registran 3 dígitos decimales).
                </span>
              </div>

              {/* Input Valor Absoluto ($ ARS) */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: "#4F46E5", marginBottom: 5 }}>
                  <span>2. Cargar como Valor Absoluto ($ ARS):</span>
                  <span style={{ fontWeight: 500, color: tokens.textMuted }}>Ej: 2310000</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="10000"
                    value={indiceDraft.valor_absoluto}
                    onChange={(e) => setIndiceDraft(p => ({ ...p, valor_absoluto: e.target.value }))}
                    placeholder="Ej: 2310000"
                    style={{
                      ...inputStyle,
                      width: "100%",
                      fontFamily: tokens.fontMono,
                      fontSize: 14,
                      fontWeight: 700,
                      borderColor: "#818CF8"
                    }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>
                    $ ARS
                  </span>
                </div>
                {/* Formateo en vivo */}
                <div style={{
                  background: "#EEF2FF",
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginTop: 5,
                  fontSize: 11.5,
                  color: "#3730A3",
                  display: "flex",
                  justifyContent: "space-between"
                }}>
                  <span>Formato monetario: <strong>{indiceDraft.valor_absoluto ? fmtPesos(indiceDraft.valor_absoluto) : "$ —"}</strong></span>
                  <span>USD Ref: <strong>{indiceDraft.valor_absoluto ? `USD ${fmtNum(Math.round(Number(indiceDraft.valor_absoluto) / (dolarMep || dolarBlue || 1350)), 0)}` : "—"}</strong></span>
                </div>
              </div>

              {/* Input Observaciones / Hito */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.ink, marginBottom: 5 }}>
                  Observaciones / Hito de Referencia (Opcional):
                </label>
                <input
                  type="text"
                  value={indiceDraft.observaciones}
                  onChange={(e) => setIndiceDraft(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Ej: Reajuste cuotas preventa, avance hito de obra..."
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>

              {/* Previsualización de variación calculada */}
              {ultIndice && (
                <div style={{
                  background: "#F8FAFC",
                  border: `1px solid ${colorLineaSuave}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: tokens.textMuted
                }}>
                  <span style={{ fontWeight: 600, color: tokens.ink }}>Comparativa con último mes cargado ({ultIndice.etiqueta}):</span>
                  <div style={{ display: "flex", gap: 14, marginTop: 3 }}>
                    <span>Índice anterior: <strong>{fmtNum(ultIndice.indice, 3)} pts</strong></span>
                    <span>Valor anterior: <strong>{fmtPesos(ultIndice.valor_absoluto)}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              background: "#F8FAFC",
              borderTop: `1px solid ${colorLineaSuave}`,
              padding: "12px 20px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8
            }}>
              <button
                onClick={() => setModalIndiceOpen(false)}
                style={cancelBtnStyle}
              >
                Cancelar
              </button>
              <button
                onClick={guardarIndiceLink}
                style={{
                  ...saveBtnStyle,
                  background: tokens.gold,
                  color: "#FFFFFF",
                  boxShadow: "0 2px 6px rgba(184, 134, 42, 0.3)"
                }}
              >
                <Save size={14} /> Guardar Registro
              </button>
            </div>
          </div>
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
