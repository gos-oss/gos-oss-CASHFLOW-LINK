import React, { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Lock } from "lucide-react";
import { tokens } from "./tokens";
import { usageCount } from "./categories";

function ConceptRow({ item, weeks, field, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const [busy, setBusy] = useState(false);
  const uses = usageCount(weeks, field, item.key);

  const save = async () => {
    if (!draft.trim() || draft.trim() === item.label) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const ok = await onRename(draft.trim());
    setBusy(false);
    if (ok) setEditing(false);
  };

  const remove = async () => {
    if (!confirm(`Eliminar "${item.label}"${uses ? ` (usado en ${uses} fecha${uses > 1 ? "s" : ""})` : ""}?`)) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderBottom: `1px solid ${tokens.ruleSoft}`,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            style={{
              flex: 1,
              fontFamily: tokens.fontBody,
              fontSize: 13,
              padding: "5px 8px",
              border: `1px solid ${tokens.gold}`,
              borderRadius: 4,
              outline: "none",
            }}
          />
          <Check size={15} color={tokens.positive} cursor="pointer" onClick={save} />
          <X size={15} color={tokens.textFaint} cursor="pointer" onClick={() => { setEditing(false); setDraft(item.label); }} />
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontFamily: tokens.fontBody, fontSize: 13, color: tokens.text }}>{item.label}</span>
          {uses > 0 && (
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: 10,
                color: tokens.textFaint,
                background: tokens.ruleSoft,
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              {uses} fecha{uses > 1 ? "s" : ""}
            </span>
          )}
          {item.custom ? (
            <>
              <Pencil size={14} color={tokens.textFaint} cursor="pointer" onClick={() => setEditing(true)} />
              <Trash2 size={14} color={tokens.negative} cursor="pointer" onClick={remove} />
            </>
          ) : (
            <span title="Concepto de fábrica" style={{ display: "flex", alignItems: "center" }}>
              <Lock size={12} color={tokens.textFaint} />
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ConceptColumn({ title, accent, items, weeks, field, onAdd, onRename, onDelete }) {
  const [nuevo, setNuevo] = useState("");
  const [adding, setAdding] = useState(false);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setAdding(true);
    const ok = await onAdd(nuevo.trim());
    setAdding(false);
    if (ok) setNuevo("");
  };

  return (
    <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${tokens.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600, color: tokens.text }}>{title}</h3>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {items.map((item) => (
          <ConceptRow
            key={item.key}
            item={item}
            weeks={weeks}
            field={field}
            onRename={(label) => onRename(item.key, label)}
            onDelete={() => onDelete(item.key)}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${tokens.rule}`, background: tokens.paper }}>
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nombre del concepto nuevo"
          style={{
            flex: 1,
            fontFamily: tokens.fontBody,
            fontSize: 13,
            padding: "8px 10px",
            border: `1px solid ${tokens.rule}`,
            borderRadius: 5,
            outline: "none",
          }}
        />
        <button
          onClick={agregar}
          disabled={adding || !nuevo.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "8px 12px",
            background: tokens.ink,
            color: "#fff",
            border: "none",
            borderRadius: 5,
            fontFamily: tokens.fontBody,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: adding || !nuevo.trim() ? "default" : "pointer",
            opacity: adding || !nuevo.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}

export default function CategoryManager({ incomeCats, expenseCats, weeks, onAdd, onRename, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600, color: tokens.text }}>
          Conceptos
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, maxWidth: 640 }}>
          El plan de cuentas de fábrica (<Lock size={11} style={{ verticalAlign: -1 }} />) no se puede borrar ni renombrar, para
          mantener la comparabilidad histórica. Los conceptos que agregues acá quedan disponibles en "Movimientos" para
          cualquier fecha, sin tocar ningún archivo.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <ConceptColumn
          title="Ingresos"
          accent={tokens.positive}
          items={incomeCats}
          weeks={weeks}
          field="income"
          onAdd={(label) => onAdd("ingreso", label)}
          onRename={(key, label) => onRename("ingreso", key, label)}
          onDelete={(key) => onDelete("ingreso", key)}
        />
        <ConceptColumn
          title="Egresos"
          accent={tokens.negative}
          items={expenseCats}
          weeks={weeks}
          field="expense"
          onAdd={(label) => onAdd("egreso", label)}
          onRename={(key, label) => onRename("egreso", key, label)}
          onDelete={(key) => onDelete("egreso", key)}
        />
      </div>
    </div>
  );
}
