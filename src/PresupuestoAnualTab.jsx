import React, { useState, useEffect, useMemo } from "react";
import { tokens } from "./tokens";
import {
  PLAN_INCOME_CATS_2026,
  PLAN_INCOME_CATS_2027,
  PLAN_INCOME_CATS,
  PLAN_PROJECT_CATS_2027,
  PLAN_PROJECT_CATS,
  PLAN_ESTRUCTURA_CATS_2027,
  PLAN_FINANCIERO_CATS_2027,
  PLAN_EXPENSE_CATS_2027,
  PLAN_EXPENSE_CATS,
  DEFAULT_PLAN_2026,
  DEFAULT_PLAN_2027
} from "./budgetData";
import ImportadorPresupuestoExcel from "./ImportadorPresupuestoExcel";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, BarChart, Bar, LabelList
} from "recharts";
import {
  Wand2, RotateCcw, Upload, Link as LinkIcon, Pencil, Save,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, DollarSign,
  Building2, HardHat, Users, Scale, FileSpreadsheet, Activity,
  CheckCircle2, SlidersHorizontal, Zap, ArrowRight, Eye, ShieldAlert,
  Sparkles, Check, AlertCircle
} from "lucide-react";

/* Interruptor on/off para proyectos y opciones */
function ToggleSwitch({ on, onChange, size = 16 }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      role="switch"
      aria-checked={on}
      style={{
        width: size * 1.8, height: size, borderRadius: size, flexShrink: 0,
        background: on ? tokens.positive : "#CBD5E1", position: "relative",
        cursor: "pointer", transition: "background 0.15s ease",
      }}
    >
      <div style={{
        position: "absolute", top: 1.5, left: on ? size * 0.82 : 1.5,
        width: size - 3, height: size - 3, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

/* Pastilla de variación % */
function DeltaBadge({ base, sim, positiveIsGood = true, size = "sm" }) {
  const diff = sim - base;
  if (Math.abs(diff) < 0.5) return null;
  const pct = base !== 0 ? (diff / Math.abs(base)) * 100 : 0;
  const isUp = diff > 0;
  const good = positiveIsGood ? isUp : !isUp;
  const color = good ? tokens.positive : tokens.negative;
  const bg = good ? tokens.positiveSoft : tokens.negativeSoft;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const fs = size === "lg" ? 12 : 11;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: fs, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 12, whiteSpace: "nowrap" }}>
      <Icon size={size === "lg" ? 13 : 11} /> {isUp ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function PresupuestoAnualTab({
  planIncomeCats = PLAN_INCOME_CATS,
  planExpenseCats = PLAN_EXPENSE_CATS,
  dailyIncomeCats = [],
  dailyExpenseCats = [],
  fmt,
  planesFondos = {},
  mappingGuardado = { ingreso: {}, egreso: {} },
  onGuardarPlan,
  onGuardarMapeo,
  tcList = []
}) {
  const meses = [
    { k: "01", n: "Ene" }, { k: "02", n: "Feb" }, { k: "03", n: "Mar" }, { k: "04", n: "Abr" },
    { k: "05", n: "May" }, { k: "06", n: "Jun" }, { k: "07", n: "Jul" }, { k: "08", n: "Ago" },
    { k: "09", n: "Sep" }, { k: "10", n: "Oct" }, { k: "11", n: "Nov" }, { k: "12", n: "Dic" }
  ];

  const [selectedYear, setSelectedYear] = useState("2027");
  const [view, setView] = useState("presupuesto");
  const [editMode, setEditMode] = useState(false);
  const [planDraft, setPlanDraft] = useState({});
  const [mappingDraft, setMappingDraft] = useState({ ingreso: {}, egreso: {} });
  const [mostrarImportadorPresupuesto, setMostrarImportadorPresupuesto] = useState(false);

  // NUEVO: Switch para Ver en Moneda Pesos ($ ARS) o Dólares (USD)
  const [moneda, setMoneda] = useState("ARS"); // "ARS" | "USD"

  // Switch para Ver en Millones / Miles ($ M / kUSD) o Cifras Completas
  const [enMillones, setEnMillones] = useState(true);

  // Tipo de cambio de referencia para conversión a USD
  const tcPorDefecto = useMemo(() => {
    if (!tcList || tcList.length === 0) return 1540; 
    const sorted = [...tcList].sort((a, b) => (b.fecha_corte || "").localeCompare(a.fecha_corte || ""));
    const val = Number(sorted[0]?.saldo_efectivo);
    return (val && !isNaN(val)) ? val : 1540;
  }, [tcList]);

  const [tcReferencia, setTcReferencia] = useState(tcPorDefecto);

  useEffect(() => {
    setTcReferencia(tcPorDefecto);
  }, [tcPorDefecto]);

  const ultimoDolar = tcReferencia;

  // ESTADO DEL SIMULADOR DINÁMICO
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  const [scenarioName, setScenarioName] = useState("Base");
  const [simData, setSimData] = useState({ globalIng: 0, globalEg: 0, cats: {}, meses: {} });
  const [proyectosExpanded, setProyectosExpanded] = useState(true);
  const [proyectosActivos, setProyectosActivos] = useState({});

  const projectKeys = useMemo(() => new Set(PLAN_PROJECT_CATS.map(p => p.key)), []);
  const isProyectoActivo = (key) => proyectosActivos[key] !== false;

  useEffect(() => {
    setPlanDraft(planesFondos[selectedYear] || (selectedYear === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026));
  }, [planesFondos, selectedYear, editMode, view]);

  useEffect(() => {
    setMappingDraft({ ingreso: { ...(mappingGuardado?.ingreso || {}) }, egreso: { ...(mappingGuardado?.egreso || {}) } });
  }, [mappingGuardado, view]);

  useEffect(() => {
    if (editMode) setSimulacionActiva(false);
  }, [editMode]);

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

  // MATEMÁTICA DEL SIMULADOR
  const getSimVal = (tipo, conceptoKey, mesKey) => {
    const baseVal = planDraft?.[tipo]?.[conceptoKey]?.[mesKey] || 0;
    if (!simulacionActiva) return baseVal;

    // Proyecto desactivado en la simulación → $ 0
    if (tipo === "egreso" && projectKeys.has(conceptoKey) && !isProyectoActivo(conceptoKey)) return 0;

    const glob = tipo === 'ingreso' ? (simData.globalIng || 0) : (simData.globalEg || 0);
    const cat = simData.cats[conceptoKey] || 0;
    const mes = simData.meses[mesKey] || 0;
    
    const totalPct = glob + cat + mes;
    return baseVal * (1 + totalPct / 100);
  };

  const getBaseVal = (tipo, conceptoKey, mesKey) => planDraft?.[tipo]?.[conceptoKey]?.[mesKey] || 0;

  const calcularTotalFila = (tipo, conceptoKey) => {
    let total = 0;
    meses.forEach(m => { total += getSimVal(tipo, conceptoKey, m.k); });
    return total;
  };

  const calcularTotalFilaBase = (tipo, conceptoKey) => {
    let total = 0;
    meses.forEach(m => { total += getBaseVal(tipo, conceptoKey, m.k); });
    return total;
  };

  // Categorías activas según el año seleccionado
  const activeIncomeCats = useMemo(() => {
    return selectedYear === "2027" ? PLAN_INCOME_CATS_2027 : planIncomeCats;
  }, [selectedYear, planIncomeCats]);

  const activeExpenseCats = useMemo(() => {
    return selectedYear === "2027" ? PLAN_EXPENSE_CATS_2027 : planExpenseCats;
  }, [selectedYear, planExpenseCats]);

  const calcularTotalColumna = (tipo, mesKey) => {
    let total = 0;
    const catalogo = tipo === "ingreso" ? activeIncomeCats : activeExpenseCats;
    catalogo.forEach(c => { total += getSimVal(tipo, c.key, mesKey); });
    return total;
  };

  const calcularTotalColumnaBase = (tipo, mesKey) => {
    let total = 0;
    const catalogo = tipo === "ingreso" ? activeIncomeCats : activeExpenseCats;
    catalogo.forEach(c => { total += getBaseVal(tipo, c.key, mesKey); });
    return total;
  };

  // Totales Anuales
  const totalIngSim = activeIncomeCats.reduce((acc, c) => acc + calcularTotalFila("ingreso", c.key), 0);
  const totalEgSim = activeExpenseCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);
  const totalNetoSim = totalIngSim - totalEgSim;

  const totalIngBase = activeIncomeCats.reduce((acc, c) => acc + calcularTotalFilaBase("ingreso", c.key), 0);
  const totalEgBase = activeExpenseCats.reduce((acc, c) => acc + calcularTotalFilaBase("egreso", c.key), 0);
  const totalNetoBase = totalIngBase - totalEgBase;

  // Clasificación de egresos para subtotales y análisis
  const cuposCats = useMemo(() => {
    return PLAN_PROJECT_CATS_2027.filter(p => p.group === "cupos");
  }, []);

  const obrasCats = useMemo(() => {
    return PLAN_PROJECT_CATS_2027.filter(p => p.group === "obras");
  }, []);

  const estructuraCats = useMemo(() => {
    return selectedYear === "2027"
      ? PLAN_ESTRUCTURA_CATS_2027
      : planExpenseCats.filter(p => ["custom_rrhh", "custom_administracion"].includes(p.key) || p.group === "estructura");
  }, [selectedYear, planExpenseCats]);

  const financieroCats = useMemo(() => {
    return selectedYear === "2027"
      ? PLAN_FINANCIERO_CATS_2027
      : planExpenseCats.filter(p => ["custom_inversiones", "custom_pasivos-financieros"].includes(p.key) || p.group === "inversiones" || p.group === "pasivos");
  }, [selectedYear, planExpenseCats]);

  const totalObrasSim = useMemo(() => {
    return PLAN_PROJECT_CATS_2027.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);
  }, [planDraft, simData, simulacionActiva, proyectosActivos]);

  const totalEstructuraSim = useMemo(() => {
    return estructuraCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);
  }, [estructuraCats, planDraft, simData, simulacionActiva]);

  const totalFinancieroSim = useMemo(() => {
    return financieroCats.reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0);
  }, [financieroCats, planDraft, simData, simulacionActiva]);

  // Función inteligente de formateo según la moneda elegida (ARS o USD)
  const formatMoney = (val, forceFull = false) => {
    if (val == null || isNaN(val)) return "-";
    const num = Number(val);
    if (Math.abs(num) < 0.01) return "-";

    if (moneda === "USD") {
      const usd = num / (tcReferencia || 1540);
      const sign = usd < 0 ? "-" : "";
      const absUsd = Math.abs(usd);

      if (enMillones && !forceFull) {
        if (absUsd >= 1_000_000) {
          const mUsd = absUsd / 1_000_000;
          return `${sign}USD ${mUsd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
        }
        const kUsd = absUsd / 1000;
        const dec = kUsd >= 100 ? 0 : 1;
        return `${sign}USD ${kUsd.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}k`;
      } else {
        return `${sign}USD ${Math.abs(Math.round(usd)).toLocaleString("es-AR")}`;
      }
    } else {
      // Moneda Pesos ARS
      if (enMillones && !forceFull) {
        const enM = num / 1_000_000;
        const sign = enM < 0 ? "-" : "";
        const absFormatted = Math.abs(enM).toLocaleString("es-AR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        });
        return `${sign}$ ${absFormatted} M`;
      } else {
        const sign = num < 0 ? "-" : "";
        return `${sign}$ ${Math.abs(Math.round(num)).toLocaleString("es-AR")}`;
      }
    }
  };

  // Formato USD de referencia (kUSD o USD completo)
  const formatUSD = (valARS, forzarCompleto = false) => {
    if (valARS === null || valARS === undefined || isNaN(valARS)) return "-";
    const usd = valARS / (tcReferencia || 1540);
    if (Math.abs(usd) < 0.5) return "-";

    if (forzarCompleto) {
      return `${usd < 0 ? "-" : ""}USD ${Math.abs(Math.round(usd)).toLocaleString("es-AR")}`;
    }

    const enMiles = usd / 1000;
    const absMiles = Math.abs(enMiles);
    const signo = enMiles < 0 ? "-" : "";

    const strMiles = absMiles >= 10
      ? Math.round(absMiles).toLocaleString("es-AR")
      : absMiles.toFixed(1).replace(".", ",");

    return `${signo}USD ${strMiles}k`;
  };

  // Alivio / Mejora de caja en simulación
  const alivioARS = totalNetoSim - totalNetoBase;
  const alivioUSD = alivioARS / ultimoDolar;

  // Mes más crítico (con mayor déficit)
  const mesCritico = useMemo(() => {
    let peorMes = meses[0];
    let peorNeto = 0;
    meses.forEach(m => {
      const neto = calcularTotalColumna("ingreso", m.k) - calcularTotalColumna("egreso", m.k);
      if (neto < peorNeto) {
        peorNeto = neto;
        peorMes = m;
      }
    });
    return { mes: peorMes.n, neto: peorNeto };
  }, [planDraft, simData, simulacionActiva, proyectosActivos]);

  // PRESETS ESTRATÉGICOS CON 1 CLIC
  const aplicarPreset = (tipo) => {
    setSimulacionActiva(true);
    setScenarioName(tipo);
    if (tipo === "base") {
      setSimData({ globalIng: 0, globalEg: 0, cats: {}, meses: {} });
      setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])));
    } else if (tipo === "optimista_ventas") {
      // +20% en Ventas estimadas
      setSimData({
        globalIng: 0,
        globalEg: 0,
        cats: { "custom_ventas-cdo": 20 },
        meses: {}
      });
      setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])));
    } else if (tipo === "cauteloso_ventas") {
      // -15% en ventas
      setSimData({
        globalIng: 0,
        globalEg: 0,
        cats: { "custom_ventas-cdo": -15 },
        meses: {}
      });
      setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])));
    } else if (tipo === "postergar_auria") {
      // Apaga Auria para 2027 (libera $763.8M de desembolso)
      setSimData({ globalIng: 0, globalEg: 0, cats: {}, meses: {} });
      setProyectosActivos({
        ...Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])),
        "proy_auria": false
      });
    } else if (tipo === "moderar_obras") {
      // -15% en obras directas
      setSimData({
        globalIng: 0,
        globalEg: 0,
        cats: { "proy_torre-green": -15, "proy_mas-duo": -15, "proy_auria": -15 },
        meses: {}
      });
      setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])));
    } else if (tipo === "eficiencia_estructura") {
      // -10% en gastos administrativos y sueldos
      setSimData({
        globalIng: 0,
        globalEg: 0,
        cats: { "custom_rrhh": -10, "custom_administracion": -10 },
        meses: {}
      });
      setProyectosActivos(Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])));
    } else if (tipo === "mitigacion_integral") {
      // +15% ventas, postergar Auria, -5% estructura
      setSimData({
        globalIng: 0,
        globalEg: 0,
        cats: {
          "custom_ventas-cdo": 15,
          "custom_administracion": -10,
          "custom_rrhh": -5
        },
        meses: {}
      });
      setProyectosActivos({
        ...Object.fromEntries(PLAN_PROJECT_CATS.map(p => [p.key, true])),
        "proy_auria": false
      });
    }
  };

  // Datos para el gráfico de evolución mensual
  const evolucionMensual = useMemo(() => {
    let acum = 0;
    return meses.map(m => {
      const ingB = calcularTotalColumnaBase("ingreso", m.k);
      const egB = calcularTotalColumnaBase("egreso", m.k);
      const ingS = calcularTotalColumna("ingreso", m.k);
      const egS = calcularTotalColumna("egreso", m.k);
      const netoS = ingS - egS;
      acum += netoS;

      const convertir = (val) => {
        if (moneda === "USD") {
          const usd = val / (tcReferencia || 1540);
          return enMillones ? usd / 1000 : usd;
        } else {
          return enMillones ? val / 1_000_000 : val;
        }
      };

      return {
        mes: m.n,
        ingresoBase: convertir(ingB),
        egresoBase: convertir(egB),
        ingresoSim: convertir(ingS),
        egresoSim: convertir(egS),
        netoSim: convertir(netoS),
        acumSim: convertir(acum),
        rawIngreso: ingS,
        rawEgreso: egS,
        rawNeto: netoS,
        rawAcum: acum
      };
    });
  }, [planDraft, simData, simulacionActiva, proyectosActivos, enMillones, moneda, tcReferencia]);

  // Distribución de Ingresos y Egresos para las donas
  const pieIngresos = useMemo(() => {
    return activeIncomeCats.map(c => {
      const val = calcularTotalFila("ingreso", c.key);
      return { name: c.label, value: val, perc: totalIngSim > 0 ? (val / totalIngSim) * 100 : 0 };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [activeIncomeCats, planDraft, simData, simulacionActiva, totalIngSim]);

  const pieEgresos = useMemo(() => {
    const invVal = selectedYear === "2027"
      ? PLAN_FINANCIERO_CATS_2027.filter(p => p.group === "inversiones").reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0)
      : calcularTotalFila("egreso", "custom_inversiones");

    const pasVal = selectedYear === "2027"
      ? PLAN_FINANCIERO_CATS_2027.filter(p => p.group === "pasivos").reduce((acc, c) => acc + calcularTotalFila("egreso", c.key), 0)
      : calcularTotalFila("egreso", "custom_pasivos-financieros");

    return [
      { name: "Obras y Proyectos", value: totalObrasSim },
      { name: "Estructura Operativa & RRHH", value: totalEstructuraSim },
      { name: "Inversiones", value: invVal },
      { name: "Pasivos Financieros", value: pasVal }
    ].map(d => ({ ...d, perc: totalEgSim > 0 ? (d.value / totalEgSim) * 100 : 0 })).filter(d => d.value > 0);
  }, [totalObrasSim, totalEstructuraSim, totalEgSim, selectedYear, planDraft, simData, simulacionActiva]);

  const COLORS_ING = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];
  const COLORS_EG = ['#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#64748B'];

  const guardarTodo = () => {
    if (view === "presupuesto") {
      onGuardarPlan(planDraft, selectedYear); 
      setEditMode(false);
    } else {
      onGuardarMapeo(mappingDraft);
      setView("presupuesto");
    }
  };

  // Cálculo acumulado mensual del déficit
  const deficitAcumuladoMeses = useMemo(() => {
    let acum = 0;
    const res = {};
    meses.forEach(m => {
      const neto = calcularTotalColumna("ingreso", m.k) - calcularTotalColumna("egreso", m.k);
      acum += neto;
      res[m.k] = acum;
    });
    return res;
  }, [planDraft, simData, simulacionActiva, proyectosActivos]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      
      {/* ── BARRA SUPERIOR: ENCABEZADO Y CONTROLES PRINCIPALES ── */}
      <div style={{
        background: tokens.surface,
        borderRadius: 12,
        border: `1px solid ${tokens.rule}`,
        padding: "18px 22px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet size={22} color={tokens.gold} />
              {view === "mapeo" ? "Mapeador de Conceptos" : `Presupuesto Anual ${selectedYear}`}
            </h2>
            {view === "presupuesto" && (
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  padding: "5px 12px",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: tokens.fontMono,
                  borderRadius: 8,
                  border: `1.5px solid ${tokens.gold}`,
                  background: tokens.goldSoft,
                  color: tokens.ink,
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="2025">Año 2025</option>
                <option value="2026">Año 2026</option>
                <option value="2027">Año 2027 (Oficial)</option>
                <option value="2028">Año 2028</option>
                <option value="2029">Año 2029</option>
              </select>
            )}
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
            {view === "mapeo" 
              ? "Vincula las categorías del Cashflow diario con las bolsas maestras del Presupuesto Anual." 
              : editMode
                ? `Editando directamente los montos proyectados para el ejercicio ${selectedYear} en ${moneda === "USD" ? "Dólares (USD)" : "Pesos ($ ARS)"}.`
                : `Plan Maestro financiero y curva de fondos proyectada para ${selectedYear}. Expresado en ${moneda === "USD" ? "Dólares (USD)" : "Pesos ($ ARS)"} • TC Ref: $${fmt(tcReferencia)}.`}
          </p>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          
          {/* SELECTOR DE MONEDA: PESOS ($ ARS) vs DÓLARES (USD) */}
          {view === "presupuesto" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#F8FAFC",
              borderRadius: 8,
              padding: "3px 6px",
              border: "1.5px solid #CBD5E1",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Moneda:
              </span>

              <div style={{ display: "flex", background: "#E2E8F0", borderRadius: 6, padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setMoneda("ARS")}
                  style={{
                    padding: "5px 11px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 5,
                    border: "none",
                    background: moneda === "ARS" ? "#1E293B" : "transparent",
                    color: moneda === "ARS" ? "#FFFFFF" : "#475569",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s ease",
                    boxShadow: moneda === "ARS" ? "0 1px 3px rgba(0,0,0,0.2)" : "none"
                  }}
                  title="Expresar todo el presupuesto anual en Pesos Argentinos ($ ARS)"
                >
                  <span>$ ARS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMoneda("USD")}
                  style={{
                    padding: "5px 11px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 5,
                    border: "none",
                    background: moneda === "USD" ? "linear-gradient(135deg, #B8862A 0%, #D4AF37 100%)" : "transparent",
                    color: moneda === "USD" ? "#FFFFFF" : "#475569",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s ease",
                    boxShadow: moneda === "USD" ? "0 1px 3px rgba(184,134,42,0.35)" : "none"
                  }}
                  title="Expresar todo el presupuesto anual en Dólares Estadounidenses (USD)"
                >
                  <DollarSign size={13} strokeWidth={2.5} />
                  <span>USD</span>
                </button>
              </div>

              {/* Indicador / Ajuste dinámico de Tipo de Cambio */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, borderLeft: "1px solid #CBD5E1", paddingLeft: 8 }}>
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>TC: $</span>
                <input
                  type="number"
                  value={tcReferencia}
                  onChange={(e) => setTcReferencia(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: 68,
                    padding: "3px 6px",
                    fontSize: 11.5,
                    fontFamily: tokens.fontMono,
                    fontWeight: 700,
                    color: tokens.ink,
                    border: "1px solid #CBD5E1",
                    borderRadius: 4,
                    textAlign: "right",
                    background: "#FFFFFF"
                  }}
                  title="Tipo de Cambio de conversión aplicado para Dólares. Modifícalo para proyectar diferentes escenarios cambiarios."
                />
                {tcReferencia !== tcPorDefecto && (
                  <button
                    type="button"
                    onClick={() => setTcReferencia(tcPorDefecto)}
                    title={`Restablecer al tipo de cambio registrado ($${tcPorDefecto})`}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 3,
                      color: tokens.textMuted,
                      display: "flex",
                      alignItems: "center",
                      borderRadius: 4
                    }}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TOGGLE SELECTOR DE UNIDAD: MILLONES / MILES vs COMPLETO */}
          {view === "presupuesto" && (
            <div style={{
              display: "flex",
              background: "#F1F5F9",
              borderRadius: 8,
              padding: 3,
              border: "1px solid #CBD5E1"
            }}>
              <button
                type="button"
                onClick={() => setEnMillones(true)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "none",
                  background: enMillones ? tokens.ink : "transparent",
                  color: enMillones ? "#FFFFFF" : tokens.textMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease"
                }}
                title={moneda === "USD" ? "Muestra las cifras en miles de dólares (kUSD)" : "Muestra los importes redondeados en Millones de pesos ($ M)"}
              >
                <Eye size={13} /> {moneda === "USD" ? "En Miles (kUSD)" : "En Millones ($ M)"}
              </button>
              <button
                type="button"
                onClick={() => setEnMillones(false)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "none",
                  background: !enMillones ? tokens.ink : "transparent",
                  color: !enMillones ? "#FFFFFF" : tokens.textMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease"
                }}
                title={moneda === "USD" ? "Muestra cada dólar exacto" : "Muestra todos los dígitos de cada peso"}
              >
                <DollarSign size={13} /> {moneda === "USD" ? "Dólares Completos" : "Pesos Completos ($)"}
              </button>
            </div>
          )}

          {view === "presupuesto" && !editMode && (
            <>
              {/* BOTÓN SIMULADOR DINÁMICO */}
              <button 
                onClick={() => {
                  const next = !simulacionActiva;
                  setSimulacionActiva(next);
                  if (next) aplicarPreset("base");
                }} 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: simulacionActiva ? "linear-gradient(135deg, #B8862A 0%, #D4AF37 100%)" : tokens.surface,
                  color: simulacionActiva ? "#FFFFFF" : tokens.ink,
                  border: `1.5px solid ${tokens.gold}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: simulacionActiva ? "0 4px 12px rgba(184, 134, 42, 0.25)" : "none",
                  transition: "all 0.2s"
                }}
              >
                <Wand2 size={16} /> {simulacionActiva ? "Cerrar Simulador" : "Simulador Dinámico"}
              </button>

              <button
                onClick={() => setMostrarImportadorPresupuesto(true)}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  background: "#F8FAFC",
                  color: tokens.ink,
                  border: `1px solid ${tokens.rule}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <Upload size={14} color={tokens.textMuted} /> Subir Excel
              </button>

              {selectedYear === "2027" && (
                <button
                  onClick={() => {
                    if (window.confirm("¿Deseas restaurar la Proyección Oficial Link 2027 con todos los conceptos y montos exactos de la planilla?")) {
                      setPlanDraft(DEFAULT_PLAN_2027);
                      onGuardarPlan(DEFAULT_PLAN_2027, "2027");
                    }
                  }}
                  type="button"
                  title="Restaura la proyección oficial 2027 con las 5 fuentes de ingreso y todas las obras/estructura"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 13px",
                    background: "#ECFDF5",
                    color: "#065F46",
                    border: "1px solid #A7F3D0",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12.5
                  }}
                >
                  <RotateCcw size={13} color="#059669" /> Cargar Proyección Oficial 2027
                </button>
              )}

              <button
                onClick={() => setView("mapeo")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  background: "#F8FAFC",
                  color: tokens.ink,
                  border: `1px solid ${tokens.rule}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <LinkIcon size={14} color={tokens.textMuted} /> Mapear
              </button>

              <button 
                onClick={() => setEditMode(true)} 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  background: tokens.ink,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <Pencil size={14} /> Editar
              </button>
            </>
          )}

          {editMode && (
            <>
              <button 
                onClick={() => setPlanDraft(selectedYear === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026)} 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: tokens.negativeSoft,
                  color: tokens.negative,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                Restaurar Base
              </button>
              <button 
                onClick={guardarTodo} 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: tokens.positive,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13
                }}
              >
                <Save size={15} /> Guardar Cambios
              </button>
            </>
          )}

          {view === "mapeo" && (
            <button 
              onClick={guardarTodo} 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: tokens.positive,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13
              }}
            >
              <Save size={15} /> Guardar Mapeo
            </button>
          )}
        </div>
      </div>

      {view === "presupuesto" && (
        <>
          {/* ── TARJETAS KPIS EJECUTIVAS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            
            {/* KPI 1: INGRESOS */}
            <div style={{
              background: tokens.surface,
              borderRadius: 10,
              border: `1px solid ${tokens.rule}`,
              padding: "16px 18px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: tokens.textMuted, letterSpacing: "0.5px" }}>
                  Ingresos Proyectados
                </span>
                <span style={{ background: tokens.positiveSoft, color: tokens.positive, fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                  100% Cobranzas
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: tokens.positive, fontFamily: tokens.fontMono }}>
                {formatMoney(totalIngSim)}
              </div>
              <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Promedio: {formatMoney(totalIngSim / 12)} / mes</span>
                {simulacionActiva && <DeltaBadge base={totalIngBase} sim={totalIngSim} positiveIsGood={true} />}
              </div>
            </div>

            {/* KPI 2: EGRESOS TOTALES */}
            <div style={{
              background: tokens.surface,
              borderRadius: 10,
              border: `1px solid ${tokens.rule}`,
              padding: "16px 18px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: tokens.textMuted, letterSpacing: "0.5px" }}>
                  Egresos Totales
                </span>
                <span style={{ background: tokens.negativeSoft, color: tokens.negative, fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                  Obras 69,9%
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: tokens.negative, fontFamily: tokens.fontMono }}>
                {formatMoney(totalEgSim)}
              </div>
              <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Promedio: {formatMoney(totalEgSim / 12)} / mes</span>
                {simulacionActiva && <DeltaBadge base={totalEgBase} sim={totalEgSim} positiveIsGood={false} />}
              </div>
            </div>

            {/* KPI 3: RESULTADO NETO (DÉFICIT / SUPERÁVIT) */}
            <div style={{
              background: totalNetoSim >= 0 ? tokens.positiveSoft : "#FFF5F5",
              borderRadius: 10,
              border: `1.5px solid ${totalNetoSim >= 0 ? tokens.positive : "#FEB2B2"}`,
              padding: "16px 18px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: totalNetoSim >= 0 ? tokens.positive : tokens.negative, letterSpacing: "0.5px" }}>
                  Déficit Operativo Anual
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted }}>
                  {moneda === "USD" ? `$ ${(Math.abs(totalNetoSim) / 1_000_000).toFixed(1)} M ARS` : formatUSD(totalNetoSim)}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: totalNetoSim >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono }}>
                {formatMoney(totalNetoSim)}
              </div>
              <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4 }}>
                {simulacionActiva && Math.abs(alivioARS) > 1000 ? (
                  <span style={{ color: alivioARS > 0 ? tokens.positive : tokens.negative, fontWeight: 700 }}>
                    {alivioARS > 0 ? "✨ Alivio: +" : "Mayor quema: "}{formatMoney(alivioARS)} {moneda === "USD" ? `($ ${(alivioARS / 1_000_000).toFixed(1)}M)` : `(${formatUSD(alivioARS)})`}
                  </span>
                ) : (
                  <span>Brecha a financiar en el ejercicio {moneda === "USD" ? `(TC $${fmt(tcReferencia)})` : `(${formatUSD(totalNetoSim)})`}</span>
                )}
              </div>
            </div>

            {/* KPI 4: MES MÁS CRÍTICO */}
            <div style={{
              background: tokens.surface,
              borderRadius: 10,
              border: `1px solid ${tokens.rule}`,
              padding: "16px 18px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: tokens.textMuted, letterSpacing: "0.5px" }}>
                  Pico de Requerimiento
                </span>
                <span style={{ background: "#FEF3C7", color: "#B45309", fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                  Alerta Liquidez
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, fontFamily: tokens.fontMono }}>
                {mesCritico.mes} ({formatMoney(mesCritico.neto)})
              </div>
              <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4 }}>
                Torre Green + +DUO + Auria + SAC
              </div>
            </div>

          </div>

          {/* ── SIMULADOR DINÁMICO EJECUTIVO (ESTUDIO DE ESCENARIOS) ── */}
          {simulacionActiva && !editMode && (
            <div style={{
              background: "#0F172A",
              borderRadius: 12,
              border: `2px solid ${tokens.gold}`,
              padding: "20px 24px",
              color: "#FFFFFF",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
            }}>
              {/* CABECERA DEL SIMULADOR */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={18} color={tokens.gold} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                      Estudio de Simulación Dinámica en Tiempo Real
                    </h3>
                    <span style={{ background: "rgba(212, 175, 55, 0.2)", color: tokens.gold, border: `1px solid ${tokens.gold}`, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                      Escenario: {scenarioName}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#94A3B8" }}>
                    Simula escenarios estratégicos con 1 clic o calibra proyectos individuales. Tus datos reales de presupuesto <strong>no se modifican</strong>.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => aplicarPreset("base")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#E2E8F0",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <RotateCcw size={13} /> Resetear Escenario
                  </button>
                </div>
              </div>

              {/* PRESETS ESTRATÉGICOS CON 1 CLIC (¡DINAMISMO TOTAL!) */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  ⚡ Escenarios Estratégicos Preconfigurados (Aplica con 1 Clic):
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => aplicarPreset("base")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "base" ? `1.5px solid ${tokens.gold}` : "1px solid #334155",
                      background: scenarioName === "base" ? "rgba(212, 175, 55, 0.25)" : "#1E293B",
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🔄 Base Oficial 2027
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("optimista_ventas")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "optimista_ventas" ? `1.5px solid #10B981` : "1px solid #334155",
                      background: scenarioName === "optimista_ventas" ? "rgba(16, 185, 129, 0.25)" : "#1E293B",
                      color: "#10B981",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🚀 +20% Ventas CDO (+ $936M)
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("postergar_auria")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "postergar_auria" ? `1.5px solid #38BDF8` : "1px solid #334155",
                      background: scenarioName === "postergar_auria" ? "rgba(56, 189, 248, 0.25)" : "#1E293B",
                      color: "#38BDF8",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    ⏸️ Postergar Inicio Auria (-$ 763M Obra)
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("moderar_obras")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "moderar_obras" ? `1.5px solid #F59E0B` : "1px solid #334155",
                      background: scenarioName === "moderar_obras" ? "rgba(245, 158, 11, 0.25)" : "#1E293B",
                      color: "#F59E0B",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    ⚡ Desacelerar Obras -15%
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("eficiencia_estructura")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "eficiencia_estructura" ? `1.5px solid #A855F7` : "1px solid #334155",
                      background: scenarioName === "eficiencia_estructura" ? "rgba(168, 85, 247, 0.25)" : "#1E293B",
                      color: "#A855F7",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    ✂️ Austeridad Estructura -10% (-$ 285M)
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("cauteloso_ventas")}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: scenarioName === "cauteloso_ventas" ? `1.5px solid #EF4444` : "1px solid #334155",
                      background: scenarioName === "cauteloso_ventas" ? "rgba(239, 68, 68, 0.25)" : "#1E293B",
                      color: "#EF4444",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🛡️ Escenario Cauteloso (-15% Ventas)
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPreset("mitigacion_integral")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: scenarioName === "mitigacion_integral" ? `2px solid ${tokens.gold}` : `1px solid ${tokens.gold}`,
                      background: scenarioName === "mitigacion_integral" ? "linear-gradient(135deg, rgba(212, 175, 55, 0.35) 0%, rgba(16, 185, 129, 0.35) 100%)" : "rgba(212, 175, 55, 0.15)",
                      color: "#FDE047",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    🎯 Plan Mitigación Integral (+15% Ventas + Auria diferida + -5% Estructura)
                  </button>
                </div>
              </div>

              {/* IMPACTO DIRECTO EN LA CAJA (DELTA SCORECARD) */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                gap: 14,
                padding: 16,
                background: "#1E293B",
                borderRadius: 10,
                border: "1px solid #334155",
                marginBottom: 18
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Déficit Base vs Simulado</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 15, color: "#94A3B8", textDecoration: "line-through", fontFamily: tokens.fontMono }}>
                      {formatMoney(totalNetoBase)}
                    </span>
                    <ArrowRight size={14} color={tokens.gold} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: totalNetoSim >= 0 ? "#10B981" : "#F87171", fontFamily: tokens.fontMono }}>
                      {formatMoney(totalNetoSim)}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Alivio Financiero Obtenido</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: alivioARS >= 0 ? "#10B981" : "#EF4444", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {alivioARS >= 0 ? "+" : ""}{formatMoney(alivioARS)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    {alivioARS >= 0 ? "Menor necesidad de aportes" : "Mayor brecha de fondos"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Alivio en Dólares (USD)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: alivioUSD >= 0 ? "#10B981" : "#EF4444", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {alivioUSD >= 0 ? "+" : ""}{formatUSD(alivioARS)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    TC: ${fmt(ultimoDolar)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Mes de Máximo Estrés</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {mesCritico.mes}: {formatMoney(mesCritico.neto)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    Requerimiento simulado
                  </div>
                </div>
              </div>

              {/* SLIDERS Y AJUSTADORES RÁPIDOS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                
                {/* CALIBRACIÓN INGRESOS */}
                <div style={{ background: "#1E293B", padding: 14, borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>
                      Ajuste Global Ingresos
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: tokens.fontMono, color: simData.globalIng !== 0 ? "#10B981" : "#94A3B8" }}>
                      {simData.globalIng > 0 ? "+" : ""}{simData.globalIng}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    min="-50"
                    max="50"
                    step="5"
                    value={simData.globalIng}
                    onChange={(e) => setSimData({ ...simData, globalIng: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#10B981" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {[-20, -10, 0, 10, 20, 30].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSimData({ ...simData, globalIng: pct })}
                        style={{
                          flex: 1,
                          padding: "3px 0",
                          fontSize: 10.5,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: "1px solid #334155",
                          background: simData.globalIng === pct ? "#10B981" : "#0F172A",
                          color: simData.globalIng === pct ? "#FFFFFF" : "#94A3B8",
                          cursor: "pointer"
                        }}
                      >
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CALIBRACIÓN EGRESOS */}
                <div style={{ background: "#1E293B", padding: 14, borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171", textTransform: "uppercase" }}>
                      Ajuste Global Egresos
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: tokens.fontMono, color: simData.globalEg !== 0 ? "#F87171" : "#94A3B8" }}>
                      {simData.globalEg > 0 ? "+" : ""}{simData.globalEg}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    min="-50"
                    max="50"
                    step="5"
                    value={simData.globalEg}
                    onChange={(e) => setSimData({ ...simData, globalEg: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#EF4444" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {[-30, -20, -10, 0, 10, 20].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSimData({ ...simData, globalEg: pct })}
                        style={{
                          flex: 1,
                          padding: "3px 0",
                          fontSize: 10.5,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: "1px solid #334155",
                          background: simData.globalEg === pct ? "#EF4444" : "#0F172A",
                          color: simData.globalEg === pct ? "#FFFFFF" : "#94A3B8",
                          cursor: "pointer"
                        }}
                      >
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── EVOLUCIÓN MENSUAL GRÁFICA (BASE vs SIMULADO) - FONDO CLARO ── */}
          {!editMode && (
            <div style={{
              background: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: "#0F172A", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Activity size={16} color={tokens.gold} />
                    Curva de Evolución Financiera Mensual {selectedYear} ({moneda === "USD" ? (enMillones ? "en Miles de USD / kUSD" : "en USD") : (enMillones ? "en Millones de $" : "en $")})
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748B" }}>
                    Comportamiento mes a mes de Ingresos, Egresos y la Brecha Neta resultante ({moneda === "USD" ? `expresado en Dólares al TC $${fmt(tcReferencia)}` : "expresado en Pesos Argentinos"}).
                  </p>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 4, background: "#10B981", borderRadius: 2 }} /> Ingresos</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 4, background: "#EF4444", borderRadius: 2 }} /> Egresos</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 4, background: tokens.gold, borderRadius: 2 }} /> Flujo Neto</span>
                  {simulacionActiva && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 0, borderTop: "2px dashed #94A3B8" }} /> Base original</span>
                  )}
                </div>
              </div>

              <div style={{ height: 260, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucionMensual} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: "#475569", fontSize: 11.5, fontWeight: 500 }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => {
                        if (moneda === "USD") {
                          return enMillones ? `${v.toFixed(0)}k` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v;
                        }
                        return enMillones ? `${v.toFixed(0)}M` : v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v;
                      }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      labelStyle={{ color: "#0F172A", fontWeight: 700, marginBottom: 4 }}
                      formatter={(val, name) => {
                        const labels = {
                          ingresoSim: "Ingresos",
                          egresoSim: "Egresos",
                          netoSim: "Resultado Neto",
                          ingresoBase: "Ingresos Base",
                          egresoBase: "Egresos Base"
                        };
                        let realValARS;
                        if (moneda === "USD") {
                          realValARS = enMillones ? val * 1000 * (tcReferencia || 1540) : val * (tcReferencia || 1540);
                        } else {
                          realValARS = enMillones ? val * 1_000_000 : val;
                        }
                        return [formatMoney(realValARS), labels[name] || name];
                      }}
                    />
                    {simulacionActiva && (
                      <>
                        <Line type="monotone" dataKey="ingresoBase" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                        <Line type="monotone" dataKey="egresoBase" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </>
                    )}
                    <Bar dataKey="ingresoSim" fill="#10B981" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="egresoSim" fill="#EF4444" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Line type="monotone" dataKey="netoSim" stroke={tokens.gold} strokeWidth={2.5} dot={{ r: 4, fill: tokens.gold }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── LA PLANILLA FINANCIERA (TABLA EJECUTIVA CLARA Y ORDENADA) ── */}
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            border: `1.5px solid ${simulacionActiva ? tokens.gold : tokens.rule}`,
            overflow: "hidden",
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)"
          }}>
            {/* ENCABEZADO DE LA TABLA */}
            <div style={{
              padding: "14px 20px",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 8 }}>
                  <Scale size={16} color={tokens.gold} />
                  Matriz Presupuestaria de Flujo de Fondos {selectedYear}
                </h4>
                <span style={{ fontSize: 12, color: tokens.textMuted }}>
                  Valores expresados en <strong>{moneda === "USD" ? "Dólares (USD)" : "Pesos ($ ARS)"}</strong> {enMillones ? (moneda === "USD" ? "en Miles (kUSD)" : "en Millones ($ M)") : "completos"}. Pasa el cursor sobre cualquier celda para ver el importe en ambas monedas.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 11.5,
                  color: moneda === "USD" ? "#0F172A" : tokens.textMuted,
                  background: moneda === "USD" ? "#FEF3C7" : "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${moneda === "USD" ? "#FDE68A" : "#CBD5E1"}`,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5
                }}>
                  <DollarSign size={13} color={tokens.gold} />
                  Dólar ref: ${fmt(tcReferencia)}
                </span>
              </div>
            </div>

            <div className="table-container" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "75vh", maxWidth: "100%", border: "1px solid #CBD5E1", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 20 }}>
                  <tr style={{ background: "#F1F5F9", color: tokens.ink, borderBottom: "2px solid #CBD5E1" }}>
                    {/* COLUMNA FIJA (STICKY FREEZE COLUMN) */}
                    <th style={{
                      position: "sticky",
                      left: 0,
                      top: 0,
                      zIndex: 30,
                      background: "#F1F5F9",
                      padding: "12px 16px",
                      textAlign: "left",
                      minWidth: 260,
                      fontWeight: 700,
                      borderRight: "2px solid #CBD5E1",
                      borderBottom: "2px solid #CBD5E1",
                      boxShadow: "2px 2px 5px rgba(0,0,0,0.06)"
                    }}>
                      Concepto / Rubro Presupuestario
                    </th>
                    {meses.map(m => (
                      <th key={m.k} style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        background: "#F1F5F9",
                        borderBottom: "2px solid #CBD5E1",
                        padding: "12px 10px",
                        textAlign: "right",
                        minWidth: enMillones ? 92 : 110,
                        fontFamily: tokens.fontMono,
                        fontWeight: 700,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
                      }}>
                        <div>{m.n}</div>
                        {simulacionActiva && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: 4 }}>
                            <input
                              type="range"
                              min="-50"
                              max="50"
                              step="5"
                              value={simData.meses[m.k] || 0}
                              onChange={(e) => setSimData(prev => ({ ...prev, meses: { ...prev.meses, [m.k]: Number(e.target.value) } }))}
                              style={{ width: 55, accentColor: tokens.gold }}
                            />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: simData.meses[m.k] !== 0 ? tokens.gold : tokens.textMuted }}>
                              {simData.meses[m.k] > 0 ? '+' : ''}{simData.meses[m.k] || 0}%
                            </span>
                          </div>
                        )}
                      </th>
                    ))}
                    <th style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 20,
                      padding: "12px 16px",
                      textAlign: "right",
                      minWidth: enMillones ? 110 : 130,
                      fontFamily: tokens.fontMono,
                      fontWeight: 800,
                      background: "#E2E8F0",
                      borderBottom: "2px solid #CBD5E1",
                      color: tokens.ink,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
                    }}>
                      Total {selectedYear}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* ══════════════════════════════════════════════════════ */}
                  {/* 1. SECCIÓN INGRESOS OPERATIVOS                        */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#ECFDF5", borderTop: "2px solid #10B981" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "10px 16px",
                        fontWeight: 800,
                        color: "#065F46",
                        fontSize: 11.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}
                    >
                      🟢 1. INGRESOS OPERATIVOS Y COBRANZAS
                    </td>
                  </tr>

                  {activeIncomeCats.map(c => {
                    const rowTotal = calcularTotalFila("ingreso", c.key);
                    const pctTotal = totalIngSim > 0 ? (rowTotal / totalIngSim) * 100 : 0;
                    return (
                      <tr key={c.key} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#FFFFFF",
                          padding: "10px 16px",
                          borderRight: "2px solid #CBD5E1",
                          boxShadow: "2px 0 5px rgba(0,0,0,0.02)"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: tokens.ink, fontSize: 13 }}>{c.label}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                                {pctTotal.toFixed(1)}% total
                              </span>
                            </div>
                            <span style={{ fontSize: 10.5, color: tokens.textMuted }}>{c.sublabel || "Ingreso"}</span>
                            {simulacionActiva && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="5"
                                  value={simData.cats[c.key] || 0}
                                  onChange={(e) => setSimData(prev => ({ ...prev, cats: { ...prev.cats, [c.key]: Number(e.target.value) } }))}
                                  style={{ width: 75, accentColor: "#10B981" }}
                                />
                                <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted }}>
                                  {simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {meses.map(m => {
                          const val = getSimVal("ingreso", c.key, m.k);
                          const valExact = Math.round(val);
                          return (
                            <td key={m.k} title={`${c.label} (${m.n}): $ ${valExact.toLocaleString("es-AR")}`} style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  className="plan-input"
                                  value={planDraft?.ingreso?.[c.key]?.[m.k] || ""}
                                  onChange={(e) => handleInputChange("ingreso", c.key, m.k, e.target.value)}
                                  placeholder="0"
                                />
                              ) : (
                                <span style={{ color: val > 0 ? tokens.ink : "#94A3B8", fontWeight: val > 0 ? 500 : 400 }}>
                                  {formatMoney(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td title={`Total Anual ${c.label}: $ ${Math.round(rowTotal).toLocaleString("es-AR")}`} style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.positive, background: "#F0FDF4" }}>
                          {formatMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUBTOTAL TOTAL INGRESOS */}
                  <tr style={{ background: "#DCFCE7", borderTop: "2px solid #86EFAC", borderBottom: "2px solid #10B981" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#DCFCE7",
                      padding: "12px 16px",
                      fontWeight: 800,
                      color: "#14532D",
                      borderRight: "2px solid #86EFAC"
                    }}>
                      TOTAL INGRESOS
                    </td>
                    {meses.map(m => {
                      const colTot = calcularTotalColumna("ingreso", m.k);
                      return (
                        <td key={m.k} title={`Total Ingresos ${m.n}: $ ${Math.round(colTot).toLocaleString("es-AR")}`} style={{ padding: "12px 10px", textAlign: "right", fontWeight: 800, color: "#14532D", fontFamily: tokens.fontMono }}>
                          {formatMoney(colTot)}
                        </td>
                      );
                    })}
                    <td title={`Total Ingresos Anuales: $ ${Math.round(totalIngSim).toLocaleString("es-AR")}`} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#14532D", fontFamily: tokens.fontMono, background: "#BBF7D0", fontSize: 13 }}>
                      {formatMoney(totalIngSim)}
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* 2. SECCIÓN PROYECTOS Y OBRAS                           */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#EFF6FF", borderTop: "2px solid #3B82F6" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "10px 16px",
                        fontWeight: 800,
                        color: "#1E40AF",
                        fontSize: 11.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}
                    >
                      🏗️ 2. PROYECTOS LINK & OBRAS EN CONSTRUCCIÓN (69,9% DEL EGRESO)
                    </td>
                  </tr>

                  {/* A. CUPOS SOCIETARIOS FIJOS */}
                  <tr style={{ background: "#F8FAFC" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "6px 16px 6px 24px",
                        fontWeight: 700,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase"
                      }}
                    >
                      A. Cupos Societarios Fijos Comprometidos
                    </td>
                  </tr>

                  {cuposCats.map(c => {
                    const rowTotal = calcularTotalFila("egreso", c.key);
                    const activo = isProyectoActivo(c.key);
                    const pctEgreso = totalEgSim > 0 ? (rowTotal / totalEgSim) * 100 : 0;
                    const pctProy = totalObrasSim > 0 ? (rowTotal / totalObrasSim) * 100 : 0;
                    return (
                      <tr key={c.key} style={{ borderBottom: "1px solid #E2E8F0", opacity: !activo ? 0.45 : 1 }}>
                        <td style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#FFFFFF",
                          padding: "9px 16px 9px 24px",
                          borderRight: "2px solid #CBD5E1"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {simulacionActiva && (
                                <ToggleSwitch on={activo} onChange={(v) => setProyectosActivos(prev => ({ ...prev, [c.key]: v }))} />
                              )}
                              <span style={{ fontWeight: 600, color: tokens.ink }}>{c.label}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 5px", borderRadius: 4 }}>
                                {c.tag}
                              </span>
                              {rowTotal > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", padding: "1px 5px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                                  {pctEgreso.toFixed(1)}% egreso · {pctProy.toFixed(1)}% obras
                                </span>
                              )}
                              {!activo && <span style={{ fontSize: 9.5, color: tokens.negative, fontWeight: 800 }}>APAGADO</span>}
                            </div>
                            <span style={{ fontSize: 10.5, color: tokens.textMuted }}>{c.sublabel}</span>
                          </div>
                        </td>

                        {meses.map(m => {
                          const val = getSimVal("egreso", c.key, m.k);
                          return (
                            <td key={m.k} title={`${c.label} (${m.n}): $ ${Math.round(val).toLocaleString("es-AR")}`} style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  className="plan-input"
                                  value={planDraft?.egreso?.[c.key]?.[m.k] || ""}
                                  onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)}
                                  placeholder="0"
                                />
                              ) : (
                                <span style={{ color: val > 0 ? tokens.ink : "#94A3B8" }}>
                                  {formatMoney(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td title={`Total Anual ${c.label}: $ ${Math.round(rowTotal).toLocaleString("es-AR")}`} style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.ink, background: "#F1F5F9" }}>
                          {formatMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* B. CURVAS S DE OBRAS EN EJECUCIÓN */}
                  <tr style={{ background: "#F8FAFC" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "8px 16px 6px 24px",
                        fontWeight: 700,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase"
                      }}
                    >
                      B. Curvas S de Inversión en Obras Activas
                    </td>
                  </tr>

                  {obrasCats.filter(c => calcularTotalFila("egreso", c.key) > 0 || (simulacionActiva && !isProyectoActivo(c.key))).map(c => {
                    const rowTotal = calcularTotalFila("egreso", c.key);
                    const activo = isProyectoActivo(c.key);
                    const pctEgreso = totalEgSim > 0 ? (rowTotal / totalEgSim) * 100 : 0;
                    const pctProy = totalObrasSim > 0 ? (rowTotal / totalObrasSim) * 100 : 0;
                    return (
                      <tr key={c.key} style={{ borderBottom: "1px solid #E2E8F0", opacity: !activo ? 0.45 : 1 }}>
                        <td style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#FFFFFF",
                          padding: "9px 16px 9px 24px",
                          borderRight: "2px solid #CBD5E1"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {simulacionActiva && (
                                <ToggleSwitch on={activo} onChange={(v) => setProyectosActivos(prev => ({ ...prev, [c.key]: v }))} />
                              )}
                              <span style={{ fontWeight: 600, color: tokens.ink }}>{c.label}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FEF3C7", color: "#B45309", padding: "1px 5px", borderRadius: 4 }}>
                                {c.tag}
                              </span>
                              {rowTotal > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", padding: "1px 5px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                                  {pctEgreso.toFixed(1)}% egreso · {pctProy.toFixed(1)}% obras
                                </span>
                              )}
                              {!activo && <span style={{ fontSize: 9.5, color: tokens.negative, fontWeight: 800 }}>DIFERIDO</span>}
                            </div>
                            <span style={{ fontSize: 10.5, color: tokens.textMuted }}>{c.sublabel}</span>
                            {simulacionActiva && activo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="5"
                                  value={simData.cats[c.key] || 0}
                                  onChange={(e) => setSimData(prev => ({ ...prev, cats: { ...prev.cats, [c.key]: Number(e.target.value) } }))}
                                  style={{ width: 75, accentColor: tokens.gold }}
                                />
                                <span style={{ fontSize: 10, fontWeight: 700, color: simData.cats[c.key] !== 0 ? tokens.gold : tokens.textMuted }}>
                                  {simData.cats[c.key] > 0 ? '+' : ''}{simData.cats[c.key] || 0}%
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {meses.map(m => {
                          const val = getSimVal("egreso", c.key, m.k);
                          return (
                            <td key={m.k} title={`${c.label} (${m.n}): $ ${Math.round(val).toLocaleString("es-AR")}`} style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  className="plan-input"
                                  value={planDraft?.egreso?.[c.key]?.[m.k] || ""}
                                  onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)}
                                  placeholder="0"
                                />
                              ) : (
                                <span style={{ color: val > 0 ? tokens.ink : "#94A3B8" }}>
                                  {formatMoney(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td title={`Total Anual ${c.label}: $ ${Math.round(rowTotal).toLocaleString("es-AR")}`} style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.ink, background: "#F1F5F9" }}>
                          {formatMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUBTOTAL PROYECTOS Y OBRAS */}
                  <tr style={{ background: "#DBEAFE", borderTop: "2px solid #93C5FD", borderBottom: "1px solid #60A5FA" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#DBEAFE",
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: "#1E3A8A",
                      borderRight: "2px solid #93C5FD"
                    }}>
                      Subtotal Proyectos & Obras ({totalEgSim > 0 ? ((totalObrasSim / totalEgSim) * 100).toFixed(1) : 0}% del Egreso)
                    </td>
                    {meses.map(m => {
                      const tot = PLAN_PROJECT_CATS_2027.reduce((acc, c) => acc + getSimVal("egreso", c.key, m.k), 0);
                      return (
                        <td key={m.k} title={`Subtotal Obras (${m.n}): $ ${Math.round(tot).toLocaleString("es-AR")}`} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#1E3A8A", fontFamily: tokens.fontMono }}>
                          {formatMoney(tot)}
                        </td>
                      );
                    })}
                    <td title={`Total Anual Obras: $ ${Math.round(totalObrasSim).toLocaleString("es-AR")}`} style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: "#1E3A8A", fontFamily: tokens.fontMono, background: "#BFDBFE" }}>
                      {formatMoney(totalObrasSim)}
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* 3. SECCIÓN ESTRUCTURA OPERATIVA Y RRHH                 */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#F3E8FF", borderTop: "2px solid #A855F7" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "10px 16px",
                        fontWeight: 800,
                        color: "#6B21A8",
                        fontSize: 11.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}
                    >
                      🏢 3. ESTRUCTURA OPERATIVA, RRHH & ADMINISTRACIÓN ({totalEgSim > 0 ? ((totalEstructuraSim / totalEgSim) * 100).toFixed(1) : 0}% DEL EGRESO)
                    </td>
                  </tr>

                  {estructuraCats.map(c => {
                    const rowTotal = calcularTotalFila("egreso", c.key);
                    const pctEgreso = totalEgSim > 0 ? (rowTotal / totalEgSim) * 100 : 0;
                    const pctEst = totalEstructuraSim > 0 ? (rowTotal / totalEstructuraSim) * 100 : 0;
                    return (
                      <tr key={c.key} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#FFFFFF",
                          padding: "9px 16px",
                          borderRight: "2px solid #CBD5E1"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: tokens.ink }}>{c.label}</span>
                              {rowTotal > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "#F3E8FF", color: "#6B21A8", border: "1px solid #E9D5FF", padding: "1px 5px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                                  {pctEgreso.toFixed(1)}% egreso · {pctEst.toFixed(1)}% estructura
                                </span>
                              )}
                              {c.key === "custom_rrhh" && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FAF5FF", color: "#7E22CE", padding: "1px 5px", borderRadius: 4 }}>
                                  SAC en Jun/Dic
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 10.5, color: tokens.textMuted }}>{c.sublabel}</span>
                          </div>
                        </td>

                        {meses.map(m => {
                          const val = getSimVal("egreso", c.key, m.k);
                          return (
                            <td key={m.k} title={`${c.label} (${m.n}): $ ${Math.round(val).toLocaleString("es-AR")}`} style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  className="plan-input"
                                  value={planDraft?.egreso?.[c.key]?.[m.k] || ""}
                                  onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)}
                                  placeholder="0"
                                />
                              ) : (
                                <span style={{ color: val > 0 ? tokens.ink : "#94A3B8" }}>
                                  {formatMoney(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td title={`Total Anual ${c.label}: $ ${Math.round(rowTotal).toLocaleString("es-AR")}`} style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.ink, background: "#F1F5F9" }}>
                          {formatMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUBTOTAL ESTRUCTURA OPERATIVA */}
                  <tr style={{ background: "#F3E8FF", borderTop: "2px solid #D8B4FE", borderBottom: "1px solid #C084FC" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#F3E8FF",
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: "#6B21A8",
                      borderRight: "2px solid #D8B4FE"
                    }}>
                      Subtotal Estructura Operativa & RRHH ({totalEgSim > 0 ? ((totalEstructuraSim / totalEgSim) * 100).toFixed(1) : 0}% del Egreso)
                    </td>
                    {meses.map(m => {
                      const tot = estructuraCats.reduce((acc, c) => acc + getSimVal("egreso", c.key, m.k), 0);
                      return (
                        <td key={m.k} title={`Subtotal Estructura (${m.n}): $ ${Math.round(tot).toLocaleString("es-AR")}`} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#6B21A8", fontFamily: tokens.fontMono }}>
                          {formatMoney(tot)}
                        </td>
                      );
                    })}
                    <td title={`Total Anual Estructura: $ ${Math.round(totalEstructuraSim).toLocaleString("es-AR")}`} style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: "#6B21A8", fontFamily: tokens.fontMono, background: "#E9D5FF" }}>
                      {formatMoney(totalEstructuraSim)}
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* 4. SECCIÓN INVERSIONES Y PASIVOS                       */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#F1F5F9", borderTop: "2px solid #64748B" }}>
                    <td
                      colSpan={14}
                      style={{
                        position: "sticky",
                        left: 0,
                        padding: "8px 16px",
                        fontWeight: 800,
                        color: "#334155",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}
                    >
                      💼 4. INVERSIONES Y PASIVOS FINANCIEROS ({totalEgSim > 0 ? ((totalFinancieroSim / totalEgSim) * 100).toFixed(1) : 0}% DEL EGRESO)
                    </td>
                  </tr>

                  {financieroCats.map(c => {
                    const rowTotal = calcularTotalFila("egreso", c.key);
                    const pctEgreso = totalEgSim > 0 ? (rowTotal / totalEgSim) * 100 : 0;
                    return (
                      <tr key={c.key} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#FFFFFF",
                          padding: "8px 16px",
                          borderRight: "2px solid #CBD5E1"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: tokens.ink }}>{c.label}</span>
                              {rowTotal > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", padding: "1px 5px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                                  {pctEgreso.toFixed(1)}% egreso
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 10.5, color: tokens.textMuted }}>{c.sublabel}</span>
                          </div>
                        </td>

                        {meses.map(m => {
                          const val = getSimVal("egreso", c.key, m.k);
                          return (
                            <td key={m.k} title={`${c.label} (${m.n}): $ ${Math.round(val).toLocaleString("es-AR")}`} style={{ padding: "8px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  className="plan-input"
                                  value={planDraft?.egreso?.[c.key]?.[m.k] || ""}
                                  onChange={(e) => handleInputChange("egreso", c.key, m.k, e.target.value)}
                                  placeholder="0"
                                />
                              ) : (
                                <span style={{ color: val > 0 ? tokens.ink : "#94A3B8" }}>
                                  {formatMoney(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td title={`Total Anual ${c.label}: $ ${Math.round(rowTotal).toLocaleString("es-AR")}`} style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: tokens.ink, background: "#F1F5F9" }}>
                          {formatMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUBTOTAL INVERSIONES Y PASIVOS */}
                  <tr style={{ background: "#F1F5F9", borderTop: "2px solid #CBD5E1", borderBottom: "1px solid #94A3B8" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#F1F5F9",
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: "#334155",
                      borderRight: "2px solid #CBD5E1"
                    }}>
                      Subtotal Inversiones & Pasivos ({totalEgSim > 0 ? ((totalFinancieroSim / totalEgSim) * 100).toFixed(1) : 0}% del Egreso)
                    </td>
                    {meses.map(m => {
                      const tot = financieroCats.reduce((acc, c) => acc + getSimVal("egreso", c.key, m.k), 0);
                      return (
                        <td key={m.k} title={`Subtotal Financiero (${m.n}): $ ${Math.round(tot).toLocaleString("es-AR")}`} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#334155", fontFamily: tokens.fontMono }}>
                          {formatMoney(tot)}
                        </td>
                      );
                    })}
                    <td title={`Total Anual Financiero: $ ${Math.round(totalFinancieroSim).toLocaleString("es-AR")}`} style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: "#334155", fontFamily: tokens.fontMono, background: "#E2E8F0" }}>
                      {formatMoney(totalFinancieroSim)}
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* TOTAL EGRESOS DEL EJERCICIO                            */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#FEE2E2", borderTop: "2px solid #EF4444", borderBottom: "2px solid #DC2626" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#FEE2E2",
                      padding: "12px 16px",
                      fontWeight: 800,
                      color: "#991B1B",
                      borderRight: "2px solid #FCA5A5"
                    }}>
                      TOTAL EGRESOS
                    </td>
                    {meses.map(m => {
                      const colTot = calcularTotalColumna("egreso", m.k);
                      return (
                        <td key={m.k} title={`Total Egresos ${m.n}: $ ${Math.round(colTot).toLocaleString("es-AR")}`} style={{ padding: "12px 10px", textAlign: "right", fontWeight: 800, color: "#991B1B", fontFamily: tokens.fontMono }}>
                          {formatMoney(colTot)}
                        </td>
                      );
                    })}
                    <td title={`Total Egresos Anuales: $ ${Math.round(totalEgSim).toLocaleString("es-AR")}`} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#991B1B", fontFamily: tokens.fontMono, background: "#FECACA", fontSize: 13 }}>
                      {formatMoney(totalEgSim)}
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* 5. POSICIÓN NETA MENSUAL (SUPERÁVIT / DÉFICIT)         */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <tr style={{ background: "#0F172A", borderTop: "2px solid #000", borderBottom: "1px solid #1E293B" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#0F172A",
                      padding: "13px 16px",
                      fontWeight: 800,
                      color: "#F8FAFC",
                      borderRight: "2px solid #334155"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Scale size={14} color={tokens.gold} />
                        <span>Flujo Neto Mensual ({moneda === "USD" ? "USD" : "ARS"})</span>
                      </div>
                    </td>
                    {meses.map(m => {
                      const ing = calcularTotalColumna("ingreso", m.k);
                      const eg = calcularTotalColumna("egreso", m.k);
                      const neto = ing - eg;
                      const isGood = neto >= 0;
                      return (
                        <td
                          key={m.k}
                          title={`Flujo Neto ${m.n}: ${formatMoney(neto, true)} • Equivalente: ${moneda === "USD" ? `$ ${Math.round(neto).toLocaleString("es-AR")} ARS` : formatUSD(neto)}`}
                          style={{
                            padding: "13px 10px",
                            textAlign: "right",
                            fontWeight: 800,
                            color: isGood ? "#4ADE80" : "#F87171",
                            fontFamily: tokens.fontMono
                          }}
                        >
                          {formatMoney(neto)}
                        </td>
                      );
                    })}
                    <td
                      title={`Flujo Neto Anual: ${formatMoney(totalNetoSim, true)} • Equivalente: ${moneda === "USD" ? `$ ${Math.round(totalNetoSim).toLocaleString("es-AR")} ARS` : formatUSD(totalNetoSim)}`}
                      style={{
                        padding: "13px 16px",
                        textAlign: "right",
                        fontWeight: 900,
                        color: totalNetoSim >= 0 ? "#4ADE80" : "#F87171",
                        fontFamily: tokens.fontMono,
                        background: "#1E293B",
                        fontSize: 13
                      }}
                    >
                      {formatMoney(totalNetoSim)}
                    </td>
                  </tr>

                  {/* 6. POSICIÓN NETA EN LA OTRA MONEDA PARA VISIÓN COMPLEMENTARIA */}
                  <tr style={{ background: "#1E293B", borderBottom: "1px solid #334155" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#1E293B",
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: "#94A3B8",
                      borderRight: "2px solid #334155",
                      fontSize: 11.5
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {moneda === "USD" ? (
                          <>
                            <span style={{ color: tokens.gold, fontWeight: 800 }}>$</span>
                            <span>Flujo Neto en Pesos</span>
                            <span style={{ background: "rgba(201, 174, 107, 0.2)", color: tokens.gold, padding: "1px 5px", borderRadius: 3, fontSize: 9.5, fontWeight: 800 }}>$ M</span>
                          </>
                        ) : (
                          <>
                            <DollarSign size={13} color={tokens.gold} />
                            <span>Flujo Neto en Dólares</span>
                            <span style={{ background: "rgba(201, 174, 107, 0.2)", color: tokens.gold, padding: "1px 5px", borderRadius: 3, fontSize: 9.5, fontWeight: 800 }}>kUSD</span>
                          </>
                        )}
                      </div>
                    </td>
                    {meses.map(m => {
                      const neto = calcularTotalColumna("ingreso", m.k) - calcularTotalColumna("egreso", m.k);
                      const netoUSD = Math.round(neto / (tcReferencia || 1540));
                      const textMostrar = moneda === "USD"
                        ? `$ ${(neto / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
                        : formatUSD(neto);
                      return (
                        <td
                          key={m.k}
                          title={`Flujo Neto ${m.n}: ${textMostrar} (Exacto: ${netoUSD >= 0 ? '+' : ''}${netoUSD.toLocaleString("es-AR")} USD al TC $${fmt(tcReferencia)} | $ ${Math.round(neto).toLocaleString("es-AR")} ARS)`}
                          style={{
                            padding: "10px 10px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: neto >= 0 ? "#86EFAC" : "#FCA5A5",
                            fontFamily: tokens.fontMono,
                            fontSize: 11.5
                          }}
                        >
                          {textMostrar}
                        </td>
                      );
                    })}
                    <td
                      title={`Flujo Neto Anual: ${moneda === "USD" ? `$ ${(totalNetoSim / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M` : formatUSD(totalNetoSim)}`}
                      style={{
                        padding: "10px 16px",
                        textAlign: "right",
                        fontWeight: 800,
                        color: totalNetoSim >= 0 ? "#86EFAC" : "#FCA5A5",
                        fontFamily: tokens.fontMono,
                        background: "#0F172A",
                        fontSize: 12
                      }}
                    >
                      {moneda === "USD"
                        ? `$ ${(totalNetoSim / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
                        : formatUSD(totalNetoSim)}
                    </td>
                  </tr>

                  {/* 7. DÉFICIT ACUMULADO DEL AÑO */}
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #CBD5E1" }}>
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#F8FAFC",
                      padding: "10px 16px",
                      fontWeight: 700,
                      color: tokens.textMuted,
                      borderRight: "2px solid #CBD5E1",
                      fontSize: 11.5
                    }}>
                      <span>📉 Déficit Acumulado en el Año</span>
                    </td>
                    {meses.map(m => {
                      const acum = deficitAcumuladoMeses[m.k];
                      return (
                        <td key={m.k} title={`Déficit acumulado a fin de ${m.n}: $ ${Math.round(acum).toLocaleString("es-AR")}`} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: acum >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono, fontSize: 11 }}>
                          {formatMoney(acum)}
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: totalNetoSim >= 0 ? tokens.positive : tokens.negative, fontFamily: tokens.fontMono, background: "#E2E8F0" }}>
                      {formatMoney(totalNetoSim)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* ── DONAS Y ANÁLISIS DE PARTICIPACIÓN - FONDOS CLAROS ── */}
          {!editMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 1fr", gap: 16 }}>
              
              {/* DONA INGRESOS (FONDO CLARO) */}
              <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <h4 style={{ margin: "0 0 4px 0", color: "#0F172A", fontSize: 14.5, fontWeight: 700, textAlign: "center" }}>
                  Composición de Ingresos {selectedYear}
                </h4>
                <div style={{ fontSize: 11.5, color: "#64748B", textAlign: "center", marginBottom: 10 }}>
                  Participación porcentual de cada concepto sobre el Total de Ingresos
                </div>

                <div style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieIngresos}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        dataKey="value"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      >
                        {pieIngresos.map((entry, index) => (
                          <Cell key={index} fill={COLORS_ING[index % COLORS_ING.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        formatter={(val, name, item) => {
                          const p = item?.payload?.perc || 0;
                          return [`${formatMoney(val)} (${p.toFixed(1)}%)`, "Monto Anual"];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* LISTA DETALLADA CON PORCENTAJE AL LADO DE CADA CONCEPTO */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {pieIngresos.map((entry, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 10px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: COLORS_ING[index % COLORS_ING.length], flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontFamily: tokens.fontMono, color: "#64748B", fontSize: 11.5 }}>{formatMoney(entry.value)}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                          {entry.perc.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD CENTRAL: CONVERSIÓN USD Y RATIO DE COBERTURA (FONDO CLARO) */}
              <div style={{
                background: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                padding: "20px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}>
                <span style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                  Cobertura de Caja Anual
                </span>
                <div style={{ fontSize: 30, fontWeight: 800, color: tokens.gold, fontFamily: tokens.fontMono, margin: "6px 0 2px 0" }}>
                  {totalEgSim > 0 ? `${((totalIngSim / totalEgSim) * 100).toFixed(1)}%` : "-"}
                </div>
                <span style={{ fontSize: 11.5, color: "#64748B", marginBottom: 18 }}>
                  Los ingresos cubren el {totalEgSim > 0 ? ((totalIngSim / totalEgSim) * 100).toFixed(0) : 0}% de los egresos proyectados
                </span>

                <div style={{ width: "100%", borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
                    {totalNetoSim >= 0 
                      ? (moneda === "USD" ? "Superávit Anual en USD" : "Superávit Proyectado en USD") 
                      : (moneda === "USD" ? "Déficit Anual en USD" : "Déficit Anual Proyectado en USD")}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: totalNetoSim >= 0 ? "#166534" : "#DC2626", fontFamily: tokens.fontMono, marginTop: 4 }}>
                    {formatUSD(totalNetoSim)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                    {moneda === "USD" ? `Equivalente: $ ${(Math.abs(totalNetoSim) / 1_000_000).toFixed(1)} M ARS` : `TC ref aplicado: $${fmt(tcReferencia)}`}
                  </div>
                </div>

                <div style={{ width: "100%", borderTop: "1px solid #F1F5F9", marginTop: 16, paddingTop: 14, fontSize: 11, color: "#64748B" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Total Ingresos:</span>
                    <strong style={{ color: "#166534", fontFamily: tokens.fontMono }}>{formatMoney(totalIngSim)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Egresos:</span>
                    <strong style={{ color: "#991B1B", fontFamily: tokens.fontMono }}>{formatMoney(totalEgSim)}</strong>
                  </div>
                </div>
              </div>

              {/* DONA EGRESOS (FONDO CLARO) */}
              <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <h4 style={{ margin: "0 0 4px 0", color: "#0F172A", fontSize: 14.5, fontWeight: 700, textAlign: "center" }}>
                  Distribución de Egresos {selectedYear}
                </h4>
                <div style={{ fontSize: 11.5, color: "#64748B", textAlign: "center", marginBottom: 10 }}>
                  Participación porcentual de cada concepto sobre el Total de Egresos
                </div>

                <div style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieEgresos}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        dataKey="value"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      >
                        {pieEgresos.map((entry, index) => (
                          <Cell key={index} fill={COLORS_EG[index % COLORS_EG.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        formatter={(val, name, item) => {
                          const p = item?.payload?.perc || 0;
                          return [`${formatMoney(val)} (${p.toFixed(1)}%)`, "Monto Anual"];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* LISTA DETALLADA CON PORCENTAJE AL LADO DE CADA CONCEPTO */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {pieEgresos.map((entry, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 10px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: COLORS_EG[index % COLORS_EG.length], flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontFamily: tokens.fontMono, color: "#64748B", fontSize: 11.5 }}>{formatMoney(entry.value)}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", padding: "1px 6px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                          {entry.perc.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── RANKING DE PROYECTOS POR DESEMBOLSO ANUAL (FONDO CLARO) ── */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: 22, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h4 style={{ margin: 0, color: "#0F172A", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <HardHat size={17} color={tokens.gold} />
                  Ranking de Inversión por Proyecto {selectedYear}
                </h4>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Visualiza qué obras concentran el mayor flujo de desembolsos anuales y su peso porcentual.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#B45309",
                  background: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  padding: "4px 10px",
                  borderRadius: 6,
                  letterSpacing: "0.2px"
                }}>
                  {moneda === "USD" 
                    ? (enMillones ? "Cifras en Miles de Dólares (kUSD)" : "Cifras en Dólares (USD)")
                    : (enMillones ? "Cifras en Millones de Pesos ($ M)" : "Cifras en Pesos ($)")}
                </span>
              </div>
            </div>

            {(() => {
              const ranking = PLAN_PROJECT_CATS_2027
                .map(c => {
                  const rawVal = calcularTotalFila("egreso", c.key);
                  let value;
                  if (moneda === "USD") {
                    const usd = rawVal / (tcReferencia || 1540);
                    value = enMillones ? usd / 1000 : usd;
                  } else {
                    value = enMillones ? rawVal / 1_000_000 : rawVal;
                  }
                  return {
                    key: c.key,
                    name: c.label,
                    tag: c.tag,
                    value,
                    rawVal,
                    activo: isProyectoActivo(c.key)
                  };
                })
                .filter(d => d.rawVal > 0 || (simulacionActiva && !d.activo))
                .sort((a, b) => b.rawVal - a.rawVal);

              const totalObras = ranking.reduce((acc, curr) => acc + (curr.rawVal || 0), 0);

              if (ranking.length === 0) {
                return <div style={{ padding: "20px 0", textAlign: "center", color: "#64748B", fontSize: 12.5 }}>Ningún proyecto tiene monto asignado para {selectedYear}.</div>;
              }

              return (
                <>
                  <div style={{ height: Math.max(ranking.length * 38, 140) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 120, left: 30, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={170} tick={{ fill: "#1E293B", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                          formatter={(val, name, item) => {
                            const raw = item?.payload?.rawVal || 0;
                            const pctObra = totalObras > 0 ? ((raw / totalObras) * 100).toFixed(1) : 0;
                            const pctEg = totalEgSim > 0 ? ((raw / totalEgSim) * 100).toFixed(1) : 0;
                            return [
                              `${formatMoney(raw, true)} (${pctObra}% de obras · ${pctEg}% egresos)`,
                              "Desembolso Anual"
                            ];
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                          {ranking.map((d) => (
                            <Cell
                              key={d.key}
                              fill={simulacionActiva && !d.activo ? "#94A3B8" : tokens.gold}
                              fillOpacity={simulacionActiva && !d.activo ? 0.4 : 1}
                            />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="right"
                            formatter={(v) => {
                              const num = Number(v);
                              if (isNaN(num)) return "";
                              if (moneda === "USD") {
                                if (enMillones) {
                                  return `USD ${num >= 1000 ? (num/1000).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M" : num.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k"}`;
                                }
                                return `USD ${Math.round(num).toLocaleString("es-AR")}`;
                              }
                              if (enMillones) {
                                return `$ ${num.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
                              }
                              return `$ ${Math.round(num).toLocaleString("es-AR")}`;
                            }}
                            style={{ fill: "#0F172A", fontSize: 11, fontFamily: tokens.fontMono, fontWeight: 700 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* GRILLA DE CONCEPTOS CON PORCENTAJE SOBRE EL TOTAL */}
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #F1F5F9", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                    {ranking.map(item => {
                      const pctObra = totalObras > 0 ? ((item.rawVal / totalObras) * 100) : 0;
                      const pctEg = totalEgSim > 0 ? ((item.rawVal / totalEgSim) * 100) : 0;
                      return (
                        <div key={item.key} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#0F172A" }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: "#64748B", fontFamily: tokens.fontMono, marginTop: 2 }}>{formatMoney(item.rawVal)}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, background: "#FEF3C7", color: "#B45309", padding: "1px 6px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                              {pctObra.toFixed(1)}% obras
                            </span>
                            <span style={{ fontSize: 9.5, fontWeight: 600, background: "#EFF6FF", color: "#1E40AF", padding: "1px 5px", borderRadius: 4, fontFamily: tokens.fontMono }}>
                              {pctEg.toFixed(1)}% egreso
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── VISTA DE MAPEO ── */}
      {view === "mapeo" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${tokens.rule}`, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", color: tokens.positive, fontSize: 14, fontWeight: 700 }}>Vincular INGRESOS</h3>
            {dailyIncomeCats.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                <span style={{ fontSize: 13, color: tokens.text, fontWeight: 500, width: "45%" }}>{c.label}</span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>➔</span>
                <div style={{ width: "45%" }}>
                  <select className="map-select" value={mappingDraft.ingreso?.[c.key] || ""} onChange={(e) => handleMappingChange("ingreso", c.key, e.target.value)}>
                    <option value="">(Sin asignar)</option>
                    {planIncomeCats.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${tokens.rule}`, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", color: tokens.negative, fontSize: 14, fontWeight: 700 }}>Vincular EGRESOS</h3>
            {dailyExpenseCats.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                <span style={{ fontSize: 13, color: tokens.text, fontWeight: 500, width: "45%" }}>{c.label}</span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>➔</span>
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
          year={selectedYear}
          planIncomeCats={planIncomeCats}
          planExpenseCats={planExpenseCats}
          onGuardarPlan={async (nuevoPlan, y) => {
            await onGuardarPlan(nuevoPlan, y);
            if (y === selectedYear) {
              setPlanDraft(nuevoPlan);
            }
          }}
          onClose={() => setMostrarImportadorPresupuesto(false)}
        />
      )}
    </div>
  );
}
