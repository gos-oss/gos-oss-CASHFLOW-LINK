import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import ImportadorCashflow from "./ImportadorCashflow";
import CargarMovimiento from "./CargarMovimiento";
import CategoryManager from "./CategoryManager";
import Cash13Semanas, { useSemanas13 } from "./Cash13Semanas";
import { tokens, fontImport } from "./tokens";
import { BASE_INCOME, BASE_EXPENSE, slugify, discoverCategories } from "./categories";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Wallet, CalendarX2, AlertTriangle, Save, Settings,
  ListChecks, Tag, SlidersHorizontal, Compass, CalendarRange,
  ChevronDown, ChevronRight, BarChart3
} from "lucide-react";

// =========================================================================
// COLORES ESPECÍFICOS DE LAS TABLAS
// =========================================================================
const colorTablaBg = "#F4F6F8";       
const colorLineaSuave = "#DCE1E8";    
const colorLineaFuerte = "#C2CAD4";   
const colorTotalBg = "#E6EAEE";       
const colorHover = "#DEE3E9";         

const globalStyles = `
  ${fontImport}
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: ${tokens.paper}; }
  #root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; width: 100vw !important; overflow-x: hidden; }
  ::-webkit-scrollbar { height: 8px; width: 8px; }
  ::-webkit-scrollbar-track { background: ${tokens.ruleSoft}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb { background: ${tokens.rule}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #B9BEB3; }
  
  .flujo-table th, .flujo-table td { border-right: 1px solid ${colorLineaSuave}; }
  .flujo-table th:last-child, .flujo-table td:last-child { border-right: none; }
  .flujo-row:hover td { background: ${colorHover} !important; transition: background 0.15s; }
  
  .sticky-col { position: sticky; left: 0; z-index: 2; box-shadow: 3px 0 6px -3px rgba(14,21,36,0.08); }
  .nav-item { transition: background 0.15s ease, color 0.15s ease; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${tokens.gold}; outline-offset: 1px; }
  .draggable-chip:hover { transform: scale(1.05); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
`;

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const NAV = [
  { id: "resumen", label: "Resumen", icon: Compass },
  { id: "semanas13", label: "Cash 13 semanas", icon: CalendarRange },
  { id: "plan-fondos", label: "Plan de Fondos", icon: BarChart3 },
  { id: "movimientos", label: "Movimientos", icon: ListChecks },
  { id: "conceptos", label: "Conceptos", icon: Tag },
  { id: "configuracion", label: "Configuración", icon: SlidersHorizontal },
];

export default function App() {
  const [weeks, setWeeks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [mostrarPanel, setMostrarPanel] = useState(true);

  const [saldoEfectivo, setSaldoEfectivo] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");
  const [fechaSaldo, setFechaSaldo] = useState("");

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
    const { data } = await supabase.from("cashflow_settings").select("*").eq("id", "general");
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
      saldo_banco: Number(saldoBanco) || 0,
    });
    if (error) alert("Error al guardar saldos: " + error.message);
    else alert("¡Saldos iniciales guardados!");
  };

  const handleImportarSemanas = async (semanasNuevas) => {
    const { error } = await supabase.from("cashflow_weeks").upsert(semanasNuevas);
    if (error) alert("Error al guardar en Supabase: " + error.message);
    else fetchWeeks();
  };

  const handleBorrarDatos = async () => {
    if (!window.confirm("¿Estás seguro de que deseas borrar toda la información de proyecciones? El tablero quedará en 0.")) return;
    const { error } = await supabase.from("cashflow_weeks").delete().not("week_start", "is", null);
    if (error) alert("Error al limpiar la base de datos: " + error.message);
    else fetchWeeks();
  };

  const guardarMovimiento = async ({ fecha, tipo, key, monto, estado, nota }) => {
    const existente = weeks.find((w) => w.week_start === fecha);
    const base = existente || {
      id: fecha, week_start: fecha, status: estado,
      saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0,
      income: {}, expense: {}, notes: "",
    };
    
    let currentNotes = {};
    try { currentNotes = JSON.parse(base.notes || "{}"); } catch(e) {}
    
    const noteKey = `${tipo}_${key}`;
    if (nota && nota.trim() !== "") {
      currentNotes[noteKey] = nota;
    } else {
      delete currentNotes[noteKey];
    }

    const actualizada = { 
      ...base, 
      status: estado || base.status, 
      income: { ...(base.income || {}) }, 
      expense: { ...(base.expense || {}) },
      notes: JSON.stringify(currentNotes)
    };

    if (tipo === "ingreso") actualizada.income[key] = Number(monto) || 0;
    else actualizada.expense[key] = Number(monto) || 0;

    const { error } = await supabase.from("cashflow_weeks").upsert(actualizada);
    if (error) { alert("Error al guardar el movimiento: " + error.message); return false; }
    await fetchWeeks();
    return true;
  };

  const eliminarMovimiento = async (fecha, tipo, key) => {
    const existente = weeks.find((w) => w.week_start === fecha);
    if (!existente) return;
    
    let currentNotes = {};
    try { currentNotes = JSON.parse(existente.notes || "{}"); } catch(e) {}
    delete currentNotes[`${tipo}_${key}`];

    const actualizada = { 
      ...existente, 
      income: { ...(existente.income || {}) }, 
      expense: { ...(existente.expense || {}) },
      notes: JSON.stringify(currentNotes)
    };

    if (tipo === "ingreso") delete actualizada.income[key];
    else delete actualizada.expense[key];
    
    const { error } = await supabase.from("cashflow_weeks").upsert(actualizada);
    if (error) { alert("Error al eliminar: " + error.message); return; }
    await fetchWeeks();
  };

  const moverMovimiento = async (origenFecha, destinoFecha, tipo, key, monto) => {
    if (origenFecha === destinoFecha) return;
    
    const origen = weeks.find((w) => w.week_start === origenFecha);
    let notaMovida = null;
    let upOrigen = null;

    if (origen) {
      upOrigen = { ...origen, income: { ...(origen.income || {}) }, expense: { ...(origen.expense || {}) } };
      const field = tipo === "ingreso" ? "income" : "expense";
      delete upOrigen[field][key];

      let origenNotes = {};
      try { origenNotes = JSON.parse(origen.notes || "{}"); } catch(e) {}
      const noteKey = `${tipo}_${key}`;
      if (origenNotes[noteKey]) {
        notaMovida = origenNotes[noteKey];
        delete origenNotes[noteKey];
      }
      upOrigen.notes = JSON.stringify(origenNotes);
      await supabase.from("cashflow_weeks").upsert(upOrigen);
    }

    const destino = weeks.find((w) => w.week_start === destinoFecha) || {
      id: destinoFecha, week_start: destinoFecha, status: "proyectado",
      saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0,
      income: {}, expense: {}, notes: "",
    };
    const upDestino = { ...destino, income: { ...(destino.income || {}) }, expense: { ...(destino.expense || {}) } };
    const field2 = tipo === "ingreso" ? "income" : "expense";
    upDestino[field2][key] = (upDestino[field2][key] || 0) + Number(monto);

    if (notaMovida) {
      let destinoNotes = {};
      try { destinoNotes = JSON.parse(destino.notes || "{}"); } catch(e) {}
      destinoNotes[`${tipo}_${key}`] = notaMovida;
      upDestino.notes = JSON.stringify(destinoNotes);
    }

    await supabase.from("cashflow_weeks").upsert(upDestino);
    await fetchWeeks();
  };

  const fieldFor = (grupo) => (grupo === "ingreso" ? "income" : "expense");

  const agregarConcepto = async (grupo, label) => {
    const field = fieldFor(grupo);
    const key = "custom_" + slugify(label);
    const anchor = new Date().toISOString().slice(0, 10);
    const existente = weeks.find((w) => w.week_start === anchor);
    const base = existente || {
      id: anchor, week_start: anchor, status: "proyectado",
      saldo_inicial: 0, saldo_bancos: 0, saldo_credimas: 0, income: {}, expense: {}, notes: "",
    };
    const actualizada = { ...base, income: { ...(base.income || {}) }, expense: { ...(base.expense || {}) } };
    if (actualizada[field][key] === undefined) actualizada[field][key] = 0;
    const { error } = await supabase.from("cashflow_weeks").upsert(actualizada);
    if (error) { alert("Error al crear el concepto: " + error.message); return false; }
    await fetchWeeks();
    return true;
  };

  const renombrarConcepto = async (grupo, oldKey, newLabel) => {
    const field = fieldFor(grupo);
    const newKey = "custom_" + slugify(newLabel);
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], oldKey));
    if (afectadas.length === 0) return agregarConcepto(grupo, newLabel);
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) };
      const val = obj[oldKey];
      delete obj[oldKey];
      obj[newKey] = val;
      return { ...w, [field]: obj };
    });
    const { error } = await supabase.from("cashflow_weeks").upsert(updates);
    if (error) { alert("Error al renombrar: " + error.message); return false; }
    await fetchWeeks();
    return true;
  };

  const eliminarConcepto = async (grupo, key) => {
    const field = fieldFor(grupo);
    const afectadas = weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], key));
    if (afectadas.length === 0) return true;
    const updates = afectadas.map((w) => {
      const obj = { ...(w[field] || {}) };
      delete obj[key];
      return { ...w, [field]: obj };
    });
    const { error } = await supabase.from("cashflow_weeks").upsert(updates);
    if (error) { alert("Error al eliminar: " + error.message); return false; }
    await fetchWeeks();
    return true;
  };

  const incomeCats = useMemo(() => discoverCategories(weeks, BASE_INCOME, "income"), [weeks]);
  const expenseCats = useMemo(() => discoverCategories(weeks, BASE_EXPENSE, "expense"), [weeks]);
  
  const procesadas = useMemo(() => {
    const fechasSet = new Set(weeks.map((w) => w.week_start));
    if (fechaSaldo) fechasSet.add(fechaSaldo);
    const fechasArray = Array.from(fechasSet).sort();
    let acumuladoActual = 0;
    let saldoFijado = false;

    return fechasArray.map((fecha) => {
      const w = weeks.find((week) => week.week_start === fecha) || { income: {}, expense: {}, notes: "{}" };
      const ing = Object.values(w.income || {}).reduce((a, b) => a + Number(b || 0), 0);
      const eg = Object.values(w.expense || {}).reduce((a, b) => a + Number(b || 0), 0);
      const pos = ing - eg;
      
      let parsedNotes = {};
      try { parsedNotes = JSON.parse(w.notes || "{}"); } catch(e) {}

      if (fechaSaldo && fecha === fechaSaldo) {
        acumuladoActual = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
        saldoFijado = true;
      } else if (!fechaSaldo && !saldoFijado) {
        acumuladoActual = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
        saldoFijado = true;
      }
      acumuladoActual += pos;
      return { ...w, week_start: fecha, totalIngresos: ing, totalEgresos: eg, posicion: pos, saldoAcumulado: acumuladoActual, parsedNotes };
    });
  }, [weeks, saldoEfectivo, saldoBanco, fechaSaldo]);

  const kpis = useMemo(() => {
    if (procesadas.length === 0) return null;
    const hoy = todayISO();
    const saldoInicialReal = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
    const pasadas = procesadas.filter((w) => w.week_start <= hoy);
    const futuras = procesadas.filter((w) => w.week_start > hoy);
    const saldoHoy = pasadas.length ? pasadas[pasadas.length - 1].saldoAcumulado : saldoInicialReal;

    let diasDeCaja = null, deficitActual = false, sinQuemaNeta = false;
    if (saldoHoy < 0) {
      deficitActual = true;
    } else if (futuras.length === 0) {
      sinQuemaNeta = true;
    } else {
      const ingresosFuturos = futuras.reduce((acc, cur) => acc + cur.totalIngresos, 0);
      const egresosFuturos = futuras.reduce((acc, cur) => acc + cur.totalEgresos, 0);
      const flujoNetoFuturo = ingresosFuturos - egresosFuturos;
      if (flujoNetoFuturo >= 0) {
        sinQuemaNeta = true;
      } else {
        const fechaFin = new Date(futuras[futuras.length - 1].week_start);
        const fechaHoyD = new Date(hoy);
        let diasRestantes = (fechaFin.getTime() - fechaHoyD.getTime()) / (1000 * 3600 * 24);
        if (diasRestantes <= 0) diasRestantes = 1;
        const quemaDiaria = Math.abs(flujoNetoFuturo) / diasRestantes;
        diasDeCaja = quemaDiaria > 0 ? Math.round(saldoHoy / quemaDiaria) : null;
      }
    }

    const semanaDeficit = procesadas.find((w) => w.week_start >= hoy && w.saldoAcumulado < 0);
    const diaDeficit = semanaDeficit ? semanaDeficit.week_start : "Sin déficit";
    const ultimaFecha = procesadas[procesadas.length - 1].week_start;
    const ultimoMes = ultimaFecha.substring(0, 7);
    const datosUltimoMes = procesadas.filter((w) => w.week_start.startsWith(ultimoMes));
    const flujoUltimoMes = datosUltimoMes.reduce((acc, cur) => acc + cur.totalIngresos, 0) - datosUltimoMes.reduce((acc, cur) => acc + cur.totalEgresos, 0);
    const nofAnual = (flujoUltimoMes < 0 ? Math.abs(flujoUltimoMes) : 0) * 12;

    return { diasDeCaja, deficitActual, sinQuemaNeta, diaDeficit, nofMensual: nofAnual / 12, nofAnual, liquidez: saldoHoy };
  }, [procesadas, saldoEfectivo, saldoBanco]);

  const semanas13 = useSemanas13(procesadas, fechaSaldo, saldoEfectivo, saldoBanco);

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: tokens.ink, color: "#fff", fontFamily: tokens.fontBody }}>
        <style>{fontImport}</style>
        Iniciando entorno seguro…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.paper, fontFamily: tokens.fontBody, color: tokens.text }}>
      <style>{globalStyles}</style>

      {/* ---------- RIEL DE INSTRUMENTOS (SIDEBAR) ---------- */}
      <aside style={{ width: 232, flexShrink: 0, background: tokens.ink, color: "#fff", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        
        {/* NUEVA CABECERA CON LA IMAGEN "LINK" */}
        <div style={{ borderBottom: `1px solid ${tokens.inkRule}` }}>
          <img 
            src="/link-banner.png" 
            alt="LINK" 
            style={{ 
              width: "100%", 
              height: "85px", 
              objectFit: "cover", 
              objectPosition: "left center", // Esto asegura que el cuadradito de LINK se vea perfecto
              display: "block" 
            }} 
          />
          <div style={{ padding: "14px 20px 16px" }}>
            <div style={{ fontFamily: tokens.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: "0.2px" }}>Cashflow</div>
            <div style={{ fontSize: 11, color: "#8590A6", marginTop: 2, letterSpacing: "0.3px" }}>Azlepi · Sigma</div>
          </div>
        </div>

        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${tokens.inkRule}` }}>
          <div style={{ fontSize: 10, color: "#6B7690", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700, marginBottom: 6 }}>Liquidez actual</div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 600, color: kpis && kpis.liquidez < 0 ? "#E0897A" : "#fff" }}>
            $ {kpis ? fmt(kpis.liquidez) : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#6B7690", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700, margin: "14px 0 6px" }}>Días de caja</div>
          <div style={{ fontFamily: tokens.fontMono, fontSize: 20, fontWeight: 600, color: kpis?.deficitActual ? "#E0897A" : kpis?.sinQuemaNeta ? "#7FD9BE" : "#fff" }}>
            {!kpis ? "—" : kpis.deficitActual ? "Déficit" : kpis.sinQuemaNeta ? "Sin quema" : `${kpis.diasDeCaja} d.`}
          </div>
        </div>

        <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                className="nav-item"
                onClick={() => setTab(n.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6,
                  border: "none", cursor: "pointer", textAlign: "left", fontFamily: tokens.fontBody,
                  fontSize: 13.5, fontWeight: active ? 600 : 500,
                  background: active ? tokens.inkSoft : "transparent",
                  color: active ? "#fff" : "#9AA3B8",
                }}
              >
                <Icon size={16} /> {n.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ---------- CANVAS ---------- */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        
        {tab === "resumen" && <ResumenTab procesadas={procesadas} kpis={kpis} fmt={fmt} />}
        {tab === "semanas13" && <Cash13Semanas semanas={semanas13} fmt={fmt} />}

        {tab === "plan-fondos" && (
          <PlanDeFondosTab incomeCats={incomeCats} expenseCats={expenseCats} />
        )}

        {tab === "movimientos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setMostrarPanel(!mostrarPanel)}
                style={{ 
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", 
                  background: mostrarPanel ? tokens.surface : tokens.ink, 
                  color: mostrarPanel ? tokens.text : "#fff", 
                  border: `1px solid ${mostrarPanel ? colorLineaFuerte : tokens.ink}`, 
                  borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13,
                  transition: "all 0.2s"
                }}
              >
                {mostrarPanel ? "Ocultar panel de carga" : "+ Cargar movimiento"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: mostrarPanel ? "340px 1fr" : "1fr", gap: 20, alignItems: "start", transition: "all 0.3s" }}>
              {mostrarPanel && (
                <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22, position: "sticky", top: 32 }}>
                  <CargarMovimiento incomeCats={incomeCats} expenseCats={expenseCats} weeks={weeks} onGuardar={guardarMovimiento} onEliminar={eliminarMovimiento} />
                </div>
              )}
              <FlujoTable procesadas={procesadas} incomeCats={incomeCats} expenseCats={expenseCats} fmt={fmt} onMoverMovimiento={moverMovimiento} />
            </div>
          </div>
        )}

        {tab === "conceptos" && (
          <CategoryManager incomeCats={incomeCats} expenseCats={expenseCats} weeks={weeks} onAdd={agregarConcepto} onRename={renombrarConcepto} onDelete={eliminarConcepto} />
        )}

        {tab === "configuracion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Configuración</h2>
              <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Punto de partida del cálculo y herramientas avanzadas.</p>
            </div>

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Settings size={16} color={tokens.textMuted} />
                <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>Punto de partida (saldos reales)</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <Field label="Fecha de corte">
                  <input type="date" value={fechaSaldo} onChange={(e) => setFechaSaldo(e.target.value)} style={fieldInputStyle} />
                </Field>
                <Field label="Efectivo ($)">
                  <input type="number" value={saldoEfectivo} onChange={(e) => setSaldoEfectivo(e.target.value)} style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} />
                </Field>
                <Field label="Bancos ($)">
                  <input type="number" value={saldoBanco} onChange={(e) => setSaldoBanco(e.target.value)} style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} />
                </Field>
              </div>
              <button onClick={guardarSaldos} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                <Save size={15} /> Guardar
              </button>
            </div>

            <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 4 }}>
              <ImportadorCashflow baseIncome={BASE_INCOME} baseExpense={BASE_EXPENSE} onImportarSemanas={handleImportarSemanas} onBorrarDatos={handleBorrarDatos} semanasExistentes={weeks} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const fieldInputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${colorLineaFuerte}`, borderRadius: 5, fontSize: 13, fontFamily: tokens.fontBody, outline: "none", boxSizing: "border-box" };

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10.5, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }) {
  const color = tone === "neg" ? tokens.negative : tone === "pos" ? tokens.positive : tokens.text;
  return (
    <div style={{ background: tokens.surface, padding: "20px 22px", borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontFamily: tokens.fontMono, fontSize: 25, fontWeight: 600, color, marginTop: 6, letterSpacing: "-0.5px" }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: tokens.textFaint, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ background: tokens.paper, padding: 10, borderRadius: 8, color }}>
        <Icon size={19} />
      </div>
    </div>
  );
}

function ResumenTab({ procesadas, kpis, fmt }) {
  if (procesadas.length === 0) return (<div style={{ textAlign: "center", padding: "100px 20px", background: tokens.surface, borderRadius: 10, border: `1px dashed ${colorLineaFuerte}` }}>Sin datos cargados.</div>);
  return (
    <>
      <div><h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Resumen</h2></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        <KpiCard icon={Wallet} label="Días de caja" value={kpis.deficitActual ? "Déficit" : kpis.sinQuemaNeta ? "Sin quema" : `${kpis.diasDeCaja} días`} tone={kpis.deficitActual || (kpis.diasDeCaja != null && kpis.diasDeCaja <= 15) ? "neg" : "pos"} />
        <KpiCard icon={CalendarX2} label="Día de déficit" value={kpis.diaDeficit} tone={kpis.diaDeficit !== "Sin déficit" ? "neg" : "pos"} />
        <KpiCard icon={AlertTriangle} label="NOF mensual" value={`$ ${fmt(kpis.nofMensual)}`} tone={kpis.nofMensual > 0 ? "neg" : "pos"} />
      </div>
      <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, padding: 24 }}>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={procesadas.map((w) => ({ name: w.week_start, saldo: w.saldoAcumulado }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colorLineaSuave} />
              <XAxis dataKey="name" tick={{ fill: tokens.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: tokens.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} dx={-6} width={72} />
              <Tooltip formatter={(v) => ["$ " + fmt(v), "Saldo"]} />
              <Area type="monotone" dataKey="saldo" stroke={tokens.positive} strokeWidth={2.5} fill={tokens.positive} fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function PlanDeFondosTab({ incomeCats, expenseCats }) {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Plan de Fondos 2026</h2>
        <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Presupuesto anual estimado mes a mes. Próximamente lo conectaremos a la base de datos.</p>
      </div>
      
      <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden" }}>
         <div className="table-container" style={{ overflowX: "auto", paddingBottom: 8 }}>
            <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap", background: colorTablaBg }}>
              <thead>
                <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${colorLineaFuerte}` }}>
                  <th className="sticky-col" style={{ padding: 14, textAlign: "left", minWidth: 200, background: colorTablaBg }}>Concepto</th>
                  {meses.map(m => (
                    <th key={m} style={{ padding: 14, textAlign: "right", minWidth: 90, fontFamily: tokens.fontMono }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={13} style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, background: colorTablaBg }}>INGRESOS</td>
                </tr>
                {incomeCats.map(c => (
                   <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                      <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                      {meses.map(m => (
                        <td key={m} style={{ padding: "9px 14px", textAlign: "right", color: tokens.textFaint, fontFamily: tokens.fontMono }}>$ 0</td>
                      ))}
                   </tr>
                ))}

                <tr>
                  <td colSpan={13} style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, background: colorTablaBg, borderTop: `2px solid ${colorLineaFuerte}` }}>EGRESOS</td>
                </tr>
                {expenseCats.map(c => (
                   <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                      <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                      {meses.map(m => (
                        <td key={m} style={{ padding: "9px 14px", textAlign: "right", color: tokens.textFaint, fontFamily: tokens.fontMono }}>$ 0</td>
                      ))}
                   </tr>
                ))}
              </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

function FlujoTable({ procesadas, incomeCats, expenseCats, fmt, onMoverMovimiento }) {
  const [verIngresos, setVerIngresos] = useState(true);
  const [verEgresos, setVerEgresos] = useState(true);

  const handleDragStart = (e, origenFecha, tipo, key, monto) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ origenFecha, tipo, key, monto }));
  };

  const handleDrop = (e, destinoFecha, targetTipo, targetKey) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.tipo !== targetTipo || data.key !== targetKey) {
        alert("Solo puedes mover el importe a otra fecha del mismo concepto.");
        return;
      }
      onMoverMovimiento(data.origenFecha, destinoFecha, data.tipo, data.key, data.monto);
    } catch (err) { console.error("Error al mover:", err); }
  };

  return (
    <div style={{ background: colorTablaBg, borderRadius: 10, border: `1px solid ${colorLineaFuerte}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colorLineaFuerte}`, background: colorTablaBg }}>
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 15, fontWeight: 600 }}>Desglose de flujos</h3>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: tokens.textMuted }}>* Arrastra montos o pasa el mouse sobre ellos para ver las notas.</p>
      </div>
      <div className="table-container" style={{ overflowX: "auto", paddingBottom: 8 }}>
        <table className="flujo-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap", background: colorTablaBg }}>
          <thead>
            <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${colorLineaFuerte}` }}>
              <th className="sticky-col" style={{ padding: 14, textAlign: "left", minWidth: 200, background: colorTablaBg }}>Concepto</th>
              {procesadas.map((w, i) => (
                <th key={i} style={{ padding: 14, textAlign: "right", minWidth: 104, fontFamily: tokens.fontMono }}>{w.week_start}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            
            <tr onClick={() => setVerIngresos(!verIngresos)} style={{ cursor: "pointer", background: colorTablaBg }}>
              <td className="sticky-col" style={{ padding: "20px 14px 8px", fontWeight: 800, color: tokens.positive, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                {verIngresos ? <ChevronDown size={14} /> : <ChevronRight size={14} />} INGRESOS
              </td>
              <td colSpan={procesadas.length}></td>
            </tr>

            {verIngresos && incomeCats.map((c) => (
              <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                {procesadas.map((w, i) => {
                  const monto = w.income?.[c.key] || 0;
                  const nota = w.parsedNotes?.[`ingreso_${c.key}`];
                  return (
                    <td key={i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, w.week_start, "ingreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104 }}>
                      {monto > 0 ? (
                        <div className="draggable-chip" draggable onDragStart={(e) => handleDragStart(e, w.week_start, "ingreso", c.key, monto)}
                          title={nota || undefined}
                          style={{ position: "relative", cursor: "grab", background: "#F0FDF4", border: "1px dashed #BBF7D0", borderRadius: 4, padding: "4px 8px", display: "inline-block", color: tokens.positive, fontFamily: tokens.fontMono, transition: "all 0.15s" }}
                        >
                          {fmt(monto)}
                          {nota && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: tokens.gold, borderRadius: '50%', border: '1px solid #fff' }} />}
                        </div>
                      ) : <span style={{ color: colorLineaFuerte, fontFamily: tokens.fontMono }}>-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <TotalRow label="Total ingresos" data={procesadas} field="totalIngresos" color={tokens.positive} fmt={fmt} />

            <tr onClick={() => setVerEgresos(!verEgresos)} style={{ cursor: "pointer", background: colorTablaBg }}>
              <td className="sticky-col" style={{ padding: "28px 14px 8px", fontWeight: 800, color: tokens.negative, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                {verEgresos ? <ChevronDown size={14} /> : <ChevronRight size={14} />} EGRESOS
              </td>
              <td colSpan={procesadas.length}></td>
            </tr>

            {verEgresos && expenseCats.map((c) => (
              <tr key={c.key} className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaSuave}` }}>
                <td className="sticky-col" style={{ padding: "9px 14px 9px 34px", color: tokens.textMuted, background: colorTablaBg }}>{c.label}</td>
                {procesadas.map((w, i) => {
                  const monto = w.expense?.[c.key] || 0;
                  const nota = w.parsedNotes?.[`egreso_${c.key}`];
                  return (
                    <td key={i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, w.week_start, "egreso", c.key)} style={{ padding: "6px 14px", textAlign: "right", minWidth: 104 }}>
                      {monto > 0 ? (
                        <div className="draggable-chip" draggable onDragStart={(e) => handleDragStart(e, w.week_start, "egreso", c.key, monto)}
                          title={nota || undefined}
                          style={{ position: "relative", cursor: "grab", background: "#FEF2F2", border: "1px dashed #FECACA", borderRadius: 4, padding: "4px 8px", display: "inline-block", color: tokens.negative, fontFamily: tokens.fontMono, transition: "all 0.15s" }}
                        >
                          {fmt(monto)}
                          {nota && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: tokens.gold, borderRadius: '50%', border: '1px solid #fff' }} />}
                        </div>
                      ) : <span style={{ color: colorLineaFuerte, fontFamily: tokens.fontMono }}>-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <TotalRow label="Total egresos" data={procesadas} field="totalEgresos" color={tokens.negative} fmt={fmt} />

            <tr className="flujo-row" style={{ borderBottom: `1px solid ${colorLineaFuerte}` }}>
              <td className="sticky-col" style={{ padding: "16px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>Flujo neto</td>
              {procesadas.map((w, i) => (
                <td key={i} style={{ padding: "16px 14px", textAlign: "right", fontWeight: 700, fontFamily: tokens.fontMono, background: colorTotalBg, color: w.posicion >= 0 ? tokens.positive : tokens.negative }}>{fmt(w.posicion)}</td>
              ))}
            </tr>
            <tr className="flujo-row">
              <td className="sticky-col" style={{ padding: "18px 14px", fontWeight: 700, background: tokens.ink, color: "#fff" }}>Saldo acumulado</td>
              {procesadas.map((w, i) => (
                <td key={i} style={{ padding: "18px 14px", textAlign: "right", fontWeight: 700, background: tokens.ink, color: "#fff", fontFamily: tokens.fontMono }}>{fmt(w.saldoAcumulado)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalRow({ label, data, field, color, fmt }) {
  return (
    <tr className="flujo-row" style={{ borderBottom: `2px solid ${colorLineaFuerte}` }}>
      <td className="sticky-col" style={{ padding: "12px 14px", fontWeight: 700, color: tokens.text, background: colorTotalBg }}>{label}</td>
      {data.map((w, i) => (
        <td key={i} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color, background: colorTotalBg, fontFamily: tokens.fontMono }}>{fmt(w[field])}</td>
      ))}
    </tr>
  );
}
