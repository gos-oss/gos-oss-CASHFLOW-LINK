export const BASE_INCOME = [
  { key: "cuposNeuquen", label: "Cupos Neuquen" },
  { key: "cuposBoulevard", label: "Cupos Boulevard" },
  { key: "cupoDuo", label: "Cupo + Duo" },
  { key: "cupos300", label: "Cupos #300" },
  { key: "otrosIngresos", label: "Otros ingresos" },
  { key: "posiblesVentas", label: "Posibles ventas" },
  { key: "cobranzasCuotas", label: "Cobranzas cuotas" },
];

export const BASE_EXPENSE = [
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
  { key: "proveedores", label: "Proveedores" },
];

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const humanize = (key) =>
  key
    .replace(/^custom_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Los conceptos "custom" no viven en ninguna tabla propia: se detectan a partir
// de las claves que ya aparecen en cashflow_weeks.income / .expense. Así,
// agregar un concepto nuevo no requiere ninguna migración de base de datos:
// alcanza con que exista al menos un registro (aunque sea en $0) con esa clave.
export function discoverCategories(weeks, base, field) {
  const baseKeys = new Set(base.map((c) => c.key));
  const found = new Map();
  weeks.forEach((w) => {
    Object.keys(w[field] || {}).forEach((k) => {
      if (!baseKeys.has(k) && !found.has(k)) {
        found.set(k, { key: k, label: humanize(k), custom: true });
      }
    });
  });
  return [...base.map((c) => ({ ...c, custom: false })), ...Array.from(found.values())];
}

export function usageCount(weeks, field, key) {
  return weeks.filter((w) => w[field] && Object.prototype.hasOwnProperty.call(w[field], key)).length;
}
