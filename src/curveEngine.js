// src/curveEngine.js
// Motor de curva S para proyectos de obra.
// Mismo modelo validado número a número contra 2027_v2_0.xlsx:
//   monto(mes) = Presupuesto × [cos(π·x0) − cos(π·x1)] / 2
// donde x0/x1 son el avance de tiempo (0 a 1) al inicio y fin de ese mes.

export const MONTH_KEYS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
export const MONTH_LABELS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseMonthInput(str) {
  if (!str) return null;
  const [y, m] = String(str).split("-").map(Number);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, 1));
}

function nextMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Suma una cantidad fraccionaria de meses a una fecha (primer día de mes),
// interpolando por días dentro del mes de borde para plazos no enteros
// (por ejemplo, Duración base ÷ (Ritmo / 100) = 18.4 meses).
export function addMonthsFloat(date, monthsFloat) {
  const intM = Math.trunc(monthsFloat);
  let d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + intM, 1));
  const frac = monthsFloat - intM;
  if (Math.abs(frac) > 1e-9) {
    const dir = frac > 0 ? 1 : -1;
    const edge = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1));
    const span = Math.abs(daysBetween(d, edge));
    d = new Date(d.getTime() + dir * Math.abs(frac) * span * 86400000);
  }
  return d;
}

function curveAmountForMonth(total, start, end, monthDate) {
  if (!start || !end || !(end.getTime() > start.getTime()) || !total) return 0;
  const mEnd = nextMonth(monthDate);
  const x0 = clamp01(daysBetween(start, monthDate) / daysBetween(start, end));
  const x1 = clamp01(daysBetween(start, mEnd) / daysBetween(start, end));
  return total * (Math.cos(Math.PI * x0) - Math.cos(Math.PI * x1)) / 2;
}

export function fmtMonthYear(d) {
  if (!d) return "—";
  return MONTH_LABELS_ES[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

/**
 * Calcula los 12 valores mensuales de un proyecto para un año calendario,
 * a partir de Presupuesto total / Inicio ("YYYY-MM") / Duración base (meses) / Ritmo (%).
 * Ritmo 100% = plazo original. Ritmo < 100% estira el plazo (más lento);
 * Ritmo > 100% lo acorta.
 */
export function computeProjectCurve(total, inicioStr, duracionBase, ritmo, year) {
  const inicio = parseMonthInput(inicioStr);
  const monthly = {};
  MONTH_KEYS.forEach(k => { monthly[k] = 0; });

  if (!inicio || !duracionBase || duracionBase <= 0 || !total) {
    return { monthly, finEfectivo: null, finEfectivoLabel: "—", atraso: 0, plazoEfectivo: 0 };
  }

  const ritmoSeguro = Math.max(5, Number(ritmo) || 100);
  const plazoEfectivo = duracionBase * (100 / ritmoSeguro);
  const finEfectivo = addMonthsFloat(inicio, plazoEfectivo);

  MONTH_KEYS.forEach((k, i) => {
    const monthDate = new Date(Date.UTC(Number(year), i, 1));
    monthly[k] = Math.round(curveAmountForMonth(total, inicio, finEfectivo, monthDate));
  });

  return {
    monthly,
    finEfectivo,
    finEfectivoLabel: fmtMonthYear(finEfectivo),
    atraso: plazoEfectivo - duracionBase,
    plazoEfectivo,
  };
}
