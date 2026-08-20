import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import './App.css';

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

  const procesadas = useMemo(() => {
    return weeks.map(w => {
      const ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      const eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);
      const pos = ing - eg;
      const acum = pos + Number(w.saldo_inicial || 0) + Number(w.saldo_bancos || 0) + Number(w.saldo_credimas || 0);
      return { ...w, totalIngresos: ing, totalEgresos: eg, posicion: pos, saldoAcumulado: acum };
    });
  }, [weeks]);

  if (!loaded) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Cargando Cashflow desde Supabase...</div>;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#F5F4F1", minHeight: "100vh", padding: 20 }}>
      <header style={{ background: "#12181F", color: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h2>Cashflow 13 Semanas — Azlepi & Sigma</h2>
      </header>

      <ImportadorCashflow
        baseIncome={BASE_INCOME}
        baseExpense={BASE_EXPENSE}
        onImportarSemanas={handleImportarSemanas}
      />

      {procesadas.length > 0 && (
        <div style={{ background: "#FBFAF8", border: "1px solid #DEDAD0", borderRadius: 8, padding: 20, marginTop: 20 }}>
          <h3>Evolución de Saldo Acumulado</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={procesadas.map(w => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => "$ " + fmt(v)} />
              <Area type="monotone" dataKey="saldo" stroke="#0E6E5D" fill="#0E6E5D" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
