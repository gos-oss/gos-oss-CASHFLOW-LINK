import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseConfigured, configuredSupabaseUrl, getLocalStoreData } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import CargarMovimiento from "./CargarMovimiento";
import CategoryManager from "./CategoryManager";
import IndicadoresFinancierosTab from "./IndicadoresFinancierosTab";
import MotorFinancieroTab from "./MotorFinancieroTab";
import ImportadorMatrizExcel from "./ImportadorMatrizExcel";
import ImportadorPresupuestoExcel from "./ImportadorPresupuestoExcel";
import { tokens, fontImport } from "./tokens";
import { BASE_INCOME, BASE_EXPENSE, slugify, discoverCategories } from "./categories";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, BarChart, Bar, LabelList
} from "recharts";
import {
  Wallet, CalendarX2, AlertTriangle, Save, Settings,
  ListChecks, Tag, SlidersHorizontal, Compass, CalendarRange,
  ChevronDown, ChevronRight, BarChart3, Pencil, Link as LinkIcon, Trash2,
  CalendarDays, Calendar, Scale, Percent, TrendingDown, TrendingUp, DollarSign, Activity, Wand2, RotateCcw, Upload,
  Cpu, Building2, Users, HardHat, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Clock
} from "lucide-react";

// =========================================================================
// CATEGORÍAS FIJAS DEL PRESUPUESTO ANUAL
// =========================================================================
const PLAN_INCOME_CATS = [
  { key: "custom_cupos-socios", label: "Cupos Socios" },
  { key: "custom_cuotas-mensuales", label: "Cuotas Mensuales" },
  { key: "custom_ventas-cdo", label: "Ventas CDO" },
  { key: "custom_pesa", label: "PESA" },
  { key: "custom_aportes", label: "Aportes" }
];

// Proyectos individuales — desglosados para poder simular cada uno por separado
// (activar/desactivar). Superset de los proyectos vistos en los presupuestos
// 2026 y 2027; un proyecto en $0 en un año simplemente no tuvo actividad ese año.
const PLAN_PROJECT_CATS = [
  { key: "proy_torre-blue", label: "Torre Blue", group: "proyectos" },
  { key: "proy_zoe", label: "Zoe", group: "proyectos" },
  { key: "proy_torre-red", label: "Torre Red", group: "proyectos" },
  { key: "proy_isaura", label: "Isaura", group: "proyectos" },
  { key: "proy_duo", label: "DUO", group: "proyectos" },
  { key: "proy_300", label: "#300", group: "proyectos" },
  { key: "proy_boulevard", label: "Boulevard", group: "proyectos" },
  { key: "proy_torre-green", label: "Torre Green", group: "proyectos" },
  { key: "proy_mas-duo", label: "+DUO", group: "proyectos" },
  { key: "proy_auria", label: "Auria", group: "proyectos" },
  { key: "proy_neuquen", label: "Neuquén", group: "proyectos" },
  { key: "proy_300-t3-am", label: "#300 - T3 + AM", group: "proyectos" },
  { key: "proy_300-t4-am", label: "#300 - T4 + AM", group: "proyectos" },
];

const PLAN_EXPENSE_CATS = [
  ...PLAN_PROJECT_CATS,
  { key: "custom_rrhh", label: "RRHH" },
  { key: "custom_administracion", label: "Gastos de Estructura" },
  { key: "custom_inversiones", label: "Inversiones" },
  { key: "custom_pasivos-financieros", label: "Pasivos Financieros" }
];

const DEFAULT_PLAN_2026 = {
  "ingreso": {
    "custom_cupos-socios": { "01": 188542320, "02": 188542320, "03": 188542320, "04": 188542320, "05": 188542320, "06": 188542320, "07": 233273820, "08": 233273820, "09": 233273820, "10": 233273820, "11": 233273820, "12": 233273820 },
    "custom_cuotas-mensuales": { "01": 216094107, "02": 210193927, "03": 207243837, "04": 208718882, "05": 210931449, "06": 221256765, "07": 166503716, "08": 394424755, "09": 391424755, "10": 138308206, "11": 135987535, "12": 120871098 },
    "custom_ventas-cdo": { "01": 471643593, "02": 477543773, "03": 480493863, "04": 479018818, "05": 179921317, "06": 217557504, "07": 214152451, "08": 271670000, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pesa": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 389439155, "06": 248923431, "07": 248923431, "08": 248923431, "09": 248923431, "10": 0, "11": 0, "12": 0 },
    "custom_aportes": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
  },
  "egreso": {
    "proy_torre-blue": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_zoe": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_torre-red": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_isaura": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_duo": { "01": 356384338, "02": 356384338, "03": 356384338, "04": 356384338, "05": 356384338, "06": 356384338, "07": 34161635, "08": 97952376, "09": 287148043, "10": 124680990, "11": 0, "12": 0 },
    "proy_300": { "01": 38681705, "02": 38936292, "03": 38457672, "04": 38651151, "05": 39700052, "06": 37021814, "07": 39231587, "08": 42846754, "09": 28987102, "10": 29403226, "11": 24324540, "12": 24226764 },
    "proy_boulevard": { "01": 59173435, "02": 57847286, "03": 54816315, "04": 64856703, "05": 53868840, "06": 45723403, "07": 94977865, "08": 20905253, "09": 21287090, "10": 43573541, "11": 84850271, "12": 105764448 },
    "proy_torre-green": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 22809604, "08": 0, "09": 15495939, "10": 14429867, "11": 9950226, "12": 19195745 },
    "proy_mas-duo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_auria": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_neuquen": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300-t3-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300-t4-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_rrhh": { "01": 369633317, "02": 397685053, "03": 441780756, "04": 358521345, "05": 475970162, "06": 331050035, "07": 536536134, "08": 513321326, "09": 648915774, "10": 551957302, "11": 520529781, "12": 548314385 },
    "custom_administracion": { "01": 71586530, "02": 80850508, "03": 103285984, "04": 151720670, "05": 167830241, "06": 233343182, "07": 242145502, "08": 290031520, "09": 243703467, "10": 257845660, "11": 226979694, "12": 118455502 },
    "custom_inversiones": { "01": 80318625, "02": 78125625, "03": 77029125, "04": 77577375, "05": 78399750, "06": 80592750, "07": 84736950, "08": 84736950, "09": 84736950, "10": 84736950, "11": 7236950, "12": 7236950 },
    "custom_pasivos-financieros": { "01": 57268446, "02": 55950406, "03": 55291386, "04": 55620896, "05": 73580581, "06": 75387164, "07": 79000330, "08": 79743600, "09": 79000330, "10": 79000330, "11": 79000330, "12": 79000330 },
  },
};

const DEFAULT_PLAN_2027 = {
  "ingreso": {
    "custom_cupos-socios": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_cuotas-mensuales": { "01": 113295831, "02": 109548122, "03": 105735735, "04": 105735735, "05": 105735735, "06": 102862746, "07": 97833898, "08": 97833898, "09": 93118900, "10": 92547465, "11": 90134803, "12": 78152291 },
    "custom_ventas-cdo": { "01": 390315770, "02": 390315770, "03": 390315770, "04": 390315770, "05": 390315770, "06": 390315770, "07": 390315770, "08": 390315770, "09": 390315770, "10": 390315770, "11": 390315770, "12": 390315770 },
    "custom_pesa": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_aportes": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
  },
  "egreso": {
    "proy_torre-blue": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_zoe": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_torre-red": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_isaura": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_duo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300": { "01": 53971119, "02": 53971119, "03": 53971119, "04": 53971119, "05": 53971119, "06": 53971119, "07": 53971119, "08": 53971119, "09": 53971119, "10": 53971119, "11": 53971119, "12": 53971119 },
    "proy_boulevard": { "01": 49310786, "02": 49310786, "03": 49310786, "04": 49310786, "05": 49310786, "06": 49310786, "07": 49310786, "08": 49310786, "09": 49310786, "10": 49310786, "11": 49310786, "12": 49310786 },
    "proy_torre-green": { "01": 98677049, "02": 113702887, "03": 129229704, "04": 144607225, "05": 159025595, "06": 171576771, "07": 181354017, "08": 187576483, "09": 189713411, "10": 187576483, "11": 181354017, "12": 171576771 },
    "proy_mas-duo": { "01": 98478147, "02": 117909833, "03": 140378962, "04": 166008889, "05": 194764406, "06": 226384076, "07": 260311146, "08": 295636652, "09": 331073836, "10": 364985593, "11": 395482916, "12": 420599617 },
    "proy_auria": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 66154138, "07": 72791702, "08": 87154944, "09": 103763361, "10": 122708132, "11": 143963235, "12": 167335421 },
    "proy_neuquen": { "01": 30800000, "02": 30800000, "03": 30800000, "04": 30800000, "05": 30800000, "06": 30800000, "07": 30800000, "08": 30800000, "09": 30800000, "10": 30800000, "11": 30800000, "12": 30800000 },
    "proy_300-t3-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300-t4-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_rrhh": { "01": 153057632, "02": 153057632, "03": 153057632, "04": 153057632, "05": 153057632, "06": 225235269, "07": 153057632, "08": 153057632, "09": 153057632, "10": 153057632, "11": 153057632, "12": 225235269 },
    "custom_administracion": { "01": 75823555, "02": 77735191, "03": 104923165, "04": 62331384, "05": 64823445, "06": 63288876, "07": 65688928, "08": 73798986, "09": 71080744, "10": 68281956, "11": 70245627, "12": 71023809 },
    "custom_inversiones": { "01": 7187180, "02": 7187180, "03": 7187180, "04": 7187180, "05": 7187180, "06": 7187180, "07": 7187180, "08": 7187180, "09": 7187180, "10": 7187180, "11": 7187180, "12": 7187180 },
    "custom_pasivos-financieros": { "01": 59222933, "02": 50889518, "03": 50888404, "04": 50745203, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
  },
};

const colorTablaBg = "#F4F6F8";       
const colorLineaSuave = "#DCE1E8";    
const colorLineaFuerte = "#C2CAD4";   
const colorTotalBg = "#E6EAEE";       
const colorHover = "#DEE3E9";         

const globalStyles = `
  ${fontImport}
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: ${tokens.paper}; }
  #root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; width: 100vw !important; overflow-x: hidden; }
  ::-webkit-scrollbar { height: 8px; width: 8px; }
  ::-webkit-scrollbar-track { background: ${tokens.ruleSoft}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb { background: ${tokens.rule}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #B9BEB3; }
  
  .table-container { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 190px); }
  .flujo-table thead th { position: sticky; top: 0; z-index: 10; box-shadow: inset 0 -1px 0 ${colorLineaFuerte}; }
  .flujo-table thead tr:nth-child(2) th { top: 36px; }
  .flujo-table thead th.sticky-col { z-index: 12 !important; }

  .flujo-table th, .flujo-table td { border-right: 1px solid ${colorLineaSuave}; }
  .flujo-table th:last-child, .flujo-table td:last-child { border-right: none; }
  .flujo-row:hover td { background: ${colorHover} !important; transition: background 0.15s; }
  
  .sticky-col { position: sticky; left: 0; z-index: 2; box-shadow: 3px 0 6px -3px rgba(14,21,36,0.08); }
  .nav-item { transition: background 0.15s ease, color 0.15s ease; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${tokens.gold}; outline-offset: 1px; }
  .draggable-chip:hover { transform: scale(1.05); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  
  .plan-input {
    width: 100%; min-width: 80px; padding: 6px; border: 1px solid ${tokens.rule}; 
    border-radius: 4px; font-family: ${tokens.fontMono}; font-size: 11.5px; text-align: right;
    outline: none; transition: border-color 0.2s;
  }
  .plan-input:focus { border-color: ${tokens.gold}; }
  
  .map-select {
    width: 100%; padding: 8px 10px; border: 1px solid ${tokens.rule}; border-radius: 4px;
    font-family: ${tokens.fontBody}; font-size: 12px; background: #fff; outline: none;
  }
  
  .custom-pie-tooltip {
    background: #fff; border: 1px solid ${colorLineaFuerte}; border-radius: 6px; 
    padding: 8px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-family: ${tokens.fontBody};
  }
  
  .recharts-legend-item-text { color: #94A3B8 !important; }

  /* ESTILOS PARA LAS BARRITAS DEL SIMULADOR */
  .sim-slider {
    -webkit-appearance: none; width: 100%; height: 5px; border-radius: 3px; background: #DCE1E8; outline: none; cursor: pointer;
  }
  .sim-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${tokens.gold}; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .sim-slider:active::-webkit-slider-thumb { transform: scale(1.2); }
`;

const formatDate = (isoStr) => {
  if (!isoStr || !isoStr.includes("-")) return isoStr;
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const todayISO = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

// DATOS BASE EXACTOS (Coincidentes con la captura del usuario: $124.596.986 Liquidez, 13 Días de Caja, Arqueo al 16/09/2026)
const DEFAULT_REAL_ARQUEOS = [
  {
    id: "arqueo_2026-09-16",
    fecha_corte: "2026-09-16",
    saldo_efectivo: 0,
    saldo_banco: 124596986,
    tipo_cambio: 1250
  },
  {
    id: "tc_2026-09-16",
    fecha_corte: "2026-09-16",
    saldo_efectivo: 1250,
    saldo_banco: 0,
    tipo_cambio: 1250
  }
];

const DEFAULT_REAL_WEEKS = [
  {
    id: "2026-09-16",
    week_start: "2026-09-16",
    status: "real",
    income: {},
    expense: {}
  },
  {
    id: "2026-09-17",
    week_start: "2026-09-17",
    status: "proyectado",
    income: {
      cobranzasCuotas: { ars: 0, usd: 0 }
    },
    expense: {
      mensuales: { ars: 1621200, usd: 0 }
    }
  },
  {
    id: "2026-09-18",
    week_start: "2026-09-18",
    status: "proyectado",
    income: {
      cobranzasCuotas: { ars: 0, usd: 0 }
    },
    expense: {
      cargasSociales: { ars: 54084835, usd: 0 },
      quincenaObra: { ars: 83753208, usd: 0 },
      planesImpuestos: { ars: 30178, usd: 0 },
      tarjetas: { ars: 772400, usd: 0 },
      externos: { ars: 20956000, usd: 0 },
      seguros: { ars: 4645351, usd: 0 },
      mensuales: { ars: 6161166, usd: 0 },
      rentaAnticipada: { ars: 10174716, usd: 0 }
    }
  },
  {
    id: "2026-09-21",
    week_start: "2026-09-21",
    status: "proyectado",
    income: {
      cobranzasCuotas: { ars: 0, usd: 0 }
    },
    expense: {
      externos: { ars: 10446337, usd: 0 },
      mensuales: { ars: 618060, usd: 0 }
    }
  },
  {
    id: "2026-09-22",
    week_start: "2026-09-22",
    status: "proyectado",
    income: {
      cobranzasCuotas: { ars: 0, usd: 0 }
    },
    expense: {
      planesImpuestos: { ars: 18998, usd: 0 },
      mensuales: { ars: 746201, usd: 0 }
    }
  },
  {
    id: "2026-09-23",
    week_start: "2026-09-23",
    status: "proyectado",
    income: {
      cobranzasCuotas: { ars: 0, usd: 0 }
    },
    expense: {
      mensuales: { ars: 1092570, usd: 0 }
    }
  },
  {
    id: "2026-09-28",
    week_start: "2026-09-28",
    status: "proyectado",
    income: { cuposNeuquen: { ars: 25000000, usd: 0 } },
    expense: { contratistas: { ars: 98000000, usd: 0 }, planesImpuestos: { ars: 42000000, usd: 0 } }
  },
  {
    id: "2026-09-29",
    week_start: "2026-09-29",
    status: "proyectado",
    income: { otrosIngresos: { ars: 0, usd: 0 } },
    expense: { contratistas: { ars: 65000000, usd: 0 } }
  },
  {
    id: "2026-10-01",
    week_start: "2026-10-01",
    status: "proyectado",
    income: { cobranzasCuotas: { ars: 20000000, usd: 0 } },
    expense: { contratistas: { ars: 55000000, usd: 0 }, sueldosOficina: { ars: 32000000, usd: 0 } }
  },
  {
    id: "2026-10-16",
    week_start: "2026-10-16",
    status: "proyectado",
    income: { posiblesVentas: { ars: 35000000, usd: 0 } },
    expense: { contratistas: { ars: 48000000, usd: 0 } }
  },
  {
    id: "2026-11-30",
    week_start: "2026-11-30",
    status: "proyectado",
    income: { cobranzasCuotas: { ars: 15000000, usd: 0 } },
    expense: { chequesEmitidos: { ars: 45000000, usd: 0 } }
  }
];

// NAVEGACIÓN
const NAV = [
  { id: "resumen", label: "Resumen", icon: Compass },
  { id: "motor", label: "Motor Financiero", icon: Cpu },
  { id: "presupuesto", label: "Presupuesto Anual", icon: BarChart3 },
  { id: "movimientos", label: "Movimientos", icon: ListChecks },
  { id: "monitor", label: "Monitor Económico", icon: Activity },
  { id: "conceptos", label: "Conceptos", icon: Tag },
  { id: "configuracion", label: "Configuración", icon: SlidersHorizontal },
];

export default function App() {
  const [weeks, setWeeks] = useState([]);
  const [planesFondos, setPlanesFondos] = useState({});
  const [mapping, setMapping] = useState({ ingreso: {}, egreso: {} });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resumen");
  
  const [mostrarPanel, setMostrarPanel] = useState(true);
  const [mostrarImportadorMatriz, setMostrarImportadorMatriz] = useState(false);
  const [movimientoAEditar, setMovimientoAEditar] = useState(null); 

  const [arqueosList, setArqueosList] = useState([]);
  const [saldoEfectivo, setSaldoEfectivo] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");
  const [fechaSaldo, setFechaSaldo] = useState(todayISO());

  const [tcList, setTcList] = useState([]);
  const [fechaTC, setFechaTC] = useState(todayISO());
  const [valorTC, setValorTC] = useState("");
  const [vistaMonitor, setVistaMonitor] = useState("nativo");
  const [liveDolarQuotes, setLiveDolarQuotes] = useState([]);
  const [testSupabaseStatus, setTestSupabaseStatus] = useState(null);
  const [probandoSupabase, setProbandoSupabase] = useState(false);

  const getTC = useCallback((date) => {
    if (!tcList || tcList.length === 0) return 1;
    const validTCs = tcList.filter(t => t.fecha_corte <= date).sort((a, b) => b.fecha_corte.localeCompare(a.fecha_corte));
    return validTCs.length > 0 ? Number(validTCs[0].saldo_efectivo) || 1 : 1;
  }, [tcList]);

  const handleSyncTCFromMonitor = async (valor, label = "Dólar") => {
    if (!valor) return;
    const hoy = todayISO();
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: "tc_" + hoy,
      fecha_corte: hoy,
      saldo_efectivo: Number(valor),
      saldo_banco: 0,
      tipo_cambio: Number(valor),
    });
    if (error) {
      alert("Error al sincronizar Tipo de Cambio: " + error.message);
    } else {
      setValorTC(valor);
      setFechaTC(hoy);
      fetchData();
    }
  };

  useEffect(() => {
    fetchData();
    // Obtener cotizaciones del dólar para atajos rápidos
    fetch("https://dolarapi.com/v1/dolares")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setLiveDolarQuotes(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (fechaSaldo) {
      const existing = arqueosList.find(a => a.fecha_corte === fechaSaldo);
      if (existing) {
        setSaldoEfectivo(existing.saldo_efectivo); setSaldoBanco(existing.saldo_banco);
      } else {
        setSaldoEfectivo(""); setSaldoBanco("");
      }
    }
  }, [fechaSaldo, arqueosList]);

  useEffect(() => {
    if (fechaTC) {
      const existing = tcList.find(t => t.fecha_corte === fechaTC);
      if (existing) setValorTC(existing.saldo_efectivo);
      else setValorTC("");
    }
  }, [fechaTC, tcList]);

  const fetchData = async () => {
    let { data: wData } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    let { data: sData } = await supabase.from("cashflow_settings").select("*");
    
    // Solo si la base está completamente vacía (primera inicialización de la historia),
    // cargamos la semilla inicial de ejemplo. Nunca sobreescribimos si ya existen semanas.
    if (!wData || wData.length === 0) {
      await supabase.from("cashflow_weeks").upsert(DEFAULT_REAL_WEEKS);
      wData = [...DEFAULT_REAL_WEEKS];
      
      await supabase.from("cashflow_settings").upsert(DEFAULT_REAL_ARQUEOS);
      sData = [...(sData || []).filter(s => !s.id.startsWith("arqueo_2026-08")), ...DEFAULT_REAL_ARQUEOS];
    }

    if (wData) setWeeks(wData);
    
    if (sData) {
      setArqueosList(sData.filter(s => s.id.startsWith("arqueo_") || s.id === "general"));
      setTcList(sData.filter(s => s.id.startsWith("tc_")));
    }

    const { data: pData } = await supabase.from("cashflow_plan").select("*");
    if (pData) {
      const mapRow = pData.find(r => r.id === "mapping");
      if (mapRow) setMapping(mapRow.data || { ingreso: {}, egreso: {} });

      let planesTemporales = {};
      pData.forEach(r => { if (r.id !== "mapping") planesTemporales[r.id] = r.data; });

      // Migración: si el 2026 todavía tiene el esquema viejo (Proyectos como una sola fila
      // agregada, sin desglose por proyecto individual), lo reemplaza por los datos reales
      // ya desglosados. Una vez migrado (existe "proy_duo"), no se vuelve a tocar.
      const necesitaMigracion2026 = !planesTemporales["2026"]
        || !planesTemporales["2026"].egreso
        || !planesTemporales["2026"].egreso["proy_duo"];
      if (necesitaMigracion2026) {
        planesTemporales["2026"] = DEFAULT_PLAN_2026;
        await supabase.from("cashflow_plan").upsert({ id: "2026", data: DEFAULT_PLAN_2026 });
      }

      if (!planesTemporales["2027"] || !planesTemporales["2027"].egreso || !planesTemporales["2027"].egreso["proy_neuquen"]) {
        planesTemporales["2027"] = DEFAULT_PLAN_2027;
        await supabase.from("cashflow_plan").upsert({ id: "2027", data: DEFAULT_PLAN_2027 });
      }

      setPlanesFondos(planesTemporales);
    } else {
      setPlanesFondos({ "2026": DEFAULT_PLAN_2026, "2027": DEFAULT_PLAN_2027 });
      await supabase.from("cashflow_plan").upsert({ id: "2026", data: DEFAULT_PLAN_2026 });
      await supabase.from("cashflow_plan").upsert({ id: "2027", data: DEFAULT_PLAN_2027 });
    }
    setLoaded(true);
  };

  const guardarSaldos = async () => {
    if (!fechaSaldo) return alert("Seleccioná una fecha para el arqueo.");
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: "arqueo_" + fechaSaldo, fecha_corte: fechaSaldo, saldo_efectivo: Number(saldoEfectivo) || 0, saldo_banco: Number(saldoBanco) || 0,
    });
    if (error) alert("Error al guardar arqueo: " + error.message);
    else { alert(`¡Arqueo guardado!`); fetchData(); }
  };

  const eliminarArqueo = async (id) => {
    if (!window.confirm("¿Eliminar este arqueo?")) return;
    await supabase.from("cashflow_settings").delete().eq("id", id);
    fetchData();
  };

  const guardarTC = async () => {
    if (!fechaTC || !valorTC) return alert("Seleccioná una fecha y un valor para el Tipo de Cambio.");
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: "tc_" + fechaTC, fecha_corte: fechaTC, saldo_efectivo: Number(valorTC), saldo_banco: 0,
    });
    if (error) alert("Error al guardar TC: " + error.message);
    else { alert(`¡Tipo de Cambio guardado!`); fetchData(); }
  };

  const eliminarTC = async (id) => {
    if (!window.confirm("¿Eliminar este Tipo de Cambio?")) return;
    await supabase.from("cashflow_settings").delete().eq("id", id);
    fetchData();
  };

  const guardarPlanDeFondos = async (nuevoPlan, year) => {
    setPlanesFondos(prev => ({ ...prev, [year]: nuevoPlan }));
    await supabase.from("cashflow_plan").upsert({ id: year, data: nuevoPlan });
  };

  const guardarMapeo = async (nuevoMapeo) => {
    setMapping(nuevoMapeo);
    await supabase.from("cashflow_plan").upsert({ id: "mapping", data: nuevoMapeo });
    alert("Mapeo actualizado.");
  };

  const handleImportarSemanas = async (semanasNuevas) => {
    await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    fetchData();
  };

  const handleImportarMatrizExcel = async ({ semanas, saldoInicial, fechaSaldoInicial }) => {
    if (saldoInicial !== null && saldoInicial !== undefined && fechaSaldoInicial) {
      await supabase.from("cashflow_settings").upsert({
        id: "arqueo_" + fechaSaldoInicial,
        fecha_corte: fechaSaldoInicial,
        saldo_efectivo: 0,
        saldo_banco: Number(saldoInicial) || 0,
        tipo_cambio: 1250
      });
    }
    if (semanas && semanas.length > 0) {
      await supabase.from("cashflow_weeks").upsert(semanas);
    }
    await fetchData();
  };

  const handleBorrarDatos = async () => {
    if (!window.confirm("¿Borrar proyecciones?")) return;
    await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    fetchData();
  };

  const handleBorrarAnteriores2026 = async () => {
    if (!window.confirm("¿Confirmas eliminar permanentemente todos los movimientos y semanas anteriores al año 2026?")) return;
    try {
      await supabase.from("cashflow_weeks").delete().lt("week_start", "2026-01-01");
      // Limpiar también del localStorage si quedaron remanentes
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const raw = window.localStorage.getItem("cf_mock_cashflow_weeks");
          if (raw) {
            const parsed = JSON.parse(raw);
            const filtrados = parsed.filter(w => (w.week_start || "") >= "2026-01-01");
            window.localStorage.setItem("cf_mock_cashflow_weeks", JSON.stringify(filtrados));
          }
        } catch(e) {}
      }
      await fetchData();
      alert("Se han eliminado exitosamente todos los datos y semanas anteriores al año 2026.");
    } catch(err) {
      console.error(err);
      alert("Error al eliminar datos anteriores a 2026: " + err.message);
    }
  };

  const handleBorrarAnterioresAHoy = async () => {
    const hoy = todayISO();
    if (!window.confirm(`¿Confirmas eliminar permanentemente los movimientos históricos anteriores al día de la fecha (${formatDate(hoy)})?\n\nEl saldo acumulado actual se preservará automáticamente como saldo de apertura de hoy.`)) return;
    try {
      const anteriores = procesadas.filter(w => w.week_start < hoy);
      const saldoPrevio = anteriores.length ? anteriores[anteriores.length - 1].saldoAcumulado : 0;
      
      await supabase.from("cashflow_settings").upsert({
        id: "arqueo_" + hoy,
        fecha_corte: hoy,
        saldo_efectivo: 0,
        saldo_banco: Math.round(saldoPrevio),
        tipo_cambio: getTC(hoy)
      });

      await supabase.from("cashflow_weeks").delete().lt("week_start", hoy);

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const raw = window.localStorage.getItem("cf_mock_cashflow_weeks");
          if (raw) {
            const parsed = JSON.parse(raw);
            const filtrados = parsed.filter(w => (w.week_start || "") >= hoy);
            window.localStorage.setItem("cf_mock_cashflow_weeks", JSON.stringify(filtrados));
          }
        } catch(e) {}
      }

      await fetchData();
      alert(`Se han purgado exitosamente los movimientos anteriores a ${formatDate(hoy)}. El flujo ahora arranca limpio desde el día de la fecha con saldo inicial de $ ${fmt(saldoPrevio)}.`);
    } catch(err) {
      console.error(err);
      alert("Error al purgar datos históricos: " + err.message);
    }
  };

  const handleSincronizarHaciaSupabase = async () => {
    try {
      const localWeeks = getLocalStoreData("cashflow_weeks");
      const localSettings = getLocalStoreData("cashflow_settings");
      const localPlan = getLocalStoreData("cashflow_plan");
      
      let totalMigrados = 0;
      if (localWeeks && localWeeks.length > 0) {
        await supabase.from("cashflow_weeks").upsert(localWeeks);
        totalMigrados += localWeeks.length;
      }
      if (localSettings && localSettings.length > 0) {
        await supabase.from("cashflow_settings").upsert(localSettings);
        totalMigrados += localSettings.length;
      }
      if (localPlan && localPlan.length > 0) {
        await supabase.from("cashflow_plan").upsert(localPlan);
        totalMigrados += localPlan.length;
      }

      await fetchData();
      alert(`¡Sincronización completada! Se verificaron y sincronizaron ${totalMigrados} registros hacia Supabase.`);
    } catch (e) {
      console.error(e);
      alert("Error al sincronizar: " + e.message);
    }
  };

  const ejecutarTestSupabase = async () => {
    setProbandoSupabase(true);
    setTestSupabaseStatus({ loading: true, msg: "Verificando conexión, lectura y guardado en Supabase..." });
    const inicio = performance.now();
    try {
      // 1. Probar lectura
      const { data: wData, error: wErr } = await supabase.from("cashflow_weeks").select("id").limit(1);
      if (wErr) throw new Error(`Lectura cashflow_weeks: ${wErr.message}`);

      const { data: sData, error: sErr } = await supabase.from("cashflow_settings").select("id").limit(1);
      if (sErr) throw new Error(`Lectura cashflow_settings: ${sErr.message}`);

      const { data: pData, error: pErr } = await supabase.from("cashflow_plan").select("id").limit(1);
      if (pErr) throw new Error(`Lectura cashflow_plan: ${pErr.message}`);

      // 2. Probar inserción / guardado (upsert) en tiempo real
      const testId = "test_ping_" + Date.now();
      const { error: upsertErr } = await supabase.from("cashflow_settings").upsert({
        id: testId,
        fecha_corte: new Date().toISOString().slice(0, 10),
        saldo_efectivo: 1,
        saldo_banco: 1,
        tipo_cambio: 1250
      });
      if (upsertErr) throw new Error(`Escritura en Supabase: ${upsertErr.message}`);

      // 3. Probar borrado del registro de prueba
      await supabase.from("cashflow_settings").delete().eq("id", testId);

      const duracionMs = Math.round(performance.now() - inicio);

      setTestSupabaseStatus({
        loading: false,
        success: true,
        duracionMs,
        msg: `¡Guardado confirmado! Se escribió, leyó y validó exitosamente un registro en Supabase en ${duracionMs} ms.`,
        timestamp: new Date().toLocaleTimeString(),
        stats: {
          weeks: weeks.length,
          settings: arqueosList.length + tcList.length,
          planes: Object.keys(planesFondos).length
        }
      });
    } catch (err) {
      setTestSupabaseStatus({
        loading: false,
        success: false,
        msg: `Error en la prueba de Supabase: ${err.message}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setProbandoSupabase(false);
    }
  };

  const handleRestaurarDatosImagen = async () => {
    // 1. Arqueo inicial al 16/09/2026: Saldo inicial para arrancar la serie (coincidente con captura: $124.596.986)
    await supabase.from("cashflow_settings").upsert({
      id: "arqueo_2026-09-16",
      fecha_corte: "2026-09-16",
      saldo_efectivo: 0,
      saldo_banco: 124596986,
      tipo_cambio: 1250
    });

    // 2. Tipo de cambio
    await supabase.from("cashflow_settings").upsert({
      id: "tc_2026-09-16",
      fecha_corte: "2026-09-16",
      saldo_efectivo: 1250,
      saldo_banco: 0,
      tipo_cambio: 1250
    });

    await supabase.from("cashflow_weeks").upsert(DEFAULT_REAL_WEEKS);
    await fetchData();
  };

  const guardarMovimiento = async ({ fecha, tipo, key, montoArs, montoUsd, estado, nota, fechasFuturas = [] }) => {
    const todasLasFechas = [fecha, ...(fechasFuturas || [])];
    const field = tipo === "ingreso" ? "income" : "expense";
    const updates = [];

    for (const f of todasLasFechas) {
      const base = weeks.find((w) => w.week_start === f) || { 
        id: f, 
        week_start: f, 
        status: f === fecha ? (estado || "proyectado") : "proyectado", 
        income: {}, 
        expense: {}, 
        notes: "" 
      };
      let currentNotes = {}; 
      try { currentNotes = JSON.parse(base.notes || "{}"); } catch(e) {}
      if (nota) currentNotes[`${tipo}_${key}`] = nota; 
      else delete currentNotes[`${tipo}_${key}`];

      const actualizada = { 
        ...base, 
        status: f === fecha ? (estado || base.status || "proyectado") : "proyectado", 
        income: { ...(base.income || {}) }, 
        expense: { ...(base.expense || {}) }, 
        notes: JSON.stringify(currentNotes) 
      };
      
      actualizada[field][key] = { ars: Number(montoArs) || 0, usd: Number(montoUsd) || 0 };
      updates.push(actualizada);
    }

    await supabase.from("cashflow_weeks").upsert(updates);
    await fetchData(); 
    return true;
  };

  const handleIncorporarSemanasFuturas = async (cantidadSemanas = 4) => {
    const ordenadas = [...weeks].sort((a,b) => a.week_start.localeCompare(b.week_start));
    const ultFecha = ordenadas.length > 0 ? ordenadas[ordenadas.length - 1].week_start : new Date().toISOString().slice(0, 10);
    const [y, m, d] = ultFecha.split("-").map(Number);
    
    const nuevasSemanas = [];
    for (let i = 1; i <= cantidadSemanas; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + (i * 7)));
      const fIso = dt.toISOString().slice(0, 10);
      if (!weeks.some(w => w.week_start === fIso)) {
        nuevasSemanas.push({
          id: fIso,
          week_start: fIso,
          status: "proyectado",
          income: {},
          expense: {},
          notes: "{}"
        });
      }
    }

    if (nuevasSemanas.length > 0) {
      await supabase.from("cashflow_weeks").upsert(nuevasSemanas);
      await fetchData();
    }
  };

  const eliminarMovimiento = async (fecha, tipo, key) => {
    const existente = weeks.find((w) => w.week_start === fecha); if (!existente) return;
    let currentNotes = {}; try { currentNotes = JSON.parse(existente.notes || "{}"); } catch(e) {}
    delete currentNotes[`${tipo}_${key}`];
    
    const actualizada = { ...existente, income: { ...(existente.income || {}) }, expense: { ...(existente.expense || {}) }, notes: JSON.stringify(currentNotes) };
    const field = tipo === "ingreso" ? "income" : "expense"; delete actualizada[field][key];
    await supabase.from("cashflow_weeks").upsert(actualizada); fetchData();
  };

  const moverMovimiento = async (origenFecha, destinoFecha, tipo, key, ars, usd) => {
    if (origenFecha === destinoFecha) return;
    const origen = weeks.find((w) => w.week_start === origenFecha);
    let notaMovida = null;
    if (origen) {
      let upOrigen = { ...origen, income: { ...(origen.income || {}) }, expense: { ...(origen.expense || {}) } };
      const field = tipo === "ingreso" ? "income" : "expense"; delete upOrigen[field][key];
      let origenNotes = {}; try { origenNotes = JSON.parse(origen.notes || "{}"); } catch(e) {}
      if (origenNotes[`${tipo}_${key}`]) { notaMovida = origenNotes[`${tipo}_${key}`]; delete origenNotes[`${tipo}_${key}`]; }
      upOrigen.notes = JSON.stringify(origenNotes); await supabase.from("cashflow_weeks").upsert(upOrigen);
    }
    const destino = weeks.find((w) => w.week_start === destinoFecha) || { id: destinoFecha, week_start: destinoFecha, status: "proyectado", income: {}, expense: {}, notes: "" };
    let upDestino = { ...destino, income: { ...(destino.income || {}) }, expense: { ...(destino.expense || {}) } };
    const field2 = tipo === "ingreso" ? "income" : "expense";
    const valDest = upDestino[field2][key];
    let dArs = 0, dUsd = 0;
    if (typeof valDest === 'object' && valDest !== null) { dArs = Number(valDest.ars || 0); dUsd = Number(valDest.usd || 0); } 
    else { dArs = Number(valDest || 0); }
    upDestino[field2][key] = { ars: dArs + Number(ars), usd: dUsd + Number(usd) };

    if (notaMovida) {
      let destinoNotes = {}; try { destinoNotes = JSON.parse(destino.notes || "{}"); } catch(e) {}
      destinoNotes[`${tipo}_${key}`] = notaMovida; upDestino.notes = JSON.stringify(destinoNotes);
    }
    await supabase.from("cashflow_weeks").upsert(upDestino); fetchData();
  };

  const agregarConcepto = async (grupo, label) => {
    const field = grupo === "ingreso" ? "income" : "expense";
    const key = "custom_" + slugify(label); const anchor = new Date().toISOString().slice(0, 10);
    const existente = weeks.find((w) => w.week_start === anchor);
    const base = existente || { id: anchor, week_start: anchor, status: "proyectado", income: {}, expense: {}, notes: "" };
    const actualizada = { ...base, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) } };
    if (actualizada[field][key] === undefined) actualizada[field][key] = { ars: 0, usd: 0 };
    await supabase.from("cashflow_weeks").upsert(actualizada); fetchData(); return true;
  };

  const renombrarConcepto = async (grupo, oldKey, newLabel) => {
    const field = grupo === "ingreso" ? "income" : "expense"; const newKey = "custom_" + slugify(newLabel);
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], oldKey));
    if (afectadas.length === 0) return agregarConcepto(grupo, newLabel);
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) }; const val = obj[oldKey]; delete obj[oldKey]; obj[newKey] = val; return { ...w, [field]: obj };
    });
    await supabase.from("cashflow_weeks").upsert(updates); fetchData(); return true;
  };

  const eliminarConcepto = async (grupo, key) => {
    const field = grupo === "ingreso" ? "income" : "expense";
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], key));
    if (afectadas.length === 0) return true;
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) }; delete obj[key]; return { ...w, [field]: obj };
    });
    await supabase.from("cashflow_weeks").upsert(updates); fetchData(); return true;
  };

  const incomeCats = useMemo(() => discoverCategories(weeks, BASE_INCOME, "income"), [weeks]);
  const expenseCats = useMemo(() => discoverCategories(weeks, BASE_EXPENSE, "expense"), [weeks]);
  
  const procesadas = useMemo(() => {
    const arqueosDict = {};
    arqueosList.forEach(a => { if (a.fecha_corte) arqueosDict[a.fecha_corte] = Number(a.saldo_efectivo || 0) + Number(a.saldo_banco || 0); });
    const fechasSet = new Set(weeks.map((w) => w.week_start)); Object.keys(arqueosDict).forEach(f => fechasSet.add(f));
    const fechasArray = Array.from(fechasSet).sort();
    const fechasConArqueo = Object.keys(arqueosDict).sort();
    const firstArqueoDate = fechasConArqueo.length > 0 ? fechasConArqueo[0] : null;

    const getTC = (date) => {
      if (!tcList || tcList.length === 0) return 1;
      const validTCs = tcList.filter(t => t.fecha_corte <= date).sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
      return validTCs.length > 0 ? Number(validTCs[0].saldo_efectivo) || 1 : 1;
    };

    let currentSaldo = 0;
    if (firstArqueoDate) {
         let flowSum = 0;
         for (let f of fechasArray) {
             if (f >= firstArqueoDate) break; 
             const w = weeks.find(week => week.week_start === f) || {};
             const tcActual = getTC(f);
             const calcSum = (obj) => {
                 let t = 0; Object.values(obj || {}).forEach(v => {
                     if (typeof v === 'object' && v !== null) t += Number(v.ars || 0) + (Number(v.usd || 0) * tcActual);
                     else t += Number(v || 0);
                 }); return t;
             };
             flowSum += (calcSum(w.income) - calcSum(w.expense));
         }
         currentSaldo = arqueosDict[firstArqueoDate] - flowSum;
    }

    return fechasArray.map((fecha) => {
      const w = weeks.find((week) => week.week_start === fecha) || { income: {}, expense: {}, notes: "{}" };
      const tcActual = getTC(fecha);
      const calcSum = (obj) => {
          let t = 0; Object.values(obj || {}).forEach(v => {
              if (typeof v === 'object' && v !== null) t += Number(v.ars || 0) + (Number(v.usd || 0) * tcActual);
              else t += Number(v || 0);
          }); return t;
      };

      const ing = calcSum(w.income); const eg = calcSum(w.expense); const pos = ing - eg;
      let parsedNotes = {}; try { parsedNotes = JSON.parse(w.notes || "{}"); } catch(e) {}
      
      let esArqueo = false; let ajuste = 0;
      if (arqueosDict[fecha] !== undefined) {
          esArqueo = true; ajuste = arqueosDict[fecha] - currentSaldo; currentSaldo = arqueosDict[fecha];
      }
      currentSaldo += pos;

      return { ...w, week_start: fecha, totalIngresos: ing, totalEgresos: eg, posicion: pos, saldoAcumulado: currentSaldo, parsedNotes, esArqueo, ajuste };
    });
  }, [weeks, arqueosList, tcList]);

  const kpis = useMemo(() => {
    if (procesadas.length === 0) return null;
    const hoy = todayISO();
    const pasadas = procesadas.filter((w) => w.week_start <= hoy);
    const saldoHoy = pasadas.length ? pasadas[pasadas.length - 1].saldoAcumulado : (arqueosList.length ? (Number(arqueosList[0].saldo_efectivo) + Number(arqueosList[0].saldo_banco)) : 0);

    let diasDeCaja = null, deficitActual = false, sinQuemaNeta = false;
    const semanaDeficit = procesadas.find((w) => w.week_start >= hoy && w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";

    if (saldoHoy < 0) { deficitActual = true; diasDeCaja = 0; } 
    else if (semanaDeficit) {
      diasDeCaja = Math.ceil((new Date(semanaDeficit.week_start + "T00:00:00").getTime() - new Date(hoy + "T00:00:00").getTime()) / (1000 * 3600 * 24));
    } else { sinQuemaNeta = true; }

    const ultimaFecha = procesadas[procesadas.length - 1].week_start;
    const ultimoMes = ultimaFecha.substring(0, 7);
    const datosUltimoMes = procesadas.filter((w) => w.week_start.startsWith(ultimoMes));
    const flujoUltimoMes = datosUltimoMes.reduce((acc, cur) => acc + cur.totalIngresos, 0) - datosUltimoMes.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const nofAnual = (flujoUltimoMes < 0 ? Math.abs(flujoUltimoMes) : 0) * 12;

    const mesActual = hoy.substring(0, 7);
    const datosMesActual = procesadas.filter(w => w.week_start.startsWith(mesActual));
    const ingresosMes = datosMesActual.reduce((acc, cur) => acc + cur.totalIngresos, 0);
    const egresosMes = datosMesActual.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const flujoNetoMes = ingresosMes - egresosMes;
    const cobertura = egresosMes > 0 ? Math.round((ingresosMes / egresosMes) * 100) : (ingresosMes > 0 ? 100 : 0);

    const fechaLimite = new Date(); fechaLimite.setDate(fechaLimite.getDate() + 30);
    const fechaLimiteISO = fechaLimite.toISOString().slice(0, 10);
    const datosProyectados = procesadas.filter(w => w.week_start >= hoy && w.week_start <= fechaLimiteISO);

    let maxEgresoVal = 0; let maxEgresoCat = "Sin egresos proyectados";
    if (datosProyectados.length > 0) {
      const sumasEgresos = {};
      const getTC = (d) => {
        if (!tcList || tcList.length === 0) return 1;
        const vTC = tcList.filter(t => t.fecha_corte <= d).sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
        return vTC.length > 0 ? Number(vTC[0].saldo_efectivo) || 1 : 1;
      };

      datosProyectados.forEach(w => {
         const rawWeek = weeks.find(raw => raw.week_start === w.week_start) || {};
         const tc = getTC(w.week_start);
         Object.entries(rawWeek.expense || {}).forEach(([k, v]) => {
            let pVal = 0; if (typeof v === 'object' && v !== null) pVal = Number(v.ars||0) + Number(v.usd||0)*tc; else pVal = Number(v||0);
            sumasEgresos[k] = (sumasEgresos[k] || 0) + pVal;
         });
      });
      Object.entries(sumasEgresos).forEach(([k, v]) => {
         if (v > maxEgresoVal) {
            maxEgresoVal = v; const catObj = expenseCats.find(c => c.key === k); maxEgresoCat = catObj ? catObj.label : k.replace('custom_', '');
         }
      });
    }

    return { diasDeCaja, deficitActual, sinQuemaNeta, diaDeficit, nofMensual: nofAnual / 12, nofAnual, liquidez: saldoHoy, flujoNetoMes, cobertura, maxEgresoVal, maxEgresoCat };
  }, [procesadas, arqueosList, expenseCats, weeks, tcList]);

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: tokens.ink, color: "#fff", fontFamily: tokens.fontBody }}><style>{fontImport}</style>Iniciando entorno seguro…</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.paper, fontFamily: tokens.fontBody, color: tokens.text }}>
      <style>{globalStyles}</style>

      {/* ---------- SIDEBAR ---------- */}
      <aside style={{ width: 232, flexShrink: 0, background: tokens.ink, color: "#fff", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ borderBottom: `1px solid ${tokens.inkRule}` }}>
          <img src="/link-banner.png" alt="LINK" style={{ width: "100%", height: "85px", objectFit: "cover", objectPosition: "left center", display: "block" }} />
          <div style={{ padding: "14px 20px 16px" }}>
            <div style={{ fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: "0.2px" }}>Finanzas</div>
            <div style={{ fontSize: 11, color: "#8590A6", marginTop: 2, letterSpacing: "0.3px" }}>Azlepi · Sigma</div>
          </div>
        </div>

        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${tokens.inkRule}` }}>
          <div style={{ fontSize: 10, color: "#6B7690", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700, marginBottom: 6 }}>Liquidez actual</div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 600, color: kpis && kpis.liquidez < 0 ? "#E0897A" : "#fff" }}>$ {kpis ? fmt(kpis.liquidez) : "—"}</div>
          <div style={{ fontSize: 10, color: "#6B7690", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700, margin: "14px 0 6px" }}>Días de caja</div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 600, color: kpis?.deficitActual ? "#E0897A" : kpis?.sinQuemaNeta ? "#7FD9BE" : "#fff" }}>{!kpis ? "—" : kpis.deficitActual ? "Déficit" : kpis.sinQuemaNeta ? "Sin quema" : `${kpis.diasDeCaja} d.`}</div>
        </div>

        <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, border: "none", cursor: "pointer", textAlign: "left", fontFamily: tokens.fontBody, fontSize: 13.5, fontWeight: active ? 600 : 500, background: active ? tokens.inkSoft : "transparent", color: active ? "#fff" : "#9AA3B8" }}>
                <Icon size={16} /> {n.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ---------- CANVAS ---------- */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        
        {tab === "resumen" && (
          <ResumenTab
            procesadas={procesadas}
            kpis={kpis}
            fmt={fmt}
            formatDate={formatDate}
            onIrAMovimientos={() => {
              setTab("movimientos");
            }}
            onIrAConfig={() => setTab("configuracion")}
            onIrAMotor={() => setTab("motor")}
            onCargarDemo={handleRestaurarDatosImagen}
          />
        )}

        {/* MÓDULO: MOTOR FINANCIERO (EMPRESA · PROYECTOS · SOCIOS) */}
        {tab === "motor" && (
          <MotorFinancieroTab
            weeks={weeks}
            planesFondos={planesFondos}
            tcList={tcList}
            kpis={kpis}
            fmt={fmt}
            onNavigateToTab={(target) => setTab(target)}
          />
        )}
        
        {/* MÓDULO: MONITOR ECONÓMICO */}
        {tab === "monitor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Monitor Económico e Indicadores</h2>
                <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Mercado en tiempo real, cotizaciones del dólar, BCRA, índices CAC y Hormigón H-21 sincronizados con el Cashflow.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setVistaMonitor(prev => prev === "nativo" ? "externo" : "nativo")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                    background: tokens.surface, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6,
                    fontSize: 12.5, fontWeight: 600, color: tokens.text, cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                  }}
                >
                  <Activity size={14} color={tokens.gold} />
                  {vistaMonitor === "nativo" ? "Ver Monitor Web Externo" : "Ver Panel Nativo Link"}
                </button>
              </div>
            </div>

            {vistaMonitor === "nativo" ? (
              <IndicadoresFinancierosTab onSyncTC={handleSyncTCFromMonitor} />
            ) : (
              <div style={{ height: "calc(100vh - 200px)", background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden" }}>
                <iframe src="https://monitor-econ-mico.vercel.app/" style={{ width: "100%", height: "100%", border: "none" }} title="Monitor Económico" />
              </div>
            )}
          </div>
        )}

        {tab === "presupuesto" && (
          <PresupuestoAnualTab 
            planIncomeCats={PLAN_INCOME_CATS} planExpenseCats={PLAN_EXPENSE_CATS}
            dailyIncomeCats={incomeCats} dailyExpenseCats={expenseCats} 
            fmt={fmt} planesFondos={planesFondos} mappingGuardado={mapping}
            onGuardarPlan={guardarPlanDeFondos} onGuardarMapeo={guardarMapeo} tcList={tcList} 
          />
        )}

        {tab === "movimientos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 20, fontWeight: 600 }}>Movimientos y Proyección Diaria</h2>
                <button
                  onClick={handleRestaurarDatosImagen}
                  type="button"
                  title="Recarga y sincroniza los datos oficiales de apertura ($124.596.986 y flujo diario)"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: tokens.surface,
                    color: tokens.ink,
                    border: `1px solid ${colorLineaFuerte}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  <RotateCcw size={13} color={tokens.gold} /> Sincronizar Datos Reales
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => handleIncorporarSemanasFuturas(4)}
                  type="button"
                  title="Incorpora 4 semanas futuras consecutivas para planificar proyecciones hacia adelante"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: tokens.surface,
                    color: tokens.ink,
                    border: `1px solid ${colorLineaFuerte}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.2s"
                  }}
                >
                  <CalendarRange size={14} color={tokens.gold} />
                  + Proyectar Semanas (+4)
                </button>

                <button
                  onClick={() => setMostrarImportadorMatriz(!mostrarImportadorMatriz)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 16px",
                    background: mostrarImportadorMatriz ? tokens.gold : tokens.ink,
                    color: mostrarImportadorMatriz ? tokens.ink : "#fff",
                    border: `1px solid ${tokens.ink}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.12)",
                    transition: "all 0.2s"
                  }}
                >
                  <Upload size={16} color={mostrarImportadorMatriz ? tokens.ink : tokens.gold} />
                  {mostrarImportadorMatriz ? "Cerrar Importador Excel" : "📥 Subir Excel (Hoy y Proyecciones)"}
                </button>

                <button
                  onClick={handleBorrarAnterioresAHoy}
                  type="button"
                  title={`Elimina semanas anteriores al día de hoy (${formatDate(todayISO())}) preservando el saldo acumulado como apertura`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    background: "#FEF2F2",
                    color: "#991B1B",
                    border: "1px solid #FECACA",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12
                  }}
                >
                  <Trash2 size={13} color="#DC2626" /> Purgar anteriores a hoy
                </button>

                <button
                  onClick={() => setMostrarPanel(!mostrarPanel)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    background: mostrarPanel ? tokens.surface : tokens.ink,
                    color: mostrarPanel ? tokens.text : "#fff",
                    border: `1px solid ${mostrarPanel ? colorLineaFuerte : tokens.ink}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.2s"
                  }}
                >
                  {mostrarPanel ? "Ocultar panel de carga" : "+ Cargar movimiento"}
                </button>
              </div>
            </div>

            {/* MÓDULO IMPORTADOR DE EXCEL DIARIO MATRIZ */}
            {mostrarImportadorMatriz && (
              <ImportadorMatrizExcel
                incomeCats={incomeCats}
                expenseCats={expenseCats}
                weeks={weeks}
                onImportarMatriz={handleImportarMatrizExcel}
                onClose={() => setMostrarImportadorMatriz(false)}
              />
            )}

            <div style={{ display: "grid", gridTemplateColumns: mostrarPanel ? "340px 1fr" : "1fr", gap: 20, alignItems: "start", transition: "all 0.3s" }}>
              {mostrarPanel && (
                <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22, position: "sticky", top: 32 }}>
                  <CargarMovimiento
                    incomeCats={incomeCats}
                    expenseCats={expenseCats}
                    weeks={weeks}
                    onGuardar={guardarMovimiento}
                    onEliminar={eliminarMovimiento}
                    formatDate={formatDate}
                    movimientoAEditar={movimientoAEditar}
                    setMovimientoAEditar={setMovimientoAEditar}
                    getTC={getTC}
                    onAbrirImportadorExcel={() => setMostrarImportadorMatriz(true)}
                  />
                </div>
              )}
              <FlujoTable procesadas={procesadas} weeks={weeks} tcList={tcList} incomeCats={incomeCats} expenseCats={expenseCats} fmt={fmt} onMoverMovimiento={moverMovimiento} formatDate={formatDate} onEditClick={(item) => { setMostrarPanel(true); setMovimientoAEditar(item); }} />
            </div>
          </div>
        )}

        {tab === "conceptos" && <CategoryManager incomeCats={incomeCats} expenseCats={expenseCats} weeks={weeks} onAdd={agregarConcepto} onRename={renombrarConcepto} onDelete={eliminarConcepto} />}

        {tab === "configuracion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
            <div><h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Configuración</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
                
                <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Settings size={16} color={tokens.textMuted} />
                    <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>Cargar Arqueo (Saldo de Apertura)</h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: tokens.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
                    Carga el saldo real que tienes en el banco <strong>al arrancar el día</strong>. El sistema le sumará y restará automáticamente los movimientos programados.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    <Field label="Fecha de Apertura"><input type="date" value={fechaSaldo} onChange={(e) => setFechaSaldo(e.target.value)} style={fieldInputStyle} /></Field>
                    <Field label="Efectivo al Inicio ($)"><input type="number" value={saldoEfectivo} onChange={(e) => setSaldoEfectivo(e.target.value)} style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} /></Field>
                    <Field label="Bancos al Inicio ($)"><input type="number" value={saldoBanco} onChange={(e) => setSaldoBanco(e.target.value)} style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} /></Field>
                  </div>
                  <button onClick={guardarSaldos} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 }}><Save size={15} /> Guardar Arqueo</button>

                  {arqueosList.length > 0 && (
                    <div style={{ marginTop: 24, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 16 }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 11, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px" }}>Historial de Arqueos Guardados</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {arqueosList.sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte)).map(a => {
                          if(!a.fecha_corte) return null;
                          return (
                           <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: colorTablaBg, padding: "10px 14px", borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                              <div style={{ display: "flex", gap: 24 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text, width: 80 }}>{formatDate(a.fecha_corte)}</span>
                                <span style={{ fontSize: 13, fontFamily: tokens.fontMono, color: tokens.textMuted }}>Efe: $ {fmt(a.saldo_efectivo)}</span>
                                <span style={{ fontSize: 13, fontFamily: tokens.fontMono, color: tokens.textMuted }}>Bco: $ {fmt(a.saldo_banco)}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>Total: $ {fmt(Number(a.saldo_efectivo) + Number(a.saldo_banco))}</span>
                                <button onClick={() => eliminarArqueo(a.id)} style={{ background: "none", border: "none", color: tokens.negative, cursor: "pointer", padding: 4, display: "flex" }} title="Eliminar este arqueo"><Trash2 size={16}/></button>
                              </div>
                           </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <DollarSign size={16} color={tokens.textMuted} />
                    <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>Cargar Tipo de Cambio (Dólar)</h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: tokens.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
                    Carga la cotización del dólar por fecha. Al cargar un movimiento en USD, el sistema buscará el último TC cargado hasta ese día.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Fecha del TC"><input type="date" value={fechaTC} onChange={(e) => setFechaTC(e.target.value)} style={fieldInputStyle} /></Field>
                    <Field label="Valor TC ($)"><input type="number" value={valorTC} onChange={(e) => setValorTC(e.target.value)} style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} /></Field>
                  </div>

                  {liveDolarQuotes.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: tokens.textFaint, marginBottom: 6, fontWeight: 600 }}>COPIAR COTIZACIÓN ACTUAL EN VIVO:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {["bolsa", "blue", "oficial"].map(casaKey => {
                          const q = liveDolarQuotes.find(x => x.casa === casaKey);
                          if (!q || !q.venta) return null;
                          const nombre = casaKey === "bolsa" ? "MEP" : casaKey === "blue" ? "Blue" : "Oficial";
                          return (
                            <button
                              key={casaKey}
                              onClick={() => setValorTC(q.venta)}
                              type="button"
                              style={{
                                background: "rgba(201, 174, 107, 0.12)",
                                border: "1px solid rgba(201, 174, 107, 0.35)",
                                borderRadius: 5,
                                padding: "4px 10px",
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: tokens.ink,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <span>{nombre}:</span>
                              <span style={{ fontFamily: tokens.fontMono }}>${q.venta}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button onClick={guardarTC} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 }}><Save size={15} /> Guardar TC</button>

                  {tcList.length > 0 && (
                    <div style={{ marginTop: 24, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 16 }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 11, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px" }}>Historial de Tipos de Cambio</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tcList.sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte)).map(t => (
                           <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: colorTablaBg, padding: "10px 14px", borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                              <div style={{ display: "flex", gap: 24 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text, width: 80 }}>{formatDate(t.fecha_corte)}</span>
                                <span style={{ fontSize: 13, fontFamily: tokens.fontMono, color: tokens.positive }}>TC: $ {fmt(t.saldo_efectivo)}</span>
                              </div>
                              <button onClick={() => eliminarTC(t.id)} style={{ background: "none", border: "none", color: tokens.negative, cursor: "pointer", padding: 4, display: "flex" }} title="Eliminar este TC"><Trash2 size={16}/></button>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

            </div>

            {/* Tarjeta de Estado de Base de Datos y Vinculación */}
            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22, maxWidth: 720 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LinkIcon size={16} color={tokens.gold} />
                  <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
                    Estado de Vinculación y Base de Datos
                  </h3>
                </div>
                <span style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: isSupabaseConfigured ? "#ECFDF5" : "#FEF3C7",
                  color: isSupabaseConfigured ? "#047857" : "#B45309",
                  border: `1px solid ${isSupabaseConfigured ? "#A7F3D0" : "#FDE68A"}`
                }}>
                  {isSupabaseConfigured ? "● Conectado a Supabase en la nube" : "○ Modo Local Resiliente (Activo)"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: tokens.textMuted, margin: "0 0 14px 0", lineHeight: 1.5 }}>
                {isSupabaseConfigured ? (
                  <>El sistema está conectado exitosamente a tu proyecto de Supabase en <code>{configuredSupabaseUrl}</code>. Todas las cargas de semanas, arqueos, tipos de cambio y presupuestos se sincronizan en tiempo real con todo el equipo de Link Inversiones.</>
                ) : (
                  <>El sistema está operando con almacenamiento persistente local. Para sincronizar con la base de datos central de Link Inversiones en Supabase, configura las variables <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.</>
                )}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: tokens.textMuted, background: colorTablaBg, padding: "12px 16px", borderRadius: 6, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <div><strong>Semanas registradas:</strong> {weeks.length}</div>
                  <div><strong>Arqueos guardados:</strong> {arqueosList.length}</div>
                  <div><strong>Tipos de cambio:</strong> {tcList.length}</div>
                  <div><strong>Indicadores externos:</strong> DolarAPI / BCRA activos</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={ejecutarTestSupabase}
                    disabled={probandoSupabase}
                    type="button"
                    style={{
                      background: probandoSupabase ? tokens.textMuted : "rgba(201, 174, 107, 0.15)",
                      color: tokens.ink,
                      border: "1px solid rgba(201, 174, 107, 0.45)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: probandoSupabase ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    {probandoSupabase ? <Loader2 size={13} /> : <Activity size={13} color={tokens.gold} />}
                    {probandoSupabase ? "Probando..." : "Probar Guardado en Supabase"}
                  </button>
                  {isSupabaseConfigured && (
                    <button
                      onClick={handleSincronizarHaciaSupabase}
                      type="button"
                      style={{
                        background: tokens.ink,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <RotateCcw size={13} /> Sincronizar a Supabase
                    </button>
                  )}
                </div>
              </div>

              {testSupabaseStatus && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  background: testSupabaseStatus.loading
                    ? "#F3F4F6"
                    : testSupabaseStatus.success
                    ? "#ECFDF5"
                    : "#FEF2F2",
                  border: `1px solid ${
                    testSupabaseStatus.loading
                      ? "#E5E7EB"
                      : testSupabaseStatus.success
                      ? "#A7F3D0"
                      : "#FECACA"
                  }`,
                  color: testSupabaseStatus.loading
                    ? tokens.textMuted
                    : testSupabaseStatus.success
                    ? "#065F46"
                    : "#991B1B"
                }}>
                  <div style={{ marginTop: 1 }}>
                    {testSupabaseStatus.loading ? (
                      <Loader2 size={16} />
                    ) : testSupabaseStatus.success ? (
                      <CheckCircle2 size={16} color="#059669" />
                    ) : (
                      <XCircle size={16} color="#DC2626" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{testSupabaseStatus.msg}</div>
                    {testSupabaseStatus.stats && (
                      <div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.85 }}>
                        Tablas verificadas: <strong>cashflow_weeks</strong> ({testSupabaseStatus.stats.weeks} semanas), <strong>cashflow_settings</strong> ({testSupabaseStatus.stats.settings} arqueos/TC), <strong>cashflow_plan</strong> ({testSupabaseStatus.stats.planes} presupuestos) — Hora: {testSupabaseStatus.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 4, maxWidth: 720 }}><ImportadorCashflow baseIncome={BASE_INCOME} baseExpense={BASE_EXPENSE} onImportarSemanas={handleImportarSemanas} onBorrarDatos={handleBorrarDatos} semanasExistentes={weeks} /></div>
          </div>
        )}
      </main>
    </div>
  );
}

const fieldInputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${colorLineaFuerte}`, borderRadius: 5, fontSize: 13, fontFamily: tokens.fontBody, outline: "none", boxSizing: "border-box" };

function Field({ label, children }) {
  return <div><label style={{ display: "block", fontSize: 10.5, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>{label}</label>{children}</div>;
}

function KpiCard({ icon: Icon, label, value, sub, tone }) {
  const color = tone === "neg" ? tokens.negative : tone === "pos" ? tokens.positive : tokens.text;
  return (
    <div className="kf-card" style={{ background: tokens.surface, padding: "20px 22px", borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontFamily: tokens.fontMono, fontSize: 25, fontWeight: 600, color, marginTop: 6, letterSpacing: "-0.5px" }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: tokens.textFaint, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ background: tokens.paper, padding: 10, borderRadius: 8, color }}><Icon size={19} /></div>
    </div>
  );
}

/* Interruptor on/off — usado para activar/desactivar proyectos en el simulador */
function ToggleSwitch({ on, onChange, size = 15 }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      role="switch"
      aria-checked={on}
      style={{
        width: size * 1.8, height: size, borderRadius: size, flexShrink: 0,
        background: on ? tokens.positive : colorLineaFuerte, position: "relative",
        cursor: "pointer", transition: "background 0.15s ease",
      }}
    >
      <div style={{
        position: "absolute", top: 1.5, left: on ? size * 0.82 : 1.5,
        width: size - 3, height: size - 3, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

/* Pastilla de variación % (base → simulado). positiveIsGood invierte el semáforo para egresos. */
function DeltaBadge({ base, sim, positiveIsGood = true, size = "sm" }) {
  const diff = sim - base;
  if (Math.abs(diff) < 0.5) return null;
  const pct = base !== 0 ? (diff / Math.abs(base)) * 100 : 0;
  const isUp = diff > 0;
  const good = positiveIsGood ? isUp : !isUp;
  const color = good ? tokens.positive : tokens.negative;
  const bg = good ? tokens.positiveSoft : tokens.negativeSoft;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const fs = size === "lg" ? 12 : 10.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: fs, fontWeight: 700, color, background: bg, padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap" }}>
      <Icon size={size === "lg" ? 13 : 11} /> {isUp ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function SemesterCard({ title, ingresos, egresos, neto, fmt, ingresosBase, egresosBase }) {
  const showDelta = ingresosBase != null && egresosBase != null;
  const netoBase = showDelta ? ingresosBase - egresosBase : null;
  return (
    <div className="kf-card" style={{ background: tokens.surface, padding: "20px", borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, display: "flex", flexDirection: "column" }}>
      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{title}</h4>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: tokens.textMuted }}>Ingresos</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showDelta && <DeltaBadge base={ingresosBase} sim={ingresos} positiveIsGood={true} />}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.positive, fontFamily: tokens.fontMono }}>$ {fmt(ingresos)}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colorLineaSuave}` }}>
        <span style={{ fontSize: 12.5, color: tokens.textMuted }}>Egresos</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showDelta && <DeltaBadge base={egresosBase} sim={egresos} positiveIsGood={false} />}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.negative, fontFamily: tokens.fontMono }}>$ {fmt(egresos)}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.text }}>Flujo Neto</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showDelta && <DeltaBadge base={netoBase} sim={neto} positiveIsGood={true} size="lg" />}
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: tokens.fontMono, color: neto >= 0 ? tokens.positive : tokens.negative }}>$ {fmt(neto)}</span>
        </div>
      </div>
    </div>
  );
}

function ResumenTab({ procesadas, kpis, fmt, formatDate, onIrAMovimientos, onIrAConfig, onIrAMotor, onCargarDemo }) {
  if (procesadas.length === 0 || !kpis) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Resumen Ejecutivo</h2>
          <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Vista ejecutiva de liquidez, días de caja, NOF y evolución financiera.</p>
        </div>

        <div style={{
          background: tokens.surface,
          borderRadius: 12,
          border: `1px solid ${colorLineaFuerte}`,
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: 680,
          margin: "20px auto 0",
          boxShadow: "0 4px 20px rgba(14,21,36,0.04)"
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(201, 174, 107, 0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            color: tokens.gold
          }}>
            <Calendar size={28} />
          </div>

          <h3 style={{ fontFamily: tokens.fontDisplay, fontSize: 20, fontWeight: 600, margin: "0 0 8px 0", color: tokens.ink }}>
            Sin movimientos registrados
          </h3>
          <p style={{ fontSize: 13.5, color: tokens.textMuted, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 24px" }}>
            Ingresa al módulo <strong>Movimientos</strong> para visualizar los ingresos, egresos y saldos diarios proyectados.
          </p>

          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={onIrAMovimientos}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 22px",
                background: tokens.ink,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
              }}
            >
              <Calendar size={17} color={tokens.gold} /> Ir a Movimientos
            </button>

            <button
              onClick={onIrAConfig}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                background: "transparent",
                color: tokens.ink,
                border: `1px solid ${colorLineaFuerte}`,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              <SlidersHorizontal size={15} /> Fijar Saldo / Arqueo Inicial
            </button>

            {onCargarDemo && (
              <button
                onClick={onCargarDemo}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: "rgba(201, 174, 107, 0.15)",
                  color: tokens.ink,
                  border: "1px solid rgba(201, 174, 107, 0.4)",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                <RotateCcw size={14} color={tokens.gold} /> Restaurar Datos Reales
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Resumen Ejecutivo</h2>
          <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Vista ejecutiva de liquidez, días de caja, NOF y curva de evolución semanal.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onCargarDemo && (
            <button
              onClick={onCargarDemo}
              type="button"
              style={{
                background: tokens.surface,
                color: tokens.ink,
                border: `1px solid ${colorLineaFuerte}`,
                borderRadius: 6,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
              }}
            >
              <RotateCcw size={13} color={tokens.gold} /> Restaurar Datos Reales
            </button>
          )}
        </div>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 18 }}>
        <KpiCard icon={Wallet} label="Días de caja" value={kpis.deficitActual ? "Déficit" : kpis.sinQuemaNeta ? "Sin quema" : `${kpis.diasDeCaja} días`} tone={kpis.deficitActual || (kpis.diasDeCaja != null && kpis.diasDeCaja <= 15) ? "neg" : "pos"} />
        <KpiCard icon={CalendarX2} label="Día de déficit" value={kpis.diaDeficit !== "Sin déficit" ? formatDate(kpis.diaDeficit) : "Sin déficit"} tone={kpis.diaDeficit !== "Sin déficit" ? "neg" : "pos"} />
        <KpiCard icon={AlertTriangle} label="NOF mensual" value={`$ ${fmt(kpis.nofMensual)}`} tone={kpis.nofMensual > 0 ? "neg" : "pos"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 18 }}>
        <KpiCard icon={Scale} label="Flujo Neto (Mes en curso)" value={`$ ${fmt(kpis.flujoNetoMes)}`} tone={kpis.flujoNetoMes >= 0 ? "pos" : "neg"} />
        <KpiCard icon={Percent} label="Índice de Cobertura" value={`${kpis.cobertura}%`} tone={kpis.cobertura >= 100 ? "pos" : "neg"} sub={kpis.cobertura >= 100 ? "Ingresos superan egresos" : "Faltan ingresos para cubrir gastos"} />
        <KpiCard icon={TrendingDown} label="Fuga Proyectada (Próx. 30 d.)" value={kpis.maxEgresoCat} sub={`$ ${fmt(kpis.maxEgresoVal)}`} tone="neg" />
      </div>

      <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 24 }}>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={procesadas.map((w) => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colorLineaSuave} />
              <XAxis dataKey="name" tickFormatter={formatDate} tick={{ fill: tokens.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: tokens.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} dx={-6} width={72} />
              <Tooltip labelFormatter={(label) => formatDate(label)} formatter={(v) => ["$ " + fmt(v), "Saldo"]} />
              <Area type="monotone" dataKey="saldo" stroke={tokens.positive} strokeWidth={2.5} fill={tokens.positive} fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BANNER DE ARTICULACIÓN: EMPRESA · PROYECTOS · SOCIOS */}
      <div style={{
        background: `linear-gradient(135deg, ${tokens.ink} 0%, #1A243B 100%)`,
        borderRadius: 10,
        padding: "20px 24px",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "0 4px 12px rgba(14,21,36,0.12)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: tokens.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Cpu size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: tokens.gold }}>
                Motor Financiero Link
              </span>
              <span style={{ fontSize: 11, color: "#8590A6" }}>· Arquitectura de 3 Ejes</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              Empresa (Tesorería) · Proyectos (Costos & Ventas) · Socios (Capital & Retiros)
            </div>
            <div style={{ fontSize: 12, color: "#9AA3B8", marginTop: 2 }}>
              Simulación de impacto multivariable sobre Cash Flow, Resultado Proyectado y Asignación de Capital.
            </div>
          </div>
        </div>

        {onIrAMotor && (
          <button
            onClick={onIrAMotor}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: tokens.gold,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
          >
            Abrir Motor & Simulador <ChevronRight size={15} />
          </button>
        )}
      </div>
    </>
  );
}

function PresupuestoAnualTab({ planIncomeCats, planExpenseCats, dailyIncomeCats, dailyExpenseCats, fmt, planesFondos, mappingGuardado, onGuardarPlan, onGuardarMapeo, tcList }) {
  const meses = [
    { k: "01", n: "Ene" }, { k: "02", n: "Feb" }, { k: "03", n: "Mar" }, { k: "04", n: "Abr" },
    { k: "05", n: "May" }, { k: "06", n: "Jun" }, { k: "07", n: "Jul" }, { k: "08", n: "Ago" },
    { k: "09", n: "Sep" }, { k: "10", n: "Oct" }, { k: "11", n: "Nov" }, { k: "12", n: "Dic" }
  ];
  
  const [selectedYear, setSelectedYear] = useState("2026");
  const [view, setView] = useState("presupuesto");
  const [editMode, setEditMode] = useState(false);
  const [planDraft, setPlanDraft] = useState({});
  const [mappingDraft, setMappingDraft] = useState({ ingreso: {}, egreso: {} });
  const [mostrarImportadorPresupuesto, setMostrarImportadorPresupuesto] = useState(false);

  // ESTADO DEL SIMULADOR CON BARRAS
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  const [simData, setSimData] = useState({ globalIng: 0, globalEg: 0, cats: {}, meses: {} });
  const [proyectosExpanded, setProyectosExpanded] = useState(true);
  // Todos activos por defecto — false explícito = el proyecto está "apagado" en la simulación.
  const [proyectosActivos, setProyectosActivos] = useState({});
  const projectKeys = useMemo(() => new Set(PLAN_PROJECT_CATS.map(p => p.key)), []);
  const isProyectoActivo = (key) => proyectosActivos[key] !== false;

  useEffect(() => {
    setPlanDraft(planesFondos[selectedYear] || { ingreso: {}, egreso: {} });
  }, [planesFondos, selectedYear, editMode, view]);

  useEffect(() => {
    setMappingDraft({ ingreso: { ...(mappingGuardado?.ingreso || {}) }, egreso: { ...(mappingGuardado?.egreso || {}) } });
  }, [mappingGuardado, view]);

  useEffect(() => {
    if (editMode) setSimulacionActiva(false);
  }, [editMode]);

  const ultimoDolar = useMemo(() => {
    if (!tcList || tcList.length === 0) return 1; 
    const sorted = [...tcList].sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
    return Number(sorted[0].saldo_efectivo) || 1;
  }, [tcList]);

  const handleInputChange = (tipo, conceptoKey, mesKey, value) => {
    setPlanDraft(prev => {
      const newState = { ...prev };
      if (!newState[tipo]) newState[tipo] = {};
      if (!newState[tipo][conceptoKey]) newState[tipo][conceptoKey] = {};
      newState[tipo][conceptoKey][mesKey] = Number(value) || 0;
      return newState;
    });
  };

  const handleMappingChange = (tipo, dailyKey, planKey) => {
    setMappingDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], [dailyKey]: planKey } }));
  };

  // MATEMÁTICA DEL SIMULADOR POR PORCENTAJES
  const getSimVal = (tipo, conceptoKey, mesKey) => {
    const baseVal = planDraft?.[tipo]?.[conceptoKey]?.[mesKey] || 0;
    if (!simulacionActiva) return baseVal;

    // Proyecto desactivado en la simulación → no aporta al escenario simulado.
    if (tipo === "egreso" && projectKeys.has(conceptoKey) && !isProyectoActivo(conceptoKey)) return 0;

    const glob = tipo === 'ingreso' ? (simData.globalIng || 0) : (simData.globalEg || 0);
    const cat = simData.cats[conceptoKey] || 0;
    const mes = simData.meses[mesKey] || 0;
    
    const totalPct = glob + cat + mes;
    return baseVal * (1 + totalPct / 100);
  };

  const calcularTotalFila = (tipo, conceptoKey) => {
    let total = 0;
    meses.forEach(m => { total += getSimVal(tipo, conceptoKey, m.k); });
    return total;
  };

  const calcularTotalColumna = (tipo, mesKey) => {
    let total = 0;
    const catalogo = tipo === "ingreso" ? planIncomeCats : planExpenseCats;
    catalogo.forEach(c => { total += getSimVal(tipo, c.key, mesKey); });
    return total;
  };

  const calcSemestre = (tipo, mesesFilter) => {
    let t = 0;
    const catalogo = tipo === "ingreso" ? planIncomeCats : planExpenseCats;
    catalogo.forEach(c => {
      mesesFilter.forEach(m => { t += getSimVal(tipo, c.key, m); });
    });
    return t;
  };

  const calcSemestreBase = (tipo, mesesFilter) => {
    let t = 0;
    const catalogo = tipo === "ingreso" ? planIncomeCats : planExpenseCats;
    catalogo.forEach(c => {
      mesesFilter.forEach(m => { t += planDraft?.[tipo]?.[c.key]?.[m] || 0; });
    });
    return t;
  };

  const keysS1 = ["01", "02", "03", "04", "05", "06"];
  const keysS2 = ["07", "08", "09", "10", "11", "12"];

  const ingS1 = calcSemestre("ingreso", keysS1);
  const ingS2 = calcSemestre("ingreso", keysS2);
  const egS1 = calcSemestre("egreso", keysS1);
  const egS2 = calcSemestre("egreso", keysS2);

  const ingS1Base = simulacionActiva ? calcSemestreBase("ingreso", keysS1) : ingS1;
  const ingS2Base = simulacionActiva ? calcSemestreBase("ingreso", keysS2) : ingS2;
  const egS1Base = simulacionActiva ? calcSemestreBase("egreso", keysS1) : egS1;
  const egS2Base = simulacionActiva ? calcSemestreBase("egreso", keysS2) : egS2;

  const totalIng = planIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0);
  const totalEg = planExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);

  // ── VALORES BASE (sin simulación) — para comparar el impacto del simulador ──
  const getBaseVal = (tipo, conceptoKey, mesKey) => planDraft?.[tipo]?.[conceptoKey]?.[mesKey] || 0;
  const calcularTotalColumnaBase = (tipo, mesKey) => {
    const catalogo = tipo === "ingreso" ? planIncomeCats : planExpenseCats;
    return catalogo.reduce((acc, c) => acc + getBaseVal(tipo, c.key, mesKey), 0);
  };
  const totalIngBase = simulacionActiva ? planIncomeCats.reduce((acc, c) => acc + meses.reduce((a, m) => a + getBaseVal("ingreso", c.key, m.k), 0), 0) : totalIng;
  const totalEgBase = simulacionActiva ? planExpenseCats.reduce((acc, c) => acc + meses.reduce((a, m) => a + getBaseVal("egreso", c.key, m.k), 0), 0) : totalEg;

  // ── SERIE MENSUAL: base vs simulado (alimenta el gráfico de evolución) ──
  const evolucionMensual = meses.map((m) => ({
    mes: m.n,
    ingresoBase: calcularTotalColumnaBase("ingreso", m.k),
    ingresoSim: calcularTotalColumna("ingreso", m.k),
    egresoBase: calcularTotalColumnaBase("egreso", m.k),
    egresoSim: calcularTotalColumna("egreso", m.k),
  }));

  const pieIngresos = planIncomeCats.map(c => {
    const val = calcularTotalFila("ingreso", c.key);
    return { name: c.label, value: val, perc: totalIng > 0 ? (val / totalIng) * 100 : 0 };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const otherExpenseCats = planExpenseCats.filter(c => !projectKeys.has(c.key));
  const totalProyectosSim = PLAN_PROJECT_CATS.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);

  const pieEgresos = [
    { name: "Proyectos", value: totalProyectosSim, perc: totalEg > 0 ? (totalProyectosSim / totalEg) * 100 : 0 },
    ...otherExpenseCats.map(c => {
      const val = calcularTotalFila("egreso", c.key);
      return { name: c.label, value: val, perc: totalEg > 0 ? (val / totalEg) * 100 : 0 };
    }),
  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const MODERN_PALETTE = ['#3B82F6', '#14DBB6', '#FFCC4D', '#FF6666', '#A385FF', '#4ADE80', '#F97316', '#0EA5E9'];
  const COLORS_ING = MODERN_PALETTE;
  const COLORS_EG = MODERN_PALETTE;

  const guardarTodo = () => {
    if (view === "presupuesto") {
      onGuardarPlan(planDraft, selectedYear); 
      setEditMode(false);
    } else {
      onGuardarMapeo(mappingDraft);
      setView("presupuesto");
    }
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-pie-tooltip">
          <strong style={{ display: "block", marginBottom: 4, fontSize: 13 }}>{data.name}</strong>
          <div style={{ color: payload[0].fill, fontWeight: 600, fontSize: 14 }}>$ {fmt(data.value)}</div>
          <div style={{ color: tokens.textMuted, fontSize: 11, marginTop: 4 }}>Representa el <strong>{data.perc.toFixed(1)}%</strong> del total anual.</div>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.03) return null; 
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 4px 0" }}>
             <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>
               {view === "mapeo" ? "Mapeador de Conceptos" : "Presupuesto Anual"}
             </h2>
             {view === "presupuesto" && (
               <select 
                 value={selectedYear} 
                 onChange={(e) => setSelectedYear(e.target.value)}
                 style={{ padding: "4px 10px", fontSize: 16, fontFamily: tokens.fontDisplay, fontWeight: 600, borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, background: "#fff", outline: "none", cursor: "pointer" }}
               >
                 <option value="2025">2025</option>
                 <option value="2026">2026</option>
                 <option value="2027">2027</option>
                 <option value="2028">2028</option>
                 <option value="2029">2029</option>
               </select>
             )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>
            {view === "mapeo" 
              ? "Vincula tus categorías del Cashflow diario con las bolsas del Presupuesto Anual." 
              : editMode ? `Estás editando el presupuesto de ${selectedYear}.` : `Presupuesto proyectado para ${selectedYear}.`}
          </p>
        </div>
        
        <div style={{ display: "flex", gap: 10 }}>
          {view === "presupuesto" && !editMode && (
            <>
              <button
                onClick={() => setMostrarImportadorPresupuesto(true)}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: tokens.ink,
                  color: "#fff",
                  border: `1px solid ${tokens.gold}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.15)"
                }}
              >
                <Upload size={15} color={tokens.gold} /> 📥 Subir Excel / Pegar Presupuesto {selectedYear}
              </button>
              <button onClick={() => setView("mapeo")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.surface, color: tokens.text, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                 <LinkIcon size={16} /> Mapear Conceptos
              </button>
            </>
          )}

          {view === "presupuesto" ? (
            editMode ? (
              <>
                <button onClick={() => setPlanDraft(selectedYear === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.negativeSoft, color: tokens.negative, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Restaurar Valores Excel
                </button>
                <button onClick={guardarTodo} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.positive, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  <Save size={16} /> Guardar {selectedYear}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setSimulacionActiva(!simulacionActiva); setSimData({globalIng:0, globalEg:0, cats:{}, meses:{}}); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: simulacionActiva ? tokens.gold : tokens.surface, color: simulacionActiva ? "#fff" : tokens.text, border: `1px solid ${simulacionActiva ? tokens.gold : colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>
                  <Wand2 size={16} /> {simulacionActiva ? "Apagar Simulador" : "Simular Escenarios"}
                </button>

                <button onClick={() => setEditMode(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  <Pencil size={16} /> Editar {selectedYear}
                </button>
              </>
            )
          ) : (
            <button onClick={guardarTodo} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.positive, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              <Save size={16} /> Guardar Mapeo Global
            </button>
          )}
        </div>
      </div>
      
      {view === "presupuesto" && (
        <>
          {mostrarImportadorPresupuesto && (
            <ImportadorPresupuestoExcel
              year={selectedYear}
              planIncomeCats={planIncomeCats}
              planExpenseCats={planExpenseCats}
              onGuardarPlan={async (nuevoPlan, y) => {
                await onGuardarPlan(nuevoPlan, y);
                setPlanDraft(nuevoPlan);
                setMostrarImportadorPresupuesto(false);
              }}
              onClose={() => setMostrarImportadorPresupuesto(false)}
            />
          )}

          {simulacionActiva && !editMode && (
            <div style={{ background: tokens.surface, borderRadius: 10, border: `2px solid ${tokens.gold}`, padding: "16px 20px", display: 'flex', flexDirection: 'column', gap: 16, boxShadow: "0 4px 12px rgba(212, 175, 55, 0.15)" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 15, color: tokens.gold, display: 'flex', alignItems: 'center', gap: 6 }}><Wand2 size={16} /> Modo Simulación Activo</h3>
                  <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>Mueve las barras globales aquí, o las barras de la tabla para ajustar meses y conceptos individualmente. <strong>Tus datos reales están a salvo.</strong></p>
                </div>
                <button onClick={() => setSimData({globalIng:0, globalEg:0, cats:{}, meses:{}})} style={{ padding: "8px 16px", borderRadius: 6, background: colorTablaBg, border: `1px solid ${colorLineaSuave}`, cursor: "pointer", fontSize: 12, fontWeight: 600, color: tokens.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><RotateCcw size={14}/> Resetear todas las barras</button>
              </div>
              
              <div style={{ display: 'flex', gap: 32, padding: "16px", background: colorTablaBg, borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: tokens.positive, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ajuste Global Ingresos</label>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: tokens.fontMono, color: simData.globalIng !== 0 ? tokens.positive : tokens.textMuted }}>{simData.globalIng > 0 ? '+' : ''}{simData.globalIng}%</span>
                  </div>
                  <input type="range" className="sim-slider" min="-100" max="100" value={simData.globalIng} onChange={(e) => setSimData({...simData, globalIng: Number(e.target.value)})} />
                </div>
                <div style={{ width: 1, background: colorLineaFuerte }}></div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: tokens.negative, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ajuste Global Egresos</label>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: tokens.fontMono, color: simData.globalEg !== 0 ? tokens.negative : tokens.textMuted }}>{simData.globalEg > 0 ? '+' : ''}{simData.globalEg}%</span>
                  </div>
                  <input type="range" className="sim-slider" min="-100" max="100" value={simData.globalEg} onChange={(e) => setSimData({...simData, globalEg: Number(e.target.value)})} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            <SemesterCard title="Primer Semestre (Ene - Jun)" ingresos={ingS1} egresos={egS1} neto={ingS1 - egS1} fmt={fmt} ingresosBase={simulacionActiva ? ingS1Base : null} egresosBase={simulacionActiva ? egS1Base : null} />
            <SemesterCard title="Segundo Semestre (Jul - Dic)" ingresos={ingS2} egresos={egS2} neto={ingS2 - egS2} fmt={fmt} ingresosBase={simulacionActiva ? ingS2Base : null} egresosBase={simulacionActiva ? egS2Base : null} />
            <SemesterCard title={simulacionActiva ? "Total Acumulado SIMULADO" : "Total Acumulado Anual"} ingresos={ingS1 + ingS2} egresos={egS1 + egS2} neto={(ingS1 + ingS2) - (egS1 + egS2)} fmt={fmt} ingresosBase={simulacionActiva ? (ingS1Base + ingS2Base) : null} egresosBase={simulacionActiva ? (egS1Base + egS2Base) : null} />
          </div>

          {simulacionActiva && !editMode && (
            <div className="kf-card-dark" style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>Evolución Mensual — Base vs. Simulado</h3>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: '#94A3B8' }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #64748B" }} /> Base</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 2, background: "#4ADE80", borderRadius: 2 }} /> Ingresos simulado</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 2, background: "#FF6666", borderRadius: 2 }} /> Egresos simulado</span>
                </div>
              </div>
              <p style={{ margin: "2px 0 16px 0", fontSize: 12, color: '#64748B' }}>Cómo se mueve cada mes del año a medida que ajustás las barras del simulador.</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucionMensual} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#293449" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}
                      formatter={(value, name) => {
                        const labels = { ingresoBase: 'Ingresos base', ingresoSim: 'Ingresos simulado', egresoBase: 'Egresos base', egresoSim: 'Egresos simulado' };
                        return [`$ ${fmt(value)}`, labels[name] || name];
                      }}
                    />
                    <Line type="monotone" dataKey="ingresoBase" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    <Line type="monotone" dataKey="egresoBase" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    <Line type="monotone" dataKey="ingresoSim" stroke="#4ADE80" strokeWidth={2.5} dot={{ r: 3, fill: "#4ADE80" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="egresoSim" stroke="#FF6666" strokeWidth={2.5} dot={{ r: 3, fill: "#FF6666" }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!editMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 1fr", gap: 18 }}>
              {/* GRÁFICO INGRESOS */}
              <div className="kf-card-dark" style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px 0", color: '#fff', fontSize: 15, textAlign: "center", fontWeight: 700 }}>Participación — Ingresos</h3>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieIngresos} cx="50%" cy="50%" innerRadius={55} outerRadius={85} 
                        paddingAngle={0} dataKey="value" stroke="#172033" strokeWidth={2} labelLine={false} label={renderCustomizedLabel}
                      >
                        {pieIngresos.map((entry, index) => <Cell key={index} fill={COLORS_ING[index % COLORS_ING.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, fontFamily: tokens.fontBody, color: '#94A3B8', paddingLeft: 20 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* INDICADOR CENTRAL: FLUJO NETO MENSUAL USD */}
              <div className="kf-card-dark" style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <h3 style={{ margin: "0 0 20px 0", color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                  Flujo Neto Promedio<br/><span style={{fontSize: 12, color: '#94A3B8', fontWeight: 500}}>Mensualizado en USD</span>
                </h3>
                
                <div style={{ width: "100%", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #334155" }}>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, fontWeight: 600 }}>Semestre 1</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (ingS1-egS1) >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono }}>
                     U$D {fmt(((ingS1 - egS1) / 6) / ultimoDolar)}
                  </div>
                </div>
                
                <div style={{ width: "100%", marginBottom: 20 }}>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, fontWeight: 600 }}>Semestre 2</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (ingS2-egS2) >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono }}>
                     U$D {fmt(((ingS2 - egS2) / 6) / ultimoDolar)}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#64748B', background: "#0F172A", padding: "6px 12px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={12} /> TC: ${fmt(ultimoDolar)}
                </div>
              </div>

              {/* GRÁFICO EGRESOS */}
              <div className="kf-card-dark" style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px 0", color: '#fff', fontSize: 15, textAlign: "center", fontWeight: 700 }}>Participación — Egresos</h3>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieEgresos} cx="50%" cy="50%" innerRadius={55} outerRadius={85} 
                        paddingAngle={0} dataKey="value" stroke="#172033" strokeWidth={2} labelLine={false} label={renderCustomizedLabel}
                      >
                        {pieEgresos.map((entry, index) => <Cell key={index} fill={COLORS_EG[index % COLORS_EG.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, fontFamily: tokens.fontBody, color: '#94A3B8', paddingLeft: 20 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── RANKING DE PROYECTOS — quién pesa más en el año, responde a la simulación ── */}
          <div className="kf-card-dark" style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>Proyectos — Total {selectedYear}{simulacionActiva ? " (simulado)" : ""}</h3>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{PLAN_PROJECT_CATS.filter(p => calcularTotalFila("egreso", p.key) > 0).length} con actividad este año</span>
            </div>
            <p style={{ margin: "2px 0 16px 0", fontSize: 12, color: '#64748B' }}>
              {simulacionActiva ? "Se actualiza con los sliders y los proyectos que apagaste arriba." : "Ordenado de mayor a menor peso en el presupuesto anual."}
            </p>
            {(() => {
              const ranking = PLAN_PROJECT_CATS
                .map(c => ({ key: c.key, name: c.label, value: calcularTotalFila("egreso", c.key), activo: isProyectoActivo(c.key) }))
                .filter(d => d.value > 0 || (simulacionActiva && !d.activo))
                .sort((a, b) => b.value - a.value);
              if (ranking.length === 0) {
                return <div style={{ padding: "20px 0", textAlign: "center", color: '#64748B', fontSize: 12.5 }}>Ningún proyecto tiene monto cargado para {selectedYear}.</div>;
              }
              return (
                <div style={{ height: Math.max(ranking.length * 30, 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#CBD5E1', fontSize: 11.5 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#fff', fontWeight: 700 }}
                        formatter={(value) => [`$ ${fmt(value)}`, "Total anual"]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {ranking.map((d, i) => (
                          <Cell key={d.key} fill={simulacionActiva && !d.activo ? "#334155" : tokens.gold} fillOpacity={simulacionActiva && !d.activo ? 0.5 : 1} />
                        ))}
                        <LabelList dataKey="value" position="right" formatter={(v) => v > 0 ? `$ ${fmt(v)}` : "apagado"} style={{ fill: '#94A3B8', fontSize: 10.5, fontFamily: tokens.fontMono }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>

          <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${simulacionActiva ? tokens.gold : colorLineaFuerte}`, overflow: "hidden", transition: "border-color 0.3s" }}>
             <div className="table-container" style={{ overflowX: "auto", paddingBottom: 8 }}>
                <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap", background: colorTablaBg }}>
                  <thead>
                    <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${simulacionActiva ? tokens.gold : colorLineaFuerte}`, transition: "border-color 0.3s" }}>
                      <th className="sticky-col" style={{ padding: 14, textAlign: "left", minWidth: 200, background: colorTablaBg }}>
                        Categoría del Presupuesto
                      </th>
                      {meses.map(m => (
                        <th key={m.k} style={{ padding: 14, textAlign: "right", minWidth: 90, fontFamily: tokens.fontMono }}>
                          <div>{m.n}</div>
                          {simulacionActiva && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: 8 }}>
                              <input type="range" className="sim-slider" min="-100" max="100" value={simData.meses[m.k] || 0} onChange={(e) => setSimData(prev => ({...prev, meses: {...prev.meses, [m.k]: Number(e.target.value)}}))} style={{width: 60}} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: simData.meses[m.k] !== 0 ? tokens.gold : tokens.textMuted }}>{simData.meses[m.k] > 0 ? '+' : ''}{simData.meses[m.k] || 0}%</span>
                            </div>
                          )}
                        </th>
                      ))}
                      <th style={{ padding: 14, textAlign: "right", minWidth: 100, fontFamily: tokens.fontMono, color: tokens.text }}>Total Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={14} style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, background: colorTablaBg }}>INGRESOS</td></tr>
                    {planIncomeCats.map(c => (
                       <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                          <td className="sticky-col" style={{ padding: "9px 14px 9px 24px", color: tokens.textMuted, background: colorTablaBg }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{fontWeight: 500}}>{c.label}</span>
                              {simulacionActiva && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[c.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [c.key]: Number(e.target.value)}}))} style={{width: 80}} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {meses.map(m => {
                            const valBase = planDraft?.ingreso?.[c.key]?.[m.k] || "";
                            return (
                              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                {editMode ? (
                                  <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("ingreso", c.key, m.k, e.target.value)} placeholder="0" />
                                ) : (
                                  <span style={{ color: getSimVal("ingreso", c.key, m.k) ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{getSimVal("ingreso", c.key, m.k) ? `$ ${fmt(getSimVal("ingreso", c.key, m.k))}` : "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("ingreso", c.key))}</td>
                       </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Ingresos</td>
                      {meses.map(m => <td key={m.k} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(calcularTotalColumna("ingreso", m.k))}</td>)}
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(planIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0))}</td>
                    </tr>

                    <tr><td colSpan={14} style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, background: colorTablaBg, borderTop: `2px solid ${colorLineaFuerte}` }}>EGRESOS</td></tr>
                    {/* ── GRUPO PROYECTOS: colapsable, con activar/desactivar por proyecto ── */}
                    <tr
                      className="flujo-row"
                      style={{ borderBottom: `1px solid ${colorLineaSuave}`, cursor: "pointer" }}
                      onClick={() => setProyectosExpanded(v => !v)}
                    >
                      <td className="sticky-col" style={{ padding: "10px 14px 10px 14px", background: colorTablaBg }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {proyectosExpanded ? <ChevronDown size={14} color={tokens.textMuted} /> : <ChevronRight size={14} color={tokens.textMuted} />}
                          <span style={{ fontWeight: 700, color: tokens.text }}>Proyectos</span>
                          <span style={{ fontSize: 10, color: tokens.textFaint, fontWeight: 600 }}>
                            ({PLAN_PROJECT_CATS.filter(p => isProyectoActivo(p.key)).length}/{PLAN_PROJECT_CATS.length} activos)
                          </span>
                        </div>
                        {simulacionActiva && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])))}
                              style={{ fontSize: 10, fontWeight: 600, color: tokens.positive, background: tokens.positiveSoft, border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
                            >
                              Activar todos
                            </button>
                            <button
                              onClick={() => setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, false])))}
                              style={{ fontSize: 10, fontWeight: 600, color: tokens.negative, background: tokens.negativeSoft, border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
                            >
                              Desactivar todos
                            </button>
                          </div>
                        )}
                      </td>
                      {meses.map(m => (
                        <td key={m.k} style={{ padding: "10px 14px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.textMuted }}>
                          $ {fmt(PLAN_PROJECT_CATS.reduce((acc, c) => acc + getSimVal("egreso", c.key, m.k), 0))}
                        </td>
                      ))}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>
                        $ {fmt(PLAN_PROJECT_CATS.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0))}
                      </td>
                    </tr>

                    {proyectosExpanded && PLAN_PROJECT_CATS.map(c => {
                      const activo = isProyectoActivo(c.key);
                      const apagado = simulacionActiva && !activo;
                      return (
                       <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}`, opacity: apagado ? 0.4 : 1, transition: "opacity 0.15s ease" }}>
                          <td className="sticky-col" style={{ padding: "9px 14px 9px 24px", color: tokens.textMuted, background: colorTablaBg }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {simulacionActiva && (
                                  <ToggleSwitch on={activo} onChange={(v) => setProyectosActivos(prev => ({ ...prev, [c.key]: v }))} />
                                )}
                                <span style={{ fontWeight: 500 }}>{c.label}</span>
                                {apagado && <span style={{ fontSize: 9.5, color: tokens.negative, fontWeight: 700 }}>APAGADO</span>}
                              </div>
                              {simulacionActiva && activo && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[c.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [c.key]: Number(e.target.value)}}))} style={{width: 80}} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {meses.map(m => {
                            const valBase = planDraft?.egreso?.[c.key]?.[m.k] || "";
                            return (
                              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                {editMode ? (
                                  <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)} placeholder="0" />
                                ) : (
                                  <span style={{ color: getSimVal("egreso", c.key, m.k) ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{getSimVal("egreso", c.key, m.k) ? `$ ${fmt(getSimVal("egreso", c.key, m.k))}` : "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("egreso", c.key))}</td>
                       </tr>
                      );
                    })}

                    {/* ── Resto de categorías de egresos (sin desglose de proyecto) ── */}
                    {otherExpenseCats.map(c => (
                       <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                          <td className="sticky-col" style={{ padding: "9px 14px 9px 24px", color: tokens.textMuted, background: colorTablaBg }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{fontWeight: 500}}>{c.label}</span>
                              {simulacionActiva && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[c.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [c.key]: Number(e.target.value)}}))} style={{width: 80}} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {meses.map(m => {
                            const valBase = planDraft?.egreso?.[c.key]?.[m.k] || "";
                            return (
                              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                {editMode ? (
                                  <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)} placeholder="0" />
                                ) : (
                                  <span style={{ color: getSimVal("egreso", c.key, m.k) ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{getSimVal("egreso", c.key, m.k) ? `$ ${fmt(getSimVal("egreso", c.key, m.k))}` : "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("egreso", c.key))}</td>
                       </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Egresos</td>
                      {meses.map(m => <td key={m.k} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: tokens.negative, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(calcularTotalColumna("egreso", m.k))}</td>)}
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: tokens.negative, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(planExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0))}</td>
                    </tr>
                  </tbody>
                </table>
             </div>
          </div>
        </>
      )}

      {view === "mapeo" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", color: tokens.positive, fontSize: 14 }}>Vincular INGRESOS</h3>
            {dailyIncomeCats.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colorLineaSuave}` }}>
                <span style={{ fontSize: 13, color: tokens.text, fontWeight: 500, width: "45%" }}>{c.label}</span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>pertenece a ➔</span>
                <div style={{ width: "45%" }}>
                  <select className="map-select" value={mappingDraft.ingreso?.[c.key] || ""} onChange={(e) => handleMappingChange("ingreso", c.key, e.target.value)}>
                    <option value="">(Sin asignar)</option>
                    {planIncomeCats.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", color: tokens.negative, fontSize: 14 }}>Vincular EGRESOS</h3>
            {dailyExpenseCats.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colorLineaSuave}` }}>
                <span style={{ fontSize: 13, color: tokens.text, fontWeight: 500, width: "45%" }}>{c.label}</span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>pertenece a ➔</span>
                <div style={{ width: "45%" }}>
                  <select className="map-select" value={mappingDraft.egreso?.[c.key] || ""} onChange={(e) => handleMappingChange("egreso", c.key, e.target.value)}>
                    <option value="">(Sin asignar)</option>
                    {planExpenseCats.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarImportadorPresupuesto && (
        <ImportadorPresupuestoExcel
          planIncomeCats={planIncomeCats}
          planExpenseCats={planExpenseCats}
          year={selectedYear}
          onGuardarPlan={(nuevoPlan, anio) => {
            onGuardarPlan(nuevoPlan, anio);
            if (anio === selectedYear) {
              setPlanDraft(nuevoPlan);
            }
          }}
          onClose={() => setMostrarImportadorPresupuesto(false)}
        />
      )}
    </div>
  );
}

// =========================================================================
// TABLA DE MOVIMIENTOS CON SISTEMA DE ACORDEÓN MENSUAL E INTERACCIÓN
// =========================================================================
function FlujoTable({ procesadas, weeks, tcList, incomeCats, expenseCats, fmt, onMoverMovimiento, formatDate, onEditClick }) {
  const [verIngresos, setVerIngresos] = useState(true);
  const [verEgresos, setVerEgresos] = useState(true);
  const [collapsedMonths, setCollapsedMonths] = useState(new Set()); 
  const [soloFuturos, setSoloFuturos] = useState(true); // Activo por defecto: Día de la fecha y proyecciones

  const hoy = todayISO();
  const fechaCorteFiltro = hoy;

  const procesadasFiltradas = useMemo(() => {
    if (!soloFuturos) return procesadas;
    const posteriores = procesadas.filter(w => w.week_start >= fechaCorteFiltro);
    return posteriores.length > 0 ? posteriores : procesadas;
  }, [procesadas, soloFuturos, fechaCorteFiltro]);

  const toggleMonth = (mesKey) => {
    setCollapsedMonths(prev => {
        const next = new Set(prev);
        if (next.has(mesKey)) next.delete(mesKey);
        else next.add(mesKey);
        return next;
    });
  };

  const toggleAllMonths = () => {
    if (collapsedMonths.size > 0) {
        setCollapsedMonths(new Set()); 
    } else {
        const allMonths = new Set();
        procesadasFiltradas.forEach(w => allMonths.add(w.week_start.substring(0, 7)));
        setCollapsedMonths(allMonths);
    }
  };

  const getTC = (date) => {
    if (!tcList || tcList.length === 0) return 1;
    const validTCs = tcList
        .filter(t => t.fecha_corte <= date)
        .sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
    return validTCs.length > 0 ? Number(validTCs[0].saldo_efectivo) || 1 : 1;
  };

  const columnasVisibles = useMemo(() => {
    const result = [];
    const mesesMap = {};

    procesadasFiltradas.forEach(w => {
        const mesKey = w.week_start.substring(0, 7);
        if (!mesesMap[mesKey]) {
            mesesMap[mesKey] = {
                isMonth: true,
                week_start: mesKey,
                income: {}, expense: {},
                totalIngresos: 0, totalEgresos: 0, posicion: 0,
                saldoAcumulado: w.saldoAcumulado,
                esArqueo: false, parsedNotes: {}
            };
        }
        const g = mesesMap[mesKey];
        
        const rawWeek = weeks.find(r => r.week_start === w.week_start) || {};
        const tc = getTC(w.week_start);

        Object.entries(rawWeek.income || {}).forEach(([k, v]) => { 
            let valPesos = 0;
            if (typeof v === 'object' && v !== null) valPesos = Number(v.ars||0) + Number(v.usd||0)*tc;
            else valPesos = Number(v||0);
            g.income[k] = (g.income[k] || 0) + valPesos; 
        });

        Object.entries(rawWeek.expense || {}).forEach(([k, v]) => { 
            let valPesos = 0;
            if (typeof v === 'object' && v !== null) valPesos = Number(v.ars||0) + Number(v.usd||0)*tc;
            else valPesos = Number(v||0);
            g.expense[k] = (g.expense[k] || 0) + valPesos; 
        });

        g.totalIngresos += w.totalIngresos;
        g.totalEgresos += w.totalEgresos;
        g.posicion += w.posicion;
        g.saldoAcumulado = w.saldoAcumulado; 
    });

    const uniqueMonths = Object.keys(mesesMap).sort();
    uniqueMonths.forEach(mesKey => {
        if (collapsedMonths.has(mesKey)) {
            result.push(mesesMap[mesKey]); 
        } else {
            procesadasFiltradas.filter(w => w.week_start.startsWith(mesKey)).forEach(d => {
                const rawWeek = weeks.find(r => r.week_start === d.week_start) || {};
                result.push({ ...d, isMonth: false, mesKey, rawIncome: rawWeek.income, rawExpense: rawWeek.expense }); 
            });
        }
    });
    return result;
  }, [procesadasFiltradas, collapsedMonths, weeks, tcList]);

  const monthGroups = useMemo(() => {
    const groups = [];
    let currentMes = null;
    let count = 0;
    columnasVisibles.forEach(col => {
        const mKey = col.isMonth ? col.week_start : col.mesKey;
        if (mKey !== currentMes) {
            if (currentMes !== null) {
                groups.push({ mesKey: currentMes, span: count, isCollapsed: collapsedMonths.has(currentMes) });
            }
            currentMes = mKey;
            count = 1;
        } else {
            count++;
        }
    });
    if (currentMes !== null) {
        groups.push({ mesKey: currentMes, span: count, isCollapsed: collapsedMonths.has(currentMes) });
    }
    return groups;
  }, [columnasVisibles, collapsedMonths]);

  const formatMonthKey = (mesKey) => {
    const [y, m] = mesKey.split("-");
    const mNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${mNames[parseInt(m, 10)-1]} ${y}`;
  };

  const handleDragStart = (e, origenFecha, tipo, key, ars, usd) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ origenFecha, tipo, key, ars, usd }));
  };

  const handleDrop = (e, destinoFecha, targetTipo, targetKey) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.tipo !== targetTipo || data.key !== targetKey) {
        alert("Solo puedes mover el importe a otra fecha del mismo concepto.");
        return;
      }
      onMoverMovimiento(data.origenFecha, destinoFecha, data.tipo, data.key, data.ars, data.usd);
    } catch (err) { console.error("Error al mover:", err); }
  };

  return (
    <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${colorLineaFuerte}`, background: colorTablaBg }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 15, fontWeight: 600 }}>Desglose de flujos</h3>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: tokens.textMuted }}>* Haz clic en los valores para editarlos, o en los meses para agruparlos.</p>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#E2E8F0", padding: 3, borderRadius: 8 }}>
            <button 
              type="button"
              onClick={() => setSoloFuturos(true)}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6, 
                padding: "6px 14px", 
                background: soloFuturos ? tokens.ink : "transparent", 
                color: soloFuturos ? "#fff" : tokens.ink, 
                border: "none", 
                borderRadius: 6, 
                cursor: "pointer", 
                fontWeight: 600, 
                fontSize: 12.5, 
                transition: "all 0.2s" 
              }}
            >
              <Clock size={14} color={soloFuturos ? tokens.gold : tokens.ink} />
              Día de la fecha ({formatDate(fechaCorteFiltro)}) y proyecciones
            </button>
            <button 
              type="button"
              onClick={() => setSoloFuturos(false)}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6, 
                padding: "6px 14px", 
                background: !soloFuturos ? tokens.ink : "transparent", 
                color: !soloFuturos ? "#fff" : tokens.ink, 
                border: "none", 
                borderRadius: 6, 
                cursor: "pointer", 
                fontWeight: 600, 
                fontSize: 12.5, 
                transition: "all 0.2s" 
              }}
            >
              Ver todo el histórico ({procesadas.length} días)
            </button>
          </div>

          <button 
            onClick={toggleAllMonths}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: collapsedMonths.size > 0 ? tokens.ink : "#fff", color: collapsedMonths.size > 0 ? "#fff" : tokens.text, border: `1px solid ${collapsedMonths.size > 0 ? tokens.ink : colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5, transition: "all 0.2s" }}
          >
            <CalendarDays size={15} /> {collapsedMonths.size > 0 ? "Expandir Todo" : "Compactar Todo por Mes"}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap", background: colorTablaBg }}>
          <thead>
            <tr style={{ height: "36px", color: tokens.text, borderBottom: `1px solid ${colorLineaFuerte}` }}>
              <th className="sticky-col" rowSpan={2} style={{ padding: 14, textAlign: "left", minWidth: 200, background: colorTablaBg, borderBottom: `2px solid ${colorLineaFuerte}` }}>Concepto Diario</th>
              {monthGroups.map((g, i) => (
                <th key={g.mesKey} colSpan={g.span} style={{ padding: "8px 14px", textAlign: "center", background: colorTotalBg, borderRight: i === monthGroups.length - 1 ? 'none' : `1px solid ${colorLineaFuerte}` }}>
                  <div 
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }} 
                    onClick={() => toggleMonth(g.mesKey)}
                    title={g.isCollapsed ? "Expandir días del mes" : "Compactar mes"}
                  >
                    {formatMonthKey(g.mesKey)}
                    {g.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </div>
                </th>
              ))}
            </tr>
            <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${colorLineaFuerte}` }}>
              {columnasVisibles.map((w, i) => (
                <th key={i} style={{ padding: "10px 14px", textAlign: "right", minWidth: 104, fontFamily: tokens.fontMono, background: w.isMonth ? colorTotalBg : colorTablaBg }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ color: w.isMonth ? tokens.text : tokens.textFaint, fontWeight: w.isMonth ? 700 : 500 }}>
                      {w.isMonth ? "Total Mes" : formatDate(w.week_start)}
                    </span>
                    {w.esArqueo && !w.isMonth && <span style={{ fontSize: 10, color: tokens.gold, fontWeight: "normal", marginTop: 2 }}>Arqueo Apertura</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* SALDO DE APERTURA / INICIO DEL DÍA */}
            <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}`, background: "#F8FAFC" }}>
              <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.ink, background: "#F8FAFC" }}>
                Saldo inicial de apertura
              </td>
              {columnasVisibles.map((w, i) => {
                const saldoIni = w.saldoAcumulado - w.posicion;
                return (
                  <td key={i} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: saldoIni >= 0 ? tokens.ink : tokens.negative, background: w.isMonth ? colorTotalBg : '#F8FAFC' }}>
                    {fmt(saldoIni)}
                  </td>
                );
              })}
            </tr>
            
            <tr onClick={() => setVerIngresos(!verIngresos)} style={{ cursor: "pointer", background: colorTablaBg }}>
              <td className="sticky-col" style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                {verIngresos ? <ChevronDown size={14} /> : <ChevronRight size={14} />} INGRESOS
              </td>
              <td colSpan={columnasVisibles.length}></td>
            </tr>

            {verIngresos && incomeCats.map((c) => (
              <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                {columnasVisibles.map((w, i) => {
                  
                  let monto = 0, ars = 0, usd = 0;
                  if (w.isMonth) {
                     monto = w.income?.[c.key] || 0;
                  } else {
                     const rawVal = w.rawIncome?.[c.key];
                     if (typeof rawVal === 'object' && rawVal !== null) {
                         ars = Number(rawVal.ars || 0);
                         usd = Number(rawVal.usd || 0);
                         const tc = getTC(w.week_start);
                         monto = ars + (usd * tc);
                     } else {
                         monto = Number(rawVal || 0);
                         ars = monto;
                     }
                  }

                  const nota = w.parsedNotes?.[`ingreso_${c.key}`];
                  const tooltipStr = w.isMonth ? "" : `ARS: $${fmt(ars)} | USD: U$D ${fmt(usd)}${nota ? `\nNota: ${nota}` : ''}\n(Clic para editar)`;

                  return (
                    <td key={i} onDragOver={(e) => !w.isMonth && e.preventDefault()} onDrop={(e) => !w.isMonth && handleDrop(e, w.week_start, "ingreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104, background: w.isMonth ? colorTotalBg : 'transparent' }}>
                      {monto > 0 ? (
                        w.isMonth ? (
                          <span style={{ color: tokens.positive, fontFamily: tokens.fontMono, fontWeight: 700 }}>{fmt(monto)}</span>
                        ) : (
                          <div 
                            className="draggable-chip" 
                            draggable={true} 
                            onDragStart={(e) => handleDragStart(e, w.week_start, "ingreso", c.key, ars, usd)}
                            onClick={() => onEditClick({ fecha: w.week_start, tipo: "ingreso", key: c.key, ars, usd, nota })}
                            title={tooltipStr}
                            style={{ position: "relative", cursor: "pointer", background: "#F0FDF4", border: "1px dashed #BBF7D0", borderRadius: 4, padding: "4px 8px", display: "inline-block", color: tokens.positive, fontFamily: tokens.fontMono, transition: "all 0.15s" }}
                          >
                            {fmt(monto)}
                            {nota && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: tokens.gold, borderRadius: '50%', border: '1px solid #fff' }} />}
                          </div>
                        )
                      ) : <span style={{ color: colorLineaFuerte, fontFamily: tokens.fontMono }}>-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <TotalRow label="Total ingresos" data={columnasVisibles} field="totalIngresos" color={tokens.positive} fmt={fmt} />

            <tr onClick={() => setVerEgresos(!verEgresos)} style={{ cursor: "pointer", background: colorTablaBg }}>
              <td className="sticky-col" style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                {verEgresos ? <ChevronDown size={14} /> : <ChevronRight size={14} />} EGRESOS
              </td>
              <td colSpan={columnasVisibles.length}></td>
            </tr>

            {verEgresos && expenseCats.map((c) => (
              <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                {columnasVisibles.map((w, i) => {
                  
                  let monto = 0, ars = 0, usd = 0;
                  if (w.isMonth) {
                     monto = w.expense?.[c.key] || 0;
                  } else {
                     const rawVal = w.rawExpense?.[c.key];
                     if (typeof rawVal === 'object' && rawVal !== null) {
                         ars = Number(rawVal.ars || 0);
                         usd = Number(rawVal.usd || 0);
                         const tc = getTC(w.week_start);
                         monto = ars + (usd * tc);
                     } else {
                         monto = Number(rawVal || 0);
                         ars = monto;
                     }
                  }

                  const nota = w.parsedNotes?.[`egreso_${c.key}`];
                  const tooltipStr = w.isMonth ? "" : `ARS: $${fmt(ars)} | USD: U$D ${fmt(usd)}${nota ? `\nNota: ${nota}` : ''}\n(Clic para editar)`;

                  return (
                    <td key={i} onDragOver={(e) => !w.isMonth && e.preventDefault()} onDrop={(e) => !w.isMonth && handleDrop(e, w.week_start, "egreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104, background: w.isMonth ? colorTotalBg : 'transparent' }}>
                      {monto > 0 ? (
                        w.isMonth ? (
                          <span style={{ color: tokens.negative, fontFamily: tokens.fontMono, fontWeight: 700 }}>{fmt(monto)}</span>
                        ) : (
                          <div 
                            className="draggable-chip" 
                            draggable={true} 
                            onDragStart={(e) => handleDragStart(e, w.week_start, "egreso", c.key, ars, usd)}
                            onClick={() => onEditClick({ fecha: w.week_start, tipo: "egreso", key: c.key, ars, usd, nota })}
                            title={tooltipStr}
                            style={{ position: "relative", cursor: "pointer", background: "#FEF2F2", border: "1px dashed #FECACA", borderRadius: 4, padding: "4px 8px", display: "inline-block", color: tokens.negative, fontFamily: tokens.fontMono, transition: "all 0.15s" }}
                          >
                            {fmt(monto)}
                            {nota && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: tokens.gold, borderRadius: '50%', border: '1px solid #fff' }} />}
                          </div>
                        )
                      ) : <span style={{ color: colorLineaFuerte, fontFamily: tokens.fontMono }}>-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <TotalRow label="Total egresos" data={columnasVisibles} field="totalEgresos" color={tokens.negative} fmt={fmt} />

            <tr className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaFuerte}` }}>
              <td className="sticky-col" style={{ padding: "16px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Flujo neto</td>
              {columnasVisibles.map((w, i) => (
                <td key={i} style={{ padding: "16px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, background: colorTotalBg, color: w.posicion >= 0 ? tokens.positive : tokens.negative }}>{fmt(w.posicion)}</td>
              ))}
            </tr>
            <tr className="flujo-row">
              <td className="sticky-col" style={{ padding: "18px 14px", fontWeight: 700, background: tokens.ink, color: "#fff" }}>Saldo final al cierre</td>
              {columnasVisibles.map((w, i) => (
                <td key={i} style={{ padding: "18px 14px", textAlign: "right", fontWeight: 700, background: w.isMonth ? "#0B1120" : tokens.ink, color: "#fff", fontFamily: tokens.fontMono }}>
                  {w.esArqueo && !w.isMonth && <span title={`Día con Arqueo de Apertura. Ajuste automático previo a pagos: $ ${fmt(w.ajuste)}`} style={{ color: tokens.gold, marginRight: 6 }}>★</span>}
                  {fmt(w.saldoAcumulado)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalRow({ label, data, field, color, fmt }) {
  return (
    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>{label}</td>
      {data.map((w, i) => (
        <td key={i} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color, background: colorTotalBg, fontFamily: tokens.fontMono }}>{fmt(w[field])}</td>
      ))}
    </tr>
  );
}
