import React, { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Lock, Search, ArrowDownAZ, Flame, TrendingUp, TrendingDown, Tag as TagIcon } from "lucide-react";
import { tokens } from "./tokens";
import { usageCount } from "./categories";

function ConceptRow({ item, weeks, field, onRename, onDelete, isTop }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderBottom: `1px solid ${tokens.ruleSoft}`,
        opacity: busy ? 0.5 : 1,
        background: hover ? tokens.paper : "transparent",
        transition: "background 0.12s ease",
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
          {isTop && <Flame size={13} color={tokens.gold} style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, fontFamily: tokens.fontBody, fontSize: 13, color: tokens.text, fontWeight: isTop ? 600 : 400 }}>{item.label}</span>
          {uses > 0 && (
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: 10,
                color: tokens.textMuted,
                background: tokens.ruleSoft,
                padding: "2px 7px",
                borderRadius: 20,
                fontWeight: 600,
              }}
            >
              {uses} fecha{uses > 1 ? "s" : ""}
            </span>
          )}
          {item.custom ? (
            <div style={{ display: "flex", gap: 4, opacity: hover ? 1 : 0.35, transition: "opacity 0.12s ease" }}>
              <Pencil size={14} color={tokens.textFaint} cursor="pointer" onClick={() => setEditing(true)} />
              <Trash2 size={14} color={tokens.negative} cursor="pointer" onClick={remove} />
            </div>
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

function ConceptColumn({ title, accent, Icon, items, weeks, field, onAdd, onRename, onDelete }) {
  const [nuevo, setNuevo] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("uso"); // "uso" | "az"

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setAdding(true);
    const ok = await onAdd(nuevo.trim());
    setAdding(false);
    if (ok) setNuevo("");
  };

  const withUsage = useMemo(
    () => items.map((item) => ({ ...item, uses: usageCount(weeks, field, item.key) })),
    [items, weeks, field]
  );

  const topKey = useMemo(() => {
    const max = withUsage.reduce((a, b) => (b.uses > a.uses ? b : a), { uses: 0 });
    return max.uses > 0 ? max.key : null;
  }, [withUsage]);

  const filtered = useMemo(() => {
    let list = withUsage.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));
    list.sort((a, b) => (sortMode === "az" ? a.label.localeCompare(b.label) : b.uses - a.uses || a.label.localeCompare(b.label)));
    return list;
  }, [withUsage, query, sortMode]);

  const customCount = items.filter((i) => i.custom).length;

  return (
    <div className="kf-card" style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${tokens.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(180deg, ${accent}0D, transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ background: `${accent}1A`, color: accent, borderRadius: 7, padding: 6, display: "flex" }}>
            <Icon size={15} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600, color: tokens.text }}>{title}</h3>
            <span style={{ fontSize: 10.5, color: tokens.textFaint }}>{items.length} conceptos · {customCount} propios</span>
          </div>
        </div>
        <button
          onClick={() => setSortMode((m) => (m === "uso" ? "az" : "uso"))}
          title={sortMode === "uso" ? "Ordenando por más usados — clic para A-Z" : "Ordenando A-Z — clic por más usados"}
          style={{ display: "flex", alignItems: "center", gap: 5, background: tokens.paper, border: `1px solid ${tokens.rule}`, borderRadius: 6, padding: "5px 9px", fontSize: 10.5, color: tokens.textMuted, cursor: "pointer", fontWeight: 600 }}
        >
          {sortMode === "uso" ? <Flame size={12} /> : <ArrowDownAZ size={12} />} {sortMode === "uso" ? "Más usados" : "A-Z"}
        </button>
      </div>

      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${tokens.ruleSoft}` }}>
        <div style={{ position: "relative" }}>
          <Search size={13} color={tokens.textFaint} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar concepto…"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: tokens.fontBody, fontSize: 12.5, padding: "7px 10px 7px 28px", border: `1px solid ${tokens.ruleSoft}`, borderRadius: 6, outline: "none", background: tokens.paper }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: tokens.textFaint, fontSize: 12.5 }}>
            {query ? `Sin resultados para "${query}"` : "Todavía no hay conceptos."}
          </div>
        ) : (
          filtered.map((item) => (
            <ConceptRow
              key={item.key}
              item={item}
              weeks={weeks}
              field={field}
              isTop={item.key === topKey}
              onRename={(label) => onRename(item.key, label)}
              onDelete={() => onDelete(item.key)}
            />
          ))
        )}
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
            background: adding || !nuevo.trim() ? tokens.textFaint : accent,
            color: "#fff",
            border: "none",
            borderRadius: 5,
            fontFamily: tokens.fontBody,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: adding || !nuevo.trim() ? "default" : "pointer",
            opacity: adding || !nuevo.trim() ? 0.6 : 1,
            transition: "background 0.15s ease",
          }}
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}

export default function CategoryManager({ incomeCats, expenseCats, weeks, onAdd, onRename, onDelete }) {
  const totalConceptos = incomeCats.length + expenseCats.length;
  const totalCustom = [...incomeCats, ...expenseCats].filter((i) => i.custom).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600, color: tokens.text, display: "flex", alignItems: "center", gap: 9 }}>
            <TagIcon size={19} color={tokens.gold} /> Conceptos
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, maxWidth: 640 }}>
            El plan de cuentas de fábrica (<Lock size={11} style={{ verticalAlign: -1 }} />) no se puede borrar ni renombrar, para
            mantener la comparabilidad histórica. Los conceptos que agregues acá quedan disponibles en "Movimientos" para
            cualquier fecha, sin tocar ningún archivo.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 74 }}>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.text }}>{totalConceptos}</div>
            <div style={{ fontSize: 9.5, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.4px" }}>Totales</div>
          </div>
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.rule}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 74 }}>
            <div style={{ fontFamily: tokens.fontMono, fontSize: 17, fontWeight: 700, color: tokens.gold }}>{totalCustom}</div>
            <div style={{ fontSize: 9.5, color: tokens.textFaint, textTransform: "uppercase", letterSpacing: "0.4px" }}>Propios</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <ConceptColumn
          title="Ingresos"
          accent={tokens.positive}
          Icon={TrendingUp}
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
          Icon={TrendingDown}
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
