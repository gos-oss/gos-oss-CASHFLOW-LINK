import React, { useState, useMemo, useEffect } from "react";
import { PlusCircle, Pencil, Trash2, ListChecks, MessageSquareText } from "lucide-react";
import { tokens } from "./tokens";

export default function CargarMovimiento({ incomeCats, expenseCats, weeks, onGuardar, onEliminar }) {
  const [tipo, setTipo] = useState("ingreso");
  const [conceptoKey, setConceptoKey] = useState("");
  const [fecha, setFecha] = useState("");
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState("proyectado");
  const [nota, setNota] = useState(""); // NUEVO ESTADO PARA LA OBSERVACIÓN
  const [saving, setSaving] = useState(false);

  const catalogo = tipo === "ingreso" ? incomeCats : expenseCats;

  const semanaSeleccionada = useMemo(
    () => weeks.find((w) => w.week_start === fecha),
    [weeks, fecha]
  );

  const movimientosDelDia = useMemo(() => {
    if (!semanaSeleccionada) return [];
    const items = [];
    
    // Leemos las notas guardadas de forma invisible
    let notasParsed = {};
    try {
      notasParsed = JSON.parse(semanaSeleccionada.notes || "{}");
    } catch(e) {}

    Object.entries(semanaSeleccionada.income || {}).forEach(([key, value]) => {
      if (Number(value) === 0) return;
      const known = incomeCats.find((c) => c.key === key);
      items.push({ 
        tipo: "ingreso", 
        key, 
        label: known ? known.label : key, 
        value, 
        nota: notasParsed[`ingreso_${key}`] || "" 
      });
    });
    
    Object.entries(semanaSeleccionada.expense || {}).forEach(([key, value]) => {
      if (Number(value) === 0) return;
      const known = expenseCats.find((c) => c.key === key);
      items.push({ 
        tipo: "egreso", 
        key, 
        label: known ? known.label : key, 
        value, 
        nota: notasParsed[`egreso_${key}`] || "" 
      });
    });
    return items;
  }, [semanaSeleccionada, incomeCats, expenseCats]);

  useEffect(() => {
    if (semanaSeleccionada?.status) setEstado(semanaSeleccionada.status);
  }, [semanaSeleccionada]);

  const cargarParaEditar = (item) => {
    setTipo(item.tipo);
    setConceptoKey(item.key);
    setMonto(String(item.value));
    setNota(item.nota || ""); // Cargamos la nota al editar
  };

  const guardar = async () => {
    if (!fecha) return alert("Elegí una fecha.");
    if (!conceptoKey) return alert("Elegí un concepto (o creá uno nuevo en la pestaña Conceptos).");
    if (monto === "" || isNaN(Number(monto))) return alert("Ingresá un monto válido.");
    
    setSaving(true);
    // Ahora enviamos también la nota a App.jsx
    const ok = await onGuardar({ fecha, tipo, key: conceptoKey, monto: Number(monto), estado, nota });
    setSaving(false);
    
    if (ok) { 
      setConceptoKey(""); 
      setMonto(""); 
      setNota(""); // Limpiamos la nota tras guardar
    }
  };

  const eliminar = async (item) => {
    if (!confirm(`¿Eliminar "${item.label}" del ${fecha}?`)) return;
    await onEliminar(fecha, item.tipo, item.key);
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 10px",
    border: `1px solid ${tokens.rule}`,
    borderRadius: 5,
    fontSize: 13,
    fontFamily: tokens.fontBody,
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 10.5, color: tokens.textFaint, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5, fontFamily: tokens.fontBody,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ListChecks size={16} color={tokens.textMuted} />
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, color: tokens.text, fontWeight: 600 }}>Cargar movimiento</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mono-input" style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, background: "#F8FAF9" }}>
            <option value="proyectado">Proyectado</option>
            <option value="real">Real</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Tipo</label>
        <div style={{ display: "flex", background: tokens.ruleSoft, borderRadius: 6, padding: 3 }}>
          {[{ v: "ingreso", c: tokens.positive }, { v: "egreso", c: tokens.negative }].map((o) => (
            <button
              key={o.v}
              onClick={() => { setTipo(o.v); setConceptoKey(""); setNota(""); }}
              style={{
                flex: 1, padding: "7px 0", border: "none", borderRadius: 4, cursor: "pointer",
                fontFamily: tokens.fontBody, fontSize: 12.5, fontWeight: 600,
                background: tipo === o.v ? "#fff" : "transparent",
                color: tipo === o.v ? o.c : tokens.textFaint,
                boxShadow: tipo === o.v ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                textTransform: "capitalize",
              }}
            >
              {o.v === "ingreso" ? "Ingreso" : "Egreso"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Concepto</label>
        <select value={conceptoKey} onChange={(e) => setConceptoKey(e.target.value)} style={{ ...inputStyle, background: "#F8FAF9" }}>
          <option value="">-- Seleccionar --</option>
          {catalogo.map((c) => (
            <option key={c.key} value={c.key}>{c.label}{c.custom ? "" : ""}</option>
          ))}
        </select>
        <p style={{ margin: "5px 0 0 0", fontSize: 11, color: tokens.textFaint }}>
          ¿No está en la lista? Creálo en la pestaña <strong>Conceptos</strong>.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Monto ($)</label>
        <input type="number" placeholder="0" value={monto} onChange={(e) => setMonto(e.target.value)} style={{ ...inputStyle, fontFamily: tokens.fontMono }} />
      </div>

      {/* NUEVO CAMPO PARA OBSERVACIONES */}
      <div>
        <label style={labelStyle}>Observaciones / Nota (Opcional)</label>
        <input 
          type="text" 
          placeholder="Ej: A quién se le debe, factura, etc." 
          value={nota} 
          onChange={(e) => setNota(e.target.value)} 
          style={inputStyle} 
        />
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        style={{
          padding: "11px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 6,
          fontWeight: 600, fontFamily: tokens.fontBody, cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13.5,
        }}
      >
        <PlusCircle size={16} /> {saving ? "Guardando…" : "Guardar"}
      </button>

      {fecha && (
        <div style={{ borderTop: `1px solid ${tokens.ruleSoft}`, paddingTop: 10 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 10.5, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: tokens.fontBody, fontWeight: 700 }}>
            Cargado en {fecha} ({movimientosDelDia.length})
          </h4>
          {movimientosDelDia.length === 0 ? (
            <p style={{ fontSize: 12, color: tokens.textFaint, margin: 0 }}>Sin movimientos todavía para esta fecha.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {movimientosDelDia.map((item) => (
                <div key={item.tipo + item.key} style={{
                  fontSize: 11.5, fontFamily: tokens.fontBody,
                  background: item.tipo === "ingreso" ? tokens.positiveSoft : tokens.negativeSoft,
                  padding: "6px 8px", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", color: tokens.text,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>{item.label}</span>
                    {/* Indicador visual de que tiene nota */}
                    {item.nota && <MessageSquareText size={12} color={tokens.textMuted} title={item.nota} />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontFamily: tokens.fontMono }}>$ {Number(item.value).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong>
                    <Pencil size={13} color={tokens.textFaint} cursor="pointer" onClick={() => cargarParaEditar(item)} />
                    <Trash2 size={13} color={tokens.negative} cursor="pointer" onClick={() => eliminar(item)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
