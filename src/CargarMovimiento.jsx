import React, { useState, useEffect } from "react";
import { tokens } from "./tokens";
import { Plus, Trash2, CalendarCheck2 } from "lucide-react";

const fieldInputStyle = {
  width: "100%", padding: "8px 10px", border: `1px solid ${tokens.rule || '#C2CAD4'}`, 
  borderRadius: 5, fontSize: 13, fontFamily: tokens.fontBody, outline: "none", boxSizing: "border-box",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10.5, color: tokens.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CargarMovimiento({ incomeCats, expenseCats, weeks, onGuardar, onEliminar, formatDate, movimientoAEditar, setMovimientoAEditar }) {
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("ingreso");
  const [estado, setEstado] = useState("proyectado");
  const [conceptoKey, setConceptoKey] = useState("");
  
  // AHORA TENEMOS DOS MONTOS SEPARADOS
  const [montoArs, setMontoArs] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (movimientoAEditar) {
      setFecha(movimientoAEditar.fecha);
      setTipo(movimientoAEditar.tipo);
      setEstado(movimientoAEditar.estado || "proyectado");
      setConceptoKey(movimientoAEditar.key);
      setMontoArs(movimientoAEditar.ars ? movimientoAEditar.ars.toString() : "");
      setMontoUsd(movimientoAEditar.usd ? movimientoAEditar.usd.toString() : "");
      setNota(movimientoAEditar.nota || "");
    } else {
      setFecha("");
      setTipo("ingreso");
      setEstado("proyectado");
      setConceptoKey("");
      setMontoArs("");
      setMontoUsd("");
      setNota("");
    }
  }, [movimientoAEditar]);

  const handleNuevo = () => {
    setMovimientoAEditar(null); 
  };

  const handleGuardar = async () => {
    if (!fecha || !conceptoKey || (!montoArs && !montoUsd)) {
      alert("Por favor rellena fecha, concepto y al menos un monto (en Pesos o en Dólares).");
      return;
    }

    const exito = await onGuardar({
      fecha,
      tipo,
      key: conceptoKey,
      montoArs: Number(montoArs) || 0,
      montoUsd: Number(montoUsd) || 0,
      estado,
      nota
    });

    if (exito) {
      handleNuevo(); 
    }
  };

  const handleEliminar = () => {
    if (!movimientoAEditar) return;
    if (window.confirm(`¿Seguro que deseas eliminar el movimiento de ${tipo === "ingreso" ? "ingreso" : "egreso"} del ${formatDate(fecha)}?`)) {
      onEliminar(fecha, tipo, conceptoKey);
      handleNuevo();
    }
  };

  const categoriasVisibles = tipo === "ingreso" ? incomeCats : expenseCats;
  const conceptoLabel = categoriasVisibles.find(c => c.key === conceptoKey)?.label || "...";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
          {movimientoAEditar ? `Editar ${tipo === "ingreso" ? "Ingreso" : "Egreso"}: ${conceptoLabel}` : "+ Cargar movimiento"}
        </h3>
        {movimientoAEditar && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={handleNuevo} style={{ background: tokens.paper, color: tokens.text, border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Nuevo ingreso</button>
                <button onClick={handleEliminar} style={{ background: "none", border: "none", color: tokens.negative, cursor: "pointer", padding: 4, display: "flex" }} title="Eliminar este movimiento"><Trash2 size={16}/></button>
            </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={fieldInputStyle} /></Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={fieldInputStyle}>
            <option value="proyectado">Proyectado</option>
            <option value="ejecutado">Ejecutado</option>
          </select>
        </Field>
      </div>

      <Field label="Tipo">
        <div style={{ display: "flex", border: `1px solid ${tokens.rule || '#C2CAD4'}`, borderRadius: 6, overflow: "hidden" }}>
          <button onClick={() => { setTipo("ingreso"); setConceptoKey(""); }} style={{ flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: tokens.fontBody, background: tipo === "ingreso" ? "#F0FDF4" : tokens.paper, color: tipo === "ingreso" ? tokens.positive : tokens.textMuted }}>
            Ingreso
          </button>
          <button onClick={() => { setTipo("egreso"); setConceptoKey(""); }} style={{ flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: tokens.fontBody, background: tipo === "egreso" ? "#FEF2F2" : tokens.paper, color: tipo === "egreso" ? tokens.negative : tokens.textMuted }}>
            Egreso
          </button>
        </div>
      </Field>

      <Field label="Concepto">
        <select value={conceptoKey} onChange={(e) => setConceptoKey(e.target.value)} style={fieldInputStyle}>
          <option value="">-- Seleccionar --</option>
          {categoriasVisibles.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Monto en ARS ($)">
          <input type="number" value={montoArs} onChange={(e) => setMontoArs(e.target.value)} placeholder="0" style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} />
        </Field>
        <Field label="Monto en USD (U$D)">
          <input type="number" value={montoUsd} onChange={(e) => setMontoUsd(e.target.value)} placeholder="0" style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} />
        </Field>
      </div>

      <Field label="Observaciones / Nota (Opcional)">
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: A quién se le debe, factura, etc." style={{ ...fieldInputStyle, height: 60, resize: "none" }} />
      </Field>

      <button onClick={handleGuardar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, marginTop: 10 }}>
        {movimientoAEditar ? <CalendarCheck2 size={18}/> : <Plus size={18}/>}
        {movimientoAEditar ? `Guardar cambios` : "Guardar movimiento"}
      </button>
    </div>
  );
}
