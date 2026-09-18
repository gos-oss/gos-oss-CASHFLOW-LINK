import React, { useState, useEffect, useMemo } from "react";
import { tokens } from "./tokens";
import { Plus, Trash2, CalendarCheck2, FileSpreadsheet, Edit3, CalendarRange, Clock } from "lucide-react";

const fieldInputStyle = {
  width: "100%", padding: "8px 10px", border: `1px solid ${tokens.rule || '#C2CAD4'}`, 
  borderRadius: 5, fontSize: 13, fontFamily: tokens.fontBody, outline: "none", boxSizing: "border-box",
};

function calcularFechasFuturas(fechaBase, frecuencia, cantidad) {
  if (!fechaBase || !cantidad || cantidad <= 0) return [];
  const fechas = [];
  const [y, m, d] = fechaBase.split("-").map(Number);
  if (!y || !m || !d) return [];

  for (let i = 1; i <= cantidad; i++) {
    if (frecuencia === "semanal") {
      const dt = new Date(Date.UTC(y, m - 1, d + (i * 7)));
      fechas.push(dt.toISOString().slice(0, 10));
    } else if (frecuencia === "quincenal") {
      const dt = new Date(Date.UTC(y, m - 1, d + (i * 14)));
      fechas.push(dt.toISOString().slice(0, 10));
    } else if (frecuencia === "mensual") {
      const targetMonth = m - 1 + i;
      const dt = new Date(Date.UTC(y, targetMonth, d));
      // Si desborda (ej 31 de feb), ajustar al último día del mes
      if (dt.getUTCDate() !== d) {
        const lastDayOfMonth = new Date(Date.UTC(y, targetMonth + 1, 0));
        fechas.push(lastDayOfMonth.toISOString().slice(0, 10));
      } else {
        fechas.push(dt.toISOString().slice(0, 10));
      }
    }
  }
  return fechas;
}

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

export default function CargarMovimiento({ incomeCats, expenseCats, weeks: _weeks, onGuardar, onEliminar, formatDate, movimientoAEditar, setMovimientoAEditar, getTC, onAbrirImportadorExcel }) {
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("ingreso");
  const [estado, setEstado] = useState("proyectado");
  const [conceptoKey, setConceptoKey] = useState("");
  
  // AHORA TENEMOS DOS MONTOS SEPARADOS
  const [montoArs, setMontoArs] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  
  const [nota, setNota] = useState("");

  // PROYECCIÓN EN PERÍODOS FUTUROS DESDE LA FECHA
  const [incorporarFuturos, setIncorporarFuturos] = useState(false);
  const [frecuenciaFutura, setFrecuenciaFutura] = useState("semanal"); // "semanal" | "quincenal" | "mensual"
  const [cantidadPeriodos, setCantidadPeriodos] = useState(4); // 2, 4, 8, 12, 24

  const tcActual = getTC && fecha ? getTC(fecha) : (getTC ? getTC(new Date().toISOString().slice(0, 10)) : 1);

  const fechasFuturas = useMemo(() => {
    if (!incorporarFuturos || !fecha || cantidadPeriodos <= 0) return [];
    return calcularFechasFuturas(fecha, frecuenciaFutura, Number(cantidadPeriodos));
  }, [incorporarFuturos, fecha, frecuenciaFutura, cantidadPeriodos]);

  useEffect(() => {
    if (movimientoAEditar) {
      setFecha(movimientoAEditar.fecha);
      setTipo(movimientoAEditar.tipo);
      setEstado(movimientoAEditar.estado || "proyectado");
      setConceptoKey(movimientoAEditar.key);
      setMontoArs(movimientoAEditar.ars ? movimientoAEditar.ars.toString() : "");
      setMontoUsd(movimientoAEditar.usd ? movimientoAEditar.usd.toString() : "");
      setNota(movimientoAEditar.nota || "");
      setIncorporarFuturos(false);
    } else {
      setFecha("");
      setTipo("ingreso");
      setEstado("proyectado");
      setConceptoKey("");
      setMontoArs("");
      setMontoUsd("");
      setNota("");
      setIncorporarFuturos(false);
    }
  }, [movimientoAEditar]);

  const handleNuevo = () => {
    setMovimientoAEditar(null); 
    setIncorporarFuturos(false);
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
      nota,
      fechasFuturas: incorporarFuturos ? fechasFuturas : []
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
      
      {/* BOTÓN DIRECTO DE IMPORTAR EXCEL DENTRO DEL PANEL LATERAL DE MOVIMIENTOS */}
      {onAbrirImportadorExcel && (
        <div style={{
          background: "rgba(201, 174, 107, 0.12)",
          border: "1px dashed rgba(201, 174, 107, 0.6)",
          borderRadius: 8,
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "stretch"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: tokens.ink }}>
            <FileSpreadsheet size={15} color={tokens.gold} />
            <span>¿Tienes la planilla Excel del día?</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: tokens.textMuted, lineHeight: 1.4 }}>
            Carga el archivo .xlsx para sincronizar todos los conceptos y fechas en un solo paso.
          </p>
          <button
            type="button"
            onClick={onAbrirImportadorExcel}
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: tokens.ink,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <FileSpreadsheet size={14} color={tokens.gold} /> Abrir Importador Excel
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 15, fontWeight: 600 }}>
          {movimientoAEditar ? `Editar ${tipo === "ingreso" ? "Ingreso" : "Egreso"}: ${conceptoLabel}` : "+ Carga Manual Individual"}
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

      {Number(montoUsd) > 0 && (
        <div style={{ background: tcActual > 1 ? "#F8FAFC" : "#FEF2F2", border: `1px solid ${tcActual > 1 ? "#E2E8F0" : "#FECACA"}`, borderRadius: 6, padding: "8px 12px", fontSize: 11.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: tokens.textMuted }}>
            <span>TC aplicado ({fecha ? formatDate(fecha) : "hoy"}):</span>
            <span style={{ fontWeight: 600, fontFamily: tokens.fontMono, color: tcActual > 1 ? tokens.ink : tokens.negative }}>
              {tcActual > 1 ? `$ ${Number(tcActual).toLocaleString("es-AR")} / USD` : "⚠️ Sin TC cargado (1:1)"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontWeight: 700, color: tipo === "ingreso" ? tokens.positive : tokens.negative }}>
            <span>Equivalente en ARS:</span>
            <span style={{ fontFamily: tokens.fontMono }}>
              $ {Math.round(Number(montoUsd) * tcActual).toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      )}

      <Field label="Observaciones / Nota (Opcional)">
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: A quién se le debe, factura, etc." style={{ ...fieldInputStyle, height: 60, resize: "none" }} />
      </Field>

      {/* SECCIÓN: INCORPORAR EN PERÍODOS FUTUROS DESDE LA FECHA */}
      <div style={{
        background: incorporarFuturos ? "rgba(201, 174, 107, 0.08)" : tokens.paper,
        border: `1px solid ${incorporarFuturos ? "rgba(201, 174, 107, 0.45)" : (tokens.rule || '#C2CAD4')}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "all 0.2s"
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={incorporarFuturos}
            onChange={(e) => setIncorporarFuturos(e.target.checked)}
            style={{ accentColor: tokens.gold, width: 16, height: 16, cursor: "pointer" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarRange size={15} color={incorporarFuturos ? tokens.gold : tokens.textMuted} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.ink }}>
              Incorporar en períodos futuros desde la fecha
            </span>
          </div>
        </label>

        {incorporarFuturos && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            {!fecha ? (
              <p style={{ margin: 0, fontSize: 11.5, color: tokens.negative, fontWeight: 500 }}>
                ⚠️ Selecciona primero una fecha inicial para proyectar los períodos futuros.
              </p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textMuted, display: "block", marginBottom: 4 }}>
                      Frecuencia
                    </label>
                    <select
                      value={frecuenciaFutura}
                      onChange={(e) => setFrecuenciaFutura(e.target.value)}
                      style={fieldInputStyle}
                    >
                      <option value="semanal">Semanal (cada 7 días)</option>
                      <option value="quincenal">Quincenal (cada 14 días)</option>
                      <option value="mensual">Mensual (mismo día)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textMuted, display: "block", marginBottom: 4 }}>
                      Períodos a incorporar
                    </label>
                    <select
                      value={cantidadPeriodos}
                      onChange={(e) => setCantidadPeriodos(Number(e.target.value))}
                      style={fieldInputStyle}
                    >
                      <option value={2}>+2 períodos</option>
                      <option value={4}>+4 períodos (1 mes)</option>
                      <option value={8}>+8 períodos (2 meses)</option>
                      <option value={12}>+12 períodos (3 meses)</option>
                      <option value={24}>+24 períodos (6 meses)</option>
                    </select>
                  </div>
                </div>

                {fechasFuturas.length > 0 && (
                  <div style={{
                    background: "#fff",
                    borderRadius: 6,
                    border: `1px solid ${tokens.rule || '#C2CAD4'}`,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: tokens.textMuted }}>
                      <span>Se registrarán <strong>{fechasFuturas.length + 1} movimientos</strong>:</span>
                      <span style={{ color: tokens.positive, fontWeight: 600 }}>Estado: Proyectado</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 80, overflowY: "auto" }}>
                      <span style={{
                        background: tokens.ink,
                        color: "#fff",
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: tokens.fontMono,
                        fontWeight: 600
                      }}>
                        {formatDate ? formatDate(fecha) : fecha} (Base)
                      </span>
                      {fechasFuturas.map((f) => (
                        <span
                          key={f}
                          style={{
                            background: "rgba(201, 174, 107, 0.2)",
                            color: tokens.ink,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontFamily: tokens.fontMono
                          }}
                        >
                          +{formatDate ? formatDate(f) : f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <button onClick={handleGuardar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: tokens.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, marginTop: 4 }}>
        {movimientoAEditar ? <CalendarCheck2 size={18}/> : <Plus size={18}/>}
        {movimientoAEditar 
          ? `Guardar cambios` 
          : (incorporarFuturos && fechasFuturas.length > 0)
          ? `Guardar e incorporar en ${fechasFuturas.length + 1} períodos`
          : "Guardar movimiento"}
      </button>
    </div>
  );
}
