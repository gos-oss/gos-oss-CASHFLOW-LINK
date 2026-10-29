import React, { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ShieldCheck,
  Calendar, Layers, ArrowUpRight, ArrowDownRight, Activity,
  Filter, Plus, Upload, RefreshCw, BarChart3, ChevronRight,
  Briefcase, Building2, Landmark, CheckCircle2, Sparkles, AlertCircle
} from "lucide-react";

export default function DashboardGlassflow({
  procesadas = [],
  kpis,
  fmt = (n) => Number(n || 0).toLocaleString("es-AR"),
  formatDate = (d) => d,
  weeks = [],
  tcList = [],
  arqueosList = [],
  expenseCats = [],
  incomeCats = [],
  onIrAMovimientos,
  onNuevoMovimiento,
  onAbrirImportadorMatriz,
  onIrAProyecciones,
  onIrAProyectos
}) {
  // Filtros interactivos
  const [moneda, setMoneda] = useState("ARS"); // "ARS" | "USD"
  const [filtroPeriodo, setFiltroPeriodo] = useState("13_semanas"); // "13_semanas" | "2026" | "todo"
  const [filtroActividad, setFiltroActividad] = useState("todas"); // "todas" | "operativa" | "inversion" | "financiamiento"
  const [busquedaConcepto, setBusquedaConcepto] = useState("");

  const hoyISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Tipo de cambio referencial (último registrado en Supabase)
  const ultimoDolar = useMemo(() => {
    if (!tcList || tcList.length === 0) return 1550;
    const sorted = [...tcList].sort((a, b) => (b.fecha_corte || "").localeCompare(a.fecha_corte || ""));
    const val = Number(sorted[0]?.saldo_efectivo);
    return val > 0 ? val : 1550;
  }, [tcList]);

  // Conversión monetaria según selector
  const conv = useCallback((montoArs) => {
    const n = Number(montoArs) || 0;
    return moneda === "USD" ? n / ultimoDolar : n;
  }, [moneda, ultimoDolar]);

  const formatoValor = useCallback((montoArs, compact = false) => {
    const v = conv(montoArs);
    const prefix = moneda === "USD" ? "US$ " : "$ ";
    if (compact) {
      if (Math.abs(v) >= 1_000_000_000) {
        return `${prefix}${(v / 1_000_000_000).toFixed(2)}B`;
      }
      if (Math.abs(v) >= 1_000_000) {
        return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
      }
      if (Math.abs(v) >= 1_000) {
        return `${prefix}${(v / 1_000).toFixed(0)}k`;
      }
    }
    return `${prefix}${fmt(Math.round(v))}`;
  }, [conv, moneda, fmt]);

  // Semanas filtradas para el dashboard
  const semanasFiltradas = useMemo(() => {
    if (!procesadas || procesadas.length === 0) return [];
    if (filtroPeriodo === "2026") {
      return procesadas.filter(w => w.week_start.startsWith("2026"));
    }
    if (filtroPeriodo === "13_semanas") {
      const idxHoy = procesadas.findIndex(w => w.week_start >= hoyISO);
      const inicio = idxHoy !== -1 ? Math.max(0, idxHoy - 2) : 0;
      return procesadas.slice(inicio, inicio + 13);
    }
    return procesadas;
  }, [procesadas, filtroPeriodo, hoyISO]);

  // Totales acumulados del periodo filtrado para los 4 KPIs
  const totalesKpi = useMemo(() => {
    let ing = 0;
    let eg = 0;
    semanasFiltradas.forEach(w => {
      ing += Number(w.totalIngresos || 0);
      eg += Number(w.totalEgresos || 0);
    });
    const neto = ing - eg;
    const ultimaSemana = semanasFiltradas[semanasFiltradas.length - 1];
    const saldoFinal = ultimaSemana ? Number(ultimaSemana.saldoAcumulado || 0) : Number(kpis?.liquidez || 0);
    const saldoInicial = semanasFiltradas[0] ? Number(semanasFiltradas[0].saldoInicial || 0) : 0;

    return {
      ingresoTotal: ing,
      egresoTotal: eg,
      flujoNeto: neto,
      saldoFinal,
      saldoInicial
    };
  }, [semanasFiltradas, kpis]);

  // Datos para los gráficos de Recharts
  const datosGrafico = useMemo(() => {
    return semanasFiltradas.map(w => {
      const ing = Number(w.totalIngresos || 0);
      const eg = Number(w.totalEgresos || 0);
      const neto = ing - eg;
      const saldo = Number(w.saldoAcumulado || 0);
      const [year, month, day] = (w.week_start || "").split("-");
      const shortLabel = `${day}/${month}`;

      return {
        fecha: w.week_start,
        label: shortLabel,
        ingreso: conv(ing),
        egreso: conv(eg),
        flujoNeto: conv(neto),
        saldoAcumulado: conv(saldo),
        status: w.status
      };
    });
  }, [semanasFiltradas, conv]);

  // Clasificación IFRS / ERP de actividades: Operativas, Inversión y Financiamiento
  const desgloseActividades = useMemo(() => {
    if (!weeks || weeks.length === 0) return [];

    const getTC = (d) => {
      if (!tcList || tcList.length === 0) return 1;
      const match = tcList.filter(t => t.fecha_corte <= d).sort((a, b) => b.fecha_corte.localeCompare(a.fecha_corte));
      return match.length > 0 ? Number(match[0].saldo_efectivo) || 1 : 1;
    };

    // Mapeador de rubros hacia las 3 ramas IFRS
    const categorizarActividad = (key, tipo) => {
      const k = String(key).toLowerCase();
      // 1. FINANCIAMIENTO: Bancos, pasivos, deudas, préstamos, tarjetas, aportes
      if (
        k.includes("cudmani") || k.includes("sposito") || k.includes("banco") ||
        k.includes("pasivo") || k.includes("prestamo") || k.includes("tarjeta") ||
        k.includes("financier") || k.includes("aporte") || k.includes("socios") ||
        k.includes("pesa") || k.includes("capital")
      ) {
        return {
          actividad: "financiamiento",
          actividadLabel: "Financiamiento",
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30"
        };
      }

      // 2. INVERSIÓN: Obras, proyectos, contratistas, compras de activos, terreno, colonia
      if (
        k.includes("proy") || k.includes("duo") || k.includes("green") ||
        k.includes("auria") || k.includes("boulevard") || k.includes("neuquen") ||
        k.includes("300") || k.includes("contratista") || k.includes("obra") ||
        k.includes("colonia") || k.includes("terreno") || k.includes("inversion") ||
        k.includes("tdys") || k.includes("infra")
      ) {
        return {
          actividad: "inversion",
          actividadLabel: "Inversión en Obras",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30"
        };
      }

      // 3. OPERATIVA: Cobranzas a clientes, ventas comerciales, nóminas, sueldos, impuestos, admin
      return {
        actividad: "operativa",
        actividadLabel: "Operativa",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      };
    };

    // Agrupar los movimientos del rango seleccionado
    const mapaConceptos = {};
    const semanasMap = new Set(semanasFiltradas.map(s => s.week_start));

    weeks.forEach(w => {
      if (!semanasMap.has(w.week_start)) return;
      const tc = getTC(w.week_start);

      // Ingresos
      Object.entries(w.income || {}).forEach(([k, v]) => {
        let valArs = 0;
        if (typeof v === "object" && v !== null) {
          valArs = Number(v.ars || 0) + Number(v.usd || 0) * tc;
        } else {
          valArs = Number(v || 0);
        }
        if (valArs > 0) {
          if (!mapaConceptos[k]) {
            const catObj = incomeCats.find(c => c.key === k);
            const { actividad, actividadLabel, badgeColor } = categorizarActividad(k, "ingreso");
            mapaConceptos[k] = {
              key: k,
              nombre: catObj ? catObj.label : k.replace("custom_", "").replace("_", " "),
              tipo: "Ingreso",
              actividad,
              actividadLabel,
              badgeColor,
              entradas: 0,
              salidas: 0
            };
          }
          mapaConceptos[k].entradas += valArs;
        }
      });

      // Egresos
      Object.entries(w.expense || {}).forEach(([k, v]) => {
        let valArs = 0;
        if (typeof v === "object" && v !== null) {
          valArs = Number(v.ars || 0) + Number(v.usd || 0) * tc;
        } else {
          valArs = Number(v || 0);
        }
        if (valArs > 0) {
          if (!mapaConceptos[k]) {
            const catObj = expenseCats.find(c => c.key === k);
            const { actividad, actividadLabel, badgeColor } = categorizarActividad(k, "egreso");
            mapaConceptos[k] = {
              key: k,
              nombre: catObj ? catObj.label : k.replace("custom_", "").replace("_", " "),
              tipo: "Egreso",
              actividad,
              actividadLabel,
              badgeColor,
              entradas: 0,
              salidas: 0
            };
          }
          mapaConceptos[k].salidas += valArs;
        }
      });
    });

    const lista = Object.values(mapaConceptos).map(item => ({
      ...item,
      neto: item.entradas - item.salidas,
      volumen: item.entradas + item.salidas
    }));

    return lista.sort((a, b) => b.volumen - a.volumen);
  }, [weeks, semanasFiltradas, tcList, incomeCats, expenseCats]);

  // Filtrado de la tabla según actividad y búsqueda
  const tablaFiltrada = useMemo(() => {
    return desgloseActividades.filter(item => {
      const matchAct = filtroActividad === "todas" || item.actividad === filtroActividad;
      const matchBusqueda = busquedaConcepto.trim() === "" ||
        item.nombre.toLowerCase().includes(busquedaConcepto.toLowerCase()) ||
        item.actividadLabel.toLowerCase().includes(busquedaConcepto.toLowerCase());
      return matchAct && matchBusqueda;
    });
  }, [desgloseActividades, filtroActividad, busquedaConcepto]);

  // Totales de las tres actividades IFRS
  const resumenActividades = useMemo(() => {
    let op = { entradas: 0, salidas: 0, neto: 0 };
    let inv = { entradas: 0, salidas: 0, neto: 0 };
    let fin = { entradas: 0, salidas: 0, neto: 0 };

    desgloseActividades.forEach(item => {
      if (item.actividad === "operativa") {
        op.entradas += item.entradas;
        op.salidas += item.salidas;
      } else if (item.actividad === "inversion") {
        inv.entradas += item.entradas;
        inv.salidas += item.salidas;
      } else if (item.actividad === "financiamiento") {
        fin.entradas += item.entradas;
        fin.salidas += item.salidas;
      }
    });

    op.neto = op.entradas - op.salidas;
    inv.neto = inv.entradas - inv.salidas;
    fin.neto = fin.entradas - fin.salidas;

    return { op, inv, fin };
  }, [desgloseActividades]);

  // Custom Glassmorphic Tooltip para Recharts
  const CustomGlassTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl text-xs text-white min-w-[200px]">
          <div className="font-semibold text-slate-300 mb-2 border-b border-white/10 pb-1.5 flex justify-between">
            <span>Semana: {label}</span>
            <span className="text-indigo-400 font-mono">{moneda}</span>
          </div>
          <div className="space-y-1.5">
            {payload.map((entry, index) => (
              <div key={`item-${index}`} className="flex justify-between items-center gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-mono font-semibold">
                  {moneda === "USD" ? "US$ " : "$ "}{fmt(Math.round(entry.value))}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-slate-100 p-4 sm:p-6 lg:p-8 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
      
      {/* Orbes de luz de fondo para intensificar el efecto Glassmorphism */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">

        {/* 1. CABECERA EJECUTIVA GLASSMORPHIC */}
        <header className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                ERP FINANCIERO · LINK INVERSIONES
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Tiempo Real
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Flujo de Caja <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">Glassflow</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Panel ejecutivo integral: liquidez en vivo, curvas acumuladas, comparativa de tesorería y desglose de actividades operativas, de inversión y financiamiento.
            </p>
          </div>

          {/* CONTROLES: MONEDA, PERIODO Y ACCIONES */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Moneda */}
            <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setMoneda("ARS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  moneda === "ARS"
                    ? "bg-white text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                $ ARS
              </button>
              <button
                onClick={() => setMoneda("USD")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  moneda === "USD"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                US$ Dólar
              </button>
            </div>

            {/* Selector de Periodo */}
            <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setFiltroPeriodo("13_semanas")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtroPeriodo === "13_semanas"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                13 Semanas
              </button>
              <button
                onClick={() => setFiltroPeriodo("2026")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtroPeriodo === "2026"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Año 2026
              </button>
              <button
                onClick={() => setFiltroPeriodo("todo")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtroPeriodo === "todo"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Horizonte Total
              </button>
            </div>

            {/* Botón rápido para movimientos */}
            {onNuevoMovimiento && (
              <button
                onClick={onNuevoMovimiento}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-lg backdrop-blur-md transition-all active:scale-95"
              >
                <Plus size={15} /> Cargar
              </button>
            )}

            {onAbrirImportadorMatriz && (
              <button
                onClick={onAbrirImportadorMatriz}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500/30 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-400/40 shadow-lg backdrop-blur-md transition-all active:scale-95"
              >
                <Upload size={14} /> Importar Excel
              </button>
            )}
          </div>
        </header>

        {/* 2. TARJETAS DE KPI GLASSMORPHIC (4 PANELES) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: INGRESO TOTAL */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl hover:border-emerald-400/50 hover:bg-white/[0.13] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Ingreso Total
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div className="text-2xl xl:text-3xl font-extrabold text-white font-mono tracking-tight">
              {formatoValor(totalesKpi.ingresoTotal)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <TrendingUp size={13} /> Entradas del periodo
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {semanasFiltradas.length} semanas
              </span>
            </div>
          </div>

          {/* KPI 2: EGRESO TOTAL */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl hover:border-rose-400/50 hover:bg-white/[0.13] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Egreso Total
              </span>
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 group-hover:scale-110 transition-transform">
                <ArrowDownRight size={18} />
              </div>
            </div>
            <div className="text-2xl xl:text-3xl font-extrabold text-white font-mono tracking-tight">
              {formatoValor(totalesKpi.egresoTotal)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <TrendingDown size={13} /> Compromisos y obras
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Burn rate semanal
              </span>
            </div>
          </div>

          {/* KPI 3: FLUJO NETO */}
          <div className={`bg-white/10 backdrop-blur-lg border rounded-2xl p-5 shadow-xl transition-all group ${
            totalesKpi.flujoNeto >= 0
              ? "border-emerald-400/40 hover:border-emerald-400/60"
              : "border-rose-400/40 hover:border-rose-400/60"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Flujo Neto
              </span>
              <div className={`p-2.5 rounded-xl border group-hover:scale-110 transition-transform ${
                totalesKpi.flujoNeto >= 0
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
              }`}>
                <Activity size={18} />
              </div>
            </div>
            <div className={`text-2xl xl:text-3xl font-extrabold font-mono tracking-tight ${
              totalesKpi.flujoNeto >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}>
              {totalesKpi.flujoNeto >= 0 ? "+" : ""}{formatoValor(totalesKpi.flujoNeto)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
              <span className={`font-semibold ${totalesKpi.flujoNeto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalesKpi.flujoNeto >= 0 ? "Superávit de Tesorería" : "Déficit Neto en Periodo"}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Ingresos - Egresos
              </span>
            </div>
          </div>

          {/* KPI 4: SALDO FINAL / LIQUIDEZ */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl hover:border-indigo-400/50 hover:bg-white/[0.13] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Saldo Final Proyectado
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform">
                <Wallet size={18} />
              </div>
            </div>
            <div className="text-2xl xl:text-3xl font-extrabold text-white font-mono tracking-tight">
              {formatoValor(totalesKpi.saldoFinal)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300">
              <span className="text-indigo-300 font-semibold flex items-center gap-1">
                <ShieldCheck size={13} color="#818CF8" /> 
                {kpis?.diasDeCaja != null ? `${kpis.diasDeCaja} días de runway` : "Posición en bancos"}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                TC: ${ultimoDolar}
              </span>
            </div>
          </div>

        </section>

        {/* 3. SECCIÓN DE GRÁFICOS (RECHARTS GLASSMORPHIC) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* GRÁFICO 1: COMPARATIVA INGRESOS VS EGRESOS */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-400" />
                  Comparativa de Ingresos vs Egresos
                </h3>
                <p className="text-xs text-slate-300">
                  Volumen semanal de cobranzas comerciales vs compromisos de obras y estructura
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Ingresos
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Egresos
                </span>
              </div>
            </div>

            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255, 255, 255, 0.15)" }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255, 255, 255, 0.15)" }}
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
                      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                      return v;
                    }}
                  />
                  <Tooltip content={<CustomGlassTooltip />} />
                  <Bar
                    dataKey="ingreso"
                    name="Ingresos"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="egreso"
                    name="Egresos"
                    fill="#F43F5E"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: EVOLUCIÓN DEL SALDO ACUMULADO */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp size={18} className="text-purple-400" />
                  Evolución del Saldo Acumulado
                </h3>
                <p className="text-xs text-slate-300">
                  Trayectoria de liquidez proyectada en el tiempo y distancia respecto al punto de equilibrio ($0)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-purple-300 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Posición Acumulada
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <span className="w-2.5 h-0.5 bg-amber-400" /> Nivel Cero
                </span>
              </div>
            </div>

            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glassSaldoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255, 255, 255, 0.15)" }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255, 255, 255, 0.15)" }}
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
                      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                      return v;
                    }}
                  />
                  <Tooltip content={<CustomGlassTooltip />} />
                  <ReferenceLine y={0} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="saldoAcumulado"
                    name="Saldo Acumulado"
                    stroke="#C084FC"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#glassSaldoGrad)"
                    dot={{ r: 3, fill: "#C084FC", strokeWidth: 1, stroke: "#FFFFFF" }}
                    activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#A855F7", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        {/* 4. TARJETAS SINTÉTICAS DE LAS 3 ACTIVIDADES IFRS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Actividades Operativas */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-emerald-300">
              <Briefcase size={18} />
              <h4 className="font-bold text-sm">1. Flujo de Operaciones</h4>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Cobranzas a clientes, ventas comerciales, nóminas, administración e impuestos
            </p>
            <div className="flex justify-between items-end border-t border-white/10 pt-3">
              <div>
                <div className="text-[11px] text-slate-400">Entradas / Salidas</div>
                <div className="text-xs font-mono text-slate-200">
                  +{formatoValor(resumenActividades.op.entradas, true)} / -{formatoValor(resumenActividades.op.salidas, true)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Neto Operativo</div>
                <div className={`text-base font-bold font-mono ${resumenActividades.op.neto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {resumenActividades.op.neto >= 0 ? "+" : ""}{formatoValor(resumenActividades.op.neto, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Actividades de Inversión */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-amber-300">
              <Building2 size={18} />
              <h4 className="font-bold text-sm">2. Flujo de Inversión</h4>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Certificaciones de obras (DUO, T2, Green, +DUO, Auria) y desarrollo inmobiliario
            </p>
            <div className="flex justify-between items-end border-t border-white/10 pt-3">
              <div>
                <div className="text-[11px] text-slate-400">Entradas / Salidas</div>
                <div className="text-xs font-mono text-slate-200">
                  +{formatoValor(resumenActividades.inv.entradas, true)} / -{formatoValor(resumenActividades.inv.salidas, true)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Neto Inversión</div>
                <div className={`text-base font-bold font-mono ${resumenActividades.inv.neto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {resumenActividades.inv.neto >= 0 ? "+" : ""}{formatoValor(resumenActividades.inv.neto, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Actividades de Financiamiento */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-purple-300">
              <Landmark size={18} />
              <h4 className="font-bold text-sm">3. Flujo de Financiamiento</h4>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Cancelación de pasivos (Cudmani, Sposito, Bancos), líneas crediticias y aportes
            </p>
            <div className="flex justify-between items-end border-t border-white/10 pt-3">
              <div>
                <div className="text-[11px] text-slate-400">Entradas / Salidas</div>
                <div className="text-xs font-mono text-slate-200">
                  +{formatoValor(resumenActividades.fin.entradas, true)} / -{formatoValor(resumenActividades.fin.salidas, true)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Neto Financiero</div>
                <div className={`text-base font-bold font-mono ${resumenActividades.fin.neto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {resumenActividades.fin.neto >= 0 ? "+" : ""}{formatoValor(resumenActividades.fin.neto, true)}
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* 5. TABLA DE DESGLOSE GLASSMORPHIC (ACTIVIDADES OPERATIVAS, INVERSIÓN Y FINANCIAMIENTO) */}
        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers size={20} className="text-indigo-400" />
                Desglose de Actividades de Flujo de Caja
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Clasificación estándar ERP IFRS por rubro: Operativas, Inversión en Obras y Financiamiento
              </p>
            </div>

            {/* BUSCADOR Y SELECTORES DE PESTAÑA DE TABLA */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Buscador de concepto */}
              <input
                type="text"
                placeholder="Buscar concepto u obra..."
                value={busquedaConcepto}
                onChange={(e) => setBusquedaConcepto(e.target.value)}
                className="bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 backdrop-blur-md w-full sm:w-52"
              />

              {/* Botones de filtro de actividad */}
              <div className="flex items-center bg-black/25 p-1 rounded-xl border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => setFiltroActividad("todas")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    filtroActividad === "todas" ? "bg-white/20 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todas ({desgloseActividades.length})
                </button>
                <button
                  onClick={() => setFiltroActividad("operativa")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    filtroActividad === "operativa" ? "bg-emerald-500/30 text-emerald-200 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Operativas
                </button>
                <button
                  onClick={() => setFiltroActividad("inversion")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    filtroActividad === "inversion" ? "bg-amber-500/30 text-amber-200 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Inversión
                </button>
                <button
                  onClick={() => setFiltroActividad("financiamiento")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    filtroActividad === "financiamiento" ? "bg-purple-500/30 text-purple-200 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Financiamiento
                </button>
              </div>
            </div>
          </div>

          {/* TABLA GLASSY */}
          <div className="overflow-x-auto rounded-xl border border-white/10 mt-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.08] text-slate-300 font-semibold uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Concepto / Rubro</th>
                  <th className="py-3 px-4">Actividad ERP</th>
                  <th className="py-3 px-4">Naturaleza</th>
                  <th className="py-3 px-4 text-right">Entradas (+)</th>
                  <th className="py-3 px-4 text-right">Salidas (-)</th>
                  <th className="py-3 px-4 text-right">Flujo Neto</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {tablaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No se encontraron movimientos para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  tablaFiltrada.map((row) => (
                    <tr
                      key={row.key}
                      className="hover:bg-white/[0.07] transition-colors"
                    >
                      {/* Concepto */}
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>{row.nombre}</span>
                        </div>
                      </td>

                      {/* Actividad Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${row.badgeColor}`}>
                          {row.actividadLabel}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-4 text-slate-300">
                        {row.tipo}
                      </td>

                      {/* Entradas */}
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-medium">
                        {row.entradas > 0 ? `+${formatoValor(row.entradas)}` : "—"}
                      </td>

                      {/* Salidas */}
                      <td className="py-3 px-4 text-right font-mono text-rose-400 font-medium">
                        {row.salidas > 0 ? `-${formatoValor(row.salidas)}` : "—"}
                      </td>

                      {/* Neto */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        row.neto > 0 ? "text-emerald-300" : row.neto < 0 ? "text-rose-300" : "text-slate-400"
                      }`}>
                        {row.neto > 0 ? "+" : ""}{formatoValor(row.neto)}
                      </td>

                      {/* Botón ver detalles */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            if (row.actividad === "inversion" && onIrAProyectos) {
                              onIrAProyectos();
                            } else if (onIrAMovimientos) {
                              onIrAMovimientos();
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 transition-colors text-[11px] inline-flex items-center gap-1"
                        >
                          Ver <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER DE LA TABLA CON RESUMEN TOTALIZADOR */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-300 pt-2 border-t border-white/10 gap-2">
            <span>
              Mostrando <strong>{tablaFiltrada.length}</strong> de <strong>{desgloseActividades.length}</strong> conceptos procesados
            </span>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-emerald-400">Total Inflow: +{formatoValor(totalesKpi.ingresoTotal)}</span>
              <span className="text-rose-400">Total Outflow: -{formatoValor(totalesKpi.egresoTotal)}</span>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
}
