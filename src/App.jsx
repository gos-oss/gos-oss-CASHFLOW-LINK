import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, CalendarX2, AlertTriangle, TrendingUp, Lightbulb, PlusCircle, XCircle, Landmark, Banknote } from "lucide-react";

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
  
  // Estados para los saldos iniciales reales
  const [saldoEfectivo, setSaldoEfectivo] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");

  const [supuestos, setSupuestos] = useState([]);
  const [formSupuesto, setFormSupuesto] = useState({ concepto: "", monto: "", fecha: "", tipo: "ingreso" });

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
      setSupuestos([]);
    }
  };

  const agregarSupuesto = () => {
    if (!formSupuesto.concepto || !formSupuesto.monto || !formSupuesto.fecha) {
      alert("Por favor, completa todos los campos del supuesto.");
      return;
    }
    setSupuestos([...supuestos, { ...formSupuesto, id: Date.now(), monto: Number(formSupuesto.monto) }]);
    setFormSupuesto({ concepto: "", monto: "", fecha: "", tipo: "ingreso" });
  };

  const eliminarSupuesto = (id) => {
    setSupuestos(supuestos.filter(s => s.id !== id));
  };

  // MOTOR MATEMÁTICO ACTUALIZADO: Acumulación real con Saldos Iniciales
  const procesadas = useMemo(() => {
    const fechasSet = new Set(weeks.map(w => w.week_start));
    supuestos.forEach(s => fechasSet.add(s.fecha));
    const fechasArray = Array.from(fechasSet).sort();

    // Comenzamos la bola de nieve con el dinero que tienes hoy
    let acumuladoActual = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);

    return fechasArray.map(fecha => {
      const w = weeks.find(week => week.week_start === fecha) || { income: {}, expense: {} };
      
      let ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      let eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);

      const supuestosDelDia = supuestos.filter(s => s.fecha === fecha);
      let simIngreso = 0;
      let simEgreso = 0;

      supuestosDelDia.forEach(s => {
        if (s.tipo === "ingreso") simIngreso += s.monto;
        if (s.tipo === "egreso") simEgreso += s.monto;
      });

      const totalIngresosConSimulacion = ing + simIngreso;
      const totalEgresosConSimulacion = eg + simEgreso;

      const pos = totalIngresosConSimulacion - totalEgresosConSimulacion;
      
      // Sumamos el flujo neto del día al saldo que traíamos del día anterior
      acumuladoActual += pos;

      return { 
        ...w, 
        week_start: fecha,
        totalIngresos: totalIngresosConSimulacion, 
        totalEgresos: totalEgresosConSimulacion, 
        posicion: pos, 
        saldoAcumulado: acumuladoActual,
        simIngreso, 
        simEgreso 
      };
    });
  }, [weeks, supuestos, saldoEfectivo, saldoBanco]); // Se recalcula si cambias el saldo inicial

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
      
      <header style={{ background: "#ffffff", borderBottom: "1px solid #E2E8F0", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ background: "#0E6E5D", color: "#fff", padding: 8, borderRadius: 8 }}>
          <TrendingUp size={24} />
        </div>
        <h2 style={{ margin: 0, color: "#0F172A", fontSize: 20, fontWeight: 600 }}>Cashflow Pro <span style={{ color: "#94A3B8", fontSize: 14, fontWeight: 400 }}>| Conectado a Supabase</span></h2>
      </header>

      <main style={{ padding: "32px", maxWidth: 1600, margin: "0 auto" }}>
        
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
          {/* Panel de Importación */}
         <div style={{ background: "#ffffff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", flex: 2, minWidth: 300 }}>
            <ImportadorCashflow 
              baseIncome={BASE_INCOME} 
              baseExpense={BASE_EXPENSE} 
              onImportarSemanas={handleImportarSemanas} 
              onBorrarDatos={handleBorrarDatos}
              semanasExistentes={weeks} 
            />
          </div>

          {/* NUEVO: Panel de Saldos Iniciales Reales */}
          <div style={{ background: "#ffffff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: 20, flex: 1, minWidth: 250, border: "1px solid #F1F5F9" }}>
             <h3 style={{ margin: "0 0 16px 0", fontSize: 15, color: "#0F172A", fontWeight: 600 }}>Saldos Iniciales Reales</h3>
             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Banknote size={18} color="#16A34A" />
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Caja Efectivo</label>
                    <input type="number" placeholder="Ej: 150000" value={saldoEfectivo} onChange={e => setSaldoEfectivo(e.target.value)} style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid #CBD5E1", fontSize: 15, outline: "none", background: "transparent" }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Landmark size={18} color="#0284C7" />
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Cuentas Bancarias</label>
                    <input type="number" placeholder="Ej: 850000" value={saldoBanco} onChange={e => setSaldoBanco(e.target.value)} style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid #CBD5E1", fontSize: 15, outline: "none", background: "transparent" }} />
                  </div>
                </div>
             </div>
          </div>
        </div>

        {procesadas.length === 0 && (
          <div style={{ textAlign: "center", padding: "100px 20px", background: "#ffffff", borderRadius: 12, border: "1px dashed #CBD5E1" }}>
            <Wallet size={64} style={{ color: "#94A3B8", marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 20, color: "#334155", marginBottom: 8, fontWeight: 600 }}>Tu lienzo financiero está vacío</h3>
            <p style={{ fontSize: 15, color: "#64748B", maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>
              Sube tu primer archivo de Excel para generar proyecciones automáticas y calcular tu salud de caja.
            </p>
          </div>
        )}

        {procesadas.length > 0 && kpis && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>
              <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#F0FDF4", padding: 10, borderRadius: 8, color: "#16A34A" }}><Wallet size={20} /></div>
                  <h4 style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Días de Caja</h4>
                </div>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: kpis.diasDeCaja > 15 ? "#0F172A" : "#EF4444" }}>
                  {kpis.diasDeCaja} <span style={{ fontSize: 16, fontWeight: 500, color: "#94A3B8" }}>días</span>
                </p>
              </div>
              
              <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#FEF2F2", padding: 10, borderRadius: 8, color: "#EF4444" }}><CalendarX2 size={20} /></div>
                  <h4 style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Día de Déficit</h4>
                </div>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: kpis.diaDeficit !== "Sin déficit" ? "#EF4444" : "#0F172A" }}>
                  {kpis.diaDeficit}
                </p>
              </div>

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

            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: 24, marginBottom: 24, border: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Lightbulb size={20} color="#D97706" />
                <h3 style={{ margin: 0, fontSize: 16, color: "#0F172A", fontWeight: 600 }}>Simulador de Escenarios (Supuestos)</h3>
              </div>
              <p style={{ color: "#64748B", fontSize: 13, marginBottom: 16 }}>Agrega movimientos hipotéticos para proyectar cómo afectaría tu caja sin modificar tu base de datos real.</p>
              
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>Concepto</label>
                  <input type="text" placeholder="Ej. Venta Inesperada" value={formSupuesto.concepto} onChange={e => setFormSupuesto({...formSupuesto, concepto: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>Monto ($)</label>
                  <input type="number" placeholder="500000" value={formSupuesto.monto} onChange={e => setFormSupuesto({...formSupuesto, monto: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>Fecha</label>
                  <input type="date" value={formSupuesto.fecha} onChange={e => setFormSupuesto({...formSupuesto, fecha: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 600 }}>Tipo</label>
                  <select value={formSupuesto.tipo} onChange={e => setFormSupuesto({...formSupuesto, tipo: e.target.value})} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 14, background: "#fff" }}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <button onClick={agregarSupuesto} style={{ padding: "8px 16px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, height: 38 }}>
                  <PlusCircle size={16} /> Simular
                </button>
              </div>

              {supuestos.length > 0 && (
                <div style={{ marginTop: 16, background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px dashed #CBD5E1" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748B", textTransform: "uppercase" }}>Simulaciones Activas:</h4>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {supuestos.map(s => (
                      <li key={s.id} style={{ fontSize: 13, background: "#fff", border: `1px solid ${s.tipo === 'ingreso' ? '#16A34A' : '#EF4444'}`, padding: "4px 8px", borderRadius: 16, display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
                        {s.concepto}: ${fmt(s.monto)} ({s.fecha})
                        <XCircle size={14} color="#94A3B8" cursor="pointer" onClick={() => eliminarSupuesto(s.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#0F172A", fontWeight: 600 }}>Evolución de Saldo Acumulado</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={procesadas.map(w => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E6E5D" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0E6E5D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} dx={-10} />
                  <Tooltip formatter={(v) => ["$ " + fmt(v), "Saldo"]} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 600, color: "#0F172A" }} />
                  <Area type="monotone" dataKey="saldo" stroke="#0E6E5D" strokeWidth={3} fill="url(#colorSaldo)" activeDot={{ r: 6, strokeWidth: 0, fill: "#0E6E5D" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

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
                    <td colSpan={procesadas.length + 1} style={{ padding: "16px 16px 8px", fontWeight: 700, color: "#16A34A", fontSize: 11, letterSpacing: "0.05em", background: "#fff", position: "sticky", left: 0 }}>INGRESOS OPERATIVOS</td>
                  </tr>
                  {BASE_INCOME.map((income) => (
                    <tr key={income.key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 16px", color: "#475569", position: "sticky", left: 0, background: "#fff" }}>{income.label}</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>$ {fmt(w.income?.[income.key] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F0FDF4" }}>
                    <td style={{ padding: "10px 16px", color: "#16A34A", fontStyle: "italic", position: "sticky", left: 0, background: "#F0FDF4" }}>+ Simulaciones (Ingresos)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#16A34A" }}>$ {fmt(w.simIngreso)}</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F0FDF4" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A", background: "#F0FDF4", position: "sticky", left: 0 }}>Total Ingresos (Proyectado)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#16A34A" }}>$ {fmt(w.totalIngresos)}</td>
                    ))}
                  </tr>

                  {/* --- EGRESOS --- */}
                  <tr>
                    <td colSpan={procesadas.length + 1} style={{ padding: "24px 16px 8px", fontWeight: 700, color: "#EF4444", fontSize: 11, letterSpacing: "0.05em", background: "#fff", position: "sticky", left: 0 }}>EGRESOS OPERATIVOS</td>
                  </tr>
                  {BASE_EXPENSE.map((expense) => (
                    <tr key={expense.key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 16px", color: "#475569", position: "sticky", left: 0, background: "#fff" }}>{expense.label}</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>$ {fmt(w.expense?.[expense.key] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FEF2F2" }}>
                    <td style={{ padding: "10px 16px", color: "#EF4444", fontStyle: "italic", position: "sticky", left: 0, background: "#FEF2F2" }}>+ Simulaciones (Egresos)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#EF4444" }}>$ {fmt(w.simEgreso)}</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#FEF2F2" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A", background: "#FEF2F2", position: "sticky", left: 0 }}>Total Egresos (Proyectado)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#EF4444" }}>$ {fmt(w.totalEgresos)}</td>
                    ))}
                  </tr>

                  {/* --- RESULTADOS --- */}
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "16px", fontWeight: 600, color: "#0F172A", background: "#fff", position: "sticky", left: 0 }}>Flujo Neto del Período</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: w.posicion >= 0 ? "#16A34A" : "#EF4444" }}>$ {fmt(w.posicion)}</td>
                    ))}
                  </tr>
                  <tr style={{ background: "#0F172A", color: "#fff" }}>
                    <td style={{ padding: "16px", fontWeight: 700, background: "#0F172A", position: "sticky", left: 0, borderRadius: "0 0 0 8px" }}>Saldo Acumulado (Caja)</td>
                    {procesadas.map((w, index) => (
                      <td key={index} style={{ padding: "16px", textAlign: "right", fontWeight: 700 }}>$ {fmt(w.saldoAcumulado)}</td>
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
