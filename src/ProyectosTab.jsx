import React, { useState, useMemo, useRef } from "react";
import { tokens } from "./tokens";
import {
  PROYECTOS_INICIALES,
  MESES_HORIZONTE,
  formatearMes,
  RUBROS_OBRA_ESTANDAR
} from "./proyectosData";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, Legend, ReferenceLine
} from "recharts";
import {
  Briefcase, TrendingUp, Calendar, Layers, DollarSign,
  Download, Plus, Edit3, CheckCircle2, AlertTriangle,
  Building2, HardHat, ChevronRight, Eye, RefreshCw,
  Clock, ArrowUpRight, BarChart3, Check, Filter,
  FileSpreadsheet, Sparkles, X, Info
} from "lucide-react";
import * as XLSX from "xlsx";

const LOCAL_STORAGE_KEY = "cf_link_obras_curvas_v2";

export default function ProyectosTab({
  tcList = [],
  fmt = (n) => Number(n || 0).toLocaleString("es-AR")
}) {
  // Tipo de cambio referencial
  const tcPorDefecto = useMemo(() => {
    if (tcList && tcList.length > 0) {
      const sorted = [...tcList].sort((a, b) => b.fecha_corte.localeCompare(a.fecha_corte));
      const val = Number(sorted[0].saldo_efectivo);
      if (val > 0) return val;
    }
    return 1550; // TC estándar Link Inversiones
  }, [tcList]);

  const [tcReferencia, setTcReferencia] = useState(tcPorDefecto);
  const [moneda, setMoneda] = useState("ARS"); // "ARS" | "USD"
  const [selectedProyId, setSelectedProyId] = useState("todos"); // "todos" o id
  const [viewTab, setViewTab] = useState("curva-s"); // "curva-s" | "mensual" | "comparativa" | "matriz" | "fichas"
  const [filtroAnio, setFiltroAnio] = useState("todos"); // "todos" | "2025" | "2026" | "2027" | "2028-2029"

  // Estado de proyectos persistible en localStorage
  const [proyectos, setProyectos] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.some(p => p.id === "duo")) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading proyectos from localStorage:", e);
    }
    return PROYECTOS_INICIALES;
  });

  // Modal para nuevo proyecto o editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProy, setEditingProy] = useState(null);

  // Modal para editar celda mensual en matriz
  const [editMesModal, setEditMesModal] = useState({ open: false, proyId: null, mes: null, valor: "" });

  const guardarProyectos = (nuevos) => {
    setProyectos(nuevos);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nuevos));
    } catch (e) {
      console.error("Error saving proyectos to localStorage:", e);
    }
  };

  const handleRestaurar = () => {
    if (window.confirm("¿Deseas restaurar todas las obras y curvas a los valores oficiales de Link Inversiones?")) {
      guardarProyectos(PROYECTOS_INICIALES);
    }
  };

  // Conversión monetaria
  const conv = (montoArs) => {
    if (moneda === "USD") {
      return (Number(montoArs) || 0) / (tcReferencia || 1550);
    }
    return Number(montoArs) || 0;
  };

  const formatoMonto = (montoArs, compact = false) => {
    const v = conv(montoArs);
    if (compact) {
      if (Math.abs(v) >= 1_000_000_000) {
        return `${moneda === "USD" ? "US$ " : "$ "}${(v / 1_000_000_000).toFixed(2)}B`;
      }
      if (Math.abs(v) >= 1_000_000) {
        return `${moneda === "USD" ? "US$ " : "$ "}${(v / 1_000_000).toFixed(1)}M`;
      }
      if (Math.abs(v) >= 1_000) {
        return `${moneda === "USD" ? "US$ " : "$ "}${(v / 1_000).toFixed(0)}k`;
      }
    }
    return `${moneda === "USD" ? "US$ " : "$ "}${fmt(Math.round(v))}`;
  };

  // Lista de meses filtrados según selector de año
  const mesesFiltrados = useMemo(() => {
    if (filtroAnio === "2025") return MESES_HORIZONTE.filter(m => m.startsWith("2025"));
    if (filtroAnio === "2026") return MESES_HORIZONTE.filter(m => m.startsWith("2026"));
    if (filtroAnio === "2027") return MESES_HORIZONTE.filter(m => m.startsWith("2027"));
    if (filtroAnio === "2028-2029") return MESES_HORIZONTE.filter(m => m.startsWith("2028") || m.startsWith("2029"));
    return MESES_HORIZONTE;
  }, [filtroAnio]);

  // Resumen global de obras (valores oficiales de la cartera)
  const resumenCartera = useMemo(() => {
    let presupTotal = 0;
    let ejecutadoTotal = 0;
    let saldoTotal = 0;
    proyectos.forEach(p => {
      presupTotal += Number(p.presupuesto_total || 0);
      ejecutadoTotal += Number(p.ejecutado || 0);
      saldoTotal += Number(p.saldo_presupuesto || 0);
    });
    const avanceGlobalPct = presupTotal > 0 ? (ejecutadoTotal / presupTotal) * 100 : 0;
    return {
      presupuestoTotal: presupTotal,
      ejecutadoTotal,
      saldoTotal,
      avanceGlobalPct: Number(avanceGlobalPct.toFixed(1))
    };
  }, [proyectos]);

  // Proyecto activo seleccionado
  const proyectoActivo = useMemo(() => {
    if (selectedProyId === "todos") return null;
    return proyectos.find(p => p.id === selectedProyId) || null;
  }, [selectedProyId, proyectos]);

  // Cálculos consolidados o del proyecto activo
  const metricas = useMemo(() => {
    const proysToCalc = proyectoActivo ? [proyectoActivo] : proyectos;

    let totalInversionArs = 0;
    let maxMes = "";
    let maxMontoArs = 0;
    const mensualSuma = {};

    mesesFiltrados.forEach(mes => {
      let sumaMes = 0;
      proysToCalc.forEach(p => {
        sumaMes += Number(p.costos_mensuales?.[mes] || 0);
      });
      mensualSuma[mes] = sumaMes;
      totalInversionArs += sumaMes;
      if (sumaMes > maxMontoArs) {
        maxMontoArs = sumaMes;
        maxMes = mes;
      }
    });

    // Promedio mensual en meses activos
    const mesesConGasto = mesesFiltrados.filter(m => (mensualSuma[m] || 0) > 0);
    const cantMeses = mesesConGasto.length || 1;
    const promedioMensualArs = totalInversionArs / cantMeses;

    // Métricas de avance acumulado
    let acumuladoArs = 0;
    const datosCurva = mesesFiltrados.map((mes, idx) => {
      const costoMes = mensualSuma[mes] || 0;
      acumuladoArs += costoMes;
      const pctAvance = totalInversionArs > 0 ? (acumuladoArs / totalInversionArs) * 100 : 0;
      
      // Curva teórica en S (Función logística de referencia)
      // S(t) = 1 / (1 + exp(-k * (t - t0))) normalizada entre 0 y 100
      const totalSteps = mesesFiltrados.length;
      const t = idx / (totalSteps - 1 || 1);
      // Modelo logístico clásico de construcción
      const k = 7;
      const t0 = 0.5;
      const sigmoide = 1 / (1 + Math.exp(-k * (t - t0)));
      const sig0 = 1 / (1 + Math.exp(-k * (0 - t0)));
      const sig1 = 1 / (1 + Math.exp(-k * (1 - t0)));
      const pctTeorico = ((sigmoide - sig0) / (sig1 - sig0)) * 100;
      const teoricoArs = (pctTeorico / 100) * totalInversionArs;

      // Hito si existe
      let hitoLabel = "";
      if (proyectoActivo && proyectoActivo.hitos) {
        const h = proyectoActivo.hitos.find(item => item.mes === mes);
        if (h) hitoLabel = h.titulo;
      }

      return {
        mesKey: mes,
        mesLabel: formatearMes(mes),
        costoMesArs: costoMes,
        costoMes: conv(costoMes),
        acumuladoArs: acumuladoArs,
        acumulado: conv(acumuladoArs),
        pctAvance: Number(pctAvance.toFixed(1)),
        pctTeorico: Number(pctTeorico.toFixed(1)),
        teorico: conv(teoricoArs),
        hito: hitoLabel,
        esPico: mes === maxMes
      };
    });

    return {
      totalInversionArs,
      promedioMensualArs,
      maxMes,
      maxMontoArs,
      cantMeses,
      datosCurva,
      mensualSuma
    };
  }, [proyectoActivo, proyectos, mesesFiltrados, moneda, tcReferencia]);

  // Datos para comparativa multiproyecto (mes a mes con cada proyecto como serie)
  const datosComparativa = useMemo(() => {
    return mesesFiltrados.map(mes => {
      const row = {
        mesKey: mes,
        mesLabel: formatearMes(mes)
      };
      let totalMes = 0;
      proyectos.forEach(p => {
        const val = Number(p.costos_mensuales?.[mes] || 0);
        row[p.id] = conv(val);
        totalMes += val;
      });
      row.total = conv(totalMes);
      return row;
    });
  }, [mesesFiltrados, proyectos, moneda, tcReferencia]);

  // Datos para torta de distribución de presupuesto por proyecto
  const datosDistribucion = useMemo(() => {
    return proyectos.map(p => {
      let suma = 0;
      mesesFiltrados.forEach(m => {
        suma += Number(p.costos_mensuales?.[m] || 0);
      });
      return {
        id: p.id,
        name: p.nombre,
        color: p.color,
        valorArs: suma,
        valor: conv(suma),
        pct: metricas.totalInversionArs > 0 ? (suma / metricas.totalInversionArs) * 100 : 0
      };
    }).filter(d => d.valorArs > 0).sort((a, b) => b.valorArs - a.valorArs);
  }, [proyectos, mesesFiltrados, metricas.totalInversionArs, moneda, tcReferencia]);

  // Exportar a Excel
  const handleExportarExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen Oficial de Obras
      const resumenRows = proyectos.map(p => {
        let sumaPeriodoArs = 0;
        mesesFiltrados.forEach(m => {
          sumaPeriodoArs += Number(p.costos_mensuales?.[m] || 0);
        });
        return {
          "Obra": p.nombre,
          "Tipología": p.tipologia,
          "Estado": p.estado,
          "% Avance": (p.avance_pct || 0) + "%",
          "Presupuesto Total (ARS)": p.presupuesto_total,
          "Ejecutado (ARS)": p.ejecutado,
          "Saldo Presupuesto (ARS)": p.saldo_presupuesto,
          "Fecha Inicio": p.fecha_inicio_label || p.fecha_inicio,
          "Fecha Entrega": p.fecha_fin_label || p.fecha_entrega,
          "Duración (Meses)": p.duracion_meses,
          "Desembolso Período Filtrado (ARS)": sumaPeriodoArs,
          "Desembolso Período Filtrado (USD)": sumaPeriodoArs / (tcReferencia || 1550)
        };
      });
      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Obras Link");

      // Hoja 2: Curva Mensual Detallada
      const matrizRows = proyectos.map(p => {
        let sumaPeriodo = 0;
        mesesFiltrados.forEach(m => sumaPeriodo += Number(p.costos_mensuales?.[m] || 0));
        const row = {
          "Obra": p.nombre,
          "% Avance": (p.avance_pct || 0) + "%",
          "Presupuesto Total": p.presupuesto_total,
          "Ejecutado": p.ejecutado,
          "Saldo Presupuesto": p.saldo_presupuesto,
          "Total Período": sumaPeriodo
        };
        mesesFiltrados.forEach(m => {
          row[formatearMes(m)] = Number(p.costos_mensuales?.[m] || 0);
        });
        return row;
      });
      // Fila Total Consolidado
      const rowTotal = {
        "Obra": "TOTAL CONSOLIDADO OBRAS",
        "% Avance": resumenCartera.avanceGlobalPct + "%",
        "Presupuesto Total": resumenCartera.presupuestoTotal,
        "Ejecutado": resumenCartera.ejecutadoTotal,
        "Saldo Presupuesto": resumenCartera.saldoTotal,
        "Total Período": metricas.totalInversionArs
      };
      mesesFiltrados.forEach(m => {
        let sum = 0;
        proyectos.forEach(p => sum += Number(p.costos_mensuales?.[m] || 0));
        rowTotal[formatearMes(m)] = sum;
      });
      matrizRows.push(rowTotal);
      const wsMatriz = XLSX.utils.json_to_sheet(matrizRows);
      XLSX.utils.book_append_sheet(wb, wsMatriz, "Costos Mensuales Obras");

      // Hoja 3: Curva S Acumulada
      const sCurveRows = metricas.datosCurva.map(d => ({
        "Mes": d.mesLabel,
        "Desembolso Mensual": d.costoMesArs,
        "Acumulado Ejecutado": d.acumuladoArs,
        "% Avance Real": d.pctAvance,
        "% Avance Teórico Curva S": d.pctTeorico,
        "Hito de Obra": d.hito || ""
      }));
      const wsSCurve = XLSX.utils.json_to_sheet(sCurveRows);
      XLSX.utils.book_append_sheet(wb, wsSCurve, "Curva S Ejecución");

      XLSX.writeFile(wb, `Curvas_Proyectos_Link_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      alert("No se pudo generar el archivo Excel.");
    }
  };

  // Guardar edición de un mes en la matriz
  const handleGuardarCeldaMes = () => {
    const { proyId, mes, valor } = editMesModal;
    const num = parseFloat(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
    // Si la moneda actual es USD, reconvertir a ARS
    const valorArs = moneda === "USD" ? num * tcReferencia : num;

    const nuevos = proyectos.map(p => {
      if (p.id === proyId) {
        return {
          ...p,
          costos_mensuales: {
            ...p.costos_mensuales,
            [mes]: valorArs
          }
        };
      }
      return p;
    });

    guardarProyectos(nuevos);
    setEditMesModal({ open: false, proyId: null, mes: null, valor: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400, margin: "0 auto" }}>
      
      {/* ── HEADER SUPERIOR Y CONTROLES ── */}
      <div style={{
        background: tokens.surface,
        borderRadius: 12,
        border: `1px solid ${tokens.rule}`,
        padding: "20px 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                background: "#EEF2FF",
                color: "#4338CA",
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}>
                <HardHat size={14} /> LINK INVERSIONES · OBRAS
              </span>
              <span style={{ fontSize: 13, color: tokens.textMuted }}>
                Costos de Desarrollo de Obras (Sin Cupos) · Horizonte Dic 2024 - Nov 2029
              </span>
            </div>
            <h1 style={{
              margin: 0,
              fontFamily: tokens.fontDisplay,
              fontSize: 26,
              fontWeight: 700,
              color: tokens.text,
              letterSpacing: "-0.02em"
            }}>
              Curvas de Ejecución de Obras & Costos de Desarrollo
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13.5, color: tokens.textMuted }}>
              Seguimiento financiero exclusivo del costo de desarrollo y construcción de las obras (desembolsos mensuales, avance acumulado y Curva S desde inicio hasta entrega).
            </p>
          </div>

          {/* Botones de acción general */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleExportarExcel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${tokens.rule}`,
                background: "#fff",
                color: tokens.text,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              title="Descargar reporte completo en Excel con gráficos y números"
            >
              <FileSpreadsheet size={15} color="#10B981" /> Exportar Planilla Excel
            </button>

            <button
              onClick={() => {
                setEditingProy(null);
                setModalOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: tokens.ink,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <Plus size={15} /> Nueva Obra
            </button>

            <button
              onClick={handleRestaurar}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${tokens.rule}`,
                background: "#F8FAFC",
                color: tokens.textMuted,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer"
              }}
              title="Restaurar a datos originales de la planilla oficial Link"
            >
              <RefreshCw size={14} /> Restaurar Obras Oficiales
            </button>
          </div>
        </div>

        {/* ── BARRA DE FILTROS Y SELECTORES ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          paddingTop: 14,
          borderTop: `1px solid ${tokens.ruleSoft}`
        }}>
          {/* Selector de Obra */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              <Building2 size={15} /> Obra:
            </span>
            <select
              value={selectedProyId}
              onChange={(e) => setSelectedProyId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${tokens.rule}`,
                background: "#fff",
                fontFamily: tokens.fontBody,
                fontSize: 13.5,
                fontWeight: 600,
                color: tokens.text,
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="todos">🌐 Todas las Obras (Cartera Consolidada)</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {p.avance_pct}% ejecutado ({p.tag})
                </option>
              ))}
            </select>

            {/* Selector de Horizonte */}
            <div style={{ display: "inline-flex", background: "#F1F5F9", padding: 3, borderRadius: 8, flexWrap: "wrap", gap: 2 }}>
              {[
                { id: "todos", label: "Horizonte Completo (2024-2029)" },
                { id: "2025", label: "2025" },
                { id: "2026", label: "2026" },
                { id: "2027", label: "2027" },
                { id: "2028-2029", label: "2028-2029" }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFiltroAnio(opt.id)}
                  style={{
                    padding: "6px 11px",
                    borderRadius: 6,
                    border: "none",
                    background: filtroAnio === opt.id ? "#fff" : "transparent",
                    color: filtroAnio === opt.id ? tokens.text : tokens.textMuted,
                    fontSize: 12.5,
                    fontWeight: filtroAnio === opt.id ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: filtroAnio === opt.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Moneda y Tipo de Cambio */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", background: "#F1F5F9", padding: 3, borderRadius: 8 }}>
              <button
                onClick={() => setMoneda("ARS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: moneda === "ARS" ? tokens.ink : "transparent",
                  color: moneda === "ARS" ? "#fff" : tokens.textMuted,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                ARS ($)
              </button>
              <button
                onClick={() => setMoneda("USD")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: moneda === "USD" ? tokens.positive : "transparent",
                  color: moneda === "USD" ? "#fff" : tokens.textMuted,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                USD (US$)
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: tokens.textMuted }}>
              <span>TC Ref:</span>
              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1px solid ${tokens.rule}`, borderRadius: 6, padding: "3px 8px" }}>
                <span style={{ color: "#94A3B8", marginRight: 4 }}>$</span>
                <input
                  type="number"
                  value={tcReferencia}
                  onChange={(e) => setTcReferencia(Number(e.target.value) || 1)}
                  style={{
                    width: 65,
                    border: "none",
                    outline: "none",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: tokens.text
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SUBNAV DE PESTAÑAS DENTRO DE PROYECTOS ── */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 4 }}>
          {[
            { id: "curva-s", label: "Curva S & Avance Acumulado", icon: TrendingUp },
            { id: "mensual", label: "Desembolsos Mensuales", icon: BarChart3 },
            { id: "comparativa", label: "Comparativa Multiproyecto", icon: Layers },
            { id: "matriz", label: "Matriz Numérica Oficial", icon: FileSpreadsheet },
            { id: "fichas", label: "Fichas & Estado de Obras", icon: HardHat }
          ].map(t => {
            const Icon = t.icon;
            const active = viewTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setViewTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: `1px solid ${active ? tokens.ink : "transparent"}`,
                  background: active ? tokens.inkSoft : "#F8FAFC",
                  color: active ? "#fff" : tokens.textMuted,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease"
                }}
              >
                <Icon size={15} color={active ? "#A5B4FC" : "#64748B"} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TARJETAS DE INDICADORES CLAVE (KPIS) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14
      }}>
        {/* KPI 1: Presupuesto Total */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Presupuesto Total de Obra
            </span>
            <Building2 size={16} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: tokens.text }}>
            {formatoMonto(proyectoActivo ? proyectoActivo.presupuesto_total : resumenCartera.presupuestoTotal)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            {proyectoActivo ? `${proyectoActivo.m2_totales || "—"} m² construidos` : `${proyectos.length} obras en cartera`}
          </div>
        </div>

        {/* KPI 2: Ejecutado a la Fecha */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Ejecutado Acumulado
            </span>
            <CheckCircle2 size={16} color={tokens.positive} />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: tokens.positive }}>
            {formatoMonto(proyectoActivo ? proyectoActivo.ejecutado : resumenCartera.ejecutadoTotal)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            {proyectoActivo
              ? `${proyectoActivo.avance_pct}% de avance físico/financiero`
              : `${resumenCartera.avanceGlobalPct}% avance global consolidado`}
          </div>
        </div>

        {/* KPI 3: Saldo por Desembolsar */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Saldo por Invertir
            </span>
            <DollarSign size={16} color={tokens.ink} />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: tokens.ink }}>
            {formatoMonto(proyectoActivo ? proyectoActivo.saldo_presupuesto : resumenCartera.saldoTotal)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Compromiso de obra restante
          </div>
        </div>

        {/* KPI 4: Desembolso Período Filtrado */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Período Seleccionado
            </span>
            <Calendar size={16} color="#8B5CF6" />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: tokens.text }}>
            {formatoMonto(metricas.totalInversionArs)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            En {metricas.cantMeses} meses ({filtroAnio === "todos" ? "2024-2029" : filtroAnio})
          </div>
        </div>

        {/* KPI 5: Promedio Mensual */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Desembolso Promedio
            </span>
            <TrendingUp size={16} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: tokens.text }}>
            {formatoMonto(metricas.promedioMensualArs)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Carga mensual proyectada
          </div>
        </div>

        {/* KPI 6: Mes Pico */}
        <div style={{
          background: tokens.surface,
          borderRadius: 10,
          border: `1px solid ${tokens.rule}`,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Mes Pico (Peak Burn)
            </span>
            <ArrowUpRight size={16} color="#D97706" />
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 700, color: "#D97706" }}>
            {metricas.maxMes ? formatearMes(metricas.maxMes) : "—"}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Pico: {formatoMonto(metricas.maxMontoArs, true)}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL SEGÚN PESTAÑA ACTIVA ── */}

      {/* ──────────────────────────────────────────────────────────
          PESTAÑA 1: CURVA S & AVANCE ACUMULADO
         ────────────────────────────────────────────────────────── */}
      {viewTab === "curva-s" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            border: `1px solid ${tokens.rule}`,
            padding: 22,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 19, fontWeight: 600, color: tokens.text }}>
                  Curva S de Ejecución Financiera y Física
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
                  Comportamiento acumulado de la inversión ({moneda}) comparado con la Curva Teórica Sigmoidal estándar de ingeniería de obra.
                </p>
              </div>

              {/* Leyenda rápida */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#2563EB" }}></span>
                  <strong>Curva Ejecutada / Proyectada</strong>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: "#94A3B8", borderStyle: "dashed" }}></span>
                  <span style={{ color: tokens.textMuted }}>Curva S Teórica Base</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#E2E8F0" }}></span>
                  <span style={{ color: tokens.textMuted }}>Desembolso Mes</span>
                </span>
              </div>
            </div>

            {/* Gráfico Recharts ComposedChart */}
            <div style={{ height: 380, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={metricas.datosCurva} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    tickFormatter={(val) => formatoMonto(moneda === "USD" ? val * tcReferencia : val, true)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: tokens.ink,
                          color: "#fff",
                          padding: "12px 14px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          boxShadow: "0 4px 14px rgba(0,0,0,0.25)"
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, borderBottom: "1px solid #334155", paddingBottom: 4 }}>
                            {d.mesLabel} {d.esPico ? "🔥 (Mes Pico)" : ""}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>Desembolso Mensual:</span>
                            <span style={{ fontWeight: 600 }}>{formatoMonto(d.costoMesArs)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>Acumulado a la fecha:</span>
                            <span style={{ fontWeight: 600, color: "#60A5FA" }}>{formatoMonto(d.acumuladoArs)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>% Avance Curva S:</span>
                            <span style={{ fontWeight: 700, color: "#34D399" }}>{d.pctAvance}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
                            <span style={{ color: "#94A3B8" }}>% Teórico Planificado:</span>
                            <span style={{ color: "#CBD5E1" }}>{d.pctTeorico}%</span>
                          </div>
                          {d.hito && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #334155", color: "#FDE047", fontWeight: 600 }}>
                              🚩 Hito: {d.hito}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Barras de costo mensual */}
                  <Bar
                    yAxisId="left"
                    dataKey="costoMes"
                    name="Desembolso Mensual"
                    fill="#CBD5E1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  {/* Curva Teórica */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="teorico"
                    name="Curva S Teórica"
                    stroke="#94A3B8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  {/* Curva S Real / Proyectada */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="acumulado"
                    name="Inversión Acumulada"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ fill: "#2563EB", r: 4 }}
                    activeDot={{ r: 6, stroke: "#1D4ED8", strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Explicación de la Curva S */}
            <div style={{
              marginTop: 18,
              padding: "14px 18px",
              background: "#F8FAFC",
              borderRadius: 8,
              border: `1px solid ${tokens.rule}`,
              display: "flex",
              alignItems: "flex-start",
              gap: 12
            }}>
              <Info size={18} color="#3B82F6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>
                <strong style={{ color: tokens.text }}>Interpretación de la Curva S:</strong> En el inicio de los proyectos (fase de replanteo, movimiento de suelos y submuración) los costos avanzan de forma gradual. La pendiente se empina con la estructura de hormigón armado, albañilería e instalaciones (período de máximo desembolso mensual, reflejado en el pico de <strong>{metricas.maxMes ? formatearMes(metricas.maxMes) : ""}</strong>), y finalmente desacelera suavemente en la etapa de terminaciones, ensayos y entrega de llaves.
              </div>
            </div>
          </div>

          {/* Timeline de Hitos de Obra si hay proyecto activo */}
          {proyectoActivo && proyectoActivo.hitos && (
            <div style={{
              background: tokens.surface,
              borderRadius: 12,
              border: `1px solid ${tokens.rule}`,
              padding: 22,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
            }}>
              <h3 style={{ margin: "0 0 14px 0", fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, color: tokens.text }}>
                Hitos Constructivos & Cronograma de Entrega · {proyectoActivo.nombre}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                {proyectoActivo.hitos.map((h, i) => (
                  <div key={i} style={{
                    background: "#F8FAFC",
                    border: `1px solid ${tokens.rule}`,
                    borderRadius: 8,
                    padding: "14px 16px",
                    position: "relative"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: 4 }}>
                        {formatearMes(h.mes)}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: tokens.positive }}>
                        {h.pct}% avance
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: tokens.text, marginBottom: 4 }}>
                      {h.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.textMuted }}>
                      {h.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          PESTAÑA 2: DESEMBOLSOS MENSUALES
         ────────────────────────────────────────────────────────── */}
      {viewTab === "mensual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            border: `1px solid ${tokens.rule}`,
            padding: 22,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 19, fontWeight: 600, color: tokens.text }}>
                  Desembolso Mensual de Obras ({moneda})
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
                  Requerimiento de caja mes a mes para sostener el ritmo constructivo y compromisos con contratistas.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: proyectoActivo ? proyectoActivo.color : "#2563EB" }}></span>
                  Desembolso del Mes
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 2, background: "#EF4444", borderStyle: "dashed" }}></span>
                  Promedio ({formatoMonto(metricas.promedioMensualArs, true)})
                </span>
              </div>
            </div>

            <div style={{ height: 350, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricas.datosCurva} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    tickFormatter={(val) => formatoMonto(moneda === "USD" ? val * tcReferencia : val, true)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: tokens.ink,
                          color: "#fff",
                          padding: "10px 14px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          boxShadow: "0 4px 14px rgba(0,0,0,0.25)"
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.mesLabel}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                            <span style={{ color: "#94A3B8" }}>Desembolso:</span>
                            <span style={{ fontWeight: 600 }}>{formatoMonto(d.costoMesArs)}</span>
                          </div>
                          {d.esPico && (
                            <div style={{ marginTop: 4, color: "#F59E0B", fontWeight: 700, fontSize: 11.5 }}>
                              🔥 Mes con mayor desembolso
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={conv(metricas.promedioMensualArs)}
                    stroke="#EF4444"
                    strokeDasharray="4 4"
                    label={{ value: "Promedio", position: "top", fill: "#EF4444", fontSize: 11 }}
                  />
                  <Bar
                    dataKey="costoMes"
                    name="Costo Mensual"
                    radius={[4, 4, 0, 0]}
                  >
                    {metricas.datosCurva.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.esPico ? "#D97706" : (proyectoActivo ? proyectoActivo.color : "#2563EB")}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Desglose por Rubros Constructivos (si hay proyecto activo) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={{
              background: tokens.surface,
              borderRadius: 12,
              border: `1px solid ${tokens.rule}`,
              padding: 22,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
            }}>
              <h3 style={{ margin: "0 0 14px 0", fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, color: tokens.text }}>
                Estructura de Costos por Rubro Constructivo
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(proyectoActivo?.rubros || RUBROS_OBRA_ESTANDAR).map((r, i) => {
                  const montoRubroArs = (metricas.totalInversionArs * r.pct) / 100;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: tokens.text, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: r.color }}></span>
                          {r.nombre || r.label}
                        </span>
                        <span style={{ fontWeight: 700, color: tokens.text }}>
                          {formatoMonto(montoRubroArs)} <span style={{ color: tokens.textMuted, fontWeight: 500 }}>({r.pct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 6, width: "100%", background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${r.pct}%`, height: "100%", background: r.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumen del perfil constructivo */}
            <div style={{
              background: tokens.surface,
              borderRadius: 12,
              border: `1px solid ${tokens.rule}`,
              padding: 22,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ margin: "0 0 10px 0", fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, color: tokens.text }}>
                  Perfil Constructivo & Métricas de Eficiencia
                </h3>
                <p style={{ fontSize: 13, color: tokens.textMuted, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                  Indicadores de costo por m² y distribución de carga financiera para control de contratistas y avance físico.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: tokens.textMuted }}>Costo Promedio Estimado por m²:</span>
                    <strong style={{ fontSize: 13, color: tokens.text }}>
                      {proyectoActivo && proyectoActivo.m2_totales
                        ? formatoMonto(metricas.totalInversionArs / proyectoActivo.m2_totales) + " / m²"
                        : "—"}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: tokens.textMuted }}>Unidades Funcionales:</span>
                    <strong style={{ fontSize: 13, color: tokens.text }}>
                      {proyectoActivo ? `${proyectoActivo.unidades_totales || "—"} unidades` : "Cartera global"}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: tokens.textMuted }}>Meses de Máxima Exigencia:</span>
                    <strong style={{ fontSize: 13, color: "#D97706" }}>
                      {metricas.maxMes ? formatearMes(metricas.maxMes) : "—"}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: tokens.textMuted }}>Porcentaje de la Cartera Total:</span>
                    <strong style={{ fontSize: 13, color: tokens.text }}>
                      {proyectoActivo
                        ? `${((metricas.totalInversionArs / (datosDistribucion.reduce((acc, d) => acc + d.valorArs, 0) || 1)) * 100).toFixed(1)}%`
                        : "100%"}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, fontSize: 12, color: tokens.textMuted, fontStyle: "italic" }}>
                * Datos sincronizados con el plan de tesorería y presupuesto de obra 2026/2027.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          PESTAÑA 3: COMPARATIVA MULTIPROYECTO
         ────────────────────────────────────────────────────────── */}
      {viewTab === "comparativa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            border: `1px solid ${tokens.rule}`,
            padding: 22,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 19, fontWeight: 600, color: tokens.text }}>
                  Solapamiento de Curvas Multiproyecto (Área Apilada)
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
                  Compara la demanda simultánea de fondos para el desarrollo de todas las obras activas y programadas de Link Inversiones.
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                {proyectos.map(p => (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }}></span>
                    <span style={{ fontWeight: 500, color: tokens.text }}>{p.nombre}</span>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ height: 380, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosComparativa} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
                    tickFormatter={(val) => formatoMonto(moneda === "USD" ? val * tcReferencia : val, true)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: tokens.ink,
                          color: "#fff",
                          padding: "12px 14px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                          minWidth: 220
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 6, borderBottom: "1px solid #334155", paddingBottom: 4 }}>
                            {d.mesLabel} · Total: {formatoMonto(moneda === "USD" ? d.total * tcReferencia : d.total)}
                          </div>
                          {proyectos.map(p => {
                            const val = d[p.id] || 0;
                            if (val <= 0) return null;
                            return (
                              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                                <span style={{ color: p.color, fontWeight: 600 }}>{p.nombre}:</span>
                                <span>{formatoMonto(moneda === "USD" ? val * tcReferencia : val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  {proyectos.map(p => (
                    <Area
                      key={p.id}
                      type="monotone"
                      dataKey={p.id}
                      stackId="1"
                      stroke={p.color}
                      fill={p.color}
                      fillOpacity={0.75}
                      name={p.nombre}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Distribución del Presupuesto por Proyecto */}
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            border: `1px solid ${tokens.rule}`,
            padding: 22,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, color: tokens.text }}>
              Participación en la Cartera Total de Obras
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosDistribucion}
                      dataKey="valor"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {datosDistribucion.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: tokens.ink, color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 12 }}>
                            <div style={{ fontWeight: 700 }}>{d.name}</div>
                            <div>{formatoMonto(d.valorArs)} ({d.pct.toFixed(1)}%)</div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista explicativa */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {datosDistribucion.map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color }}></span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tokens.text }}>{formatoMonto(d.valorArs)}</span>
                      <span style={{ fontSize: 12, color: tokens.textMuted, marginLeft: 6 }}>({d.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          PESTAÑA 4: MATRIZ NUMÉRICA DETALLADA
         ────────────────────────────────────────────────────────── */}
      {viewTab === "matriz" && (
        <div style={{
          background: tokens.surface,
          borderRadius: 12,
          border: `1px solid ${tokens.rule}`,
          padding: 22,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 19, fontWeight: 600, color: tokens.text }}>
                Matriz Numérica de Costos Mensuales por Proyecto
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
                Detalle mes a mes de los costos en {moneda}. Haz clic en cualquier celda para ajustar el desembolso previsto.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: tokens.textMuted }}>
                💡 Valores en {moneda} {moneda === "USD" ? `(TC $${tcReferencia})` : ""}
              </span>
            </div>
          </div>

          {/* Tabla con scroll horizontal */}
          <div style={{ overflowX: "auto", border: `1px solid ${tokens.rule}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "right", fontFamily: tokens.fontBody }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: `2px solid ${tokens.rule}` }}>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, color: tokens.text, position: "sticky", left: 0, background: "#F8FAFC", zIndex: 3, minWidth: 170 }}>
                    Obra
                  </th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 700, color: tokens.text, minWidth: 80 }}>
                    % Avance
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 10px", fontWeight: 700, color: tokens.text, minWidth: 125 }}>
                    Presupuesto Total
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 10px", fontWeight: 700, color: tokens.positive, minWidth: 115 }}>
                    Ejecutado
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 10px", fontWeight: 700, color: tokens.ink, minWidth: 125 }}>
                    Saldo Presupuesto
                  </th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 700, color: tokens.textMuted, minWidth: 105 }}>
                    Plazo
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, color: "#4338CA", background: "#EEF2FF", minWidth: 125 }}>
                    Total Período ({moneda})
                  </th>
                  {mesesFiltrados.map(m => (
                    <th key={m} style={{ padding: "12px 10px", fontWeight: 700, color: tokens.textMuted, minWidth: 100 }}>
                      {formatearMes(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Filas de proyectos */}
                {proyectos.map(p => {
                  let sumaTotalArs = 0;
                  mesesFiltrados.forEach(m => {
                    sumaTotalArs += Number(p.costos_mensuales?.[m] || 0);
                  });

                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}`, transition: "background 0.15s ease" }}>
                      <td style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: tokens.text,
                        position: "sticky",
                        left: 0,
                        background: "#fff",
                        zIndex: 2,
                        borderRight: `1px solid ${tokens.rule}`
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }}></span>
                          <span style={{ whiteSpace: "nowrap" }}>{p.nombre}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 8px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 7px",
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: p.avance_pct >= 80 ? "#ECFDF5" : p.avance_pct > 0 ? "#EFF6FF" : "#F1F5F9",
                          color: p.avance_pct >= 80 ? "#047857" : p.avance_pct > 0 ? "#1D4ED8" : "#64748B"
                        }}>
                          {p.avance_pct || 0}%
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", fontWeight: 600, color: tokens.text }}>
                        {formatoMonto(p.presupuesto_total)}
                      </td>
                      <td style={{ padding: "10px 10px", color: p.ejecutado > 0 ? tokens.positive : tokens.textMuted, fontWeight: 600 }}>
                        {p.ejecutado > 0 ? formatoMonto(p.ejecutado) : "—"}
                      </td>
                      <td style={{ padding: "10px 10px", color: tokens.ink, fontWeight: 600 }}>
                        {formatoMonto(p.saldo_presupuesto)}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 8px", fontSize: 11.5, color: tokens.textMuted }}>
                        {p.fecha_inicio_label} - {p.fecha_fin_label}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#4338CA", background: "#F5F3FF" }}>
                        {formatoMonto(sumaTotalArs)}
                      </td>
                      {mesesFiltrados.map(m => {
                        const valArs = Number(p.costos_mensuales?.[m] || 0);
                        const esCero = valArs === 0;
                        return (
                          <td
                            key={m}
                            onClick={() => {
                              setEditMesModal({
                                open: true,
                                proyId: p.id,
                                proyNombre: p.nombre,
                                mes: m,
                                valor: conv(valArs).toString()
                              });
                            }}
                            style={{
                              padding: "10px 8px",
                              color: esCero ? "#CBD5E1" : tokens.text,
                              cursor: "pointer",
                              background: esCero ? "transparent" : "#FAFBFD",
                              transition: "background 0.1s ease"
                            }}
                            title={`Editar desembolso de ${p.nombre} en ${formatearMes(m)}`}
                          >
                            {esCero ? "—" : formatoMonto(valArs)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Fila Total Consolidado */}
                <tr style={{ background: "#EEF2FF", borderTop: `2px solid ${tokens.ink}`, fontWeight: 700 }}>
                  <td style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    color: tokens.ink,
                    position: "sticky",
                    left: 0,
                    background: "#EEF2FF",
                    zIndex: 2,
                    borderRight: `1px solid ${tokens.rule}`
                  }}>
                    TOTAL CONSOLIDADO
                  </td>
                  <td style={{ textAlign: "center", padding: "12px 8px", color: tokens.ink }}>
                    {resumenCartera.avanceGlobalPct}%
                  </td>
                  <td style={{ padding: "12px 10px", color: tokens.text }}>
                    {formatoMonto(resumenCartera.presupuestoTotal)}
                  </td>
                  <td style={{ padding: "12px 10px", color: tokens.positive }}>
                    {formatoMonto(resumenCartera.ejecutadoTotal)}
                  </td>
                  <td style={{ padding: "12px 10px", color: tokens.ink }}>
                    {formatoMonto(resumenCartera.saldoTotal)}
                  </td>
                  <td style={{ textAlign: "center", padding: "12px 8px", fontSize: 11.5, color: tokens.textMuted }}>
                    60 meses
                  </td>
                  <td style={{ padding: "12px 14px", color: "#4338CA", background: "#E0E7FF" }}>
                    {formatoMonto(metricas.totalInversionArs)}
                  </td>
                  {mesesFiltrados.map(m => {
                    const sumMes = metricas.mensualSuma[m] || 0;
                    return (
                      <td key={m} style={{ padding: "12px 8px", color: sumMes > 0 ? tokens.ink : "#94A3B8" }}>
                        {sumMes > 0 ? formatoMonto(sumMes) : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: tokens.textMuted }}>
            💡 Haz clic en cualquier valor mensual para modificar el presupuesto proyectado o cargar números reales de ejecución.
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          PESTAÑA 5: FICHAS & HITOS DE OBRA
         ────────────────────────────────────────────────────────── */}
      {viewTab === "fichas" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
          {proyectos.map(p => {
            let totalArs = 0;
            mesesFiltrados.forEach(m => totalArs += Number(p.costos_mensuales?.[m] || 0));

            return (
              <div key={p.id} style={{
                background: tokens.surface,
                borderRadius: 12,
                border: `1px solid ${tokens.rule}`,
                padding: 22,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{
                      background: p.color + "18",
                      color: p.color,
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700
                    }}>
                      {p.tag}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: p.estado === "Finalizado" ? tokens.textMuted : tokens.positive }}>
                      ● {p.estado}
                    </span>
                  </div>

                  <h3 style={{ margin: "0 0 6px 0", fontFamily: tokens.fontDisplay, fontSize: 19, fontWeight: 700, color: tokens.text }}>
                    {p.nombre}
                  </h3>
                  <div style={{ fontSize: 13, color: tokens.textMuted, marginBottom: 12 }}>
                    {p.tipologia} · {p.ubicacion}
                  </div>

                  <p style={{ fontSize: 12.5, color: tokens.textMuted, lineHeight: 1.5, margin: "0 0 16px 0" }}>
                    {p.descripcion}
                  </p>

                  {/* Barra de avance físico/financiero */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: tokens.textMuted }}>Avance Ejecutado:</span>
                      <span style={{ fontWeight: 700, color: p.avance_pct >= 80 ? tokens.positive : p.avance_pct > 0 ? tokens.ink : tokens.textMuted }}>
                        {p.avance_pct || 0}%
                      </span>
                    </div>
                    <div style={{ height: 8, width: "100%", background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, p.avance_pct || 0)}%`, height: "100%", background: p.color, borderRadius: 4, transition: "width 0.3s ease" }} />
                    </div>
                  </div>

                  {/* Métricas clave de la ficha */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 8 }}>
                      <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Presupuesto Total</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: tokens.text }}>{formatoMonto(p.presupuesto_total, true)}</div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 8 }}>
                      <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Ejecutado a la Fecha</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: p.ejecutado > 0 ? tokens.positive : tokens.textMuted }}>
                        {p.ejecutado > 0 ? formatoMonto(p.ejecutado, true) : "—"}
                      </div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 8 }}>
                      <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Saldo por Invertir</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: tokens.ink }}>{formatoMonto(p.saldo_presupuesto, true)}</div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 8 }}>
                      <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Plazo Oficial</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tokens.text }}>{p.fecha_inicio_label} a {p.fecha_fin_label}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setSelectedProyId(p.id);
                      setViewTab("curva-s");
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${tokens.rule}`,
                      background: "#fff",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: tokens.text,
                      cursor: "pointer"
                    }}
                  >
                    <TrendingUp size={14} color="#2563EB" /> Ver Curva S
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProyId(p.id);
                      setViewTab("matriz");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${tokens.rule}`,
                      background: "#F8FAFC",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: tokens.textMuted,
                      cursor: "pointer"
                    }}
                    title="Editar costos mensuales"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: EDITAR CELDA MENSUAL EN MATRIZ ── */}
      {editMesModal.open && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 420,
            padding: 22,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: tokens.text }}>
                Editar Desembolso Mensual
              </h4>
              <button
                onClick={() => setEditMesModal({ open: false, proyId: null, mes: null, valor: "" })}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: tokens.textMuted }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: tokens.textMuted, marginBottom: 16 }}>
              Proyecto: <strong>{editMesModal.proyNombre}</strong><br />
              Período: <strong>{formatearMes(editMesModal.mes)}</strong>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 6 }}>
                Monto en {moneda}:
              </label>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${tokens.rule}`, borderRadius: 8, padding: "8px 12px", background: "#F8FAFC" }}>
                <span style={{ color: "#94A3B8", marginRight: 8, fontWeight: 600 }}>{moneda === "USD" ? "US$" : "$"}</span>
                <input
                  type="number"
                  value={editMesModal.valor}
                  onChange={(e) => setEditMesModal({ ...editMesModal, valor: e.target.value })}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: 16,
                    fontWeight: 700,
                    color: tokens.text
                  }}
                  autoFocus
                />
              </div>
              {moneda === "USD" && (
                <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4 }}>
                  Equivalente: $ {fmt(Math.round((Number(editMesModal.valor) || 0) * tcReferencia))} ARS al TC {tcReferencia}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setEditMesModal({ open: false, proyId: null, mes: null, valor: "" })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${tokens.rule}`,
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: tokens.textMuted,
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarCeldaMes}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: tokens.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Guardar Valor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO PROYECTO ── */}
      {modalOpen && (
        <NuevoProyectoModal
          onClose={() => setModalOpen(false)}
          onGuardar={(nuevoProy) => {
            guardarProyectos([...proyectos, nuevoProy]);
            setModalOpen(false);
          }}
          tcReferencia={tcReferencia}
        />
      )}

    </div>
  );
}

// Modal para dar de alta un nuevo proyecto con curva paramétrica
function NuevoProyectoModal({ onClose, onGuardar, tcReferencia }) {
  const [nombre, setNombre] = useState("");
  const [tipologia, setTipologia] = useState("Edificio Residencial");
  const [m2, setM2] = useState("3500");
  const [unidades, setUnidades] = useState("30");
  const [presupuestoTotalArs, setPresupuestoTotalArs] = useState("1500000000");
  const [fechaInicio, setFechaInicio] = useState("2027-01");
  const [fechaEntrega, setFechaEntrega] = useState("2027-12");
  const [tipoCurva, setTipoCurva] = useState("curva-s"); // "curva-s" | "lineal"

  const handleCrear = () => {
    if (!nombre.trim()) {
      alert("Por favor ingresa el nombre del proyecto");
      return;
    }

    const total = parseFloat(presupuestoTotalArs) || 0;
    const costos = {};

    // Calcular distribución según tipo de curva
    const meses = MESES_HORIZONTE.filter(m => m >= fechaInicio && m <= fechaEntrega);
    const n = meses.length || 1;

    if (tipoCurva === "lineal") {
      const xMes = total / n;
      MESES_HORIZONTE.forEach(m => {
        costos[m] = (m >= fechaInicio && m <= fechaEntrega) ? xMes : 0;
      });
    } else {
      // Curva S normalizada
      let sumPonderada = 0;
      const ponderaciones = meses.map((_, idx) => {
        const t = idx / (n - 1 || 1);
        const k = 6;
        const sig = 1 / (1 + Math.exp(-k * (t - 0.5)));
        sumPonderada += sig;
        return sig;
      });

      MESES_HORIZONTE.forEach(m => {
        const idx = meses.indexOf(m);
        if (idx !== -1) {
          costos[m] = (ponderaciones[idx] / (sumPonderada || 1)) * total;
        } else {
          costos[m] = 0;
        }
      });
    }

    const nuevo = {
      id: "proy_" + Date.now(),
      nombre: nombre.trim(),
      tag: "Nueva Obra",
      categoria: "obra",
      tipologia,
      ubicacion: "Córdoba Capital",
      m2_totales: Number(m2) || 0,
      unidades_totales: Number(unidades) || 0,
      fecha_inicio: fechaInicio,
      fecha_entrega: fechaEntrega,
      duracion_meses: n,
      estado: "En Ejecución",
      color: "#0284C7",
      descripcion: `Emprendimiento inmobiliario presupuestado con curva de ejecución ${tipoCurva === "curva-s" ? "en S" : "lineal"}.`,
      hitos: [
        { mes: fechaInicio, titulo: "Inicio de Obra", desc: "Replanteo y contratistas", pct: 10 },
        { mes: fechaEntrega, titulo: "Entrega y Posesión", desc: "Finalización de obra", pct: 100 }
      ],
      rubros: RUBROS_OBRA_ESTANDAR,
      costos_mensuales: costos
    };

    onGuardar(nuevo);
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        width: "100%",
        maxWidth: 520,
        padding: 24,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: tokens.text, fontFamily: tokens.fontDisplay }}>
            Agregar Nuevo Proyecto & Curva
          </h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: tokens.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
              Nombre del Proyecto:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Torre Link Nueva Córdoba"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${tokens.rule}`,
                fontSize: 13.5,
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
                m² Totales:
              </label>
              <input
                type="number"
                value={m2}
                onChange={(e) => setM2(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${tokens.rule}`, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
                Unidades Totales:
              </label>
              <input
                type="number"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${tokens.rule}`, fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
                Fecha Inicio (Año-Mes):
              </label>
              <input
                type="text"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                placeholder="2027-01"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${tokens.rule}`, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
                Fecha Entrega (Año-Mes):
              </label>
              <input
                type="text"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                placeholder="2027-12"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${tokens.rule}`, fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
              Presupuesto Total de Obra (ARS):
            </label>
            <input
              type="number"
              value={presupuestoTotalArs}
              onChange={(e) => setPresupuestoTotalArs(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${tokens.rule}`, fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.textMuted, marginBottom: 4 }}>
              Generación Automática de la Curva:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => setTipoCurva("curva-s")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${tipoCurva === "curva-s" ? tokens.ink : tokens.rule}`,
                  background: tipoCurva === "curva-s" ? tokens.inkSoft : "#fff",
                  color: tipoCurva === "curva-s" ? "#fff" : tokens.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                📈 Curva S (Sigmoide Real)
              </button>
              <button
                type="button"
                onClick={() => setTipoCurva("lineal")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${tipoCurva === "lineal" ? tokens.ink : tokens.rule}`,
                  background: tipoCurva === "lineal" ? tokens.inkSoft : "#fff",
                  color: tipoCurva === "lineal" ? "#fff" : tokens.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                ➖ Desembolso Lineal
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${tokens.rule}`,
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              color: tokens.textMuted,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: tokens.ink,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Crear Proyecto
          </button>
        </div>
      </div>
    </div>
  );
}

// Icono auxiliar para evitar fallos
function ActivityIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}
