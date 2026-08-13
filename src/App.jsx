import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, CalendarX2, AlertTriangle, TrendingUp, Lightbulb, PlusCircle, XCircle, Landmark, Banknote, CalendarClock, Save, Settings } from "lucide-react";

// NUEVO: Bloque de estilos CSS avanzados para la tabla
const customStyles = `
  .table-container::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }
  .table-container::-webkit-scrollbar-track {
    background: #F1F5F9;
    border-radius: 4px;
  }
  .table-container::-webkit-scrollbar-thumb {
    background: #CBD5E1;
    border-radius: 4px;
  }
  .table-container::-webkit-scrollbar-thumb:hover {
    background: #94A3B8;
  }
  .flujo-table th, .flujo-table td {
    border-right: 1px solid #F1F5F9;
  }
  .flujo-table th:last-child, .flujo-table td:last-child {
    border-right: none;
  }
  .flujo-row:hover td {
    filter: brightness(0.96);
    transition: all 0.2s ease;
  }
  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 2;
    box-shadow: 4px 0 8px -2px rgba(0,0,0,0.05);
    clip-path: inset(0 -10px 0 0); /* Evita que la sombra se vea arriba/abajo */
  }
`;

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
  
  const [saldoEfectivo, setSaldoEfectivo] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");
  const [fechaSaldo, setFechaSaldo] = useState("");

  const [supuestos, setSupuestos] = useState([]);
  const [formSupuesto, setFormSupuesto] = useState({ concepto: "", monto: "", fecha: "", tipo: "ingreso" });

  useEffect(() => {
    fetchWeeks();
    fetchSettings();
  }, []);

  const fetchWeeks = async () => {
    const { data, error } = await supabase.from("cashflow_weeks").select("*").order("week_start", { ascending: true });
    if (error) console.error("Error al cargar proyecciones:", error);
    else setWeeks(data || []);
    setLoaded(true);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("cashflow_settings").select("*").eq("id", "general");
    if (data && data.length > 0) {
      setFechaSaldo(data[0].fecha_corte || "");
      setSaldoEfectivo(data[0].saldo_efectivo || "");
      setSaldoBanco(data[0].saldo_banco || "");
    }
  };

  const guardarSaldos = async () => {
    const { error } = await supabase.from("cashflow_settings").upsert({
      id: "general",
      fecha_corte: fechaSaldo,
      saldo_efectivo: Number(saldoEfectivo) || 0,
      saldo_banco: Number(saldoBanco) || 0
    });
    if (error) alert("Error al guardar saldos: " + error.message);
    else alert("¡Saldos iniciales guardados exitosamente!");
  };

  const handleImportarSemanas = async (semanasNuevas) => {
    const { error } = await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    if (error) alert("Error al guardar en Supabase: " + error.message);
    else fetchWeeks();
  };

  const handleBorrarDatos = async () => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas borrar toda la información de proyecciones? El tablero quedará en 0.");
    if (!confirmacion) return;
    const { error } = await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    if (error) alert("Error al limpiar la base de datos: " + error.message);
    else { fetchWeeks(); setSupuestos([]); }
  };

  const agregarSupuesto = () => {
    if (!formSupuesto.concepto || !formSupuesto.monto || !formSupuesto.fecha) {
      alert("Por favor, completa todos los campos del supuesto.");
      return;
    }
    setSupuestos([...supuestos, { ...formSupuesto, id: Date.now(), monto: Number(formSupuesto.monto) }]);
    setFormSupuesto({ concepto: "", monto: "", fecha: "", tipo: formSupuesto.tipo });
  };

  const eliminarSupuesto = (id) => setSupuestos(supuestos.filter(s => s.id !== id));

  const procesadas = useMemo(() => {
    const fechasSet = new Set(weeks.map(w => w.week_start));
    supuestos.forEach(s => fechasSet.add(s.fecha));
    if (fechaSaldo) fechasSet.add(fechaSaldo);
    
    const fechasArray = Array.from(fechasSet).sort();
    let acumuladoActual = 0;
    let saldoFijado = false;

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
      
      if (fechaSaldo && fecha === fechaSaldo) {
        acumuladoActual = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
        saldoFijado = true;
      } else if (!fechaSaldo && !saldoFijado) {
        acumuladoActual = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
        saldoFijado = true;
      }
      acumuladoActual += pos;

      return { 
        ...w, week_start: fecha, totalIngresos: totalIngresosConSimulacion, 
        totalEgresos: totalEgresosConSimulacion, posicion: pos, 
        saldoAcumulado: acumuladoActual, simIngreso, simEgreso 
      };
    });
  }, [weeks, supuestos, saldoEfectivo, saldoBanco, fechaSaldo]); 

  const kpis = useMemo(() => {
    if (procesadas.length === 0) return null;
    const saldoInicialReal = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
    const fechaInicio = new Date(procesadas[0].week_start);
    const fechaFin = new Date(procesadas[procesadas.length - 1].week_start);
    let diasTotalesProyeccion = (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24);
    if (diasTotalesProyeccion <= 0) diasTotalesProyeccion = 1;

    const egresosTotales = procesadas.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const egresoPromedioDiario = egresosTotales / diasTotalesProyeccion;
    const diasDeCaja = egresoPromedioDiario > 0 ? Math.round(saldoInicialReal / egresoPromedioDiario) : 0;

    const semanaDeficit = procesadas.find(w => w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";

    const ultimaFecha = procesadas[procesadas.length - 1].week_start; 
    const ultimoMes = ultimaFecha.substring(0, 7); 
    const datosUltimoMes = procesadas.filter(w => w.week_start.startsWith(ultimoMes));
    const ingresosUltimoMes = datosUltimoMes.reduce((acc, cur) => acc + cur.totalIngresos, 0);
    const egresosUltimoMes = datosUltimoMes.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const flujoUltimoMes = ingresosUltimoMes - egresosUltimoMes;
    
    const deficitUltimoMes = flujoUltimoMes < 0 ? Math.abs(flujoUltimoMes) : 0;
    const nofAnual = deficitUltimoMes * 12;
    const nofMensual = nofAnual / 12;

    return { diasDeCaja, diaDeficit, nofMensual, nofAnual };
  }, [procesadas, saldoEfectivo, saldoBanco]);

  if (!loaded) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#64748b', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Iniciando entorno seguro...</div>;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F1F5F9", minHeight: "100vh" }}>
      {/* Inyectamos nuestros estilos CSS */}
      <style>{customStyles}</style>

      <header style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ background: "#10B981", color: "#0F172A", padding: 6, borderRadius: 6 }}>
          <TrendingUp size={20} />
        </div>
        <h2 style={{ margin: 0, color: "#F8FAFC", fontSize: 18, fontWeight: 600, letterSpacing: "-0.5px" }}>
          Cashflow Pro <span style={{ color: "#64748B", fontSize: 13, fontWeight: 400, marginLeft: 8 }}>v2.0 Workspace</span>
        </h2>
      </header>

      <main style={{ padding: "24px 32px", maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
          <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <ImportadorCashflow 
              baseIncome={BASE_INCOME} 
              baseExpense={BASE_EXPENSE} 
              onImportarSemanas={handleImportarSemanas} 
              onBorrarDatos={handleBorrarDatos}
              semanasExistentes={weeks} 
            />
          </div>

          <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "16px 24px", display: "flex", alignItems: "center", gap: "24px" }}>
             <div style={{ flex: 1 }}>
               <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                 <Settings size={16} color="#475569" />
                 <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A", fontWeight: 600 }}>Punto de Partida (Saldos Reales)</h3>
               </div>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Fecha de Corte</label>
                    <input type="date" value={fechaSaldo} onChange={e => setFechaSaldo(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, outline: "none", color: "#0F172A" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Efectivo ($)</label>
                    <input type="number" value={saldoEfectivo} onChange={e => setSaldoEfectivo(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Bancos ($)</label>
                    <input type="number" value={saldoBanco} onChange={e => setSaldoBanco(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, outline: "none" }} />
                  </div>
               </div>
             </div>
             <button onClick={guardarSaldos} style={{ padding: "10px 16px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                <Save size={18} /> <span style={{ fontSize: 11 }}>Guardar</span>
             </button>
          </div>
        </div>

        {procesadas.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", background: "#ffffff", borderRadius: 10, border: "1px dashed #CBD5E1" }}>
            <Wallet size={48} style={{ color: "#94A3B8", marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 18, color: "#334155", marginBottom: 8, fontWeight: 600 }}>Área de trabajo vacía</h3>
            <p style={{ fontSize: 14, color: "#64748B", maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
              Importa tu primer archivo de Excel para visualizar el tablero de control financiero.
            </p>
          </div>
        )}

        {procesadas.length > 0 && kpis && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
              <div style={{ background: "#fff", padding: "20px 24px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "#64748B", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Días de Caja</h4>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: kpis.diasDeCaja > 15 ? "#0F172A" : "#EF4444", letterSpacing: "-1px" }}>
                    {kpis.diasDeCaja} <span style={{ fontSize: 14, fontWeight: 500, color: "#94A3B8", letterSpacing: "0" }}>días</span>
                  </p>
                </div>
                <div style={{ background: "#F1F5F9", padding: 12, borderRadius: 8, color: "#10B981" }}><Wallet size={24} /></div>
              </div>
              
              <div style={{ background: "#fff", padding: "20px 24px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "#64748B", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Día de Déficit</h4>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: kpis.diaDeficit !== "Sin déficit" ? "#EF4444" : "#0F172A", letterSpacing: "-1px" }}>
                    {kpis.diaDeficit}
                  </p>
                </div>
                <div style={{ background: "#F1F5F9", padding: 12, borderRadius: 8, color: "#EF4444" }}><CalendarX2 size={24} /></div>
              </div>

              <div style={{ background: "#fff", padding: "20px 24px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "#64748B", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>NOF Mensual</h4>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: kpis.nofMensual > 0 ? "#EF4444" : "#0F172A", letterSpacing: "-1px" }}>
                    $ {fmt(kpis.nofMensual)}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>Anual: $ {fmt(kpis.nofAnual)}</p>
                </div>
                <div style={{ background: "#F1F5F9", padding: 12, borderRadius: 8, color: "#F59E0B" }}><AlertTriangle size={24} /></div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 24, display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: 15, color: "#0F172A", fontWeight: 600 }}>Evolución de Saldo Acumulado</h3>
                <div style={{ flex: 1, minHeight: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={procesadas.map(w => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
                      <defs>
                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} dx={-10} />
                      <Tooltip formatter={(v) => ["$ " + fmt(v), "Saldo"]} contentStyle={{ borderRadius: 6, border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: 13, fontWeight: 600, color: "#0F172A" }} />
                      <Area type="monotone" dataKey="saldo" stroke="#10B981" strokeWidth={3} fill="url(#colorSaldo)" activeDot={{ r: 5, strokeWidth: 0, fill: "#0F172A" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 24, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Lightbulb size={18} color="#F59E0B" />
                  <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A", fontWeight: 600 }}>Simulador de Escenarios</h3>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Tipo de Flujo</label>
                    <select value={formSupuesto.tipo} onChange={e => setFormSupuesto({...formSupuesto, tipo: e.target.value, concepto: ""})} style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13, background: "#F8FAFC" }}>
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Concepto</label>
                    <select value={formSupuesto.concepto} onChange={e => setFormSupuesto({...formSupuesto, concepto: e.target.value})} style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13, background: "#F8FAFC" }}>
                      <option value="">-- Seleccionar --</option>
                      {(formSupuesto.tipo === 'ingreso' ? BASE_INCOME : BASE_EXPENSE).map(item => (
                        <option key={item.key} value={item.label}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Monto ($)</label>
                      <input type="number" placeholder="0" value={formSupuesto.monto} onChange={e => setFormSupuesto({...formSupuesto, monto: e.target.value})} style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Fecha</label>
                      <input type="date" value={formSupuesto.fecha} onChange={e => setFormSupuesto({...formSupuesto, fecha: e.target.value})} style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }} />
                    </div>
                  </div>
                  
                  <button onClick={agregarSupuesto} style={{ marginTop: 8, padding: "10px", background: "#10B981", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}>
                    <PlusCircle size={16} /> Añadir Simulación
                  </button>

                  {supuestos.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Activas ({supuestos.length})</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                        {supuestos.map(s => (
                          <div key={s.id} style={{ fontSize: 11, background: s.tipo === 'ingreso' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${s.tipo === 'ingreso' ? '#A7F3D0' : '#FECACA'}`, padding: "6px 8px", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#334155" }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{s.concepto}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <strong>${fmt(s.monto)}</strong>
                              <XCircle size={14} color="#94A3B8" cursor="pointer" onClick={() => eliminarSupuesto(s.id)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LA TABLA DESGLOSE MEJORADA (Se añadieron clases de CSS) */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A", fontWeight: 600 }}>Desglose de Flujos Diarios</h3>
              </div>
              
              {/* Contenedor con la barra de scroll personalizada */}
              <div className="table-container" style={{ overflowX: "auto", paddingBottom: "8px" }}>
                <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ color: "#64748B", borderBottom: "2px solid #E2E8F0" }}>
                      {/* Columna de concepto mejorada con sombra lateral */}
                      <th className="sticky-col" style={{ padding: "16px", textAlign: "left", minWidth: 220, background: "#fff", fontWeight: 600, borderRight: "1px solid #E2E8F0" }}>Concepto</th>
                      {procesadas.map((w, index) => (
                        <th key={index} style={{ padding: "16px", textAlign: "right", minWidth: 110, fontWeight: 600 }}>{w.week_start}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    
                    {/* --- INGRESOS --- */}
                    <tr>
                      <td className="sticky-col" style={{ padding: "24px 16px 8px", fontWeight: 800, color: "#10B981", fontSize: 10, letterSpacing: "0.5px", background: "#fff", borderRight: "1px solid #E2E8F0" }}>INGRESOS OPERATIVOS</td>
                      <td colSpan={procesadas.length}></td>
                    </tr>
                    {BASE_INCOME.map((income) => (
                      <tr key={income.key} className="flujo-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td className="sticky-col" style={{ padding: "10px 16px", color: "#475569", background: "#fff", borderRight: "1px solid #E2E8F0" }}>{income.label}</td>
                        {procesadas.map((w, index) => (
                          <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>$ {fmt(w.income?.[income.key] || 0)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td className="sticky-col" style={{ padding: "10px 16px", color: "#10B981", fontStyle: "italic", background: "#ECFDF5", borderRight: "1px solid #E2E8F0" }}>+ Simulaciones (Ingresos)</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#10B981", background: "#ECFDF5" }}>$ {fmt(w.simIngreso)}</td>
                      ))}
                    </tr>
                    <tr className="flujo-row" style={{ borderBottom: "2px solid #E2E8F0" }}>
                      <td className="sticky-col" style={{ padding: "14px 16px", fontWeight: 700, color: "#0F172A", background: "#F8FAFC", borderRight: "1px solid #E2E8F0" }}>Total Ingresos</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#10B981", background: "#F8FAFC" }}>$ {fmt(w.totalIngresos)}</td>
                      ))}
                    </tr>

                    {/* --- EGRESOS --- */}
                    <tr>
                      <td className="sticky-col" style={{ padding: "32px 16px 8px", fontWeight: 800, color: "#EF4444", fontSize: 10, letterSpacing: "0.5px", background: "#fff", borderRight: "1px solid #E2E8F0" }}>EGRESOS OPERATIVOS</td>
                      <td colSpan={procesadas.length}></td>
                    </tr>
                    {BASE_EXPENSE.map((expense) => (
                      <tr key={expense.key} className="flujo-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td className="sticky-col" style={{ padding: "10px 16px", color: "#475569", background: "#fff", borderRight: "1px solid #E2E8F0" }}>{expense.label}</td>
                        {procesadas.map((w, index) => (
                          <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>$ {fmt(w.expense?.[expense.key] || 0)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="flujo-row" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td className="sticky-col" style={{ padding: "10px 16px", color: "#EF4444", fontStyle: "italic", background: "#FEF2F2", borderRight: "1px solid #E2E8F0" }}>+ Simulaciones (Egresos)</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "10px 16px", textAlign: "right", color: "#EF4444", background: "#FEF2F2" }}>$ {fmt(w.simEgreso)}</td>
                      ))}
                    </tr>
                    <tr className="flujo-row" style={{ borderBottom: "2px solid #E2E8F0" }}>
                      <td className="sticky-col" style={{ padding: "14px 16px", fontWeight: 700, color: "#0F172A", background: "#F8FAFC", borderRight: "1px solid #E2E8F0" }}>Total Egresos</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#EF4444", background: "#F8FAFC" }}>$ {fmt(w.totalEgresos)}</td>
                      ))}
                    </tr>

                    {/* --- RESULTADOS --- */}
                    <tr className="flujo-row" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td className="sticky-col" style={{ padding: "18px 16px", fontWeight: 700, color: "#0F172A", background: "#fff", borderRight: "1px solid #E2E8F0", fontSize: 13 }}>Flujo Neto</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "18px 16px", textAlign: "right", fontWeight: 700, fontSize: 13, color: w.posicion >= 0 ? "#10B981" : "#EF4444" }}>$ {fmt(w.posicion)}</td>
                      ))}
                    </tr>
                    <tr className="flujo-row">
                      <td className="sticky-col" style={{ padding: "20px 16px", fontWeight: 800, background: "#0F172A", color: "#fff", borderRight: "1px solid #1E293B", fontSize: 13 }}>Saldo Acumulado</td>
                      {procesadas.map((w, index) => (
                        <td key={index} style={{ padding: "20px 16px", textAlign: "right", fontWeight: 800, background: "#0F172A", color: "#fff", fontSize: 13 }}>$ {fmt(w.saldoAcumulado)}</td>
                      ))}
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
