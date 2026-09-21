import React, { useState, useEffect, useMemo } from "react";
import { tokens } from "./tokens";
import { 
  Plus, Trash2, CalendarCheck2, FileSpreadsheet, CalendarRange, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Sparkles, X, Check
} from "lucide-react";

const fieldInputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: `1px solid ${tokens.rule || '#C2CAD4'}`,
  borderRadius: 7,
  fontSize: 13,
  fontFamily: tokens.fontBody,
  outline: "none",
  boxSizing: "border-box",
  background: "#FFFFFF",
  color: tokens.ink,
  transition: "border-color 0.15s ease, box-shadow 0.15s ease"
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

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 10.5, color: tokens.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 10.5, color: tokens.textFaint }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function CargarMovimiento({
  incomeCats,
  expenseCats,
  weeks: _weeks,
  onGuardar,
  onEliminar,
  formatDate,
  movimientoAEditar,
  setMovimientoAEditar,
  getTC,
  onAbrirImportadorExcel
}) {
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("ingreso");
  const [estado, setEstado] = useState("proyectado");
  const [conceptoKey, setConceptoKey] = useState("");
  
  // MONTOS SEPARADOS EN PESOS Y DÓLARES
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
  const conceptoLabel = categoriasVisibles.find(c => c.key === conceptoKey)?.label || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* ATRIBUTO / ENCABEZADO DEL PANEL */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${tokens.rule || '#E2E8F0'}`,
        paddingBottom: 12
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: tokens.gold }}>
            Control de Tesorería
          </div>
          <h3 style={{ margin: "2px 0 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 700, color: tokens.ink }}>
            {movimientoAEditar ? "Editar Registro" : "Nuevo Movimiento"}
          </h3>
        </div>

        {movimientoAEditar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleNuevo}
              type="button"
              style={{
                background: tokens.paper,
                color: tokens.text,
                border: `1px solid ${tokens.rule || '#E2E8F0'}`,
                borderRadius: 5,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600
              }}
            >
              Nuevo
            </button>
            <button
              onClick={handleEliminar}
              type="button"
              style={{
                background: tokens.negativeSoft,
                border: "none",
                color: tokens.negative,
                borderRadius: 5,
                padding: "4px 8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600
              }}
              title="Eliminar este movimiento"
            >
              <Trash2 size={13}/>
            </button>
          </div>
        ) : (
          <span style={{
            fontSize: 10.5,
            fontWeight: 700,
            background: "rgba(14, 124, 102, 0.1)",
            color: tokens.positive,
            padding: "2px 7px",
            borderRadius: 4
          }}>
            Manual
          </span>
        )}
      </div>

      {/* BANNER DIRECTO DE IMPORTACIÓN EXCEL DENTRO DEL PANEL */}
      {onAbrirImportadorExcel && !movimientoAEditar && (
        <div style={{
          background: "linear-gradient(135deg, rgba(201, 174, 107, 0.12) 0%, rgba(201, 174, 107, 0.05) 100%)",
          border: "1px dashed rgba(201, 174, 107, 0.6)",
          borderRadius: 8,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: tokens.ink }}>
            <FileSpreadsheet size={14} color={tokens.gold} />
            <span>¿Tienes la planilla Excel del día?</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: tokens.textMuted, lineHeight: 1.35 }}>
            Sube el archivo .xlsx para sincronizar ingresos, egresos y saldos en bloque.
          </p>
          <button
            type="button"
            onClick={onAbrirImportadorExcel}
            style={{
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: tokens.ink,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}
          >
            <FileSpreadsheet size={13} color={tokens.gold} /> Abrir Importador Excel
          </button>
        </div>
      )}

      {/* SELECTOR SEGMENTADO DE TIPO: INGRESO / EGRESO */}
      <Field label="Naturaleza de la Operación">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button
            type="button"
            onClick={() => { setTipo("ingreso"); setConceptoKey(""); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 10px",
              border: `1.5px solid ${tipo === "ingreso" ? tokens.positive : (tokens.rule || '#E2E8F0')}`,
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: tipo === "ingreso" ? 700 : 500,
              fontFamily: tokens.fontBody,
              background: tipo === "ingreso" ? tokens.positiveSoft : "#FFFFFF",
              color: tipo === "ingreso" ? tokens.positive : tokens.textMuted,
              transition: "all 0.15s ease"
            }}
          >
            <TrendingUp size={15} />
            Ingreso
          </button>

          <button
            type="button"
            onClick={() => { setTipo("egreso"); setConceptoKey(""); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 10px",
              border: `1.5px solid ${tipo === "egreso" ? tokens.negative : (tokens.rule || '#E2E8F0')}`,
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: tipo === "egreso" ? 700 : 500,
              fontFamily: tokens.fontBody,
              background: tipo === "egreso" ? tokens.negativeSoft : "#FFFFFF",
              color: tipo === "egreso" ? tokens.negative : tokens.textMuted,
              transition: "all 0.15s ease"
            }}
          >
            <TrendingDown size={15} />
            Egreso
          </button>
        </div>
      </Field>

      {/* FECHA Y ESTADO */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
        <Field label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={fieldInputStyle}
          />
        </Field>
        <Field label="Estado">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={fieldInputStyle}
          >
            <option value="proyectado">Proyectado</option>
            <option value="ejecutado">Ejecutado</option>
          </select>
        </Field>
      </div>

      {/* CONCEPTO / RUBRO */}
      <Field label="Concepto / Rubro" hint={`${categoriasVisibles.length} disponibles`}>
        <select
          value={conceptoKey}
          onChange={(e) => setConceptoKey(e.target.value)}
          style={{ ...fieldInputStyle, fontWeight: conceptoKey ? 600 : 400 }}
        >
          <option value="">-- Seleccionar concepto --</option>
          {categoriasVisibles.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </Field>

      {/* IMPORTES EN MONEDA DUAL: ARS Y USD */}
      <div style={{
        background: tokens.paper,
        borderRadius: 8,
        border: `1px solid ${tokens.rule || '#E2E8F0'}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: tokens.ink, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Importes de la Operación
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Monto en ARS ($)">
            <input
              type="number"
              value={montoArs}
              onChange={(e) => setMontoArs(e.target.value)}
              placeholder="0"
              style={{ ...fieldInputStyle, fontFamily: tokens.fontMono, fontWeight: 600 }}
            />
          </Field>
          <Field label="Monto en USD (U$D)">
            <input
              type="number"
              value={montoUsd}
              onChange={(e) => setMontoUsd(e.target.value)}
              placeholder="0"
              style={{ ...fieldInputStyle, fontFamily: tokens.fontMono, fontWeight: 600 }}
            />
          </Field>
        </div>

        {/* TARJETA DE CONVERSIÓN EN VIVO AL TIPO DE CAMBIO */}
        {Number(montoUsd) > 0 && (
          <div style={{
            background: tcActual > 1 ? "#FFFFFF" : "#FEF2F2",
            border: `1px solid ${tcActual > 1 ? "#CBD5E1" : "#FECACA"}`,
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11.5
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: tokens.textMuted }}>
              <span>TC aplicado ({fecha ? formatDate(fecha) : "hoy"}):</span>
              <span style={{ fontWeight: 600, fontFamily: tokens.fontMono, color: tcActual > 1 ? tokens.ink : tokens.negative }}>
                {tcActual > 1 ? `$ ${Number(tcActual).toLocaleString("es-AR")} / USD` : "⚠️ Sin TC cargado"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontWeight: 700, color: tipo === "ingreso" ? tokens.positive : tokens.negative }}>
              <span>Equivalente en Pesos:</span>
              <span style={{ fontFamily: tokens.fontMono }}>
                $ {Math.round(Number(montoUsd) * tcActual).toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* OBSERVACIONES / NOTA */}
      <Field label="Nota / Observaciones (Opcional)">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: A quién se le debe, comprobante, etc."
          style={{ ...fieldInputStyle, height: 50, resize: "none" }}
        />
      </Field>

      {/* SECCIÓN: INCORPORAR EN PERÍODOS FUTUROS (RECURRENCIA) */}
      {!movimientoAEditar && (
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={incorporarFuturos}
              onChange={(e) => setIncorporarFuturos(e.target.checked)}
              style={{ accentColor: tokens.gold, width: 16, height: 16, cursor: "pointer" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarRange size={14} color={incorporarFuturos ? tokens.gold : tokens.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink }}>
                Proyectar en períodos futuros
              </span>
            </div>
          </label>

          {incorporarFuturos && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
              {!fecha ? (
                <p style={{ margin: 0, fontSize: 11, color: tokens.negative, fontWeight: 600 }}>
                  ⚠️ Selecciona una fecha base para proyectar las recurrencias.
                </p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10.5, fontWeight: 600, color: tokens.textMuted, display: "block", marginBottom: 3 }}>
                        Frecuencia
                      </label>
                      <select
                        value={frecuenciaFutura}
                        onChange={(e) => setFrecuenciaFutura(e.target.value)}
                        style={fieldInputStyle}
                      >
                        <option value="semanal">Semanal (cada 7d)</option>
                        <option value="quincenal">Quincenal (cada 14d)</option>
                        <option value="mensual">Mensual (mismo día)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10.5, fontWeight: 600, color: tokens.textMuted, display: "block", marginBottom: 3 }}>
                        Períodos a sumar
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
                        <span>Total: <strong>{fechasFuturas.length + 1} movimientos</strong></span>
                        <span style={{ color: tokens.positive, fontWeight: 600 }}>Estado: Proyectado</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 70, overflowY: "auto" }}>
                        <span style={{
                          background: tokens.ink,
                          color: "#fff",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10.5,
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
                              fontSize: 10.5,
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
      )}

      {/* BOTÓN PRINCIPAL DE GUARDAR */}
      <button
        onClick={handleGuardar}
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "11px 14px",
          background: tokens.ink,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13.5,
          marginTop: 4,
          boxShadow: "0 2px 6px rgba(14,21,36,0.2)",
          transition: "transform 0.1s ease"
        }}
      >
        {movimientoAEditar ? <CalendarCheck2 size={16} /> : <Plus size={16} color={tokens.gold} />}
        {movimientoAEditar 
          ? `Guardar cambios` 
          : (incorporarFuturos && fechasFuturas.length > 0)
          ? `Guardar ${fechasFuturas.length + 1} movimientos`
          : "Guardar movimiento"}
      </button>

    </div>
  );
}

