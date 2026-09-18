import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import CargarMovimiento from "./CargarMovimiento";
import CategoryManager from "./CategoryManager";
import { tokens, fontImport } from "./tokens";
import { BASE_INCOME, BASE_EXPENSE, slugify, discoverCategories } from "./categories";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Wallet, CalendarX2, AlertTriangle, Save, Settings,
  ListChecks, Tag, SlidersHorizontal, Compass,
  ChevronDown, ChevronRight, BarChart3, Pencil, Link as LinkIcon, Trash2,
  CalendarDays, Scale, Percent, TrendingDown, DollarSign, Activity, Wand2, RotateCcw
} from "lucide-react";

// =========================================================================
// ESCUDO ANTI-EXCEL: Normalizador estricto de fechas
// =========================================================================
const normalizeDate = (dStr) => {
  if (!dStr) return null;
  if (typeof dStr === 'number') {
     const d = new Date(Math.round((dStr - 25569) * 86400 * 1000));
     return d.toISOString().slice(0, 10);
  }
  const s = String(dStr).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s; 
  if (s.includes('T')) return s.split('T')[0];  
  
  if (s.includes('/')) {
    const p = s.split('/');
    if (p.length === 3) {
      if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
    }
  }
  if (s.includes('-')) {
    const p = s.split('-');
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }
  const t = new Date(s);
  if (!isNaN(t.getTime())) {
    const tzOffset = t.getTimezoneOffset() * 60000;
    return new Date(t.getTime() - tzOffset).toISOString().slice(0, 10);
  }
  return null;
};

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const formatDate = (isoStr) => {
  if (!isoStr || !isoStr.includes("-")) return isoStr;
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

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

const PLAN_EXPENSE_CATS = [
  { 
    isGroup: true, 
    label: "Desglose de Proyectos", 
    subCats: [
      { key: "custom_torre-red", label: "TORRE RED" },
      { key: "custom_isaura", label: "ISAURA" },
      { key: "custom_duo", label: "DUO" },
      { key: "custom_300-t1-am", label: "#300 - T1 + AM" },
      { key: "custom_300-t2-am", label: "#300 - T2 + AM" },
      { key: "custom_300-t3-am", label: "#300 - T3 + AM" },
      { key: "custom_300-t4-am", label: "#300 - T4 + AM" },
      { key: "custom_300-corporativo", label: "#300 - CORPORATIVO" },
      { key: "custom_300-infra", label: "#300 - INFRA" },
      { key: "custom_boulevard", label: "BOULEVARD" },
      { key: "custom_torre-green", label: "TORRE GREEN" },
      { key: "custom_plus-duo", label: "+DUO" },
      { key: "custom_auria", label: "AURIA" },
      { key: "custom_marcos-paz-82", label: "MARCOS PAZ 82" },
      { key: "custom_neuquen", label: "NEUQUEN" }
    ]
  },
  { key: "custom_rrhh", label: "RRHH" },
  { key: "custom_administracion", label: "Gastos de Estructura" },
  { key: "custom_inversiones", label: "Inversiones" },
  { key: "custom_pasivos-financieros", label: "Pasivos Financieros" }
];

// DATA BASE: CURVAS SIGMOIDEAS
const DEFAULT_PLAN_2026 = {
  "ingreso": {
    "custom_cupos-socios": {"01": 188542320, "02": 188542320, "03": 188542320, "04": 188542320, "05": 188542320, "06": 188542320, "07": 233273820, "08": 233273820, "09": 233273820, "10": 233273820, "11": 233273820, "12": 233273820},
    "custom_cuotas-mensuales": {"01": 216094107, "02": 210193927, "03": 207243837, "04": 208718882, "05": 210931449, "06": 221256765, "07": 166503716, "08": 394424755, "09": 391424755, "10": 138308205, "11": 135987535, "12": 120871098},
    "custom_ventas-cdo": {"01": 471643592, "02": 477543773, "03": 480493863, "04": 479018818, "05": 179921317, "06": 217557503, "07": 214152451, "08": 271670000},
    "custom_pesa": {"05": 389439154, "06": 248923431, "07": 248923431, "08": 248923431, "09": 248923431}
  },
  "egreso": {
    "custom_duo": {"01": 385603761, "02": 361185188, "03": 328239774, "04": 290189317, "05": 250349167, "06": 211449122, "07": 175411949, "08": 143354697, "09": 115726873, "10": 92499807, "11": 81959122},
    "custom_300-t2-am": {"01": 128457210, "02": 122732795, "03": 113918280, "04": 102926993, "05": 90753320, "06": 78309333, "07": 66319152, "08": 55278791, "09": 45467704, "10": 36989936, "11": 29824880, "12": 26561767},
    "custom_300-t3-am": {"07": 56550482, "08": 65010527, "09": 83881880, "10": 106714703, "11": 133358356, "12": 162993876},
    "custom_300-corporativo": {"01": 145125219, "02": 138658031, "03": 128699785, "04": 116282320, "05": 102529048, "06": 88470387, "07": 74924417, "08": 62451509, "09": 51367382, "10": 41789578, "11": 33694817, "12": 30008298},
    "custom_boulevard": {"01": 136157876, "02": 152509263, "03": 168634693, "04": 183828557, "05": 197309458, "06": 208289944, "07": 216063525, "08": 220094856, "09": 220094856, "10": 216063525, "11": 208289944, "12": 197309458},
    "custom_torre-green": {"07": 37948729, "08": 41901366, "09": 50476567, "10": 60433585, "11": 71824287, "12": 84619972},
    "custom_plus-duo": {"12": 89498346},
    "custom_neuquen": {"11": 133167715, "12": 146055863},
    "custom_rrhh": {"01": 815400, "02": 586308, "03": 586308, "04": 586308, "05": 641670, "06": 641670, "07": 1030574, "08": 1073982, "09": 685077, "10": 1073982, "11": 1073982, "12": 1073982},
    "custom_administracion": {"01": 31668265, "02": 31668265, "03": 31668265, "04": 31668265, "05": 31668265, "06": 31668265, "07": 31668265, "08": 31668265, "09": 31668265, "10": 31668265, "11": 31668265, "12": 31668265},
    "custom_inversiones": {"01": 80318625, "02": 78125625, "03": 77029125, "04": 77577375, "05": 78399750, "06": 80592750, "07": 84736950, "08": 84736950, "09": 84736950, "10": 84736950, "11": 7236950, "12": 7236950},
    "custom_pasivos-financieros": {"01": 57268446, "02": 55950406, "03": 55291386, "04": 55620896, "05": 73580580, "06": 75387163, "07": 79000330, "08": 79743600, "09": 79000330, "10": 79000330, "11": 79000330, "12": 79000330},
  }
};

const DEFAULT_PLAN_2027 = {
  "ingreso": {
    "custom_cupos-socios": {"01": 257444876, "02": 257444876, "03": 257444876, "04": 257444876, "05": 257444876, "06": 257444876, "07": 257444876, "08": 257444876, "09": 257444876, "10": 257444876, "11": 257444876, "12": 257444876},
    "custom_cuotas-mensuales": {"01": 113295831, "02": 109548122, "03": 105735735, "04": 105735735, "05": 105735735, "06": 102862746, "07": 97833898, "08": 97833898, "09": 93118900, "10": 92547465, "11": 90134803, "12": 78152291}
  },
  "egreso": {
    "custom_300-t3-am": {"01": 193912215, "02": 223453266, "03": 248256774, "04": 264896075, "05": 270767960, "06": 264896075, "07": 248256774, "08": 223453266, "09": 193912215, "10": 162993876, "11": 133358356, "12": 106714703},
    "custom_300-t4-am": {"03": 44220947, "04": 49009204, "05": 59425643, "06": 71573622, "07": 85511510, "08": 101184435, "09": 118376255, "10": 136663320, "11": 155382578, "12": 173630544},
    "custom_boulevard": {"01": 183828557, "02": 168634693, "03": 152509263, "04": 136157876, "05": 120165182, "06": 104974775, "07": 90889860, "08": 78088151, "09": 66644379, "10": 56555043, "11": 47761764, "12": 43679098},
    "custom_torre-green": {"01": 98677049, "02": 113702887, "03": 129229704, "04": 144607225, "05": 159025595, "06": 171576771, "07": 181354017, "08": 187576483, "09": 189713411, "10": 187576483, "11": 181354017, "12": 171576771},
    "custom_plus-duo": {"01": 98478147, "02": 117909833, "03": 140378962, "04": 166008889, "05": 194764406, "06": 226384076, "07": 260311146, "08": 295636652, "09": 331073836, "10": 364985593, "11": 395482916, "12": 420599617},
    "custom_auria": {"06": 6266480, "07": 27895292, "08": 56479243, "09": 88347208, "10": 121501726, "11": 154572337, "12": 186533159},
    "custom_marcos-paz-82": {"06": 66154138, "07": 72791702, "08": 87154944, "09": 103763361, "10": 122708132, "11": 143963235, "12": 167335421},
    "custom_neuquen": {"01": 173877710, "02": 205921125, "03": 242367957, "04": 283201961, "05": 328124288, "06": 376465420, "07": 427108470, "08": 478445410, "09": 528391816, "10": 574483616, "11": 614067771, "12": 644577070},
    "custom_administracion": {"01": 28284198, "02": 32389613, "03": 28806648, "04": 24539869, "05": 27031930, "06": 25296381, "07": 27887914, "08": 26164293, "09": 32400810, "10": 27001562, "11": 29623698, "12": 27882789},
    "custom_inversiones": {"01": 7187180, "02": 7187180, "03": 7187180, "04": 7187180, "05": 7187180, "06": 7187180, "07": 7187180, "08": 7187180, "09": 7187180, "10": 7187180, "11": 7187180, "12": 7187180},
    "custom_pasivos-financieros": {"01": 59222932, "02": 50889517, "03": 50888404, "04": 50745203},
  }
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

  /* BARRAS SIMULADOR (SANDBOX) */
  .sim-slider {
    -webkit-appearance: none; width: 100%; height: 5px; border-radius: 3px; background: #DCE1E8; outline: none; cursor: pointer;
  }
  .sim-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${tokens.gold}; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .sim-slider:active::-webkit-slider-thumb { transform: scale(1.2); }

  /* TOGGLE ON/OFF PROYECTOS */
  .toggle-switch {
    position: relative; display: inline-block; width: 34px; height: 18px;
  }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .slider-toggle {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; border-radius: 18px;
  }
  .slider-toggle:before {
    position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%;
  }
  input:checked + .slider-toggle { background-color: ${tokens.positive}; }
  input:checked + .slider-toggle:before { transform: translateX(16px); }
  
  .sim-row-disabled td {
    opacity: 0.35;
    background-color: #F8FAFC !important;
    transition: all 0.3s ease;
  }
  .sim-row-disabled .sticky-col { opacity: 0.7; }
`;

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
    
    if (wData) {
      const cleanedWeeks = wData.map(w => ({ ...w, week_start: normalizeDate(w.week_start) })).filter(w => w.week_start !== null);
      setWeeks(cleanedWeeks);
    }
    
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

      if (!planesTemporales["2026"]) {
        planesTemporales["2026"] = DEFAULT_PLAN_2026;
        await supabase.from("cashflow_plan").upsert({ id: "2026", data: DEFAULT_PLAN_2026 });
      }
      if (!planesTemporales["2027"]) {
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
    // Al importar aseguramos que las fechas entren normalizadas
    const normalized = semanasNuevas.map(w => ({...w, week_start: normalizeDate(w.week_start)})).filter(w => w.week_start !== null);
    await supabase.from("cashflow_weeks").upsert(normalized);
    fetchData();
  };

  const handleBorrarDatos = async () => {
    if (!window.confirm("ATENCIÓN: ¿Seguro que deseas borrar TODOS los movimientos diarios de la base de datos?")) return;
    await supabase.from("cashflow_weeks").delete().neq("week_start", "dummy_value");
    fetchData();
  };

  const guardarMovimiento = async ({ fecha, tipo, key, montoArs, montoUsd, estado, nota }) => {
    const fSafe = normalizeDate(fecha);
    const base = weeks.find((w) => w.week_start === fSafe) || { id: fSafe, week_start: fSafe, status: estado, income: {}, expense: {}, notes: "" };
    let currentNotes = {}; try { currentNotes = JSON.parse(base.notes || "{}"); } catch(e) {}
    if (nota) currentNotes[`${tipo}_${key}`] = nota; else delete currentNotes[`${tipo}_${key}`];

    const actualizada = { ...base, status: estado || base.status, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) }, notes: JSON.stringify(currentNotes) };
    const field = tipo === "ingreso" ? "income" : "expense";
    actualizada[field][key] = { ars: Number(montoArs) || 0, usd: Number(montoUsd) || 0 };

    await supabase.from("cashflow_weeks").upsert(actualizada);
    fetchData(); return true;
  };

  const eliminarMovimiento = async (fecha, tipo, key) => {
    const fSafe = normalizeDate(fecha);
    const existente = weeks.find((w) => w.week_start === fSafe); if (!existente) return;
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
    const fDest = normalizeDate(destinoFecha);
    const destino = weeks.find((w) => w.week_start === fDest) || { id: fDest, week_start: fDest, status: "proyectado", income: {}, expense: {}, notes: "" };
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
    const key = "custom_" + slugify(label); const anchor = todayISO();
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
    
    let fallbackSaldo = 0;
    if (arqueosList.length > 0) {
      const sortA = [...arqueosList].sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
      fallbackSaldo = Number(sortA[0].saldo_efectivo) + Number(sortA[0].saldo_banco);
    }
    const saldoHoy = pasadas.length ? pasadas[pasadas.length - 1].saldoAcumulado : fallbackSaldo;

    let diasDeCaja = null, deficitActual = false, sinQuemaNeta = false;
    const semanaDeficit = procesadas.find((w) => w.week_start >= hoy && w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";

    if (saldoHoy < 0) { deficitActual = true; diasDeCaja = 0; } 
    else if (semanaDeficit) {
      diasDeCaja = Math.ceil((new Date(semanaDeficit.week_start + "T00:00:00").getTime() - new Date(hoy + "T00:00:00").getTime()) / (1000 * 3600 * 24));
    } else { sinQuemaNeta = true; }

    const ultimaFecha = procesadas[procesadas.length - 1]?.week_start || hoy;
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

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 4, maxWidth: 720 }}>
                <ImportadorCashflow baseIncome={BASE_INCOME} baseExpense={BASE_EXPENSE} onImportarSemanas={handleImportarSemanas} onBorrarDatos={handleBorrarDatos} semanasExistentes={weeks} />
            </div>
            
            <div style={{ marginTop: 10 }}>
              <button onClick={handleBorrarDatos} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: tokens.negativeSoft, color: tokens.negative, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>
                  <Trash2 size={16} /> Borrar Movimientos Importados (Reiniciar Sistema)
              </button>
              <p style={{ fontSize: 11, color: tokens.textMuted, marginTop: 6, maxWidth: 600 }}>Si tu Excel subió fechas erróneas (ej. del 2022) y el Cashflow se desconfiguró, presiona este botón para limpiar todos los movimientos y empezar de cero con la base sana.</p>
            </div>

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
    <div style={{ background: tokens.surface, padding: "20px 22px", borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontFamily: tokens.fontMono, fontSize: 25, fontWeight: 600, color, marginTop: 6, letterSpacing: "-0.5px" }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: tokens.textFaint, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ background: tokens.paper, padding: 10, borderRadius: 8, color }}><Icon size={19} /></div>
    </div>
  );
}

function SemesterCard({ title, ingresos, egresos, neto, fmt, simulated = false }) {
  return (
    <div style={{ background: tokens.surface, padding: "20px", borderRadius: 10, border: `2px solid ${simulated ? tokens.gold : colorLineaFuerte}`, display: "flex", flexDirection: "column", transition: "all 0.3s" }}>
      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: simulated ? tokens.gold : tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>
        {title}
      </h4>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: tokens.textMuted }}>Ingresos</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.positive, fontFamily: tokens.fontMono }}>$ {fmt(ingresos)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colorLineaSuave}` }}>
        <span style={{ fontSize: 12.5, color: tokens.textMuted }}>Egresos</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.negative, fontFamily: tokens.fontMono }}>$ {fmt(egresos)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.text }}>Flujo Neto</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: tokens.fontMono, color: neto >= 0 ? tokens.positive : tokens.negative }}>$ {fmt(neto)}</span>
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

  const [simulacionActiva, setSimulacionActiva] = useState(false);
  const [simData, setSimData] = useState({ globalIng: 0, globalEg: 0, cats: {}, meses: {}, active: {} });
  const [expandedGroups, setExpandedGroups] = useState({ "Desglose de Proyectos": true });

  useEffect(() => {
    setPlanDraft(planesFondos[selectedYear] || { ingreso: {}, egreso: {} });
  }, [planesFondos, selectedYear, editMode, view]);

  useEffect(() => {
    setMappingDraft({ ingreso: { ...(mappingGuardado?.ingreso || {}) }, egreso: { ...(mappingGuardado?.egreso || {}) } });
  }, [mappingGuardado, view]);

  useEffect(() => {
    if (editMode) setSimulacionActiva(false);
  }, [editMode]);

  const toggleGroup = (groupLabel) => {
    setExpandedGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  const initSimActive = () => {
     let act = {};
     planIncomeCats.forEach(c => act[c.key] = true);
     planExpenseCats.forEach(c => {
       if(c.isGroup) c.subCats.forEach(sub => act[sub.key] = true);
       else act[c.key] = true;
     });
     return act;
  };

  const ultimoDolar = useMemo(() => {
    if (!tcList || tcList.length === 0) return 1; 
    const sorted = [...tcList].sort((a,b) => b.fecha_corte.localeCompare(a.fecha_corte));
    return Number(sorted[0].saldo_efectivo) || 1;
  }, [tcList]);

  const flatExpenseCats = useMemo(() => {
    const flat = [];
    planExpenseCats.forEach(c => {
      if (c.isGroup) flat.push(...c.subCats);
      else flat.push(c);
    });
    return flat;
  }, [planExpenseCats]);

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

  const getSimVal = (tipo, conceptoKey, mesKey) => {
    const baseVal = planDraft?.[tipo]?.[conceptoKey]?.[mesKey] || 0;
    if (!simulacionActiva) return baseVal;
    
    if (simData.active[conceptoKey] === false) return 0;
    
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
    const catalogo = tipo === "ingreso" ? planIncomeCats : flatExpenseCats;
    catalogo.forEach(c => { total += getSimVal(tipo, c.key, mesKey); });
    return total;
  };

  const calcSemestre = (tipo, mesesFilter) => {
    let t = 0;
    const catalogo = tipo === "ingreso" ? planIncomeCats : flatExpenseCats;
    catalogo.forEach(c => {
      mesesFilter.forEach(m => { t += getSimVal(tipo, c.key, m); });
    });
    return t;
  };

  const keysS1 = ["01", "02", "03", "04", "05", "06"];
  const keysS2 = ["07", "08", "09", "10", "11", "12"];

  const ingS1 = calcSemestre("ingreso", keysS1);
  const ingS2 = calcSemestre("ingreso", keysS2);
  const egS1 = calcSemestre("egreso", keysS1);
  const egS2 = calcSemestre("egreso", keysS2);

  const totalIng = planIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0);
  const totalEg = flatExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);

  const pieIngresos = planIncomeCats.map(c => {
    const val = calcularTotalFila("ingreso", c.key);
    return { name: c.label, value: val, perc: totalIng > 0 ? (val / totalIng) * 100 : 0 };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const pieEgresos = flatExpenseCats.map(c => {
    const val = calcularTotalFila("egreso", c.key);
    return { name: c.label, value: val, perc: totalEg > 0 ? (val / totalEg) * 100 : 0 };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const MODERN_PALETTE = ['#3B82F6', '#14DBB6', '#FFCC4D', '#FF6666', '#A385FF', '#4ADE80', '#F97316', '#0EA5E9', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B', '#6366F1', '#14B8A6'];
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
              : editMode ? `Estás editando el presupuesto de ${selectedYear}.` : `Presupuesto basado en ejecución física (Curva S) para ${selectedYear}.`}
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
                  Restaurar Originales
                </button>
                <button onClick={guardarTodo} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.positive, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  <Save size={16} /> Guardar {selectedYear}
                </button>
              </>
            ) : (
              <>
                {/* BOTÓN SIMULADOR AVANZADO */}
                <button onClick={() => { 
                  if (!simulacionActiva) setSimData({globalIng:0, globalEg:0, cats:{}, meses:{}, active: initSimActive()}); 
                  setSimulacionActiva(!simulacionActiva); 
                }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: simulacionActiva ? tokens.gold : tokens.surface, color: simulacionActiva ? "#fff" : tokens.text, border: `1px solid ${simulacionActiva ? tokens.gold : colorLineaFuerte}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>
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
          {/* PANEL DEL SIMULADOR ESTÉTICO */}
          {simulacionActiva && !editMode && (
            <div style={{ background: tokens.surface, borderRadius: 10, border: `2px solid ${tokens.gold}`, padding: "16px 20px", display: 'flex', flexDirection: 'column', gap: 16, boxShadow: "0 4px 12px rgba(212, 175, 55, 0.15)" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 15, color: tokens.gold, display: 'flex', alignItems: 'center', gap: 6 }}><Wand2 size={16} /> Modo Simulación Activo</h3>
                  <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>Mueve las barras globales aquí, o usa los controles en la tabla para apagar proyectos o ajustar meses. <strong>Tus datos reales están a salvo.</strong></p>
                </div>
                <button onClick={() => setSimData({globalIng:0, globalEg:0, cats:{}, meses:{}, active: initSimActive()})} style={{ padding: "8px 16px", borderRadius: 6, background: colorTablaBg, border: `1px solid ${colorLineaSuave}`, cursor: "pointer", fontSize: 12, fontWeight: 600, color: tokens.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><RotateCcw size={14}/> Resetear toda la simulación</button>
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
            <SemesterCard title="Primer Semestre (Ene - Jun)" ingresos={ingS1} egresos={egS1} neto={ingS1 - egS1} fmt={fmt} simulated={simulacionActiva} />
            <SemesterCard title="Segundo Semestre (Jul - Dic)" ingresos={ingS2} egresos={egS2} neto={ingS2 - egS2} fmt={fmt} simulated={simulacionActiva} />
            <SemesterCard title={simulacionActiva ? "Total Acumulado SIMULADO" : "Total Acumulado Anual"} ingresos={ingS1 + ingS2} egresos={egS1 + egS2} neto={(ingS1 + ingS2) - (egS1 + egS2)} fmt={fmt} simulated={simulacionActiva} />
          </div>

          {!editMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 1fr", gap: 18 }}>
              {/* GRÁFICO INGRESOS */}
              <div style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
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
              <div style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <h3 style={{ margin: "0 0 20px 0", color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                  Flujo Promedio<br/><span style={{fontSize: 12, color: '#94A3B8', fontWeight: 500}}>Mensualizado USD</span>
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
              <div style={{ background: '#172033', borderRadius: 10, border: `1px solid #334155`, padding: 20 }}>
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
                    <tr><td colSpan={14} style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, background: colorTablaBg }}>INGRESOS {simulacionActiva && "(Simulado)"}</td></tr>
                    {planIncomeCats.map(c => {
                       const isOff = simulacionActiva && !simData.active[c.key];
                       return (
                         <tr key={c.key} className={`flujo-row ${isOff ? 'sim-row-disabled' : ''}`} style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                            <td className="sticky-col" style={{ padding: "9px 14px 9px 24px", color: tokens.textMuted, background: colorTablaBg }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span style={{fontWeight: 500}}>{c.label}</span>
                                  {simulacionActiva && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[c.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [c.key]: Number(e.target.value)}}))} style={{width: 70}} disabled={isOff} />
                                      <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%</span>
                                    </div>
                                  )}
                                </div>
                                {simulacionActiva && (
                                  <label className="toggle-switch" title={isOff ? "Encender Categoría" : "Apagar Categoría"}>
                                    <input type="checkbox" checked={!isOff} onChange={() => setSimData(prev => ({...prev, active: {...prev.active, [c.key]: !prev.active[c.key]}}))} />
                                    <span className="slider-toggle"></span>
                                  </label>
                                )}
                              </div>
                            </td>
                            {meses.map(m => {
                              const valBase = planDraft?.ingreso?.[c.key]?.[m.k] || "";
                              const valShow = getSimVal("ingreso", c.key, m.k);
                              return (
                                <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                  {editMode ? (
                                    <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("ingreso", c.key, m.k, e.target.value)} placeholder="0" />
                                  ) : (
                                    <span style={{ color: valShow ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{valShow ? `$ ${fmt(valShow)}` : "-"}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("ingreso", c.key))}</td>
                         </tr>
                       );
                    })}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Ingresos</td>
                      {meses.map(m => <td key={m.k} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(calcularTotalColumna("ingreso", m.k))}</td>)}
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(planIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0))}</td>
                    </tr>

                    <tr><td colSpan={14} style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, background: colorTablaBg, borderTop: `2px solid ${colorLineaFuerte}` }}>EGRESOS {simulacionActiva && "(Simulado)"}</td></tr>
                    {planExpenseCats.map(item => {
                      if (item.isGroup) {
                        return (
                          <React.Fragment key={item.label}>
                            <tr className="flujo-row" style={{ backgroundColor: colorTotalBg, borderBottom: `1px solid ${colorLineaSuave}` }}>
                              <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 800, color: tokens.text, background: colorTotalBg, cursor: 'pointer' }} onClick={() => toggleGroup(item.label)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {expandedGroups[item.label] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                  {item.label}
                                </div>
                              </td>
                              {meses.map(m => {
                                const groupMonthTotal = item.subCats.reduce((acc, sub) => acc + getSimVal("egreso", sub.key, m.k), 0);
                                return <td key={m.k} style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>{groupMonthTotal > 0 ? `$ ${fmt(groupMonthTotal)}` : "-"}</td>;
                              })}
                              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 800, fontFamily: tokens.fontMono, color: tokens.text }}>
                                $ {fmt(item.subCats.reduce((acc, sub) => acc + calcularTotalFila("egreso", sub.key), 0))}
                              </td>
                            </tr>
                            {expandedGroups[item.label] && item.subCats.map(sub => {
                              const isOff = simulacionActiva && !simData.active[sub.key];
                              return (
                                <tr key={sub.key} className={`flujo-row ${isOff ? 'sim-row-disabled' : ''}`} style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                                  <td className="sticky-col" style={{ padding: "9px 14px 9px 40px", color: tokens.textMuted, background: colorTablaBg }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <span style={{fontWeight: 500}}>{sub.label}</span>
                                        {simulacionActiva && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[sub.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [sub.key]: Number(e.target.value)}}))} style={{width: 70}} disabled={isOff} />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[sub.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[sub.key] > 0 ? '+' : ''}{simData.cats[sub.key] || 0}%</span>
                                          </div>
                                        )}
                                      </div>
                                      {simulacionActiva && (
                                        <label className="toggle-switch" title={isOff ? "Encender Proyecto" : "Apagar Proyecto"}>
                                          <input type="checkbox" checked={!isOff} onChange={() => setSimData(prev => ({...prev, active: {...prev.active, [sub.key]: !prev.active[sub.key]}}))} />
                                          <span className="slider-toggle"></span>
                                        </label>
                                      )}
                                    </div>
                                  </td>
                                  {meses.map(m => {
                                    const valBase = planDraft?.egreso?.[sub.key]?.[m.k] || "";
                                    const valShow = getSimVal("egreso", sub.key, m.k);
                                    return (
                                      <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                        {editMode ? (
                                          <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("egreso", sub.key, m.k, e.target.value)} placeholder="0" />
                                        ) : (
                                          <span style={{ color: valShow ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{valShow ? `$ ${fmt(valShow)}` : "-"}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("egreso", sub.key))}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      } else {
                        const isOff = simulacionActiva && !simData.active[item.key];
                        return (
                          <tr key={item.key} className={`flujo-row ${isOff ? 'sim-row-disabled' : ''}`} style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                            <td className="sticky-col" style={{ padding: "9px 14px 9px 24px", color: tokens.textMuted, background: colorTablaBg }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span style={{fontWeight: 500}}>{item.label}</span>
                                  {simulacionActiva && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input type="range" className="sim-slider" min="-100" max="100" value={simData.cats[item.key] || 0} onChange={(e) => setSimData(prev => ({...prev, cats: {...prev.cats, [item.key]: Number(e.target.value)}}))} style={{width: 70}} disabled={isOff} />
                                      <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[item.key] !== 0 ? tokens.gold : tokens.textMuted, width: 26 }}>{simData.cats[item.key] > 0 ? '+' : ''}{simData.cats[item.key] || 0}%</span>
                                    </div>
                                  )}
                                </div>
                                {simulacionActiva && (
                                  <label className="toggle-switch" title={isOff ? "Encender Categoría" : "Apagar Categoría"}>
                                    <input type="checkbox" checked={!isOff} onChange={() => setSimData(prev => ({...prev, active: {...prev.active, [item.key]: !prev.active[item.key]}}))} />
                                    <span className="slider-toggle"></span>
                                  </label>
                                )}
                              </div>
                            </td>
                            {meses.map(m => {
                              const valBase = planDraft?.egreso?.[item.key]?.[m.k] || "";
                              const valShow = getSimVal("egreso", item.key, m.k);
                              return (
                                <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                  {editMode ? (
                                    <input type="number" className="plan-input" value={valBase} onChange={(e) => handleInputChange("egreso", item.key, m.k, e.target.value)} placeholder="0" />
                                  ) : (
                                    <span style={{ color: valShow ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{valShow ? `$ ${fmt(valShow)}` : "-"}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("egreso", item.key))}</td>
                         </tr>
                        );
                      }
                    })}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Egresos</td>
                      {meses.map(m => <td key={m.k} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: tokens.negative, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(calcularTotalColumna("egreso", m.k))}</td>)}
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: tokens.negative, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(flatExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0))}</td>
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
                    {flatExpenseCats.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
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
