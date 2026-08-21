import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { tokens } from "./tokens";

const todayISO = () => new Date().toISOString().slice(0, 10);

const mondayOf = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Dom..6=Sab
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const shortLabel = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
};

// Arma una ventana rodante de 13 semanas (lunes a domingo) a partir de "hoy"
// (o de la fecha de corte, si hay una cargada), agregando los movimientos
// diarios ya guardados en cada semana correspondiente.
export function useSemanas13(procesadas, fechaSaldo, saldoEfectivo, saldoBanco) {
  return useMemo(() => {
    if (procesadas.length === 0) return [];
    const anchor = fechaSaldo || todayISO();
    const startMonday = mondayOf(anchor);

    let saldoPrevio = Number(saldoEfectivo || 0) + Number(saldoBanco || 0);
    const antes = procesadas.filter((w) => w.week_start < startMonday);
    if (antes.length) saldoPrevio = antes[antes.length - 1].saldoAcumulado;

    const semanas = [];
    for (let i = 0; i < 13; i++) {
      const wStart = addDays(startMonday, i * 7);
      const wEnd = addDays(wStart, 6);
      const dias = procesadas.filter((w) => w.week_start >= wStart && w.week_start <= wEnd);
      const ingresos = dias.reduce((a, d) => a + d.totalIngresos, 0);
      const egresos = dias.reduce((a, d) => a + d.totalEgresos, 0);
      const posicion = ingresos - egresos;
      const saldoFinal = dias.length ? dias[dias.length - 1].saldoAcumulado : saldoPrevio + posicion;
      saldoPrevio = saldoFinal;
      semanas.push({
        n: i + 1,
        weekStart: wStart,
        weekEnd: wEnd,
        ingresos,
        egresos,
        posicion,
        saldoFinal,
        conDatos: dias.length > 0,
        esActual: wStart <= todayISO() && todayISO() <= wEnd,
      });
    }
    return semanas;
  }, [procesadas, fechaSaldo, saldoEfectivo, saldoBanco]);
}

export default function Cash13Semanas({ semanas, fmt }) {
  if (semanas.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px", background: tokens.surface, borderRadius: 10, border: `1px dashed ${tokens.rule}` }}>
        <p style={{ fontSize: 13.5, color: tokens.textMuted, margin: 0 }}>
          Cargá al menos un movimiento en "Movimientos" para ver la ventana de 13 semanas.
        </p>
      </div>
    );
  }

  const minSaldo = Math.min(...semanas.map((s) => s.saldoFinal));
  const chartData = semanas.map((s) => ({ name: shortLabel(s.weekStart), saldo: Math.round(s.saldoFinal) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 4px 0", fontFamily: tokens.fontDisplay, fontSize: 22, fontWeight: 600, color: tokens.text }}>
          Cash 13 semanas
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>
          Ventana rodante de {semanas[0].weekStart} a {semanas[12].weekEnd}, agregando los movimientos diarios por semana calendario (lunes a domingo).
        </p>
      </div>

      <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${tokens.rule}`, padding: 24 }}>
        <h3 style={{ margin: "0 0 18px 0", fontFamily: tokens.fontDisplay, fontSize: 16, fontWeight: 600 }}>Saldo proyectado — 13 semanas</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSaldo13" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.positive} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={tokens.positive} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.ruleSoft} />
              <XAxis dataKey="name" tick={{ fill: tokens.textFaint, fontSize: 11, fontFamily: tokens.fontMono }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: tokens.textFaint, fontSize: 11, fontFamily: tokens.fontMono }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + fmt(v)} width={72} />
              <ReferenceLine y={0} stroke={tokens.negative} strokeDasharray="3 3" />
              <Tooltip formatter={(v) => ["$ " + fmt(v), "Saldo"]} contentStyle={{ borderRadius: 6, border: `1px solid ${tokens.rule}`, fontSize: 12.5, fontFamily: tokens.fontBody, fontWeight: 600 }} />
              <Area type="monotone" dataKey="saldo" stroke={tokens.positive} strokeWidth={2.5} fill="url(#colorSaldo13)" activeDot={{ r: 5, strokeWidth: 0, fill: tokens.ink }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: tokens.surface, borderRadius: 10, border: `1px solid ${tokens.rule}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${tokens.rule}`, background: tokens.paper }}>
          <h3 style={{ margin: 0, fontFamily: tokens.fontDisplay, fontSize: 15, fontWeight: 600 }}>Detalle por semana</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ color: tokens.textFaint, borderBottom: `2px solid ${tokens.rule}` }}>
                <th style={{ padding: "12px 14px", textAlign: "left", fontFamily: tokens.fontBody, fontWeight: 700 }}>Semana</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontFamily: tokens.fontBody, fontWeight: 700 }}>Rango</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontFamily: tokens.fontBody, fontWeight: 700 }}>Ingresos</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontFamily: tokens.fontBody, fontWeight: 700 }}>Egresos</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontFamily: tokens.fontBody, fontWeight: 700 }}>Posición</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontFamily: tokens.fontBody, fontWeight: 700 }}>Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((s) => (
                <tr key={s.weekStart} className="flujo-row" style={{ borderBottom: `1px solid ${tokens.ruleSoft}`, background: s.esActual ? tokens.goldSoft : "transparent" }}>
                  <td style={{ padding: "10px 14px", fontFamily: tokens.fontBody, color: tokens.text, fontWeight: s.esActual ? 700 : 500 }}>
                    S{s.n} {s.esActual && <span style={{ fontSize: 9.5, color: tokens.gold, fontWeight: 700, marginLeft: 4 }}>ACTUAL</span>}
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: tokens.fontMono, color: tokens.textMuted }}>
                    {shortLabel(s.weekStart)} – {shortLabel(s.weekEnd)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.positive }}>
                    {s.conDatos ? fmt(s.ingresos) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: tokens.fontMono, color: tokens.negative }}>
                    {s.conDatos ? fmt(s.egresos) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 600, color: s.posicion >= 0 ? tokens.positive : tokens.negative }}>
                    {s.conDatos ? fmt(s.posicion) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: tokens.fontMono, fontWeight: 700, color: s.saldoFinal < 0 ? tokens.negative : tokens.text }}>
                    {fmt(s.saldoFinal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {minSaldo < 0 && (
        <div style={{ background: tokens.negativeSoft, border: `1px solid #E3B3A6`, borderRadius: 8, padding: "12px 16px", fontSize: 12.5, color: "#7A2B1E" }}>
          ⚠ El saldo proyectado cae por debajo de cero en al menos una semana de la ventana (mínimo: $ {fmt(minSaldo)}).
        </div>
      )}
    </div>
  );
}
