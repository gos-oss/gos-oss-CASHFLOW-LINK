import React, { useState, useMemo } from "react";
import { tokens } from "./tokens";
import {
  Building2, HardHat, Users, Cpu, ArrowRight, TrendingUp, TrendingDown,
  Scale, DollarSign, Wallet, PieChart, ShieldAlert, Sparkles, CheckCircle2,
  ChevronRight, BarChart3, Sliders, RefreshCw, Layers
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

// Estilo de bordes y contrastes
const colorBorder = "#DCE1E8";
const colorBorderStrong = "#C2CAD4";

export default function MotorFinancieroTab({
  weeks = [],
  planesFondos = {},
  tcList = [],
  kpis = null,
  fmt = (n) => Number(n || 0).toLocaleString("es-AR"),
  onNavigateToTab = () => {}
}) {
  // Subpestañas del Motor Financiero
  // 'arquitectura' (diagrama interactivo de los 3 pilares)
  // 'motor' (Cash Flow vs Resultado Proyectado vs Capital Allocation)
  // 'simulador' (escenarios y decisiones estratégicas)
  const [subTab, setSubTab] = useState("arquitectura");

  // Estado del Simulador Estratégico Multivariable (Pilar Empresa, Proyectos, Socios)
  const [simParams, setSimParams] = useState({
    // Empresa:
    retrasoCobranzasDias: 0, // 0 a 60 días
    ajusteGastoEstructura: 0, // -30% a +30%
    renegociarPasivosPct: 0, // 0% a 50% refinanciado

    // Proyectos:
    inflacionCACCostoObra: 0, // 0% a 40% adicional
    ritmoVentasPct: 0, // -40% a +40%
    desvioPlazoMeses: 0, // 0 a 6 meses de extensión

    // Socios:
    cuposCumplimientoPct: 100, // 50% a 120%
    politicaRetirosPct: 0, // 0% a 50%
    nuevosAportesCapitalARS: 0 // Inyección fresca
  });

  const resetSimParams = () => {
    setSimParams({
      retrasoCobranzasDias: 0,
      ajusteGastoEstructura: 0,
      renegociarPasivosPct: 0,
      inflacionCACCostoObra: 0,
      ritmoVentasPct: 0,
      desvioPlazoMeses: 0,
      cuposCumplimientoPct: 100,
      politicaRetirosPct: 0,
      nuevosAportesCapitalARS: 0
    });
  };

  // Cálculos base 2026 desde planesFondos
  const plan2026 = planesFondos["2026"] || {};
  const ingresos2026 = plan2026.ingreso || {};
  const egresos2026 = plan2026.egreso || {};

  const totalIngresosBase2026 = useMemo(() => {
    let tot = 0;
    Object.values(ingresos2026).forEach(cat => {
      Object.values(cat || {}).forEach(v => { tot += Number(v || 0); });
    });
    return tot || 3200000000;
  }, [ingresos2026]);

  const totalEgresosBase2026 = useMemo(() => {
    let tot = 0;
    Object.values(egresos2026).forEach(cat => {
      Object.values(cat || {}).forEach(v => { tot += Number(v || 0); });
    });
    return tot || 2950000000;
  }, [egresos2026]);

  // Desglose por los 3 pilares en el presupuesto base
  // 1. Empresa (RRHH, Estructura, Inversiones, Pasivos, Caja actual)
  const costoEmpresaBase = useMemo(() => {
    let tot = 0;
    ["custom_rrhh", "custom_administracion", "custom_inversiones", "custom_pasivos-financieros"].forEach(k => {
      Object.values(egresos2026[k] || {}).forEach(v => { tot += Number(v || 0); });
    });
    return tot;
  }, [egresos2026]);

  // 2. Proyectos (Obras directas: Duo, Boulevard, #300, Torre Green, etc.)
  const costoProyectosBase = useMemo(() => {
    let tot = 0;
    Object.entries(egresos2026).forEach(([k, mesesObj]) => {
      if (k.startsWith("proy_")) {
        Object.values(mesesObj || {}).forEach(v => { tot += Number(v || 0); });
      }
    });
    return tot;
  }, [egresos2026]);

  const ingresosVentasProyectosBase = useMemo(() => {
    let tot = 0;
    ["custom_cuotas-mensuales", "custom_ventas-cdo", "custom_pesa"].forEach(k => {
      Object.values(ingresos2026[k] || {}).forEach(v => { tot += Number(v || 0); });
    });
    return tot;
  }, [ingresos2026]);

  // 3. Socios (Cupos socios, Aportes, etc.)
  const ingresosSociosBase = useMemo(() => {
    let tot = 0;
    ["custom_cupos-socios", "custom_aportes"].forEach(k => {
      Object.values(ingresos2026[k] || {}).forEach(v => { tot += Number(v || 0); });
    });
    return tot;
  }, [ingresos2026]);

  // SIMULACIÓN DEL MOTOR FINANCIERO CON PARÁMETROS ACTIVOS
  const simEngine = useMemo(() => {
    // 1. Impacto en Ingresos:
    // Ventas afectadas por ritmoVentasPct y retraso de cobranzas
    const factorVentas = (1 + simParams.ritmoVentasPct / 100) * (1 - (simParams.retrasoCobranzasDias * 0.005));
    const ingresosVentasSim = Math.max(0, ingresosVentasProyectosBase * factorVentas);

    // Socios: cumplimiento de cupos + inyección fresca
    const factorCupos = (simParams.cuposCumplimientoPct / 100);
    const ingresosSociosSim = (ingresosSociosBase * factorCupos) + Number(simParams.nuevosAportesCapitalARS || 0);

    const totalIngresosSim = ingresosVentasSim + ingresosSociosSim;

    // 2. Impacto en Egresos:
    // Proyectos: costo de obra afectado por inflación CAC y desvío de plazos
    const factorCostoObra = (1 + simParams.inflacionCACCostoObra / 100) * (1 + (simParams.desvioPlazoMeses * 0.03));
    const costoProyectosSim = costoProyectosBase * factorCostoObra;

    // Empresa: ajuste estructura y renegociación de pasivos
    const pasivosBase = Object.values(egresos2026["custom_pasivos-financieros"] || {}).reduce((a, b) => a + Number(b || 0), 0);
    const estructuraBase = Object.values(egresos2026["custom_administracion"] || {}).reduce((a, b) => a + Number(b || 0), 0);
    const rrhhBase = Object.values(egresos2026["custom_rrhh"] || {}).reduce((a, b) => a + Number(b || 0), 0);
    const inversionesBase = Object.values(egresos2026["custom_inversiones"] || {}).reduce((a, b) => a + Number(b || 0), 0);

    const pasivosSim = pasivosBase * (1 - simParams.renegociarPasivosPct / 100);
    const estructuraSim = estructuraBase * (1 + simParams.ajusteGastoEstructura / 100);
    const costoEmpresaSim = rrhhBase + inversionesBase + estructuraSim + pasivosSim;

    // Retiros de socios (en base al resultado o porcentaje del capital)
    const retirosSociosSim = totalIngresosSim * (simParams.politicaRetirosPct / 100);

    const totalEgresosSim = costoProyectosSim + costoEmpresaSim + retirosSociosSim;

    // 3. Los 3 Pilares del Motor Financiero Resultante:
    // A. Cash Flow (Posición neta de caja anual + liquidez actual)
    const liquidezActual = kpis ? kpis.liquidez : 124596986;
    const flujoNetoBase = totalIngresosBase2026 - totalEgresosBase2026;
    const flujoNetoSim = totalIngresosSim - totalEgresosSim;
    const cajaFinalSim = liquidezActual + flujoNetoSim;

    // Días de caja proyectados en el escenario simulado
    const quemaDiariaSim = totalEgresosSim / 365;
    const diasCajaSim = quemaDiariaSim > 0 ? Math.round(cajaFinalSim / quemaDiariaSim) : 0;

    // B. Resultado Proyectado (EBITDA / Margen Operativo del negocio inmobiliario)
    const margenBrutoBase = ingresosVentasProyectosBase - costoProyectosBase;
    const margenBrutoSim = ingresosVentasSim - costoProyectosSim;
    const ebitdaBase = totalIngresosBase2026 - totalEgresosBase2026;
    const ebitdaSim = totalIngresosSim - totalEgresosSim;

    const roiBase = costoProyectosBase > 0 ? (margenBrutoBase / costoProyectosBase) * 100 : 0;
    const roiSim = costoProyectosSim > 0 ? (margenBrutoSim / costoProyectosSim) * 100 : 0;

    // C. Capital Allocation (Distribución de recursos en %)
    const allocEmpresaBase = totalEgresosBase2026 > 0 ? (costoEmpresaBase / totalEgresosBase2026) * 100 : 0;
    const allocProyectosBase = totalEgresosBase2026 > 0 ? (costoProyectosBase / totalEgresosBase2026) * 100 : 0;
    const allocSociosBase = 0;

    const allocEmpresaSim = totalEgresosSim > 0 ? (costoEmpresaSim / totalEgresosSim) * 100 : 0;
    const allocProyectosSim = totalEgresosSim > 0 ? (costoProyectosSim / totalEgresosSim) * 100 : 0;
    const allocSociosSim = totalEgresosSim > 0 ? (retirosSociosSim / totalEgresosSim) * 100 : 0;

    return {
      liquidezActual,
      totalIngresosBase: totalIngresosBase2026,
      totalEgresosBase: totalEgresosBase2026,
      flujoNetoBase,
      totalIngresosSim,
      totalEgresosSim,
      flujoNetoSim,
      cajaFinalSim,
      diasCajaSim,
      margenBrutoBase,
      margenBrutoSim,
      ebitdaBase,
      ebitdaSim,
      roiBase,
      roiSim,
      costoEmpresaSim,
      costoProyectosSim,
      retirosSociosSim,
      ingresosVentasSim,
      ingresosSociosSim,
      alloc: {
        base: [
          { name: "Empresa", pct: Math.round(allocEmpresaBase), monto: costoEmpresaBase, color: "#1E293B" },
          { name: "Proyectos (Obra)", pct: Math.round(allocProyectosBase), monto: costoProyectosBase, color: tokens.gold },
          { name: "Socios (Retiros)", pct: Math.round(allocSociosBase), monto: 0, color: tokens.positive }
        ],
        sim: [
          { name: "Empresa", pct: Math.round(allocEmpresaSim), monto: costoEmpresaSim, color: "#1E293B" },
          { name: "Proyectos (Obra)", pct: Math.round(allocProyectosSim), monto: costoProyectosSim, color: tokens.gold },
          { name: "Socios (Retiros)", pct: Math.round(allocSociosSim), monto: retirosSociosSim, color: tokens.positive }
        ]
      }
    };
  }, [simParams, totalIngresosBase2026, totalEgresosBase2026, ingresosVentasProyectosBase, costoProyectosBase, ingresosSociosBase, costoEmpresaBase, egresos2026, kpis]);

  // Datos para gráfico comparativo de Pilares Base vs Simulado
  const pilaresChartData = [
    {
      categoria: "Ingresos Ventas",
      Base: Math.round(ingresosVentasProyectosBase / 1000000),
      Simulado: Math.round(simEngine.ingresosVentasSim / 1000000)
    },
    {
      categoria: "Ingresos Socios",
      Base: Math.round(ingresosSociosBase / 1000000),
      Simulado: Math.round(simEngine.ingresosSociosSim / 1000000)
    },
    {
      categoria: "Costo Obra",
      Base: Math.round(costoProyectosBase / 1000000),
      Simulado: Math.round(simEngine.costoProyectosSim / 1000000)
    },
    {
      categoria: "Costo Empresa",
      Base: Math.round(costoEmpresaBase / 1000000),
      Simulado: Math.round(simEngine.costoEmpresaSim / 1000000)
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* CABECERA CON NAVEGACIÓN INTERNA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: tokens.gold, background: tokens.goldSoft, padding: "2px 8px", borderRadius: 4 }}>
              Arquitectura de Negocio
            </span>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>Azlepi · Sigma · Inversiones</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 26, fontWeight: 600, color: tokens.ink }}>
            Motor Financiero y Asignación de Capital
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: tokens.textMuted, maxWidth: 840 }}>
            Articulación integrada de los 3 ejes operativos: <strong>Empresa</strong> (tesorería y estructura), <strong>Proyectos</strong> (costos y cobranzas) y <strong>Socios</strong> (capital, préstamos y retiros) para proyectar <strong>Cash Flow</strong>, <strong>Resultado</strong> y <strong>Decisiones Estratégicas</strong>.
          </p>
        </div>

        {/* BOTONERA SUBPESTAÑAS */}
        <div style={{ display: "flex", background: tokens.surface, border: `1px solid ${colorBorderStrong}`, borderRadius: 8, padding: 3, gap: 4 }}>
          <button
            onClick={() => setSubTab("arquitectura")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", borderRadius: 6,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: subTab === "arquitectura" ? tokens.ink : "transparent",
              color: subTab === "arquitectura" ? "#fff" : tokens.textMuted,
              transition: "all 0.15s"
            }}
          >
            <Layers size={14} /> Arquitectura (3 Pilares)
          </button>
          <button
            onClick={() => setSubTab("motor")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", borderRadius: 6,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: subTab === "motor" ? tokens.ink : "transparent",
              color: subTab === "motor" ? "#fff" : tokens.textMuted,
              transition: "all 0.15s"
            }}
          >
            <Cpu size={14} /> Motor & Capital Allocation
          </button>
          <button
            onClick={() => setSubTab("simulador")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", borderRadius: 6,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: subTab === "simulador" ? tokens.gold : "transparent",
              color: subTab === "simulador" ? "#fff" : tokens.textMuted,
              transition: "all 0.15s"
            }}
          >
            <Sliders size={14} /> Simulador de Decisiones
          </button>
        </div>
      </div>

      {/* =========================================================================
          VISTA 1: ARQUITECTURA INTEGRADA (EL DIAGRAMA DEL USUARIO HECHO UI)
          ========================================================================= */}
      {subTab === "arquitectura" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* MAPA VISUAL CONECTADO */}
          <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 12, padding: "28px 32px", boxShadow: "0 2px 8px rgba(14,21,36,0.03)" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: tokens.ink, color: "#fff", padding: "8px 20px", borderRadius: 30, fontWeight: 700, fontSize: 13, letterSpacing: "1px" }}>
                <Cpu size={15} color={tokens.gold} /> CASHFLOW LINK · MODELO DE FLUJO INTEGRADO
              </div>
            </div>

            {/* GRILLA DE LOS 3 PILARES SUPERIORES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, position: "relative" }}>
              
              {/* PILAR 1: EMPRESA */}
              <div style={{ background: "#F8FAFC", border: `2px solid ${tokens.ink}`, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${colorBorder}`, paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: tokens.ink, color: "#fff", width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: tokens.ink }}>EMPRESA</div>
                      <div style={{ fontSize: 11, color: tokens.textMuted }}>Estructura & Tesorería</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tokens.ink, background: "#E2E8F0", padding: "2px 6px", borderRadius: 4 }}>Pilar I</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid ${colorBorder}` }}>
                    <span style={{ color: tokens.textMuted }}>Tesorería & Bancos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {fmt(kpis ? kpis.liquidez : 124596986)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid ${colorBorder}` }}>
                    <span style={{ color: tokens.textMuted }}>Caja Operativa:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>{kpis?.diasDeCaja || 13} días</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid ${colorBorder}` }}>
                    <span style={{ color: tokens.textMuted }}>Estructura / RRHH:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {fmt(costoEmpresaBase)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid ${colorBorder}` }}>
                    <span style={{ color: tokens.textMuted }}>Deudas & Pasivos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>Controlado</strong>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToTab("movimientos")}
                  style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", background: "#fff", border: `1px solid ${colorBorderStrong}`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: tokens.ink, cursor: "pointer" }}
                >
                  Ver Tesorería en Movimientos <ChevronRight size={13} />
                </button>
              </div>

              {/* PILAR 2: PROYECTOS */}
              <div style={{ background: "#FDFBF7", border: `2px solid ${tokens.gold}`, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid #F0E6D2`, paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: tokens.gold, color: "#fff", width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <HardHat size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: tokens.ink }}>PROYECTOS</div>
                      <div style={{ fontSize: 11, color: tokens.textMuted }}>Obras, Ventas & Costos</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tokens.gold, background: tokens.goldSoft, padding: "2px 6px", borderRadius: 4 }}>Pilar II</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #F0E6D2` }}>
                    <span style={{ color: tokens.textMuted }}>Presupuesto Obras:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {fmt(costoProyectosBase)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #F0E6D2` }}>
                    <span style={{ color: tokens.textMuted }}>Cobranzas / Cuotas:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {fmt(ingresosVentasProyectosBase)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #F0E6D2` }}>
                    <span style={{ color: tokens.textMuted }}>Ventas CDO / PESA:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>En curso</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #F0E6D2` }}>
                    <span style={{ color: tokens.textMuted }}>Proyectos activos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>13 desarrollos</strong>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToTab("presupuesto")}
                  style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", background: "#fff", border: `1px solid #E2D3B8`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: tokens.gold, cursor: "pointer" }}
                >
                  Ver Proyectos en Presupuesto <ChevronRight size={13} />
                </button>
              </div>

              {/* PILAR 3: SOCIOS */}
              <div style={{ background: "#F0FDF4", border: `2px solid ${tokens.positive}`, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid #DCFCE7`, paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: tokens.positive, color: "#fff", width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: tokens.ink }}>SOCIOS</div>
                      <div style={{ fontSize: 11, color: tokens.textMuted }}>Capital, Aportes & Retiros</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tokens.positive, background: tokens.positiveSoft, padding: "2px 6px", borderRadius: 4 }}>Pilar III</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #DCFCE7` }}>
                    <span style={{ color: tokens.textMuted }}>Cupos Socios:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {fmt(ingresosSociosBase)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #DCFCE7` }}>
                    <span style={{ color: tokens.textMuted }}>Aportes de Capital:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>Disponibles</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #DCFCE7` }}>
                    <span style={{ color: tokens.textMuted }}>Préstamos / Mutuos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>Sincronizados</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#fff", borderRadius: 4, border: `1px solid #DCFCE7` }}>
                    <span style={{ color: tokens.textMuted }}>Retiros Planificados:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>Según Ebitda</strong>
                  </div>
                </div>

                <button
                  onClick={() => setSubTab("simulador")}
                  style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", background: "#fff", border: `1px solid #BBF7D0`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: tokens.positive, cursor: "pointer" }}
                >
                  Simular Escenarios de Socios <ChevronRight size={13} />
                </button>
              </div>

            </div>

            {/* CONECTOR FLECHA HACIA EL MOTOR */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "20px 0 14px" }}>
              <div style={{ height: 28, width: 2, background: colorBorderStrong }} />
              <div style={{ background: tokens.ink, color: "#fff", padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                ▼ MOTOR FINANCIERO CENTRAL (CONVERGENCIA)
              </div>
            </div>

            {/* CAJA CENTRAL DEL MOTOR: LOS 3 OUTPUTS */}
            <div style={{ background: "#0E1524", color: "#fff", borderRadius: 12, padding: "24px 28px", border: "1px solid #28324A" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, textAlign: "center" }}>
                
                {/* OUTPUT 1: CASH FLOW */}
                <div style={{ background: "#161F35", padding: 18, borderRadius: 8, border: "1px solid #2A3654" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: tokens.positive }}>
                    <Wallet size={24} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>1. Cash Flow</div>
                  <div style={{ fontSize: 18, fontFamily: tokens.fontMono, fontWeight: 700, color: "#fff", margin: "6px 0" }}>
                    $ {fmt(simEngine.flujoNetoBase)}
                  </div>
                  <div style={{ fontSize: 11, color: "#9AA3B8" }}>Posición de liquidez y días de caja operativos</div>
                </div>

                {/* OUTPUT 2: RESULTADO PROYECTADO */}
                <div style={{ background: "#161F35", padding: 18, borderRadius: 8, border: "1px solid #2A3654" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: tokens.gold }}>
                    <TrendingUp size={24} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>2. Resultado Proyectado</div>
                  <div style={{ fontSize: 18, fontFamily: tokens.fontMono, fontWeight: 700, color: "#fff", margin: "6px 0" }}>
                    ROI {simEngine.roiBase.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: "#9AA3B8" }}>Rentabilidad de desarrollos y cobertura de costos</div>
                </div>

                {/* OUTPUT 3: CAPITAL ALLOCATION */}
                <div style={{ background: "#161F35", padding: 18, borderRadius: 8, border: "1px solid #2A3654" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "#60A5FA" }}>
                    <PieChart size={24} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>3. Capital Allocation</div>
                  <div style={{ fontSize: 18, fontFamily: tokens.fontMono, fontWeight: 700, color: "#fff", margin: "6px 0" }}>
                    {simEngine.alloc.base[1].pct}% Obra
                  </div>
                  <div style={{ fontSize: 11, color: "#9AA3B8" }}>Destino de cada peso entre obra, firma y retorno</div>
                </div>

              </div>
            </div>

            {/* FLECHA AL SIMULADOR */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "14px 0 10px" }}>
              <div style={{ height: 20, width: 2, background: colorBorderStrong }} />
            </div>

            <div style={{ background: tokens.goldSoft, border: `1px solid ${tokens.gold}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: tokens.gold, color: "#fff", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: tokens.ink }}>SIMULADOR ESTRATÉGICO DE ESCENARIOS Y DECISIONES</div>
                  <div style={{ fontSize: 12, color: tokens.textMuted }}>Modifica variables macroeconómicas, ritmo de obras o cupos de socios y observa el impacto en vivo sobre los 3 pilares.</div>
                </div>
              </div>
              <button
                onClick={() => setSubTab("simulador")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
              >
                Abrir Simulador <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VISTA 2: MOTOR FINANCIERO & CAPITAL ALLOCATION
          ========================================================================= */}
      {subTab === "motor" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* TARJETAS DE RESULTADO INTEGRADO */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            
            {/* 1. CASH FLOW INTEGRADO */}
            <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: tokens.positive, marginBottom: 6 }}>
                <Wallet size={18} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cash Flow de Apertura & Cierre</span>
              </div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 24, fontWeight: 700, color: tokens.ink, margin: "4px 0" }}>
                $ {fmt(simEngine.cajaFinalSim)}
              </div>
              <div style={{ fontSize: 12, color: tokens.textMuted }}>
                Saldo proyectado a fin de ejercicio (Inicia en $ {fmt(simEngine.liquidezActual)})
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colorBorder}`, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: tokens.textMuted }}>Días de Cobertura:</span>
                <strong style={{ fontFamily: tokens.fontMono, color: simEngine.diasCajaSim < 10 ? tokens.negative : tokens.positive }}>
                  {simEngine.diasCajaSim} días
                </strong>
              </div>
            </div>

            {/* 2. RESULTADO PROYECTADO */}
            <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: tokens.gold, marginBottom: 6 }}>
                <TrendingUp size={18} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Resultado Proyectado (Margen)</span>
              </div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 24, fontWeight: 700, color: tokens.ink, margin: "4px 0" }}>
                $ {fmt(simEngine.margenBrutoSim)}
              </div>
              <div style={{ fontSize: 12, color: tokens.textMuted }}>
                Margen operativo sobre desarrollos (Ingresos Obra - Costo Directo)
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colorBorder}`, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: tokens.textMuted }}>Retorno s/ Costo (ROI):</span>
                <strong style={{ fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {simEngine.roiSim.toFixed(1)}%
                </strong>
              </div>
            </div>

            {/* 3. CAPITAL ALLOCATION */}
            <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2563EB", marginBottom: 6 }}>
                <PieChart size={18} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Distribución de Capital</span>
              </div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: 24, fontWeight: 700, color: tokens.ink, margin: "4px 0" }}>
                {simEngine.alloc.sim[1].pct}% en Obra
              </div>
              <div style={{ fontSize: 12, color: tokens.textMuted }}>
                Eficiencia de asignación de fondos a ladrillo vs estructura
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colorBorder}`, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: tokens.textMuted }}>Estructura / Firma:</span>
                <strong style={{ fontFamily: tokens.fontMono, color: tokens.ink }}>
                  {simEngine.alloc.sim[0].pct}% ($ {fmt(simEngine.costoEmpresaSim)})
                </strong>
              </div>
            </div>

          </div>

          {/* GRÁFICO Y ANÁLISIS DE ASIGNACIÓN */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            
            {/* COMPARATIVO BARRAS DE PILARES */}
            <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 10, padding: 22 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: tokens.ink }}>
                Flujo Operativo por Pilar (Millones ARS)
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: tokens.textMuted }}>
                Comparación del presupuesto base frente al estado del simulador activo.
              </p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pilaresChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: tokens.textMuted }} />
                    <YAxis tick={{ fontSize: 11, fill: tokens.textMuted }} />
                    <Tooltip formatter={(v) => `$ ${fmt(v)} M`} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Base" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Simulado" fill={tokens.gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABLA DE CAPITAL ALLOCATION POR DESTINO */}
            <div style={{ background: tokens.surface, border: `1px solid ${colorBorder}`, borderRadius: 10, padding: 22, display: "flex", flexDirection: "column" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: tokens.ink }}>
                Capital Allocation Matrix
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: tokens.textMuted }}>
                Destino estratégico de los fondos egresados en el ciclo:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, justifyContent: "center" }}>
                {simEngine.alloc.sim.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                        <strong>{item.name}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ color: tokens.textMuted }}>$ {fmt(item.monto)}</span>
                        <strong style={{ fontFamily: tokens.fontMono, color: tokens.ink }}>{item.pct}%</strong>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ height: 8, width: "100%", background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: 4, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: "12px", background: "#F8FAFC", borderRadius: 6, border: `1px solid ${colorBorder}`, fontSize: 12, color: tokens.textMuted }}>
                💡 <strong>Benchmark Inmobiliario:</strong> Un Capital Allocation saludable mantiene más del <strong>65%</strong> en obra directa (Proyectos) para apalancar el retorno sobre activos.
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VISTA 3: SIMULADOR ESTRATÉGICO DE ESCENARIOS Y DECISIONES
          ========================================================================= */}
      {subTab === "simulador" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* PANEL DE CONTROL MULTIVARIABLE (3 PILARES) */}
          <div style={{ background: tokens.surface, border: `1px solid ${colorBorderStrong}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tokens.ink, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sliders size={20} color={tokens.gold} /> Parámetros de Simulación por Pilar
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>
                  Ajusta los deslizadores para poner a prueba el negocio frente a estrés de mercado o decisiones de capital.
                </p>
              </div>

              <button
                onClick={resetSimParams}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: tokens.surface, border: `1px solid ${colorBorderStrong}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: tokens.ink, cursor: "pointer" }}
              >
                <RefreshCw size={13} /> Resetear Escenario
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              
              {/* COLUMNA 1: PALANCAS DE EMPRESA */}
              <div style={{ background: "#F8FAFC", border: `1px solid ${colorBorder}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: tokens.ink, borderBottom: `1px solid ${colorBorder}`, paddingBottom: 8 }}>
                  <Building2 size={16} /> Palancas: EMPRESA
                </div>

                {/* Retraso de cobranzas */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Retraso medio cobranzas:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>{simParams.retrasoCobranzasDias} días</strong>
                  </div>
                  <input
                    type="range" min="0" max="60" step="5"
                    value={simParams.retrasoCobranzasDias}
                    onChange={(e) => setSimParams({ ...simParams, retrasoCobranzasDias: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>0 d (Al día)</span>
                    <span>30 d</span>
                    <span>60 d (Estrés)</span>
                  </div>
                </div>

                {/* Ajuste de estructura */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Gasto Estructura / Admin:</span>
                    <strong style={{ fontFamily: tokens.fontMono, color: simParams.ajusteGastoEstructura > 0 ? tokens.negative : tokens.positive }}>
                      {simParams.ajusteGastoEstructura > 0 ? `+${simParams.ajusteGastoEstructura}%` : `${simParams.ajusteGastoEstructura}%`}
                    </strong>
                  </div>
                  <input
                    type="range" min="-30" max="30" step="5"
                    value={simParams.ajusteGastoEstructura}
                    onChange={(e) => setSimParams({ ...simParams, ajusteGastoEstructura: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>-30% (Austeridad)</span>
                    <span>0%</span>
                    <span>+30% (Expansión)</span>
                  </div>
                </div>

                {/* Renegociar Pasivos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Refinanciar pasivos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>{simParams.renegociarPasivosPct}%</strong>
                  </div>
                  <input
                    type="range" min="0" max="50" step="10"
                    value={simParams.renegociarPasivosPct}
                    onChange={(e) => setSimParams({ ...simParams, renegociarPasivosPct: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>0% (Plan normal)</span>
                    <span>50% (Prorrogado)</span>
                  </div>
                </div>
              </div>

              {/* COLUMNA 2: PALANCAS DE PROYECTOS */}
              <div style={{ background: "#FDFBF7", border: `1px solid #F0E6D2`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: tokens.gold, borderBottom: `1px solid #F0E6D2`, paddingBottom: 8 }}>
                  <HardHat size={16} /> Palancas: PROYECTOS
                </div>

                {/* Inflación CAC Costo Obra */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Desvío CAC Costo Obra:</span>
                    <strong style={{ fontFamily: tokens.fontMono, color: simParams.inflacionCACCostoObra > 0 ? tokens.negative : tokens.positive }}>
                      +{simParams.inflacionCACCostoObra}%
                    </strong>
                  </div>
                  <input
                    type="range" min="0" max="40" step="5"
                    value={simParams.inflacionCACCostoObra}
                    onChange={(e) => setSimParams({ ...simParams, inflacionCACCostoObra: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>0% (Presupuestado)</span>
                    <span>+20%</span>
                    <span>+40% (Shock CAC)</span>
                  </div>
                </div>

                {/* Ritmo de Ventas */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Ritmo Comercial Ventas:</span>
                    <strong style={{ fontFamily: tokens.fontMono, color: simParams.ritmoVentasPct >= 0 ? tokens.positive : tokens.negative }}>
                      {simParams.ritmoVentasPct > 0 ? `+${simParams.ritmoVentasPct}%` : `${simParams.ritmoVentasPct}%`}
                    </strong>
                  </div>
                  <input
                    type="range" min="-40" max="40" step="5"
                    value={simParams.ritmoVentasPct}
                    onChange={(e) => setSimParams({ ...simParams, ritmoVentasPct: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>-40% (Freno)</span>
                    <span>0%</span>
                    <span>+40% (Boom)</span>
                  </div>
                </div>

                {/* Desvío en Plazos de Obra */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Extensión de cronograma:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>+{simParams.desvioPlazoMeses} meses</strong>
                  </div>
                  <input
                    type="range" min="0" max="6" step="1"
                    value={simParams.desvioPlazoMeses}
                    onChange={(e) => setSimParams({ ...simParams, desvioPlazoMeses: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>0 m (A tiempo)</span>
                    <span>+3 m</span>
                    <span>+6 m</span>
                  </div>
                </div>
              </div>

              {/* COLUMNA 3: PALANCAS DE SOCIOS */}
              <div style={{ background: "#F0FDF4", border: `1px solid #DCFCE7`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: tokens.positive, borderBottom: `1px solid #DCFCE7`, paddingBottom: 8 }}>
                  <Users size={16} /> Palancas: SOCIOS
                </div>

                {/* Cumplimiento Cupos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Efectividad Cupos Socios:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>{simParams.cuposCumplimientoPct}%</strong>
                  </div>
                  <input
                    type="range" min="50" max="120" step="5"
                    value={simParams.cuposCumplimientoPct}
                    onChange={(e) => setSimParams({ ...simParams, cuposCumplimientoPct: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>50% (Mora)</span>
                    <span>100% (Esperado)</span>
                    <span>120% (Acelera)</span>
                  </div>
                </div>

                {/* Política de Retiros */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Retiro de Dividendos:</span>
                    <strong style={{ fontFamily: tokens.fontMono }}>{simParams.politicaRetirosPct}%</strong>
                  </div>
                  <input
                    type="range" min="0" max="30" step="5"
                    value={simParams.politicaRetirosPct}
                    onChange={(e) => setSimParams({ ...simParams, politicaRetirosPct: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>0% (Reinversión)</span>
                    <span>15%</span>
                    <span>30%</span>
                  </div>
                </div>

                {/* Inyección de Capital Fresco */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: tokens.textMuted }}>Inyección Aporte Extra:</span>
                    <strong style={{ fontFamily: tokens.fontMono, color: tokens.positive }}>
                      $ {fmt(simParams.nuevosAportesCapitalARS)}
                    </strong>
                  </div>
                  <input
                    type="range" min="0" max="200000000" step="10000000"
                    value={simParams.nuevosAportesCapitalARS}
                    onChange={(e) => setSimParams({ ...simParams, nuevosAportesCapitalARS: Number(e.target.value) })}
                    className="sim-slider"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: tokens.textMuted, marginTop: 2 }}>
                    <span>$0</span>
                    <span>$100M</span>
                    <span>$200M</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* TABLERO DE IMPACTO INMEDIATO (DECISIONES ESTRATÉGICAS) */}
          <div style={{ background: tokens.ink, color: "#fff", borderRadius: 12, padding: 24, border: "1px solid #28324A" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <Scale size={18} color={tokens.gold} /> Impacto en el Negocio vs. Presupuesto Base
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              
              {/* DÍAS DE CAJA */}
              <div style={{ background: "#161F35", borderRadius: 8, padding: 16, border: "1px solid #2A3654" }}>
                <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", fontWeight: 700 }}>Días de Caja</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 26, fontWeight: 700, margin: "6px 0", color: simEngine.diasCajaSim < 10 ? "#E0897A" : "#fff" }}>
                  {simEngine.diasCajaSim} d.
                </div>
                <div style={{ fontSize: 11, color: "#9AA3B8" }}>
                  Base: {kpis?.diasDeCaja || 13} d ({simEngine.diasCajaSim - (kpis?.diasDeCaja || 13) >= 0 ? "+" : ""}{simEngine.diasCajaSim - (kpis?.diasDeCaja || 13)} d)
                </div>
              </div>

              {/* SALDO FINAL AL CIERRE */}
              <div style={{ background: "#161F35", borderRadius: 8, padding: 16, border: "1px solid #2A3654" }}>
                <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", fontWeight: 700 }}>Caja Final Simulada</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 700, margin: "6px 0", color: simEngine.cajaFinalSim < 0 ? "#E0897A" : tokens.positive }}>
                  $ {fmt(simEngine.cajaFinalSim)}
                </div>
                <div style={{ fontSize: 11, color: "#9AA3B8" }}>
                  Dif: $ {fmt(simEngine.flujoNetoSim - simEngine.flujoNetoBase)}
                </div>
              </div>

              {/* MARGEN DE OBRAS */}
              <div style={{ background: "#161F35", borderRadius: 8, padding: 16, border: "1px solid #2A3654" }}>
                <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", fontWeight: 700 }}>Margen Operativo</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 700, margin: "6px 0", color: tokens.gold }}>
                  $ {fmt(simEngine.margenBrutoSim)}
                </div>
                <div style={{ fontSize: 11, color: "#9AA3B8" }}>
                  ROI: {simEngine.roiSim.toFixed(1)}% (Base: {simEngine.roiBase.toFixed(1)}%)
                </div>
              </div>

              {/* RETIRO ESTIMADO SOCIOS */}
              <div style={{ background: "#161F35", borderRadius: 8, padding: 16, border: "1px solid #2A3654" }}>
                <div style={{ fontSize: 11, color: "#8590A6", textTransform: "uppercase", fontWeight: 700 }}>Retiros / Dividendos</div>
                <div style={{ fontFamily: tokens.fontMono, fontSize: 22, fontWeight: 700, margin: "6px 0", color: "#60A5FA" }}>
                  $ {fmt(simEngine.retirosSociosSim)}
                </div>
                <div style={{ fontSize: 11, color: "#9AA3B8" }}>
                  Tasa fijada: {simParams.politicaRetirosPct}% s/ Ingresos
                </div>
              </div>

            </div>

            {/* RECOMENDACIÓN EJECUTIVA AUTOMATIZADA */}
            <div style={{ marginTop: 18, background: "#1E293B", borderRadius: 8, padding: "14px 18px", border: "1px solid #334155", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <CheckCircle2 size={20} color={tokens.gold} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#E2E8F0" }}>
                <strong>Diagnóstico del Motor Financiero:</strong> {
                  simEngine.cajaFinalSim < 0
                    ? "Alerta de iliquidez futura. El desvío de costos o caída de ventas genera un quiebre de caja antes de finalizar el período. Se recomienda activar renegociación de pasivos o posponer retiros de socios."
                    : simEngine.diasCajaSim > 20
                    ? "Excelente colchón financiero. El flujo neto permite sostener la velocidad de obra proyectada e incluso acelerar compras de materiales acopiados para ganarle a la inflación CAC."
                    : "Escenario balanceado pero ajustado. Se sugiere mantener vigilancia estricta sobre la cobranza de cuotas mensuales y el cumplimiento estricto de los cupos de socios."
                }
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
