// MOTOR DE DATOS Y CÁLCULO DE CUENTAS CORRIENTES — LINK INVERSIONES
// Generación de clientes desde ventas, planes de cuotas, variables de actualización,
// devengamiento mensual y cobranza.

export const PROYECTOS_CARTERA_CC = [
  "Torre 2 (300)",
  "Torre Corporativa (300)",
  "Torre Green",
  "Auria",
  "+ DUO",
  "DUO"
];

export const VARIABLES_ACTUALIZACION = [
  {
    id: "CAC",
    label: "Índice CAC General",
    short: "CAC",
    descripcion: "Actualización por coeficiente del Índice de la Construcción (Cámara Argentina de la Construcción).",
    unidadIndice: "pts CAC",
    defaultBase: 1425.6
  },
  {
    id: "INDICE_LINK",
    label: "Índice Link Inversiones",
    short: "Índice Link",
    descripcion: "Ajuste por Índice Propietario Link Inversiones (valorización patrimonial mensual).",
    unidadIndice: "pts Link",
    defaultBase: 118.4
  },
  {
    id: "IPC",
    label: "IPC (Inflación INDEC)",
    short: "IPC",
    descripcion: "Actualización por variación del Índice de Precios al Consumidor (INDEC).",
    unidadIndice: "pts / %",
    defaultBase: 100.0
  },
  {
    id: "USD_TC",
    label: "Dólar (Tipo de Cambio)",
    short: "U$D / TC",
    descripcion: "Cuota nominada o indexada al Tipo de Cambio vigente en cada devengamiento mensual.",
    unidadIndice: "$ / U$D",
    defaultBase: 1550.0
  },
  {
    id: "TASA_FIJA",
    label: "Tasa Fija Mensual (%)",
    short: "Tasa Fija",
    descripcion: "Actualización acumulativa por porcentaje mensual fijo pactado en boleto.",
    unidadIndice: "% / mes",
    defaultBase: 2.5
  },
  {
    id: "SIN_AJUSTE",
    label: "Sin Actualización (Cuota Fija)",
    short: "Sin Ajuste",
    descripcion: "Importe nominal fijo sin cláusula de reajuste por índice.",
    unidadIndice: "Fijo",
    defaultBase: 1
  }
];

export const MEDIOS_PAGO_CC = [
  "Transferencia Bancaria ARS",
  "Transferencia USD",
  "Efectivo USD",
  "Efectivo ARS",
  "Cheque / E-Cheq",
  "Canje / Compensación"
];

export const CONDICIONES_FISCALES = [
  "Consumidor Final",
  "Responsable Inscripto",
  "Monotributista",
  "Sociedad / Fideicomiso",
  "Exento"
];

export const generarId = (prefijo = "cc") =>
  `${prefijo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const NOMBRES_MESES_CORTOS = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
};

export function formatearPeriodoLabel(periodoYYYYMM) {
  if (!periodoYYYYMM || periodoYYYYMM.length < 7) return periodoYYYYMM || "—";
  const [y, m] = periodoYYYYMM.split("-");
  return `${NOMBRES_MESES_CORTOS[m] || m} ${y}`;
}

export function sumarMesesFecha(fechaISO, mesesASumar) {
  if (!fechaISO) return "";
  const parts = fechaISO.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return fechaISO;
  const [y, m, d] = parts;
  const targetMonthIndex = (m - 1) + mesesASumar;
  const dt = new Date(Date.UTC(y, targetMonthIndex, d));
  if (dt.getUTCDate() !== d) {
    // Ajuste al último día del mes (ej: 31 -> 28/30)
    const lastDay = new Date(Date.UTC(y, targetMonthIndex + 1, 0));
    return lastDay.toISOString().slice(0, 10);
  }
  return dt.toISOString().slice(0, 10);
}

/**
 * Calcula el coeficiente de ajuste y el importe actualizado de una cuota
 * según la variable de actualización pactada en la venta y el índice del período.
 */
export function calcularCuotaConIndice(cuota, venta, indicePeriodoValor) {
  const impOrig = Number(cuota.importe_original || 0);
  const variable = cuota.variable_actualizacion || venta?.variable_actualizacion || "SIN_AJUSTE";
  const indiceBase = Number(cuota.indice_base ?? venta?.indice_base ?? 0);
  const nroCuota = Number(cuota.nro_cuota || 0);

  // El anticipo (cuota 0) normalmente no devenga actualización si ya se pacta a fecha de boleto
  if (nroCuota === 0 || variable === "SIN_AJUSTE") {
    return {
      coeficiente: 1,
      indiceAplicado: indiceBase || 1,
      importeActualizado: Math.round(impOrig * 100) / 100
    };
  }

  if (variable === "TASA_FIJA") {
    const tasaMensual = Number(venta?.tasa_mensual_fija ?? indicePeriodoValor ?? indiceBase ?? 0);
    const coef = Math.pow(1 + Math.max(0, tasaMensual) / 100, Math.max(0, nroCuota));
    return {
      coeficiente: Number(coef.toFixed(6)),
      indiceAplicado: tasaMensual,
      importeActualizado: Math.round(impOrig * coef * 100) / 100
    };
  }

  // Variables por relación de índices (CAC, INDICE_LINK, IPC, USD_TC)
  const indAct = Number(indicePeriodoValor || 0);
  if (indiceBase > 0 && indAct > 0) {
    const coef = indAct / indiceBase;
    return {
      coeficiente: Number(coef.toFixed(6)),
      indiceAplicado: indAct,
      importeActualizado: Math.round(impOrig * coef * 100) / 100
    };
  }

  return {
    coeficiente: Number(cuota.coeficiente_ajuste || 1),
    indiceAplicado: Number(cuota.indice_aplicado || indiceBase || 0),
    importeActualizado: Math.round(impOrig * Number(cuota.coeficiente_ajuste || 1) * 100) / 100
  };
}

/**
 * Genera el cronograma completo de cuotas a partir de los datos de la venta.
 */
export function generarPlanCuotasVenta(venta) {
  const cuotas = [];
  const moneda = venta.moneda_origen || "ARS";
  const precioTotal = Number(venta.precio_total || 0);
  const anticipo = Math.max(0, Number(venta.anticipo || 0));
  const saldoFinanciar = Math.max(0, precioTotal - anticipo);
  const cantCuotas = Math.max(0, Math.floor(Number(venta.cantidad_cuotas || 0)));
  const variable = venta.variable_actualizacion || "SIN_AJUSTE";
  const indiceBase = Number(venta.indice_base || 0);
  const fechaVenta = venta.fecha_venta || "2026-11-12";
  const primerVenc = venta.fecha_primer_vencimiento || sumarMesesFecha(fechaVenta, 1);

  // Cuota 0: Anticipo / Boleto (si existe)
  if (anticipo > 0) {
    cuotas.push({
      id: generarId("cta"),
      venta_id: venta.id,
      cliente_id: venta.cliente_id,
      nro_cuota: 0,
      concepto: "Anticipo / Boleto",
      periodo: fechaVenta.slice(0, 7),
      fecha_vencimiento: fechaVenta,
      moneda,
      importe_original: Math.round(anticipo * 100) / 100,
      variable_actualizacion: "SIN_AJUSTE",
      indice_base: indiceBase,
      indice_aplicado: indiceBase,
      coeficiente_ajuste: 1,
      importe_actualizado: Math.round(anticipo * 100) / 100,
      monto_cobrado: 0,
      saldo_pendiente: Math.round(anticipo * 100) / 100,
      estado: "Devengada",
      devengado: true,
      fecha_devengamiento: fechaVenta
    });
  }

  // Cuotas 1..N
  if (cantCuotas > 0 && saldoFinanciar > 0) {
    const cuotaBase = Math.round((saldoFinanciar / cantCuotas) * 100) / 100;
    let acumulado = 0;

    for (let i = 1; i <= cantCuotas; i++) {
      const fechaVenc = sumarMesesFecha(primerVenc, i - 1);
      const periodo = fechaVenc.slice(0, 7);
      const importe = i === cantCuotas
        ? Math.round((saldoFinanciar - acumulado) * 100) / 100
        : cuotaBase;
      acumulado += importe;

      // Para Tasa Fija podemos precalcular el valor proyectado, pero el devengamiento oficial lo confirma
      const esTasaFija = variable === "TASA_FIJA";
      const tasa = Number(venta.tasa_mensual_fija || 0);
      const coefProy = esTasaFija ? Math.pow(1 + Math.max(0, tasa) / 100, i) : 1;
      const impAct = Math.round(importe * coefProy * 100) / 100;

      cuotas.push({
        id: generarId("cta"),
        venta_id: venta.id,
        cliente_id: venta.cliente_id,
        nro_cuota: i,
        concepto: `Cuota ${i}/${cantCuotas}`,
        periodo,
        fecha_vencimiento: fechaVenc,
        moneda,
        importe_original: importe,
        variable_actualizacion: variable,
        indice_base: indiceBase,
        indice_aplicado: esTasaFija ? tasa : indiceBase,
        coeficiente_ajuste: Number(coefProy.toFixed(6)),
        importe_actualizado: impAct,
        monto_cobrado: 0,
        saldo_pendiente: impAct,
        estado: "Proyectada",
        devengado: false,
        fecha_devengamiento: null
      });
    }
  }

  return cuotas;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATOS INICIALES DE CARTERA (Para demostración operativa inmediata y editable)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CC_CLIENTES = [
  {
    id: "cli_1",
    nombre: "Estudio Jurídico Álvarez & Asoc. S.R.L.",
    dni_cuit: "30-71458920-4",
    email: "administracion@alvarezasoc.com.ar",
    telefono: "+54 9 381 452-8810",
    domicilio: "Av. Mate de Luna 1840, Piso 4, S.M. de Tucumán",
    condicion_fiscal: "Responsable Inscripto",
    observaciones: "Comprador corporativo Torre Corporativa. Pago habitual vía transferencia.",
    created_at: "2026-08-15"
  },
  {
    id: "cli_2",
    nombre: "Martín Ignacio Paz Posse",
    dni_cuit: "20-32841905-8",
    email: "martinpazposse@gmail.com",
    telefono: "+54 9 381 519-3342",
    domicilio: "Crisóstomo Álvarez 912, S.M. de Tucumán",
    condicion_fiscal: "Consumidor Final",
    observaciones: "Inversor Torre Green. Cuotas actualizadas por Índice CAC General.",
    created_at: "2026-09-10"
  },
  {
    id: "cli_3",
    nombre: "Valentina Sofía Terán",
    dni_cuit: "27-35910284-3",
    email: "valen.teran@arquitectura.com.ar",
    telefono: "+54 9 381 602-1190",
    domicilio: "Las Heras 420, Yerba Buena",
    condicion_fiscal: "Monotributista",
    observaciones: "Adquirente de unidad residencial en + DUO con plan a 24 cuotas Índice Link.",
    created_at: "2026-10-05"
  }
];

export const DEFAULT_CC_VENTAS = [
  {
    id: "vta_1",
    codigo: "OP-2026-001",
    fecha_venta: "2026-09-15",
    cliente_id: "cli_1",
    proyecto: "Torre Corporativa (300)",
    unidad_id: "",
    unidad_nombre: "Oficina Piso 8 · Mod B + Cochera",
    moneda_origen: "ARS",
    precio_total: 186000000,
    anticipo: 55800000,
    saldo_financiar: 130200000,
    cantidad_cuotas: 12,
    fecha_primer_vencimiento: "2026-10-15",
    variable_actualizacion: "CAC",
    indice_base: 1410.2,
    tasa_mensual_fija: 0,
    estado: "Activa",
    notas: "Boleto firmado con 30% anticipo y 12 cuotas ajustables por CAC General."
  },
  {
    id: "vta_2",
    codigo: "OP-2026-002",
    fecha_venta: "2026-10-01",
    cliente_id: "cli_2",
    proyecto: "Torre Green",
    unidad_id: "",
    unidad_nombre: "Depto 2 Dormitorios · Piso 6 A",
    moneda_origen: "USD",
    precio_total: 138000,
    anticipo: 48000,
    saldo_financiar: 90000,
    cantidad_cuotas: 24,
    fecha_primer_vencimiento: "2026-11-05",
    variable_actualizacion: "SIN_AJUSTE",
    indice_base: 1,
    tasa_mensual_fija: 0,
    estado: "Activa",
    notas: "Operación en dólares billete fijos, anticipo integrado + 24 cuotas mensuales."
  },
  {
    id: "vta_3",
    codigo: "OP-2026-003",
    fecha_venta: "2026-10-18",
    cliente_id: "cli_3",
    proyecto: "+ DUO",
    unidad_id: "",
    unidad_nombre: "Depto 1 Dormitorio · Piso 4 C",
    moneda_origen: "ARS",
    precio_total: 116250000,
    anticipo: 34875000,
    saldo_financiar: 81375000,
    cantidad_cuotas: 24,
    fecha_primer_vencimiento: "2026-11-10",
    variable_actualizacion: "INDICE_LINK",
    indice_base: 116.5,
    tasa_mensual_fija: 0,
    estado: "Activa",
    notas: "Financiación directa desarrolladora con ajuste mensual por Índice Link."
  }
];

function construirSeedInicial() {
  const cuotas = [];
  const cobranzas = [];

  DEFAULT_CC_VENTAS.forEach((v) => {
    const plan = generarPlanCuotasVenta(v);
    plan.forEach((c) => {
      // Marcar anticipos y cuotas de oct-2026 como devengadas y cobradas
      if (c.nro_cuota === 0) {
        c.estado = "Cobrada";
        c.devengado = true;
        c.monto_cobrado = c.importe_actualizado;
        c.saldo_pendiente = 0;
        cobranzas.push({
          id: `cob_${v.id}_0`,
          fecha_cobro: v.fecha_venta,
          periodo_cobro: v.fecha_venta.slice(0, 7),
          cliente_id: v.cliente_id,
          venta_id: v.id,
          cuota_id: c.id,
          nro_cuota: 0,
          medio_pago: v.moneda_origen === "USD" ? "Transferencia USD" : "Transferencia Bancaria ARS",
          moneda_pago: v.moneda_origen,
          tc_aplicado: 1550,
          importe_pagado: c.importe_actualizado,
          importe_ars_equivalente: v.moneda_origen === "USD" ? c.importe_actualizado * 1550 : c.importe_actualizado,
          referencia: `REC-${v.codigo}-ANT`,
          sincronizado_cashflow: false,
          observaciones: "Integración de anticipo a la firma de boleto."
        });
      } else if (c.periodo === "2026-10") {
        // Cuota 1 de OP-001 (Oct 2026) devengada con CAC 1438.4 y cobrada
        const indOct = 1438.4;
        const calc = calcularCuotaConIndice(c, v, indOct);
        c.indice_aplicado = calc.indiceAplicado;
        c.coeficiente_ajuste = calc.coeficiente;
        c.importe_actualizado = calc.importeActualizado;
        c.devengado = true;
        c.fecha_devengamiento = "2026-10-01";
        c.monto_cobrado = calc.importeActualizado;
        c.saldo_pendiente = 0;
        c.estado = "Cobrada";

        cobranzas.push({
          id: `cob_${v.id}_1`,
          fecha_cobro: "2026-10-15",
          periodo_cobro: "2026-10",
          cliente_id: v.cliente_id,
          venta_id: v.id,
          cuota_id: c.id,
          nro_cuota: c.nro_cuota,
          medio_pago: "Transferencia Bancaria ARS",
          moneda_pago: "ARS",
          tc_aplicado: 1550,
          importe_pagado: calc.importeActualizado,
          importe_ars_equivalente: calc.importeActualizado,
          referencia: `REC-${v.codigo}-C01`,
          sincronizado_cashflow: false,
          observaciones: "Cobranza mensual cuota 1 con ajuste CAC."
        });
      } else if (c.periodo === "2026-11" && v.id === "vta_1") {
        // Cuota 2 de OP-001 (Nov 2026) ya devengada y lista para cobrar este mes
        const indNov = 1468.9;
        const calc = calcularCuotaConIndice(c, v, indNov);
        c.indice_aplicado = calc.indiceAplicado;
        c.coeficiente_ajuste = calc.coeficiente;
        c.importe_actualizado = calc.importeActualizado;
        c.saldo_pendiente = calc.importeActualizado;
        c.devengado = true;
        c.fecha_devengamiento = "2026-11-01";
        c.estado = "Devengada";
      }
      cuotas.push(c);
    });
  });

  return { cuotas, cobranzas };
}

const seed = construirSeedInicial();
export const DEFAULT_CC_CUOTAS = seed.cuotas;
export const DEFAULT_CC_COBRANZAS = seed.cobranzas;
