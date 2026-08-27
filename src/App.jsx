import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import CargarMovimiento from "./CargarMovimiento";
import CategoryManager from "./CategoryManager";
import Cash13Semanas, { useSemanas13 } from "./Cash13Semanas";
import { tokens, fontImport } from "./tokens";
import { BASE_INCOME, BASE_EXPENSE, slugify, discoverCategories } from "./categories";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Wallet, CalendarX2, AlertTriangle, Save, Settings,
  ListChecks, Tag, SlidersHorizontal, Compass, CalendarRange,
  ChevronDown, ChevronRight, BarChart3, Pencil, Link as LinkIcon, Trash2,
  CalendarDays, Scale, Percent, TrendingDown, DollarSign
} from "lucide-react";

// =========================================================================
// CATEGORÍAS FIJAS DEL PLAN DE FONDOS
// =========================================================================
const PLAN_INCOME_CATS = [
  { key: "custom_cupos-socios", label: "Cupos Socios" },
  { key: "custom_cuotas-mensuales", label: "Cuotas Mensuales" },
  { key: "custom_ventas-cdo", label: "Ventas CDO" },
  { key: "custom_pesa", label: "PESA" },
  { key: "custom_aportes", label: "Aportes" }
];

const PLAN_EXPENSE_CATS = [
  { key: "custom_proyectos", label: "Proyectos" },
  { key: "custom_rrhh", label: "RRHH" },
  { key: "custom_administracion", label: "Administración" },
  { key: "custom_inversiones", label: "Inversiones" },
  { key: "custom_pasivos-financieros", label: "Pasivos Financieros" },
  { key: "custom_seguros", label: "Seguros" }
];

const DEFAULT_PLAN_2026 = {
  "ingreso": {
    "custom_cupos-socios": { "01": 188542320, "02": 188542320, "03": 188542320, "04": 188542320, "05": 188542320, "06": 188542320, "07": 233273820, "08": 233273820, "09": 233273820, "10": 233273820, "11": 233273820, "12": 233273820 },
    "custom_cuotas-mensuales": { "01": 216094107, "02": 210193927, "03": 207243837, "04": 208718882, "05": 210931449, "06": 221256765, "07": 166503716, "08": 394424755, "09": 391424755, "10": 138308206, "11": 135987535, "12": 120871098 },
    "custom_ventas-cdo": { "01": 516840002, "02": 752453282, "03": 512761659, "04": 962711702, "05": 400627107, "06": 171320000 },
    "custom_pesa": { "05": 389439155, "06": 241673234, "07": 241673234, "08": 241673234, "09": 241673234 },
    "custom_aportes": {}
  },
  "egreso": {
    "custom_proyectos": { "01": 527696546, "02": 516555380, "03": 506392974, "04": 515654521, "05": 462546516, "06": 611412024, "07": 691180691, "08": 797872530, "09": 739456323, "10": 431512925, "11": 167967569, "12": 142497135 },
    "custom_rrhh": { "01": 369633317, "02": 397685053, "03": 441780756, "04": 358521345, "05": 475970162, "06": 331050035, "07": 359717500, "08": 343916425, "09": 343980114, "10": 344578753, "11": 344262539, "12": 513292012 },
    "custom_administracion": { "01": 82469483, "02": 92452971, "03": 114416954, "04": 163553088, "05": 179058699, "06": 245285356, "07": 236069287, "08": 292313592, "09": 238368041, "10": 260249313, "11": 220946940, "12": 121042528 },
    "custom_inversiones": { "01": 80318625, "02": 78125625, "03": 77029125, "04": 77577375, "05": 78399750, "06": 82237500, "07": 82003500, "08": 82003500, "09": 82003500, "10": 82003500, "11": 7003500, "12": 7003500 },
    "custom_pasivos-financieros": { "01": 57268446, "02": 55950406, "03": 55291386, "04": 55620896, "05": 73580581, "06": 76742101, "07": 76742101, "08": 79132921, "09": 76742101, "10": 76742101, "11": 76742101, "12": 76742101 },
    "custom_seguros": { "01": 4688126, "02": 4688126, "03": 4688126, "04": 4688126, "05": 4688126, "06": 4688126, "07": 4688126, "08": 4688126, "09": 4688126, "10": 4688126, "11": 4688126, "12": 4688126 }
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
`;

const formatDate = (isoStr) => {
  if (!isoStr || !isoStr.includes("-")) return isoStr;
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const NAV = [
  { id: "resumen", label: "Resumen", icon: Compass },
  { id: "semanas13", label: "Cash 13 semanas", icon: CalendarRange },
  { id: "plan-fondos", label: "Plan de Fondos", icon: BarChart3 },
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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (fechaSaldo) {
      const existing = arqueosList.find(a => a.fecha_corte === fechaSaldo);
      if (existing) {
        setSaldoEfectivo(existing.saldo_efectivo);
        setSaldoBanco(existing.saldo_banco);
      } else {
        setSaldoEfectivo("");
        setSaldoBanco("");
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
      const listArq = sData.filter(s => s.id.startsWith("arqueo_") || s.id === "general");
      setArqueosList(listArq);
      const listTC = sData.filter(s => s.id.startsWith("tc_"));
      setTcList(listTC);
    }

    const { data: pData } = await supabase.from("cashflow_plan").select("*");
    if (pData) {
      const mapRow = pData.find(r => r.id === "mapping");
      if (mapRow) setMapping(mapRow.data || { ingreso: {}, egreso: {} });

      let planesTemporales = {};
      pData.forEach(r => {
        if (r.id !== "mapping") planesTemporales[r.id] = r.data;
      });

      if (!planesTemporales["2026"] || (planesTemporales["2026"].egreso && planesTemporales["2026"].egreso["custom_300"])) {
        planesTemporales["2026"] = DEFAULT_PLAN_2026;
        await supabase.from("cashflow_plan").upsert({ id: "2026", data: DEFAULT_PLAN_2026 });
      }
      setPlanesFondos(planesTemporales);
    } else {
      setPlanesFondos({ "2026": DEFAULT_PLAN_2026 });
      await supabase.from("cashflow_plan").upsert({ id: "2026", data: DEFAULT_PLAN_2026 });
    }

    setLoaded(true);
  };

  const guardarSaldos = async () => {
    if (!fechaSaldo) return alert("Seleccioná una fecha para el arqueo.");
    const idUnico = "arqueo_" + fechaSaldo;
    
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: idUnico, 
      fecha_corte: fechaSaldo, 
      saldo_efectivo: Number(saldoEfectivo) || 0, 
      saldo_banco: Number(saldoBanco) || 0,
    });
    
    if (error) alert("Error al guardar arqueo: " + error.message);
    else {
      alert(`¡Arqueo de Apertura guardado exitosamente para el ${formatDate(fechaSaldo)}!`);
      fetchData();
    }
  };

  const eliminarArqueo = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este arqueo histórico? La línea de tiempo se recalculará.")) return;
    await supabase.from("cashflow_settings").delete().eq("id", id);
    fetchData();
  };

  const guardarTC = async () => {
    if (!fechaTC || !valorTC) return alert("Seleccioná una fecha y un valor para el Tipo de Cambio.");
    const idUnico = "tc_" + fechaTC;
    
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: idUnico, 
      fecha_corte: fechaTC, 
      saldo_efectivo: Number(valorTC),
      saldo_banco: 0,
    });
    
    if (error) alert("Error al guardar TC: " + error.message);
    else {
      alert(`¡Tipo de Cambio guardado exitosamente para el ${formatDate(fechaTC)}!`);
      fetchData();
    }
  };

  const eliminarTC = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este Tipo de Cambio histórico?")) return;
    await supabase.from("cashflow_settings").delete().eq("id", id);
    fetchData();
  };

  const guardarPlanDeFondos = async (nuevoPlan, year) => {
    setPlanesFondos(prev => ({ ...prev, [year]: nuevoPlan }));
    const { error } = await supabase.from("cashflow_plan").upsert({ id: year, data: nuevoPlan });
    if (error) alert("Error al guardar el plan de fondos: " + error.message);
  };

  const guardarMapeo = async (nuevoMapeo) => {
    setMapping(nuevoMapeo);
    const { error } = await supabase.from("cashflow_plan").upsert({ id: "mapping", data: nuevoMapeo });
    if (error) alert("Error al guardar el mapeo: " + error.message);
    else alert("Mapeo actualizado correctamente.");
  };

  const handleImportarSemanas = async (semanasNuevas) => {
    await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
  };

  const handleBorrarDatos = async () => {
    if (!window.confirm("¿Borrar proyecciones? El tablero quedará en 0.")) return;
    await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
  };

  const guardarMovimiento = async ({ fecha, tipo, key, monto, estado, nota }) => {
    const existente = weeks.find((w) => w.week_start === fecha);
    const base = existente || { id: fecha, week_start: fecha, status: estado, saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0, income: {}, expense: {}, notes: "" };
    let currentNotes = {};
    try { currentNotes = JSON.parse(base.notes || "{}"); } catch(e) {}
    if (nota && nota.trim() !== "") currentNotes[`${tipo}_${key}`] = nota;
    else delete currentNotes[`${tipo}_${key}`];

    const actualizada = { ...base, status: estado || base.status, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) }, notes: JSON.stringify(currentNotes) };
    if (tipo === "ingreso") actualizada.income[key] = Number(monto) || 0;
    else actualizada.expense[key] = Number(monto) || 0;

    await supabase.from("cashflow_weeks").upsert(actualizada);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
    return true;
  };

  const eliminarMovimiento = async (fecha, tipo, key) => {
    const existente = weeks.find((w) => w.week_start === fecha);
    if (!existente) return;
    let currentNotes = {};
    try { currentNotes = JSON.parse(existente.notes || "{}"); } catch(e) {}
    delete currentNotes[`${tipo}_${key}`];
    const actualizada = { ...existente, income: { ...(existente.income || {}) }, expense: { ...(existente.expense || {}) }, notes: JSON.stringify(currentNotes) };
    if (tipo === "ingreso") delete actualizada.income[key];
    else delete actualizada.expense[key];
    await supabase.from("cashflow_weeks").upsert(actualizada);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
  };

  const moverMovimiento = async (origenFecha, destinoFecha, tipo, key, monto) => {
    if (origenFecha === destinoFecha) return;
    const origen = weeks.find((w) => w.week_start === origenFecha);
    let notaMovida = null;
    if (origen) {
      let upOrigen = { ...origen, income: { ...(origen.income || {}) }, expense: { ...(origen.expense || {}) } };
      const field = tipo === "ingreso" ? "income" : "expense";
      delete upOrigen[field][key];
      let origenNotes = {};
      try { origenNotes = JSON.parse(origen.notes || "{}"); } catch(e) {}
      if (origenNotes[`${tipo}_${key}`]) { notaMovida = origenNotes[`${tipo}_${key}`]; delete origenNotes[`${tipo}_${key}`]; }
      upOrigen.notes = JSON.stringify(origenNotes);
      await supabase.from("cashflow_weeks").upsert(upOrigen);
    }
    const destino = weeks.find((w) => w.week_start === destinoFecha) || { id: destinoFecha, week_start: destinoFecha, status: "proyectado", saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0, income: {}, expense: {}, notes: "" };
    let upDestino = { ...destino, income: { ...(destino.income || {}) }, expense: { ...(destino.expense || {}) } };
    const field2 = tipo === "ingreso" ? "income" : "expense";
    upDestino[field2][key] = (upDestino[field2][key] || 0) + Number(monto);
    if (notaMovida) {
      let destinoNotes = {};
      try { destinoNotes = JSON.parse(destino.notes || "{}"); } catch(e) {}
      destinoNotes[`${tipo}_${key}`] = notaMovida;
      upDestino.notes = JSON.stringify(destinoNotes);
    }
    await supabase.from("cashflow_weeks").upsert(upDestino);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
  };

  const fieldFor = (grupo) => (grupo === "ingreso" ? "income" : "expense");

  const agregarConcepto = async (grupo, label) => {
    const field = fieldFor(grupo);
    const key = "custom_" + slugify(label);
    const anchor = new Date().toISOString().slice(0, 10);
    const existente = weeks.find((w) => w.week_start === anchor);
    const base = existente || { id: anchor, week_start: anchor, status: "proyectado", saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0, income: {}, expense: {}, notes: "" };
    const actualizada = { ...base, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) } };
    if (actualizada[field][key] === undefined) actualizada[field][key] = 0;
    await supabase.from("cashflow_weeks").upsert(actualizada);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
    return true;
  };

  const renombrarConcepto = async (grupo, oldKey, newLabel) => {
    const field = fieldFor(grupo);
    const newKey = "custom_" + slugify(newLabel);
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], oldKey));
    if (afectadas.length === 0) return agregarConcepto(grupo, newLabel);
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) };
      const val = obj[oldKey]; delete obj[oldKey]; obj[newKey] = val;
      return { ...w, [field]: obj };
    });
    await supabase.from("cashflow_weeks").upsert(updates);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
    return true;
  };

  const eliminarConcepto = async (grupo, key) => {
    const field = fieldFor(grupo);
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], key));
    if (afectadas.length === 0) return true;
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) }; delete obj[key];
      return { ...w, [field]: obj };
    });
    await supabase.from("cashflow_weeks").upsert(updates);
    const { data } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    setWeeks(data || []);
    return true;
  };

  const formatLabel = (k) => k.replace("custom_", "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const incomeCats = useMemo(() => discoverCategories(weeks, BASE_INCOME, "income"), [weeks]);
  const expenseCats = useMemo(() => discoverCategories(weeks, BASE_EXPENSE, "expense"), [weeks]);
  
  const procesadas = useMemo(() => {
    const arqueosDict = {};
    arqueosList.forEach(a => {
      if (a.fecha_corte) arqueosDict[a.fecha_corte] = Number(a.saldo_efectivo || 0) + Number(a.saldo_banco || 0);
    });

    const fechasSet = new Set(weeks.map((w) => w.week_start));
    Object.keys(arqueosDict).forEach(f => fechasSet.add(f));
    const fechasArray = Array.from(fechasSet).sort();

    const fechasConArqueo = Object.keys(arqueosDict).sort();
    const firstArqueoDate = fechasConArqueo.length > 0 ? fechasConArqueo[0] : null;

    let currentSaldo = 0;
    
    if (firstArqueoDate) {
         let flowSum = 0;
         for (let f of fechasArray) {
             if (f >= firstArqueoDate) break; 
             const w = weeks.find(week => week.week_start === f) || {};
             const ing = Object.values(w.income || {}).reduce((a,b) => a + Number(b||0), 0);
             const eg = Object.values(w.expense || {}).reduce((a,b) => a + Number(b||0), 0);
             flowSum += (ing - eg);
         }
         currentSaldo = arqueosDict[firstArqueoDate] - flowSum;
    }

    return fechasArray.map((fecha) => {
      const w = weeks.find((week) => week.week_start === fecha) || { income: {}, expense: {}, notes: "{}" };
      const ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      const eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);
      const pos = ing - eg;
      
      let parsedNotes = {};
      try { parsedNotes = JSON.parse(w.notes || "{}"); } catch(e) {}
      
      let esArqueo = false;
      let ajuste = 0;
      
      if (arqueosDict[fecha] !== undefined) {
          esArqueo = true;
          ajuste = arqueosDict[fecha] - currentSaldo; 
          currentSaldo = arqueosDict[fecha];
      }

      currentSaldo += pos;

      return { 
        ...w, week_start: fecha, totalIngresos: ing, totalEgresos: eg, 
        posicion: pos, saldoAcumulado: currentSaldo, parsedNotes, 
        esArqueo, ajuste 
      };
    });
  }, [weeks, arqueosList]);

  // =========================================================================
  // KPIs MEJORADOS: Fuga Proyectada + Métricas del mes en curso
  // =========================================================================
  const kpis = useMemo(() => {
    if (procesadas.length === 0) return null;
    const hoy = todayISO();
    
    const pasadas = procesadas.filter((w) => w.week_start <= hoy);
    const saldoHoy = pasadas.length 
      ? pasadas[pasadas.length - 1].saldoAcumulado 
      : (arqueosList.length ? (Number(arqueosList[0].saldo_efectivo) + Number(arqueosList[0].saldo_banco)) : 0);

    let diasDeCaja = null, deficitActual = false, sinQuemaNeta = false;
    const semanaDeficit = procesadas.find((w) => w.week_start >= hoy && w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";

    if (saldoHoy < 0) { deficitActual = true; diasDeCaja = 0; } 
    else if (semanaDeficit) {
      const fechaDeficitD = new Date(semanaDeficit.week_start + "T00:00:00");
      const fechaHoyD = new Date(hoy + "T00:00:00");
      diasDeCaja = Math.ceil((fechaDeficitD.getTime() - fechaHoyD.getTime()) / (1000 * 3600 * 24));
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

    // NUEVA FUGA: Mirando solo al futuro (próximos 30 días proyectados)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 30);
    const fechaLimiteISO = fechaLimite.toISOString().slice(0, 10);
    
    const datosProyectados = procesadas.filter(w => w.week_start >= hoy && w.week_start <= fechaLimiteISO);

    let maxEgresoVal = 0;
    let maxEgresoCat = "Sin egresos proyectados";
    if (datosProyectados.length > 0) {
      const sumasEgresos = {};
      datosProyectados.forEach(w => {
         Object.entries(w.expense || {}).forEach(([k, v]) => {
            sumasEgresos[k] = (sumasEgresos[k] || 0) + Number(v);
         });
      });
      Object.entries(sumasEgresos).forEach(([k, v]) => {
         if (v > maxEgresoVal) {
            maxEgresoVal = v;
            const catObj = expenseCats.find(c => c.key === k);
            maxEgresoCat = catObj ? catObj.label : k.replace('custom_', '');
         }
      });
    }

    return { 
      diasDeCaja, deficitActual, sinQuemaNeta, diaDeficit, nofMensual: nofAnual / 12, nofAnual, liquidez: saldoHoy,
      flujoNetoMes, cobertura, maxEgresoVal, maxEgresoCat
    };
  }, [procesadas, arqueosList, expenseCats]);

  const semanas13 = useSemanas13(procesadas, fechaSaldo, saldoEfectivo, saldoBanco);

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: tokens.ink, color: "#fff", fontFamily: tokens.fontBody }}><style>{fontImport}</style>Iniciando entorno seguro…</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.paper, fontFamily: tokens.fontBody, color: tokens.text }}>
      <style>{globalStyles}</style>

      {/* ---------- RIEL DE INSTRUMENTOS (SIDEBAR) ---------- */}
      <aside style={{ width: 232, flexShrink: 0, background: tokens.ink, color: "#fff", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ borderBottom: `1px solid ${tokens.inkRule}` }}>
          <img src="/link-banner.png" alt="LINK" style={{ width: "100%", height: "85px", objectFit: "cover", objectPosition: "left center", display: "block" }} />
          <div style={{ padding: "14px 20px 16px" }}>
            <div style={{ fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: "0.2px" }}>Cashflow</div>
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
        {tab === "semanas13" && <Cash13Semanas semanas={semanas13} fmt={fmt} />}

        {tab === "plan-fondos" && (
          <PlanDeFondosTab 
            planIncomeCats={PLAN_INCOME_CATS}
            planExpenseCats={PLAN_EXPENSE_CATS}
            dailyIncomeCats={incomeCats} 
            dailyExpenseCats={expenseCats} 
            fmt={fmt} 
            planesFondos={planesFondos}
            mappingGuardado={mapping}
            onGuardarPlan={guardarPlanDeFondos}
            onGuardarMapeo={guardarMapeo}
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
                  <CargarMovimiento 
                    incomeCats={incomeCats} 
                    expenseCats={expenseCats} 
                    weeks={weeks} 
                    onGuardar={guardarMovimiento} 
                    onEliminar={eliminarMovimiento} 
                    formatDate={formatDate} 
                    movimientoAEditar={movimientoAEditar}
                    setMovimientoAEditar={setMovimientoAEditar}
                    tcList={tcList} 
                  />
                </div>
              )}
              <FlujoTable 
                procesadas={procesadas} 
                incomeCats={incomeCats} 
                expenseCats={expenseCats} 
                fmt={fmt} 
                onMoverMovimiento={moverMovimiento} 
                formatDate={formatDate} 
                onEditClick={(item) => {
                  setMostrarPanel(true);
                  setMovimientoAEditar(item); 
                }}
              />
            </div>
          </div>
        )}

        {tab === "conceptos" && <CategoryManager incomeCats={incomeCats} expenseCats={expenseCats} weeks={weeks} onAdd={agregarConcepto} onRename={renombrarConcepto} onDelete={eliminarConcepto} />}

        {tab === "configuracion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
            <div><h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Configuración</h2></div>
            
            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Settings size={16} color={tokens.textMuted} />
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>Cargar Arqueo (Saldo Inicial de Apertura)</h3>
              </div>
              <p style={{ fontSize: 12.5, color: tokens.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
                Carga el saldo real que tienes en el banco <strong>al arrancar el día</strong>. El sistema le sumará y restará automáticamente los movimientos que tengas programados para hoy, mostrando así tu Liquidez y Saldo de Cierre actualizados.
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
                            <span style={{ fontSize: 13, fontFamily: tokens.fontMono, color: tokens.textMuted }}>Efectivo: $ {fmt(a.saldo_efectivo)}</span>
                            <span style={{ fontSize: 13, fontFamily: tokens.fontMono, color: tokens.textMuted }}>Bancos: $ {fmt(a.saldo_banco)}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>Total Inicial: $ {fmt(Number(a.saldo_efectivo) + Number(a.saldo_banco))}</span>
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
                Carga la cotización del dólar por fecha. Al cargar un movimiento en USD, el sistema buscará el último TC cargado hasta ese día para convertirlo a pesos automáticamente.
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

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 4 }}><ImportadorCashflow baseIncome={BASE_INCOME} baseExpense={BASE_EXPENSE} onImportarSemanas={handleImportarSemanas} onBorrarDatos={handleBorrarDatos} semanasExistentes={weeks} /></div>
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

function SemesterCard({ title, ingresos, egresos, neto, fmt }) {
  return (
    <div style={{ background: tokens.surface, padding: "20px", borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, display: "flex", flexDirection: "column" }}>
      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{title}</h4>
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

// =========================================================================
// PESTAÑA: PLAN DE FONDOS MULTI-AÑO
// =========================================================================
function PlanDeFondosTab({ planIncomeCats, planExpenseCats, dailyIncomeCats, dailyExpenseCats, fmt, planesFondos, mappingGuardado, onGuardarPlan, onGuardarMapeo }) {
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

  useEffect(() => {
    setPlanDraft(planesFondos[selectedYear] || { ingreso: {}, egreso: {} });
  }, [planesFondos, selectedYear, editMode, view]);

  useEffect(() => {
    setMappingDraft({ ingreso: { ...(mappingGuardado?.ingreso || {}) }, egreso: { ...(mappingGuardado?.egreso || {}) } });
  }, [mappingGuardado, view]);

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

  const calcularTotalFila = (tipo, conceptoKey) => {
    let total = 0;
    meses.forEach(m => { total += planDraft?.[tipo]?.[conceptoKey]?.[m.k] || 0; });
    return total;
  };

  const calcularTotalColumna = (tipo, mesKey) => {
    let total = 0;
    const catalogo = tipo === "ingreso" ? planIncomeCats : planExpenseCats;
    catalogo.forEach(c => { total += planDraft?.[tipo]?.[c.key]?.[mesKey] || 0; });
    return total;
  };

  const calcSemestre = (tipo, mesesFilter) => {
    let t = 0;
    const dataTipo = planDraft?.[tipo] || {};
    Object.keys(dataTipo).forEach(catKey => {
      mesesFilter.forEach(m => { t += dataTipo[catKey]?.[m] || 0; });
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
  const totalEg = planExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);

  const pieIngresos = planIncomeCats.map(c => {
    const val = calcularTotalFila("ingreso", c.key);
    return { name: c.label, value: val, perc: totalIng > 0 ? (val / totalIng) * 100 : 0 };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const pieEgresos = planExpenseCats.map(c => {
    const val = calcularTotalFila("egreso", c.key);
    return { name: c.label, value: val, perc: totalEg > 0 ? (val / totalEg) * 100 : 0 };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const COLORS_ING = ['#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'];
  const COLORS_EG = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#F97316', '#F59E0B', '#FCD34D', '#6366F1', '#8B5CF6'];

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 4px 0" }}>
             <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>
               {view === "mapeo" ? "Mapeador de Conceptos" : "Plan de Fondos"}
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
              : editMode ? `Estás editando el presupuesto del ${selectedYear}.` : `Presupuesto anual estimado para ${selectedYear}.`}
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
                <button onClick={() => setPlanDraft(DEFAULT_PLAN_2026)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.negativeSoft, color: tokens.negative, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Restaurar Valores Excel
                </button>
                <button onClick={guardarTodo} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.positive, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  <Save size={16} /> Guardar {selectedYear}
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                <Pencil size={16} /> Editar {selectedYear}
              </button>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            <SemesterCard title="Primer Semestre (Ene - Jun)" ingresos={ingS1} egresos={egS1} neto={ingS1 - egS1} fmt={fmt} />
            <SemesterCard title="Segundo Semestre (Jul - Dic)" ingresos={ingS2} egresos={egS2} neto={ingS2 - egS2} fmt={fmt} />
            <SemesterCard title="Total Acumulado Anual" ingresos={ingS1 + ingS2} egresos={egS1 + egS2} neto={(ingS1 + ingS2) - (egS1 + egS2)} fmt={fmt} />
          </div>

          {!editMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px 0", color: tokens.positive, fontSize: 14, textAlign: "center", fontWeight: 700 }}>Composición de Ingresos</h3>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieIngresos} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {pieIngresos.map((entry, index) => <Cell key={index} fill={COLORS_ING[index % COLORS_ING.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: tokens.fontBody, paddingTop: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px 0", color: tokens.negative, fontSize: 14, textAlign: "center", fontWeight: 700 }}>Composición de Egresos</h3>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieEgresos} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {pieEgresos.map((entry, index) => <Cell key={index} fill={COLORS_EG[index % COLORS_EG.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: tokens.fontBody, paddingTop: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden" }}>
             <div className="table-container" style={{ overflowX: "auto", paddingBottom: 8 }}>
                <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap", background: colorTablaBg }}>
                  <thead>
                    <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <th className="sticky-col" style={{ padding: 14, textAlign: "left", minWidth: 200, background: colorTablaBg }}>Categoría del Plan</th>
                      {meses.map(m => <th key={m.k} style={{ padding: 14, textAlign: "right", minWidth: 90, fontFamily: tokens.fontMono }}>{m.n}</th>)}
                      <th style={{ padding: 14, textAlign: "right", minWidth: 100, fontFamily: tokens.fontMono, color: tokens.text }}>Total Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={14} style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, background: colorTablaBg }}>INGRESOS (Presupuesto)</td></tr>
                    {planIncomeCats.map(c => (
                       <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                          <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                          {meses.map(m => {
                            const val = planDraft?.ingreso?.[c.key]?.[m.k] || "";
                            return (
                              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                {editMode ? (
                                  <input type="number" className="plan-input" value={val} onChange={(e) => handleInputChange("ingreso", c.key, m.k, e.target.value)} placeholder="0" />
                                ) : (
                                  <span style={{ color: val ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{val ? `$ ${fmt(val)}` : "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("ingreso", c.key))}</td>
                       </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Ingresos Presupuestados</td>
                      {meses.map(m => <td key={m.k} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(calcularTotalColumna("ingreso", m.k))}</td>)}
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: tokens.positive, background: colorTotalBg, fontFamily: tokens.fontMono }}>$ {fmt(planIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0))}</td>
                    </tr>

                    <tr><td colSpan={14} style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, background: colorTablaBg, borderTop: `2px solid ${colorLineaFuerte}` }}>EGRESOS (Presupuesto)</td></tr>
                    {planExpenseCats.map(c => (
                       <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                          <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                          {meses.map(m => {
                            const val = planDraft?.egreso?.[c.key]?.[m.k] || "";
                            return (
                              <td key={m.k} style={{ padding: "6px 10px", textAlign: "right" }}>
                                {editMode ? (
                                  <input type="number" className="plan-input" value={val} onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)} placeholder="0" />
                                ) : (
                                  <span style={{ color: val ? tokens.text : tokens.textFaint, fontFamily: tokens.fontMono }}>{val ? `$ ${fmt(val)}` : "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.text }}>$ {fmt(calcularTotalFila("egreso", c.key))}</td>
                       </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
                      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Total Egresos Presupuestados</td>
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
function FlujoTable({ procesadas, incomeCats, expenseCats, fmt, onMoverMovimiento, formatDate, onEditClick }) {
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
        Object.entries(w.income || {}).forEach(([k, v]) => { g.income[k] = (g.income[k] || 0) + v; });
        Object.entries(w.expense || {}).forEach(([k, v]) => { g.expense[k] = (g.expense[k] || 0) + v; });
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
                result.push({ ...d, isMonth: false, mesKey }); 
            });
        }
    });
    return result;
  }, [procesadas, collapsedMonths]);

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

  const handleDragStart = (e, origenFecha, tipo, key, monto) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ origenFecha, tipo, key, monto }));
  };

  const handleDrop = (e, destinoFecha, targetTipo, targetKey) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.tipo !== targetTipo || data.key !== targetKey) {
        alert("Solo puedes mover el importe a otra fecha del mismo concepto.");
        return;
      }
      onMoverMovimiento(data.origenFecha, destinoFecha, data.tipo, data.key, data.monto);
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
                  const monto = w.income?.[c.key] || 0;
                  const nota = w.parsedNotes?.[`ingreso_${c.key}`];
                  return (
                    <td key={i} onDragOver={(e) => !w.isMonth && e.preventDefault()} onDrop={(e) => !w.isMonth && handleDrop(e, w.week_start, "ingreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104, background: w.isMonth ? colorTotalBg : 'transparent' }}>
                      {monto > 0 ? (
                        w.isMonth ? (
                          <span style={{ color: tokens.positive, fontFamily: tokens.fontMono, fontWeight: 700 }}>{fmt(monto)}</span>
                        ) : (
                          <div 
                            className="draggable-chip" 
                            draggable={true} 
                            onDragStart={(e) => handleDragStart(e, w.week_start, "ingreso", c.key, monto)}
                            onClick={() => onEditClick({ fecha: w.week_start, tipo: "ingreso", key: c.key, monto, nota })}
                            title="Clic para editar"
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
                  const monto = w.expense?.[c.key] || 0;
                  const nota = w.parsedNotes?.[`egreso_${c.key}`];
                  return (
                    <td key={i} onDragOver={(e) => !w.isMonth && e.preventDefault()} onDrop={(e) => !w.isMonth && handleDrop(e, w.week_start, "egreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104, background: w.isMonth ? colorTotalBg : 'transparent' }}>
                      {monto > 0 ? (
                        w.isMonth ? (
                          <span style={{ color: tokens.negative, fontFamily: tokens.fontMono, fontWeight: 700 }}>{fmt(monto)}</span>
                        ) : (
                          <div 
                            className="draggable-chip" 
                            draggable={true} 
                            onDragStart={(e) => handleDragStart(e, w.week_start, "egreso", c.key, monto)}
                            onClick={() => onEditClick({ fecha: w.week_start, tipo: "egreso", key: c.key, monto, nota })}
                            title="Clic para editar"
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
