import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import CargarMovimiento from "./CargarMovimiento";
import CategoryManager from "./CategoryManager";
import { tokens, fontImport } from "./tokens";
import { BASE_INCOME, BASE_EXPENSE, slugify, discoverCategories } from "./categories";
import { computeProjectCurve } from "./curveEngine";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, BarChart, Bar, LabelList
} from "recharts";
import {
  Wallet, CalendarX2, AlertTriangle, Save, Settings,
  ListChecks, Tag, SlidersHorizontal, Compass, CalendarRange,
  ChevronDown, ChevronRight, BarChart3, Pencil, Link as LinkIcon, Trash2,
  CalendarDays, Scale, Percent, TrendingDown, TrendingUp, DollarSign, Activity, Wand2, RotateCcw,
  Repeat, Building2, FileText, PiggyBank, Landmark, HardHat, Info, Users
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

// Ícono + explicación de qué compone cada categoría agregada — pensado para que
// alguien nuevo entienda la tabla sin tener que preguntar qué incluye cada línea.
const CATEGORY_META = {
  "custom_cupos-socios": { icon: Users, tip: "Ingreso por cupos de nuevos socios." },
  "custom_cuotas-mensuales": { icon: Repeat, tip: "Cuota mensual recurrente de socios activos." },
  "custom_ventas-cdo": { icon: Building2, tip: "Ventas de unidades bajo la modalidad CDO." },
  "custom_pesa": { icon: FileText, tip: "Ingresos por el esquema PESA." },
  "custom_aportes": { icon: PiggyBank, tip: "Aportes extraordinarios de socios." },
  "custom_rrhh": { icon: Users, tip: "Honorarios, capacitaciones, eventos RRHH, beneficios al personal, reclutamiento, sueldos, quincenas y cargas sociales." },
  "custom_administracion": { icon: Building2, tip: "Impuestos, gastos administrativos, marketing, Tdys (ET), CX, post venta y renta anticipada." },
  "custom_inversiones": { icon: TrendingUp, tip: "Colonia y terreno Neuquén." },
  "custom_pasivos-financieros": { icon: Landmark, tip: "Cudmani, otros bancos y Baja Sposito." },
};

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
    "custom_cupos-socios": { "01": 257444876, "02": 257444876, "03": 257444876, "04": 257444876, "05": 257444876, "06": 257444876, "07": 257444876, "08": 257444876, "09": 257444876, "10": 257444876, "11": 257444876, "12": 257444876 },
    "custom_cuotas-mensuales": { "01": 113295831, "02": 109548122, "03": 105735735, "04": 105735735, "05": 105735735, "06": 102862746, "07": 97833898, "08": 97833898, "09": 93118900, "10": 92547465, "11": 90134803, "12": 78152291 },
    "custom_ventas-cdo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pesa": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_aportes": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
  },
  "egreso": {
    "proy_torre-blue": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_zoe": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_torre-red": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_isaura": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_duo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_boulevard": { "01": 172411763, "02": 159937647, "03": 145387705, "04": 129009363, "05": 111110380, "06": 92072590, "07": 72373743, "08": 52624916, "09": 33642438, "10": 16616116, "11": 3732693, "12": 0 },
    "proy_torre-green": { "01": 109440800, "02": 126694964, "03": 142316772, "04": 156001181, "05": 167505525, "06": 176640459, "07": 183263874, "08": 187276822, "09": 188620908, "10": 187276822, "11": 183263874, "12": 176640459 },
    "proy_mas-duo": { "01": 40958735, "02": 82768771, "03": 129197014, "04": 177274029, "05": 224963322, "06": 270743221, "07": 313427922, "08": 352074373, "09": 385927936, "10": 414388283, "11": 436986998, "12": 453372519 },
    "proy_auria": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 6266480, "07": 27895293, "08": 56479244, "09": 88347209, "10": 121501726, "11": 154572337, "12": 186533160 },
    "proy_neuquen": { "01": 117937723, "02": 184483148, "03": 253715100, "04": 322771841, "05": 389511167, "06": 452258264, "07": 509674567, "08": 560681188, "09": 604410743, "10": 640175564, "11": 667446137, "12": 685836390 },
    "proy_300-t3-am": { "01": 168416898, "02": 163730214, "03": 157243470, "04": 149033028, "05": 139199733, "06": 127871237, "07": 115205293, "08": 101394420, "09": 86672684, "10": 71325860, "11": 55707548, "12": 40266748 },
    "proy_300-t4-am": { "01": 0, "02": 0, "03": 4593796, "04": 20380769, "05": 41099631, "06": 64007715, "07": 87608204, "08": 110875191, "09": 133043788, "10": 153520200, "11": 171834916, "12": 187615423 },
    "custom_rrhh": { "01": 236815521, "02": 236815521, "03": 236815521, "04": 236815521, "05": 236815521, "06": 350872103, "07": 236815521, "08": 236815521, "09": 236815521, "10": 236815521, "11": 236815521, "12": 301213650 },
    "custom_administracion": { "01": 90606111, "02": 97137747, "03": 119725719, "04": 73063940, "05": 96883255, "06": 78921432, "07": 76386484, "08": 88528963, "09": 79169543, "10": 68281956, "11": 70245627, "12": 34586780 },
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
const todayISO = () => new Date().toISOString().slice(0, 10);

// NAVEGACIÓN
const NAV = [
  { id: "resumen", label: "Resumen", icon: Compass },
  { id: "monitor", label: "Monitor Económico", icon: Activity },
  { id: "presupuesto", label: "Presupuesto Anual", icon: BarChart3 },
  { id: "movimientos", label: "Movimientos", icon: ListChecks },
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
  const [movimientoAEditar, setMovimientoAEditar] = useState(null); 

  const [arqueosList, setArqueosList] = useState([]);
  const [saldoEfectivo, setSaldoEfectivo] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");
  const [fechaSaldo, setFechaSaldo] = useState(todayISO());

  const [tcList, setTcList] = useState([]);
  const [fechaTC, setFechaTC] = useState(todayISO());
  const [valorTC, setValorTC] = useState("");

  useEffect(() => { fetchData(); }, []);

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
    const { data: wData } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    if (wData) setWeeks(wData);
    
    const { data: sData } = await supabase.from("cashflow_settings").select("*");
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

  const handleBorrarDatos = async () => {
    if (!window.confirm("¿Borrar proyecciones?")) return;
    await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    fetchData();
  };

  const guardarMovimiento = async ({ fecha, tipo, key, montoArs, montoUsd, estado, nota }) => {
    const base = weeks.find((w) => w.week_start === fecha) || { id: fecha, week_start: fecha, status: estado, income: {}, expense: {}, notes: "" };
    let currentNotes = {}; try { currentNotes = JSON.parse(base.notes || "{}"); } catch(e) {}
    if (nota) currentNotes[`${tipo}_${key}`] = nota; else delete currentNotes[`${tipo}_${key}`];

    const actualizada = { ...base, status: estado || base.status, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) }, notes: JSON.stringify(currentNotes) };
    const field = tipo === "ingreso" ? "income" : "expense";
    actualizada[field][key] = { ars: Number(montoArs) || 0, usd: Number(montoUsd) || 0 };

    await supabase.from("cashflow_weeks").upsert(actualizada);
    fetchData(); return true;
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
        
        {tab === "resumen" && <ResumenTab procesadas={procesadas} kpis={kpis} fmt={fmt} formatDate={formatDate} />}
        
        {/* MÓDULO: MONITOR ECONÓMICO */}
        {tab === "monitor" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", gap: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Monitor Económico</h2>
              <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Indicadores y mercado en tiempo real, integrado desde tu proyecto externo.</p>
            </div>
            <div style={{ flex: 1, background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden" }}>
              <iframe src="https://monitor-econ-mico.vercel.app/" style={{ width: "100%", height: "100%", border: "none" }} title="Monitor Económico" />
            </div>
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setMostrarPanel(!mostrarPanel)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: mostrarPanel ? tokens.surface : tokens.ink, color: mostrarPanel ? tokens.text : "#fff", border: `1px solid ${mostrarPanel ? colorLineaFuerte : tokens.ink}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>
                {mostrarPanel ? "Ocultar panel de carga" : "+ Cargar movimiento"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mostrarPanel ? "340px 1fr" : "1fr", gap: 20, alignItems: "start", transition: "all 0.3s" }}>
              {mostrarPanel && (
                <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22, position: "sticky", top: 32 }}>
                  <CargarMovimiento incomeCats={incomeCats} expenseCats={expenseCats} weeks={weeks} onGuardar={guardarMovimiento} onEliminar={eliminarMovimiento} formatDate={formatDate} movimientoAEditar={movimientoAEditar} setMovimientoAEditar={setMovimientoAEditar} />
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

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 4, maxWidth: 720 }}><ImportadorCashflow baseIncome={BASE_INCOME} baseExpense={BASE_EXPENSE} onImportarSemanas={handleImportarSemanas} onBorrarDatos={handleBorrarDatos} semanasExistentes={weeks} /></div>
          </div>
        )}
      </main>
    </div>
  );
}

const fieldInputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${colorLineaFuerte}`, borderRadius: 5, fontSize: 13, fontFamily: tokens.fontBody, outline: "none", boxSizing: "border-box" };
const curveFieldStyle = { display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, color: tokens.textMuted, fontWeight: 500 };
const curveInputStyle = { padding: "5px 7px", border: `1px solid ${colorLineaFuerte}`, borderRadius: 5, fontSize: 12, fontFamily: tokens.fontMono, outline: "none", width: 118, boxSizing: "border-box" };

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

/* Mini-gráfico de 12 puntos, inline SVG (sin recharts) — la "forma" del año de un vistazo */
function RowSparkline({ data, color, width = 64, height = 20 }) {
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  if (max === 0) return <div style={{ width, height, flexShrink: 0 }} />;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

/* Ícono "ⓘ" con popover explicativo al pasar el mouse */
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  if (!text) return null;
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={12} color={tokens.textFaint} style={{ cursor: "help" }} />
      {show && (
        <div style={{
          position: "absolute", left: 16, top: -6, zIndex: 30, width: 210,
          background: tokens.ink, color: "#E7EAF0", fontSize: 10.5, lineHeight: 1.5,
          fontWeight: 400, padding: "9px 11px", borderRadius: 7, boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
          whiteSpace: "normal",
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

/* Color de fondo de celda proporcional al peso del mes dentro de su propia fila (mapa de calor) */
function heatBg(value, rowMaxAbs, hex) {
  if (!value || !rowMaxAbs) return "transparent";
  const alpha = Math.min(0.4, 0.05 + (Math.abs(value) / rowMaxAbs) * 0.35);
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
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

function ResumenTab({ procesadas, kpis, fmt, formatDate }) {
  if (procesadas.length === 0) return (<div style={{ textAlign: "center", padding: "100px 20px", background: tokens.surface, borderRadius: 10, border: `1px dashed ${colorLineaFuerte}` }}>Sin datos cargados.</div>);
  return (
    <>
      <div><h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Resumen Ejecutivo</h2></div>
      
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

  // ESTADO DEL SIMULADOR CON BARRAS
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  const [simData, setSimData] = useState({ globalIng: 0, globalEg: 0, cats: {}, meses: {} });
  const [proyectosExpanded, setProyectosExpanded] = useState(true);
  // Todos activos por defecto — false explícito = el proyecto está "apagado" en la simulación.
  const [proyectosActivos, setProyectosActivos] = useState({});
  const projectKeys = useMemo(() => new Set(PLAN_PROJECT_CATS.map(p => p.key)), []);
  const isProyectoActivo = (key) => proyectosActivos[key] !== false;

  // ── CURVA S POR PROYECTO ──
  // Por proyecto: { total, inicio: "YYYY-MM", duracionBase (meses), ritmo (%), activo }.
  // Cuando activo=true, los 12 valores mensuales de ese proyecto dejan de editarse
  // celda por celda y se recalculan en vivo con la curva S (mismo motor validado
  // contra el Excel 2027_v2_0.xlsx). Se guarda junto con el resto del plan en
  // planDraft.curvas, así que persiste en Supabase sin tocar el esquema.
  const [curveParams, setCurveParams] = useState({});
  const getCurveParams = (key) =>
    curveParams[key] || { total: 0, inicio: "", duracionBase: 12, ritmo: 100, activo: false };
  const updateCurveParam = (key, field, value) => {
    setCurveParams(prev => ({ ...prev, [key]: { ...getCurveParams(key), [field]: value } }));
  };

  useEffect(() => {
    setPlanDraft(planesFondos[selectedYear] || { ingreso: {}, egreso: {} });
    setCurveParams(planesFondos[selectedYear]?.curvas || {});
  }, [planesFondos, selectedYear, editMode, view]);

  // Cada vez que cambian los parámetros de curva de un proyecto activo, sus 12
  // valores mensuales en planDraft se recalculan automáticamente — planDraft
  // sigue siendo la única fuente de verdad para totales, gráficos y heatmap.
  useEffect(() => {
    let cambio = false;
    const egresoActualizado = {};
    Object.entries(curveParams).forEach(([key, cp]) => {
      if (!cp || !cp.activo) return;
      const { monthly } = computeProjectCurve(cp.total, cp.inicio, cp.duracionBase, cp.ritmo, selectedYear);
      egresoActualizado[key] = monthly;
      cambio = true;
    });
    if (cambio) {
      setPlanDraft(prev => ({ ...prev, egreso: { ...prev.egreso, ...egresoActualizado } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curveParams, selectedYear]);

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
      onGuardarPlan({ ...planDraft, curvas: curveParams }, selectedYear);
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

  // ── Fila de categoría reutilizable: ícono + tooltip + sparkline + heatmap + slider ──
  const renderCategoryRow = (c, tipo, { isProject = false } = {}) => {
    const meta = CATEGORY_META[c.key];
    const Icon = isProject ? HardHat : meta?.icon;
    const accent = tipo === "ingreso" ? tokens.positive : tokens.gold;
    const heatColor = tipo === "ingreso" ? tokens.positive : tokens.negative;
    const rowVals = meses.map(m => getSimVal(tipo, c.key, m.k));
    const rowMaxAbs = Math.max(...rowVals.map(v => Math.abs(v)), 0);
    const activo = isProject ? isProyectoActivo(c.key) : true;
    const apagado = isProject && simulacionActiva && !activo;
    const cp = isProject ? getCurveParams(c.key) : null;
    const curveResult = isProject
      ? computeProjectCurve(cp.total, cp.inicio, cp.duracionBase, cp.ritmo, selectedYear)
      : null;
    const modoCurva = isProject && cp.activo;

    return (
      <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}`, opacity: apagado ? 0.4 : 1, transition: "opacity 0.15s ease" }}>
        <td className="sticky-col" style={{ padding: isProject ? "9px 14px 9px 24px" : "9px 14px", color: tokens.textMuted, background: colorTablaBg }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {isProject && simulacionActiva && (
                <ToggleSwitch on={activo} onChange={(v) => setProyectosActivos(prev => ({ ...prev, [c.key]: v }))} />
              )}
              {Icon && <Icon size={13} color={tokens.textFaint} style={{ flexShrink: 0 }} />}
              <span style={{ fontWeight: 500, color: tokens.text }}>{c.label}</span>
              {meta?.tip && <InfoTip text={meta.tip} />}
              {apagado && <span style={{ fontSize: 9.5, color: tokens.negative, fontWeight: 700 }}>APAGADO</span>}
              {isProject && editMode && (
                <button
                  type="button"
                  onClick={() => updateCurveParam(c.key, "activo", !cp.activo)}
                  title="Calcular los 12 meses con curva S en vez de cargarlos a mano"
                  style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 5, cursor: "pointer", fontWeight: 700,
                    border: `1px solid ${cp.activo ? tokens.gold : colorLineaFuerte}`,
                    background: cp.activo ? tokens.goldSoft : "#fff",
                    color: cp.activo ? tokens.gold : tokens.textMuted,
                  }}
                >
                  {cp.activo ? "Curva S ✓" : "Curva S"}
                </button>
              )}
              {!editMode && <span style={{ marginLeft: "auto" }}><RowSparkline data={rowVals} color={accent} /></span>}
            </div>
            {simulacionActiva && activo && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[c.key] || 0} onChange={(e) => setSimData(prev => ({ ...prev, cats: { ...prev.cats, [c.key]: Number(e.target.value) } }))} style={{ width: 80 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[c.key] > 0 ? "+" : ""}{simData.cats[c.key] || 0}%</span>
              </div>
            )}
          </div>
        </td>
        {editMode && modoCurva ? (
          <td colSpan={meses.length} style={{ padding: "10px 14px", background: tokens.paper }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
              <label style={curveFieldStyle}>
                Presupuesto
                <input type="number" value={cp.total} onChange={(e) => updateCurveParam(c.key, "total", Number(e.target.value) || 0)} style={curveInputStyle} />
              </label>
              <label style={curveFieldStyle}>
                Inicio
                <input type="month" value={cp.inicio} onChange={(e) => updateCurveParam(c.key, "inicio", e.target.value)} style={curveInputStyle} />
              </label>
              <label style={curveFieldStyle}>
                Duración base (m)
                <input type="number" min="1" value={cp.duracionBase} onChange={(e) => updateCurveParam(c.key, "duracionBase", Number(e.target.value) || 1)} style={{ ...curveInputStyle, width: 56 }} />
              </label>
              <label style={curveFieldStyle}>
                Ritmo de ejecución
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="range" min="40" max="160" step="5" value={cp.ritmo} onChange={(e) => updateCurveParam(c.key, "ritmo", Number(e.target.value))} style={{ width: 90 }} />
                  <span style={{ fontFamily: tokens.fontMono, fontSize: 11, color: tokens.gold, width: 32 }}>{cp.ritmo}%</span>
                </div>
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, color: tokens.textMuted }}>
                <span>Fin efectivo</span>
                <span style={{ fontFamily: tokens.fontMono, fontSize: 12, color: tokens.text, fontWeight: 600 }}>{curveResult.finEfectivoLabel}</span>
              </div>
              <span
                style={{
                  fontSize: 10.5, fontFamily: tokens.fontMono, padding: "3px 9px", borderRadius: 5, fontWeight: 700,
                  background: curveResult.atraso > 0.05 ? tokens.negativeSoft : curveResult.atraso < -0.05 ? tokens.positiveSoft : colorTablaBg,
                  color: curveResult.atraso > 0.05 ? tokens.negative : curveResult.atraso < -0.05 ? tokens.positive : tokens.textMuted,
                }}
              >
                {curveResult.atraso > 0.05 ? `+${curveResult.atraso.toFixed(1)} m atraso` : curveResult.atraso < -0.05 ? `${curveResult.atraso.toFixed(1)} m adelanto` : "en plazo"}
              </span>
            </div>
          </td>
        ) : (
          meses.map((m, i) => {
            const valBase = planDraft?.[tipo]?.[c.key]?.[m.k] || "";
            const simVal = rowVals[i];
            return (
              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right", background: editMode ? "transparent" : heatBg(simVal, rowMaxAbs, heatColor) }}>
                {editMode ? (
                  <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange(tipo, c.key, m.k, e.target.value)} placeholder="0" disabled={modoCurva} />
                ) : (
                  <span style={{ color: simVal ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{simVal ? `$ ${fmt(simVal)}` : "-"}</span>
                )}
              </td>
            );
          })
        )}
        <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila(tipo, c.key))}</td>
      </tr>
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
             <button onClick={() => setView("mapeo")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.surface, color: tokens.text, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                <LinkIcon size={16} /> Mapear Conceptos
             </button>
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
                    {planIncomeCats.map(c => renderCategoryRow(c, "ingreso"))}
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

                    {proyectosExpanded && PLAN_PROJECT_CATS.map(c => renderCategoryRow(c, "egreso", { isProject: true }))}

                    {/* ── Resto de categorías de egresos (sin desglose de proyecto) ── */}
                    {otherExpenseCats.map(c => renderCategoryRow(c, "egreso"))}
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
        procesadas.forEach(w => allMonths.add(w.week_start.substring(0, 7)));
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

    procesadas.forEach(w => {
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
            procesadas.filter(w => w.week_start.startsWith(mesKey)).forEach(d => {
                const rawWeek = weeks.find(r => r.week_start === d.week_start) || {};
                result.push({ ...d, isMonth: false, mesKey, rawIncome: rawWeek.income, rawExpense: rawWeek.expense }); 
            });
        }
    });
    return result;
  }, [procesadas, collapsedMonths, weeks, tcList]);

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
        
        <button 
          onClick={toggleAllMonths}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: collapsedMonths.size > 0 ? tokens.ink : "#fff", color: collapsedMonths.size > 0 ? "#fff" : tokens.text, border: `1px solid ${collapsedMonths.size > 0 ? tokens.ink : colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5, transition: "all 0.2s" }}
        >
          <CalendarDays size={15} /> {collapsedMonths.size > 0 ? "Expandir Todo" : "Compactar Todo por Mes"}
        </button>
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
