import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
// Íconos modernos para nuestros KPIs
import { Wallet, CalendarX2, AlertTriangle, TrendingUp } from "lucide-react";

const BASE_INCOME = [
  { key: "cuposNeuquen", label: "Cupos Neuquen" },
  { key: "cuposBoulevard", label: "Cupos Boulevard" },
  { key: "cupoDuo", label: "Cupo + Duo" },
  { key: "cupos300", label: "Cupos #300" },
  { key: "otrosIngresos", label: "Otros ingresos" },
  { key: "posiblesVentas", label: "Posibles ventas" },
  { key: "cobranzasCuotas", label: "Cobranzas cuotas" }
];

const BASE_EXPENSE = [
  { key: "socios", label: "Socios" },
  { key: "chequesEmitidos", label: "Cheques emitidos" },
  { key: "prestamos", label: "Prestamos" },
  { key: "sueldosOficina", label: "Sueldos oficina" },
  { key: "cargasSociales", label: "Cargas sociales azlepi y sigma" },
  { key: "quincenaObra", label: "Quincena obra" },
  { key: "planesImpuestos", label: "Planes de pago/impuestos" },
  { key: "tarjetas", label: "Tarjetas" },
  { key: "externos", label: "Externos" },
  { key: "seguros", label: "Seguros" },
  { key: "mensuales", label: "Mensuales" },
  { key: "rentaAnticipada", label: "Renta anticipada" },
  { key: "bajaClientes", label: "Baja clientes" },
  { key: "terrenoNeuquen", label: "Terreno Neuquen" },
  { key: "colonia", label: "Colonia" },
  { key: "pagosDia", label: "Pagos del dia" },
  { key: "otros", label: "Otros" },
  { key: "rrhh", label: "RRHH" },
  { key: "mkt", label: "MKT" },
  { key: "tdys", label: "Tdys (ET)" },
  { key: "cx", label: "CX" },
  { key: "postVenta", label: "Post venta" },
  { key: "contratistas", label: "Contratistas" },
  { key: "proveedores", label: "Proveedores" }
];

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

export default function App() {
  const [weeks, setWeeks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchWeeks();
  }, []);

  const fetchWeeks = async () => {
    const { data, error } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    if (error) console.error("Error al cargar datos:", error);
    else setWeeks(data || []);
    setLoaded(true);
  };

  const handleImportarSemanas = async (semanasNuevas) => {
    const { error } = await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    if (error) alert("Error al guardar en Supabase: " + error.message);
    else fetchWeeks();
  };

  const handleBorrarDatos = async () => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas borrar toda la información? El tablero quedará en 0.");
    if (!confirmacion) return;

    const { error } = await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    if (error) {
      alert("Error al limpiar la base de datos: " + error.message);
    } else {
      fetchWeeks();
    }
  };

  const procesadas = useMemo(() => {
    return weeks.map(w => {
      const ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      const eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);
      const pos = ing - eg;
      const acum = pos + Number(w.saldo_inicial || 0) + Number(w.saldo_bancos || 0) + Number(w.saldo_credimas || 0);
      return { ...w, totalIngresos: ing, totalEgresos: eg, posicion: pos, saldoAcumulado: acum };
    });
  }, [weeks]);

  const kpis = useMemo(() => {
    if (procesadas.length === 0) return null;
    const saldoActual = procesadas[0].saldoAcumulado;
    const egresosTotales = procesadas.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const egresoPromedioDiario = (egresosTotales / procesadas.length) / 7;
    const diasDeCaja = egresoPromedioDiario > 0 ? Math.max(0, Math.round(saldoActual / egresoPromedioDiario)) : 0;
    const semanaDeficit = procesadas.find(w => w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";
    const saldos = procesadas.map(w => w.saldoAcumulado);
    const minimoSaldo = Math.min(...saldos);
    const necesidadFondos = minimoSaldo < 0 ? Math.abs(minimoSaldo) : 0;
    return { diasDeCaja, diaDeficit, necesidadFondos };
  }, [procesadas]);

  if (!loaded) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#64748b' }}>Cargando Panel Financiero...</div>;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      
      {/* Barra de Navegación Superior (Top Nav) */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #E2E8F0", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ background: "#0E6E5D", color: "#fff", padding: 8, borderRadius: 8 }}>
          <TrendingUp size={24} />
        </div>
        <h2 style={{ margin: 0, color: "#0F172A", fontSize: 20, fontWeight: 600 }}>Cashflow Pro <span style={{ color: "#94A3B8", fontSize: 14, fontWeight: 400 }}>| Conectado a Supabase</span></h2>
      </header>

      <main style={{ padding: "32px", maxWidth: 1600, margin: "0 auto" }}>
        
        {/* Panel de Importación */}
        <div style={{ background: "#ffffff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: 24 }}>
          <ImportadorCashflow 
            baseIncome={BASE_INCOME} 
            baseExpense={BASE_EXPENSE} 
            onImportarSemanas={handleImportarSemanas} 
            onBorrarDatos={handleBorrarDatos}
          />
        </div>

        {/* Estado Vacío */}
        {procesadas.length === 0 && (
          <div style={{ textAlign: "center", padding: "100px 20px", background: "#ffffff", borderRadius: 12, border: "1px dashed #CBD5E1" }}>
            <Wallet size={64} style={{ color: "#94A3B8", marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 20, color: "#334155", marginBottom: 8, fontWeight: 600 }}>Tu lienzo financiero está vacío</h3>
            <p style={{ fontSize: 15, color: "#64748B", maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>
              Sube tu primer archivo de Excel para generar proyecciones automáticas, calcular tu salud de caja y visualizar tu flujo neto.
            </p>
          </div>
        )}

        {/* Tablero Principal (Dashboard) */}
        {procesadas.length > 0 && kpis && (
          <>
            {/* Fila de KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>
              
              {/* KPI 1 */}
              <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#F0FDF4", padding: 10, borderRadius: 8, color: "#16A34A" }}><Wallet size={20} /></div>
                  <h4 style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Días de Caja</h4>
                </div>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: kpis.diasDeCaja > 15 ? "#0F172A" : "#EF4444" }}>
                  {kpis.diasDeCaja} <span style={{ fontSize: 16, fontWeight: 500, color: "#94A3B8" }}>días</span>
                </p>
              </div>
              
              {/* KPI 2 */}
              <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#FEF2F2", padding: 10, borderRadius: 8, color: "#EF4444" }}><CalendarX2 size={20} /></div>
                  <h4 style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Día de Déficit</h4>
                </div>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: kpis.diaDeficit !== "Sin déficit" ? "#EF4444" : "#0F172A" }}>
                  {kpis.diaDeficit}
                </p>
              </div>

              {/* KPI 3 */}
              <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#FFFBEB", padding: 10, borderRadius: 8, color: "#D97706" }}><AlertTriangle size={20} /></div>
                  <h4 style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Necesidad de Fondos</h4>
                </div>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: kpis.necesidadFondos > 0 ? "#EF4444" : "#0F172A" }}>
                  $ {fmt(kpis.necesidadFondos)}
                </p>
              </div>
            </div>

            {/* Gráfico de Evolución con Estilo Avanzado */}
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#0F172A", fontWeight: 600 }}>Evolución de Saldo Acumulado</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={procesadas.map(w => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
                  {/* Definimos el degradado visual */}
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E6E5D" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0E6E5D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} dx={-10} />
                  <Tooltip 
                    formatter={(v) => ["$ " + fmt(v), "Saldo"]} 
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 600, color: "#0F172A" }}
                  />
                  <Area type="monotone" dataKey="saldo" stroke="#0E6E5D" strokeWidth={3} fill="url(#colorSaldo)" activeDot={{ r: 6, strokeWidth: 0, fill: "#0E6E5D" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla Matricial Mejorada */}
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: 24, overflowX: "auto" }}>
              <h3 style={{ margin: "0 0 24px 0", fontSize: 16, color: "#0F172A", fontWeight: 600 }}>Desglose de Flujos Diarios</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ color: "#64748B", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", minWidth: 200, background: "#fff", position: "sticky", left: 0, zIndex: 2, fontWeight: 600 }}>Concepto</th>
                    {procesadas.map((w, index) => (
                      <th key={index} style={{ padding: "12px 16px", textAlign: "right", minWidth: 120, fontWeight: 600 }}>{w.week_start}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* --- INGRESOS --- */}
                  <tr>
                    <td colSpan={procesadas.length + 1} style={{ padding: "16px 16px 8px", fontWeight: 700, color: "#16A34A", fontSize: 11, letterSpacing: "0.05em", background: "#fff", position: "sticky", left: 0 }}>
                      INGRESOS OPERATIVOS
                    </td>
                  </tr>
                  {BASE_INCOME.map((income) => (
                    <tr key={income.key} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 16px", color: "#475569", background: "inherit", position: "sticky", left: 0 }}>{income.label}</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>
                          $ {fmt(w.income?.[income.key] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F0FDF4" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A", background: "#F0FDF4", position: "sticky", left: 0 }}>Total Ingresos</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#16A34A" }}>
                        $ {fmt(w.totalIngresos)}
                      </td>
                    ))}
                  </tr>

                  {/* --- EGRESOS --- */}
                  <tr>
                    <td colSpan={procesadas.length + 1} style={{ padding: "24px 16px 8px", fontWeight: 700, color: "#EF4444", fontSize: 11, letterSpacing: "0.05em", background: "#fff", position: "sticky", left: 0 }}>
                      EGRESOS OPERATIVOS
                    </td>
                  </tr>
                  {BASE_EXPENSE.map((expense) => (
                    <tr key={expense.key} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 16px", color: "#475569", background: "inherit", position: "sticky", left: 0 }}>{expense.label}</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>
                          $ {fmt(w.expense?.[expense.key] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#FEF2F2" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A", background: "#FEF2F2", position: "sticky", left: 0 }}>Total Egresos</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#EF4444" }}>
                        $ {fmt(w.totalEgresos)}
                      </td>
                    ))}
                  </tr>

                  {/* --- RESULTADOS --- */}
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "16px", fontWeight: 600, color: "#0F172A", background: "#fff", position: "sticky", left: 0 }}>Flujo Neto del Período</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: w.posicion >= 0 ? "#16A34A" : "#EF4444" }}>
                        $ {fmt(w.posicion)}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: "#0F172A", color: "#fff" }}>
                    <td style={{ padding: "16px", fontWeight: 700, background: "#0F172A", position: "sticky", left: 0, borderRadius: "0 0 0 8px" }}>Saldo Acumulado (Caja)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "16px", textAlign: "right", fontWeight: 700 }}>
                        $ {fmt(w.saldoAcumulado)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
