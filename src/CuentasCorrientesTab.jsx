import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import {
  PROYECTOS_CARTERA_CC,
  VARIABLES_ACTUALIZACION,
  MEDIOS_PAGO_CC,
  CONDICIONES_FISCALES,
  DEFAULT_CC_CLIENTES,
  DEFAULT_CC_VENTAS,
  DEFAULT_CC_CUOTAS,
  DEFAULT_CC_COBRANZAS,
  generarId,
  formatearPeriodoLabel,
  sumarMesesFecha,
  calcularCuotaConIndice,
  generarPlanCuotasVenta
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
  Receipt, RefreshCw, Eye, RotateCcw, ArrowLeft, Sliders
} from "lucide-react";
import * as XLSX from "xlsx";

const colorLineaSuave = "#DCE1E8";
const colorLineaFuerte = "#C2CAD4";
const colorTablaBg = "#F4F6F8";

const LOCAL_INDICES_KEY = "cf_cc_indices_periodo_v1";

const DEFAULT_INDICES_PERIODO = {
  "2026-10": { CAC: 1438.4, INDICE_LINK: 118.2, IPC: 102.7, USD_TC: 1510 },
  "2026-11": { CAC: 1468.9, INDICE_LINK: 121.0, IPC: 105.4, USD_TC: 1550 },
  "2026-12": { CAC: 1498.3, INDICE_LINK: 123.6, IPC: 108.0, USD_TC: 1575 },
  "2027-01": { CAC: 1528.0, INDICE_LINK: 126.2, IPC: 110.5, USD_TC: 1600 }
};

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

  // Período activo para Devengamiento y Cobranza
  const [periodoActivo, setPeriodoActivo] = useState("2026-11");
  const [indicesPorPeriodo, setIndicesPorPeriodo] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_INDICES_KEY);
      if (raw) return { ...DEFAULT_INDICES_PERIODO, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_INDICES_PERIODO;
  });

  // Filtros & selección
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("TODOS");
  const [filtroEstadoCuota, setFiltroEstadoCuota] = useState("PENDIENTES"); // "PENDIENTES" | "DEVENGADAS" | "COBRADAS" | "TODAS"
  const [incluirAtrasadasDevengamiento, setIncluirAtrasadasDevengamiento] = useState(true);
  const [selectedCuotaIds, setSelectedCuotaIds] = useState([]);
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
      const [resCli, resVta, resCta, resCob, resStock, resCac, resLink] = await Promise.all([
        supabase.from("cc_clientes").select("*"),
        supabase.from("cc_ventas").select("*"),
        supabase.from("cc_cuotas").select("*"),
        supabase.from("cc_cobranzas").select("*"),
        supabase.from("stock_units").select("*"),
        supabase.from("cf_cac_indicadores").select("*"),
        supabase.from("cf_indice_link").select("*").order("id_mes", { ascending: true })
      ]);

      let cliData = resCli.data || [];
      let vtaData = resVta.data || [];
      let ctaData = resCta.data || [];
      let cobData = resCob.data || [];

      // Si es la primera vez y no hay datos en el módulo, inicializar semilla de demostración operativa
      if (cliData.length === 0 && vtaData.length === 0) {
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
    } catch (err) {
      console.error("Error cargando Cuentas Corrientes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  // Persistir índices por período localmente
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_INDICES_KEY, JSON.stringify(indicesPorPeriodo));
    } catch {}
  }, [indicesPorPeriodo]);

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

  // Índices efectivos para el período seleccionado (mezcla valores guardados con reales del ERP)
  const indicesMesActivo = useMemo(() => {
    const stored = indicesPorPeriodo[periodoActivo] || {};
    const linkDelMes = erpIndiceLinkList.find(item => item.id_mes === periodoActivo);
    const ultimoLink = erpIndiceLinkList.length > 0 ? erpIndiceLinkList[erpIndiceLinkList.length - 1] : null;
    const linkVal = Number(linkDelMes?.indice || ultimoLink?.indice || 121.0);

    return {
      CAC: stored.CAC ?? erpCacGeneral ?? 1468.9,
      INDICE_LINK: stored.INDICE_LINK ?? linkVal ?? 121.0,
      IPC: stored.IPC ?? 105.4,
      USD_TC: stored.USD_TC ?? tcActualSistema ?? 1550
    };
  }, [indicesPorPeriodo, periodoActivo, erpCacGeneral, erpIndiceLinkList, tcActualSistema]);

  const actualizarIndiceMes = (varKey, nuevoVal) => {
    setIndicesPorPeriodo(prev => ({
      ...prev,
      [periodoActivo]: {
        ...indicesMesActivo,
        ...(prev[periodoActivo] || {}),
        [varKey]: Number(nuevoVal) || 0
      }
    }));
  };

  // KPIs Globales de Cartera (convertidos a monedaVista)
  const kpisCartera = useMemo(() => {
    let totalVendido = 0;
    let totalCobrado = 0;
    let saldoPendienteTotal = 0;
    let devengadoMes = 0;
    let cobradoMes = 0;
    let exigibleMes = 0;
    let cuotasVencidasCount = 0;
    const hoyISO = new Date().toISOString().slice(0, 10);

    ventas.forEach(v => {
      if (v.estado !== "Rescindida") {
        totalVendido += aMonedaVista(v.precio_total, v.moneda_origen);
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

      if (c.saldo_pendiente > 0.5 && c.fecha_vencimiento < hoyISO) {
        cuotasVencidasCount += 1;
      }
    });

    cobranzas.forEach(cob => {
      if (cob.periodo_cobro === periodoActivo) {
        cobradoMes += aMonedaVista(cob.importe_pagado, cob.moneda_pago);
      }
    });

    const tasaCobranzaMes = devengadoMes > 0 ? Math.min(100, (cobradoMes / devengadoMes) * 100) : (cobradoMes > 0 ? 100 : 0);

    return {
      totalVendido,
      totalCobrado,
      saldoPendienteTotal,
      devengadoMes,
      cobradoMes,
      exigibleMes,
      tasaCobranzaMes,
      cuotasVencidasCount,
      cantClientes: clientes.length,
      cantVentas: ventas.length
    };
  }, [ventas, cuotas, cobranzas, clientes.length, periodoActivo, aMonedaVista]);

  // Serie mensual para gráfico Devengado vs Cobrado vs Proyectado (próximos 12 meses alrededor del período)
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
        map[p] = { proyecto: p, operaciones: 0, totalVendido: 0, cobrado: 0, pendiente: 0 };
      }
      map[p].operaciones += 1;
      map[p].totalVendido += aMonedaVista(v.precio_total, v.moneda_origen);
    });
    cuotas.forEach(c => {
      const v = ventasMap[c.venta_id];
      const p = v?.proyecto || "Sin Proyecto";
      if (!map[p]) {
        map[p] = { proyecto: p, operaciones: 0, totalVendido: 0, cobrado: 0, pendiente: 0 };
      }
      map[p].cobrado += aMonedaVista(c.monto_cobrado, c.moneda);
      map[p].pendiente += aMonedaVista(c.saldo_pendiente, c.moneda);
    });
    return Object.values(map).sort((a, b) => b.totalVendido - a.totalVendido);
  }, [ventas, cuotas, ventasMap, aMonedaVista]);

  // Enriquecer clientes con métricas de su cuenta corriente
  const clientesEnriquecidos = useMemo(() => {
    return clientes.map(cli => {
      const ventasCli = ventas.filter(v => v.cliente_id === cli.id);
      const cuotasCli = cuotas.filter(c => c.cliente_id === cli.id);
      const contratadoVista = ventasCli.reduce((s, v) => s + aMonedaVista(v.precio_total, v.moneda_origen), 0);
      const cobradoVista = cuotasCli.reduce((s, c) => s + aMonedaVista(c.monto_cobrado, c.moneda), 0);
      const saldoVista = cuotasCli.reduce((s, c) => s + aMonedaVista(c.saldo_pendiente, c.moneda), 0);
      const cuotasPend = cuotasCli.filter(c => c.saldo_pendiente > 0.5).length;
      const cuotasDev = cuotasCli.filter(c => c.devengado && c.saldo_pendiente > 0.5).length;

      return {
        ...cli,
        ventasCli,
        cuotasCli,
        contratadoVista,
        cobradoVista,
        saldoVista,
        cuotasPend,
        cuotasDev
      };
    }).filter(cli => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (cli.nombre || "").toLowerCase().includes(q) ||
        (cli.dni_cuit || "").toLowerCase().includes(q) ||
        (cli.email || "").toLowerCase().includes(q) ||
        cli.ventasCli.some(v => (v.proyecto || "").toLowerCase().includes(q) || (v.unidad_nombre || "").toLowerCase().includes(q))
      );
    });
  }, [clientes, ventas, cuotas, searchQuery, aMonedaVista]);

  // Unidades disponibles del stock para vincular a nueva venta
  const unidadesDisponiblesParaVenta = useMemo(() => {
    return stockUnits.filter(u => u.estado !== "Vendido");
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
    let baseSugerida = "1";
    if (varId === "CAC") baseSugerida = String(indicesMesActivo.CAC || erpCacGeneral || 1468.9);
    else if (varId === "INDICE_LINK") baseSugerida = String(indicesMesActivo.INDICE_LINK || 121.0);
    else if (varId === "IPC") baseSugerida = String(indicesMesActivo.IPC || 105.4);
    else if (varId === "USD_TC") baseSugerida = String(indicesMesActivo.USD_TC || tcActualSistema || 1550);
    else if (varId === "TASA_FIJA") baseSugerida = ventaForm.tasa_mensual_fija || "2.5";

    setVentaForm(prev => ({
      ...prev,
      variable_actualizacion: varId,
      indice_base: baseSugerida
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

    // 1. Si es cliente nuevo, generarlo automáticamente a partir de la venta
    if (ventaForm.modoCliente === "nuevo") {
      if (!ventaForm.cli_nombre.trim()) return alert("Ingresá el Nombre o Razón Social del cliente.");
      const nuevoCli = {
        id: generarId("cli"),
        nombre: ventaForm.cli_nombre.trim(),
        dni_cuit: ventaForm.cli_dni_cuit.trim() || "—",
        email: ventaForm.cli_email.trim(),
        telefono: ventaForm.cli_telefono.trim(),
        domicilio: ventaForm.cli_domicilio.trim(),
        condicion_fiscal: ventaForm.cli_condicion_fiscal,
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
      unidad_id: ventaForm.vincularStock ? ventaForm.unidad_id : "",
      unidad_nombre: ventaForm.unidad_nombre.trim(),
      moneda_origen: ventaForm.moneda_origen,
      precio_total: total,
      anticipo,
      saldo_financiar: Math.max(0, total - anticipo),
      cantidad_cuotas: cantCuotas,
      fecha_primer_vencimiento: ventaForm.fecha_primer_vencimiento,
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
  // ACCIÓN 2: CRUD DE CLIENTES
  // ═══════════════════════════════════════════════════════════════════════════
  const abrirModalCliente = (cli = null) => {
    setEditingCliente(cli);
    if (cli) {
      setClienteForm({
        nombre: cli.nombre || "",
        dni_cuit: cli.dni_cuit || "",
        email: cli.email || "",
        telefono: cli.telefono || "",
        domicilio: cli.domicilio || "",
        condicion_fiscal: cli.condicion_fiscal || "Consumidor Final",
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
        observaciones: ""
      });
    }
    setModalClienteOpen(true);
  };

  const handleGuardarCliente = async (e) => {
    e.preventDefault();
    if (!clienteForm.nombre.trim()) return alert("El nombre o razón social es obligatorio.");
    let nextClientes;
    if (editingCliente) {
      nextClientes = clientes.map(c => c.id === editingCliente.id ? { ...c, ...clienteForm, nombre: clienteForm.nombre.trim() } : c);
    } else {
      const nuevo = {
        id: generarId("cli"),
        ...clienteForm,
        nombre: clienteForm.nombre.trim(),
        created_at: new Date().toISOString().slice(0, 10)
      };
      nextClientes = [nuevo, ...clientes];
    }
    setClientes(nextClientes);
    await supabase.from("cc_clientes").setAll(nextClientes);
    setModalClienteOpen(false);
    showToast(editingCliente ? "Datos del cliente actualizados." : "Nuevo cliente guardado en padrón.");
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIÓN 3: MOTOR DE DEVENGAMIENTO MENSUAL
  // ═══════════════════════════════════════════════════════════════════════════
  const cuotasParaDevengar = useMemo(() => {
    return cuotas
      .filter(c => {
        if (c.nro_cuota === 0) return false;
        const venta = ventasMap[c.venta_id];
        if (!venta || venta.estado === "Rescindida") return false;
        if (filtroProyecto !== "TODOS" && venta.proyecto !== filtroProyecto) return false;
        if (incluirAtrasadasDevengamiento) {
          return c.periodo === periodoActivo || (c.periodo < periodoActivo && !c.devengado);
        }
        return c.periodo === periodoActivo;
      })
      .map(c => {
        const venta = ventasMap[c.venta_id];
        const cliente = clientesMap[c.cliente_id];
        const variable = c.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
        const valorIndicePeriodo =
          variable === "TASA_FIJA"
            ? Number(venta?.tasa_mensual_fija || 0)
            : Number(indicesMesActivo[variable] ?? 1);

        const calculo = calcularCuotaConIndice(c, venta, valorIndicePeriodo);
        return {
          cuota: c,
          venta,
          cliente,
          variable,
          valorIndicePeriodo,
          previewCoef: calculo.coeficiente,
          previewImporte: calculo.importeActualizado,
          diferenciaAjuste: calculo.importeActualizado - Number(c.importe_original || 0)
        };
      })
      .sort((a, b) => (a.cuota.fecha_vencimiento || "").localeCompare(b.cuota.fecha_vencimiento || ""));
  }, [cuotas, ventasMap, clientesMap, periodoActivo, filtroProyecto, incluirAtrasadasDevengamiento, indicesMesActivo]);

  const handleDevengarCuotas = async (cuotasIdsADevengar) => {
    if (!cuotasIdsADevengar || cuotasIdsADevengar.length === 0) return;
    const setIds = new Set(cuotasIdsADevengar);
    const fechaHoy = new Date().toISOString().slice(0, 10);
    let count = 0;

    const nextCuotas = cuotas.map(c => {
      if (!setIds.has(c.id)) return c;
      const venta = ventasMap[c.venta_id];
      const variable = c.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
      const valorIndicePeriodo =
        variable === "TASA_FIJA"
          ? Number(venta?.tasa_mensual_fija || 0)
          : Number(indicesMesActivo[variable] ?? 1);

      const calc = calcularCuotaConIndice(c, venta, valorIndicePeriodo);
      const cobrado = Number(c.monto_cobrado || 0);
      const nuevoSaldo = Math.max(0, Math.round((calc.importeActualizado - cobrado) * 100) / 100);
      const nuevoEstado = nuevoSaldo <= 0.5 ? "Cobrada" : cobrado > 0 ? "Cobrada Parcial" : "Devengada";
      count++;

      return {
        ...c,
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
    showToast(`Devengamiento generado correctamente para ${count} ${count === 1 ? "cuota" : "cuotas"} (${formatearPeriodoLabel(periodoActivo)}).`);
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

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            (cli?.nombre || "").toLowerCase().includes(q) ||
            (venta.codigo || "").toLowerCase().includes(q) ||
            (venta.unidad_nombre || "").toLowerCase().includes(q);
          if (!match) return false;
        }

        if (filtroEstadoCuota === "VENCIDAS") {
          return c.saldo_pendiente > 0.5 && c.fecha_vencimiento < hoyISO;
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
  }, [cuotas, ventasMap, clientesMap, periodoActivo, filtroProyecto, filtroEstadoCuota, searchQuery]);

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
        "Fecha": v.fecha_venta,
        "Cliente": clientesMap[v.cliente_id]?.nombre || "",
        "Proyecto": v.proyecto,
        "Unidad": v.unidad_nombre,
        "Moneda": v.moneda_origen,
        "Importe Total": v.precio_total,
        "Anticipo": v.anticipo,
        "Saldo a Financiar": v.saldo_financiar,
        "Cuotas": v.cantidad_cuotas,
        "Variable Actualización": v.variable_actualizacion,
        "Índice Base": v.indice_base
      })));
      XLSX.utils.book_append_sheet(wb, wsVta, "Ventas");

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

  // Restaurar datos semilla de demostración
  const handleRestaurarDemo = async () => {
    if (!window.confirm("¿Restaurar los datos de demostración iniciales de Cuentas Corrientes?")) return;
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
    showToast("Cartera de Cuentas Corrientes restaurada.");
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
              onClick={handleRestaurarDemo}
              title="Restaurar datos iniciales de ejemplo"
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
              <RotateCcw size={13} /> Demo
            </button>
          </div>
        </div>
      </div>

      {/* KPI STRIP SUPERIOR (4 Tarjetas limpias, tipografía tabular) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Cartera Total Contratada</div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.ink, marginTop: 6 }}>
            {formatoVista(kpisCartera.totalVendido, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            {kpisCartera.cantVentas} operaciones · {kpisCartera.cantClientes} clientes
          </div>
        </div>

        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>Saldo a Cobrar Actualizado</div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.ink, marginTop: 6 }}>
            {formatoVista(kpisCartera.saldoPendienteTotal, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: kpisCartera.cuotasVencidasCount > 0 ? tokens.negative : tokens.textMuted, marginTop: 4 }}>
            {kpisCartera.cuotasVencidasCount > 0
              ? `${kpisCartera.cuotasVencidasCount} cuotas vencidas pendientes`
              : "Cartera sin atrasos exigibles"}
          </div>
        </div>

        <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>
            Devengado ({formatearPeriodoLabel(periodoActivo)})
          </div>
          <div style={{ fontFamily: tokens.fontMono, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 600, color: tokens.gold, marginTop: 6 }}>
            {formatoVista(kpisCartera.devengadoMes, monedaVista)}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
            Exigible total del mes: {formatoVista(kpisCartera.exigibleMes, monedaVista)}
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
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 18 }}>
          {/* Gráfico Devengado vs Cobrado por mes */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 17, fontWeight: 600, color: tokens.text }}>
                  Curva de Devengamiento y Cobranza Mensual
                </h3>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                  Cuotas proyectadas, devengadas por índice y cobranzas efectivas ({monedaVista})
                </div>
              </div>
            </div>

            {chartDevengadoCobrado.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: tokens.textMuted, fontSize: 13 }}>
                No hay cuotas registradas en cartera.
              </div>
            ) : (
              <div style={{ width: "100%", height: 290 }}>
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
                Distribución de contratos vendidos, cobros acumulados y saldo a percibir
              </p>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                      <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>Proyecto</th>
                      <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 600 }}>Ops.</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Vendido</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorProyecto.map(r => (
                      <tr key={r.proyecto} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                        <td style={{ padding: "10px 6px", fontWeight: 600, color: tokens.text }}>{r.proyecto}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", fontFamily: tokens.fontMono }}>{r.operaciones}</td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: tokens.fontMono }}>{formatoVista(r.totalVendido, monedaVista)}</td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600, color: tokens.ink }}>{formatoVista(r.pendiente, monedaVista)}</td>
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color={tokens.textFaint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Buscar nombre, CUIT, unidad…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "8px 12px 8px 32px",
                    borderRadius: 7,
                    border: `1px solid ${colorLineaFuerte}`,
                    fontSize: 12.5,
                    minWidth: 230
                  }}
                />
              </div>

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

          {clientesEnriquecidos.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: tokens.textMuted }}>
              No se encontraron clientes con ese criterio. Registra una Nueva Venta para generar el cliente y su cuenta corriente.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11.5 }}>
                    <th style={{ textAlign: "left", padding: "10px 12px" }}>Cliente / Razón Social</th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>DNI / CUIT</th>
                    <th style={{ textAlign: "left", padding: "10px 10px" }}>Contacto</th>
                    <th style={{ textAlign: "center", padding: "10px 8px" }}>Ops.</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>Contratado ({monedaVista})</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>Cobrado ({monedaVista})</th>
                    <th style={{ textAlign: "right", padding: "10px 10px" }}>Saldo Actual ({monedaVista})</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesEnriquecidos.map(cli => (
                    <tr key={cli.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ fontWeight: 600, color: tokens.ink }}>{cli.nombre}</div>
                        <div style={{ fontSize: 11.5, color: tokens.textMuted }}>
                          {cli.condicion_fiscal} {cli.ventasCli.length > 0 ? `· ${cli.ventasCli.map(v => v.proyecto).join(", ")}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "12px 10px", fontFamily: tokens.fontMono, fontSize: 12.5 }}>{cli.dni_cuit || "—"}</td>
                      <td style={{ padding: "12px 10px", fontSize: 12 }}>
                        <div>{cli.telefono || "—"}</div>
                        <div style={{ color: tokens.textMuted }}>{cli.email || ""}</div>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {cli.ventasCli.length}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                        {formatoVista(cli.contratadoVista, monedaVista)}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.positive }}>
                        {formatoVista(cli.cobradoVista, monedaVista)}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.ink }}>
                        {formatoVista(cli.saldoVista, monedaVista)}
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
                      const varMeta = VARIABLES_ACTUALIZACION.find(x => x.id === c.variable_actualizacion);
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
                Operaciones de Venta y Planes de Cuotas
              </h3>
              <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                Contratos activos con importe, anticipo, cantidad de cuotas y variable de actualización
              </div>
            </div>

            <button
              onClick={abrirModalNuevaVenta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 15px",
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: colorTablaBg, borderBottom: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, fontSize: 11 }}>
                  <th style={{ textAlign: "left", padding: "10px 10px" }}>Operación / Fecha</th>
                  <th style={{ textAlign: "left", padding: "10px 10px" }}>Cliente</th>
                  <th style={{ textAlign: "left", padding: "10px 10px" }}>Proyecto / Unidad</th>
                  <th style={{ textAlign: "right", padding: "10px 10px" }}>Importe Total</th>
                  <th style={{ textAlign: "right", padding: "10px 10px" }}>Anticipo</th>
                  <th style={{ textAlign: "right", padding: "10px 10px" }}>Saldo a Financiar</th>
                  <th style={{ textAlign: "center", padding: "10px 8px" }}>Cuotas</th>
                  <th style={{ textAlign: "left", padding: "10px 10px" }}>Variable Act.</th>
                  <th style={{ textAlign: "center", padding: "10px 10px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => {
                  const cli = clientesMap[v.cliente_id];
                  const varObj = VARIABLES_ACTUALIZACION.find(x => x.id === v.variable_actualizacion);
                  return (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${tokens.ruleSoft}` }}>
                      <td style={{ padding: "11px 10px" }}>
                        <div style={{ fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.ink }}>{v.codigo}</div>
                        <div style={{ fontSize: 11, color: tokens.textMuted }}>{formatDate(v.fecha_venta)}</div>
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{cli?.nombre || "—"}</div>
                        <div style={{ fontSize: 11, color: tokens.textMuted }}>{cli?.dni_cuit || ""}</div>
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{v.proyecto}</div>
                        <div style={{ fontSize: 11.5, color: tokens.textMuted }}>{v.unidad_nombre}</div>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {formatoOriginal(v.precio_total, v.moneda_origen)}
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono }}>
                        {v.anticipo > 0 ? formatoOriginal(v.anticipo, v.moneda_origen) : "—"}
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {formatoOriginal(v.saldo_financiar, v.moneda_origen)}
                      </td>
                      <td style={{ padding: "11px 8px", textAlign: "center", fontFamily: tokens.fontMono, fontWeight: 600 }}>
                        {v.cantidad_cuotas}
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        <div style={{ fontWeight: 600, color: tokens.ink }}>{varObj?.short || v.variable_actualizacion}</div>
                        <div style={{ fontSize: 11, fontFamily: tokens.fontMono, color: tokens.textMuted }}>
                          {v.variable_actualizacion === "TASA_FIJA"
                            ? `${v.tasa_mensual_fija}% mensual`
                            : v.variable_actualizacion === "SIN_AJUSTE"
                              ? "Nominal fija"
                              : `Base: ${v.indice_base}`}
                        </div>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => {
                              setClienteDetalleId(v.cliente_id);
                              setSubTab("clientes");
                            }}
                            style={{
                              padding: "5px 9px",
                              borderRadius: 5,
                              border: `1px solid ${colorLineaFuerte}`,
                              background: tokens.surface,
                              fontSize: 11.5,
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
                              padding: "5px 7px",
                              borderRadius: 5,
                              border: `1px solid ${tokens.ruleSoft}`,
                              background: tokens.surface,
                              color: tokens.negative,
                              cursor: "pointer"
                            }}
                          >
                            <Trash2 size={13} />
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
                  Índices de Actualización — {formatearPeriodoLabel(periodoActivo)}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: tokens.textMuted }}>
                  Define o ajusta los valores de índice del mes para recalcular las cuotas proyectadas y generar el devengamiento oficial.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: tokens.text, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={incluirAtrasadasDevengamiento}
                    onChange={(e) => setIncluirAtrasadasDevengamiento(e.target.checked)}
                  />
                  Incluir períodos anteriores sin devengar
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
              {[
                { key: "CAC", label: "Índice CAC General", hint: "Cámara Construcción" },
                { key: "INDICE_LINK", label: "Índice Link Inversiones", hint: "Valorización Link" },
                { key: "IPC", label: "Índice IPC (INDEC)", hint: "Base 100 / Acum." },
                { key: "USD_TC", label: "Tipo de Cambio USD ($)", hint: "Dólar Referencia" }
              ].map(idxCfg => (
                <div key={idxCfg.key} style={{ background: colorTablaBg, padding: "12px 14px", borderRadius: 8, border: `1px solid ${colorLineaSuave}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, color: tokens.textMuted, marginBottom: 6 }}>
                    <span>{idxCfg.label}</span>
                    <span>{idxCfg.hint}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={indicesMesActivo[idxCfg.key] ?? ""}
                    onChange={(e) => actualizarIndiceMes(idxCfg.key, e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: `1px solid ${colorLineaFuerte}`,
                      fontFamily: tokens.fontMono,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.ink,
                      background: "#FFFFFF"
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Grilla de cuotas a devengar */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 17, fontWeight: 600 }}>
                  Cuotas del Período ({cuotasParaDevengar.length})
                </h3>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                  Fórmula aplicada: Importe Actualizado = Importe Base × (Índice Período / Índice Base)
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <select
                  value={filtroProyecto}
                  onChange={(e) => setFiltroProyecto(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${colorLineaFuerte}`, fontSize: 12.5, background: "#FFFFFF" }}
                >
                  <option value="TODOS">Todos los proyectos</option>
                  {PROYECTOS_CARTERA_CC.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

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
                      <th style={{ textAlign: "left", padding: "10px 8px" }}>Variable</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Base → Actual</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Coef.</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Importe Base</th>
                      <th style={{ textAlign: "right", padding: "10px 8px" }}>Importe a Devengar</th>
                      <th style={{ textAlign: "center", padding: "10px 8px" }}>Estado</th>
                      <th style={{ textAlign: "center", padding: "10px 8px" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasParaDevengar.map(({ cuota, venta, cliente, variable, valorIndicePeriodo, previewCoef, previewImporte, diferenciaAjuste }) => {
                      const varObj = VARIABLES_ACTUALIZACION.find(v => v.id === variable);
                      const yaDevengada = cuota.devengado;
                      const montoMostrar = yaDevengada ? cuota.importe_actualizado : previewImporte;
                      const coefMostrar = yaDevengada ? cuota.coeficiente_ajuste : previewCoef;
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
                          <td style={{ padding: "10px 8px", fontSize: 12 }}>{varObj?.short || variable}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono, fontSize: 11.5, color: tokens.textMuted }}>
                            {variable === "SIN_AJUSTE"
                              ? "Fijo"
                              : variable === "TASA_FIJA"
                                ? `${venta?.tasa_mensual_fija}%/m`
                                : `${cuota.indice_base} → ${yaDevengada ? cuota.indice_aplicado : valorIndicePeriodo}`}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            {Number(coefMostrar || 1).toFixed(4)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            {formatoOriginal(cuota.importe_original, cuota.moneda)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: tokens.fontMono }}>
                            <div style={{ fontWeight: 700, color: tokens.ink }}>{formatoOriginal(montoMostrar, cuota.moneda)}</div>
                            {!yaDevengada && Math.abs(diferenciaAjuste) > 1 && (
                              <div style={{ fontSize: 10.5, color: tokens.gold }}>
                                +{formatoOriginal(diferenciaAjuste, cuota.moneda)} ajuste
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
                        onClick={() => setVentaForm(p => ({ ...p, modoCliente: "existente", cliente_id: p.cliente_id || clientes[0]?.id || "" }))}
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
                    onChange={(e) => setVentaForm(p => ({ ...p, cliente_id: e.target.value }))}
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Proyecto</label>
                    <select value={ventaForm.proyecto} onChange={(e) => setVentaForm(p => ({ ...p, proyecto: e.target.value }))} style={inputStyle}>
                      {PROYECTOS_CARTERA_CC.map(pr => <option key={pr} value={pr}>{pr}</option>)}
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
