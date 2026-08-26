import React, { useState, useEffect } from "react";
import { tokens } from "./tokens";
import { Plus, Trash2, CalendarCheck2 } from "lucide-react";

// Estilos locales para los inputs basándonos en tokens y App.jsx
const fieldInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${tokens.rule || '#C2CAD4'}`, // Fallback si no hay colorLineaFuerte prop
  borderRadius: 5,
  fontSize: 13,
  fontFamily: tokens.fontBody,
  outline: "none",
  boxSizing: "border-box",
};

// Componente auxiliar para las etiquetas de los campos
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
  // -------------------------------------------------------------------------
  // ESTADOS LOCALES DEL FORMULARIO
  // Estos estados controlan lo que se escribe en los inputs.
  // -------------------------------------------------------------------------
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("ingreso");
  const [estado, setEstado] = useState("proyectado");
  const [conceptoKey, setConceptoKey] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");

  // -------------------------------------------------------------------------
  // 🔥 LÓGICA CLAVE DE EDICION (EFECTO SECUNDARIO) 🔥
  // Un 'useEffect' escucha los cambios en la propiedad 'movimientoAEditar'.
  // Cuando el usuario hace clic en la tabla de la derecha, esta propiedad cambia.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (movimientoAEditar) {
      // ➔ Si hay un movimiento para editar, rellenamos el formulario con sus datos
      setFecha(movimientoAEditar.fecha);
      setTipo(movimientoAEditar.tipo);
      setEstado(movimientoAEditar.estado || "proyectado"); // Fallback por seguridad
      setConceptoKey(movimientoAEditar.key);
      setMonto(movimientoAEditar.monto.toString()); // Convertir a string para el input numérico
      setNota(movimientoAEditar.nota || ""); // Fallback para nota vacía
    } else {
      // ➔ Si no hay movimiento (o se canceló la edición), limpiamos el formulario para un nuevo ingreso
      setFecha("");
      // setTipo("ingreso"); // ¿Mantener tipo actual o reiniciar? Reiniciar es más limpio.
      setTipo("ingreso");
      setEstado("proyectado");
      setConceptoKey("");
      setMonto("");
      setNota("");
    }
  }, [movimientoAEditar]); // 🔥 Se ejecuta cada vez que cambia 'movimientoAEditar'

  // Función para reiniciar el formulario para un nuevo ingreso
  const handleNuevo = () => {
    setMovimientoAEditar(null); // Esto dispara el useEffect para limpiar todo
  };

  // Función para guardar el movimiento (crear o actualizar)
  const handleGuardar = async () => {
    // Validaciones básicas
    if (!fecha || !conceptoKey || !monto || Number(monto) <= 0) {
      alert("Por favor rellena fecha, concepto y un monto válido.");
      return;
    }

    // Llamamos a la función de guardado del componente padre
    const exito = await onGuardar({
      fecha,
      tipo,
      key: conceptoKey,
      monto: Number(monto),
      estado,
      nota,
    });

    if (exito) {
      // Después de guardar, limpiamos el formulario y el estado de edición del padre
      handleNuevo(); 
    }
  };

  // Función para eliminar un movimiento existente
  const handleEliminar = () => {
    if (!movimientoAEditar) return;
    if (window.confirm(`¿Seguro que deseas eliminar el movimiento de ${tipo === "ingreso" ? "ingreso" : "egreso"} del ${formatDate(fecha)}?`)) {
      onEliminar(fecha, tipo, conceptoKey);
      handleNuevo(); // Limpiar formulario después de eliminar
    }
  };

  // Determinar qué categorías mostrar en el selector
  const categoriasVisibles = tipo === "ingreso" ? incomeCats : expenseCats;

  // Obtener el label del concepto para mostrar en el título de edición
  const conceptoLabel = categoriasVisibles.find(c => c.key === conceptoKey)?.label || "...";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ---------- ENCABEZADO DINÁMICO ---------- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>
          {movimientoAEditar ? `Editar ${tipo === "ingreso" ? "Ingreso" : "Egreso"}: ${conceptoLabel}` : "+ Cargar movimiento"}
        </h3>
        {movimientoAEditar && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={handleNuevo} style={{ background: tokens.paper, color: tokens.text, border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500, transition: "background 0.2s" }} onMouseOver={(e) => e.target.style.background = '#DEE3E9'} onMouseOut={(e) => e.target.style.background = tokens.paper}>Nuevo ingreso</button>
                <button onClick={handleEliminar} style={{ background: "none", border: "none", color: tokens.negative, cursor: "pointer", padding: 4, display: "flex", transition: "color 0.2s" }} title="Eliminar este movimiento" onMouseOver={(e) => e.target.style.color = '#B91C1C'} onMouseOut={(e) => e.target.style.color = tokens.negative}><Trash2 size={16}/></button>
            </div>
        )}
      </div>

      {/* ---------- FORMULARIO ---------- */}
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
        {/* Usamos el color de borde de tokens o App.jsx por fallback */}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <Field label="Monto ($)"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={{ ...fieldInputStyle, fontFamily: tokens.fontMono }} /></Field>
        <Field label="Observaciones / Nota (Opcional)"><textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: A quién se le debe, factura, etc." style={{ ...fieldInputStyle, height: 60, resize: "none" }} /></Field>
      </div>

      {/* ---------- BOTÓN DE ACCIÓN ---------- */}
      <button onClick={handleGuardar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, marginTop: 10, transition: "background 0.2s" }} onMouseOver={(e) => e.target.style.background = "#0E1118"} onMouseOut={(e) => e.target.style.background = tokens.ink}>
        {movimientoAEditar ? <CalendarCheck2 size={18}/> : <Plus size={18}/>}
        {movimientoAEditar ? `Guardar cambios` : "Guardar movimiento"}
      </button>
    </div>
  );
}
