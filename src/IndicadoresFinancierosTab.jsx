import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tokens } from "./tokens";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { RefreshCw, AlertTriangle, Pencil, Save, TrendingUp } from "lucide-react";

const colorLineaSuave = "#DCE1E8";
const colorLineaFuerte = "#C2CAD4";
const colorTablaBg = "#F4F6F8";

const fmtNum = (v, dec = 1) => {
  if (v == null || v === "") return "—";
  return Number(v).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtMiles = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return fmtNum(n >= 1000 ? n / 1000 : n, 1) + " mil";
};
const isStale = (savedAt) => {
  if (!savedAt) return false;
  return (Date.now() - new Date(savedAt).getTime()) / (1000 * 60 * 60 * 24) > 45;
};
const monthScore = (mesStr) => {
  if (!mesStr) return 0;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const s = mesStr.toLowerCase();
  let m = 0;
  meses.forEach((n, i) => { if (s.includes(n)) m = i + 1; });
  const match = s.match(/\d{4}/) || s.match(/\d{2}/);
  let y = match ? parseInt(match[0]) : 0;
  if (y && y < 100) y += 2000;
  return y * 100 + m;
};

/* ═══════ Dólar ═══════ */
const DOLAR_TIPOS = [
  { slug: "blue", label: "Blue", color: tokens.gold },
  { slug: "bolsa", label: "MEP", color: "#6B5FA6" },
  { slug: "contadoconliqui", label: "CCL", color: "#C97B3D" },
  { slug: "oficial", label: "Oficial", color: tokens.positive },
  { slug: "cripto", label: "Cripto", color: "#B8862A" },
  { slug: "mayorista", label: "Mayorista", color: "#A6588E" },
];

/* ═══════ Indicadores BCRA (vía /api/proxy) ═══════ */
const BCRA_CFG = {
  ipc:           { endpoint: "ipc", label: "IPC Mensual", unit: "%" },
  ipcInteranual: { endpoint: "ipcInteranual", label: "IPC Interanual", unit: "%" },
  badlar:        { endpoint: "badlar", label: "Tasa BADLAR", unit: "%" },
  riesgoPais:    { endpoint: "riesgoPais", label: "Riesgo País (EMBI)", unit: "pb" },
  reservas:      { endpoint: "reservas", label: "Reservas BCRA", unit: "USD M" },
};

/* ═══════ Histórico CAC (referencia fija, igual al Monitor Económico) ═══════ */
const HIST_CAC = [
  { mes: "Jul-25", valor: 16939.5 }, { mes: "Ago-25", valor: 17187.6 }, { mes: "Sep-25", valor: 17762.3 },
  { mes: "Oct-25", valor: 18172.8 }, { mes: "Nov-25", valor: 18534.9 }, { mes: "Dic-25", valor: 18776.5 },
  { mes: "Ene-26", valor: 19209.4 }, { mes: "Feb-26", valor: 19453.0 }, { mes: "Mar-26", valor: 19771.2 },
  { mes: "Abr-26", valor: 20493.2 }, { mes: "May-26", valor: 21035.6 }, { mes: "Jun-26", valor: 21641.1 },
  { mes: "Jul-26", valor: 21960.7 },
];
const HIST_MAT = [
  { mes: "Jul-25", valor: 19141.7 }, { mes: "Ago-25", valor: 19490.0 }, { mes: "Sep-25", valor: 20187.5 },
  { mes: "Oct-25", valor: 20740.8 }, { mes: "Nov-25", valor: 21055.9 }, { mes: "Dic-25", valor: 21335.3 },
  { mes: "Ene-26", valor: 21778.0 }, { mes: "Feb-26", valor: 22007.9 }, { mes: "Mar-26", valor: 22204.2 },
  { mes: "Abr-26", valor: 22870.0 }, { mes: "May-26", valor: 23500.2 }, { mes: "Jun-26", valor: 23901.9 },
  { mes: "Jul-26", valor: 24149.4 },
];
const HIST_MO = [
  { mes: "Jul-25", valor: 13711.8 }, { mes: "Ago-25", valor: 13812.6 }, { mes: "Sep-25", valor: 14207.5 },
  { mes: "Oct-25", valor: 14408.8 }, { mes: "Nov-25", valor: 14839.9 }, { mes: "Dic-25", valor: 15026.2 },
  { mes: "Ene-26", valor: 15444.4 }, { mes: "Feb-26", valor: 15708.2 }, { mes: "Mar-26", valor: 16205.2 },
  { mes: "Abr-26", valor: 17009.6 }, { mes: "May-26", valor: 17423.2 }, { mes: "Jun-26", valor: 18327.3 },
  { mes: "Jul-26", valor: 18752.8 },
];
const CAC_META = {
  cac: { label: "Índice CAC — Costo Construcción", hist: HIST_CAC },
  mat: { label: "Índice CAC — Costo Materiales", hist: HIST_MAT },
  mo:  { label: "Índice CAC — Mano de Obra", hist: HIST_MO },
};

/* ═══════ Sparkline reutilizable (recharts) ═══════ */
function Sparkline({ data, color, height = 46 }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ height, marginTop: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            contentStyle={{ fontSize: 11, fontFamily: tokens.fontBody, border: `1px solid ${colorLineaFuerte}`, borderRadius: 6 }}
            labelFormatter={() => ""}
            formatter={(v) => [fmtNum(v, 1), ""]}
          />
          <Area type="monotone" dataKey="valor" stroke={color} strokeWidth={1.75} fill={`url(#grad-${color.replace("#", "")})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10.5, letterSpacing: "0.6px", textTransform: "uppercase", color: tokens.textFaint, fontWeight: 700, margin: "6px 0 14px" }}>
      {children}
      <div style={{ flex: 1, height: 1, background: colorLineaSuave }} />
    </div>
  );
}

function Card({ children, accent }) {
  return (
    <div style={{ background: tokens.surface, border: `1px solid ${colorLineaFuerte}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />}
      {children}
    </div>
  );
}

export default function IndicadoresFinancierosTab() {
  const [dolares, setDolares] = useState([]);
  const [macro, setMacro] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const [cac, setCac] = useState({});
  const [h21, setH21] = useState([]);
  const [formOpen, setFormOpen] = useState({});
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState("");

  const fetchDolares = useCallback(async () => {
    try {
      const r = await fetch("https://dolarapi.com/v1/dolares");
      if (!r.ok) throw new Error();
      setDolares(await r.json());
    } catch {
      setError("No se pudieron cargar las cotizaciones del dólar.");
    }
  }, []);

  const fetchMacro = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(BCRA_CFG).map(async ([key, cfg]) => {
        try {
          const r = await fetch(`/api/proxy?endpoint=${cfg.endpoint}`);
          if (!r.ok) throw new Error();
          const json = await r.json();
          return [key, json.results || []];
        } catch {
          return [key, []];
        }
      })
    );
    setMacro(Object.fromEntries(entries));
  }, []);

  const loadCAC = useCallback(async () => {
    const { data } = await supabase.from("cf_cac_indicadores").select("*");
    const byKey = {};
    (data || []).forEach((row) => { byKey[row.indicador] = row; });
    setCac(byKey);
  }, []);

  const loadH21 = useCallback(async () => {
    const { data } = await supabase.from("cf_h21_precios").select("*").order("id_mes", { ascending: true });
    setH21(data || []);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchDolares(), fetchMacro(), loadCAC(), loadH21()]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [fetchDolares, fetchMacro, loadCAC, loadH21]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleForm = (id) => setFormOpen((p) => ({ ...p, [id]: !p[id] }));

  const saveCAC = async (id) => {
    const d = draft[id] || {};
    const valor = parseFloat(d.valor);
    if (!valor) return;
    const variacion = d.variacion ? parseFloat(d.variacion) : null;
    const mes = d.mes || "";
    const row = { indicador: id, valor, variacion, mes, updated_at: new Date().toISOString() };
    await supabase.from("cf_cac_indicadores").upsert(row);
    setCac((p) => ({ ...p, [id]: row }));
    toggleForm(id);
    setToast(`${id.toUpperCase()} actualizado`);
    setTimeout(() => setToast(""), 2500);
  };

  const saveH21 = async () => {
    const d = draft.h21 || {};
    let rawVal = parseFloat(d.valor);
    if (!d.mes || isNaN(rawVal)) return;
    const valor = rawVal < 1000 ? rawVal * 1000 : rawVal;
    const row = { id_mes: d.mes, etiqueta: d.label || d.mes, valor, updated_at: new Date().toISOString() };
    await supabase.from("cf_h21_precios").upsert(row);
    setH21((p) => [...p.filter((x) => x.id_mes !== row.id_mes), row].sort((a, b) => a.id_mes.localeCompare(b.id_mes)));
    toggleForm("h21");
    setDraft((p) => ({ ...p, h21: {} }));
    setToast("Hormigón H-21 actualizado");
    setTimeout(() => setToast(""), 2500);
  };

  const setD = (id, field, value) => setDraft((p) => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } }));

  /* ── H21 stats ── */
  const h21Last = h21[h21.length - 1];
  const h21First = h21[0];
  const h21Prev = h21.length > 1 ? h21[h21.length - 2] : null;
  const h21VarMes = h21Prev ? ((h21Last.valor - h21Prev.valor) / h21Prev.valor) * 100 : null;
  const h21VarAcum = h21First ? ((h21Last?.valor - h21First.valor) / h21First.valor) * 100 : null;
  const h21Vals = h21.map((d) => d.valor);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600 }}>Indicadores Financieros</h2>
          <div style={{ fontSize: 11.5, color: tokens.textFaint }}>
            {loading ? "Actualizando…" : lastUpdate ? `Última actualización: ${lastUpdate.toLocaleTimeString("es-AR")}` : ""}
          </div>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "transparent", border: `1px solid ${tokens.gold}`, color: tokens.gold, borderRadius: 6, fontWeight: 600, fontSize: 12.5, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: tokens.negativeSoft, border: `1px solid ${tokens.negative}33`, color: tokens.negative, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* ═══ DÓLAR ═══ */}
      <SectionLabel>Cotizaciones del Dólar</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 12, marginBottom: 8 }}>
        {DOLAR_TIPOS.map((t) => {
          const d = dolares.find((x) => x.casa === t.slug);
          const venta = d?.venta ? "$" + fmtNum(d.venta, 0) : "—";
          const compra = d?.compra ? "$" + fmtNum(d.compra, 0) : "—";
          return (
            <Card key={t.slug} accent={t.color}>
              <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint, marginBottom: 8 }}>USD {t.label}</div>
              <div style={{ fontFamily: tokens.fontDisplay, fontSize: 24, color: t.color, fontWeight: 600 }}>{venta}</div>
              <div style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 4 }}>compra {compra}</div>
            </Card>
          );
        })}
      </div>

      {/* ═══ MACRO ═══ */}
      <SectionLabel>Indicadores Macroeconómicos BCRA · últimos 12 meses</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: 12, marginBottom: 8 }}>
        {Object.entries(BCRA_CFG).map(([key, cfg]) => {
          const series = macro[key] || [];
          const last = series[series.length - 1];
          let display = "—", sub = "";
          if (last) {
            if (key === "reservas") { display = `USD ${fmtNum(last.valor / 1000, 1)}B`; sub = `Millones · ${last.fecha}`; }
            else if (key === "riesgoPais") { display = `${fmtNum(last.valor, 0)} pb`; sub = `EMBI · ${last.fecha}`; }
            else { display = `${fmtNum(last.valor, 1)}%`; sub = `Dato: ${last.fecha}`; }
          }
          return (
            <Card key={key} accent={tokens.gold}>
              <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint }}>{cfg.label}</div>
              <div style={{ fontFamily: tokens.fontDisplay, fontSize: 26, fontWeight: 600, color: tokens.text, marginTop: 6 }}>{display}</div>
              <div style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 2 }}>{sub}</div>
              <Sparkline data={series} color={tokens.gold} />
            </Card>
          );
        })}
      </div>

      {/* ═══ CAC ═══ */}
      <SectionLabel>Índice CAC — Costo de la Construcción · carga mensual</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12, marginBottom: 8 }}>
        {Object.entries(CAC_META).map(([id, meta]) => {
          const data = cac[id] || {};
          const hist = meta.hist;
          const open = !!formOpen[id];
          return (
            <Card key={id} accent={tokens.gold}>
              <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint, marginBottom: 10 }}>{meta.label}</div>
              <div style={{ fontFamily: tokens.fontDisplay, fontSize: 26, color: tokens.gold, fontWeight: 600 }}>{fmtNum(data.valor ?? hist[hist.length - 1].valor, 1)}</div>
              <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4, marginBottom: 6 }}>
                {(data.mes || "Julio 2026")}{data.variacion != null ? ` · ${data.variacion > 0 ? "+" : ""}${data.variacion}% mensual` : ""}
              </div>
              {isStale(data.updated_at) && (
                <div style={{ fontSize: 10.5, color: tokens.negative, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={12} /> Dato con más de 45 días
                </div>
              )}
              <Sparkline data={hist} color={tokens.gold} />
              <button onClick={() => toggleForm(id)} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                <Pencil size={12} /> Actualizar dato
              </button>
              {open && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" step="0.1" placeholder="Valor (puntos)" defaultValue={data.valor} onChange={(e) => setD(id, "valor", e.target.value)} style={inputStyle} />
                    <input type="number" step="0.1" placeholder="Var. mensual %" defaultValue={data.variacion} onChange={(e) => setD(id, "variacion", e.target.value)} style={inputStyle} />
                  </div>
                  <input type="text" placeholder="Período (ej: Agosto 2026)" defaultValue={data.mes} onChange={(e) => setD(id, "mes", e.target.value)} style={inputStyle} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveCAC(id)} style={saveBtnStyle}><Save size={13} /> Guardar</button>
                    <button onClick={() => toggleForm(id)} style={cancelBtnStyle}>Cancelar</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ═══ HORMIGÓN H-21 ═══ */}
      <SectionLabel>Hormigón Elaborado H-21 · precio m³ (en miles) · carga mensual</SectionLabel>
      <Card accent={tokens.gold}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 28, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint, marginBottom: 8 }}>Hormigón H-21 — Precio m³</div>
            <div style={{ fontFamily: tokens.fontDisplay, fontSize: 30, color: tokens.gold, fontWeight: 600 }}>{h21Last ? "$ " + fmtMiles(h21Last.valor) : "—"}</div>
            <div style={{ fontSize: 10.5, color: tokens.textMuted, marginBottom: 4 }}>ARS (en miles) por m³ · ref. proveedor</div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 14 }}>{h21Last ? `Último dato: ${h21Last.etiqueta || h21Last.id_mes}` : "Cargando…"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <StatBox label="Var. mensual" value={h21VarMes != null ? `${h21VarMes >= 0 ? "+" : ""}${fmtNum(h21VarMes, 1)}%` : "—"} />
              <StatBox label="Var. acumulada" value={h21VarAcum != null ? `${h21VarAcum >= 0 ? "+" : ""}${fmtNum(h21VarAcum, 1)}%` : "—"} />
              <StatBox label="Mínimo serie" value={h21Vals.length ? "$ " + fmtMiles(Math.min(...h21Vals)) : "—"} />
              <StatBox label="Máximo serie" value={h21Vals.length ? "$ " + fmtMiles(Math.max(...h21Vals)) : "—"} />
            </div>
            <button onClick={() => toggleForm("h21")} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
              <Pencil size={12} /> Agregar mes
            </button>
            {formOpen.h21 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" placeholder="Mes (YYYY-MM)" onChange={(e) => setD("h21", "mes", e.target.value)} style={inputStyle} />
                  <input type="text" placeholder="Etiqueta (ej: Ago 2026)" onChange={(e) => setD("h21", "label", e.target.value)} style={inputStyle} />
                </div>
                <input type="number" step="0.1" placeholder="Valor ($ en miles o total)" onChange={(e) => setD("h21", "valor", e.target.value)} style={inputStyle} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveH21} style={saveBtnStyle}><Save size={13} /> Guardar</button>
                  <button onClick={() => toggleForm("h21")} style={cancelBtnStyle}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint, marginBottom: 8 }}>Evolución precio H-21 (en miles $)</div>
            <Sparkline data={h21} color={tokens.gold} height={140} />
          </div>
        </div>
      </Card>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: tokens.ink, color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={14} color={tokens.positive} /> {toast}
        </div>
      )}

      <div style={{ fontSize: 9.5, color: tokens.textFaint, lineHeight: 1.9, borderTop: `1px solid ${colorLineaSuave}`, paddingTop: 16, marginTop: 8 }}>
        <div>AUTOMÁTICO — dolarapi.com · api.bcra.gob.ar (BCRA) · Riesgo País vía api.argentinadatos.com</div>
        <div>MANUAL MENSUAL — CAC (camarco.org.ar, publicación aprox. día 20) · Hormigón H-21 (ref. proveedor)</div>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background: colorTablaBg, border: `1px solid ${colorLineaSuave}`, borderRadius: 8, padding: "9px 12px" }}>
      <div style={{ fontSize: 8.5, letterSpacing: "1px", textTransform: "uppercase", color: tokens.textFaint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: tokens.fontDisplay, fontSize: 14, color: tokens.gold }}>{value}</div>
    </div>
  );
}

const inputStyle = { flex: 1, padding: "7px 10px", border: `1px solid ${colorLineaFuerte}`, borderRadius: 5, fontSize: 12, fontFamily: tokens.fontBody, outline: "none" };
const saveBtnStyle = { display: "flex", alignItems: "center", gap: 6, background: tokens.goldSoft, border: `1px solid ${tokens.gold}66`, color: tokens.gold, borderRadius: 6, padding: "7px 14px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const cancelBtnStyle = { background: "transparent", border: `1px solid ${colorLineaFuerte}`, color: tokens.textMuted, borderRadius: 6, padding: "7px 14px", fontSize: 11.5, cursor: "pointer" };
