import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BASE_INCOME = [
  { key: "cuposNeuquen", label: "Cupos Neuquén" },
  { key: "cuposBoulevard", label: "Cupos Boulevard" },
  { key: "cupos300", label: "Cupos #300" },
  { key: "otrosIngresos", label: "Otros ingresos" },
  { key: "posiblesVentas", label: "Posibles ventas" },
  { key: "cobranzasCuotas", label: "Cobranzas cuotas" }
];

const BASE_EXPENSE = [
  { key: "socios", label: "Socios" },
  { key: "chequesEmitidos", label: "Cheques emitidos" },
  { key: "prestamos", label: "Préstamos" },
  { key: "sueldosOficina", label: "Sueldos oficina" },
  { key: "cargasSociales", label: "Cargas sociales" },
  { key: "proveedores", label: "Proveedores" }
];

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

export default function App() {
  const [weeks, setWeeks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Carga inicial de datos desde Supabase
  useEffect(() => {
    fetchWeeks();
  }, []);

  const fetchWeeks = async () => {
    const { data, error } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    if (error) console.error("Error al cargar datos:", error);
    else setWeeks(data || []);
    setLoaded(true);
  };

  // Guarda semanas importadas en Supabase
  const handleImportarSemanas = async (semanasNuevas) => {
    const { error } = await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    if (error) alert("Error al guardar en Supabase: " + error.message);
    else fetchWeeks();
  };

  // Procesa los totales y saldos acumulados de cada semana
  const procesadas = useMemo(() => {
    return weeks.map(w => {
      const ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      const eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);
      const pos = ing - eg;
      const acum = pos + Number(w.saldo_inicial || 0) + Number(w.saldo_bancos || 0) + Number(w.saldo_credimas || 0);
      return { ...w, totalIngresos: ing, totalEgresos: eg, posicion: pos, saldoAcumulado: acum };
    });
  }, [weeks]);

  // CÁLCULO DE INDICADORES (KPIs)
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

  if (!loaded) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Cargando Cashflow desde Supabase...</div>;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#F5F4F1", minHeight: "100vh", padding: 20 }}>
      <header style={{ background: "#12181F", color: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Cashflow 13 Semanas — Conectado a Supabase</h2>
      </header>

      {/* Componente de Importación Masiva */}
      <ImportadorCashflow 
        baseIncome={BASE_INCOME} 
        baseExpense={BASE_EXPENSE} 
        onImportarSemanas={handleImportarSemanas} 
      />

      {/* Estado Vacío / Empty State */}
      {procesadas.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#7C8891" }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.4 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 style={{ fontSize: 18, color: "#12181F", marginBottom: 8, fontWeight: 600 }}>Aún no hay proyecciones</h3>
          <p style={{ fontSize: 14, maxWidth: 450, margin: "0 auto", lineHeight: 1.5 }}>
            Sube un archivo de Excel usando el botón superior o espera a que se sincronicen los datos desde tu base de datos para visualizar el Cashflow.
          </p>
        </div>
      )}

      {/* Resumen de Gráficos, KPIs y Tabla */}
      {procesadas.length > 0 && kpis && (
        <>
          {/* Tarjetas de Indicadores */}
          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #DEDAD0" }}>
              <h4 style={{ margin: 0, color: "#7C8891", fontSize: 13, textTransform: "uppercase" }}>Días de Caja</h4>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: "bold", color: kpis.diasDeCaja > 15 ? "#0E6E5D" : "#D93025" }}>
                {kpis.diasDeCaja} <span style={{ fontSize: 16, fontWeight: "normal", color: "#7C8891" }}>días</span>
              </p>
            </div>
            
            <div style={{ flex: 1, minWidth: 200, background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #DEDAD0" }}>
              <h4 style={{ margin: 0, color: "#7C8891", fontSize: 13, textTransform: "uppercase" }}>Día de Déficit</h4>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: "bold", color: kpis.diaDeficit !== "Sin déficit" ? "#D93025" : "#0E6E5D" }}>
                {kpis.diaDeficit}
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 200, background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #DEDAD0" }}>
              <h4 style={{ margin: 0, color: "#7C8891", fontSize: 13, textTransform: "uppercase" }}>Necesidad de Fondos</h4>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: "bold", color: kpis.necesidadFondos > 0 ? "#D93025" : "#0E6E5D" }}>
                $ {fmt(kpis.necesidadFondos)}
              </p>
            </div>
          </div>

          {/* Gráfico de Evolución */}
          <div style={{ background: "#fff", border: "1px solid #DEDAD0", borderRadius: 8, padding: 20, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#12181F" }}>Evolución de Saldo Acumulado</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={procesadas.map(w => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fill: "#7C8891", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7C8891", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} />
                <Tooltip 
                  formatter={(v) => "$ " + fmt(v)} 
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Area type="monotone" dataKey="saldo" stroke="#0E6E5D" strokeWidth={2} fill="#0E6E5D" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* NUEVO: Tabla de Detalle Semanal */}
          <div style={{ background: "#fff", border: "1px solid #DEDAD0", borderRadius: 8, padding: 20, marginTop: 20, overflowX: "auto" }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 16, color: "#12181F" }}>Detalle Semanal</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E5E5", textAlign: "left", color: "#7C8891" }}>
                  <th style={{ padding: "12px 8px" }}>Semana</th>
                  <th style={{ padding: "12px 8px" }}>Ingresos</th>
                  <th style={{ padding: "12px 8px" }}>Egresos</th>
                  <th style={{ padding: "12px 8px" }}>Flujo Neto</th>
                  <th style={{ padding: "12px 8px" }}>Saldo Acum.</th>
                </tr>
              </thead>
              <tbody>
                {procesadas.map((w, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #F5F4F1" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 500 }}>{w.week_start}</td>
                    <td style={{ padding: "12px 8px", color: "#0E6E5D" }}>$ {fmt(w.totalIngresos)}</td>
                    <td style={{ padding: "12px 8px", color: "#D93025" }}>$ {fmt(w.totalEgresos)}</td>
                    <td style={{ padding: "12px 8px", fontWeight: 600, color: w.posicion >= 0 ? "#0E6E5D" : "#D93025" }}>
                      $ {fmt(w.posicion)}
                    </td>
                    <td style={{ padding: "12px 8px", fontWeight: "bold" }}>$ {fmt(w.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
