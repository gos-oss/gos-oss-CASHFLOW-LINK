import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import { DEFAULT_STOCK_UNITS, PROYECTOS_STOCK, TIPOLOGIAS_STOCK } from "./stockData";
import ImportadorStockModal from "./ImportadorStockModal";
import {
  Building2, DollarSign, Layers, Plus, Search, Filter, Download,
  RotateCcw, CheckCircle2, Clock, AlertCircle, Trash2, Edit2,
  TrendingUp, BarChart3, PieChart as PieChartIcon, Eye, ArrowUpDown,
  FileSpreadsheet, X, Check, Sparkles, MapPin, Tag, Upload, Cloud, RefreshCw
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";

const LOCAL_STORAGE_KEY = "cf_stock_disponible_units_v1";

const ESTADOS = [
  { id: "Disponible", label: "Disponible", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  { id: "Reservado", label: "Reservado", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  { id: "En Negociación", label: "En Negociación", color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
  { id: "Bloqueado", label: "Bloqueado", color: "#64748B", bg: "#F1F5F9", border: "#CBD5E1" }
];

const COLORS_PROYECTO = [
  "#2563EB", "#10B981", "#D97706", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"
];

const COLORS_TIPOLOGIA = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1"
];

export default function StockDisponibleTab({
  tcList = [],
  fmt = (n) => Number(n || 0).toLocaleString("es-AR")
}) {
  // TC Referencia: Por defecto $1.550 (según planilla oficial Link 2027) o último del sistema
  const tcPorDefecto = useMemo(() => {
    if (tcList && tcList.length > 0) {
      const sorted = [...tcList].sort((a, b) => b.fecha_corte.localeCompare(a.fecha_corte));
      const val = Number(sorted[0].saldo_efectivo);
      if (val > 0) return val;
    }
    return 1550; // TC exacto del Excel oficial
  }, [tcList]);

  const [tcReferencia, setTcReferencia] = useState(tcPorDefecto);
  const [moneda, setMoneda] = useState("USD"); // "USD" | "ARS"
  const [viewMode, setViewMode] = useState("unidades"); // "unidades" | "proyectos" | "graficos"
  
  // Lista de unidades (Sincronizada con Supabase Cloud)
  const [unidades, setUnidades] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading stock from localStorage:", e);
    }
    return DEFAULT_STOCK_UNITS;
  });

  const [syncingStock, setSyncingStock] = useState(false);
  const initialStockLoaded = useRef(false);

  // Carga inicial desde Supabase Cloud
  const cargarStockNube = async () => {
    setSyncingStock(true);
    try {
      const { data, error } = await supabase.from("stock_units").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        setUnidades(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Error cargando stock desde la nube:", err);
    } finally {
      setSyncingStock(false);
      initialStockLoaded.current = true;
    }
  };

  useEffect(() => {
    cargarStockNube();
  }, []);

  // Guardar en localStorage y sincronizar con Supabase Cloud
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(unidades));
    } catch (e) {
      console.error("Error saving stock to localStorage:", e);
    }

    if (!initialStockLoaded.current) return;

    const timer = setTimeout(async () => {
      try {
        await supabase.from("stock_units").setAll(unidades);
      } catch (err) {
        console.warn("Error guardando stock en Supabase Cloud:", err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [unidades]);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedProyecto, setSelectedProyecto] = useState("TODOS");
  const [selectedTipologia, setSelectedTipologia] = useState("TODAS");
  const [selectedEstado, setSelectedEstado] = useState("TODOS");
  const [sortBy, setSortBy] = useState("proyecto"); // "proyecto" | "precio_desc" | "precio_asc" | "m2_desc"

  // Modal Importador de Stock Excel / CSV
  const [importadorAbierto, setImportadorAbierto] = useState(false);

  // Lista dinámica de proyectos (incluye los del inventario actual importado)
  const todosLosProyectos = useMemo(() => {
    const list = [...PROYECTOS_STOCK];
    unidades.forEach(u => {
      if (u.proyecto && !list.includes(u.proyecto)) {
        list.push(u.proyecto);
      }
    });
    return list;
  }, [unidades]);

  // Manejador de importación masiva
  const handleImportarStock = (nuevasUnidades, modo) => {
    if (modo === "reemplazar") {
      setUnidades(nuevasUnidades);
    } else {
      setUnidades(prev => [...nuevasUnidades, ...prev]);
    }
  };

  // Modal Crear / Editar Unidad
  const [modalAbierto, setModalAbierto] = useState(false);
  const [unidadEnEdicion, setUnidadEnEdicion] = useState(null);
  const [formData, setFormData] = useState({
    proyecto: PROYECTOS_STOCK[0],
    unidad: "",
    tipologia: TIPOLOGIAS_STOCK[1],
    piso: "Piso 1",
    orientacion: "Frente",
    m2_propios: "",
    m2_totales: "",
    precio_usd: "",
    precio_m2_usd: "",
    estado: "Disponible",
    observaciones: "",
    entrega_estimada: "2027"
  });

  // Totales Globales
  const totalValuacionUSD = useMemo(() => {
    return unidades.reduce((acc, u) => acc + (Number(u.precio_usd) || 0), 0);
  }, [unidades]);

  const totalValuacionARS = useMemo(() => {
    return totalValuacionUSD * tcReferencia;
  }, [totalValuacionUSD, tcReferencia]);

  const totalM2Propios = useMemo(() => {
    return unidades.reduce((acc, u) => acc + (Number(u.m2_propios) || 0), 0);
  }, [unidades]);

  const totalDisponibles = useMemo(() => {
    return unidades.filter(u => u.estado === "Disponible").length;
  }, [unidades]);

  const totalReservadas = useMemo(() => {
    return unidades.filter(u => u.estado === "Reservado" || u.estado === "En Negociación").length;
  }, [unidades]);

  const valorPromedioM2USD = useMemo(() => {
    return totalM2Propios > 0 ? totalValuacionUSD / totalM2Propios : 0;
  }, [totalValuacionUSD, totalM2Propios]);

  const ticketPromedioUSD = useMemo(() => {
    return unidades.length > 0 ? totalValuacionUSD / unidades.length : 0;
  }, [totalValuacionUSD, unidades]);

  // Resumen Valuado por Proyecto
  const resumenPorProyecto = useMemo(() => {
    const map = {};
    unidades.forEach(u => {
      const p = u.proyecto || "Otros";
      if (!map[p]) {
        map[p] = {
          proyecto: p,
          unidadesCount: 0,
          disponiblesCount: 0,
          reservadasCount: 0,
          m2_propios: 0,
          m2_totales: 0,
          precio_usd: 0
        };
      }
      map[p].unidadesCount += 1;
      if (u.estado === "Disponible") map[p].disponiblesCount += 1;
      if (u.estado === "Reservado" || u.estado === "En Negociación") map[p].reservadasCount += 1;
      map[p].m2_propios += Number(u.m2_propios) || 0;
      map[p].m2_totales += Number(u.m2_totales) || 0;
      map[p].precio_usd += Number(u.precio_usd) || 0;
    });

    return Object.values(map).map(item => {
      const pctTotal = totalValuacionUSD > 0 ? (item.precio_usd / totalValuacionUSD) * 100 : 0;
      const valorM2 = item.m2_propios > 0 ? item.precio_usd / item.m2_propios : 0;
      const ticketProm = item.unidadesCount > 0 ? item.precio_usd / item.unidadesCount : 0;
      return {
        ...item,
        precio_ars: item.precio_usd * tcReferencia,
        pctTotal,
        valorM2,
        ticketProm
      };
    }).sort((a, b) => b.precio_usd - a.precio_usd);
  }, [unidades, totalValuacionUSD, tcReferencia]);

  // Datos para Gráficos Claros (No oscuros)
  const chartDataProyectos = useMemo(() => {
    return resumenPorProyecto.map((p, idx) => ({
      name: p.proyecto.replace(" Proyecto", "").replace("Cupo ", ""),
      fullName: p.proyecto,
      valuacionUSD: Math.round(p.precio_usd),
      valuacionKUSD: Math.round(p.precio_usd / 1000),
      valuacionM_ARS: Number((p.precio_ars / 1_000_000).toFixed(1)),
      pctTotal: p.pctTotal,
      unidades: p.unidadesCount,
      color: COLORS_PROYECTO[idx % COLORS_PROYECTO.length]
    }));
  }, [resumenPorProyecto]);

  const chartDataTipologias = useMemo(() => {
    const map = {};
    unidades.forEach(u => {
      const t = u.tipologia || "Otros";
      if (!map[t]) map[t] = { name: t, value: 0, count: 0 };
      map[t].value += Number(u.precio_usd) || 0;
      map[t].count += 1;
    });
    return Object.values(map).map((t, idx) => ({
      ...t,
      pct: totalValuacionUSD > 0 ? (t.value / totalValuacionUSD) * 100 : 0,
      color: COLORS_TIPOLOGIA[idx % COLORS_TIPOLOGIA.length]
    })).sort((a, b) => b.value - a.value);
  }, [unidades, totalValuacionUSD]);

  // Filtrado y Ordenamiento de Unidades
  const unidadesFiltradas = useMemo(() => {
    return unidades.filter(u => {
      if (selectedProyecto !== "TODOS" && u.proyecto !== selectedProyecto) return false;
      if (selectedTipologia !== "TODAS" && u.tipologia !== selectedTipologia) return false;
      if (selectedEstado !== "TODOS" && u.estado !== selectedEstado) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (u.proyecto || "").toLowerCase().includes(q) ||
          (u.unidad || "").toLowerCase().includes(q) ||
          (u.tipologia || "").toLowerCase().includes(q) ||
          (u.piso || "").toLowerCase().includes(q) ||
          (u.observaciones || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === "proyecto") {
        const cmp = (a.proyecto || "").localeCompare(b.proyecto || "");
        if (cmp !== 0) return cmp;
        return (a.unidad || "").localeCompare(b.unidad || "");
      }
      if (sortBy === "precio_desc") return (b.precio_usd || 0) - (a.precio_usd || 0);
      if (sortBy === "precio_asc") return (a.precio_usd || 0) - (b.precio_usd || 0);
      if (sortBy === "m2_desc") return (b.m2_propios || 0) - (a.m2_propios || 0);
      return 0;
    });
  }, [unidades, selectedProyecto, selectedTipologia, selectedEstado, search, sortBy]);

  // Abrir Modal para Crear
  const abrirModalCrear = () => {
    setUnidadEnEdicion(null);
    setFormData({
      proyecto: PROYECTOS_STOCK[0],
      unidad: "",
      tipologia: TIPOLOGIAS_STOCK[1],
      piso: "Piso 1",
      orientacion: "Frente",
      m2_propios: "",
      m2_totales: "",
      precio_usd: "",
      precio_m2_usd: "",
      estado: "Disponible",
      observaciones: "",
      entrega_estimada: "2027"
    });
    setModalAbierto(true);
  };

  // Abrir Modal para Editar
  const abrirModalEditar = (u) => {
    setUnidadEnEdicion(u);
    setFormData({
      proyecto: u.proyecto || PROYECTOS_STOCK[0],
      unidad: u.unidad || "",
      tipologia: u.tipologia || TIPOLOGIAS_STOCK[1],
      piso: u.piso || "",
      orientacion: u.orientacion || "",
      m2_propios: u.m2_propios || "",
      m2_totales: u.m2_totales || "",
      precio_usd: u.precio_usd || "",
      precio_m2_usd: u.precio_m2_usd || "",
      estado: u.estado || "Disponible",
      observaciones: u.observaciones || "",
      entrega_estimada: u.entrega_estimada || "2027"
    });
    setModalAbierto(true);
  };

  // Guardar Unidad
  const guardarUnidad = (e) => {
    e.preventDefault();
    if (!formData.proyecto || !formData.unidad) {
      alert("Por favor indica el Proyecto y la Identificación de la Unidad.");
      return;
    }

    const m2p = Number(formData.m2_propios) || 0;
    const m2t = Number(formData.m2_totales) || m2p;
    let pusd = Number(formData.precio_usd) || 0;
    let pm2 = Number(formData.precio_m2_usd) || 0;

    if (pusd > 0 && m2p > 0 && pm2 === 0) {
      pm2 = Math.round(pusd / m2p);
    } else if (pm2 > 0 && m2p > 0 && pusd === 0) {
      pusd = Math.round(pm2 * m2p);
    }

    if (unidadEnEdicion) {
      setUnidades(prev => prev.map(u => u.id === unidadEnEdicion.id ? {
        ...u,
        ...formData,
        m2_propios: m2p,
        m2_totales: m2t,
        precio_usd: pusd,
        precio_m2_usd: pm2
      } : u));
    } else {
      const nueva = {
        id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        ...formData,
        m2_propios: m2p,
        m2_totales: m2t,
        precio_usd: pusd,
        precio_m2_usd: pm2
      };
      setUnidades(prev => [nueva, ...prev]);
    }

    setModalAbierto(false);
  };

  // Eliminar Unidad
  const eliminarUnidad = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar esta unidad del stock disponible?")) {
      setUnidades(prev => prev.filter(u => u.id !== id));
    }
  };

  // Restaurar inventario base
  const restaurarBase = () => {
    if (window.confirm("¿Restaurar el inventario base oficial de unidades Link Inversiones?")) {
      setUnidades(DEFAULT_STOCK_UNITS);
    }
  };

  // Exportar a CSV / Excel
  const exportarCSV = () => {
    const headers = [
      "Proyecto",
      "Unidad",
      "Tipologia",
      "Piso",
      "Orientacion",
      "M2_Propios",
      "M2_Totales",
      "Valuacion_USD",
      "USD_M2",
      "Valuacion_ARS",
      "Pct_Stock_Total",
      "Estado",
      "Observaciones",
      "Entrega_Estimada"
    ];

    const rows = unidades.map(u => {
      const pct = totalValuacionUSD > 0 ? ((u.precio_usd || 0) / totalValuacionUSD * 100).toFixed(2) : "0.00";
      const ars = Math.round((u.precio_usd || 0) * tcReferencia);
      return [
        `"${u.proyecto || ""}"`,
        `"${u.unidad || ""}"`,
        `"${u.tipologia || ""}"`,
        `"${u.piso || ""}"`,
        `"${u.orientacion || ""}"`,
        u.m2_propios || 0,
        u.m2_totales || 0,
        u.precio_usd || 0,
        u.precio_m2_usd || 0,
        ars,
        `${pct}%`,
        `"${u.estado || ""}"`,
        `"${(u.observaciones || "").replace(/"/g, '""')}"`,
        `"${u.entrega_estimada || ""}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Disponible_Link_Inversiones_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── BARRA SUPERIOR: ENCABEZADO Y ACCIONES PRINCIPALES ── */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF"
            }}>
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 700, color: "#0F172A" }}>
                Stock Disponible de Unidades
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: 13, color: "#64748B" }}>
                Inventario de unidades a la venta valuadas tal como en la planilla oficial (Proyecto - Unidades - Valuación).
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          
          {/* CONTROL TIPO DE CAMBIO */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            padding: "5px 10px",
            borderRadius: 8
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>TC Ref:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", fontFamily: tokens.fontMono }}>$</span>
            <input
              type="number"
              value={tcReferencia}
              onChange={(e) => setTcReferencia(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 70,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: tokens.fontMono,
                border: "none",
                background: "transparent",
                color: "#0F172A",
                outline: "none"
              }}
              title="Tipo de cambio de referencia para valuación en Pesos (por defecto $1.550 como en el Excel)"
            />
          </div>

          {/* TOGGLE MONEDA */}
          <div style={{
            display: "flex",
            background: "#F1F5F9",
            borderRadius: 8,
            padding: 3,
            border: "1px solid #CBD5E1"
          }}>
            <button
              type="button"
              onClick={() => setMoneda("USD")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                border: "none",
                background: moneda === "USD" ? "#0F172A" : "transparent",
                color: moneda === "USD" ? "#FFFFFF" : "#64748B",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease"
              }}
            >
              USD (Dólares)
            </button>
            <button
              type="button"
              onClick={() => setMoneda("ARS")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                border: "none",
                background: moneda === "ARS" ? "#0F172A" : "transparent",
                color: moneda === "ARS" ? "#FFFFFF" : "#64748B",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease"
              }}
            >
              ARS (Pesos)
            </button>
          </div>

          {/* BOTÓN NUEVA UNIDAD */}
          <button
            onClick={abrirModalCrear}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
            }}
          >
            <Plus size={16} /> Nueva Unidad
          </button>

          {/* BOTÓN SINCRONIZAR NUBE */}
          <button
            onClick={cargarStockNube}
            disabled={syncingStock}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "8px 12px",
              background: "#F0FDF4",
              color: "#166534",
              border: "1px solid #BBF7D0",
              borderRadius: 8,
              cursor: syncingStock ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
            title="Sincronizar y recargar inventario desde la nube de Supabase"
          >
            <RefreshCw size={14} style={{ animation: syncingStock ? "spin 1s linear infinite" : "none" }} />
            {syncingStock ? "Sincronizando..." : "Sincronizar Nube"}
          </button>

          {/* BOTÓN IMPORTAR EXCEL / CSV */}
          <button
            onClick={() => setImportadorAbierto(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#ECFDF5",
              color: "#065F46",
              border: "1px solid #A7F3D0",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "0 1px 3px rgba(16, 185, 129, 0.15)"
            }}
            title="Importar inventario de disponibles desde Excel (.xlsx, .xls) o CSV con formato oficial"
          >
            <Upload size={15} color="#059669" /> Importar Excel
          </button>

          {/* BOTÓN EXPORTAR CSV */}
          <button
            onClick={exportarCSV}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              background: "#F8FAFC",
              color: "#334155",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12.5
            }}
            title="Exportar inventario actual a CSV / Excel"
          >
            <Download size={14} /> Exportar Excel
          </button>

          {/* BOTÓN RESTAURAR BASE */}
          <button
            onClick={restaurarBase}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "8px 10px",
              background: "transparent",
              color: "#64748B",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12
            }}
            title="Restaurar datos base oficiales"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS (FONDOS CLAROS Y LEGIBLES) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        
        {/* KPI 1: VALUACIÓN TOTAL DEL STOCK */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          borderTop: "3px solid #10B981",
          padding: "16px 18px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Valuación Total Stock
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#ECFDF5", color: "#065F46", padding: "2px 6px", borderRadius: 4 }}>
              100% Stock
            </span>
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 23, fontWeight: 800, color: "#0F172A", marginTop: 8 }}>
            {moneda === "USD"
              ? `USD ${Math.round(totalValuacionUSD).toLocaleString("es-AR")}`
              : `$ ${(totalValuacionARS / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4, fontFamily: tokens.fontMono }}>
            {moneda === "USD"
              ? `$ ${(totalValuacionARS / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M (TC $${fmt(tcReferencia)})`
              : `USD ${Math.round(totalValuacionUSD).toLocaleString("es-AR")}`}
          </div>
        </div>

        {/* KPI 2: UNIDADES TOTALES Y DISPONIBILIDAD */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          borderTop: "3px solid #3B82F6",
          padding: "16px 18px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Unidades en Cartera
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", padding: "2px 6px", borderRadius: 4 }}>
              {unidades.length} u. totales
            </span>
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 23, fontWeight: 800, color: "#0F172A", marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{totalDisponibles}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#10B981" }}>disponibles</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
            {totalReservadas > 0 ? `${totalReservadas} en reserva / negociación` : "Sin reservas activas"}
          </div>
        </div>

        {/* KPI 3: METROS CUADRADOS COMERCIALIZABLES */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          borderTop: "3px solid #F59E0B",
          padding: "16px 18px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Superficie Propia
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#FFFBEB", color: "#92400E", padding: "2px 6px", borderRadius: 4 }}>
              m² Propios
            </span>
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 23, fontWeight: 800, color: "#0F172A", marginTop: 8 }}>
            {Math.round(totalM2Propios).toLocaleString("es-AR")} m²
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
            Sup. promedio: {unidades.length > 0 ? (totalM2Propios / unidades.length).toFixed(1) : 0} m² / u.
          </div>
        </div>

        {/* KPI 4: VALOR PROMEDIO M² */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          borderTop: "3px solid #8B5CF6",
          padding: "16px 18px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Valor Promedio m²
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#F5F3FF", color: "#5B21B6", padding: "2px 6px", borderRadius: 4 }}>
              Ponderado
            </span>
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 23, fontWeight: 800, color: "#0F172A", marginTop: 8 }}>
            USD {Math.round(valorPromedioM2USD).toLocaleString("es-AR")} / m²
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
            Ticket Promedio: USD {Math.round(ticketPromedioUSD).toLocaleString("es-AR")}
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE VISTA (UNIDADES · PROYECTOS · GRÁFICOS) ── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        background: "#FFFFFF",
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px solid #E2E8F0"
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setViewMode("unidades")}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 6,
              border: "none",
              background: viewMode === "unidades" ? "#0F172A" : "transparent",
              color: viewMode === "unidades" ? "#FFFFFF" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease"
            }}
          >
            <Layers size={15} /> Detalle Unidades ({unidadesFiltradas.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("proyectos")}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 6,
              border: "none",
              background: viewMode === "proyectos" ? "#0F172A" : "transparent",
              color: viewMode === "proyectos" ? "#FFFFFF" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease"
            }}
          >
            <Building2 size={15} /> Resumen por Proyecto ({resumenPorProyecto.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("graficos")}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 6,
              border: "none",
              background: viewMode === "graficos" ? "#0F172A" : "transparent",
              color: viewMode === "graficos" ? "#FFFFFF" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease"
            }}
          >
            <BarChart3 size={15} /> Gráficos de Stock
          </button>
        </div>

        {/* CONTROLES DE FILTRADO RÁPIDO */}
        {viewMode === "unidades" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* BUSCADOR */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              padding: "4px 8px"
            }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Buscar unidad, piso, proyecto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 12,
                  outline: "none",
                  width: 170,
                  color: "#0F172A"
                }}
              />
              {search && (
                <X size={13} style={{ cursor: "pointer", color: "#94A3B8" }} onClick={() => setSearch("")} />
              )}
            </div>

            {/* FILTRO PROYECTO */}
            <select
              value={selectedProyecto}
              onChange={(e) => setSelectedProyecto(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#334155",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="TODOS">Todos los Proyectos</option>
              {todosLosProyectos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* FILTRO ESTADO */}
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#334155",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="TODOS">Todos los Estados</option>
              {ESTADOS.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>

            {/* ORDEN */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#334155",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="proyecto">Agrupar por Proyecto</option>
              <option value="precio_desc">Mayor Valuación</option>
              <option value="precio_asc">Menor Valuación</option>
              <option value="m2_desc">Mayor Superficie m²</option>
            </select>
          </div>
        )}
      </div>

      {/* ── VISTA 1: TABLA DETALLADA DE UNIDADES (PROYECTO - UNIDADES - VALUACIÓN) ── */}
      {viewMode === "unidades" && (
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          overflow: "hidden"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Proyecto</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Unidad / Identificación</th>
                  <th style={{ padding: "12px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipología</th>
                  <th style={{ padding: "12px 10px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Piso</th>
                  <th style={{ padding: "12px 10px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Sup. Propia</th>
                  <th style={{ padding: "12px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Valor m²</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right", color: "#065F46" }}>
                    Valuación ({moneda})
                  </th>
                  <th style={{ padding: "12px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", color: "#B45309" }}>
                    % s/ Stock Total
                  </th>
                  <th style={{ padding: "12px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Estado</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {unidadesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                      No se encontraron unidades con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  unidadesFiltradas.map((u, index) => {
                    const pctOfTotal = totalValuacionUSD > 0 ? ((u.precio_usd || 0) / totalValuacionUSD * 100) : 0;
                    const estObj = ESTADOS.find(e => e.id === u.estado) || ESTADOS[0];
                    const valARS = (u.precio_usd || 0) * tcReferencia;

                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          background: index % 2 === 0 ? "#FFFFFF" : "#FAFAFC",
                          transition: "background 0.15s"
                        }}
                      >
                        {/* PROYECTO */}
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1E293B" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: u.proyecto.includes("+ DUO") ? "#2563EB" :
                                         u.proyecto.includes("Green") ? "#10B981" :
                                         u.proyecto.includes("Auria") ? "#D97706" :
                                         u.proyecto.includes("# 300") ? "#8B5CF6" :
                                         u.proyecto.includes("Boulevard") ? "#EC4899" : "#64748B"
                            }} />
                            <span>{u.proyecto}</span>
                          </div>
                          {u.entrega_estimada && (
                            <span style={{ fontSize: 10.5, color: "#94A3B8", marginLeft: 14 }}>Entrega: {u.entrega_estimada}</span>
                          )}
                        </td>

                        {/* UNIDAD */}
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A" }}>
                          <div>{u.unidad}</div>
                          {u.observaciones && (
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.observaciones}>
                              {u.observaciones}
                            </div>
                          )}
                        </td>

                        {/* TIPOLOGÍA */}
                        <td style={{ padding: "12px 12px" }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#F1F5F9",
                            color: "#334155"
                          }}>
                            {u.tipologia}
                          </span>
                        </td>

                        {/* PISO */}
                        <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748B", fontSize: 12 }}>
                          {u.piso || "-"}
                        </td>

                        {/* SUPERFICIE M2 */}
                        <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600, color: "#334155" }}>
                          {u.m2_propios ? `${u.m2_propios} m²` : "-"}
                        </td>

                        {/* VALOR M2 */}
                        <td style={{ padding: "12px 12px", textAlign: "right", fontFamily: tokens.fontMono, color: "#64748B", fontSize: 12 }}>
                          {u.precio_m2_usd ? `USD ${Math.round(u.precio_m2_usd).toLocaleString("es-AR")}` : "-"}
                        </td>

                        {/* VALUACIÓN EXACTA */}
                        <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 800, color: "#0F172A", background: "#F0FDF4" }}>
                          {moneda === "USD" ? (
                            <div>
                              <div style={{ color: "#065F46", fontSize: 14 }}>
                                USD {Math.round(u.precio_usd || 0).toLocaleString("es-AR")}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 500 }}>
                                $ {(valARS / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ color: "#065F46", fontSize: 14 }}>
                                $ {Math.round(valARS).toLocaleString("es-AR")}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 500 }}>
                                USD {Math.round(u.precio_usd || 0).toLocaleString("es-AR")}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* % QUE REPRESENTA DEL TOTAL (REQUERIMIENTO DEL USUARIO) */}
                        <td style={{ padding: "12px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: tokens.fontMono,
                            background: "#FEF3C7",
                            color: "#92400E",
                            border: "1px solid #FDE68A"
                          }}>
                            {pctOfTotal.toFixed(2)}%
                          </span>
                        </td>

                        {/* ESTADO */}
                        <td style={{ padding: "12px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 9px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: estObj.bg,
                            color: estObj.color,
                            border: `1px solid ${estObj.border}`
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: estObj.color }} />
                            {estObj.label}
                          </span>
                        </td>

                        {/* ACCIONES */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                            <button
                              onClick={() => abrirModalEditar(u)}
                              style={{
                                padding: 5,
                                background: "#F1F5F9",
                                border: "1px solid #CBD5E1",
                                borderRadius: 5,
                                cursor: "pointer",
                                color: "#334155"
                              }}
                              title="Editar datos de unidad"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => eliminarUnidad(u.id)}
                              style={{
                                padding: 5,
                                background: "#FEF2F2",
                                border: "1px solid #FECACA",
                                borderRadius: 5,
                                cursor: "pointer",
                                color: "#EF4444"
                              }}
                              title="Eliminar del stock"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* PIE DE TABLA CON TOTALES */}
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #CBD5E1" }}>
                  <td colSpan={4} style={{ padding: "14px 16px", fontWeight: 800, color: "#0F172A" }}>
                    TOTAL STOCK DISPONIBLE ({unidadesFiltradas.length} de {unidades.length} unidades)
                  </td>
                  <td style={{ padding: "14px 10px", textAlign: "right", fontWeight: 800, fontFamily: tokens.fontMono, color: "#0F172A" }}>
                    {Math.round(unidadesFiltradas.reduce((acc, u) => acc + (Number(u.m2_propios) || 0), 0)).toLocaleString("es-AR")} m²
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: "#64748B", fontSize: 12 }}>
                    USD {Math.round(valorPromedioM2USD).toLocaleString("es-AR")} / m²
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 900, fontFamily: tokens.fontMono, color: "#065F46", fontSize: 15, background: "#DCFCE7" }}>
                    {moneda === "USD"
                      ? `USD ${Math.round(unidadesFiltradas.reduce((acc, u) => acc + (Number(u.precio_usd) || 0), 0)).toLocaleString("es-AR")}`
                      : `$ ${(unidadesFiltradas.reduce((acc, u) => acc + (Number(u.precio_usd) || 0), 0) * tcReferencia / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`}
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "center", fontWeight: 900, fontFamily: tokens.fontMono, color: "#92400E", background: "#FEF3C7" }}>
                    {totalValuacionUSD > 0
                      ? `${(unidadesFiltradas.reduce((acc, u) => acc + (Number(u.precio_usd) || 0), 0) / totalValuacionUSD * 100).toFixed(1)}%`
                      : "100%"}
                  </td>
                  <td colSpan={2} style={{ padding: "14px 16px", textAlign: "center", color: "#64748B", fontSize: 12 }}>
                    {totalDisponibles} disp. · {totalReservadas} res.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── VISTA 2: RESUMEN VALUADO POR PROYECTO (PROYECTO - UNIDADES - VALUACIÓN - % TOTAL) ── */}
      {viewMode === "proyectos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: "1px solid #E2E8F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                  Valuación Consolidada de Stock por Proyecto
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "#64748B" }}>
                  Desglose de unidades comercializables, metros cuadrados totales y participación % de cada proyecto en el valor del stock.
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46", background: "#ECFDF5", padding: "4px 10px", borderRadius: 8 }}>
                Valuación Global: USD {Math.round(totalValuacionUSD).toLocaleString("es-AR")}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", color: "#475569" }}>
                    <th style={{ padding: "12px 18px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase" }}>Proyecto</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", textAlign: "center" }}>Unidades Disp.</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", textAlign: "right" }}>Sup. Total (m²)</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", textAlign: "right" }}>Ticket Promedio</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", textAlign: "right" }}>Valor m² Ponderado</th>
                    <th style={{ padding: "12px 18px", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", textAlign: "right", color: "#065F46" }}>Valuación USD</th>
                    <th style={{ padding: "12px 18px", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", textAlign: "right", color: "#1E3A8A" }}>Valuación ARS</th>
                    <th style={{ padding: "12px 16px", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", textAlign: "center", color: "#B45309" }}>% s/ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorProyecto.map((p, index) => {
                    const colorBar = COLORS_PROYECTO[index % COLORS_PROYECTO.length];
                    return (
                      <tr key={p.proyecto} style={{ borderBottom: "1px solid #F1F5F9", background: index % 2 === 0 ? "#FFFFFF" : "#FAFAFC" }}>
                        <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0F172A" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: colorBar }} />
                            <span>{p.proyecto}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "center", fontWeight: 700, fontFamily: tokens.fontMono }}>
                          <span style={{ color: "#10B981" }}>{p.disponiblesCount}</span>
                          {p.reservadasCount > 0 && (
                            <span style={{ fontSize: 11, color: "#F59E0B", marginLeft: 4 }}>
                              (+{p.reservadasCount} res.)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                          {Math.round(p.m2_propios).toLocaleString("es-AR")} m²
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: tokens.fontMono, color: "#64748B" }}>
                          USD {Math.round(p.ticketProm).toLocaleString("es-AR")}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: tokens.fontMono, color: "#64748B" }}>
                          USD {Math.round(p.valorM2).toLocaleString("es-AR")}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 800, color: "#065F46", fontSize: 14 }}>
                          USD {Math.round(p.precio_usd).toLocaleString("es-AR")}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: "#1E3A8A" }}>
                          $ {(p.precio_ars / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <div style={{ width: 50, height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, p.pctTotal)}%`, height: "100%", background: colorBar, borderRadius: 3 }} />
                            </div>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: 10,
                              fontSize: 11,
                              fontWeight: 800,
                              fontFamily: tokens.fontMono,
                              background: "#FEF3C7",
                              color: "#92400E"
                            }}>
                              {p.pctTotal.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F1F5F9", borderTop: "2px solid #CBD5E1" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 900, color: "#0F172A" }}>TOTAL GENERAL STOCK</td>
                    <td style={{ padding: "14px 14px", textAlign: "center", fontWeight: 900, fontFamily: tokens.fontMono, color: "#0F172A" }}>
                      {unidades.length} u.
                    </td>
                    <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 900, fontFamily: tokens.fontMono, color: "#0F172A" }}>
                      {Math.round(totalM2Propios).toLocaleString("es-AR")} m²
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: "#64748B" }}>
                      USD {Math.round(ticketPromedioUSD).toLocaleString("es-AR")}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, color: "#64748B" }}>
                      USD {Math.round(valorPromedioM2USD).toLocaleString("es-AR")}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, fontFamily: tokens.fontMono, color: "#065F46", fontSize: 15, background: "#DCFCE7" }}>
                      USD {Math.round(totalValuacionUSD).toLocaleString("es-AR")}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, fontFamily: tokens.fontMono, color: "#1E3A8A", fontSize: 14 }}>
                      $ {(totalValuacionARS / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 900, fontFamily: tokens.fontMono, color: "#92400E", background: "#FEF3C7" }}>
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VISTA 3: GRÁFICOS CLAROS DE STOCK (SIN FONDOS OSCUROS) ── */}
      {viewMode === "graficos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
          
          {/* GRÁFICO 1: RANKING DE VALUACIÓN POR PROYECTO (FONDO CLARO) */}
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: "1px solid #E2E8F0",
            padding: "20px 22px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                  Valuación de Stock por Proyecto (USD)
                </h3>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Distribución del capital disponible en cada desarrollo
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", padding: "3px 8px", borderRadius: 6 }}>
                En miles de USD (kUSD)
              </span>
            </div>

            <div style={{ height: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataProyectos} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `USD ${v}k`} tick={{ fill: "#64748B", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#0F172A", fontSize: 12, fontWeight: 600 }} width={120} />
                  <Tooltip
                    formatter={(val, name, props) => [
                      `USD ${val.toLocaleString("es-AR")}k (${props.payload.pctTotal.toFixed(1)}% del stock)`,
                      "Valuación"
                    ]}
                    contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  />
                  <Bar dataKey="valuacionKUSD" fill="#3B82F6" radius={[0, 6, 6, 0]}>
                    {chartDataProyectos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Listado con % al lado de cada concepto */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {chartDataProyectos.map(item => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    <span style={{ color: "#334155", fontWeight: 600 }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontFamily: tokens.fontMono, color: "#0F172A" }}>
                    USD {item.valuacionKUSD}k <span style={{ color: "#B45309", background: "#FEF3C7", padding: "1px 5px", borderRadius: 4, fontSize: 10.5 }}>{item.pctTotal.toFixed(1)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 2: COMPOSICIÓN DE STOCK POR TIPOLOGÍA (DONUT CLARA) */}
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: "1px solid #E2E8F0",
            padding: "20px 22px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                  Composición por Tipología de Unidad
                </h3>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Participación en valor y cantidad de unidades
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#065F46", padding: "3px 8px", borderRadius: 6 }}>
                100% Stock Valuado
              </span>
            </div>

            <div style={{ height: 260, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataTipologias}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {chartDataTipologias.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, props) => [
                      `USD ${Math.round(val).toLocaleString("es-AR")} (${props.payload.pct.toFixed(1)}% · ${props.payload.count} u.)`,
                      name
                    ]}
                    contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  />
                  <Legend
                    formatter={(val, entry) => (
                      <span style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>
                        {val} <span style={{ color: "#059669", fontWeight: 700 }}>({entry.payload.pct.toFixed(1)}%)</span>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {chartDataTipologias.map(item => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    <span style={{ color: "#334155" }}>{item.name} ({item.count} u.)</span>
                  </div>
                  <span style={{ fontWeight: 700, fontFamily: tokens.fontMono, color: "#065F46" }}>
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR UNIDAD ── */}
      {modalAbierto && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: 14,
            width: "100%",
            maxWidth: 580,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 22px",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={18} color="#2563EB" />
                {unidadEnEdicion ? "Editar Unidad de Stock" : "Nueva Unidad de Stock Disponible"}
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarUnidad} style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Proyecto *
                  </label>
                  <select
                    value={formData.proyecto}
                    onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, background: "#FFFFFF", outline: "none" }}
                    required
                  >
                    {PROYECTOS_STOCK.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Identificación de Unidad *
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Piso 04 - Depto B"
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Tipología
                  </label>
                  <select
                    value={formData.tipologia}
                    onChange={(e) => setFormData({ ...formData, tipologia: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, background: "#FFFFFF", outline: "none" }}
                  >
                    {TIPOLOGIAS_STOCK.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Piso / Nivel
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Piso 4"
                    value={formData.piso}
                    onChange={(e) => setFormData({ ...formData, piso: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, background: "#FFFFFF", outline: "none" }}
                  >
                    {ESTADOS.map(e => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Sup. Propia (m²)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ej. 52.5"
                    value={formData.m2_propios}
                    onChange={(e) => {
                      const m2 = e.target.value;
                      const next = { ...formData, m2_propios: m2 };
                      if (Number(m2) > 0 && Number(formData.precio_usd) > 0) {
                        next.precio_m2_usd = Math.round(Number(formData.precio_usd) / Number(m2));
                      }
                      setFormData(next);
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Sup. Total (m²)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ej. 60.0"
                    value={formData.m2_totales}
                    onChange={(e) => setFormData({ ...formData, m2_totales: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Valuación USD ($) *
                  </label>
                  <input
                    type="number"
                    placeholder="ej. 98000"
                    value={formData.precio_usd}
                    onChange={(e) => {
                      const pusd = e.target.value;
                      const next = { ...formData, precio_usd: pusd };
                      if (Number(pusd) > 0 && Number(formData.m2_propios) > 0) {
                        next.precio_m2_usd = Math.round(Number(pusd) / Number(formData.m2_propios));
                      }
                      setFormData(next);
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", fontWeight: 700, color: "#065F46" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Valor por m² (USD/m²)
                  </label>
                  <input
                    type="number"
                    placeholder="ej. 1900"
                    value={formData.precio_m2_usd}
                    onChange={(e) => {
                      const pm2 = e.target.value;
                      const next = { ...formData, precio_m2_usd: pm2 };
                      if (Number(pm2) > 0 && Number(formData.m2_propios) > 0) {
                        next.precio_usd = Math.round(Number(pm2) * Number(formData.m2_propios));
                      }
                      setFormData(next);
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Observaciones / Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Balcón terraza, vista al parque, cochera opcional..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer", fontWeight: 600, color: "#475569" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#10B981", color: "#FFFFFF", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Check size={16} /> Guardar Unidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTADOR DE STOCK DESDE EXCEL / CSV ── */}
      {importadorAbierto && (
        <ImportadorStockModal
          onImportar={handleImportarStock}
          onClose={() => setImportadorAbierto(false)}
          unidadesActualesCount={unidades.length}
        />
      )}

    </div>
  );
}
