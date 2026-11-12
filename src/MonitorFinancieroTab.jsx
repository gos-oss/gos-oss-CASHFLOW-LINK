import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import { DEFAULT_STOCK_UNITS, PROYECTOS_STOCK, normalizarNombreProyecto } from "./stockData";
import { OBRAS_DATA_SUMMARY, CURVAS_MENSUALES_OBRAS } from "./proyectosData";
import {
  DEFAULT_PLAN_2026,
  DEFAULT_PLAN_2027,
  PLAN_PROJECT_CATS_2027,
  PLAN_INCOME_CATS_2027,
  PLAN_INCOME_CATS_2026,
  PLAN_EXPENSE_CATS_2027,
  PLAN_EXPENSE_CATS_2026,
  PLAN_EXPENSE_CATS
} from "./budgetData";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, Cell, BarChart
} from "recharts";
import {
  Building2, DollarSign, Activity, TrendingUp, TrendingDown, Wallet,
  Calendar, AlertTriangle, CheckCircle2, ArrowUpRight, Sparkles, Layers,
  Eye, RefreshCw, Cloud, ChevronRight, Scale, Plus, Pencil, X, Save,
  HardHat, FileText, BarChart3, HelpCircle, Target, Clock, SlidersHorizontal,
  Info, Award
} from "lucide-react";

const colorLineaSuave = "#E2E8F0";
const colorLineaFuerte = "#CBD5E1";
const colorTablaBg = "#F8FAFC";

const fmtNum = (v, dec = 1) => {
  if (v == null || v === "" || isNaN(v)) return "—";
  return Number(v).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const fmtEntero = (v) => {
  if (v == null || v === "" || isNaN(v)) return "0";
  return Math.round(Number(v)).toLocaleString("es-AR");
};

const MESES = [
  { id: "01", label: "Ene", full: "Enero" },
  { id: "02", label: "Feb", full: "Febrero" },
  { id: "03", label: "Mar", full: "Marzo" },
  { id: "04", label: "Abr", full: "Abril" },
  { id: "05", label: "May", full: "Mayo" },
  { id: "06", label: "Jun", full: "Junio" },
  { id: "07", label: "Jul", full: "Julio" },
  { id: "08", label: "Ago", full: "Agosto" },
  { id: "09", label: "Sep", full: "Septiembre" },
  { id: "10", label: "Oct", full: "Octubre" },
  { id: "11", label: "Nov", full: "Noviembre" },
  { id: "12", label: "Dic", full: "Diciembre" }
];

export default function MonitorFinancieroTab({
  weeks = [],
  procesadas = [],
  kpis = null,
  tcList = [],
  arqueosList = [],
  planesFondos = {},
  incomeCats = [],
  expenseCats = [],
  fmt = fmtEntero,
  formatDate = (d) => d,
  onSyncTC,
  onNavigateToTab,
  onRefresh
}) {
  // ── 0. ESTADO GENERAL & MONEDA ──
  const [moneda, setMoneda] = useState("ARS"); // "ARS" | "USD"
  const [ejercicio, setEjercicio] = useState("2027"); // "2027" | "2026"
  const [toast, setToast] = useState("");
  const [actualizandoTodo, setActualizandoTodo] = useState(false);
  
  // Estado para el indicador de Ritmo de Venta ($ y Unidades)
  const [fechaHoyCorte, setFechaHoyCorte] = useState("2026-11"); // Fecha de corte 'Hoy' (YYYY-MM)
  const [criterioRitmo, setCriterioRitmo] = useState("plazo_restante"); // "plazo_restante" | "curva_futura" | "anio_presupuesto" | "plazo_total"
  const [pctAnticipoSimulado, setPctAnticipoSimulado] = useState(100); // 100 | 50 | 30
  const [filtroProyectoRitmo, setFiltroProyectoRitmo] = useState("todos"); // "todos" | id de obra

  // Tipo de Cambio oficial de cálculo
  const tcReferencia = useMemo(() => {
    if (tcList && tcList.length > 0) {
      const sorted = [...tcList].sort((a, b) => b.fecha_corte.localeCompare(a.fecha_corte));
      const val = Number(sorted[0].saldo_efectivo);
      if (val > 0) return val;
    }
    return 1540;
  }, [tcList]);

  // ── 1. CUADRO 1: SITUACIÓN ACTUAL (POSICIÓN DE CAJA & LIQUIDEZ) ──
  const situacionActual = useMemo(() => {
    const ordenados = [...arqueosList].sort((a, b) => (b.fecha_corte || "").localeCompare(a.fecha_corte || ""));
    const ultArqueo = ordenados[0] || null;

    const saldoBanco = ultArqueo ? Number(ultArqueo.saldo_banco || 0) : 0;
    const saldoEfectivo = ultArqueo ? Number(ultArqueo.saldo_efectivo || 0) : 0;
    const liquidezARS = kpis ? kpis.liquidez : saldoBanco + saldoEfectivo;
    const liquidezUSD = tcReferencia > 0 ? liquidezARS / tcReferencia : 0;

    const diasDeCaja = kpis ? kpis.diasDeCaja : null;
    const deficitActual = kpis ? kpis.deficitActual : liquidezARS < 0;
    const sinQuemaNeta = kpis ? kpis.sinQuemaNeta : false;
    const diaDeficit = kpis ? kpis.diaDeficit : "Sin déficit";

    return {
      saldoBanco,
      saldoBancoUSD: tcReferencia > 0 ? saldoBanco / tcReferencia : 0,
      saldoEfectivo,
      saldoEfectivoUSD: tcReferencia > 0 ? saldoEfectivo / tcReferencia : 0,
      liquidezARS,
      liquidezUSD,
      diasDeCaja,
      deficitActual,
      sinQuemaNeta,
      diaDeficit,
      fechaCorte: ultArqueo?.fecha_corte || "En fecha"
    };
  }, [arqueosList, kpis, tcReferencia]);

  // ── 2. CUADRO 2: INGRESOS, EGRESOS & NECESIDAD DE CAJA MENSUAL ──
  const planActual = useMemo(() => {
    const raw = (planesFondos && planesFondos[ejercicio]) || (ejercicio === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026);
    if (!raw) return ejercicio === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026;

    if (ejercicio === "2027") {
      const cloned = JSON.parse(JSON.stringify(raw));
      if (!cloned.ingreso) cloned.ingreso = {};
      if (!cloned.egreso) cloned.egreso = {};

      PLAN_INCOME_CATS_2027.forEach(cat => {
        const tieneCat = cloned.ingreso[cat.key] && Object.keys(cloned.ingreso[cat.key]).length > 0;
        if (!tieneCat) {
          cloned.ingreso[cat.key] = DEFAULT_PLAN_2027.ingreso[cat.key] || {};
        }
      });

      // Sincronizar SIEMPRE custom_gestion-comercial deduciendo comercialización para evitar doble cómputo
      const hasSubcats = cloned.ingreso["custom_ventas-mostrador"] || cloned.ingreso["custom_ventas-canjes"] || cloned.ingreso["custom_ventas-paquetes"];
      if (hasSubcats) {
        cloned.ingreso["custom_gestion-comercial"] = cloned.ingreso["custom_gestion-comercial"] || {};
        MESES.forEach(m => {
          const vm = Number(cloned.ingreso["custom_ventas-mostrador"]?.[m.id] || 0);
          const vc = Number(cloned.ingreso["custom_ventas-canjes"]?.[m.id] || 0);
          const vp = Number(cloned.ingreso["custom_ventas-paquetes"]?.[m.id] || 0);
          cloned.ingreso["custom_gestion-comercial"][m.id] = vm + vc + vp;
        });
      }

      PLAN_EXPENSE_CATS_2027.forEach(cat => {
        const tieneCat = cloned.egreso[cat.key] && Object.keys(cloned.egreso[cat.key]).length > 0;
        if (!tieneCat) {
          cloned.egreso[cat.key] = DEFAULT_PLAN_2027.egreso[cat.key] || {};
        }
      });
      return cloned;
    }

    if (ejercicio === "2026") {
      const cloned = JSON.parse(JSON.stringify(raw));
      if (!cloned.ingreso) cloned.ingreso = {};
      if (!cloned.egreso) cloned.egreso = {};
      PLAN_INCOME_CATS_2026.forEach(cat => {
        if (!cloned.ingreso[cat.key]) cloned.ingreso[cat.key] = DEFAULT_PLAN_2026.ingreso[cat.key] || {};
      });
      PLAN_EXPENSE_CATS_2026.forEach(cat => {
        if (!cloned.egreso[cat.key]) cloned.egreso[cat.key] = DEFAULT_PLAN_2026.egreso[cat.key] || {};
      });
      return cloned;
    }

    return raw;
  }, [planesFondos, ejercicio]);

  const datosMensuales = useMemo(() => {
    const ingData = planActual.ingreso || {};
    const egData = planActual.egreso || {};

    const activeIncomeCats = ejercicio === "2027" ? PLAN_INCOME_CATS_2027 : PLAN_INCOME_CATS_2026;
    const activeExpenseCats = ejercicio === "2027" ? PLAN_EXPENSE_CATS_2027 : PLAN_EXPENSE_CATS_2026;

    let saldoAcumuladoConCaja = situacionActual.liquidezARS;
    let saldoAcumuladoPuro = 0;

    return MESES.map((m) => {
      let totIng = 0;
      activeIncomeCats.forEach((c) => {
        totIng += Number(ingData[c.key]?.[m.id] || 0);
      });

      let totEg = 0;
      activeExpenseCats.forEach((c) => {
        totEg += Number(egData[c.key]?.[m.id] || 0);
      });

      const flujoNeto = totIng - totEg;
      saldoAcumuladoConCaja += flujoNeto;
      saldoAcumuladoPuro += flujoNeto;

      // Necesidad de caja mensual: déficit de fondos del mes que debe fondearse
      const necesidadCaja = flujoNeto < 0 ? Math.abs(flujoNeto) : 0;
      const superavit = flujoNeto > 0 ? flujoNeto : 0;

      // Conversión a USD si la moneda activa es USD
      const div = moneda === "USD" ? (tcReferencia || 1) : 1;

      return {
        mesId: m.id,
        mes: m.label,
        mesFull: m.full,
        ingresos: totIng / div,
        egresos: totEg / div,
        flujoNeto: flujoNeto / div,
        necesidadCaja: necesidadCaja / div,
        superavit: superavit / div,
        saldoAcumulado: saldoAcumuladoPuro / div,
        saldoConCajaInicial: saldoAcumuladoConCaja / div,
        rawIngresos: totIng,
        rawEgresos: totEg,
        rawFlujoNeto: flujoNeto,
        rawNecesidadCaja: necesidadCaja,
        rawSaldoAcumulado: saldoAcumuladoPuro,
        rawSaldoConCajaInicial: saldoAcumuladoConCaja,
        esDeficitario: flujoNeto < 0
      };
    });
  }, [planActual, situacionActual.liquidezARS, moneda, tcReferencia, ejercicio]);

  const metricasPlan = useMemo(() => {
    const totalIng = datosMensuales.reduce((acc, cur) => acc + cur.rawIngresos, 0);
    const totalEg = datosMensuales.reduce((acc, cur) => acc + cur.rawEgresos, 0);
    const balanceNeto = totalIng - totalEg;
    const totalNecesidadCaja = datosMensuales.reduce((acc, cur) => acc + cur.rawNecesidadCaja, 0);

    // Mes con mayor necesidad de caja
    const mesesConDeficit = [...datosMensuales].filter(m => m.rawFlujoNeto < 0);
    mesesConDeficit.sort((a, b) => b.rawNecesidadCaja - a.rawNecesidadCaja);
    const mesPico = mesesConDeficit[0] || null;

    // Peor saldo acumulado
    const peorSaldoMes = [...datosMensuales].sort((a, b) => a.rawSaldoAcumulado - b.rawSaldoAcumulado)[0];

    const div = moneda === "USD" ? (tcReferencia || 1) : 1;

    return {
      totalIng: totalIng / div,
      totalEg: totalEg / div,
      balanceNeto: balanceNeto / div,
      totalNecesidadCaja: totalNecesidadCaja / div,
      rawTotalIng: totalIng,
      rawTotalEg: totalEg,
      rawBalanceNeto: balanceNeto,
      rawTotalNecesidadCaja: totalNecesidadCaja,
      mesPico,
      peorSaldoMes,
      cantMesesDeficit: mesesConDeficit.length
    };
  }, [datosMensuales, moneda, tcReferencia]);

  // ── 3. CUADRO 3: STOCK DE UNIDADES POR PROYECTO & VALUACIÓN TOTAL ──
  const [unidadesStock, setUnidadesStock] = useState(() => {
    try {
      if (localStorage.getItem("cf_stock_disponible_units_v1")) localStorage.removeItem("cf_stock_disponible_units_v1");
      if (localStorage.getItem("cf_stock_disponible_units_v2")) localStorage.removeItem("cf_stock_disponible_units_v2");
      if (localStorage.getItem("cf_stock_disponible_units_v3")) localStorage.removeItem("cf_stock_disponible_units_v3");
      const local = localStorage.getItem("cf_stock_disponible_units_v4");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0 && !parsed.some(u => String(u.id).startsWith("import-179") || u.proyecto?.toLowerCase().includes("torre 3"))) {
          return parsed
            .filter(u => !(Number(u.precio_usd || 0) === 0 && Number(u.m2_propios || 0) === 0))
            .map(u => ({
              ...u,
              proyecto: normalizarNombreProyecto(u.proyecto),
              m2_propios: Math.round((Number(u.m2_propios) || 0) * 100) / 100,
              m2_totales: Math.round((Number(u.m2_totales) || Number(u.m2_propios) || 0) * 100) / 100,
              precio_usd: Math.round((Number(u.precio_usd) || 0) * 100) / 100,
              precio_m2_usd: Math.round(Number(u.precio_m2_usd) || 0),
              estado: u.estado || "Disponible"
            }));
        }
      }
    } catch {}
    return DEFAULT_STOCK_UNITS;
  });

  const [cargandoStock, setCargandoStock] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      setCargandoStock(true);
      try {
        const { data, error } = await supabase.from("stock_units").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          const cleaned = data
            .filter(u => !(Number(u.precio_usd || 0) === 0 && Number(u.m2_propios || 0) === 0))
            .map(u => ({
              ...u,
              proyecto: normalizarNombreProyecto(u.proyecto),
              m2_propios: Math.round((Number(u.m2_propios) || 0) * 100) / 100,
              m2_totales: Math.round((Number(u.m2_totales) || Number(u.m2_propios) || 0) * 100) / 100,
              precio_usd: Math.round((Number(u.precio_usd) || 0) * 100) / 100,
              precio_m2_usd: Math.round(Number(u.precio_m2_usd) || 0),
              estado: u.estado || "Disponible"
            }));
          setUnidadesStock(cleaned);
          localStorage.setItem("cf_stock_disponible_units_v4", JSON.stringify(cleaned));
        }
      } catch (err) {
        console.warn("Stock fetch fallback:", err);
      } finally {
        setCargandoStock(false);
      }
    };
    fetchStock();
  }, []);

  const stockPorProyecto = useMemo(() => {
    const mapa = {};
    PROYECTOS_STOCK.forEach(p => {
      mapa[p] = {
        proyecto: p,
        totalUnidades: 0,
        disponibles: 0,
        reservadas: 0,
        bloqueadas: 0,
        m2Totales: 0,
        valuacionUSD: 0
      };
    });

    unidadesStock.forEach(u => {
      const pNom = normalizarNombreProyecto(u.proyecto || "Otros Proyectos");
      if (!mapa[pNom]) {
        mapa[pNom] = {
          proyecto: pNom,
          totalUnidades: 0,
          disponibles: 0,
          reservadas: 0,
          bloqueadas: 0,
          m2Totales: 0,
          valuacionUSD: 0
        };
      }
      mapa[pNom].totalUnidades += 1;
      if (u.estado === "Disponible") mapa[pNom].disponibles += 1;
      else if (u.estado === "Reservado" || u.estado === "En Negociación") mapa[pNom].reservadas += 1;
      else mapa[pNom].bloqueadas += 1;

      mapa[pNom].m2Totales += Number(u.m2_totales || u.m2_propios || 0);
      mapa[pNom].valuacionUSD += Number(u.precio_usd || 0);
    });

    const lista = Object.values(mapa).filter(p => p.totalUnidades > 0);
    lista.sort((a, b) => b.valuacionUSD - a.valuacionUSD);

    const totalValUSD = lista.reduce((acc, cur) => acc + cur.valuacionUSD, 0);
    const totalValARS = totalValUSD * tcReferencia;
    const totalUnits = lista.reduce((acc, cur) => acc + cur.totalUnidades, 0);
    const totalDisponibles = lista.reduce((acc, cur) => acc + cur.disponibles, 0);
    const totalReservadas = lista.reduce((acc, cur) => acc + cur.reservadas, 0);
    const totalM2 = lista.reduce((acc, cur) => acc + cur.m2Totales, 0);
    const ticketPromedioUSD = totalUnits > 0 ? totalValUSD / totalUnits : 0;
    const precioM2PromedioUSD = totalM2 > 0 ? totalValUSD / totalM2 : 0;

    return {
      proyectos: lista.map(p => ({
        ...p,
        valuacionARS: p.valuacionUSD * tcReferencia,
        pctTotal: totalValUSD > 0 ? (p.valuacionUSD / totalValUSD) * 100 : 0,
        precioM2USD: p.m2Totales > 0 ? p.valuacionUSD / p.m2Totales : 0
      })),
      totalValUSD,
      totalValARS,
      totalUnits,
      totalDisponibles,
      totalReservadas,
      totalM2,
      ticketPromedioUSD,
      precioM2PromedioUSD
    };
  }, [unidadesStock, tcReferencia]);

  // ── 3.B. INDICADOR DE RITMO DE VENTA REQUERIDO ($ Y UNIDADES) PARA CUBRIR COSTO DE OBRA ──
  const ritmoVentaAnalisis = useMemo(() => {
    const stockMap = {
      "duo": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] },
      "300_t2_am": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] },
      "300_corp": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] },
      "torre_green": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] },
      "auria": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] },
      "mas_duo": { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] }
    };

    unidadesStock.forEach(u => {
      if (u.estado === "Vendido") return;
      const norm = normalizarNombreProyecto(u.proyecto).toLowerCase();
      const rawP = (u.proyecto || "").toLowerCase();
      const rawA = (u.asignado || "").toLowerCase();
      const usd = Number(u.precio_usd || 0);
      const m2 = Number(u.m2_totales || u.m2_propios || 0);
      const isDisp = u.estado === "Disponible";
      const isRes = u.estado === "Reservado" || u.estado === "En Negociación";

      let targetKey = null;
      if (norm.includes("corporativ") || rawA.includes("300tc") || rawP.includes("corporativ")) {
        targetKey = "300_corp";
      } else if (norm.includes("torre 2") || rawA.includes("300t2") || rawP.includes("torre 2")) {
        targetKey = "300_t2_am";
      } else if (norm.includes("torre 4") || rawA.includes("300t4") || rawP.includes("torre 4")) {
        targetKey = "300_t2_am";
      } else if (norm.includes("green") || rawA.includes("green")) {
        targetKey = "torre_green";
      } else if (norm.includes("auria") || rawA.includes("auria") || norm.includes("marcos paz")) {
        targetKey = "auria";
      } else if (norm.includes("duo") || rawA.includes("duo")) {
        targetKey = "mas_duo";
      }

      if (targetKey && stockMap[targetKey]) {
        stockMap[targetKey].count++;
        if (isDisp) stockMap[targetKey].disponibles++;
        if (isRes) stockMap[targetKey].reservadas++;
        stockMap[targetKey].valUSD += usd;
        stockMap[targetKey].m2 += m2;
        stockMap[targetKey].unidades.push(u);
      }
    });

    const factorAnticipo = Math.max(0.01, (Number(pctAnticipoSimulado) || 100) / 100);

    const listaObras = OBRAS_DATA_SUMMARY.map(obra => {
      const st = stockMap[obra.id] || { count: 0, disponibles: 0, reservadas: 0, valUSD: 0, m2: 0, unidades: [] };
      const stockValUSD = st.valUSD;
      const stockValARS = stockValUSD * tcReferencia;
      const stockUnidades = st.count;
      const disponibles = st.disponibles;
      const reservadas = st.reservadas;

      const ticketPromUSD = stockUnidades > 0 ? stockValUSD / stockUnidades : 0;
      const ticketPromARS = ticketPromUSD * tcReferencia;

      const saldoObraARS = Number(obra.saldo_presupuesto || 0);
      const saldoObraUSD = tcReferencia > 0 ? saldoObraARS / tcReferencia : 0;

      // ── 1. CÁLCULO DE MESES RESTANTES REALES DESDE LA FECHA DE HOY ──
      const [aFin, mFin] = (obra.fecha_fin || "2026-12").split("-").map(Number);
      const [aHoy, mHoy] = (fechaHoyCorte || "2026-11").split("-").map(Number);
      const diffMeses = (aFin - aHoy) * 12 + (mFin - mHoy) + 1;
      // Si la fecha de fin es anterior o igual a hoy, queda 1 mes (fase final o entrega en curso)
      const mesesRestantesDesdeHoy = Math.max(1, diffMeses);
      const mesesNominalesTotal = Math.max(1, Number(obra.duracion_meses || 12));
      const mesesTranscurridos = Math.max(0, mesesNominalesTotal - mesesRestantesDesdeHoy);

      // ── 2. CURVA MENSUAL OFICIAL COMPLETA Y DESEMBOLSOS FUTUROS ──
      const curva = CURVAS_MENSUALES_OBRAS[obra.id] || CURVAS_MENSUALES_OBRAS[obra.id === "auria" ? "marcos_paz" : obra.id] || {};
      let desembolsosFuturosARS = 0;
      let mesesFuturosConGasto = 0;
      Object.entries(curva).forEach(([mesKey, val]) => {
        if (mesKey >= fechaHoyCorte) {
          const mVal = Number(val || 0);
          desembolsosFuturosARS += mVal;
          if (mVal > 0) mesesFuturosConGasto++;
        }
      });
      const desembolsosFuturosUSD = tcReferencia > 0 ? desembolsosFuturosARS / tcReferencia : 0;
      const divisorFuturo = Math.max(1, mesesFuturosConGasto > 0 ? mesesFuturosConGasto : mesesRestantesDesdeHoy);
      const costoMensualCurvaFuturaARS = desembolsosFuturosARS > 0 ? desembolsosFuturosARS / divisorFuturo : saldoObraARS / mesesRestantesDesdeHoy;
      const costoMensualCurvaFuturaUSD = tcReferencia > 0 ? costoMensualCurvaFuturaARS / tcReferencia : 0;

      // ── 3. COSTO MENSUAL POR PLAZO RESTANTE DESDE HOY (RECOMENDADO) ──
      const costoMensualRestanteARS = saldoObraARS / mesesRestantesDesdeHoy;
      const costoMensualRestanteUSD = saldoObraUSD / mesesRestantesDesdeHoy;

      // ── 4. COSTO MENSUAL POR PLAZO TOTAL HISTÓRICO (NOMINAL) ──
      const costoMensualTotalARS = saldoObraARS / mesesNominalesTotal;
      const costoMensualTotalUSD = saldoObraUSD / mesesNominalesTotal;

      // ── 5. COSTO EN EL EJERCICIO PRESUPUESTADO (EJ. 2027) ──
      let costoAnioARS = 0;
      let mesesConDesembolsoAnio = 0;
      Object.entries(curva).forEach(([mesKey, val]) => {
        if (mesKey.startsWith(ejercicio)) {
          const mVal = Number(val || 0);
          costoAnioARS += mVal;
          if (mVal > 0) mesesConDesembolsoAnio++;
        }
      });
      const costoAnioUSD = tcReferencia > 0 ? costoAnioARS / tcReferencia : 0;
      const mesesDivisorAnio = mesesConDesembolsoAnio > 0 ? mesesConDesembolsoAnio : 12;
      const costoMensualAnioARS = costoAnioARS / mesesDivisorAnio;
      const costoMensualAnioUSD = costoAnioUSD / mesesDivisorAnio;

      // ── DETERMINAR COSTO Y PLAZO SEGÚN CRITERIO ACTIVO ──
      let costoMensualElegidoARS = costoMensualRestanteARS;
      let costoMensualElegidoUSD = costoMensualRestanteUSD;
      let mesesPlazoElegido = mesesRestantesDesdeHoy;
      let etiquetaCriterio = `${mesesRestantesDesdeHoy} meses restantes`;

      if (criterioRitmo === "curva_futura") {
        costoMensualElegidoARS = costoMensualCurvaFuturaARS;
        costoMensualElegidoUSD = costoMensualCurvaFuturaUSD;
        mesesPlazoElegido = divisorFuturo;
        etiquetaCriterio = `${divisorFuturo} m (curva futura)`;
      } else if (criterioRitmo === "anio_presupuesto" && costoAnioARS > 0) {
        costoMensualElegidoARS = costoMensualAnioARS;
        costoMensualElegidoUSD = costoMensualAnioUSD;
        mesesPlazoElegido = mesesDivisorAnio;
        etiquetaCriterio = `${mesesDivisorAnio} m (${ejercicio})`;
      } else if (criterioRitmo === "plazo_total") {
        costoMensualElegidoARS = costoMensualTotalARS;
        costoMensualElegidoUSD = costoMensualTotalUSD;
        mesesPlazoElegido = mesesNominalesTotal;
        etiquetaCriterio = `${mesesNominalesTotal} m (total nominal)`;
      }

      const ritmoRequeridoARS = costoMensualElegidoARS;
      const ritmoRequeridoUSD = costoMensualElegidoUSD;

      const ritmoUnidadesMes = ticketPromUSD > 0 ? ritmoRequeridoUSD / ticketPromUSD : 0;
      const ritmoUnidadesConAnticipo = (ticketPromUSD > 0 && factorAnticipo > 0) ? ritmoRequeridoUSD / (ticketPromUSD * factorAnticipo) : 0;

      const coberturaPct = saldoObraARS > 0 ? (stockValARS / saldoObraARS) * 100 : (stockValARS > 0 ? 999 : 0);
      const superavitARS = stockValARS - saldoObraARS;
      const superavitUSD = stockValUSD - saldoObraUSD;

      const mesesParaAgotarStock = ritmoUnidadesMes > 0 ? stockUnidades / ritmoUnidadesMes : 0;

      let estadoBadge = "Equilibrado";
      let estadoColor = "#10B981";
      let estadoBg = "#ECFDF5";
      let estadoBorder = "#A7F3D0";
      let detalleDiagnostico = "";

      if (stockUnidades === 0) {
        estadoBadge = "100% Vendido";
        estadoColor = "#64748B";
        estadoBg = "#F1F5F9";
        estadoBorder = "#CBD5E1";
        detalleDiagnostico = "Obra en fase final financiada con cobranza pactada de cuotas.";
      } else if (coberturaPct >= 120) {
        estadoBadge = "Superávit de Stock";
        estadoColor = "#059669";
        estadoBg = "#ECFDF5";
        estadoBorder = "#A7F3D0";
        detalleDiagnostico = `Stock cubre el ${coberturaPct.toFixed(0)}% del saldo con superávit de U$D ${fmt(superavitUSD)}. En ${mesesRestantesDesdeHoy} meses restantes requiere ${ritmoUnidadesMes.toFixed(2)} u/mes.`;
      } else if (coberturaPct >= 75) {
        estadoBadge = "Equilibrado";
        estadoColor = "#2563EB";
        estadoBg = "#EFF6FF";
        estadoBorder = "#BFDBFE";
        detalleDiagnostico = `Cobertura del ${coberturaPct.toFixed(0)}%. Ritmo de ${ritmoUnidadesMes.toFixed(2)} u/mes en los ${mesesRestantesDesdeHoy} meses restantes.`;
      } else {
        estadoBadge = "Requiere Pre-ventas";
        estadoColor = "#D97706";
        estadoBg = "#FFFBEB";
        estadoBorder = "#FDE68A";
        detalleDiagnostico = `Cobertura del ${coberturaPct.toFixed(0)}%. Stock disponible cubre parte del saldo; el remanente requiere cobranzas de cuotas o nuevas preventas.`;
      }

      return {
        id: obra.id,
        nombre: obra.nombre,
        color: obra.color,
        estadoObra: obra.estado,
        tipologia: obra.tipologia,
        fecha_inicio: obra.fecha_inicio_label,
        fecha_fin: obra.fecha_fin_label,
        fecha_fin_raw: obra.fecha_fin,
        mesesNominalesTotal,
        mesesRestantesDesdeHoy,
        mesesTranscurridos,
        mesesPlazoElegido,
        etiquetaCriterio,
        saldoObraARS,
        saldoObraUSD,
        costoMensualRestanteARS,
        costoMensualRestanteUSD,
        costoMensualCurvaFuturaARS,
        costoMensualCurvaFuturaUSD,
        costoMensualTotalARS,
        costoMensualTotalUSD,
        costoAnioARS,
        costoAnioUSD,
        costoMensualAnioARS,
        costoMensualAnioUSD,
        costoMensualElegidoARS,
        costoMensualElegidoUSD,
        desembolsosFuturosARS,
        desembolsosFuturosUSD,
        stockUnidades,
        disponibles,
        reservadas,
        stockValUSD,
        stockValARS,
        ticketPromUSD,
        ticketPromARS,
        ritmoRequeridoARS,
        ritmoRequeridoUSD,
        ritmoUnidadesMes,
        ritmoUnidadesConAnticipo,
        coberturaPct,
        superavitARS,
        superavitUSD,
        mesesParaAgotarStock,
        estadoBadge,
        estadoColor,
        estadoBg,
        estadoBorder,
        detalleDiagnostico
      };
    });

    const totalSaldoObraARS = listaObras.reduce((a, b) => a + b.saldoObraARS, 0);
    const totalSaldoObraUSD = listaObras.reduce((a, b) => a + b.saldoObraUSD, 0);
    const totalCostoMensualARS = listaObras.reduce((a, b) => a + b.costoMensualElegidoARS, 0);
    const totalCostoMensualUSD = listaObras.reduce((a, b) => a + b.costoMensualElegidoUSD, 0);
    const totalStockUnidades = listaObras.reduce((a, b) => a + b.stockUnidades, 0);
    const totalDisponibles = listaObras.reduce((a, b) => a + b.disponibles, 0);
    const totalReservadas = listaObras.reduce((a, b) => a + b.reservadas, 0);
    const totalStockValUSD = listaObras.reduce((a, b) => a + b.stockValUSD, 0);
    const totalStockValARS = listaObras.reduce((a, b) => a + b.stockValARS, 0);
    const ticketPromedioGlobalUSD = totalStockUnidades > 0 ? totalStockValUSD / totalStockUnidades : 0;
    const ticketPromedioGlobalARS = ticketPromedioGlobalUSD * tcReferencia;
    const totalRitmoUnidadesMes = listaObras.reduce((a, b) => a + b.ritmoUnidadesMes, 0);
    const totalRitmoUnidadesConAnticipo = listaObras.reduce((a, b) => a + b.ritmoUnidadesConAnticipo, 0);
    const totalCoberturaPct = totalSaldoObraARS > 0 ? (totalStockValARS / totalSaldoObraARS) * 100 : 0;
    const totalSuperavitARS = totalStockValARS - totalSaldoObraARS;
    const totalSuperavitUSD = totalStockValUSD - totalSaldoObraUSD;

    return {
      proyectos: listaObras,
      totales: {
        totalSaldoObraARS,
        totalSaldoObraUSD,
        totalCostoMensualARS,
        totalCostoMensualUSD,
        totalStockUnidades,
        totalDisponibles,
        totalReservadas,
        totalStockValUSD,
        totalStockValARS,
        ticketPromedioGlobalUSD,
        ticketPromedioGlobalARS,
        totalRitmoUnidadesMes,
        totalRitmoUnidadesConAnticipo,
        totalCoberturaPct,
        totalSuperavitARS,
        totalSuperavitUSD
      }
    };
  }, [unidadesStock, tcReferencia, ejercicio, criterioRitmo, fechaHoyCorte, pctAnticipoSimulado, fmt]);

  // ── 4. CUADRO 4: PRINCIPALES INDICADORES FINANCIEROS Y ECONÓMICOS ──
  const [dolares, setDolares] = useState([]);
  const [loadingDolares, setLoadingDolares] = useState(false);

  const [cacData, setCacData] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_cac_cache");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [h21Data, setH21Data] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_h21_cache");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [indiceLink, setIndiceLink] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_indice_link_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [syncingIndice, setSyncingIndice] = useState(false);
  const [modalIndiceOpen, setModalIndiceOpen] = useState(false);
  const [indiceDraft, setIndiceDraft] = useState({
    id_mes: "2026-09",
    anio: 2026,
    mesIdx: 9,
    etiqueta: "Sep 2026",
    indice: "",
    valor_absoluto: "",
    observaciones: ""
  });

  // Fetch Dólares en vivo
  const fetchDolares = useCallback(async () => {
    setLoadingDolares(true);
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares");
      if (res.ok) {
        const data = await res.json();
        setDolares(data);
      }
    } catch (e) {
      console.warn("Error cargando cotizaciones:", e);
    } finally {
      setLoadingDolares(false);
    }
  }, []);

  // Fetch Índice Link
  const loadIndiceLink = useCallback(async () => {
    setSyncingIndice(true);
    try {
      const { data, error } = await supabase.from("cf_indice_link").select("*").order("id_mes", { ascending: true });
      if (!error && Array.isArray(data)) {
        setIndiceLink(data);
        localStorage.setItem("cf_indice_link_data", JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Error al cargar Índice Link:", err);
    } finally {
      setSyncingIndice(false);
    }
  }, []);

  // Fetch CAC Indicadores
  const loadCAC = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("cf_cac_indicadores").select("*");
      if (!error && Array.isArray(data)) {
        const byKey = {};
        data.forEach((row) => { byKey[row.indicador] = row; });
        setCacData(byKey);
        localStorage.setItem("cf_cac_cache", JSON.stringify(byKey));
      }
    } catch (err) {
      console.warn("Error al cargar CAC:", err);
    }
  }, []);

  // Fetch H-21 Precios
  const loadH21 = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("cf_h21_precios").select("*").order("id_mes", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        setH21Data(data);
        localStorage.setItem("cf_h21_cache", JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Error al cargar H21:", err);
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    setActualizandoTodo(true);
    try {
      await Promise.all([
        fetchDolares(),
        loadIndiceLink(),
        loadCAC(),
        loadH21()
      ]);
      if (onRefresh) onRefresh();
      setToast("Tablero e indicadores sincronizados");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setActualizandoTodo(false);
    }
  }, [fetchDolares, loadIndiceLink, loadCAC, loadH21, onRefresh]);

  useEffect(() => {
    fetchDolares();
    loadIndiceLink();
    loadCAC();
    loadH21();

    const handleStorageChange = (e) => {
      if (e.key === "cf_indice_link_data") loadIndiceLink();
      if (e.key === "cf_cac_cache") loadCAC();
      if (e.key === "cf_h21_cache") loadH21();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchDolares, loadIndiceLink, loadCAC, loadH21]);

  const handleSincronizarTC = (valor, etiqueta) => {
    if (!valor) return;
    if (onSyncTC) {
      onSyncTC(valor, etiqueta);
    }
    setToast(`Dólar ${etiqueta} ($${fmtNum(valor, 0)}) fijado como TC de referencia`);
    setTimeout(() => setToast(""), 3500);
  };

  const handleGuardarIndice = async () => {
    if (!indiceDraft.indice || !indiceDraft.id_mes) {
      alert("Por favor completá los puntos del Índice Link.");
      return;
    }

    const nuevoRegistro = {
      id_mes: indiceDraft.id_mes,
      anio: Number(indiceDraft.anio) || 2026,
      mes: Number(indiceDraft.mesIdx) || 9,
      etiqueta: indiceDraft.etiqueta,
      indice: Number(indiceDraft.indice) || 0,
      valor_absoluto: Number(indiceDraft.valor_absoluto) || 0,
      observaciones: indiceDraft.observaciones || "",
      actualizado_el: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from("cf_indice_link").upsert(nuevoRegistro);
      if (error) throw error;

      const filtrados = indiceLink.filter(i => i.id_mes !== nuevoRegistro.id_mes);
      const actualizados = [...filtrados, nuevoRegistro].sort((a, b) => a.id_mes.localeCompare(b.id_mes));
      setIndiceLink(actualizados);
      localStorage.setItem("cf_indice_link_data", JSON.stringify(actualizados));

      setModalIndiceOpen(false);
      setToast(`Índice Link ${nuevoRegistro.etiqueta} guardado exitosamente en la nube.`);
      setTimeout(() => setToast(""), 3500);
    } catch (err) {
      alert("Error al guardar en Supabase: " + err.message);
    }
  };

  // Último registro del Índice Link
  const ultimoIndiceLink = useMemo(() => {
    if (!indiceLink || indiceLink.length === 0) return null;
    const sorted = [...indiceLink].sort((a, b) => a.id_mes.localeCompare(b.id_mes));
    const ult = sorted[sorted.length - 1];
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    const varMensual = prev && prev.indice > 0 ? ((ult.indice - prev.indice) / prev.indice) * 100 : 0;
    return { ...ult, varMensual };
  }, [indiceLink]);

  // Último precio de Hormigón H-21
  const ultimoH21 = useMemo(() => {
    if (!h21Data || h21Data.length === 0) return { valor: 184500, etiqueta: "Sep 2026" };
    const sorted = [...h21Data].sort((a, b) => (a.id_mes || "").localeCompare(b.id_mes || ""));
    return sorted[sorted.length - 1];
  }, [h21Data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── NOTIFICACIÓN TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          background: tokens.ink,
          color: "#fff",
          padding: "12px 20px",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderLeft: `4px solid ${tokens.gold}`,
          fontFamily: tokens.fontBody,
          fontSize: 13,
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color={tokens.gold} />
          <span>{toast}</span>
        </div>
      )}

      {/* ── CABECERA PRINCIPAL DEL MONITOR FINANCIERO ── */}
      <div style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: tokens.ink,
            color: tokens.gold,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(14,21,36,0.15)"
          }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{
                margin: 0,
                fontFamily: tokens.fontDisplay,
                fontSize: 22,
                fontWeight: 700,
                color: tokens.ink
              }}>
                Monitor Financiero
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                background: tokens.goldSoft,
                color: tokens.gold,
                padding: "2px 8px",
                borderRadius: 4
              }}>
                Tablero de Control
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: tokens.textMuted }}>
              Situación actual de caja, proyección de ingresos/egresos y necesidad de caja mensual, valuación consolidada de stock e indicadores de mercado.
            </p>
          </div>
        </div>

        {/* CONTROLES DE EJERCICIO Y MONEDA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <div
            className="horizontal-scroll-menu"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 6,
              width: "100%",
              maxWidth: "100%"
            }}
          >
            {/* Selector de Moneda */}
            <div style={{ display: "flex", alignItems: "center", background: "#F1F5F9", borderRadius: 8, padding: 3, flexShrink: 0 }}>
              <button
                onClick={() => setMoneda("ARS")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  background: moneda === "ARS" ? "#FFFFFF" : "transparent",
                  color: moneda === "ARS" ? tokens.ink : tokens.textMuted,
                  boxShadow: moneda === "ARS" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                $ Pesos (ARS)
              </button>
              <button
                onClick={() => setMoneda("USD")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  background: moneda === "USD" ? tokens.gold : "transparent",
                  color: moneda === "USD" ? "#FFFFFF" : tokens.textMuted,
                  boxShadow: moneda === "USD" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                U$D Dólares
              </button>
            </div>

            {/* Selector de Ejercicio */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, borderLeft: `1px solid ${colorLineaSuave}`, paddingLeft: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Plan:</span>
              {["2027", "2026"].map((y) => (
                <button
                  key={y}
                  onClick={() => setEjercicio(y)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: `1px solid ${ejercicio === y ? tokens.gold : colorLineaSuave}`,
                    background: ejercicio === y ? tokens.goldSoft : "#FFFFFF",
                    color: ejercicio === y ? tokens.gold : tokens.textMuted,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Indicador TC de Referencia */}
            <div style={{
              fontSize: 11.5,
              color: tokens.textMuted,
              background: "#F8FAFC",
              border: `1px solid ${colorLineaSuave}`,
              padding: "5px 10px",
              borderRadius: 6,
              fontFamily: tokens.fontMono,
              flexShrink: 0
            }}>
              TC Ref: <strong>${fmt(tcReferencia)}</strong>
            </div>

            {/* Verificación de planilla oficial */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              padding: "5px 11px",
              borderRadius: 6,
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              color: "#166534",
              fontWeight: 600,
              flexShrink: 0
            }}>
              <span>
                ✓ Presupuesto {ejercicio} (${fmt(metricasPlan.rawTotalIng / 1_000_000)}M Ing · ${fmt(metricasPlan.rawTotalEg / 1_000_000)}M Egr · {metricasPlan.rawBalanceNeto >= 0 ? "+" : ""}${fmt(metricasPlan.rawBalanceNeto / 1_000_000)}M Neto)
              </span>
            </div>
          </div>

          {/* BARRA DE NAVEGACIÓN RÁPIDA POR CUADROS */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ir a:</span>
            <a href="#cuadro-caja" style={{ textDecoration: "none", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: "#F1F5F9", color: tokens.ink }}>1. Caja</a>
            <a href="#cuadro-necesidad" style={{ textDecoration: "none", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: "#F1F5F9", color: tokens.ink }}>2. Necesidad de Caja</a>
            <a href="#cuadro-stock" style={{ textDecoration: "none", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: "#F1F5F9", color: tokens.ink }}>3. Stock & Valuación</a>
            <a href="#cuadro-ritmo" style={{ textDecoration: "none", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Target size={12} color="#B45309" /> 4. Ritmo de Venta ($ y Unidades)
            </a>
            <a href="#cuadro-mercado" style={{ textDecoration: "none", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: "#F1F5F9", color: tokens.ink }}>5. Indicadores Macro</a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 1: SITUACIÓN ACTUAL (POSICIÓN DE CAJA Y LIQUIDEZ)
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="cuadro-caja" style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: tokens.gold }} />
            <h2 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: tokens.ink,
              fontFamily: tokens.fontBody,
              letterSpacing: "0.2px"
            }}>
              1. Situación Actual · Posición de Caja & Tesorería
            </h2>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>
              (Corte al {formatDate(situacionActual.fechaCorte)})
            </span>
          </div>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab("movimientos")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${colorLineaSuave}`,
                background: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                color: tokens.ink,
                cursor: "pointer"
              }}
            >
              Registrar Arqueo / Ver Movimientos <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* TARJETAS KPI DE SITUACIÓN ACTUAL */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14
        }}>
          {/* Liquidez Consolidada */}
          <div style={{
            background: `linear-gradient(135deg, ${tokens.ink} 0%, #1A253E 100%)`,
            color: "#FFFFFF",
            borderRadius: 10,
            padding: "16px 18px",
            boxShadow: "0 4px 12px rgba(14,21,36,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.gold }}>
                Liquidez Total Consolidada
              </span>
              <Wallet size={16} color={tokens.gold} />
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
              {moneda === "USD" ? `U$D ${fmt(situacionActual.liquidezUSD)}` : `$ ${fmt(situacionActual.liquidezARS)}`}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, fontFamily: tokens.fontMono }}>
              {moneda === "USD" ? `Equiv. $ ${fmt(situacionActual.liquidezARS)} ARS` : `Equiv. U$D ${fmt(situacionActual.liquidezUSD)} USD`}
            </div>
          </div>

          {/* Saldo en Bancos */}
          <div style={{
            background: "#F8FAFC",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.textMuted }}>
                Saldo en Bancos (ARS)
              </span>
              <Building2 size={16} color="#64748B" />
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 700, color: tokens.ink }}>
              $ {fmt(situacionActual.saldoBanco)}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4, fontFamily: tokens.fontMono }}>
              U$D {fmt(situacionActual.saldoBancoUSD)} USD
            </div>
          </div>

          {/* Saldo en Efectivo / Tesorería */}
          <div style={{
            background: "#F8FAFC",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: tokens.textMuted }}>
                Saldo en Efectivo (Caja)
              </span>
              <DollarSign size={16} color="#64748B" />
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 700, color: tokens.ink }}>
              $ {fmt(situacionActual.saldoEfectivo)}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4, fontFamily: tokens.fontMono }}>
              U$D {fmt(situacionActual.saldoEfectivoUSD)} USD
            </div>
          </div>

          {/* Días de Caja / Runway */}
          <div style={{
            background: situacionActual.deficitActual ? "#FEF2F2" : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${situacionActual.deficitActual ? "#FECACA" : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) ? "#BBF7D0" : colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: situacionActual.deficitActual ? tokens.negative : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) ? tokens.positive : tokens.textMuted
              }}>
                Runway · Días de Caja
              </span>
              <Calendar size={16} color={situacionActual.deficitActual ? tokens.negative : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) ? tokens.positive : "#64748B"} />
            </div>
            <div style={{
              fontFamily: tokens.fontMono,
              fontSize: 20,
              fontWeight: 800,
              color: situacionActual.deficitActual ? tokens.negative : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) ? tokens.positive : tokens.ink
            }}>
              {situacionActual.deficitActual 
                ? "En Déficit" 
                : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) 
                  ? "Sin déficit próx 90 días" 
                  : `${situacionActual.diasDeCaja} días`}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
              {situacionActual.deficitActual 
                ? "Saldo inicial negativo" 
                : (situacionActual.sinQuemaNeta || (situacionActual.diasDeCaja != null && situacionActual.diasDeCaja > 90)) 
                  ? "Superávit de caja proyectado para los próximos 90 días" 
                  : `Pico de déficit: ${formatDate(situacionActual.diaDeficit)}`}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 2: INGRESOS, EGRESOS & NECESIDAD DE CAJA MENSUAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="cuadro-necesidad" style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />
              <h2 style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.ink,
                fontFamily: tokens.fontBody,
                letterSpacing: "0.2px"
              }}>
                2. Ingresos, Egresos & Necesidad de Caja Mensual
              </h2>
              <span style={{ fontSize: 12, color: tokens.textMuted }}>
                (Presupuesto {ejercicio} · {moneda === "USD" ? "Cifras en U$D Dólares" : "Cifras en $ ARS"})
              </span>
            </div>
            <p style={{ margin: "4px 0 0 18px", fontSize: 12.5, color: tokens.textMuted }}>
              Análisis dinámico de cobranzas proyectadas, curva de erogaciones de obra/estructura y brecha mensual que requiere fondeo de capital.
            </p>
          </div>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab("presupuesto")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${colorLineaSuave}`,
                background: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                color: tokens.ink,
                cursor: "pointer"
              }}
            >
              Ver Matriz Completa en Presupuesto Anual <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* METRICAS EJECUTIVAS DE CAJA */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20
        }}>
          {/* Total Ingresos */}
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Total Ingresos Proyectados</div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 800, color: "#166534", marginTop: 4 }}>
              {moneda === "USD" ? "U$D " : "$ "}{fmt(metricasPlan.totalIng)}
            </div>
            <div style={{ fontSize: 10.5, color: "#15803D", marginTop: 2 }}>Cobranzas y ventas {ejercicio}</div>
          </div>

          {/* Total Egresos */}
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase" }}>Total Egresos Proyectados</div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 800, color: "#991B1B", marginTop: 4 }}>
              {moneda === "USD" ? "U$D " : "$ "}{fmt(metricasPlan.totalEg)}
            </div>
            <div style={{ fontSize: 10.5, color: "#B91C1C", marginTop: 2 }}>Obras, estructura y cupos</div>
          </div>

          {/* Balance Neto */}
          <div style={{
            background: metricasPlan.balanceNeto >= 0 ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${metricasPlan.balanceNeto >= 0 ? "#BBF7D0" : "#FECACA"}`,
            borderRadius: 8,
            padding: "12px 16px"
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: metricasPlan.balanceNeto >= 0 ? "#166534" : "#991B1B",
              textTransform: "uppercase"
            }}>
              Balance Neto Anual
            </div>
            <div style={{
              fontFamily: tokens.fontMono,
              fontSize: 18,
              fontWeight: 800,
              color: metricasPlan.balanceNeto >= 0 ? "#166534" : "#991B1B",
              marginTop: 4
            }}>
              {metricasPlan.balanceNeto >= 0 ? "+" : ""}{moneda === "USD" ? "U$D " : "$ "}{fmt(metricasPlan.balanceNeto)}
            </div>
            <div style={{ fontSize: 10.5, color: metricasPlan.balanceNeto >= 0 ? "#15803D" : "#B91C1C", marginTop: 2 }}>
              {metricasPlan.balanceNeto >= 0 ? "Superávit anual proyectado" : "Déficit anual a financiar"}
            </div>
          </div>

          {/* Necesidad de Caja Máxima (Pico de Quema) */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase" }}>Mes Más Crítico (Pico Déficit)</div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 800, color: "#B45309", marginTop: 4 }}>
              {metricasPlan.mesPico ? `${metricasPlan.mesPico.mesFull}` : "Sin déficit"}
            </div>
            <div style={{ fontSize: 10.5, color: "#92400E", marginTop: 2 }}>
              {metricasPlan.mesPico ? `Brecha: ${moneda === "USD" ? "U$D " : "$ "}${fmt(metricasPlan.mesPico.necesidadCaja)}` : "Todos los meses positivos"}
            </div>
          </div>
        </div>

        {/* TABLA MENSUAL: INGRESOS, EGRESOS Y NECESIDAD DE CAJA */}
        <div className="table-container" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "right" }}>
            <thead>
              <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700 }}>Concepto / Mes</th>
                {datosMensuales.map(m => (
                  <th key={m.mesId} style={{ padding: "10px 12px", fontWeight: 700, minWidth: 85 }}>{m.mes}</th>
                ))}
                <th style={{ padding: "10px 14px", fontWeight: 800, color: tokens.ink, background: "#E2E8F0" }}>Total {ejercicio}</th>
              </tr>
            </thead>
            <tbody>
              {/* FILA: INGRESOS */}
              <tr style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: tokens.positive }}>
                  (+) Ingresos Proyectados
                </td>
                {datosMensuales.map(m => (
                  <td key={m.mesId} style={{ padding: "10px 12px", fontFamily: tokens.fontMono, color: tokens.positive, fontWeight: 600 }}>
                    {fmt(m.ingresos)}
                  </td>
                ))}
                <td style={{ padding: "10px 14px", fontFamily: tokens.fontMono, fontWeight: 800, color: tokens.positive, background: "#F8FAFC" }}>
                  {fmt(metricasPlan.totalIng)}
                </td>
              </tr>

              {/* FILA: EGRESOS */}
              <tr style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: tokens.negative }}>
                  (-) Egresos Proyectados
                </td>
                {datosMensuales.map(m => (
                  <td key={m.mesId} style={{ padding: "10px 12px", fontFamily: tokens.fontMono, color: tokens.negative, fontWeight: 600 }}>
                    {fmt(m.egresos)}
                  </td>
                ))}
                <td style={{ padding: "10px 14px", fontFamily: tokens.fontMono, fontWeight: 800, color: tokens.negative, background: "#F8FAFC" }}>
                  {fmt(metricasPlan.totalEg)}
                </td>
              </tr>

              {/* FILA: FLUJO NETO MENSUAL */}
              <tr style={{ borderBottom: `2px solid ${colorLineaFuerte}`, background: "#F8FAFC" }}>
                <td style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, color: tokens.ink }}>
                  (=) Flujo Neto Mensual
                </td>
                {datosMensuales.map(m => (
                  <td
                    key={m.mesId}
                    style={{
                      padding: "10px 12px",
                      fontFamily: tokens.fontMono,
                      fontWeight: 700,
                      color: m.flujoNeto >= 0 ? tokens.positive : tokens.negative,
                      background: m.flujoNeto < 0 ? "#FEF2F2" : "transparent"
                    }}
                  >
                    {m.flujoNeto >= 0 ? `+${fmt(m.flujoNeto)}` : fmt(m.flujoNeto)}
                  </td>
                ))}
                <td style={{
                  padding: "10px 14px",
                  fontFamily: tokens.fontMono,
                  fontWeight: 800,
                  color: metricasPlan.balanceNeto >= 0 ? tokens.positive : tokens.negative,
                  background: "#E2E8F0"
                }}>
                  {metricasPlan.balanceNeto >= 0 ? `+${fmt(metricasPlan.balanceNeto)}` : fmt(metricasPlan.balanceNeto)}
                </td>
              </tr>

              {/* FILA: NECESIDAD DE CAJA MENSUAL (GAP DE FONDOS) */}
              <tr style={{ background: "#FFFBEB", borderBottom: `1px solid #FDE68A` }}>
                <td style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, color: "#92400E" }}>
                  ⚠ Necesidad de Caja (Déficit a Financiar)
                </td>
                {datosMensuales.map(m => (
                  <td
                    key={m.mesId}
                    style={{
                      padding: "10px 12px",
                      fontFamily: tokens.fontMono,
                      fontWeight: 800,
                      color: m.necesidadCaja > 0 ? "#DC2626" : "#166534"
                    }}
                  >
                    {m.necesidadCaja > 0 ? `-$ ${fmt(m.necesidadCaja)}` : "Cubierto ✓"}
                  </td>
                ))}
                <td style={{ padding: "10px 14px", fontFamily: tokens.fontMono, fontWeight: 800, color: "#DC2626", background: "#FEF3C7" }}>
                  -$ {fmt(metricasPlan.totalNecesidadCaja)}
                </td>
              </tr>

              {/* FILA: SALDO ACUMULADO DEL PRESUPUESTO (COINCIDE EXACTO CON LA PLANILLA) */}
              <tr style={{ background: tokens.ink, color: "#FFFFFF" }}>
                <td style={{ textAlign: "left", padding: "11px 14px", fontWeight: 700, color: "#FFFFFF" }}>
                  Saldo Acumulado en el Año ({ejercicio})
                </td>
                {datosMensuales.map(m => (
                  <td key={m.mesId} style={{ padding: "11px 12px", fontFamily: tokens.fontMono, fontWeight: 700, color: m.saldoAcumulado >= 0 ? "#86EFAC" : "#FCA5A5" }}>
                    {m.saldoAcumulado >= 0 ? `+${fmt(m.saldoAcumulado)}` : fmt(m.saldoAcumulado)}
                  </td>
                ))}
                <td style={{ padding: "11px 14px", fontFamily: tokens.fontMono, fontWeight: 800, color: metricasPlan.balanceNeto >= 0 ? "#86EFAC" : "#FCA5A5", background: "#0B1120" }}>
                  {metricasPlan.balanceNeto >= 0 ? `+${fmt(metricasPlan.balanceNeto)}` : fmt(metricasPlan.balanceNeto)}
                </td>
              </tr>

              {/* FILA COMPLEMENTARIA: POSICIÓN DE CAJA CON LIQUIDEZ INICIAL DE TESORERÍA */}
              <tr style={{ background: "#0F172A", color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={{ textAlign: "left", padding: "9px 14px", fontSize: 11, color: "#CBD5E1", fontWeight: 600 }}>
                  💼 Proyección con Caja Inicial ({moneda === "USD" ? "U$D " : "$ "}{fmt(situacionActual.liquidezARS / (moneda === "USD" ? (tcReferencia || 1) : 1))})
                </td>
                {datosMensuales.map(m => (
                  <td key={m.mesId} style={{ padding: "9px 12px", fontFamily: tokens.fontMono, fontSize: 11, color: m.saldoConCajaInicial >= 0 ? "#93C5FD" : "#FCA5A5" }}>
                    {fmt(m.saldoConCajaInicial)}
                  </td>
                ))}
                <td style={{ padding: "9px 14px", fontFamily: tokens.fontMono, fontSize: 11, fontWeight: 700, color: "#FDE68A", background: "#020617" }}>
                  {fmt(datosMensuales[datosMensuales.length - 1]?.saldoConCajaInicial || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* GRÁFICO COMBINADO MENSUAL: INGRESOS, EGRESOS & FLUJO NETO */}
        <div style={{ height: 260, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datosMensuales} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={{ stroke: "#CBD5E1" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={{ stroke: "#CBD5E1" }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                formatter={(val, name) => [
                  `${moneda === "USD" ? "U$D " : "$ "}${fmt(val)}`,
                  name === "saldoAcumulado"
                    ? "Saldo Caja Acumulado"
                    : name === "ingresos"
                    ? "Ingresos Proyectados"
                    : name === "egresos"
                    ? "Egresos Proyectados"
                    : "Flujo Neto"
                ]}
                contentStyle={{ background: "#FFFFFF", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, fontSize: 12 }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="saldoAcumulado" name="Saldo Caja Acumulado" fill="#38BDF8" fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={30}>
                {datosMensuales.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.saldoAcumulado >= 0 ? "#38BDF8" : "#F87171"} fillOpacity={0.75} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="ingresos" name="Ingresos Proyectados" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981" }} />
              <Line type="monotone" dataKey="egresos" name="Egresos Proyectados" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, fill: "#EF4444" }} />
              <Line type="monotone" dataKey="flujoNeto" name="Flujo Neto Mensual" stroke={tokens.gold} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: tokens.gold }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 3: STOCK DE UNIDADES POR PROYECTO, VALUACIÓN & VALUACIÓN TOTAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="cuadro-stock" style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
              <h2 style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.ink,
                fontFamily: tokens.fontBody,
                letterSpacing: "0.2px"
              }}>
                3. Stock de Unidades por Proyecto & Valuación Total
              </h2>
              <span style={{ fontSize: 12, color: tokens.textMuted }}>
                (Inventario Inmobiliario Link · {stockPorProyecto.totalUnits} unidades)
              </span>
            </div>
            <p style={{ margin: "4px 0 0 18px", fontSize: 12.5, color: tokens.textMuted }}>
              Valuación de mercado consolidada del stock disponible y reservado por cada desarrollo inmobiliario.
            </p>
          </div>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab("stock")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${colorLineaSuave}`,
                background: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                color: tokens.ink,
                cursor: "pointer"
              }}
            >
              Gestionar Inventario / Ver Stock Detallado <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* TARJETAS KPI DE VALUACIÓN TOTAL DEL STOCK */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
          marginBottom: 20
        }}>
          {/* Valuación Total USD */}
          <div style={{
            background: `linear-gradient(135deg, ${tokens.gold} 0%, #946C1A 100%)`,
            color: "#FFFFFF",
            borderRadius: 10,
            padding: "16px 18px",
            boxShadow: "0 4px 12px rgba(184, 134, 42, 0.25)"
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", opacity: 0.9 }}>
              Valuación Total del Stock (USD)
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              U$D {fmt(stockPorProyecto.totalValUSD)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4, fontFamily: tokens.fontMono }}>
              Equivalente: $ {fmt(stockPorProyecto.totalValARS)} ARS
            </div>
          </div>

          {/* Unidades Totales & Disponibles */}
          <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
              Unidades en Cartera
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, color: tokens.ink, marginTop: 4 }}>
              {stockPorProyecto.totalUnits} <span style={{ fontSize: 13, fontWeight: 500, color: tokens.textMuted }}>unidades</span>
            </div>
            <div style={{ fontSize: 11, color: tokens.positive, fontWeight: 600, marginTop: 4 }}>
              {stockPorProyecto.totalDisponibles} Disponibles · {stockPorProyecto.totalReservadas} Reservadas
            </div>
          </div>

          {/* Metros Cuadrados Vendibles */}
          <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
              Superficie Total Vendible
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, color: tokens.ink, marginTop: 4 }}>
              {fmt(stockPorProyecto.totalM2)} <span style={{ fontSize: 13, fontWeight: 500, color: tokens.textMuted }}>m²</span>
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4, fontFamily: tokens.fontMono }}>
              Promedio: U$D {fmt(stockPorProyecto.precioM2PromedioUSD)} / m²
            </div>
          </div>

          {/* Ticket Promedio */}
          <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
              Ticket Promedio por Unidad
            </div>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, color: tokens.ink, marginTop: 4 }}>
              U$D {fmt(stockPorProyecto.ticketPromedioUSD)}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4, fontFamily: tokens.fontMono }}>
              $ {fmt(stockPorProyecto.ticketPromedioUSD * tcReferencia)} ARS
            </div>
          </div>
        </div>

        {/* TABLA DE VALUACIÓN DE STOCK POR PROYECTO */}
        <div className="table-container" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y", border: `1px solid ${colorLineaSuave}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted }}>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Proyecto Inmobiliario</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700 }}>Unidades Stock</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700 }}>Disponibles</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700 }}>Reservadas</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Superficie (m²)</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Precio Prom. m²</th>
                <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 800, color: tokens.ink }}>Valuación (USD)</th>
                <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 700 }}>Valuación (ARS)</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700, minWidth: 140 }}>% Cartera</th>
              </tr>
            </thead>
            <tbody>
              {stockPorProyecto.proyectos.map((p) => (
                <tr key={p.proyecto} style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: tokens.ink }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={15} color={tokens.gold} />
                      {p.proyecto}
                    </div>
                  </td>
                  <td style={{ textAlign: "center", padding: "12px", fontFamily: tokens.fontMono, fontWeight: 700 }}>
                    {p.totalUnidades}
                  </td>
                  <td style={{ textAlign: "center", padding: "12px", fontFamily: tokens.fontMono, color: tokens.positive, fontWeight: 700 }}>
                    {p.disponibles}
                  </td>
                  <td style={{ textAlign: "center", padding: "12px", fontFamily: tokens.fontMono, color: "#D97706", fontWeight: 600 }}>
                    {p.reservadas}
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 14px", fontFamily: tokens.fontMono }}>
                    {fmt(p.m2Totales)} m²
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 14px", fontFamily: tokens.fontMono, color: tokens.textMuted }}>
                    U$D {fmt(p.precioM2USD)}
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: tokens.fontMono, fontWeight: 800, color: tokens.gold }}>
                    U$D {fmt(p.valuacionUSD)}
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: tokens.fontMono, fontWeight: 600, color: tokens.ink }}>
                    $ {fmt(p.valuacionARS)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${p.pctTotal}%`, height: "100%", background: tokens.gold }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.textMuted, width: 38, textAlign: "right" }}>
                        {p.pctTotal.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {/* FILA TOTAL CONSOLIDADO */}
              <tr style={{ background: colorTablaBg, fontWeight: 800, borderTop: `2px solid ${colorLineaFuerte}` }}>
                <td style={{ padding: "14px 16px", color: tokens.ink }}>TOTAL CARTERA DISPONIBLE</td>
                <td style={{ textAlign: "center", padding: "14px 12px", fontFamily: tokens.fontMono }}>{stockPorProyecto.totalUnits}</td>
                <td style={{ textAlign: "center", padding: "14px 12px", fontFamily: tokens.fontMono, color: tokens.positive }}>{stockPorProyecto.totalDisponibles}</td>
                <td style={{ textAlign: "center", padding: "14px 12px", fontFamily: tokens.fontMono, color: "#D97706" }}>{stockPorProyecto.totalReservadas}</td>
                <td style={{ textAlign: "right", padding: "14px 14px", fontFamily: tokens.fontMono }}>{fmt(stockPorProyecto.totalM2)} m²</td>
                <td style={{ textAlign: "right", padding: "14px 14px", fontFamily: tokens.fontMono }}>U$D {fmt(stockPorProyecto.precioM2PromedioUSD)}</td>
                <td style={{ textAlign: "right", padding: "14px 16px", fontFamily: tokens.fontMono, color: tokens.gold, fontSize: 14 }}>
                  U$D {fmt(stockPorProyecto.totalValUSD)}
                </td>
                <td style={{ textAlign: "right", padding: "14px 16px", fontFamily: tokens.fontMono, color: tokens.ink, fontSize: 14 }}>
                  $ {fmt(stockPorProyecto.totalValARS)}
                </td>
                <td style={{ padding: "14px 16px", fontFamily: tokens.fontMono }}>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 4: RITMO DE VENTA REQUERIDO EN $ Y UNIDADES (ABSORCIÓN DE OBRA)
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="cuadro-ritmo" style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 20
      }}>
        {/* ENCABEZADO Y CONTROLES DEL INDICADOR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#FEF3C7",
              color: tokens.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2
            }}>
              <Target size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: tokens.ink,
                  fontFamily: tokens.fontBody,
                  letterSpacing: "-0.2px"
                }}>
                  4. Ritmo de Venta Requerido en $ y Unidades (Absorción de Obra)
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "#ECFDF5",
                  color: tokens.positive,
                  border: "1px solid #A7F3D0"
                }}>
                  Autofinanciamiento de Obras
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: tokens.textMuted }}>
                Cálculo de facturación y unidades mensuales requeridas para cubrir el saldo del presupuesto de obra y completar la construcción en el plazo previsto.
              </p>
            </div>
          </div>

          {/* BARRA DE ACCIONES Y NAVEGACIÓN RÁPIDA */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            {onNavigateToTab && (
              <>
                <button
                  onClick={() => onNavigateToTab("proyectos")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: "#FFFFFF",
                    color: tokens.ink,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  title="Ver detalle de saldos y curvas de obra"
                >
                  <HardHat size={14} color={tokens.gold} />
                  <span>Ver Obras</span>
                </button>
                <button
                  onClick={() => onNavigateToTab("stock")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: "#FFFFFF",
                    color: tokens.ink,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  title="Ver inventario de unidades y tipologías"
                >
                  <Building2 size={14} color="#2563EB" />
                  <span>Ver Stock</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* FILTROS Y SIMULADOR DE CONDICIONES COMERCIALES */}
        <div style={{
          background: colorTablaBg,
          border: `1px solid ${colorLineaSuave}`,
          borderRadius: 8,
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>
          {/* LÍNEA 1: FECHA DE HOY (CORTE) Y CRITERIO DE PLAZO */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* Fecha de Hoy / Corte */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={14} color="#2563EB" /> Fecha de Hoy (Corte):
              </span>
              <div style={{ display: "inline-flex", background: "#FFFFFF", padding: 2, borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                <button
                  onClick={() => setFechaHoyCorte("2026-11")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: fechaHoyCorte === "2026-11" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: fechaHoyCorte === "2026-11" ? "#2563EB" : "transparent",
                    color: fechaHoyCorte === "2026-11" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Mes actual del sistema (Noviembre 2026)"
                >
                  Nov 2026 (Hoy)
                </button>
                <button
                  onClick={() => setFechaHoyCorte("2026-12")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: fechaHoyCorte === "2026-12" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: fechaHoyCorte === "2026-12" ? "#2563EB" : "transparent",
                    color: fechaHoyCorte === "2026-12" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Corte a Diciembre 2026"
                >
                  Dic 2026
                </button>
                <button
                  onClick={() => setFechaHoyCorte("2027-01")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: fechaHoyCorte === "2027-01" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: fechaHoyCorte === "2027-01" ? "#2563EB" : "transparent",
                    color: fechaHoyCorte === "2027-01" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Corte a Enero 2027 (Inicio de Plan Anual)"
                >
                  Ene 2027 (Plan)
                </button>
              </div>
              <input
                type="month"
                value={fechaHoyCorte}
                onChange={(e) => {
                  if (e.target.value) setFechaHoyCorte(e.target.value);
                }}
                style={{
                  fontSize: 11,
                  fontFamily: tokens.fontMono,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: `1px solid ${colorLineaFuerte}`,
                  background: "#FFFFFF",
                  color: tokens.ink,
                  outline: "none",
                  cursor: "pointer"
                }}
                title="Seleccionar cualquier mes de corte para simular"
              />
            </div>

            {/* Criterio de Plazo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={14} color={tokens.gold} /> Criterio de Plazo:
              </span>
              <div style={{ display: "inline-flex", background: "#FFFFFF", padding: 2, borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                <button
                  onClick={() => setCriterioRitmo("plazo_restante")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: criterioRitmo === "plazo_restante" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: criterioRitmo === "plazo_restante" ? tokens.ink : "transparent",
                    color: criterioRitmo === "plazo_restante" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Calcula sobre los meses restantes reales desde la fecha de hoy hasta la fecha de fin de obra"
                >
                  Plazo Restante desde Hoy (Recomendado)
                </button>
                <button
                  onClick={() => setCriterioRitmo("curva_futura")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: criterioRitmo === "curva_futura" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: criterioRitmo === "curva_futura" ? tokens.ink : "transparent",
                    color: criterioRitmo === "curva_futura" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Calcula sobre los meses futuros con desembolso programado en la curva de obra"
                >
                  Curva Desembolsos Futura
                </button>
                <button
                  onClick={() => setCriterioRitmo("anio_presupuesto")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: criterioRitmo === "anio_presupuesto" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: criterioRitmo === "anio_presupuesto" ? tokens.ink : "transparent",
                    color: criterioRitmo === "anio_presupuesto" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Calcula sobre los meses con desembolso en el ejercicio anual presupuestado"
                >
                  Curva Anual {ejercicio}
                </button>
                <button
                  onClick={() => setCriterioRitmo("plazo_total")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: criterioRitmo === "plazo_total" ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: criterioRitmo === "plazo_total" ? tokens.ink : "transparent",
                    color: criterioRitmo === "plazo_total" ? "#FFFFFF" : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="Duración total nominal histórica de obra (desde inicio de obra)"
                >
                  Duración Total Nominal
                </button>
              </div>
            </div>
          </div>

          {/* LÍNEA 2: ANTICIPO COMERCIAL Y FILTRO PROYECTO */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 4, borderTop: `1px solid ${colorLineaSuave}` }}>
            {/* Simulador de Anticipo al Boleto */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                <SlidersHorizontal size={14} /> Anticipo Comercial al Boleto:
              </span>
              <div style={{ display: "inline-flex", background: "#FFFFFF", padding: 2, borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                <button
                  onClick={() => setPctAnticipoSimulado(100)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: pctAnticipoSimulado === 100 ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: pctAnticipoSimulado === 100 ? tokens.gold : "transparent",
                    color: pctAnticipoSimulado === 100 ? tokens.ink : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="100% de valor unitario ingresado"
                >
                  100% Contado / Cuotas
                </button>
                <button
                  onClick={() => setPctAnticipoSimulado(50)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: pctAnticipoSimulado === 50 ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: pctAnticipoSimulado === 50 ? tokens.gold : "transparent",
                    color: pctAnticipoSimulado === 50 ? tokens.ink : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="50% de anticipo inicial al boleto"
                >
                  50% Anticipo
                </button>
                <button
                  onClick={() => setPctAnticipoSimulado(30)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: pctAnticipoSimulado === 30 ? 700 : 500,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: pctAnticipoSimulado === 30 ? tokens.gold : "transparent",
                    color: pctAnticipoSimulado === 30 ? tokens.ink : tokens.textMuted,
                    transition: "all 0.15s"
                  }}
                  title="30% de anticipo inicial al boleto"
                >
                  30% Anticipo
                </button>
              </div>
            </div>

            {/* Filtro Proyecto */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted }}>Filtrar Proyecto:</span>
              <select
                value={filtroProyectoRitmo}
                onChange={(e) => setFiltroProyectoRitmo(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${colorLineaFuerte}`,
                  background: "#FFFFFF",
                  color: tokens.ink,
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="todos">Todos los Proyectos (Consolidado)</option>
                {ritmoVentaAnalisis.proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TARJETAS DE KPIS PRINCIPALES DE RITMO */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16
        }}>
          {/* KPI 1: RITMO REQUERIDO EN $ */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px",
            borderLeft: `4px solid ${tokens.gold}`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Ritmo Requerido en $ / Mes
              </span>
              <DollarSign size={16} color={tokens.gold} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tokens.ink, fontFamily: tokens.fontMono }}>
              {moneda === "USD"
                ? `U$D ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCostoMensualUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.costoMensualElegidoUSD || 0))}`
                : `$ ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCostoMensualARS : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.costoMensualElegidoARS || 0))}`
              }
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              Costo medio mensual · {criterioRitmo === "plazo_restante" ? `Meses restantes desde ${fechaHoyCorte}` : criterioRitmo === "curva_futura" ? "Curva desembolsos futura" : criterioRitmo === "anio_presupuesto" ? `Curva ${ejercicio}` : "Plazo total nominal"}
            </div>
            <div style={{ fontSize: 11, color: tokens.ink, marginTop: 6, fontWeight: 600 }}>
              Saldo Obra: {moneda === "USD"
                ? `U$D ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSaldoObraUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.saldoObraUSD || 0))}`
                : `$ ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSaldoObraARS : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.saldoObraARS || 0))}`
              }
            </div>
          </div>

          {/* KPI 2: RITMO REQUERIDO EN UNIDADES */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px",
            borderLeft: `4px solid #2563EB`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Ritmo Requerido en Unidades
              </span>
              <HardHat size={16} color="#2563EB" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#2563EB", fontFamily: tokens.fontMono }}>
                {fmtNum(
                  filtroProyectoRitmo === "todos"
                    ? (pctAnticipoSimulado === 100 ? ritmoVentaAnalisis.totales.totalRitmoUnidadesMes : ritmoVentaAnalisis.totales.totalRitmoUnidadesConAnticipo)
                    : (pctAnticipoSimulado === 100
                        ? (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.ritmoUnidadesMes || 0)
                        : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.ritmoUnidadesConAnticipo || 0)),
                  1
                )}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: tokens.ink }}>unidades / mes</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              {pctAnticipoSimulado === 100 ? "Ventas al 100% valor de lista" : `Con anticipo comercial al ${pctAnticipoSimulado}%`}
            </div>
            <div style={{ fontSize: 11, color: tokens.ink, marginTop: 6, fontWeight: 600 }}>
              {pctAnticipoSimulado !== 100 && (
                <span style={{ color: "#D97706" }}>
                  (Al 100% de valor: {fmtNum(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalRitmoUnidadesMes : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.ritmoUnidadesMes || 0), 1)} u/mes)
                </span>
              )}
            </div>
          </div>

          {/* KPI 3: COBERTURA STOCK VS OBRA */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px",
            borderLeft: `4px solid ${
              (filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCoberturaPct : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.coberturaPct || 0)) >= 100 ? tokens.positive : "#D97706"
            }`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Cobertura Stock vs Obra
              </span>
              <Scale size={16} color={
                (filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCoberturaPct : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.coberturaPct || 0)) >= 100 ? tokens.positive : "#D97706"
              } />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{
                fontSize: 26,
                fontWeight: 800,
                color: (filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCoberturaPct : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.coberturaPct || 0)) >= 100 ? tokens.positive : "#D97706",
                fontFamily: tokens.fontMono
              }}>
                {fmtNum(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalCoberturaPct : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.coberturaPct || 0), 1)}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              Valuación Stock vs Saldo Presupuesto
            </div>
            <div style={{
              fontSize: 11,
              marginTop: 6,
              fontWeight: 700,
              color: (filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSuperavitUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.superavitUSD || 0)) >= 0 ? tokens.positive : "#DC2626"
            }}>
              {(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSuperavitUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.superavitUSD || 0)) >= 0
                ? `Superávit: U$D ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSuperavitUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.superavitUSD || 0))}`
                : `Brecha: U$D ${fmt(Math.abs(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalSuperavitUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.superavitUSD || 0)))} (a cubrir con preventas)`
              }
            </div>
          </div>

          {/* KPI 4: INVENTARIO & TICKET PROMEDIO */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px",
            borderLeft: `4px solid #8B5CF6`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Stock en Cartera & Ticket Prom.
              </span>
              <Building2 size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tokens.ink, fontFamily: tokens.fontMono }}>
              {filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalStockUnidades : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.stockUnidades || 0)} unidades
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
              Ticket Prom: {moneda === "USD"
                ? `U$D ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.ticketPromedioGlobalUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.ticketPromUSD || 0))}`
                : `$ ${fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.ticketPromedioGlobalARS : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.ticketPromARS || 0))}`
              }
            </div>
            <div style={{ fontSize: 11, color: tokens.ink, marginTop: 6, fontWeight: 600 }}>
              Valuación: U$D {fmt(filtroProyectoRitmo === "todos" ? ritmoVentaAnalisis.totales.totalStockValUSD : (ritmoVentaAnalisis.proyectos.find(p => p.id === filtroProyectoRitmo)?.stockValUSD || 0))}
            </div>
          </div>
        </div>

        {/* GRÁFICOS VISUALES DE RITMO Y COBERTURA */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: 16
        }}>
          {/* GRÁFICO 1: UNIDADES / MES POR PROYECTO */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={15} color={tokens.gold} />
                Ritmo Requerido por Proyecto (Unidades / Mes)
              </div>
              <span style={{ fontSize: 11, color: tokens.textMuted }}>
                {pctAnticipoSimulado === 100 ? "Base: 100% contado" : `Base: ${pctAnticipoSimulado}% anticipo`} · Corte: {fechaHoyCorte}
              </span>
            </div>
            <div style={{ width: "100%", height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ritmoVentaAnalisis.proyectos.filter(p => p.stockUnidades > 0)}
                  margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="nombre"
                    stroke={tokens.textMuted}
                    fontSize={11}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke={tokens.textMuted}
                    fontSize={11}
                    unit=" u"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: "#FFFFFF",
                          border: `1px solid ${colorLineaFuerte}`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          fontSize: 12
                        }}>
                          <div style={{ fontWeight: 800, color: tokens.ink, marginBottom: 4 }}>{d.nombre}</div>
                          <div style={{ color: tokens.textMuted }}>
                            Plazo restante: <strong style={{ color: tokens.ink }}>{d.mesesRestantesDesdeHoy} {d.mesesRestantesDesdeHoy === 1 ? "mes" : "meses"}</strong>
                          </div>
                          <div style={{ fontSize: 10.5, color: tokens.textMuted, marginBottom: 4 }}>
                            Fin de obra: {d.fecha_fin}
                          </div>
                          <div style={{ color: "#2563EB", fontWeight: 700 }}>
                            Ritmo (100%): {fmtNum(d.ritmoUnidadesMes, 2)} u / mes
                          </div>
                          {pctAnticipoSimulado !== 100 && (
                            <div style={{ color: tokens.gold, fontWeight: 700 }}>
                              Ritmo ({pctAnticipoSimulado}% anticipo): {fmtNum(d.ritmoUnidadesConAnticipo, 2)} u / mes
                            </div>
                          )}
                          <div style={{ color: tokens.textMuted, marginTop: 4 }}>
                            Costo mensual: U$D {fmt(d.costoMensualElegidoUSD)} / mes (${fmt(d.costoMensualElegidoARS)} / mes)
                          </div>
                          <div style={{ color: tokens.textMuted }}>
                            Stock disponible: {d.stockUnidades} unidades (U$D {fmt(d.stockValUSD)})
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={pctAnticipoSimulado === 100 ? "ritmoUnidadesMes" : "ritmoUnidadesConAnticipo"}
                    radius={[6, 6, 0, 0]}
                  >
                    {ritmoVentaAnalisis.proyectos.filter(p => p.stockUnidades > 0).map((entry) => (
                      <Cell key={`cell-${entry.id}`} fill={entry.color || tokens.gold} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: COMPARATIVA STOCK VS SALDO DE OBRA (U$D) */}
          <div style={{
            background: "#FFFFFF",
            border: `1px solid ${colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 6 }}>
                <Scale size={15} color="#2563EB" />
                Valuación Stock Disponible vs Saldo Obra (U$D)
              </div>
              <span style={{ fontSize: 11, color: tokens.textMuted }}>TC Ref: ${tcReferencia}</span>
            </div>
            <div style={{ width: "100%", height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ritmoVentaAnalisis.proyectos}
                  margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="nombre"
                    stroke={tokens.textMuted}
                    fontSize={11}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke={tokens.textMuted}
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: "#FFFFFF",
                          border: `1px solid ${colorLineaFuerte}`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          fontSize: 12
                        }}>
                          <div style={{ fontWeight: 800, color: tokens.ink, marginBottom: 4 }}>{d.nombre}</div>
                          <div style={{ color: "#2563EB", fontWeight: 700 }}>Stock Disponible: U$D {fmt(d.stockValUSD)}</div>
                          <div style={{ color: "#EF4444", fontWeight: 700 }}>Saldo Presupuesto: U$D {fmt(d.saldoObraUSD)}</div>
                          <div style={{
                            marginTop: 4,
                            fontWeight: 700,
                            color: d.superavitUSD >= 0 ? tokens.positive : "#DC2626"
                          }}>
                            {d.superavitUSD >= 0 ? `Superávit: +U$D ${fmt(d.superavitUSD)}` : `Déficit: -U$D ${fmt(Math.abs(d.superavitUSD))}`}
                          </div>
                          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                            Cobertura: {d.coberturaPct.toFixed(1)}% · Restan {d.mesesRestantesDesdeHoy} meses a fin de obra
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 11, paddingBottom: 6 }}
                  />
                  <Bar dataKey="stockValUSD" name="Stock Disp (U$D)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saldoObraUSD" name="Saldo Obra (U$D)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* TABLA ANALÍTICA DESGLOSADA POR PROYECTO */}
        <div style={{
          overflowX: "auto",
          border: `1px solid ${colorLineaSuave}`,
          borderRadius: 8
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            fontFamily: tokens.fontBody,
            background: "#FFFFFF"
          }}>
            <thead>
              <tr style={{ background: colorTablaBg, borderBottom: `2px solid ${colorLineaFuerte}`, color: tokens.textMuted }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700 }}>PROYECTO</th>
                <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 700 }}>
                  PLAZO RESTANTE (DESDE HOY)
                </th>
                <th style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700 }}>SALDO OBRA (ARS / U$D)</th>
                <th style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700 }}>COSTO OBRA / MES</th>
                <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 700 }}>STOCK DISP.</th>
                <th style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700 }}>TICKET PROM.</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontWeight: 800, color: tokens.gold, background: "#FEF3C7" }}>
                  RITMO REQ. ($/MES)
                </th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontWeight: 800, color: "#1D4ED8", background: "#DBEAFE" }}>
                  RITMO REQ. (U/MES)
                </th>
                <th style={{ textAlign: "center", padding: "12px 12px", fontWeight: 700 }}>COBERTURA</th>
                <th style={{ textAlign: "center", padding: "12px 14px", fontWeight: 700 }}>ESTADO & ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {ritmoVentaAnalisis.proyectos
                .filter(p => filtroProyectoRitmo === "todos" || p.id === filtroProyectoRitmo)
                .map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: `1px solid ${colorLineaSuave}`,
                      background: idx % 2 === 0 ? "#FFFFFF" : "#FCFDFF"
                    }}
                  >
                    {/* NOMBRE Y TIPOLOGÍA */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 4, height: 28, borderRadius: 2, background: p.color }} />
                        <div>
                          <div style={{ fontWeight: 700, color: tokens.ink, fontSize: 13 }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, color: tokens.textMuted }}>{p.tipologia} · {p.estadoObra}</div>
                        </div>
                      </div>
                    </td>

                    {/* PLAZO RESTANTE DESDE HOY Y FECHA FIN */}
                    <td style={{ textAlign: "center", padding: "12px 10px" }}>
                      <div style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: p.mesesRestantesDesdeHoy <= 2 ? "#FEF3C7" : "#F1F5F9",
                        color: p.mesesRestantesDesdeHoy <= 2 ? "#B45309" : tokens.ink,
                        fontWeight: 800,
                        fontSize: 12.5,
                        fontFamily: tokens.fontMono
                      }}>
                        {p.mesesPlazoElegido} {p.mesesPlazoElegido === 1 ? "mes" : "meses"}
                      </div>
                      <div style={{ fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                        Fin: <strong>{p.fecha_fin}</strong> {p.mesesRestantesDesdeHoy <= 2 ? "· Restan " + p.mesesRestantesDesdeHoy + "m" : `· ${p.mesesRestantesDesdeHoy}m restantes`}
                      </div>
                    </td>

                    {/* SALDO DE OBRA */}
                    <td style={{ textAlign: "right", padding: "12px 12px", fontFamily: tokens.fontMono }}>
                      <div style={{ fontWeight: 700, color: tokens.ink }}>
                        {moneda === "USD" ? `U$D ${fmt(p.saldoObraUSD)}` : `$ ${fmt(p.saldoObraARS)}`}
                      </div>
                      <div style={{ fontSize: 10, color: tokens.textMuted }}>
                        {moneda === "USD" ? `$ ${fmt(p.saldoObraARS)}` : `U$D ${fmt(p.saldoObraUSD)}`}
                      </div>
                    </td>

                    {/* COSTO OBRA / MES */}
                    <td style={{ textAlign: "right", padding: "12px 12px", fontFamily: tokens.fontMono }}>
                      <div style={{ fontWeight: 800, color: tokens.ink }}>
                        {moneda === "USD" ? `U$D ${fmt(p.costoMensualElegidoUSD)}` : `$ ${fmt(p.costoMensualElegidoARS)}`}
                      </div>
                      <div style={{ fontSize: 10, color: tokens.textMuted }}>
                        {p.etiquetaCriterio}
                      </div>
                    </td>

                    {/* STOCK DISPONIBLE */}
                    <td style={{ textAlign: "center", padding: "12px 10px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: p.stockUnidades > 0 ? "#EFF6FF" : "#F1F5F9",
                        color: p.stockUnidades > 0 ? "#1D4ED8" : "#94A3B8",
                        fontWeight: 700,
                        fontSize: 12
                      }}>
                        {p.stockUnidades} u.
                      </span>
                      {p.stockUnidades > 0 && (
                        <div style={{ fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                          {p.disponibles} disp · {p.reservadas} res
                        </div>
                      )}
                    </td>

                    {/* TICKET PROMEDIO */}
                    <td style={{ textAlign: "right", padding: "12px 12px", fontFamily: tokens.fontMono }}>
                      {p.stockUnidades > 0 ? (
                        <>
                          <div style={{ fontWeight: 600, color: tokens.ink }}>
                            {moneda === "USD" ? `U$D ${fmt(p.ticketPromUSD)}` : `$ ${fmt(p.ticketPromARS)}`}
                          </div>
                          <div style={{ fontSize: 10, color: tokens.textMuted }}>
                            Val: U$D {fmt(p.stockValUSD)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: tokens.textMuted, fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* RITMO REQUERIDO ($ / MES) */}
                    <td style={{
                      textAlign: "right",
                      padding: "12px 14px",
                      fontFamily: tokens.fontMono,
                      background: "#FEF3C7",
                      fontWeight: 800,
                      color: tokens.ink
                    }}>
                      <div>
                        {moneda === "USD" ? `U$D ${fmt(p.ritmoRequeridoUSD)}` : `$ ${fmt(p.ritmoRequeridoARS)}`}
                      </div>
                      <div style={{ fontSize: 10, color: tokens.textMuted }}>/ mes</div>
                    </td>

                    {/* RITMO REQUERIDO (UNIDADES / MES) */}
                    <td style={{
                      textAlign: "right",
                      padding: "12px 14px",
                      fontFamily: tokens.fontMono,
                      background: "#DBEAFE"
                    }}>
                      {p.stockUnidades > 0 ? (
                        <>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#1D4ED8" }}>
                            {fmtNum(pctAnticipoSimulado === 100 ? p.ritmoUnidadesMes : p.ritmoUnidadesConAnticipo, 2)} u / mes
                          </div>
                          {pctAnticipoSimulado !== 100 && (
                            <div style={{ fontSize: 10, color: "#D97706", fontWeight: 600 }}>
                              Base 100%: {fmtNum(p.ritmoUnidadesMes, 2)} u/m
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: tokens.textMuted, fontStyle: "italic" }}>
                          Obra vendida (cuotas)
                        </div>
                      )}
                    </td>

                    {/* COBERTURA STOCK / OBRA */}
                    <td style={{ textAlign: "center", padding: "12px 12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: 12,
                          color: p.coberturaPct >= 100 ? tokens.positive : (p.coberturaPct >= 50 ? "#D97706" : "#DC2626")
                        }}>
                          {p.saldoObraARS > 0 ? `${fmtNum(p.coberturaPct, 1)}%` : "N/A"}
                        </span>
                        <div style={{ width: 64, height: 5, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(100, p.coberturaPct)}%`,
                            height: "100%",
                            background: p.coberturaPct >= 100 ? tokens.positive : (p.coberturaPct >= 50 ? "#D97706" : "#DC2626")
                          }} />
                        </div>
                      </div>
                    </td>

                    {/* DIAGNÓSTICO / ESTADO */}
                    <td style={{ textAlign: "center", padding: "12px 14px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: p.estadoBg,
                        color: p.estadoColor,
                        border: `1px solid ${p.estadoBorder}`
                      }} title={p.detalleDiagnostico}>
                        {p.estadoBadge}
                      </span>
                    </td>
                  </tr>
                ))}

              {/* FILA CONSOLIDADA TOTAL CARTERA */}
              <tr style={{
                background: colorTablaBg,
                fontWeight: 800,
                borderTop: `2px solid ${colorLineaFuerte}`
              }}>
                <td style={{ padding: "14px", color: tokens.ink }}>
                  TOTAL CARTERA CONSOLIDADA
                </td>
                <td style={{ textAlign: "center", padding: "14px 10px", color: tokens.textMuted }}>
                  6 Obras (Corte {fechaHoyCorte})
                </td>
                <td style={{ textAlign: "right", padding: "14px 12px", fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {moneda === "USD" ? `U$D ${fmt(ritmoVentaAnalisis.totales.totalSaldoObraUSD)}` : `$ ${fmt(ritmoVentaAnalisis.totales.totalSaldoObraARS)}`}
                </td>
                <td style={{ textAlign: "right", padding: "14px 12px", fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {moneda === "USD" ? `U$D ${fmt(ritmoVentaAnalisis.totales.totalCostoMensualUSD)}` : `$ ${fmt(ritmoVentaAnalisis.totales.totalCostoMensualARS)}`}
                </td>
                <td style={{ textAlign: "center", padding: "14px 10px", fontFamily: tokens.fontMono, color: "#1D4ED8" }}>
                  {ritmoVentaAnalisis.totales.totalStockUnidades} u.
                </td>
                <td style={{ textAlign: "right", padding: "14px 12px", fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {moneda === "USD" ? `U$D ${fmt(ritmoVentaAnalisis.totales.ticketPromedioGlobalUSD)}` : `$ ${fmt(ritmoVentaAnalisis.totales.ticketPromedioGlobalARS)}`}
                </td>
                <td style={{
                  textAlign: "right",
                  padding: "14px",
                  fontFamily: tokens.fontMono,
                  color: tokens.gold,
                  fontSize: 13,
                  background: "#FEF3C7"
                }}>
                  {moneda === "USD" ? `U$D ${fmt(ritmoVentaAnalisis.totales.totalCostoMensualUSD)}` : `$ ${fmt(ritmoVentaAnalisis.totales.totalCostoMensualARS)}`}
                </td>
                <td style={{
                  textAlign: "right",
                  padding: "14px",
                  fontFamily: tokens.fontMono,
                  color: "#1D4ED8",
                  fontSize: 14,
                  background: "#DBEAFE"
                }}>
                  {fmtNum(pctAnticipoSimulado === 100 ? ritmoVentaAnalisis.totales.totalRitmoUnidadesMes : ritmoVentaAnalisis.totales.totalRitmoUnidadesConAnticipo, 1)} u / mes
                </td>
                <td style={{ textAlign: "center", padding: "14px 12px", fontFamily: tokens.fontMono, color: tokens.positive, fontSize: 13 }}>
                  {fmtNum(ritmoVentaAnalisis.totales.totalCoberturaPct, 1)}%
                </td>
                <td style={{ textAlign: "center", padding: "14px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    background: "#ECFDF5",
                    color: tokens.positive,
                    border: "1px solid #A7F3D0"
                  }}>
                    {ritmoVentaAnalisis.totales.totalCoberturaPct >= 80 ? "Cartera Solvente" : "Requiere Preventas"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* NOTA INTERPRETATIVA EJECUTIVA Y PAUTAS FINANCIERAS */}
        <div style={{
          background: "#F8FAFC",
          border: `1px solid ${colorLineaSuave}`,
          borderRadius: 8,
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12
        }}>
          <Info size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: tokens.ink, fontSize: 13 }}>Pautas de Absorción Financiera y Plazos Restantes:</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              <li>
                <strong>Cálculo desde la Fecha Actual:</strong> Las obras <strong>T2 (Torre 2)</strong> y <strong>Corporativo</strong> iniciaron en Diciembre 2024 y tienen fecha prevista de finalización en <strong>Diciembre 2026</strong>. Al tomar la fecha de corte actual (Noviembre 2026), <strong>restan únicamente 2 meses de ejecución</strong> (habiendo transcurrido 22 meses de los 24 nominales). Por tanto, para T2 el saldo restante de U$D 730k se distribuye en los 2 meses restantes (U$D 365k/mes), requiriendo un ritmo de <strong>3,15 u/mes</strong> sobre su inventario de 24 unidades (cobertura superavitaria del 381%).
              </li>
              <li>
                <strong>DUO (Fase Posesión):</strong> Inició en Diciembre 2024 con finalización en <strong>Noviembre 2026</strong> (1 mes restante / entrega). Al estar 100% vendido, el saldo de obra se cubre íntegramente mediante la cobranza de cuotas a clientes.
              </li>
              <li>
                <strong>Obras de Largo Plazo:</strong> <strong>Green</strong> (25 meses restantes hasta nov-28, ritmo 1,30 u/mes), <strong>+ DUO</strong> (31 meses restantes hasta may-29, ritmo 1,94 u/mes) y <strong>Auria</strong> (37 meses restantes hasta entrega en nov-29 con 29 meses de obra activa, ritmo 1,64 u/mes).
              </li>
              <li>
                <strong>Flexibilidad de Criterios:</strong> Utilice los selectores superiores para alternar entre el <em>Plazo Restante Real desde Hoy</em> (recomendado), la <em>Curva de Desembolsos Futura</em>, la <em>Curva Anual {ejercicio}</em> o la <em>Duración Total Nominal</em>.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 5: PRINCIPALES INDICADORES FINANCIEROS & ECONÓMICOS
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="cuadro-mercado" style={{
        background: "#FFFFFF",
        border: `1px solid ${colorLineaSuave}`,
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: tokens.gold }} />
            <h2 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: tokens.ink,
              fontFamily: tokens.fontBody,
              letterSpacing: "0.2px"
            }}>
              5. Principales Indicadores Financieros & Económicos
            </h2>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>
              (Índice Link Inversiones, Dólares en Vivo, Costo Construcción CAC y Macro)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={fetchDolares}
              disabled={loadingDolares}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${colorLineaSuave}`,
                background: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                color: tokens.textMuted,
                cursor: "pointer"
              }}
            >
              <RefreshCw size={13} className={loadingDolares ? "animate-spin" : ""} />
              Actualizar Dólares
            </button>
          </div>
        </div>

        {/* SUB-SECCIÓN: ÍNDICE LINK CORPORATIVO */}
        <div style={{
          background: "linear-gradient(135deg, #FEF9C3 0%, #FEF08A 100%)",
          border: `1px solid #FDE047`,
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: tokens.ink,
              color: tokens.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: tokens.ink }}>
                  Índice Link Inversiones
                </span>
                <span style={{ fontSize: 11, background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "2px 6px", borderRadius: 4, color: "#64748B", fontWeight: 700 }}>
                  Base 100 · Sincronizado Nube Supabase
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#713F12", marginTop: 3 }}>
                Indicador oficial para actualización de cuotas, contratos de inversión y valorización patrimonial de Link.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#854D0E", fontWeight: 700 }}>Último Valor Registrado</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 800, color: tokens.ink, marginTop: 2 }}>
                {ultimoIndiceLink ? `${fmtNum(ultimoIndiceLink.indice, 2)} pts` : "Sin cargar"}
              </div>
              {ultimoIndiceLink && (
                <div style={{ fontSize: 11, color: ultimoIndiceLink.varMensual >= 0 ? "#15803D" : "#B91C1C", fontWeight: 700 }}>
                  {ultimoIndiceLink.varMensual >= 0 ? `+${fmtNum(ultimoIndiceLink.varMensual, 2)}%` : `${fmtNum(ultimoIndiceLink.varMensual, 2)}%`} vs mes anterior
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={recargarTodo}
                disabled={actualizandoTodo}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 6,
                  background: "#F1F5F9",
                  color: tokens.ink,
                  border: `1px solid ${colorLineaFuerte}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
                title="Sincronizar indicadores desde la nube, matrices y monitor externo"
              >
                <RefreshCw size={14} color={tokens.gold} className={actualizandoTodo ? "spin" : ""} />
                {actualizandoTodo ? "Sincronizando..." : "Sincronizar Indicadores"}
              </button>

              <button
                onClick={() => {
                  setIndiceDraft({
                    id_mes: "2026-09",
                    anio: 2026,
                    mesIdx: 9,
                    etiqueta: "Sep 2026",
                    indice: ultimoIndiceLink ? String(ultimoIndiceLink.indice) : "100",
                    valor_absoluto: ultimoIndiceLink ? String(ultimoIndiceLink.valor_absoluto || "") : "",
                    observaciones: ""
                  });
                  setModalIndiceOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 6,
                  background: tokens.ink,
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                }}
              >
                <Plus size={14} color={tokens.gold} /> Cargar / Actualizar Índice Link
              </button>
            </div>
          </div>
        </div>

        {/* SUB-SECCIÓN: COTIZACIONES DEL DÓLAR EN VIVO */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: tokens.ink, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={15} color={tokens.gold} /> Cotizaciones del Dólar en Vivo (Mercado Argentino)
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 10
          }}>
            {dolares.slice(0, 5).map((d) => (
              <div
                key={d.casa}
                style={{
                  background: "#F8FAFC",
                  border: `1px solid ${colorLineaSuave}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink, textTransform: "capitalize" }}>
                    Dólar {d.nombre || d.casa}
                  </span>
                  <span style={{ fontSize: 10, color: tokens.textMuted }}>Venta</span>
                </div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 800, color: tokens.ink }}>
                  ${fmt(d.venta)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: tokens.textMuted, fontFamily: tokens.fontMono }}>
                    Compra: ${fmt(d.compra)}
                  </span>
                  <button
                    onClick={() => handleSincronizarTC(d.venta, d.nombre || d.casa)}
                    style={{
                      padding: "3px 7px",
                      borderRadius: 4,
                      border: `1px solid ${tokens.gold}44`,
                      background: tokens.goldSoft,
                      color: tokens.gold,
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                    title="Fijar este valor como Tipo de Cambio en el Cashflow"
                  >
                    Fijar TC
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SUB-SECCIÓN: COSTOS DE CONSTRUCCIÓN CAC & MACRO */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: tokens.ink, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <HardHat size={15} color={tokens.gold} /> Costos de Construcción (Cámara Argentina de la Construcción) & Macro
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10
          }}>
            {/* CAC General */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Índice CAC General</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                {cacData?.general?.valor ? `${fmtNum(cacData.general.valor, 0)} pts` : "22.950 pts"}
              </div>
              <div style={{ fontSize: 11, color: tokens.positive, fontWeight: 600, marginTop: 2 }}>
                {cacData?.general?.variacion != null ? `${cacData.general.variacion >= 0 ? "+" : ""}${fmtNum(cacData.general.variacion, 1)}% mensual` : "+2.1% mensual"} · Actualización cuotas
              </div>
            </div>

            {/* CAC Materiales */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>CAC Materiales</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                {cacData?.materiales?.valor ? `${fmtNum(cacData.materiales.valor, 0)} pts` : "25.150 pts"}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                {cacData?.materiales?.variacion != null ? `${cacData.materiales.variacion >= 0 ? "+" : ""}${fmtNum(cacData.materiales.variacion, 1)}% mensual` : "+1.9% mensual"} · Acopios e insumos
              </div>
            </div>

            {/* CAC Mano de Obra */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>CAC Mano de Obra</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                {cacData?.mano_obra?.valor ? `${fmtNum(cacData.mano_obra.valor, 0)} pts` : "19.800 pts"}
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                {cacData?.mano_obra?.variacion != null ? `${cacData.mano_obra.variacion >= 0 ? "+" : ""}${fmtNum(cacData.mano_obra.variacion, 1)}% mensual` : "+2.7% mensual"} · Salarios UOCRA
              </div>
            </div>

            {/* Hormigón Elaborado H-21 */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Hormigón Elaborado H-21</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                $ {fmt(ultimoH21.valor)} / m³
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                Bomba en obra · {ultimoH21.etiqueta || "Sep 2026"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: CARGAR / ACTUALIZAR ÍNDICE LINK ── */}
      {modalIndiceOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(14,21,36,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            width: "100%",
            maxWidth: 480,
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            overflow: "hidden"
          }}>
            <div style={{
              background: tokens.ink,
              color: "#FFFFFF",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color={tokens.gold} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Cargar / Editar Índice Link</span>
              </div>
              <button
                onClick={() => setModalIndiceOpen(false)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, marginBottom: 4 }}>
                  Período (Mes y Año)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select
                    value={indiceDraft.mesIdx}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      const mesesNom = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                      const id_mes = `${indiceDraft.anio}-${String(m).padStart(2, "0")}`;
                      const etiqueta = `${mesesNom[m - 1]} ${indiceDraft.anio}`;
                      setIndiceDraft(p => ({ ...p, mesIdx: m, id_mes, etiqueta }));
                    }}
                    style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, fontSize: 13 }}
                  >
                    {MESES.map((m, idx) => (
                      <option key={m.id} value={idx + 1}>{m.full}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={indiceDraft.anio}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      const mesesNom = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                      const id_mes = `${y}-${String(indiceDraft.mesIdx).padStart(2, "0")}`;
                      const etiqueta = `${mesesNom[indiceDraft.mesIdx - 1]} ${y}`;
                      setIndiceDraft(p => ({ ...p, anio: y, id_mes, etiqueta }));
                    }}
                    style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, marginBottom: 4 }}>
                  Puntos de Índice (Base 100) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 112.50"
                  value={indiceDraft.indice}
                  onChange={(e) => setIndiceDraft(p => ({ ...p, indice: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, fontSize: 13, fontFamily: tokens.fontMono }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, marginBottom: 4 }}>
                  Valor Absoluto Opcional ($ o USD)
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="Ej. 150000"
                  value={indiceDraft.valor_absoluto}
                  onChange={(e) => setIndiceDraft(p => ({ ...p, valor_absoluto: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, fontSize: 13, fontFamily: tokens.fontMono }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, marginBottom: 4 }}>
                  Observaciones / Nota de Acta
                </label>
                <textarea
                  rows={2}
                  placeholder="Comentario sobre el reajuste del período..."
                  value={indiceDraft.observaciones}
                  onChange={(e) => setIndiceDraft(p => ({ ...p, observaciones: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, fontSize: 12.5 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalIndiceOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${colorLineaSuave}`, background: "#FFFFFF", fontSize: 13, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarIndice}
                  style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: tokens.gold, color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Guardar en Nube Supabase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
