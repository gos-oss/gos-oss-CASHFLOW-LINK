import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import {
  PROYECTOS_CARTERA_CC,
  ASIGNACIONES_CC,
  SEGMENTACIONES_MOROSIDAD,
  VARIABLES_ACTUALIZACION,
  MEDIOS_PAGO_CC,
  CONDICIONES_FISCALES,
  DEFAULT_CC_CLIENTES,
  DEFAULT_CC_VENTAS,
  DEFAULT_CC_CUOTAS,
  DEFAULT_CC_COBRANZAS,
  DEFAULT_INDICES_MENSUALES_CC,
  generarId,
  formatearPeriodoLabel,
  sumarMesesFecha,
  calcularCuotaConIndice,
  generarPlanCuotasVenta,
  getVariableMeta,
  getPeriodoAnterior,
  getDefaultIndiceValor
} from "./cuentasCorrientesData";
import { DEFAULT_STOCK_UNITS, normalizarNombreProyecto } from "./stockData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend
} from "recharts";
import {
  Users, FileText, Calculator, Wallet, BarChart3, Plus, Search,
  Download, CheckCircle2, Clock, AlertTriangle, Edit2, Trash2,
  X, Check, ChevronRight, Building2, DollarSign, Calendar,
  Receipt, RefreshCw, Eye, RotateCcw, ArrowLeft, Sliders, ChevronDown, ChevronUp
} from "lucide-react";
import * as XLSX from "xlsx";

const colorLineaSuave = "#DCE1E8";
const colorLineaFuerte = "#C2CAD4";
const colorTablaBg = "#F4F6F8";

const LOCAL_INDICES_KEY = "cf_cc_indices_periodo_v2";
const OLD_LOCAL_INDICES_KEY = "cf_cc_indices_periodo_v1";

const DEFAULT_INDICES_PERIODO = DEFAULT_INDICES_MENSUALES_CC;

export default function CuentasCorrientesTab({
  tcList = [],
  fmt = (n) => Number(n || 0).toLocaleString("es-AR"),
  formatDate = (iso) => iso,
  onRegistrarCobranzaCashflow
}) {
  // TC Referencial del sistema
  const tcActualSistema = useMemo(() => {
    if (tcList && tcList.length > 0) {
      const sorted = [...tcList].sort((a, b) => (b.fecha_corte || "").localeCompare(a.fecha_corte || ""));
      const val = Number(sorted[0].saldo_efectivo || 0);
      if (val > 0) return val;
    }
    return 1550;
  }, [tcList]);

  const [monedaVista, setMonedaVista] = useState("ARS"); // "ARS" | "USD"
  const [subTab, setSubTab] = useState("resumen"); // "resumen" | "clientes" | "ventas" | "devengamiento" | "cobranza"
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Entidades principales persistidas en Supabase + localStorage
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [cobranzas, setCobranzas] = useState([]);
  const [stockUnits, setStockUnits] = useState([]);

  // Índices del ERP reales (para pre-cargar en devengamiento y nuevas ventas)
  const [erpCacGeneral, setErpCacGeneral] = useState(1468.9);
  const [erpIndiceLinkList, setErpIndiceLinkList] = useState([]);
  const [erpH21List, setErpH21List] = useState([]);

  // Período activo para Devengamiento y Cobranza
  const [periodoActivo, setPeriodoActivo] = useState("2026-11");
  const [indicesPorPeriodo, setIndicesPorPeriodo] = useState(() => {
    try {
      const rawV2 = localStorage.getItem(LOCAL_INDICES_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = { ...DEFAULT_INDICES_PERIODO };
          parsed.forEach(row => { if (row?.periodo) map[row.periodo] = { ...(map[row.periodo] || {}), ...row }; });
          return map;
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const merged = { ...DEFAULT_INDICES_PERIODO };
          Object.entries(parsed).forEach(([k, v]) => { merged[k] = { ...(merged[k] || {}), ...v }; });
          return merged;
        }
      }
      const rawV1 = localStorage.getItem(OLD_LOCAL_INDICES_KEY);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1);
        const merged = { ...DEFAULT_INDICES_PERIODO };
        Object.entries(parsedV1 || {}).forEach(([k, v]) => { merged[k] = { ...(merged[k] || {}), ...v }; });
        return merged;
      }
    } catch {}
    return DEFAULT_INDICES_PERIODO;
  });

  // Filtros & selección
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("TODOS");
  const [filtroAsignacion, setFiltroAsignacion] = useState("TODAS");
  const [filtroMorosidad, setFiltroMorosidad] = useState("TODAS");
  const [filtroVariable, setFiltroVariable] = useState("TODAS");
  const [filtroEstadoCuota, setFiltroEstadoCuota] = useState("PENDIENTES"); // "PENDIENTES" | "DEVENGADAS" | "COBRADAS" | "TODAS"
  const [incluirAtrasadasDevengamiento, setIncluirAtrasadasDevengamiento] = useState(true);
  const [selectedCuotaIds, setSelectedCuotaIds] = useState([]);
  const [selectedClienteIds, setSelectedClienteIds] = useState([]);
  const [batchVariable, setBatchVariable] = useState("IPC");
  const [batchPeriodoBase, setBatchPeriodoBase] = useState("2026-11");
  const [mostrarTablaIndices, setMostrarTablaIndices] = useState(false);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);

  // Modales
  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [modalCobroData, setModalCobroData] = useState(null); // { cuota, venta, cliente }

  // Estado del formulario de Venta
  const [ventaForm, setVentaForm] = useState({
    modoCliente: "nuevo", // "nuevo" | "existente"
    cliente_id: "",
    cli_nombre: "",
    cli_dni_cuit: "",
    cli_email: "",
    cli_telefono: "",
    cli_domicilio: "",
    cli_condicion_fiscal: "Consumidor Final",
    cli_observaciones: "",
    vincularStock: false,
    unidad_id: "",
    marcarUnidadVendida: true,
    proyecto: PROYECTOS_CARTERA_CC[0],
    asignacion: "PROYECTO",
    unidad_nombre: "",
    fecha_venta: "2026-11-12",
    fecha_primer_vencimiento: "2026-12-10",
    moneda_origen: "ARS",
    precio_total: "",
    anticipo: "",
    cantidad_cuotas: "24",
    variable_actualizacion: "CAC",
    indice_base: "1468.9",
    tasa_mensual_fija: "2.5",
    notas: ""
  });

  // Estado del formulario de Cliente
  const [clienteForm, setClienteForm] = useState({
    nombre: "",
    dni_cuit: "",
    email: "",
    telefono: "",
    domicilio: "",
    condicion_fiscal: "Consumidor Final",
    variable_actualizacion: "CAC",
    periodo_base: "2026-11",
    indice_base: "1468.9",
    tasa_mensual_fija: "2.5",
    observaciones: ""
  });

  // Estado del formulario de Cobro
  const [cobroForm, setCobroForm] = useState({
    fecha_cobro: "2026-11-12",
    medio_pago: MEDIOS_PAGO_CC[0],
    moneda_pago: "ARS",
    tc_aplicado: String(tcActualSistema),
    importe_pagado: "",
    referencia: "",
    observaciones: "",
    impactarCashflow: true
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3600);
  };

  // Carga inicial desde Supabase / localStorage
  const cargarTodo = useCallback(async () => {
    setLoading(true);
    try {
      const [resCli, resVta, resCta, resCob, resStock, resCac, resLink, resH21, resIndices] = await Promise.all([
        supabase.from("cc_clientes").select("*"),
        supabase.from("cc_ventas").select("*"),
        supabase.from("cc_cuotas").select("*"),
        supabase.from("cc_cobranzas").select("*"),
        supabase.from("stock_units").select("*"),
        supabase.from("cf_cac_indicadores").select("*"),
        supabase.from("cf_indice_link").select("*").order("id_mes", { ascending: true }),
        supabase.from("cf_h21_precios").select("*").order("id_mes", { ascending: true }),
        supabase.from("cc_indices").select("*")
      ]);

      let cliData = resCli.data || [];
      let vtaData = resVta.data || [];
      let ctaData = resCta.data || [];
      let cobData = resCob.data || [];

      // Si es la primera vez y no hay datos en el módulo (o quedara rastro viejo), cargar cartera oficial
      if ((cliData.length === 0 && vtaData.length === 0) || cliData.some(c => c.id === "cli_1")) {
        cliData = DEFAULT_CC_CLIENTES;
        vtaData = DEFAULT_CC_VENTAS;
        ctaData = DEFAULT_CC_CUOTAS;
        cobData = DEFAULT_CC_COBRANZAS;
        await Promise.all([
          supabase.from("cc_clientes").setAll(cliData),
          supabase.from("cc_ventas").setAll(vtaData),
          supabase.from("cc_cuotas").setAll(ctaData),
          supabase.from("cc_cobranzas").setAll(cobData)
        ]);
      }

      // Normalizar variable de actualización en clientes cargados previamente si no la tuvieran
      const vtaPorCli = {};
      vtaData.forEach(v => {
        if (!vtaPorCli[v.cliente_id]) vtaPorCli[v.cliente_id] = v;
      });
      cliData = cliData.map(c => {
        if (c.variable_actualizacion) return c;
        const vtaRef = vtaPorCli[c.id];
        const varEf = vtaRef?.variable_actualizacion || "CAC";
        return {
          ...c,
          variable_actualizacion: varEf,
          periodo_base: c.periodo_base || "2026-11",
          indice_base: c.indice_base ?? vtaRef?.indice_base ?? getDefaultIndiceValor(varEf, "2026-11"),
          tasa_mensual_fija: c.tasa_mensual_fija ?? vtaRef?.tasa_mensual_fija ?? 0
        };
      });

      setClientes(cliData);
      setVentas(vtaData);
      setCuotas(ctaData);
      setCobranzas(cobData);

      const stData = (resStock.data && resStock.data.length > 0) ? resStock.data : DEFAULT_STOCK_UNITS;
      setStockUnits(stData);

      // Extraer CAC real del ERP si existe
      if (resCac.data && resCac.data.length > 0) {
        const cacGen = resCac.data.find(r => r.indicador === "cac_general" || r.indicador === "general" || (r.indicador || "").toLowerCase().includes("general"));
        if (cacGen && Number(cacGen.valor) > 0) {
          setErpCacGeneral(Number(cacGen.valor));
        }
      }

      if (resLink.data && resLink.data.length > 0) {
        setErpIndiceLinkList(resLink.data);
      }

      if (resH21.data && resH21.data.length > 0) {
        setErpH21List(resH21.data);
      }

      if (resIndices.data && resIndices.data.length > 0) {
        setIndicesPorPeriodo(prev => {
          const next = { ...DEFAULT_INDICES_PERIODO, ...prev };
          resIndices.data.forEach(row => {
            if (row?.periodo) {
              next[row.periodo] = { ...(next[row.periodo] || {}), ...row };
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Error cargando Cuentas Corrientes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  // Persistir índices por período en Supabase + localStorage
  const persistirIndicesPeriodo = useCallback(async (mapaIndices) => {
    const rows = Object.entries(mapaIndices).map(([periodo, vals]) => ({
      periodo,
      CAC: Number(vals.CAC ?? getDefaultIndiceValor("CAC", periodo)),
      IPC: Number(vals.IPC ?? getDefaultIndiceValor("IPC", periodo)),
      HORMIGON: Number(vals.HORMIGON ?? getDefaultIndiceValor("HORMIGON", periodo)),
      INDICE_LINK: Number(vals.INDICE_LINK ?? getDefaultIndiceValor("INDICE_LINK", periodo)),
      USD_TC: Number(vals.USD_TC ?? getDefaultIndiceValor("USD_TC", periodo))
    }));
    try {
      await supabase.from("cc_indices").setAll(rows);
    } catch (e) {
      console.warn("No se pudieron sincronizar índices mensuales:", e);
    }
  }, []);

  // Helpers de conversión monetaria
  const aMonedaVista = useCallback((monto, monedaOrigen = "ARS") => {
    const val = Number(monto || 0);
    if (monedaVista === monedaOrigen) return val;
    if (monedaVista === "USD" && monedaOrigen === "ARS") {
      return tcActualSistema > 0 ? val / tcActualSistema : 0;
    }
    if (monedaVista === "ARS" && monedaOrigen === "USD") {
      return val * tcActualSistema;
    }
    return val;
  }, [monedaVista, tcActualSistema]);

  const formatoVista = useCallback((monto, monedaOrigen = "ARS") => {
    const val = aMonedaVista(monto, monedaOrigen);
    return monedaVista === "USD" ? `U$D ${fmt(Math.round(val))}` : `$ ${fmt(Math.round(val))}`;
  }, [aMonedaVista, monedaVista, fmt]);

  const formatoOriginal = useCallback((monto, moneda = "ARS") => {
    const val = Number(monto || 0);
    return moneda === "USD" ? `U$D ${fmt(Math.round(val))}` : `$ ${fmt(Math.round(val))}`;
  }, [fmt]);

  // Mapas de acceso rápido
  const clientesMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.id] = c; });
    return m;
  }, [clientes]);

  const ventasMap = useMemo(() => {
    const m = {};
    ventas.forEach(v => { m[v.id] = v; });
    return m;
  }, [ventas]);

  // Obtener valor de referencia mensual de cualquier variable (IPC, CAC, Hormigón, Link, USD)
  const obtenerValorReferenciaMes = useCallback((variableId, periodo = periodoActivo) => {
    if (variableId === "SIN_AJUSTE") return 1;
    if (variableId === "TASA_FIJA") return 2.5;
    const stored = indicesPorPeriodo[periodo] || {};
    if (stored[variableId] != null && Number(stored[variableId]) > 0) {
      return Number(stored[variableId]);
    }
    if (variableId === "INDICE_LINK") {
      const linkDelMes = erpIndiceLinkList.find(item => item.id_mes === periodo);
      if (linkDelMes?.indice > 0) return Number(linkDelMes.indice);
    }
    if (variableId === "HORMIGON") {
      const h21Mes = erpH21List.find(item => item.id_mes === periodo);
      if (h21Mes?.valor > 0) return Number(h21Mes.valor);
    }
    return getDefaultIndiceValor(variableId, periodo);
  }, [indicesPorPeriodo, periodoActivo, erpIndiceLinkList, erpH21List]);

  // Índices efectivos para el período seleccionado y el período inmediatamente anterior
  const periodoAnteriorActivo = useMemo(() => getPeriodoAnterior(periodoActivo), [periodoActivo]);

  const indicesMesActivo = useMemo(() => ({
    CAC: obtenerValorReferenciaMes("CAC", periodoActivo),
    IPC: obtenerValorReferenciaMes("IPC", periodoActivo),
    HORMIGON: obtenerValorReferenciaMes("HORMIGON", periodoActivo),
    INDICE_LINK: obtenerValorReferenciaMes("INDICE_LINK", periodoActivo),
    USD_TC: obtenerValorReferenciaMes("USD_TC", periodoActivo)
  }), [obtenerValorReferenciaMes, periodoActivo]);

  const indicesMesAnterior = useMemo(() => ({
    CAC: obtenerValorReferenciaMes("CAC", periodoAnteriorActivo),
    IPC: obtenerValorReferenciaMes("IPC", periodoAnteriorActivo),
    HORMIGON: obtenerValorReferenciaMes("HORMIGON", periodoAnteriorActivo),
    INDICE_LINK: obtenerValorReferenciaMes("INDICE_LINK", periodoAnteriorActivo),
    USD_TC: obtenerValorReferenciaMes("USD_TC", periodoAnteriorActivo)
  }), [obtenerValorReferenciaMes, periodoAnteriorActivo]);

  const actualizarIndiceMes = (varKey, nuevoVal, targetPeriodo = periodoActivo) => {
    setIndicesPorPeriodo(prev => {
      const currentRow = prev[targetPeriodo] || DEFAULT_INDICES_PERIODO[targetPeriodo] || {};
      const nextMap = {
        ...prev,
        [targetPeriodo]: {
          CAC: obtenerValorReferenciaMes("CAC", targetPeriodo),
          IPC: obtenerValorReferenciaMes("IPC", targetPeriodo),
          HORMIGON: obtenerValorReferenciaMes("HORMIGON", targetPeriodo),
          INDICE_LINK: obtenerValorReferenciaMes("INDICE_LINK", targetPeriodo),
          USD_TC: obtenerValorReferenciaMes("USD_TC", targetPeriodo),
          ...currentRow,
          periodo: targetPeriodo,
          [varKey]: Number(nuevoVal) || 0
        }
      };
      persistirIndicesPeriodo(nextMap);
      return nextMap;
    });
  };

  const aplicarVariacionPctMes = (varKey, pctVar, targetPeriodo = periodoActivo) => {
    const prevPer = getPeriodoAnterior(targetPeriodo);
    const valAnt = obtenerValorReferenciaMes(varKey, prevPer);
    const pct = Number(pctVar);
    if (isNaN(pct) || valAnt <= 0) return;
    const nuevoVal = varKey === "HORMIGON" || varKey === "USD_TC"
      ? Math.round(valAnt * (1 + pct / 100))
      : Number((valAnt * (1 + pct / 100)).toFixed(2));
    actualizarIndiceMes(varKey, nuevoVal, targetPeriodo);
    showToast(`${getVariableMeta(varKey).short} actualizado (${pct >= 0 ? "+" : ""}${pct}% respecto a ${formatearPeriodoLabel(prevPer)}).`);
  };

  // Proyectos disponibles dinámicamente desde cartera
  const proyectosDisponibles = useMemo(() => {
    const setP = new Set(PROYECTOS_CARTERA_CC);
    ventas.forEach(v => { if (v.proyecto) setP.add(v.proyecto); });
    return Array.from(setP);
  }, [ventas]);

  // KPIs Globales de Cartera (convertidos a monedaVista)
  const kpisCartera = useMemo(() => {
    let totalVendido = 0;
    let totalCobrado = 0;
    let saldoPendienteTotal = 0;
    let devengadoMes = 0;
    let cobradoMes = 0;
    let exigibleMes = 0;
    let saldoVencidoAnterior = 0;
    let operacionesVencidas = 0;
    let cuotasVencidasCount = 0;
    const hoyISO = new Date().toISOString().slice(0, 10);

    ventas.forEach(v => {
      if (v.estado !== "Rescindida") {
        totalVendido += aMonedaVista(v.precio_total, v.moneda_origen);
        saldoVencidoAnterior += aMonedaVista(v.saldo_vencido_anterior || 0, v.moneda_origen);
        if (v.morosidad === "VENCIDO") operacionesVencidas += 1;
      }
    });

    cuotas.forEach(c => {
      const impActVista = aMonedaVista(c.importe_actualizado, c.moneda);
      const cobVista = aMonedaVista(c.monto_cobrado, c.moneda);
      const salVista = aMonedaVista(c.saldo_pendiente, c.moneda);

      totalCobrado += cobVista;
      saldoPendienteTotal += salVista;

      if (c.periodo === periodoActivo) {
        exigibleMes += impActVista;
        if (c.devengado) devengadoMes += impActVista;
      }

      if (c.saldo_pendiente > 0.5 && (c.fecha_vencimiento < hoyISO || c.estado === "Vencida")) {
        cuotasVencidasCount += 1;
      }
    });

    cobranzas.forEach(cob => {
      if (cob.periodo_cobro === periodoActivo) {
        cobradoMes += aMonedaVista(cob.importe_pagado, cob.moneda_pago);
      }
    });

    const totalExigibleConAtraso = exigibleMes + saldoVencidoAnterior;
    const tasaCobranzaMes = devengadoMes > 0 ? Math.min(100, (cobradoMes / devengadoMes) * 100) : (cobradoMes > 0 ? 100 : 0);

    return {
      totalVendido,
      totalCobrado,
      saldoPendienteTotal,
      devengadoMes,
      cobradoMes,
      exigibleMes,
      saldoVencidoAnterior,
      totalExigibleConAtraso,
      operacionesVencidas,
      tasaCobranzaMes,
      cuotasVencidasCount,
      cantClientes: clientes.length,
      cantVentas: ventas.length
    };
  }, [ventas, cuotas, cobranzas, clientes.length, periodoActivo, aMonedaVista]);

  // Serie mensual para gráfico Devengado vs Cobrado vs Proyectado (próximos 14 meses)
  const chartDevengadoCobrado = useMemo(() => {
    const map = {};
    cuotas.forEach(c => {
      if (!c.periodo) return;
      if (!map[c.periodo]) {
        map[c.periodo] = {
          periodo: c.periodo,
          label: formatearPeriodoLabel(c.periodo),
          Proyectado: 0,
          Devengado: 0,
          Cobrado: 0
        };
      }
      const val = aMonedaVista(c.importe_actualizado, c.moneda);
      if (c.devengado) {
        map[c.periodo].Devengado += val;
      } else {
        map[c.periodo].Proyectado += val;
      }
    });

    cobranzas.forEach(cob => {
      const p = cob.periodo_cobro || (cob.fecha_cobro || "").slice(0, 7);
      if (!p) return;
      if (!map[p]) {
        map[p] = {
          periodo: p,
          label: formatearPeriodoLabel(p),
          Proyectado: 0,
          Devengado: 0,
          Cobrado: 0
        };
      }
      map[p].Cobrado += aMonedaVista(cob.importe_pagado, cob.moneda_pago);
    });

    return Object.values(map)
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .slice(0, 14)
      .map(row => ({
        ...row,
        Proyectado: Math.round(row.Proyectado),
        Devengado: Math.round(row.Devengado),
        Cobrado: Math.round(row.Cobrado)
      }));
  }, [cuotas, cobranzas, aMonedaVista]);

  // Resumen por Proyecto
  const resumenPorProyecto = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      const p = v.proyecto || "Sin Proyecto";
      if (!map[p]) {
        map[p] = { proyecto: p, operaciones: 0, cuotaMes: 0, vencidoAnt: 0, totalVendido: 0, cobrado: 0, pendiente: 0 };
      }
      map[p].operaciones += 1;
      map[p].cuotaMes += aMonedaVista(v.cuota_mes || 0, v.moneda_origen);
      map[p].vencidoAnt += aMonedaVista(v.saldo_vencido_anterior || 0, v.moneda_origen);
      map[p].totalVendido += aMonedaVista(v.precio_total, v.moneda_origen);
    });
    cuotas.forEach(c => {
      const v = ventasMap[c.venta_id];
      const p = v?.proyecto || "Sin Proyecto";
      if (!map[p]) {
        map[p] = { proyecto: p, operaciones: 0, cuotaMes: 0, vencidoAnt: 0, totalVendido: 0, cobrado: 0, pendiente: 0 };
      }
      map[p].cobrado += aMonedaVista(c.monto_cobrado, c.moneda);
      map[p].pendiente += aMonedaVista(c.saldo_pendiente, c.moneda);
    });
    return Object.values(map).sort((a, b) => b.pendiente - a.pendiente);
  }, [ventas, cuotas, ventasMap, aMonedaVista]);

  // Resumen por Asignación y Segmentación de Morosidad
  const resumenAsignacionYMorosidad = useMemo(() => {
    const asigMap = {};
    const morMap = {};
    ventas.forEach(v => {
      const a = v.asignacion || "SIN ASIGNAR";
      if (!asigMap[a]) asigMap[a] = { label: a, ops: 0, cuotaMes: 0, saldoPend: 0 };
      asigMap[a].ops += 1;
      asigMap[a].cuotaMes += aMonedaVista(v.cuota_mes || 0, v.moneda_origen);
      asigMap[a].saldoPend += aMonedaVista((v.saldo_a_vencer || 0) + (v.ingreso_nueva_venta || 0), v.moneda_origen);

      const m = v.segmentacion || "AL DIA";
      if (!morMap[m]) morMap[m] = { label: m, ops: 0, vencidoAnt: 0, totalCobrar: 0 };
      morMap[m].ops += 1;
      morMap[m].vencidoAnt += aMonedaVista(v.saldo_vencido_anterior || 0, v.moneda_origen);
      morMap[m].totalCobrar += aMonedaVista(v.total_a_cobrar || 0, v.moneda_origen);
    });
    return {
      asignaciones: Object.values(asigMap).sort((a, b) => b.saldoPend - a.saldoPend),
      morosidad: Object.values(morMap).sort((a, b) => b.totalCobrar - a.totalCobrar)
    };
  }, [ventas, aMonedaVista]);

  // Indexar ventas y cuotas por cliente en O(N) para renderizado instantáneo
  const ventasPorClienteMap = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      if (!map[v.cliente_id]) map[v.cliente_id] = [];
      map[v.cliente_id].push(v);
    });
    return map;
  }, [ventas]);

  const cuotasPorClienteMap = useMemo(() => {
    const map = {};
    cuotas.forEach(c => {
      if (!map[c.cliente_id]) map[c.cliente_id] = [];
      map[c.cliente_id].push(c);
    });
    return map;
  }, [cuotas]);

  // Enriquecer clientes con métricas de su cuenta corriente y variable asignada
  const clientesEnriquecidos = useMemo(() => {
    return clientes.map(cli => {
      const ventasCli = ventasPorClienteMap[cli.id] || [];
      const cuotasCli = cuotasPorClienteMap[cli.id] || [];
      const contratadoVista = ventasCli.reduce((s, v) => s + aMonedaVista(v.precio_total, v.moneda_origen), 0);
      const cobradoVista = cuotasCli.reduce((s, c) => s + aMonedaVista(c.monto_cobrado, c.moneda), 0);
      const saldoVista = cuotasCli.reduce((s, c) => s + aMonedaVista(c.saldo_pendiente, c.moneda), 0);
      const totalCobrarMesVista = ventasCli.reduce((s, v) => s + aMonedaVista(v.total_a_cobrar || 0, v.moneda_origen), 0);
      const cuotasPend = cuotasCli.filter(c => c.saldo_pendiente > 0.5).length;
      const cuotasDev = cuotasCli.filter(c => c.devengado && c.saldo_pendiente > 0.5).length;
      const segmentaciones = Array.from(new Set(ventasCli.map(v => v.segmentacion).filter(Boolean)));
      const variableEfectiva = cli.variable_actualizacion || ventasCli[0]?.variable_actualizacion || "CAC";
      const periodoBaseEfectivo = cli.periodo_base || "2026-11";
      const indiceBaseEfectivo = Number(
        cli.indice_base ?? ventasCli[0]?.indice_base ?? obtenerValorReferenciaMes(variableEfectiva, periodoBaseEfectivo)
      );
      const tasaFijaEfectiva = Number(cli.tasa_mensual_fija ?? ventasCli[0]?.tasa_mensual_fija ?? 0);

      return {
        ...cli,
        ventasCli,
        cuotasCli,
        contratadoVista,
        cobradoVista,
        saldoVista,
        totalCobrarMesVista,
        cuotasPend,
        cuotasDev,
        segmentaciones,
        variableEfectiva,
        periodoBaseEfectivo,
        indiceBaseEfectivo,
        tasaFijaEfectiva
      };
    }).filter(cli => {
      if (filtroProyecto !== "TODOS" && !cli.ventasCli.some(v => v.proyecto === filtroProyecto)) return false;
      if (filtroAsignacion !== "TODAS" && !cli.ventasCli.some(v => v.asignacion === filtroAsignacion)) return false;
      if (filtroMorosidad !== "TODAS" && !cli.ventasCli.some(v => v.segmentacion === filtroMorosidad)) return false;
      if (filtroVariable !== "TODAS" && cli.variableEfectiva !== filtroVariable) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (cli.nombre || "").toLowerCase().includes(q) ||
        (cli.dni_cuit || "").toLowerCase().includes(q) ||
        (cli.email || "").toLowerCase().includes(q) ||
        cli.ventasCli.some(v =>
          (v.proyecto || "").toLowerCase().includes(q) ||
          (v.unidad_nombre || "").toLowerCase().includes(q) ||
          (v.asignacion || "").toLowerCase().includes(q)
        )
      );
    });
  }, [clientes, ventasPorClienteMap, cuotasPorClienteMap, filtroProyecto, filtroAsignacion, filtroMorosidad, filtroVariable, searchQuery, aMonedaVista, obtenerValorReferenciaMes]);

  // Ventas filtradas para la pestaña Ventas y Planes
  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      if (filtroProyecto !== "TODOS" && v.proyecto !== filtroProyecto) return false;
      if (filtroAsignacion !== "TODAS" && v.asignacion !== filtroAsignacion) return false;
      if (filtroMorosidad !== "TODAS" && v.segmentacion !== filtroMorosidad) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cli = clientesMap[v.cliente_id];
        return (
          (cli?.nombre || "").toLowerCase().includes(q) ||
          (v.codigo || "").toLowerCase().includes(q) ||
          (v.proyecto || "").toLowerCase().includes(q) ||
          (v.unidad_nombre || "").toLowerCase().includes(q) ||
          (v.asignacion || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ventas, clientesMap, filtroProyecto, filtroAsignacion, filtroMorosidad, searchQuery]);

  // Unidades disponibles del stock para vincular a nueva venta
  const unidadesDisponiblesParaVenta = useMemo(() => {
    return stockUnits.filter(u => u.estado === "Disponible" || u.estado === "Reservado" || u.estado === "En Negociación");
  }, [stockUnits]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIÓN 1: ALTA DE VENTA -> GENERACIÓN AUTOMÁTICA DE CLIENTE Y PLAN DE CUOTAS
  // ═══════════════════════════════════════════════════════════════════════════
  const abrirModalNuevaVenta = () => {
    setVentaForm({
      modoCliente: clientes.length > 0 ? "nuevo" : "nuevo",
      cliente_id: clientes[0]?.id || "",
      cli_nombre: "",
      cli_dni_cuit: "",
      cli_email: "",
      cli_telefono: "",
      cli_domicilio: "",
      cli_condicion_fiscal: "Consumidor Final",
      cli_observaciones: "",
      vincularStock: false,
      unidad_id: "",
      marcarUnidadVendida: true,
      proyecto: PROYECTOS_CARTERA_CC[0],
      asignacion: "PROYECTO",
      unidad_nombre: "",
      fecha_venta: "2026-11-12",
      fecha_primer_vencimiento: "2026-12-10",
      moneda_origen: "ARS",
      precio_total: "",
      anticipo: "",
      cantidad_cuotas: "24",
      variable_actualizacion: "CAC",
      indice_base: String(erpCacGeneral || 1468.9),
      tasa_mensual_fija: "2.5",
      notas: ""
    });
    setModalVentaOpen(true);
  };

  const handleSeleccionarUnidadStock = (unidadId) => {
    const u = stockUnits.find(x => x.id === unidadId);
    if (!u) {
      setVentaForm(prev => ({ ...prev, unidad_id: "" }));
      return;
    }
    const precioEnMoneda = ventaForm.moneda_origen === "USD"
      ? Number(u.precio_usd || 0)
      : Math.round(Number(u.precio_usd || 0) * tcActualSistema);

    setVentaForm(prev => ({
      ...prev,
      unidad_id: u.id,
      proyecto: normalizarNombreProyecto(u.proyecto),
      unidad_nombre: `${u.unidad}${u.piso ? ` (${u.piso})` : ""}`,
      precio_total: precioEnMoneda > 0 ? String(precioEnMoneda) : prev.precio_total
    }));
  };

  const handleCambioVariableVenta = (varId) => {
    const periodoBaseVta = (ventaForm.fecha_venta || periodoActivo || "2026-11").slice(0, 7);
    const baseSugerida = varId === "TASA_FIJA"
      ? (ventaForm.tasa_mensual_fija || "2.5")
      : String(obtenerValorReferenciaMes(varId, periodoBaseVta));

    setVentaForm(prev => ({
      ...prev,
      variable_actualizacion: varId,
      indice_base: baseSugerida
    }));
  };

  const handleSeleccionarClienteExistenteEnVenta = (clienteId) => {
    const cli = clientes.find(c => c.id === clienteId);
    const varCli = cli?.variable_actualizacion || ventaForm.variable_actualizacion || "CAC";
    const perBase = cli?.periodo_base || (ventaForm.fecha_venta || periodoActivo).slice(0, 7);
    const indBase = cli?.indice_base ?? obtenerValorReferenciaMes(varCli, perBase);
    setVentaForm(prev => ({
      ...prev,
      cliente_id: clienteId,
      variable_actualizacion: varCli,
      indice_base: String(indBase),
      tasa_mensual_fija: cli?.tasa_mensual_fija != null ? String(cli.tasa_mensual_fija) : prev.tasa_mensual_fija
    }));
  };

  const previewVentaCalculo = useMemo(() => {
    const total = Number(ventaForm.precio_total || 0);
    const ant = Math.max(0, Number(ventaForm.anticipo || 0));
    const saldo = Math.max(0, total - ant);
    const nCuotas = Math.max(0, Math.floor(Number(ventaForm.cantidad_cuotas || 0)));
    const cuotaBase = nCuotas > 0 ? saldo / nCuotas : 0;
    const ultimoVenc = nCuotas > 0 ? sumarMesesFecha(ventaForm.fecha_primer_vencimiento, nCuotas - 1) : "—";
    return { total, ant, saldo, nCuotas, cuotaBase, ultimoVenc };
  }, [ventaForm]);

  const handleGuardarNuevaVenta = async (e) => {
    e.preventDefault();
    const total = Number(ventaForm.precio_total || 0);
    const anticipo = Math.max(0, Number(ventaForm.anticipo || 0));
    const cantCuotas = Math.max(0, Math.floor(Number(ventaForm.cantidad_cuotas || 0)));

    if (total <= 0) return alert("Ingresá un importe total de venta válido mayor a 0.");
    if (anticipo > total) return alert("El anticipo no puede superar al importe total de venta.");
    if (total - anticipo > 0 && cantCuotas <= 0) return alert("Indicá la cantidad de cuotas para el saldo a financiar.");
    if (!ventaForm.unidad_nombre.trim()) return alert("Indicá la unidad o detalle de la operación vendida.");

    let clienteIdFinal = ventaForm.cliente_id;
    let nuevosClientes = [...clientes];

    // 1. Si es cliente nuevo, generarlo automáticamente a partir de la venta (con su variable asignada)
    if (ventaForm.modoCliente === "nuevo") {
      if (!ventaForm.cli_nombre.trim()) return alert("Ingresá el Nombre o Razón Social del cliente.");
      const periodoBaseVta = (ventaForm.fecha_venta || periodoActivo || "2026-11").slice(0, 7);
      const nuevoCli = {
        id: generarId("cli"),
        nombre: ventaForm.cli_nombre.trim(),
        dni_cuit: ventaForm.cli_dni_cuit.trim() || "—",
        email: ventaForm.cli_email.trim(),
        telefono: ventaForm.cli_telefono.trim(),
        domicilio: ventaForm.cli_domicilio.trim(),
        condicion_fiscal: ventaForm.cli_condicion_fiscal,
        variable_actualizacion: ventaForm.variable_actualizacion,
        periodo_base: periodoBaseVta,
        indice_base: Number(ventaForm.indice_base || 1),
        tasa_mensual_fija: ventaForm.variable_actualizacion === "TASA_FIJA" ? Number(ventaForm.tasa_mensual_fija || 0) : 0,
        observaciones: ventaForm.cli_observaciones.trim(),
        created_at: ventaForm.fecha_venta || new Date().toISOString().slice(0, 10)
      };
      clienteIdFinal = nuevoCli.id;
      nuevosClientes = [nuevoCli, ...clientes];
    } else if (!clienteIdFinal) {
      return alert("Seleccioná un cliente existente.");
    }

    // 2. Crear registro de Venta
    const ventaId = generarId("vta");
    const codigoOp = `OP-${(ventaForm.fecha_venta || "2026").slice(0, 4)}-${String(ventas.length + 1).padStart(3, "0")}`;
    const nuevaVenta = {
      id: ventaId,
      codigo: codigoOp,
      fecha_venta: ventaForm.fecha_venta,
      cliente_id: clienteIdFinal,
      proyecto: ventaForm.proyecto,
      asignacion: ventaForm.asignacion || "PROYECTO",
      condicion_venta: "FINANCIADO",
      unidad_id: ventaForm.vincularStock ? ventaForm.unidad_id : "",
      unidad_nombre: ventaForm.unidad_nombre.trim(),
      moneda_origen: ventaForm.moneda_origen,
      precio_total: total,
      anticipo,
      saldo_financiar: Math.max(0, total - anticipo),
      cantidad_cuotas: cantCuotas,
      cuotas_pendientes: cantCuotas,
      fecha_primer_vencimiento: ventaForm.fecha_primer_vencimiento,
      fecha_vto_actual: ventaForm.fecha_primer_vencimiento,
      morosidad: "NO VENCIDO",
      segmentacion: "AL DIA",
      saldo_vencido_anterior: 0,
      cuota_mes: cantCuotas > 0 ? Math.round((Math.max(0, total - anticipo) / cantCuotas)) : 0,
      total_a_cobrar: cantCuotas > 0 ? Math.round((Math.max(0, total - anticipo) / cantCuotas)) : 0,
      saldo_a_vencer: Math.max(0, total - anticipo),
      variable_actualizacion: ventaForm.variable_actualizacion,
      indice_base: Number(ventaForm.indice_base || 1),
      tasa_mensual_fija: ventaForm.variable_actualizacion === "TASA_FIJA" ? Number(ventaForm.tasa_mensual_fija || 0) : 0,
      estado: "Activa",
      notas: ventaForm.notas.trim()
    };

    // 3. Generar Plan de Cuotas
    const nuevasCuotas = generarPlanCuotasVenta(nuevaVenta);

    const nextVentas = [nuevaVenta, ...ventas];
    const nextCuotas = [...cuotas, ...nuevasCuotas];

    setClientes(nuevosClientes);
    setVentas(nextVentas);
    setCuotas(nextCuotas);

    await Promise.all([
      supabase.from("cc_clientes").setAll(nuevosClientes),
      supabase.from("cc_ventas").setAll(nextVentas),
      supabase.from("cc_cuotas").setAll(nextCuotas)
    ]);

    // 4. Si se vinculó unidad del stock y pidió marcarla vendida
    if (ventaForm.vincularStock && ventaForm.unidad_id && ventaForm.marcarUnidadVendida) {
      const updatedStock = stockUnits.map(u =>
        u.id === ventaForm.unidad_id
          ? { ...u, estado: "Vendido", observaciones: `${u.observaciones ? u.observaciones + " · " : ""}Vendida (${codigoOp})` }
          : u
      );
      setStockUnits(updatedStock);
      await supabase.from("stock_units").setAll(updatedStock);
    }

    setModalVentaOpen(false);
    setClienteDetalleId(clienteIdFinal);
    setSubTab("clientes");
    showToast(`Venta ${codigoOp} registrada: cliente y ${nuevasCuotas.length} cuotas generadas.`);
  };

  // Eliminar Venta y sus cuotas/cobranzas asociadas
  const handleEliminarVenta = async (venta) => {
    if (!window.confirm(`¿Eliminar la operación ${venta.codigo} (${venta.unidad_nombre}) y su plan de cuotas?`)) return;
    const nextVentas = ventas.filter(v => v.id !== venta.id);
    const nextCuotas = cuotas.filter(c => c.venta_id !== venta.id);
    const nextCobranzas = cobranzas.filter(cob => cob.venta_id !== venta.id);
    setVentas(nextVentas);
    setCuotas(nextCuotas);
    setCobranzas(nextCobranzas);
    await Promise.all([
      supabase.from("cc_ventas").setAll(nextVentas),
      supabase.from("cc_cuotas").setAll(nextCuotas),
      supabase.from("cc_cobranzas").setAll(nextCobranzas)
    ]);
    showToast(`Operación ${venta.codigo} eliminada.`);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIÓN 2: CRUD DE CLIENTES Y ASIGNACIÓN DE VARIABLE DE ACTUALIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  const aplicarVariableAClientes = async (clienteIds, nuevaVariable, options = {}) => {
    const idsSet = new Set(Array.isArray(clienteIds) ? clienteIds : [clienteIds]);
    if (idsSet.size === 0) return;

    const periodoBaseTarget = options.periodo_base || periodoActivo || "2026-11";
    const baseAuto = obtenerValorReferenciaMes(nuevaVariable, periodoBaseTarget);
    const indiceBaseFinal = options.indice_base != null && Number(options.indice_base) > 0
      ? Number(options.indice_base)
      : baseAuto;
    const tasaFijaFinal = nuevaVariable === "TASA_FIJA"
      ? Number(options.tasa_mensual_fija ?? 2.5)
      : 0;

    const nextClientes = clientes.map(c => {
      if (!idsSet.has(c.id)) return c;
      return {
        ...c,
        variable_actualizacion: nuevaVariable,
        periodo_base: periodoBaseTarget,
        indice_base: indiceBaseFinal,
        tasa_mensual_fija: tasaFijaFinal
      };
    });

    const nextVentas = ventas.map(v => {
      if (!idsSet.has(v.cliente_id)) return v;
      return {
        ...v,
        variable_actualizacion: nuevaVariable,
        indice_base: indiceBaseFinal,
        tasa_mensual_fija: tasaFijaFinal
      };
    });

    const nextCuotas = cuotas.map(cta => {
      if (!idsSet.has(cta.cliente_id) || cta.nro_cuota === 0) return cta;
      // No alterar cuotas ya cobradas total o parcialmente
      if (Number(cta.monto_cobrado || 0) > 0) return cta;

      const updatedBaseCuota = {
        ...cta,
        variable_actualizacion: nuevaVariable,
        indice_base: indiceBaseFinal
      };

      // Si ya estaba devengada (y sin cobros) y piden recalcular o viene de cambio en vivo, actualizar su cálculo
      if (cta.devengado && options.recalcularDevengadas) {
        const valorMesCuota = nuevaVariable === "TASA_FIJA"
          ? tasaFijaFinal
          : obtenerValorReferenciaMes(nuevaVariable, cta.periodo || periodoActivo);
        const calc = calcularCuotaConIndice(updatedBaseCuota, { tasa_mensual_fija: tasaFijaFinal }, valorMesCuota);
        return {
          ...updatedBaseCuota,
          indice_aplicado: calc.indiceAplicado,
          coeficiente_ajuste: calc.coeficiente,
          importe_actualizado: calc.importeActualizado,
          saldo_pendiente: calc.importeActualizado
        };
      }

      if (!cta.devengado) {
        const esTasa = nuevaVariable === "TASA_FIJA";
        const coef = esTasa ? Math.pow(1 + Math.max(0, tasaFijaFinal) / 100, Math.max(0, cta.nro_cuota)) : 1;
        const impAct = Math.round(Number(cta.importe_original || 0) * coef * 100) / 100;
        return {
          ...updatedBaseCuota,
          indice_aplicado: esTasa ? tasaFijaFinal : indiceBaseFinal,
          coeficiente_ajuste: Number(coef.toFixed(6)),
          importe_actualizado: impAct,
          saldo_pendiente: impAct
        };
      }

      return updatedBaseCuota;
    });

    setClientes(nextClientes);
    setVentas(nextVentas);
    setCuotas(nextCuotas);

    await Promise.all([
      supabase.from("cc_clientes").setAll(nextClientes),
      supabase.from("cc_ventas").setAll(nextVentas),
      supabase.from("cc_cuotas").setAll(nextCuotas)
    ]);

    const varMeta = getVariableMeta(nuevaVariable);
    if (!options.silent) {
      showToast(
        idsSet.size === 1
          ? `Variable ${varMeta.short} (base ${indiceBaseFinal}) asignada al cliente y sus cuotas pendientes.`
          : `Variable ${varMeta.short} asignada a ${idsSet.size} clientes.`
      );
    }
  };

  const abrirModalCliente = (cli = null) => {
    setEditingCliente(cli);
    if (cli) {
      const varEf = cli.variable_actualizacion || cli.variableEfectiva || "CAC";
      const perBase = cli.periodo_base || cli.periodoBaseEfectivo || "2026-11";
      const indBase = cli.indice_base ?? cli.indiceBaseEfectivo ?? obtenerValorReferenciaMes(varEf, perBase);
      setClienteForm({
        nombre: cli.nombre || "",
        dni_cuit: cli.dni_cuit || "",
        email: cli.email || "",
        telefono: cli.telefono || "",
        domicilio: cli.domicilio || "",
        condicion_fiscal: cli.condicion_fiscal || "Consumidor Final",
        variable_actualizacion: varEf,
        periodo_base: perBase,
        indice_base: String(indBase),
        tasa_mensual_fija: String(cli.tasa_mensual_fija ?? cli.tasaFijaEfectiva ?? 2.5),
        observaciones: cli.observaciones || ""
      });
    } else {
      setClienteForm({
        nombre: "",
        dni_cuit: "",
        email: "",
        telefono: "",
        domicilio: "",
        condicion_fiscal: "Consumidor Final",
        variable_actualizacion: "CAC",
        periodo_base: periodoActivo || "2026-11",
        indice_base: String(obtenerValorReferenciaMes("CAC", periodoActivo || "2026-11")),
        tasa_mensual_fija: "2.5",
        observaciones: ""
      });
    }
    setModalClienteOpen(true);
  };

  const handleGuardarCliente = async (e) => {
    e.preventDefault();
    if (!clienteForm.nombre.trim()) return alert("El nombre o razón social es obligatorio.");
    const varAct = clienteForm.variable_actualizacion || "CAC";
    const perBase = clienteForm.periodo_base || periodoActivo || "2026-11";
    const indBase = Number(clienteForm.indice_base || obtenerValorReferenciaMes(varAct, perBase) || 1);
    const tasaFija = varAct === "TASA_FIJA" ? Number(clienteForm.tasa_mensual_fija || 0) : 0;

    if (editingCliente) {
      const nextClientes = clientes.map(c =>
        c.id === editingCliente.id
          ? {
              ...c,
              ...clienteForm,
              nombre: clienteForm.nombre.trim(),
              variable_actualizacion: varAct,
              periodo_base: perBase,
              indice_base: indBase,
              tasa_mensual_fija: tasaFija
            }
          : c
      );
      setClientes(nextClientes);
      // Propagar variable e índice base a operaciones y cuotas pendientes del cliente
      const nextVentas = ventas.map(v =>
        v.cliente_id === editingCliente.id
          ? { ...v, variable_actualizacion: varAct, indice_base: indBase, tasa_mensual_fija: tasaFija }
          : v
      );
      const nextCuotas = cuotas.map(cta => {
        if (cta.cliente_id !== editingCliente.id || cta.nro_cuota === 0 || Number(cta.monto_cobrado || 0) > 0) return cta;
        const baseCta = {
          ...cta,
          variable_actualizacion: varAct,
          indice_base: indBase
        };
        if (cta.devengado) {
          const valMes = varAct === "TASA_FIJA" ? tasaFija : obtenerValorReferenciaMes(varAct, cta.periodo || periodoActivo);
          const calc = calcularCuotaConIndice(baseCta, { tasa_mensual_fija: tasaFija }, valMes);
          return {
            ...baseCta,
            indice_aplicado: calc.indiceAplicado,
            coeficiente_ajuste: calc.coeficiente,
            importe_actualizado: calc.importeActualizado,
            saldo_pendiente: calc.importeActualizado
          };
        }
        const esTasa = varAct === "TASA_FIJA";
        const coef = esTasa ? Math.pow(1 + Math.max(0, tasaFija) / 100, Math.max(0, cta.nro_cuota)) : 1;
        const impAct = Math.round(Number(cta.importe_original || 0) * coef * 100) / 100;
        return {
          ...baseCta,
          indice_aplicado: esTasa ? tasaFija : indBase,
          coeficiente_ajuste: Number(coef.toFixed(6)),
          importe_actualizado: impAct,
          saldo_pendiente: impAct
        };
      });
      setVentas(nextVentas);
      setCuotas(nextCuotas);
      await Promise.all([
        supabase.from("cc_clientes").setAll(nextClientes),
        supabase.from("cc_ventas").setAll(nextVentas),
        supabase.from("cc_cuotas").setAll(nextCuotas)
      ]);
      setModalClienteOpen(false);
      showToast(`Cliente actualizado con variable ${getVariableMeta(varAct).short}.`);
    } else {
      const nuevo = {
        id: generarId("cli"),
        ...clienteForm,
        nombre: clienteForm.nombre.trim(),
        variable_actualizacion: varAct,
        periodo_base: perBase,
        indice_base: indBase,
        tasa_mensual_fija: tasaFija,
        created_at: new Date().toISOString().slice(0, 10)
      };
      const nextClientes = [nuevo, ...clientes];
      setClientes(nextClientes);
      await supabase.from("cc_clientes").setAll(nextClientes);
      setModalClienteOpen(false);
      showToast(`Nuevo cliente guardado (${getVariableMeta(varAct).short}).`);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIÓN 3: MOTOR DE DEVENGAMIENTO MENSUAL (IPC · CAC · HORMIGÓN · LINK · USD)
  // ═══════════════════════════════════════════════════════════════════════════
  const cuotasParaDevengar = useMemo(() => {
    return cuotas
      .filter(c => {
        if (c.nro_cuota === 0) return false;
        const venta = ventasMap[c.venta_id];
        if (!venta || venta.estado === "Rescindida") return false;
        if (filtroProyecto !== "TODOS" && venta.proyecto !== filtroProyecto) return false;
        const cliente = clientesMap[c.cliente_id];
        const varFiltro = c.variable_actualizacion || cliente?.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
        if (filtroVariable !== "TODAS" && varFiltro !== filtroVariable) return false;
        if (incluirAtrasadasDevengamiento) {
          return c.periodo === periodoActivo || (c.periodo < periodoActivo && !c.devengado);
        }
        return c.periodo === periodoActivo;
      })
      .map(c => {
        const venta = ventasMap[c.venta_id];
        const cliente = clientesMap[c.cliente_id];
        const variable = c.variable_actualizacion || cliente?.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
        const valorIndicePeriodo =
          variable === "TASA_FIJA"
            ? Number(cliente?.tasa_mensual_fija ?? venta?.tasa_mensual_fija ?? 0)
            : obtenerValorReferenciaMes(variable, periodoActivo);

        const calculo = calcularCuotaConIndice(c, venta, valorIndicePeriodo, cliente);
        return {
          cuota: c,
          venta,
          cliente,
          variable,
          valorIndicePeriodo,
          indiceBaseEfectivo: calculo.indiceBase,
          previewCoef: calculo.coeficiente,
          previewImporte: calculo.importeActualizado,
          diferenciaAjuste: calculo.importeActualizado - Number(c.importe_original || 0)
        };
      })
      .sort((a, b) => (a.cuota.fecha_vencimiento || "").localeCompare(b.cuota.fecha_vencimiento || ""));
  }, [cuotas, ventasMap, clientesMap, periodoActivo, filtroProyecto, filtroVariable, incluirAtrasadasDevengamiento, obtenerValorReferenciaMes]);

  // Resumen por variable en la vista de Devengamiento Mensual
  const resumenVariablesDevengamiento = useMemo(() => {
    const map = {};
    let totalBase = 0;
    let totalActualizado = 0;
    cuotasParaDevengar.forEach(item => {
      const vKey = item.variable;
      if (!map[vKey]) {
        map[vKey] = { id: vKey, meta: getVariableMeta(vKey), count: 0, base: 0, actualizado: 0 };
      }
      const impBase = Number(item.cuota.importe_original || 0);
      const impAct = item.cuota.devengado ? Number(item.cuota.importe_actualizado || 0) : item.previewImporte;
      map[vKey].count += 1;
      map[vKey].base += impBase;
      map[vKey].actualizado += impAct;
      totalBase += impBase;
      totalActualizado += impAct;
    });
    return {
      porVariable: Object.values(map).sort((a, b) => b.actualizado - a.actualizado),
      totalBase,
      totalActualizado,
      ajusteTotal: totalActualizado - totalBase
    };
  }, [cuotasParaDevengar]);

  const handleDevengarCuotas = async (cuotasIdsADevengar) => {
    if (!cuotasIdsADevengar || cuotasIdsADevengar.length === 0) return;
    const setIds = new Set(cuotasIdsADevengar);
    const fechaHoy = new Date().toISOString().slice(0, 10);
    let count = 0;

    const nextCuotas = cuotas.map(c => {
      if (!setIds.has(c.id)) return c;
      const venta = ventasMap[c.venta_id];
      const cliente = clientesMap[c.cliente_id];
      const variable = c.variable_actualizacion || cliente?.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
      const valorIndicePeriodo =
        variable === "TASA_FIJA"
          ? Number(cliente?.tasa_mensual_fija ?? venta?.tasa_mensual_fija ?? 0)
          : obtenerValorReferenciaMes(variable, periodoActivo);

      const calc = calcularCuotaConIndice(c, venta, valorIndicePeriodo, cliente);
      const cobrado = Number(c.monto_cobrado || 0);
      const nuevoSaldo = Math.max(0, Math.round((calc.importeActualizado - cobrado) * 100) / 100);
      const nuevoEstado = nuevoSaldo <= 0.5 ? "Cobrada" : cobrado > 0 ? "Cobrada Parcial" : "Devengada";
      count++;

      return {
        ...c,
        variable_actualizacion: variable,
        indice_base: calc.indiceBase,
        indice_aplicado: calc.indiceAplicado,
        coeficiente_ajuste: calc.coeficiente,
        importe_actualizado: calc.importeActualizado,
        saldo_pendiente: nuevoSaldo,
        devengado: true,
        fecha_devengamiento: fechaHoy,
        estado: nuevoEstado
      };
    });

    setCuotas(nextCuotas);
    setSelectedCuotaIds([]);
    await supabase.from("cc_cuotas").setAll(nextCuotas);
    showToast(`Devengamiento actualizado para ${count} ${count === 1 ? "cuota" : "cuotas"} (${formatearPeriodoLabel(periodoActivo)}).`);
  };

  const handleRevertirDevengamiento = async (cuota) => {
    if (Number(cuota.monto_cobrado || 0) > 0) {
      return alert("No se puede revertir el devengamiento de una cuota que ya registra cobranzas.");
    }
    const nextCuotas = cuotas.map(c => {
      if (c.id !== cuota.id) return c;
      return {
        ...c,
        coeficiente_ajuste: 1,
        indice_aplicado: c.indice_base,
        importe_actualizado: c.importe_original,
        saldo_pendiente: c.importe_original,
        devengado: false,
        fecha_devengamiento: null,
        estado: "Proyectada"
      };
    });
    setCuotas(nextCuotas);
    await supabase.from("cc_cuotas").setAll(nextCuotas);
    showToast(`Devengamiento de cuota #${cuota.nro_cuota} revertido.`);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIÓN 4: COBRANZA MENSUAL Y RECIBOS
  // ═══════════════════════════════════════════════════════════════════════════
  const cuotasCobranzaPeriodo = useMemo(() => {
    const hoyISO = new Date().toISOString().slice(0, 10);
    return cuotas
      .filter(c => {
        const venta = ventasMap[c.venta_id];
        const cli = clientesMap[c.cliente_id];
        if (!venta || venta.estado === "Rescindida") return false;
        if (filtroProyecto !== "TODOS" && venta.proyecto !== filtroProyecto) return false;
        if (filtroAsignacion !== "TODAS" && venta.asignacion !== filtroAsignacion) return false;
        if (filtroMorosidad !== "TODAS" && venta.segmentacion !== filtroMorosidad) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            (cli?.nombre || "").toLowerCase().includes(q) ||
            (venta.codigo || "").toLowerCase().includes(q) ||
            (venta.unidad_nombre || "").toLowerCase().includes(q) ||
            (venta.asignacion || "").toLowerCase().includes(q);
          if (!match) return false;
        }

        if (filtroEstadoCuota === "VENCIDAS") {
          return c.saldo_pendiente > 0.5 && (c.fecha_vencimiento < hoyISO || c.estado === "Vencida");
        }
        if (c.periodo !== periodoActivo) return false;

        if (filtroEstadoCuota === "PENDIENTES") return c.saldo_pendiente > 0.5;
        if (filtroEstadoCuota === "DEVENGADAS") return c.devengado && c.saldo_pendiente > 0.5;
        if (filtroEstadoCuota === "COBRADAS") return c.saldo_pendiente <= 0.5;
        return true;
      })
      .map(c => ({
        cuota: c,
        venta: ventasMap[c.venta_id],
        cliente: clientesMap[c.cliente_id]
      }))
      .sort((a, b) => (a.cuota.fecha_vencimiento || "").localeCompare(b.cuota.fecha_vencimiento || ""));
  }, [cuotas, ventasMap, clientesMap, periodoActivo, filtroProyecto, filtroAsignacion, filtroMorosidad, filtroEstadoCuota, searchQuery]);

  const abrirModalCobro = (cuota) => {
    const venta = ventasMap[cuota.venta_id];
    const cliente = clientesMap[cuota.cliente_id];
    setModalCobroData({ cuota, venta, cliente });
    setCobroForm({
      fecha_cobro: new Date().toISOString().slice(0, 10),
      medio_pago: cuota.moneda === "USD" ? "Transferencia USD" : "Transferencia Bancaria ARS",
      moneda_pago: cuota.moneda || "ARS",
      tc_aplicado: String(tcActualSistema || 1550),
      importe_pagado: String(Math.round(Number(cuota.saldo_pendiente || 0) * 100) / 100),
      referencia: `REC-${venta?.codigo || "CC"}-C${String(cuota.nro_cuota).padStart(2, "0")}`,
      observaciones: "",
      impactarCashflow: Boolean(onRegistrarCobranzaCashflow)
    });
  };

  const handleConfirmarCobro = async (e) => {
    e.preventDefault();
    if (!modalCobroData) return;
    const { cuota, venta, cliente } = modalCobroData;
    const impPagado = Number(cobroForm.importe_pagado || 0);
    const tc = Math.max(1, Number(cobroForm.tc_aplicado || tcActualSistema || 1550));
    if (impPagado <= 0) return alert("Ingresá un importe cobrado válido mayor a 0.");

    // Convertir importe pagado a la moneda de la cuota para imputar al saldo
    let imputadoEnMonedaCuota = impPagado;
    if (cobroForm.moneda_pago !== cuota.moneda) {
      if (cuota.moneda === "ARS" && cobroForm.moneda_pago === "USD") {
        imputadoEnMonedaCuota = impPagado * tc;
      } else if (cuota.moneda === "USD" && cobroForm.moneda_pago === "ARS") {
        imputadoEnMonedaCuota = impPagado / tc;
      }
    }

    const nuevoCobrado = Math.round((Number(cuota.monto_cobrado || 0) + imputadoEnMonedaCuota) * 100) / 100;
    const nuevoSaldo = Math.max(0, Math.round((Number(cuota.importe_actualizado || 0) - nuevoCobrado) * 100) / 100);
    const nuevoEstado = nuevoSaldo <= 0.5 ? "Cobrada" : "Cobrada Parcial";

    const nextCuotas = cuotas.map(c =>
      c.id === cuota.id
        ? {
            ...c,
            devengado: true,
            fecha_devengamiento: c.fecha_devengamiento || cobroForm.fecha_cobro,
            monto_cobrado: nuevoCobrado,
            saldo_pendiente: nuevoSaldo,
            estado: nuevoEstado
          }
        : c
    );

    const importeArsEquiv = cobroForm.moneda_pago === "USD" ? impPagado * tc : impPagado;
    const nuevaCobranza = {
      id: generarId("cob"),
      fecha_cobro: cobroForm.fecha_cobro,
      periodo_cobro: (cobroForm.fecha_cobro || periodoActivo).slice(0, 7),
      cliente_id: cliente?.id || cuota.cliente_id,
      venta_id: venta?.id || cuota.venta_id,
      cuota_id: cuota.id,
      nro_cuota: cuota.nro_cuota,
      medio_pago: cobroForm.medio_pago,
      moneda_pago: cobroForm.moneda_pago,
      tc_aplicado: tc,
      importe_pagado: impPagado,
      importe_ars_equivalente: Math.round(importeArsEquiv),
      referencia: cobroForm.referencia.trim() || `REC-${Date.now().toString().slice(-5)}`,
      sincronizado_cashflow: Boolean(cobroForm.impactarCashflow && onRegistrarCobranzaCashflow),
      observaciones: cobroForm.observaciones.trim()
    };

    const nextCobranzas = [nuevaCobranza, ...cobranzas];
    setCuotas(nextCuotas);
    setCobranzas(nextCobranzas);

    await Promise.all([
      supabase.from("cc_cuotas").setAll(nextCuotas),
      supabase.from("cc_cobranzas").setAll(nextCobranzas)
    ]);

    if (cobroForm.impactarCashflow && onRegistrarCobranzaCashflow) {
      try {
        await onRegistrarCobranzaCashflow({
          fecha: cobroForm.fecha_cobro,
          montoArs: cobroForm.moneda_pago === "ARS" ? impPagado : 0,
          montoUsd: cobroForm.moneda_pago === "USD" ? impPagado : 0,
          nota: `Cobranza CC ${cliente?.nombre || ""} · ${venta?.proyecto || ""} ${cuota.concepto} (${nuevaCobranza.referencia})`
        });
      } catch (err) {
        console.warn("No se pudo imputar automáticamente al cashflow:", err);
      }
    }

    setModalCobroData(null);
    showToast(`Cobranza ${nuevaCobranza.referencia} registrada (${formatoOriginal(impPagado, cobroForm.moneda_pago)}).`);
  };

  const handleAnularCobranza = async (cob) => {
    if (!window.confirm(`¿Anular el recibo ${cob.referencia} y restaurar el saldo de la cuota?`)) return;
    const cuotaObj = cuotas.find(c => c.id === cob.cuota_id);
    let nextCuotas = cuotas;

    if (cuotaObj) {
      let montoARevertir = Number(cob.importe_pagado || 0);
      const tc = Number(cob.tc_aplicado || tcActualSistema || 1550);
      if (cob.moneda_pago !== cuotaObj.moneda) {
        if (cuotaObj.moneda === "ARS" && cob.moneda_pago === "USD") montoARevertir = montoARevertir * tc;
        else if (cuotaObj.moneda === "USD" && cob.moneda_pago === "ARS") montoARevertir = montoARevertir / tc;
      }
      const nuevoCobrado = Math.max(0, Math.round((Number(cuotaObj.monto_cobrado || 0) - montoARevertir) * 100) / 100);
      const nuevoSaldo = Math.max(0, Math.round((Number(cuotaObj.importe_actualizado || 0) - nuevoCobrado) * 100) / 100);
      const nuevoEstado = nuevoCobrado > 0.5 ? "Cobrada Parcial" : (cuotaObj.devengado ? "Devengada" : "Proyectada");

      nextCuotas = cuotas.map(c =>
        c.id === cuotaObj.id
          ? { ...c, monto_cobrado: nuevoCobrado, saldo_pendiente: nuevoSaldo, estado: nuevoEstado }
          : c
      );
    }

    const nextCobranzas = cobranzas.filter(x => x.id !== cob.id);
    setCuotas(nextCuotas);
    setCobranzas(nextCobranzas);
    await Promise.all([
      supabase.from("cc_cuotas").setAll(nextCuotas),
      supabase.from("cc_cobranzas").setAll(nextCobranzas)
    ]);
    showToast(`Recibo ${cob.referencia} anulado.`);
  };

  // Exportar Excel completo o extracto de cliente
  const handleExportarExcel = (clienteFiltro = null) => {
    try {
      const wb = XLSX.utils.book_new();
      const cliList = clienteFiltro ? [clienteFiltro] : clientes;
      const vtaList = clienteFiltro ? ventas.filter(v => v.cliente_id === clienteFiltro.id) : ventas;
      const ctaList = clienteFiltro ? cuotas.filter(c => c.cliente_id === clienteFiltro.id) : cuotas;
      const cobList = clienteFiltro ? cobranzas.filter(c => c.cliente_id === clienteFiltro.id) : cobranzas;

      const wsCli = XLSX.utils.json_to_sheet(cliList.map(c => ({
        "Cliente / Razón Social": c.nombre,
        "DNI / CUIT": c.dni_cuit,
        "Condición Fiscal": c.condicion_fiscal,
        "Teléfono": c.telefono,
        "Email": c.email,
        "Domicilio": c.domicilio
      })));
      XLSX.utils.book_append_sheet(wb, wsCli, "Clientes");

      const wsVta = XLSX.utils.json_to_sheet(vtaList.map(v => ({
        "Código": v.codigo,
        "Cliente": clientesMap[v.cliente_id]?.nombre || "",
        "Proyecto": v.proyecto,
        "Unidad": v.unidad_nombre,
        "Asignación": v.asignacion || "",
        "Condición": v.condicion_venta || "FINANCIADO",
        "Cuotas Totales": v.cantidad_cuotas,
        "Cuotas Pendientes": v.cuotas_pendientes ?? v.cantidad_cuotas,
        "Vto Anterior": v.fecha_vto_anterior || "",
        "Vto Actual": v.fecha_vto_actual || v.fecha_primer_vencimiento || "",
        "Fecha Cobro Ant.": v.fecha_cobro_anterior || "",
        "Fecha Cobro Act.": v.fecha_cobro_actual || "",
        "Retraso Total (días)": v.dias_retraso_total ?? 0,
        "Morosidad": v.morosidad || "",
        "Segmentación": v.segmentacion || "",
        "Saldo Vencido Mes Ant.": v.saldo_vencido_anterior || 0,
        "Cuota Mes": v.cuota_mes || 0,
        "Ingreso Nva Venta": v.ingreso_nueva_venta || 0,
        "Total a Cobrar": v.total_a_cobrar || 0,
        "Saldo Fin de Mes": v.saldo_fin_mes || 0,
        "Saldo a Vencer": v.saldo_a_vencer || 0,
        "Variable Act.": v.variable_actualizacion
      })));
      XLSX.utils.book_append_sheet(wb, wsVta, "Cartera y Ventas");

      const wsCta = XLSX.utils.json_to_sheet(ctaList.map(c => ({
        "Cliente": clientesMap[c.cliente_id]?.nombre || "",
        "Operación": ventasMap[c.venta_id]?.codigo || "",
        "Proyecto": ventasMap[c.venta_id]?.proyecto || "",
        "Concepto": c.concepto,
        "Período": c.periodo,
        "Vencimiento": c.fecha_vencimiento,
        "Moneda": c.moneda,
        "Importe Original": c.importe_original,
        "Variable": c.variable_actualizacion,
        "Coeficiente": c.coeficiente_ajuste,
        "Importe Actualizado": c.importe_actualizado,
        "Cobrado": c.monto_cobrado,
        "Saldo Pendiente": c.saldo_pendiente,
        "Estado": c.estado
      })));
      XLSX.utils.book_append_sheet(wb, wsCta, "Plan de Cuotas");

      const wsCob = XLSX.utils.json_to_sheet(cobList.map(cb => ({
        "Fecha Cobro": cb.fecha_cobro,
        "Recibo": cb.referencia,
        "Cliente": clientesMap[cb.cliente_id]?.nombre || "",
        "Operación": ventasMap[cb.venta_id]?.codigo || "",
        "Cuota #": cb.nro_cuota,
        "Medio de Pago": cb.medio_pago,
        "Moneda": cb.moneda_pago,
        "Importe Pagado": cb.importe_pagado,
        "TC": cb.tc_aplicado,
        "Equivalente ARS": cb.importe_ars_equivalente
      })));
      XLSX.utils.book_append_sheet(wb, wsCob, "Cobranzas");

      const nombreArchivo = clienteFiltro
        ? `Cuenta_Corriente_${clienteFiltro.nombre.replace(/\s+/g, "_")}.xlsx`
        : `Cuentas_Corrientes_Link_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);
    } catch (err) {
      console.error("Error exportando Excel:", err);
      alert("No se pudo generar el archivo Excel.");
    }
  };

  // Recargar cartera oficial desde planilla
  const handleRestaurarCartera = async () => {
    if (!window.confirm("¿Recargar la cartera oficial completa (80 operaciones al 30/11/2026)? Se perderán cambios manuales no exportados.")) return;
    setClientes(DEFAULT_CC_CLIENTES);
    setVentas(DEFAULT_CC_VENTAS);
    setCuotas(DEFAULT_CC_CUOTAS);
    setCobranzas(DEFAULT_CC_COBRANZAS);
    await Promise.all([
      supabase.from("cc_clientes").setAll(DEFAULT_CC_CLIENTES),
      supabase.from("cc_ventas").setAll(DEFAULT_CC_VENTAS),
      supabase.from("cc_cuotas").setAll(DEFAULT_CC_CUOTAS),
      supabase.from("cc_cobranzas").setAll(DEFAULT_CC_COBRANZAS)
    ]);
    showToast("Cartera oficial de Cuentas Corrientes recargada (80 operaciones).");
  };

  const clienteDetalle = clienteDetalleId ? clientesEnriquecidos.find(c => c.id === clienteDetalleId) : null;

  const cobranzasDelPeriodo = useMemo(() => {
    return cobranzas
      .filter(c => c.periodo_cobro === periodoActivo)
      .sort((a, b) => (b.fecha_cobro || "").localeCompare(a.fecha_cobro || ""));
  }, [cobranzas, periodoActivo]);

  const metricasCobranzaMes = useMemo(() => {
    let exigible = 0;
    let pendiente = 0;
    let cobrado = 0;
    cuotas.forEach(c => {
      if (c.periodo === periodoActivo) {
        exigible += aMonedaVista(c.importe_actualizado, c.moneda);
        pendiente += aMonedaVista(c.saldo_pendiente, c.moneda);
      }
    });
    cobranzasDelPeriodo.forEach(cob => {
      cobrado += aMonedaVista(cob.importe_pagado, cob.moneda_pago);
    });
    const pct = exigible > 0 ? Math.min(100, (cobrado / exigible) * 100) : 0;
    return { exigible, pendiente, cobrado, pct };
  }, [cuotas, cobranzasDelPeriodo, periodoActivo, aMonedaVista]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: tokens.textMuted, fontSize: 14 }}>
        Cargando módulo de Cuentas Corrientes…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* Notificación flotante */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2000,
          background: tokens.ink,
          color: "#FFFFFF",
          padding: "12px 18px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 10px 24px rgba(14,21,36,0.22)"
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toast}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <div style={{
        background: tokens.surface,
        border: `1px solid ${tokens.rule}`,
        borderRadius: 10,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
              Link Inversiones · Gestión de Cartera Comercial
            </div>
            <h1 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 24, fontWeight: 600, color: tokens.text, letterSpacing: "-0.02em" }}>
              Cuentas Corrientes, Devengamiento y Cobranzas
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.textMuted }}>
              Generación automática de clientes y planes de cuotas desde ventas, actualización por índices y cobranza mensual.
            </p>
          </div>

          {/* Acciones Principales */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", background: colorTablaBg, padding: 3, borderRadius: 7, border: `1px solid ${colorLineaSuave}` }}>
              {["ARS", "USD"].map(m => (
                <button
                  key={m}
                  onClick={() => setMonedaVista(m)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 5,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    background: monedaVista === m ? tokens.ink : "transparent",
                    color: monedaVista === m ? "#FFFFFF" : tokens.textMuted
                  }}
                >
                  {m === "ARS" ? "$ ARS" : "U$D"}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleExportarExcel(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 7,
                border: `1px solid ${colorLineaFuerte}`,
                background: tokens.surface,
                color: tokens.text,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              <Download size={15} color={tokens.positive} /> Exportar Excel
            </button>

            <button
              onClick={abrirModalNuevaVenta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 7,
                border: "none",
                background: tokens.ink,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              <Plus size={16} /> Nueva Venta
            </button>
          </div>
        </div>

        {/* Sub-navegación del módulo + selector de Período de trabajo */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${tokens.ruleSoft}`
        }}>
          <div className="horizontal-scroll-menu" style={{ display: "flex", gap: 4, background: colorTablaBg, padding: 4, borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
            {[
              { id: "resumen", label: "Resumen Cartera", icon: BarChart3 },
              { id: "clientes", label: `Clientes (${clientes.length})`, icon: Users },
              { id: "ventas", label: `Ventas y Planes (${ventas.length})`, icon: FileText },
              { id: "devengamiento", label: "Devengamiento Mensual", icon: Calculator },
              { id: "cobranza", label: "Cobranza Mensual", icon: Wallet }
            ].map(item => {
              const Icon = item.icon;
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSubTab(item.id);
                    if (item.id !== "clientes") setClienteDetalleId(null);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 13px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    background: active ? tokens.surface : "transparent",
                    color: active ? tokens.ink : tokens.textMuted,
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    whiteSpace: "nowrap",
                    flexShrink: 0
                  }}
                >
                  <Icon size={14} color={active ? tokens.gold : "currentColor"} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: tokens.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={14} color={tokens.gold} /> Período mensual:
              <input
                type="month"
                value={periodoActivo}
                onChange={(e) => setPeriodoActivo(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${colorLineaFuerte}`,
                  fontSize: 12.5,
                  fontFamily: tokens.fontMono,
                  fontWeight: 600,
                  color: tokens.ink,
                  background: "#FFFFFF"
                }}
              />
            </label>
            <button
              onClick={handleRestaurarCartera}
              title="Recargar cartera oficial al 30/11/2026"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${colorLineaSuave}`,
                background: tokens.surface,
                color: tokens.textMuted,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11.5
              }}
            >
              <RotateCcw size={13} /> Recargar Cartera
            </button>
          </div>
        </div>
      </div>

      {/* KPI STRIP SUPERIOR (4 Tarjetas limpias, tipografía tabular) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Saldo Pendiente Total (A Vencer + Exig.)</div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.ink, marginTop: 6 }}>
            {formatoVista(kpisCartera.saldoPendienteTotal, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            {kpisCartera.cantVentas} operaciones · {kpisCartera.cantClientes} clientes
          </div>
        </div>

        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Exigible ({formatearPeriodoLabel(periodoActivo)}) + Vencido Ant.
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.gold, marginTop: 6 }}>
            {formatoVista(kpisCartera.devengadoMes + kpisCartera.saldoVencidoAnterior, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: kpisCartera.operacionesVencidas > 0 ? tokens.negative : tokens.textMuted, marginTop: 4 }}>
            Vencido mes ant.: {formatoVista(kpisCartera.saldoVencidoAnterior, monedaVista)} ({kpisCartera.operacionesVencidas} ops. vencidas)
          </div>
        </div>

        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Cuotas Devengadas ({formatearPeriodoLabel(periodoActivo)})
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.ink, marginTop: 6 }}>
            {formatoVista(kpisCartera.devengadoMes, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Exigible nominal del período: {formatoVista(kpisCartera.exigibleMes, monedaVista)}
          </div>
        </div>

        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Cobranza ({formatearPeriodoLabel(periodoActivo)})
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.positive, marginTop: 6 }}>
            {formatoVista(kpisCartera.cobradoMes, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Cumplimiento sobre devengado: {kpisCartera.tasaCobranzaMes.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          VISTA 1: RESUMEN CARTERA
          ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === "resumen" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 18 }}>
            {/* Gráfico Devengado vs Cobrado por mes */}
            <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 17, fontWeight: 600, color: tokens.text }}>
                    Curva de Devengamiento y Cobranza Mensual
                  </h3>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                    Cuotas proyectadas, devengadas y cobranzas efectivas ({monedaVista})
                  </div>
                </div>
              </div>

              {chartDevengadoCobrado.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: tokens.textMuted, fontSize: 13 }}>
                  No hay cuotas registradas en cartera.
                </div>
              ) : (
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDevengadoCobrado} margin={{ top: 10, right: 12, left: 6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEDE7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: tokens.textMuted }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: tokens.textMuted }}
                        tickFormatter={(v) => monedaVista === "USD" ? `${Math.round(v / 1000)}k` : `${Math.round(v / 1000000)}M`}
                      />
                      <Tooltip
                        formatter={(val, name) => [formatoVista(val, monedaVista), name]}
                        contentStyle={{ background: "#FFFFFF", border: `1px solid ${colorLineaFuerte}`, borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Proyectado" stackId="a" fill="#CBD5E1" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Devengado" stackId="a" fill="#B8862A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Cobrado" fill="#0E7C66" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tabla de Cartera por Proyecto */}
            <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 17, fontWeight: 600, color: tokens.text }}>
                  Cartera por Proyecto
                </h3>
                <p style={{ margin: "0 0 14px 0", fontSize: 12, color: tokens.textMuted }}>
                  Operaciones activas, cuota mes, vencido anterior y saldo a percibir
                </p>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                        <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>Proyecto</th>
                        <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 600 }}>Ops.</th>
                        <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Cuota Mes</th>
                        <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Saldo Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenPorProyecto.map(r => (
                        <tr key={r.proyecto} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                          <td style={{ padding: "9px 6px", fontWeight: 600, color: tokens.text }}>{r.proyecto}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: tokens.fontMono }}>{r.operaciones}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: tokens.fontMono }}>{formatoVista(r.cuotaMes, monedaVista)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600, color: tokens.ink }}>{formatoVista(r.pendiente, monedaVista)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${tokens.ruleSoft}`, display: "flex", gap: 10 }}>
                <button
                  onClick={() => setSubTab("devengamiento")}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 7,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: colorTablaBg,
                    color: tokens.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Ir a Devengamiento →
                </button>
                <button
                  onClick={() => setSubTab("cobranza")}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 7,
                    border: "none",
                    background: tokens.ink,
                    color: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Ir a Cobranza →
                </button>
              </div>
            </div>
          </div>

          {/* Desglose por Asignación y Segmentación de Morosidad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 22px" }}>
              <h3 style={{ margin: "0 0 10px 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
                Cartera por Asignación
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                    <th style={{ textAlign: "left", padding: "7px 6px" }}>Asignación</th>
                    <th style={{ textAlign: "center", padding: "7px 6px" }}>Ops.</th>
                    <th style={{ textAlign: "right", padding: "7px 6px" }}>Cuota Mes</th>
                    <th style={{ textAlign: "right", padding: "7px 6px" }}>Saldo a Vencer</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenAsignacionYMorosidad.asignaciones.map(a => (
                    <tr key={a.label} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{ padding: "8px 6px", fontWeight: 600 }}>{a.label}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: tokens.fontMono }}>{a.ops}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: tokens.fontMono }}>{formatoVista(a.cuotaMes, monedaVista)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>{formatoVista(a.saldoPend, monedaVista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 22px" }}>
              <h3 style={{ margin: "0 0 10px 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
                Segmentación de Morosidad ({formatearPeriodoLabel(periodoActivo)})
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                    <th style={{ textAlign: "left", padding: "7px 6px" }}>Segmento</th>
                    <th style={{ textAlign: "center", padding: "7px 6px" }}>Ops.</th>
                    <th style={{ textAlign: "right", padding: "7px 6px" }}>Vencido Ant.</th>
                    <th style={{ textAlign: "right", padding: "7px 6px" }}>Total a Cobrar Mes</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenAsignacionYMorosidad.morosidad.map(m => (
                    <tr key={m.label} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{
                        padding: "8px 6px",
                        fontWeight: 600,
                        color: m.label === "AL DIA" ? tokens.positive : m.label.includes("30 - 60") || m.label.includes("+ 60") ? tokens.negative : tokens.gold
                      }}>
                        {m.label}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: tokens.fontMono }}>{m.ops}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: tokens.fontMono, color: m.vencidoAnt > 0 ? tokens.negative : tokens.textMuted }}>
                        {m.vencidoAnt > 0 ? formatoVista(m.vencidoAnt, monedaVista) : "—"}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>{formatoVista(m.totalCobrar, monedaVista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VISTA 2: CLIENTES Y EXTRACTO DE CUENTA CORRIENTE
          ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === "clientes" && !clienteDetalle && (
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>Padrón de Clientes</h3>
              <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                Clientes generados automáticamente desde las operaciones de venta y sus estados de cuenta
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color={tokens.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Buscar cliente, unidad, proyecto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "8px 12px 8px 32px",
                    borderRadius: 7,
                    border: `1px solid ${colorLineaFuerte}`,
                    fontSize: 12.5,
                    minWidth: 210
                  }}
                />
              </div>

              <select
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODOS">Todos los proyectos</option>
                {proyectosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={filtroMorosidad}
                onChange={(e) => setFiltroMorosidad(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODAS">Toda morosidad</option>
                {SEGMENTACIONES_MOROSIDAD.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <select
                value={filtroVariable}
                onChange={(e) => setFiltroVariable(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODAS">Todas las variables</option>
                {VARIABLES_ACTUALIZACION.map(va => <option key={va.id} value={va.id}>{va.short}</option>)}
              </select>

              <button
                onClick={() => abrirModalCliente(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: `1px solid ${colorLineaFuerte}`,
                  background: tokens.surface,
                  color: tokens.ink,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <Plus size={14} /> Nuevo Cliente
              </button>
            </div>
          </div>

          {selectedClienteIds.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 14px",
              marginBottom: 14,
              borderRadius: 8,
              background: colorTablaBg,
              border: `1px solid ${colorLineaFuerte}`
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.ink, display: "flex", alignItems: "center", gap: 8 }}>
                <Sliders size={14} />
                <span>{selectedClienteIds.length} {selectedClienteIds.length === 1 ? "cliente seleccionado" : "clientes seleccionados"} — Asignar variable de actualización:</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={batchVariable}
                  onChange={(e) => setBatchVariable(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, fontWeight: 600, background: "#FFFFFF" }}
                >
                  {VARIABLES_ACTUALIZACION.map(va => <option key={va.id} value={va.id}>{va.label}</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11.5, color: tokens.textMuted }}>Mes Base:</span>
                  <input
                    type="month"
                    value={batchPeriodoBase}
                    onChange={(e) => setBatchPeriodoBase(e.target.value)}
                    style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
                  />
                </div>
                <button
                  onClick={async () => {
                    await aplicarVariableAClientes(selectedClienteIds, batchVariable, {
                      periodo_base: batchPeriodoBase,
                      recalcularDevengadas: true
                    });
                    setSelectedClienteIds([]);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: tokens.ink,
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Aplicar Variable
                </button>
                <button
                  onClick={() => setSelectedClienteIds([])}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: "#FFFFFF",
                    color: tokens.textMuted,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {clientesEnriquecidos.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: tokens.textMuted }}>
              No se encontraron clientes con ese criterio.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                    <th style={{ padding: "10px 8px", textAlign: "center", width: 32 }}>
                      <input
                        type="checkbox"
                        checked={clientesEnriquecidos.length > 0 && clientesEnriquecidos.every(c => selectedClienteIds.includes(c.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedClienteIds(clientesEnriquecidos.map(c => c.id));
                          else setSelectedClienteIds([]);
                        }}
                      />
                    </th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>Cliente / Razón Social</th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>Proyectos y Unidades</th>
                    <th style={{ textAlign: "center", padding: "10px 8px" }}>Ops.</th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>Variable / Base</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>A Cobrar Mes ({monedaVista})</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>Cobrado ({monedaVista})</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>Saldo Pendiente ({monedaVista})</th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>Estado</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesEnriquecidos.map(cli => (
                    <tr key={cli.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{ padding: "11px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedClienteIds.includes(cli.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedClienteIds(prev => [...prev, cli.id]);
                            else setSelectedClienteIds(prev => prev.filter(id => id !== cli.id));
                          }}
                        />
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        <div style={{ fontWeight: 600, color: tokens.ink }}>{cli.nombre}</div>
                        <div style={{ fontSize: 11, color: tokens.textMuted }}>
                          {cli.dni_cuit && cli.dni_cuit !== "—" ? cli.dni_cuit : cli.condicion_fiscal}
                        </div>
                      </td>
                      <td style={{ padding: "11px 10px", fontSize: 12 }}>
                        {cli.ventasCli.map(v => `${v.proyecto} (${v.unidad_nombre})`).join(" · ") || "—"}
                      </td>
                      <td style={{ padding: "11px 8px", textAlign: "center", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {cli.ventasCli.length}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <select
                          value={cli.variableEfectiva}
                          onChange={(e) => aplicarVariableAClientes(cli.id, e.target.value, {
                            periodo_base: cli.periodoBaseEfectivo || periodoActivo,
                            recalcularDevengadas: true
                          })}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 5,
                            border: `1px solid ${colorLineaFuerte}`,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: "#FFFFFF",
                            color: tokens.ink,
                            cursor: "pointer"
                          }}
                        >
                          {VARIABLES_ACTUALIZACION.map(va => (
                            <option key={va.id} value={va.id}>{va.short}</option>
                          ))}
                        </select>
                        <div style={{ fontSize: 10.5, color: tokens.textMuted, fontFamily: tokens.fontMono, marginTop: 3 }}>
                          {cli.variableEfectiva === "SIN_AJUSTE"
                            ? "Cuota fija"
                            : cli.variableEfectiva === "TASA_FIJA"
                              ? `${cli.tasaFijaEfectiva}% mensual`
                              : `Base ${formatearPeriodoLabel(cli.periodoBaseEfectivo)}: ${fmt(cli.indiceBaseEfectivo)}`}
                        </div>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.gold, fontWeight: 600 }}>
                        {formatoVista(cli.totalCobrarMesVista, monedaVista)}
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.positive }}>
                        {cli.cobradoVista > 0 ? formatoVista(cli.cobradoVista, monedaVista) : "—"}
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.ink }}>
                        {formatoVista(cli.saldoVista, monedaVista)}
                      </td>
                      <td style={{ padding: "11px 10px", fontSize: 11.5, fontWeight: 600 }}>
                        {cli.segmentaciones.map((s, idx) => (
                          <div key={idx} style={{ color: s === "AL DIA" ? tokens.positive : s.includes("30 - 60") || s.includes("+ 60") ? tokens.negative : tokens.gold }}>
                            {s}
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => setClienteDetalleId(cli.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: `1px solid ${colorLineaFuerte}`,
                              background: tokens.surface,
                              color: tokens.ink,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            <Eye size={13} /> Cuenta Corriente
                          </button>
                          <button
                            onClick={() => abrirModalCliente(cli)}
                            title="Editar datos del cliente"
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `1px solid ${colorLineaSuave}`,
                              background: tokens.surface,
                              color: tokens.textMuted,
                              cursor: "pointer"
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETALLE DE CUENTA CORRIENTE DE UN CLIENTE */}
      {subTab === "clientes" && clienteDetalle && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <button
                  onClick={() => setClienteDetalleId(null)}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: colorTablaBg,
                    color: tokens.ink,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  <ArrowLeft size={14} /> Volver
                </button>
                <div>
                  <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 21, fontWeight: 600 }}>{clienteDetalle.nombre}</h2>
                  <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 4 }}>
                    {clienteDetalle.dni_cuit} · {clienteDetalle.condicion_fiscal} · {clienteDetalle.telefono} · {clienteDetalle.email}
                  </div>
                  {clienteDetalle.domicilio && (
                    <div style={{ fontSize: 12, color: tokens.textFaint, marginTop: 2 }}>{clienteDetalle.domicilio}</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => abrirModalCliente(clienteDetalle)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: tokens.surface,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Edit2 size={13} /> Editar Cliente
                </button>
                <button
                  onClick={() => handleExportarExcel(clienteDetalle)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: tokens.ink,
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Download size={13} /> Exportar Extracto
                </button>
              </div>
            </div>

            {/* Resumen del cliente */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, paddingTop: 14, borderTop: `1px solid ${tokens.ruleSoft}` }}>
              <div>
                <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Total Contratado</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                  {formatoVista(clienteDetalle.contratadoVista, monedaVista)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Total Cobrado</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 600, color: tokens.positive, marginTop: 2 }}>
                  {formatoVista(clienteDetalle.cobradoVista, monedaVista)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Saldo Pendiente</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 700, color: tokens.ink, marginTop: 2 }}>
                  {formatoVista(clienteDetalle.saldoVista, monedaVista)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: tokens.textMuted }}>Cuotas Pendientes / Devengadas</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                  {clienteDetalle.cuotasPend} ({clienteDetalle.cuotasDev} dev.)
                </div>
              </div>
            </div>

            {/* Configuración de Variable de Actualización del Cliente */}
            <div style={{
              marginTop: 14,
              padding: "11px 14px",
              borderRadius: 8,
              background: colorTablaBg,
              border: `1px solid ${colorLineaSuave}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Sliders size={14} color={tokens.ink} />
                <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink }}>Variable de Actualización Asignada:</span>
                <select
                  value={clienteDetalle.variableEfectiva}
                  onChange={(e) => aplicarVariableAClientes(clienteDetalle.id, e.target.value, {
                    periodo_base: clienteDetalle.periodoBaseEfectivo || periodoActivo,
                    recalcularDevengadas: true
                  })}
                  style={{
                    padding: "5px 9px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#FFFFFF",
                    color: tokens.ink,
                    cursor: "pointer"
                  }}
                >
                  {VARIABLES_ACTUALIZACION.map(va => (
                    <option key={va.id} value={va.id}>{va.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11.5, color: tokens.textMuted, fontFamily: tokens.fontMono }}>
                  {clienteDetalle.variableEfectiva === "SIN_AJUSTE"
                    ? "Sin ajuste mensual"
                    : clienteDetalle.variableEfectiva === "TASA_FIJA"
                      ? `Tasa fija: ${clienteDetalle.tasaFijaEfectiva}% mensual`
                      : `Base ${formatearPeriodoLabel(clienteDetalle.periodoBaseEfectivo)}: ${fmt(clienteDetalle.indiceBaseEfectivo)} · Ref. ${formatearPeriodoLabel(periodoActivo)}: ${fmt(obtenerValorReferenciaMes(clienteDetalle.variableEfectiva, periodoActivo))}`}
                </span>
              </div>
              <button
                onClick={() => aplicarVariableAClientes(clienteDetalle.id, clienteDetalle.variableEfectiva, {
                  periodo_base: clienteDetalle.periodoBaseEfectivo || periodoActivo,
                  indice_base: clienteDetalle.indiceBaseEfectivo,
                  tasa_mensual_fija: clienteDetalle.tasaFijaEfectiva,
                  recalcularDevengadas: true
                })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 11px",
                  borderRadius: 6,
                  border: `1px solid ${colorLineaFuerte}`,
                  background: "#FFFFFF",
                  color: tokens.ink,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <RefreshCw size={12} /> Recalcular Cuotas No Cobradas
              </button>
            </div>
          </div>

          {/* Extracto de cuotas por operación */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 22px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
              Extracto de Cuenta Corriente (Detalle de Cuotas)
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                    <th style={{ textAlign: "left", padding: "9px 10px" }}>Op. / Unidad</th>
                    <th style={{ textAlign: "left", padding: "9px 8px" }}>Cuota</th>
                    <th style={{ textAlign: "center", padding: "9px 8px" }}>Vencimiento</th>
                    <th style={{ textAlign: "left", padding: "9px 8px" }}>Variable</th>
                    <th style={{ textAlign: "right", padding: "9px 8px" }}>Importe Base</th>
                    <th style={{ textAlign: "right", padding: "9px 8px" }}>Coef.</th>
                    <th style={{ textAlign: "right", padding: "9px 8px" }}>Importe Actualizado</th>
                    <th style={{ textAlign: "right", padding: "9px 8px" }}>Cobrado</th>
                    <th style={{ textAlign: "right", padding: "9px 8px" }}>Saldo</th>
                    <th style={{ textAlign: "center", padding: "9px 8px" }}>Estado</th>
                    <th style={{ textAlign: "center", padding: "9px 10px" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {clienteDetalle.cuotasCli
                    .slice()
                    .sort((a, b) => (a.fecha_vencimiento || "").localeCompare(b.fecha_vencimiento || "") || a.nro_cuota - b.nro_cuota)
                    .map(c => {
                      const v = ventasMap[c.venta_id];
                      const varMeta = getVariableMeta(c.variable_actualizacion || clienteDetalle.variableEfectiva);
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                          <td style={{ padding: "9px 10px" }}>
                            <div style={{ fontWeight: 600, color: tokens.ink }}>{v?.codigo}</div>
                            <div style={{ fontSize: 11, color: tokens.textMuted }}>{v?.proyecto} · {v?.unidad_nombre}</div>
                          </td>
                          <td style={{ padding: "9px 8px", fontWeight: 600 }}>{c.concepto}</td>
                          <td style={{ padding: "9px 8px", textAlign: "center", fontFamily: tokens.fontMono }}>{formatDate(c.fecha_vencimiento)}</td>
                          <td style={{ padding: "9px 8px", fontSize: 11.5, color: tokens.textMuted }}>{varMeta?.short || c.variable_actualizacion}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>{formatoOriginal(c.importe_original, c.moneda)}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.textMuted }}>
                            {Number(c.coeficiente_ajuste || 1).toFixed(4)}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                            {formatoOriginal(c.importe_actualizado, c.moneda)}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.positive }}>
                            {c.monto_cobrado > 0 ? formatoOriginal(c.monto_cobrado, c.moneda) : "—"}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700 }}>
                            {c.saldo_pendiente > 0.5 ? formatoOriginal(c.saldo_pendiente, c.moneda) : "$ 0"}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "center", fontSize: 11.5, fontWeight: 600, color: c.estado === "Cobrada" ? tokens.positive : c.devengado ? tokens.gold : tokens.textMuted }}>
                            {c.estado}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "center" }}>
                            {c.saldo_pendiente > 0.5 ? (
                              <div style={{ display: "inline-flex", gap: 4 }}>
                                {!c.devengado && (
                                  <button
                                    onClick={() => handleDevengarCuotas([c.id])}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 5,
                                      border: `1px solid ${colorLineaFuerte}`,
                                      background: tokens.surface,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer"
                                    }}
                                  >
                                    Devengar
                                  </button>
                                )}
                                <button
                                  onClick={() => abrirModalCobro(c)}
                                  style={{
                                    padding: "4px 9px",
                                    borderRadius: 5,
                                    border: "none",
                                    background: tokens.ink,
                                    color: "#FFFFFF",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer"
                                  }}
                                >
                                  Cobrar
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: tokens.positive }}>Cancelada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VISTA 3: VENTAS Y PLANES DE FINANCIACIÓN
          ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === "ventas" && (
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>
                Cartera de Operaciones y Planes de Cuotas ({ventasFiltradas.length})
              </h3>
              <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                Asignación, cuotas pendientes/totales, atraso, vencido anterior, cuota mensual y saldo a vencer
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color={tokens.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Buscar cliente, unidad…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: "7px 10px 7px 30px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12 }}
                />
              </div>
              <select
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODOS">Todos los proyectos</option>
                {proyectosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filtroAsignacion}
                onChange={(e) => setFiltroAsignacion(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODAS">Todas las asignaciones</option>
                {ASIGNACIONES_CC.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={filtroMorosidad}
                onChange={(e) => setFiltroMorosidad(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
              >
                <option value="TODAS">Toda morosidad</option>
                {SEGMENTACIONES_MOROSIDAD.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button
                onClick={abrirModalNuevaVenta}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: tokens.ink,
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <Plus size={15} /> Registrar Venta
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Cliente / Op.</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Proyecto / Unidad</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Asignación</th>
                  <th style={{ textAlign: "center", padding: "10px 6px" }}>Cuotas (Pend/Tot)</th>
                  <th style={{ textAlign: "center", padding: "10px 8px" }}>Vto. Act. / Ret.</th>
                  <th style={{ textAlign: "right", padding: "10px 8px" }}>Vencido Ant.</th>
                  <th style={{ textAlign: "right", padding: "10px 8px" }}>Cuota Mes</th>
                  <th style={{ textAlign: "right", padding: "10px 8px" }}>Total a Cobrar</th>
                  <th style={{ textAlign: "right", padding: "10px 8px" }}>Saldo a Vencer</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Morosidad</th>
                  <th style={{ textAlign: "center", padding: "10px 8px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map(v => {
                  const cli = clientesMap[v.cliente_id];
                  const seg = v.segmentacion || "AL DIA";
                  const segColor = seg === "AL DIA" ? tokens.positive : seg.includes("30 - 60") || seg.includes("+ 60") ? tokens.negative : tokens.gold;
                  return (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 600, color: tokens.ink }}>{cli?.nombre || "—"}</div>
                        <div style={{ fontSize: 10.5, fontFamily: tokens.fontMono, color: tokens.textMuted }}>{v.codigo}</div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 600 }}>{v.proyecto}</div>
                        <div style={{ fontSize: 11, color: tokens.textMuted }}>{v.unidad_nombre}</div>
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: 11.5, color: tokens.text }}>{v.asignacion || "—"}</td>
                      <td style={{ padding: "10px 6px", textAlign: "center", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {v.cuotas_pendientes ?? v.cantidad_cuotas} / {v.cantidad_cuotas}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: tokens.fontMono, fontSize: 11.5 }}>
                        <div>{formatDate(v.fecha_vto_actual || v.fecha_primer_vencimiento)}</div>
                        {Number(v.dias_retraso_total || 0) > 0 && (
                          <div style={{ fontSize: 10.5, color: tokens.negative }}>{v.dias_retraso_total}d atraso</div>
                        )}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, color: v.saldo_vencido_anterior > 0 ? tokens.negative : tokens.textMuted }}>
                        {v.saldo_vencido_anterior > 0 ? formatoOriginal(v.saldo_vencido_anterior, v.moneda_origen) : "—"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                        {v.cuota_mes > 0 ? formatoOriginal(v.cuota_mes, v.moneda_origen) : v.ingreso_nueva_venta > 0 ? formatoOriginal(v.ingreso_nueva_venta, v.moneda_origen) : "—"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.ink }}>
                        {formatoOriginal(v.total_a_cobrar ?? v.cuota_mes ?? 0, v.moneda_origen)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {formatoOriginal(v.saldo_a_vencer ?? v.saldo_financiar ?? 0, v.moneda_origen)}
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: 11, fontWeight: 700, color: segColor }}>
                        {seg}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 5 }}>
                          <button
                            onClick={() => {
                              setClienteDetalleId(v.cliente_id);
                              setSubTab("clientes");
                            }}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 5,
                              border: `1px solid ${colorLineaFuerte}`,
                              background: tokens.surface,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            Ver Plan
                          </button>
                          <button
                            onClick={() => handleEliminarVenta(v)}
                            title="Eliminar operación"
                            style={{
                              padding: "5px 6px",
                              borderRadius: 5,
                              border: `1px solid ${tokens.ruleSoft}`,
                              background: tokens.surface,
                              color: tokens.negative,
                              cursor: "pointer"
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VISTA 4: DEVENGAMIENTO MENSUAL (ÍNDICES Y EMISIÓN DE CUOTAS)
          ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === "devengamiento" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Panel de parámetros e índices del período */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>
                  Valores de Referencia Mensual — {formatearPeriodoLabel(periodoActivo)}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: tokens.textMuted }}>
                  Cada cuota toma el valor mensual vigente de la variable asignada al cliente (IPC, CAC, Hormigón H-21, Link o USD).
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: tokens.text, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={incluirAtrasadasDevengamiento}
                    onChange={(e) => setIncluirAtrasadasDevengamiento(e.target.checked)}
                  />
                  Incluir períodos anteriores sin devengar
                </label>
                <button
                  onClick={() => setMostrarTablaIndices(v => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 11px",
                    borderRadius: 6,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: colorTablaBg,
                    color: tokens.ink,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {mostrarTablaIndices ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Tabla Mensual Histórica y Proyectada
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 12 }}>
              {[
                { key: "IPC", label: "IPC (INDEC)", hint: "Pts / Acum." },
                { key: "CAC", label: "Índice CAC General", hint: "Cámara Const." },
                { key: "HORMIGON", label: "Hormigón H-21", hint: "$ / m³ ref." },
                { key: "INDICE_LINK", label: "Índice Link", hint: "Valorización" },
                { key: "USD_TC", label: "Dólar Referencia", hint: "$ / U$D" }
              ].map(idxCfg => {
                const valAct = Number(indicesMesActivo[idxCfg.key] || 0);
                const valAnt = Number(indicesMesAnterior[idxCfg.key] || 0);
                const pctVar = valAnt > 0 ? ((valAct - valAnt) / valAnt) * 100 : 0;
                const cantCuotasVar = cuotasParaDevengar.filter(x => x.variable === idxCfg.key).length;
                return (
                  <div key={idxCfg.key} style={{ background: colorTablaBg, padding: "12px 14px", borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, fontWeight: 700, color: tokens.ink, marginBottom: 4 }}>
                      <span>{idxCfg.label}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: tokens.textMuted }}>{idxCfg.hint}</span>
                    </div>
                    <input
                      type="number"
                      step={idxCfg.key === "HORMIGON" ? "100" : "0.01"}
                      value={indicesMesActivo[idxCfg.key] ?? ""}
                      onChange={(e) => actualizarIndiceMes(idxCfg.key, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: `1px solid ${colorLineaFuerte}`,
                        fontFamily: tokens.fontMono,
                        fontSize: 14,
                        fontWeight: 700,
                        color: tokens.ink,
                        background: "#FFFFFF",
                        boxSizing: "border-box"
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 10.5, color: tokens.textMuted }}>
                      <span style={{ fontFamily: tokens.fontMono }}>
                        Ant ({formatearPeriodoLabel(periodoAnteriorActivo)}): {fmt(valAnt)}
                      </span>
                      <span style={{ fontFamily: tokens.fontMono, fontWeight: 700, color: pctVar > 0 ? tokens.gold : tokens.textMuted }}>
                        {pctVar >= 0 ? "+" : ""}{pctVar.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 4 }}>
                      <span style={{ fontSize: 10.5, color: tokens.textFaint }}>{cantCuotasVar} cuotas mes</span>
                      <div style={{ display: "inline-flex", gap: 3 }}>
                        {[2, 2.5, 3].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => aplicarVariacionPctMes(idxCfg.key, p)}
                            title={`Aplicar +${p}% sobre ${formatearPeriodoLabel(periodoAnteriorActivo)}`}
                            style={{
                              padding: "2px 5px",
                              borderRadius: 4,
                              border: `1px solid ${colorLineaFuerte}`,
                              background: "#FFFFFF",
                              fontSize: 10,
                              fontWeight: 600,
                              color: tokens.textMuted,
                              cursor: "pointer"
                            }}
                          >
                            +{p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {mostrarTablaIndices && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${tokens.ruleSoft}`, overflowX: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tokens.ink, marginBottom: 8 }}>
                  Tabla Mensual de Valores de Referencia (Editable por período)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted }}>
                      <th style={{ textAlign: "left", padding: "7px 8px" }}>Período</th>
                      <th style={{ textAlign: "right", padding: "7px 8px" }}>IPC (INDEC)</th>
                      <th style={{ textAlign: "right", padding: "7px 8px" }}>CAC General</th>
                      <th style={{ textAlign: "right", padding: "7px 8px" }}>Hormigón H-21 ($/m³)</th>
                      <th style={{ textAlign: "right", padding: "7px 8px" }}>Índice Link</th>
                      <th style={{ textAlign: "right", padding: "7px 8px" }}>USD TC ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(DEFAULT_INDICES_PERIODO).sort().map(per => {
                      const isActivo = per === periodoActivo;
                      return (
                        <tr key={per} style={{ borderBottom: `1px solid ${tokens.ruleSoft}`, background: isActivo ? "#F7F8FA" : "#FFFFFF" }}>
                          <td style={{ padding: "6px 8px", fontWeight: isActivo ? 700 : 600, color: tokens.ink }}>
                            {formatearPeriodoLabel(per)} {isActivo ? "· Activo" : ""}
                          </td>
                          {["IPC", "CAC", "HORMIGON", "INDICE_LINK", "USD_TC"].map(vKey => (
                            <td key={vKey} style={{ padding: "4px 6px", textAlign: "right" }}>
                              <input
                                type="number"
                                step={vKey === "HORMIGON" ? "100" : "0.01"}
                                value={obtenerValorReferenciaMes(vKey, per)}
                                onChange={(e) => actualizarIndiceMes(vKey, e.target.value, per)}
                                style={{
                                  width: 96,
                                  textAlign: "right",
                                  padding: "4px 6px",
                                  borderRadius: 4,
                                  border: `1px solid ${isActivo ? colorLineaFuerte : colorLineaSuave}`,
                                  fontFamily: tokens.fontMono,
                                  fontSize: 11.5,
                                  background: "#FFFFFF"
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grilla de cuotas a devengar */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 17, fontWeight: 600 }}>
                  Cuotas del Período ({cuotasParaDevengar.length})
                </h3>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                  Fórmula: Importe Actualizado = Importe Base × (Referencia Mes {formatearPeriodoLabel(periodoActivo)} / Índice Base Cliente)
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={filtroProyecto}
                  onChange={(e) => setFiltroProyecto(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="TODOS">Todos los proyectos</option>
                  {proyectosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <select
                  value={filtroVariable}
                  onChange={(e) => setFiltroVariable(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="TODAS">Todas las variables</option>
                  {VARIABLES_ACTUALIZACION.map(va => <option key={va.id} value={va.id}>{va.short}</option>)}
                </select>

                <button
                  onClick={() => {
                    const redevengables = cuotasParaDevengar
                      .filter(x => x.cuota.devengado && Number(x.cuota.monto_cobrado || 0) <= 0)
                      .map(x => x.cuota.id);
                    if (redevengables.length === 0) return alert("No hay cuotas devengadas sin cobrar en este filtro.");
                    handleDevengarCuotas(redevengables);
                  }}
                  title="Recalcula cuotas devengadas sin cobros usando los valores actuales de IPC, CAC y Hormigón"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 13px",
                    borderRadius: 7,
                    border: `1px solid ${colorLineaFuerte}`,
                    background: tokens.surface,
                    color: tokens.ink,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <RefreshCw size={14} />
                  Re-devengar No Cobradas
                </button>

                <button
                  onClick={() => {
                    const pendientes = cuotasParaDevengar.filter(x => !x.cuota.devengado).map(x => x.cuota.id);
                    const ids = selectedCuotaIds.length > 0 ? selectedCuotaIds : pendientes;
                    if (ids.length === 0) return alert("No hay cuotas pendientes de devengamiento en este filtro.");
                    handleDevengarCuotas(ids);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 16px",
                    borderRadius: 7,
                    border: "none",
                    background: tokens.ink,
                    color: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <Calculator size={15} />
                  {selectedCuotaIds.length > 0
                    ? `Devengar Seleccionadas (${selectedCuotaIds.length})`
                    : "Generar Devengamiento del Mes"}
                </button>
              </div>
            </div>

            {/* Desglose resumido por variable de actualización */}
            {resumenVariablesDevengamiento.porVariable.length > 0 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                padding: "10px 14px",
                marginBottom: 14,
                borderRadius: 8,
                background: colorTablaBg,
                border: `1px solid ${colorLineaSuave}`,
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {resumenVariablesDevengamiento.porVariable.map(rv => (
                    <div key={rv.id} style={{ fontSize: 11.5 }}>
                      <span style={{ fontWeight: 700, color: tokens.ink }}>{rv.meta.short}:</span>{" "}
                      <span style={{ color: tokens.textMuted }}>{rv.count} ctas</span>{" "}
                      <span style={{ fontFamily: tokens.fontMono, fontWeight: 600, color: tokens.ink }}>($ {fmt(Math.round(rv.actualizado))})</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, fontFamily: tokens.fontMono, fontWeight: 700, color: resumenVariablesDevengamiento.ajusteTotal > 0 ? tokens.gold : tokens.textMuted }}>
                  Ajuste total del período: {resumenVariablesDevengamiento.ajusteTotal >= 0 ? "+" : ""}$ {fmt(Math.round(resumenVariablesDevengamiento.ajusteTotal))}
                </div>
              </div>
            )}

            {cuotasParaDevengar.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: tokens.textMuted, fontSize: 13 }}>
                No hay cuotas programadas para devengar en {formatearPeriodoLabel(periodoActivo)}.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                      <th style={{ padding: "10px 8px", textAlign: "center", width: 32 }}>
                        <input
                          type="checkbox"
                          checked={
                            cuotasParaDevengar.filter(x => !x.cuota.devengado).length > 0 &&
                            cuotasParaDevengar.filter(x => !x.cuota.devengado).every(x => selectedCuotaIds.includes(x.cuota.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCuotaIds(cuotasParaDevengar.filter(x => !x.cuota.devengado).map(x => x.cuota.id));
                            } else {
                              setSelectedCuotaIds([]);
                            }
                          }}
                        />
                      </th>
                      <th style={{ textAlign: "left", padding: "10px 8px" }}>Cliente / Operación</th>
                      <th style={{ textAlign: "left", padding: "10px 8px" }}>Cuota / Venc.</th>
                      <th style={{ textAlign: "left", padding: "10px 8px" }}>Variable Cliente</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Base → Ref. Mes</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Coef.</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Importe Base</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Importe a Devengar</th>
                      <th style={{ textAlign: "center", padding: "10px 8px" }}>Estado</th>
                      <th style={{ textAlign: "center", padding: "10px 8px" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasParaDevengar.map(({ cuota, venta, cliente, variable, valorIndicePeriodo, indiceBaseEfectivo, previewCoef, previewImporte }) => {
                      const yaDevengada = cuota.devengado;
                      const montoMostrar = yaDevengada ? cuota.importe_actualizado : previewImporte;
                      const coefMostrar = yaDevengada ? cuota.coeficiente_ajuste : previewCoef;
                      const diffMostrar = Number(montoMostrar || 0) - Number(cuota.importe_original || 0);
                      const tieneCambioPendiente = yaDevengada && Number(cuota.monto_cobrado || 0) <= 0 && Math.abs(previewImporte - Number(cuota.importe_actualizado || 0)) > 1;
                      return (
                        <tr key={cuota.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}`, background: yaDevengada ? "#FAFBF9" : "#FFFFFF" }}>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            {!yaDevengada && (
                              <input
                                type="checkbox"
                                checked={selectedCuotaIds.includes(cuota.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedCuotaIds(prev => [...prev, cuota.id]);
                                  else setSelectedCuotaIds(prev => prev.filter(id => id !== cuota.id));
                                }}
                              />
                            )}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            <div style={{ fontWeight: 600, color: tokens.ink }}>{cliente?.nombre || "—"}</div>
                            <div style={{ fontSize: 11, color: tokens.textMuted }}>{venta?.proyecto} · {venta?.unidad_nombre}</div>
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            <div style={{ fontWeight: 600 }}>{cuota.concepto}</div>
                            <div style={{ fontSize: 11, fontFamily: tokens.fontMono, color: tokens.textMuted }}>{formatDate(cuota.fecha_vencimiento)}</div>
                          </td>
                          <td style={{ padding: "10px 8px", fontSize: 12 }}>
                            <select
                              value={variable}
                              disabled={Number(cuota.monto_cobrado || 0) > 0}
                              onChange={(e) => aplicarVariableAClientes(cuota.cliente_id, e.target.value, {
                                periodo_base: cliente?.periodo_base || periodoActivo,
                                recalcularDevengadas: true
                              })}
                              style={{
                                padding: "4px 6px",
                                borderRadius: 5,
                                border: `1px solid ${colorLineaFuerte}`,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: Number(cuota.monto_cobrado || 0) > 0 ? colorTablaBg : "#FFFFFF",
                                color: tokens.ink,
                                cursor: Number(cuota.monto_cobrado || 0) > 0 ? "not-allowed" : "pointer"
                              }}
                            >
                              {VARIABLES_ACTUALIZACION.map(va => (
                                <option key={va.id} value={va.id}>{va.short}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontSize: 11.5, color: tokens.textMuted }}>
                            {variable === "SIN_AJUSTE"
                              ? "Fijo"
                              : variable === "TASA_FIJA"
                                ? `${cliente?.tasa_mensual_fija ?? venta?.tasa_mensual_fija ?? 0}%/m`
                                : `${fmt(indiceBaseEfectivo)} → ${fmt(yaDevengada ? cuota.indice_aplicado : valorIndicePeriodo)}`}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            {Number(coefMostrar || 1).toFixed(4)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            {formatoOriginal(cuota.importe_original, cuota.moneda)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            <div style={{ fontWeight: 700, color: tokens.ink }}>{formatoOriginal(montoMostrar, cuota.moneda)}</div>
                            {Math.abs(diffMostrar) > 1 && (
                              <div style={{ fontSize: 10.5, color: tokens.gold }}>
                                {diffMostrar >= 0 ? "+" : ""}{formatoOriginal(diffMostrar, cuota.moneda)} ajuste
                              </div>
                            )}
                            {tieneCambioPendiente && (
                              <div style={{ fontSize: 10.5, color: tokens.positive }}>
                                Nueva ref: {formatoOriginal(previewImporte, cuota.moneda)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: 11.5, fontWeight: 600, color: cuota.estado === "Cobrada" ? tokens.positive : yaDevengada ? tokens.gold : tokens.textMuted }}>
                            {cuota.estado}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            {!yaDevengada ? (
                              <button
                                onClick={() => handleDevengarCuotas([cuota.id])}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 5,
                                  border: "none",
                                  background: tokens.ink,
                                  color: "#FFFFFF",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                              >
                                Devengar
                              </button>
                            ) : cuota.monto_cobrado <= 0 ? (
                              <div style={{ display: "inline-flex", gap: 4 }}>
                                {tieneCambioPendiente && (
                                  <button
                                    onClick={() => handleDevengarCuotas([cuota.id])}
                                    style={{
                                      padding: "5px 8px",
                                      borderRadius: 5,
                                      border: "none",
                                      background: tokens.positive,
                                      color: "#FFFFFF",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer"
                                    }}
                                  >
                                    Recalcular
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRevertirDevengamiento(cuota)}
                                  style={{
                                    padding: "5px 9px",
                                    borderRadius: 5,
                                    border: `1px solid ${colorLineaFuerte}`,
                                    background: tokens.surface,
                                    color: tokens.textMuted,
                                    fontSize: 11,
                                    cursor: "pointer"
                                  }}
                                >
                                  Revertir
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: tokens.positive }}>Cobrada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VISTA 5: COBRANZA MENSUAL Y RECIBOS
          ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === "cobranza" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Barra resumen del mes de cobranza */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>
                  Gestión de Cobranza — {formatearPeriodoLabel(periodoActivo)}
                </h3>
                <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                  Imputación de pagos totales o parciales por cuota, generación de recibos e impacto opcional en Cashflow
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={14} color={tokens.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder="Buscar cliente o unidad…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: "7px 10px 7px 30px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12 }}
                  />
                </div>
                <select
                  value={filtroEstadoCuota}
                  onChange={(e) => setFiltroEstadoCuota(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="PENDIENTES">Pendientes del mes</option>
                  <option value="DEVENGADAS">Solo Devengadas</option>
                  <option value="COBRADAS">Cobradas del mes</option>
                  <option value="VENCIDAS">Vencidas acumuladas</option>
                  <option value="TODAS">Todas las del mes</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, padding: "12px 14px", background: colorTablaBg, borderRadius: 8, border: `1px solid ${colorLineaSuave}`, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>Exigible del Período</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 16, fontWeight: 600 }}>{formatoVista(metricasCobranzaMes.exigible, monedaVista)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>Cobrado en {formatearPeriodoLabel(periodoActivo)}</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 16, fontWeight: 700, color: tokens.positive }}>{formatoVista(metricasCobranzaMes.cobrado, monedaVista)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>Saldo Pendiente del Mes</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 16, fontWeight: 600, color: tokens.ink }}>{formatoVista(metricasCobranzaMes.pendiente, monedaVista)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: tokens.textMuted }}>Efectividad de Cobro</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 16, fontWeight: 700, color: tokens.gold }}>{metricasCobranzaMes.pct.toFixed(1)}%</div>
              </div>
            </div>

            {/* Tabla de cuotas a cobrar */}
            {cuotasCobranzaPeriodo.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: tokens.textMuted, fontSize: 13 }}>
                No hay cuotas bajo el filtro seleccionado para {formatearPeriodoLabel(periodoActivo)}.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                      <th style={{ textAlign: "left", padding: "9px 10px" }}>Cliente / Operación</th>
                      <th style={{ textAlign: "left", padding: "9px 8px" }}>Cuota</th>
                      <th style={{ textAlign: "center", padding: "9px 8px" }}>Vencimiento</th>
                      <th style={{ textAlign: "right", padding: "9px 8px" }}>Importe Vigente</th>
                      <th style={{ textAlign: "right", padding: "9px 8px" }}>Ya Cobrado</th>
                      <th style={{ textAlign: "right", padding: "9px 8px" }}>Saldo a Cobrar</th>
                      <th style={{ textAlign: "center", padding: "9px 8px" }}>Estado</th>
                      <th style={{ textAlign: "center", padding: "9px 10px" }}>Cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasCobranzaPeriodo.map(({ cuota, venta, cliente }) => {
                      const hoyISO = new Date().toISOString().slice(0, 10);
                      const estaVencida = cuota.saldo_pendiente > 0.5 && cuota.fecha_vencimiento < hoyISO;
                      return (
                        <tr key={cuota.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                          <td style={{ padding: "10px 10px" }}>
                            <div style={{ fontWeight: 600, color: tokens.ink }}>{cliente?.nombre || "—"}</div>
                            <div style={{ fontSize: 11, color: tokens.textMuted }}>{venta?.codigo} · {venta?.proyecto} · {venta?.unidad_nombre}</div>
                          </td>
                          <td style={{ padding: "10px 8px", fontWeight: 600 }}>{cuota.concepto}</td>
                          <td style={{ padding: "10px 8px", textAlign: "center", fontFamily: tokens.fontMono, color: estaVencida ? tokens.negative : tokens.text }}>
                            {formatDate(cuota.fecha_vencimiento)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            {formatoOriginal(cuota.importe_actualizado, cuota.moneda)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.positive }}>
                            {cuota.monto_cobrado > 0 ? formatoOriginal(cuota.monto_cobrado, cuota.moneda) : "—"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700 }}>
                            {formatoOriginal(cuota.saldo_pendiente, cuota.moneda)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: 11.5, fontWeight: 600, color: cuota.estado === "Cobrada" ? tokens.positive : estaVencida ? tokens.negative : cuota.devengado ? tokens.gold : tokens.textMuted }}>
                            {estaVencida && cuota.estado !== "Cobrada" ? "Vencida" : cuota.estado}
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
                            {cuota.saldo_pendiente > 0.5 ? (
                              <button
                                onClick={() => abrirModalCobro(cuota)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "6px 11px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: tokens.positive,
                                  color: "#FFFFFF",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                              >
                                <Receipt size={13} /> Registrar Cobro
                              </button>
                            ) : (
                              <span style={{ fontSize: 11.5, color: tokens.positive, fontWeight: 600 }}>Saldada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Registro de Recibos / Cobranzas del Mes */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 22px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontFamily: tokens.fontDisplay, fontSize: 16.5, fontWeight: 600 }}>
              Recibos de Cobranza Registrados ({formatearPeriodoLabel(periodoActivo)})
            </h3>
            {cobranzasDelPeriodo.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: tokens.textMuted, fontSize: 12.5 }}>
                Sin cobranzas imputadas en {formatearPeriodoLabel(periodoActivo)}.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                      <th style={{ textAlign: "left", padding: "9px 10px" }}>Fecha</th>
                      <th style={{ textAlign: "left", padding: "9px 8px" }}>Comprobante</th>
                      <th style={{ textAlign: "left", padding: "9px 8px" }}>Cliente / Operación</th>
                      <th style={{ textAlign: "left", padding: "9px 8px" }}>Medio de Pago</th>
                      <th style={{ textAlign: "right", padding: "9px 8px" }}>Importe Pagado</th>
                      <th style={{ textAlign: "right", padding: "9px 8px" }}>Equiv. ARS</th>
                      <th style={{ textAlign: "center", padding: "9px 8px" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobranzasDelPeriodo.map(cb => {
                      const cli = clientesMap[cb.cliente_id];
                      const vta = ventasMap[cb.venta_id];
                      return (
                        <tr key={cb.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                          <td style={{ padding: "9px 10px", fontFamily: tokens.fontMono }}>{formatDate(cb.fecha_cobro)}</td>
                          <td style={{ padding: "9px 8px", fontFamily: tokens.fontMono, fontWeight: 600 }}>{cb.referencia}</td>
                          <td style={{ padding: "9px 8px" }}>
                            <div style={{ fontWeight: 600 }}>{cli?.nombre || "—"}</div>
                            <div style={{ fontSize: 11, color: tokens.textMuted }}>
                              {vta?.codigo} · {cb.nro_cuota === 0 ? "Anticipo" : `Cuota #${cb.nro_cuota}`}
                              {cb.sincronizado_cashflow ? " · Imputado en Cashflow" : ""}
                            </div>
                          </td>
                          <td style={{ padding: "9px 8px", color: tokens.textMuted }}>{cb.medio_pago}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.positive }}>
                            {formatoOriginal(cb.importe_pagado, cb.moneda_pago)}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            $ {fmt(Math.round(cb.importe_ars_equivalente || 0))}
                          </td>
                          <td style={{ padding: "9px 8px", textAlign: "center" }}>
                            <button
                              onClick={() => handleAnularCobranza(cb)}
                              title="Anular recibo y restaurar saldo"
                              style={{
                                padding: "4px 8px",
                                borderRadius: 5,
                                border: `1px solid ${tokens.ruleSoft}`,
                                background: tokens.surface,
                                color: tokens.negative,
                                fontSize: 11,
                                cursor: "pointer"
                              }}
                            >
                              Anular
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: NUEVA VENTA (GENERACIÓN DE CLIENTE + PLAN DE CUOTAS)
          ═══════════════════════════════════════════════════════════════════════ */}
      {modalVentaOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(14,21,36,0.65)",
          backdropFilter: "blur(3px)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: tokens.surface,
            borderRadius: 12,
            width: "100%",
            maxWidth: 820,
            maxHeight: "92vh",
            overflowY: "auto",
            border: `1px solid ${colorLineaFuerte}`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.28)"
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: `1px solid ${tokens.rule}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              background: tokens.surface,
              zIndex: 10
            }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 20, fontWeight: 600 }}>
                  Nueva Venta y Generación de Cuenta Corriente
                </h2>
                <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                  Da de alta el cliente, define el importe, cantidad de cuotas y la variable de actualización
                </div>
              </div>
              <button onClick={() => setModalVentaOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: tokens.textMuted, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevaVenta} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
              {/* SECCIÓN 1: CLIENTE */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink }}>1. Datos del Cliente</div>
                  {clientes.length > 0 && (
                    <div style={{ display: "inline-flex", background: colorTablaBg, padding: 3, borderRadius: 6, border: `1px solid ${colorLineaSuave}` }}>
                      <button
                        type="button"
                        onClick={() => setVentaForm(p => ({ ...p, modoCliente: "nuevo" }))}
                        style={{
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          background: ventaForm.modoCliente === "nuevo" ? tokens.ink : "transparent",
                          color: ventaForm.modoCliente === "nuevo" ? "#FFFFFF" : tokens.textMuted
                        }}
                      >
                        Generar Nuevo Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = ventaForm.cliente_id || clientes[0]?.id || "";
                          setVentaForm(p => ({ ...p, modoCliente: "existente", cliente_id: targetId }));
                          if (targetId) handleSeleccionarClienteExistenteEnVenta(targetId);
                        }}
                        style={{
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          background: ventaForm.modoCliente === "existente" ? tokens.ink : "transparent",
                          color: ventaForm.modoCliente === "existente" ? "#FFFFFF" : tokens.textMuted
                        }}
                      >
                        Cliente Existente
                      </button>
                    </div>
                  )}
                </div>

                {ventaForm.modoCliente === "existente" ? (
                  <select
                    value={ventaForm.cliente_id}
                    onChange={(e) => handleSeleccionarClienteExistenteEnVenta(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, fontSize: 13, background: "#FFFFFF" }}
                  >
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.dni_cuit || "S/D"})</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Nombre y Apellido / Razón Social *</label>
                      <input required type="text" value={ventaForm.cli_nombre} onChange={(e) => setVentaForm(p => ({ ...p, cli_nombre: e.target.value }))} placeholder="Ej: Juan Pablo Gómez" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>DNI / CUIT</label>
                      <input type="text" value={ventaForm.cli_dni_cuit} onChange={(e) => setVentaForm(p => ({ ...p, cli_dni_cuit: e.target.value }))} placeholder="20-34567890-1" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Condición Fiscal</label>
                      <select value={ventaForm.cli_condicion_fiscal} onChange={(e) => setVentaForm(p => ({ ...p, cli_condicion_fiscal: e.target.value }))} style={inputStyle}>
                        {CONDICIONES_FISCALES.map(cf => <option key={cf} value={cf}>{cf}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Teléfono / WhatsApp</label>
                      <input type="text" value={ventaForm.cli_telefono} onChange={(e) => setVentaForm(p => ({ ...p, cli_telefono: e.target.value }))} placeholder="+54 9 381 ..." style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input type="email" value={ventaForm.cli_email} onChange={(e) => setVentaForm(p => ({ ...p, cli_email: e.target.value }))} placeholder="cliente@correo.com" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Domicilio</label>
                      <input type="text" value={ventaForm.cli_domicilio} onChange={(e) => setVentaForm(p => ({ ...p, cli_domicilio: e.target.value }))} placeholder="Dirección completa" style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: UNIDAD Y PROYECTO */}
              <div style={{ paddingTop: 16, borderTop: `1px solid ${tokens.ruleSoft}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink }}>2. Proyecto y Unidad Vendida</div>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: tokens.ink, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={ventaForm.vincularStock}
                      onChange={(e) => setVentaForm(p => ({ ...p, vincularStock: e.target.checked, unidad_id: "" }))}
                    />
                    Seleccionar unidad del Stock Disponible ({unidadesDisponiblesParaVenta.length})
                  </label>
                </div>

                {ventaForm.vincularStock && (
                  <div style={{ marginBottom: 12, background: colorTablaBg, padding: 12, borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
                    <label style={labelStyle}>Unidad en Stock Disponible</label>
                    <select
                      value={ventaForm.unidad_id}
                      onChange={(e) => handleSeleccionarUnidadStock(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Elegir unidad del inventario --</option>
                      {unidadesDisponiblesParaVenta.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.proyecto} · {u.unidad} ({u.tipologia}) — U$D {fmt(u.precio_usd)}
                        </option>
                      ))}
                    </select>
                    {ventaForm.unidad_id && (
                      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer", color: tokens.text }}>
                        <input
                          type="checkbox"
                          checked={ventaForm.marcarUnidadVendida}
                          onChange={(e) => setVentaForm(p => ({ ...p, marcarUnidadVendida: e.target.checked }))}
                        />
                        Marcar unidad como "Vendido" en el módulo de Stock Disponible
                      </label>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Proyecto</label>
                    <select value={ventaForm.proyecto} onChange={(e) => setVentaForm(p => ({ ...p, proyecto: e.target.value }))} style={inputStyle}>
                      {proyectosDisponibles.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Asignación</label>
                    <select value={ventaForm.asignacion} onChange={(e) => setVentaForm(p => ({ ...p, asignacion: e.target.value }))} style={inputStyle}>
                      {ASIGNACIONES_CC.map(as => <option key={as} value={as}>{as}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Unidad / Descripción *</label>
                    <input required type="text" value={ventaForm.unidad_nombre} onChange={(e) => setVentaForm(p => ({ ...p, unidad_nombre: e.target.value }))} placeholder="Ej: Depto 2D Piso 5 B + Cochera" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fecha de Venta / Boleto</label>
                    <input type="date" value={ventaForm.fecha_venta} onChange={(e) => setVentaForm(p => ({ ...p, fecha_venta: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: CONDICIONES FINANCIERAS Y ACTUALIZACIÓN */}
              <div style={{ paddingTop: 16, borderTop: `1px solid ${tokens.ruleSoft}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.ink, marginBottom: 12 }}>
                  3. Importe, Cuotas y Variable de Actualización
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Moneda del Plan</label>
                    <select value={ventaForm.moneda_origen} onChange={(e) => setVentaForm(p => ({ ...p, moneda_origen: e.target.value }))} style={inputStyle}>
                      <option value="ARS">Pesos ($ ARS)</option>
                      <option value="USD">Dólares (U$D)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Importe Total de Venta *</label>
                    <input required type="number" step="0.01" value={ventaForm.precio_total} onChange={(e) => setVentaForm(p => ({ ...p, precio_total: e.target.value }))} placeholder="0.00" style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Anticipo / Boleto (Cuota 0)</label>
                    <input type="number" step="0.01" value={ventaForm.anticipo} onChange={(e) => setVentaForm(p => ({ ...p, anticipo: e.target.value }))} placeholder="0.00" style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Cantidad de Cuotas *</label>
                    <input required type="number" min="0" max="180" value={ventaForm.cantidad_cuotas} onChange={(e) => setVentaForm(p => ({ ...p, cantidad_cuotas: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Primer Vencimiento</label>
                    <input type="date" value={ventaForm.fecha_primer_vencimiento} onChange={(e) => setVentaForm(p => ({ ...p, fecha_primer_vencimiento: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Variable de Actualización *</label>
                    <select value={ventaForm.variable_actualizacion} onChange={(e) => handleCambioVariableVenta(e.target.value)} style={inputStyle}>
                      {VARIABLES_ACTUALIZACION.map(va => <option key={va.id} value={va.id}>{va.label}</option>)}
                    </select>
                  </div>
                  {ventaForm.variable_actualizacion === "TASA_FIJA" ? (
                    <div>
                      <label style={labelStyle}>Tasa Mensual Fija (%)</label>
                      <input type="number" step="0.1" value={ventaForm.tasa_mensual_fija} onChange={(e) => setVentaForm(p => ({ ...p, tasa_mensual_fija: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                    </div>
                  ) : ventaForm.variable_actualizacion !== "SIN_AJUSTE" ? (
                    <div>
                      <label style={labelStyle}>Valor Índice Base (Firma)</label>
                      <input type="number" step="0.01" value={ventaForm.indice_base} onChange={(e) => setVentaForm(p => ({ ...p, indice_base: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                    </div>
                  ) : null}
                </div>

                {/* Vista previa del plan */}
                <div style={{
                  marginTop: 14,
                  background: colorTablaBg,
                  border: `1px solid ${colorLineaSuave}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: tokens.textMuted }}>Saldo a Financiar</div>
                    <div style={{ fontFamily: tokens.fontMono, fontSize: 14, fontWeight: 700, color: tokens.ink }}>
                      {formatoOriginal(previewVentaCalculo.saldo, ventaForm.moneda_origen)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: tokens.textMuted }}>Cuota Pura Inicial</div>
                    <div style={{ fontFamily: tokens.fontMono, fontSize: 14, fontWeight: 700, color: tokens.positive }}>
                      {previewVentaCalculo.nCuotas > 0 ? formatoOriginal(previewVentaCalculo.cuotaBase, ventaForm.moneda_origen) : "Contado"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: tokens.textMuted }}>Último Vencimiento</div>
                    <div style={{ fontFamily: tokens.fontMono, fontSize: 14, fontWeight: 600 }}>
                      {previewVentaCalculo.ultimoVenc !== "—" ? formatDate(previewVentaCalculo.ultimoVenc) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 10, borderTop: `1px solid ${tokens.rule}` }}>
                <button type="button" onClick={() => setModalVentaOpen(false)} style={{ padding: "9px 16px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, background: tokens.surface, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: tokens.ink, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Confirmar Venta y Generar Cuotas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: ALTA / EDICIÓN DE CLIENTE
          ═══════════════════════════════════════════════════════════════════════ */}
      {modalClienteOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(14,21,36,0.65)",
          backdropFilter: "blur(3px)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{ background: tokens.surface, borderRadius: 12, width: "100%", maxWidth: 540, border: `1px solid ${colorLineaFuerte}`, boxShadow: "0 20px 50px rgba(0,0,0,0.28)" }}>
            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${tokens.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>
                {editingCliente ? "Editar Datos del Cliente" : "Nuevo Cliente"}
              </h3>
              <button onClick={() => setModalClienteOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: tokens.textMuted }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGuardarCliente} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nombre / Razón Social *</label>
                <input required type="text" value={clienteForm.nombre} onChange={(e) => setClienteForm(p => ({ ...p, nombre: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>DNI / CUIT</label>
                  <input type="text" value={clienteForm.dni_cuit} onChange={(e) => setClienteForm(p => ({ ...p, dni_cuit: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Condición Fiscal</label>
                  <select value={clienteForm.condicion_fiscal} onChange={(e) => setClienteForm(p => ({ ...p, condicion_fiscal: e.target.value }))} style={inputStyle}>
                    {CONDICIONES_FISCALES.map(cf => <option key={cf} value={cf}>{cf}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input type="text" value={clienteForm.telefono} onChange={(e) => setClienteForm(p => ({ ...p, telefono: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={clienteForm.email} onChange={(e) => setClienteForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Domicilio</label>
                <input type="text" value={clienteForm.domicilio} onChange={(e) => setClienteForm(p => ({ ...p, domicilio: e.target.value }))} style={inputStyle} />
              </div>

              {/* Variable de Actualización asignada al cliente */}
              <div style={{ padding: "12px 14px", borderRadius: 8, background: colorTablaBg, border: `1px solid ${colorLineaSuave}`, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sliders size={13} /> Variable de Actualización de Cuotas
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Variable Aplicable *</label>
                    <select
                      value={clienteForm.variable_actualizacion}
                      onChange={(e) => {
                        const nv = e.target.value;
                        const per = clienteForm.periodo_base || periodoActivo || "2026-11";
                        const baseSug = nv === "TASA_FIJA" ? (clienteForm.tasa_mensual_fija || "2.5") : String(obtenerValorReferenciaMes(nv, per));
                        setClienteForm(p => ({
                          ...p,
                          variable_actualizacion: nv,
                          indice_base: baseSug
                        }));
                      }}
                      style={inputStyle}
                    >
                      {VARIABLES_ACTUALIZACION.map(va => <option key={va.id} value={va.id}>{va.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Mes Base de Referencia</label>
                    <input
                      type="month"
                      value={clienteForm.periodo_base}
                      onChange={(e) => {
                        const np = e.target.value;
                        const baseSug = clienteForm.variable_actualizacion === "TASA_FIJA"
                          ? clienteForm.tasa_mensual_fija
                          : String(obtenerValorReferenciaMes(clienteForm.variable_actualizacion, np));
                        setClienteForm(p => ({ ...p, periodo_base: np, indice_base: baseSug }));
                      }}
                      style={inputStyle}
                    />
                  </div>
                </div>
                {clienteForm.variable_actualizacion === "TASA_FIJA" ? (
                  <div>
                    <label style={labelStyle}>Tasa Mensual Fija (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={clienteForm.tasa_mensual_fija}
                      onChange={(e) => setClienteForm(p => ({ ...p, tasa_mensual_fija: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: tokens.fontMono }}
                    />
                  </div>
                ) : clienteForm.variable_actualizacion !== "SIN_AJUSTE" ? (
                  <div>
                    <label style={labelStyle}>
                      Valor Base ({getVariableMeta(clienteForm.variable_actualizacion).unidadIndice})
                    </label>
                    <input
                      type="number"
                      step={clienteForm.variable_actualizacion === "HORMIGON" ? "100" : "0.01"}
                      value={clienteForm.indice_base}
                      onChange={(e) => setClienteForm(p => ({ ...p, indice_base: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: tokens.fontMono }}
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <label style={labelStyle}>Observaciones</label>
                <textarea rows={2} value={clienteForm.observaciones} onChange={(e) => setClienteForm(p => ({ ...p, observaciones: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setModalClienteOpen(false)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, background: tokens.surface, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: tokens.ink, color: "#FFFFFF", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: REGISTRAR COBRANZA DE CUOTA
          ═══════════════════════════════════════════════════════════════════════ */}
      {modalCobroData && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(14,21,36,0.65)",
          backdropFilter: "blur(3px)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{ background: tokens.surface, borderRadius: 12, width: "100%", maxWidth: 520, border: `1px solid ${colorLineaFuerte}`, boxShadow: "0 20px 50px rgba(0,0,0,0.28)" }}>
            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${tokens.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600 }}>Registrar Cobranza</h3>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                  {modalCobroData.cliente?.nombre} · {modalCobroData.venta?.codigo} · {modalCobroData.cuota.concepto}
                </div>
              </div>
              <button onClick={() => setModalCobroData(null)} style={{ background: "none", border: "none", cursor: "pointer", color: tokens.textMuted }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmarCobro} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ background: colorTablaBg, padding: "10px 14px", borderRadius: 8, border: `1px solid ${colorLineaSuave}`, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>Saldo pendiente de la cuota:</span>
                <strong style={{ fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {formatoOriginal(modalCobroData.cuota.saldo_pendiente, modalCobroData.cuota.moneda)}
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Fecha de Cobro</label>
                  <input required type="date" value={cobroForm.fecha_cobro} onChange={(e) => setCobroForm(p => ({ ...p, fecha_cobro: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nro. Recibo / Referencia</label>
                  <input type="text" value={cobroForm.referencia} onChange={(e) => setCobroForm(p => ({ ...p, referencia: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Medio de Pago</label>
                  <select value={cobroForm.medio_pago} onChange={(e) => setCobroForm(p => ({ ...p, medio_pago: e.target.value }))} style={inputStyle}>
                    {MEDIOS_PAGO_CC.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Moneda del Pago</label>
                  <select value={cobroForm.moneda_pago} onChange={(e) => setCobroForm(p => ({ ...p, moneda_pago: e.target.value }))} style={inputStyle}>
                    <option value="ARS">Pesos ($ ARS)</option>
                    <option value="USD">Dólares (U$D)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Importe Cobrado ({cobroForm.moneda_pago}) *</label>
                  <input required type="number" step="0.01" value={cobroForm.importe_pagado} onChange={(e) => setCobroForm(p => ({ ...p, importe_pagado: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={labelStyle}>Tipo de Cambio Aplicado</label>
                  <input type="number" step="0.01" value={cobroForm.tc_aplicado} onChange={(e) => setCobroForm(p => ({ ...p, tc_aplicado: e.target.value }))} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Observaciones</label>
                <input type="text" value={cobroForm.observaciones} onChange={(e) => setCobroForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Banco, CBU, detalle del pago…" style={inputStyle} />
              </div>

              {onRegistrarCobranzaCashflow && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: tokens.ink, cursor: "pointer", padding: "8px 10px", background: tokens.positiveSoft, borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    checked={cobroForm.impactarCashflow}
                    onChange={(e) => setCobroForm(p => ({ ...p, impactarCashflow: e.target.checked }))}
                  />
                  Impactar ingreso automáticamente en Movimientos de Cashflow ("Cobranzas cuotas")
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setModalCobroData(null)} style={{ padding: "9px 15px", borderRadius: 7, border: `1px solid ${colorLineaFuerte}`, background: tokens.surface, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: tokens.positive, color: "#FFFFFF", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Confirmar Cobranza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: tokens.textMuted,
  marginBottom: 4
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${colorLineaFuerte}`,
  fontSize: 13,
  fontFamily: tokens.fontBody,
  color: tokens.text,
  background: "#FFFFFF",
  boxSizing: "border-box",
  outline: "none"
};
