import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import { DEFAULT_STOCK_UNITS, PROYECTOS_STOCK } from "./stockData";
import { DEFAULT_PLAN_2026, DEFAULT_PLAN_2027, PLAN_PROJECT_CATS_2027 } from "./budgetData";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, Cell, BarChart
} from "recharts";
import {
  Building2, DollarSign, Activity, TrendingUp, TrendingDown, Wallet,
  Calendar, AlertTriangle, CheckCircle2, ArrowUpRight, Sparkles, Layers,
  Eye, RefreshCw, Cloud, ChevronRight, Scale, Plus, Pencil, X, Save,
  HardHat, FileText, BarChart3, HelpCircle
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
  onNavigateToTab
}) {
  // ── 0. ESTADO GENERAL & MONEDA ──
  const [moneda, setMoneda] = useState("ARS"); // "ARS" | "USD"
  const [ejercicio, setEjercicio] = useState("2027"); // "2027" | "2026"
  const [toast, setToast] = useState("");

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
    if (planesFondos && planesFondos[ejercicio]) return planesFondos[ejercicio];
    return ejercicio === "2027" ? DEFAULT_PLAN_2027 : DEFAULT_PLAN_2026;
  }, [planesFondos, ejercicio]);

  const datosMensuales = useMemo(() => {
    const ingData = planActual.ingreso || {};
    const egData = planActual.egreso || {};

    let saldoAcumulado = situacionActual.liquidezARS;

    return MESES.map((m) => {
      let totIng = 0;
      Object.values(ingData).forEach((row) => {
        totIng += Number(row?.[m.id] || 0);
      });

      let totEg = 0;
      Object.values(egData).forEach((row) => {
        totEg += Number(row?.[m.id] || 0);
      });

      const flujoNeto = totIng - totEg;
      saldoAcumulado += flujoNeto;

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
        saldoAcumulado: saldoAcumulado / div,
        rawIngresos: totIng,
        rawEgresos: totEg,
        rawFlujoNeto: flujoNeto,
        rawNecesidadCaja: necesidadCaja,
        rawSaldoAcumulado: saldoAcumulado,
        esDeficitario: flujoNeto < 0
      };
    });
  }, [planActual, situacionActual.liquidezARS, moneda, tcReferencia]);

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
      const local = localStorage.getItem("cf_stock_disponible_units_v1");
      if (local) return JSON.parse(local);
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
          setUnidadesStock(data);
          localStorage.setItem("cf_stock_disponible_units_v1", JSON.stringify(data));
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
      const pNom = u.proyecto || "Otros Proyectos";
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

  // ── 4. CUADRO 4: PRINCIPALES INDICADORES FINANCIEROS Y ECONÓMICOS ──
  const [dolares, setDolares] = useState([]);
  const [loadingDolares, setLoadingDolares] = useState(false);

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

  useEffect(() => {
    fetchDolares();
    loadIndiceLink();
  }, [fetchDolares, loadIndiceLink]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Selector de Moneda */}
          <div style={{ display: "flex", alignItems: "center", background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderLeft: `1px solid ${colorLineaSuave}`, paddingLeft: 12 }}>
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
            fontFamily: tokens.fontMono
          }}>
            TC Ref: <strong>${fmt(tcReferencia)}</strong>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 1: SITUACIÓN ACTUAL (POSICIÓN DE CAJA Y LIQUIDEZ)
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
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
            background: situacionActual.deficitActual ? "#FEF2F2" : situacionActual.sinQuemaNeta ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${situacionActual.deficitActual ? "#FECACA" : situacionActual.sinQuemaNeta ? "#BBF7D0" : colorLineaSuave}`,
            borderRadius: 10,
            padding: "16px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: situacionActual.deficitActual ? tokens.negative : situacionActual.sinQuemaNeta ? tokens.positive : tokens.textMuted
              }}>
                Runway · Días de Caja
              </span>
              <Calendar size={16} color={situacionActual.deficitActual ? tokens.negative : situacionActual.sinQuemaNeta ? tokens.positive : "#64748B"} />
            </div>
            <div style={{
              fontFamily: tokens.fontMono,
              fontSize: 20,
              fontWeight: 800,
              color: situacionActual.deficitActual ? tokens.negative : situacionActual.sinQuemaNeta ? tokens.positive : tokens.ink
            }}>
              {situacionActual.deficitActual ? "En Déficit" : situacionActual.sinQuemaNeta ? "Holgura Total" : `${situacionActual.diasDeCaja} días`}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
              {situacionActual.deficitActual ? "Saldo inicial negativo" : situacionActual.sinQuemaNeta ? "Sin quema neta de caja" : `Pico de déficit: ${formatDate(situacionActual.diaDeficit)}`}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 2: INGRESOS, EGRESOS & NECESIDAD DE CAJA MENSUAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
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
        <div style={{ overflowX: "auto", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, marginBottom: 20 }}>
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

              {/* FILA: SALDO DE CAJA ACUMULADO */}
              <tr style={{ background: tokens.ink, color: "#FFFFFF" }}>
                <td style={{ textAlign: "left", padding: "11px 14px", fontWeight: 700, color: "#FFFFFF" }}>
                  Saldo Caja Acumulado Estimado
                </td>
                {datosMensuales.map(m => (
                  <td key={m.mesId} style={{ padding: "11px 12px", fontFamily: tokens.fontMono, fontWeight: 700, color: m.saldoAcumulado >= 0 ? "#86EFAC" : "#FCA5A5" }}>
                    {fmt(m.saldoAcumulado)}
                  </td>
                ))}
                <td style={{ padding: "11px 14px", fontFamily: tokens.fontMono, fontWeight: 800, color: "#FDE68A", background: "#0B1120" }}>
                  {fmt(datosMensuales[datosMensuales.length - 1]?.saldoAcumulado || 0)}
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
                  name === "ingresos" ? "Ingresos Proyectados" : name === "egresos" ? "Egresos Proyectados" : "Flujo Neto"
                ]}
                contentStyle={{ background: "#FFFFFF", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, fontSize: 12 }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos Proyectados" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="egresos" name="Egresos Proyectados" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="flujoNeto" name="Flujo Neto Mensual" stroke={tokens.gold} strokeWidth={3} dot={{ r: 4, fill: tokens.gold }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO 3: STOCK DE UNIDADES POR PROYECTO, VALUACIÓN & VALUACIÓN TOTAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
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
        <div style={{ overflowX: "auto", border: `1px solid ${colorLineaSuave}`, borderRadius: 8 }}>
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
          CUADRO 4: PRINCIPALES INDICADORES FINANCIEROS & ECONÓMICOS
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
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
              4. Principales Indicadores Financieros & Económicos
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
                22.950 pts
              </div>
              <div style={{ fontSize: 11, color: tokens.positive, fontWeight: 600, marginTop: 2 }}>
                +2.1% mensual · Actualización cuotas
              </div>
            </div>

            {/* CAC Materiales */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>CAC Materiales</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                25.150 pts
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                +1.9% mensual · Acopios e insumos
              </div>
            </div>

            {/* CAC Mano de Obra */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>CAC Mano de Obra</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                19.800 pts
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                +2.7% mensual · Salarios UOCRA
              </div>
            </div>

            {/* Hormigón Elaborado H-21 */}
            <div style={{ background: "#F8FAFC", border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Hormigón Elaborado H-21</div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.ink, marginTop: 4 }}>
                $ 184.500 / m³
              </div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                Bomba en obra · Estructuras
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
