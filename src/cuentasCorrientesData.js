// MOTOR DE DATOS Y CÁLCULO DE CUENTAS CORRIENTES — LINK INVERSIONES
// Cartera oficial real al 30/11/2026 (80 operaciones financiadas), generación de clientes
// desde ventas, planes de cuotas, variables de actualización, devengamiento mensual y cobranza.

export const PROYECTOS_CARTERA_CC = [
  "TORRE BLUE",
  "TORRE GREEN",
  "ISAURA",
  "DUO",
  "+DUO",
  "#300",
  "BOULEVARD",
  "VITTALIA",
  "Auria"
];

export const ASIGNACIONES_CC = [
  "PROYECTO",
  "LINK HONORARIOS",
  "CUPO LINK",
  "EX SP"
];

export const SEGMENTACIONES_MOROSIDAD = [
  "AL DIA",
  "VENCIDO 30 DIAS",
  "VENCIDO 30 - 60 DIAS",
  "VENCIDO + 60 DIAS"
];

export const VARIABLES_ACTUALIZACION = [
  {
    id: "CAC",
    label: "Índice CAC General",
    short: "CAC",
    descripcion: "Actualización por coeficiente del Índice de la Construcción (Cámara Argentina de la Construcción).",
    unidadIndice: "pts CAC",
    defaultBase: 1468.9
  },
  {
    id: "INDICE_LINK",
    label: "Índice Link Inversiones",
    short: "Índice Link",
    descripcion: "Ajuste por Índice Propietario Link Inversiones (valorización patrimonial mensual).",
    unidadIndice: "pts Link",
    defaultBase: 121.0
  },
  {
    id: "IPC",
    label: "IPC (Inflación INDEC)",
    short: "IPC",
    descripcion: "Actualización por variación del Índice de Precios al Consumidor (INDEC).",
    unidadIndice: "pts / %",
    defaultBase: 105.4
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

export function parseDMYtoISO(dmy) {
  if (!dmy || typeof dmy !== "string") return "";
  const clean = dmy.trim();
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts.map((x) => x.trim());
  if (!d || !m || !y) return "";
  return `${y.padStart(4, "20")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function sumarMesesFecha(fechaISO, mesesASumar) {
  if (!fechaISO) return "";
  const parts = fechaISO.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return fechaISO;
  const [y, m, d] = parts;
  const targetMonthIndex = (m - 1) + mesesASumar;
  const dt = new Date(Date.UTC(y, targetMonthIndex, d));
  if (dt.getUTCDate() !== d) {
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
 * Genera el cronograma completo de cuotas a partir de los datos de una nueva venta.
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
// CARTERA REAL OFICIAL AL 30/11/2026 (80 OPERACIONES CARGADAS DESDE PLANILLA)
// Formato de tupla:
// [cliente, proyecto, unidad, asignacion, condicion, cuotasTotal, cuotasPend,
//  vtoAnt, vtoAct, cobroAnt, cobroAct, retAnt, retAct, retTot, morosidad, segmentacion,
//  saldoVencAnt, cuotaMes, adelanto, ingresoNvaVta, totalCobrar, cuotaSaldoAVenc, saldoFinMes, saldoAVencer]
// ═══════════════════════════════════════════════════════════════════════════

const RAW_CARTERA_2026_11 = [
  ["GUTIERREZ WALTER / GOMEZ PA", "TORRE BLUE", "1° D", "PROYECTO", "FINANCIADO", 120, 14, "10/10/2026", "10/11/2026", "13/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 735915, 0, 0, 735915, 735915, 735915, 11038729],
  ["MOYA CAROLINA", "TORRE BLUE", "2° D", "PROYECTO", "FINANCIADO", 127, 10, "10/10/2026", "10/11/2026", "20/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 606921, 0, 0, 606921, 1868190, 606921, 19288823],
  ["OÑATE EDUARDO", "TORRE BLUE", "5°D", "PROYECTO", "FINANCIADO", 100, 13, "10/10/2026", "10/11/2026", "6/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1292721, 0, 0, 1292721, 1292721, 1292721, 18098092],
  ["SILBERMAN IARDENA", "TORRE BLUE", "7° F", "PROYECTO", "FINANCIADO", 120, 6, "10/10/2026", "10/11/2026", "30/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1544400, 0, 0, 1544400, 1544400, 1544400, 10810800],
  ["GOMEZ JOSE", "TORRE GREEN", "1°D", "PROYECTO", "FINANCIADO", 15, 7, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 1853813, 1240980, 0, 0, 3094793, 1240980, 3094793, 11781651],
  ["MAX FOIS ALEJANDRO", "TORRE GREEN", "2° A", "LINK HONORARIOS", "FINANCIADO", 66, 7, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 22661715, 1295369, 0, 0, 23957084, 1295369, 23957084, 33024669],
  ["GODOY NANCY EDITH", "TORRE GREEN", "2° B", "PROYECTO", "FINANCIADO", 121, 13, "10/10/2026", "10/11/2026", "19/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 697658, 0, 0, 697658, 697658, 697658, 9767217],
  ["BURGOS - MIÑAURA LUCIANA", "TORRE GREEN", "3° A", "LINK HONORARIOS", "FINANCIADO", 121, 7, "10/10/2026", "10/11/2026", "16/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 933179, 0, 0, 933179, 933179, 933179, 7465430],
  ["MAX FOIS ALEJANDRO", "TORRE GREEN", "4° A", "PROYECTO", "FINANCIADO", 130, 11, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 7536870, 785680, 0, 0, 8322550, 785680, 8322550, 16965026],
  ["RODRIGUEZ REY JIMENA", "TORRE GREEN", "4° B", "PROYECTO", "FINANCIADO", 130, 11, "10/10/2026", "10/11/2026", "14/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 624180, 0, 0, 624180, 624234, 624180, 7490754],
  ["PAUL GUTIERREZ IVAN", "TORRE GREEN", "5°A", "PROYECTO", "FINANCIADO", 48, 24, "27/10/2026", "27/11/2026", "9/10/2026", "", 16, 0, 16, "VENCIDO", "VENCIDO 30 DIAS", 10430150, 2628846, 0, 0, 13058996, 2628846, 13058996, 76151300],
  ["IGLESIAS TOMAS", "TORRE GREEN", "5° B", "PROYECTO", "FINANCIADO", 130, 8, "", "12/12/2026", "", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 0, 0, 0, 0, 0, 0, 0],
  ["GORDILLO CLAUDIO", "TORRE GREEN", "5° D", "PROYECTO", "FINANCIADO", 36, 33, "25/10/2026", "25/11/2026", "19/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1243062, 0, 0, 1243062, 1243062, 1243062, 42264113],
  ["STEUDTNER MARTIN", "TORRE GREEN", "6° A", "PROYECTO", "FINANCIADO", 130, 8, "", "10/7/2027", "", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 0, 0, 0, 0, 0, 0, 0],
  ["BENITO IRENE", "TORRE GREEN", "6° B", "PROYECTO", "FINANCIADO", 130, 12, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 460167, 0, 0, 460167, 458079, 460167, 5957117],
  ["IEZZI ALEJANDRO ARIEL", "TORRE GREEN", "6°D", "PROYECTO", "FINANCIADO", 18, 2, "10/10/2026", "10/11/2026", "10/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 4088242, 0, 0, 4088242, 4088242, 4088242, 12264725],
  ["LABITZQUE GUSTAVO /CARRASC", "TORRE GREEN", "7° A", "PROYECTO", "FINANCIADO", 125, 12, "10/10/2026", "10/11/2026", "17/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1053150, 0, 0, 1053150, 1053150, 1053150, 13690944],
  ["IGLESIAS TOMAS", "TORRE GREEN", "7° B", "PROYECTO", "FINANCIADO", 130, 8, "", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 0, 0, 0, 0, 0, 0, 0],
  ["TOLEDO JORGE LUIS", "TORRE GREEN", "8° A", "PROYECTO", "FINANCIADO", 36, 24, "15/10/2026", "15/11/2026", "15/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1993822, 0, 0, 1993822, 3322698, 1993822, 81738562],
  ["GONZALEZ FRAILE / ROSSI INES", "TORRE GREEN", "9° B", "PROYECTO", "FINANCIADO", 107, 12, "10/10/2026", "10/11/2026", "14/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 762627, 0, 0, 762627, 764280, 762627, 9933987],
  ["SEITA DIEGO", "TORRE GREEN", "9° D", "PROYECTO", "FINANCIADO", 36, 22, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 2900552, 0, 0, 2900552, 2900551, 2900552, 66712680],
  ["MAUGERI MARÍA FLORENCIA", "TORRE GREEN", "12°D", "PROYECTO", "FINANCIADO", 48, 21, "10/10/2026", "10/11/2026", "26/10/2026", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 8442056, 3151666, 0, 0, 11593722, 3151666, 11593722, 77778712],
  ["PEREZ VALDEZ", "TORRE GREEN", "13° B", "PROYECTO", "FINANCIADO", 24, 19, "10/10/2026", "10/11/2026", "21/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 519374, 0, 0, 519374, 519374, 519374, 10387471],
  ["MEDINA/JALDO MARIA FERNANDA", "ISAURA", "COCH 3", "PROYECTO", "FINANCIADO", 51, 13, "10/10/2026", "10/11/2026", "28/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 437772, 0, 0, 437772, 441219, 437772, 6173618],
  ["PAZ FEDERICO", "ISAURA", "4°A", "PROYECTO", "FINANCIADO", 47, 9, "10/10/2026", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1087080, 0, 0, 1087080, 1087080, 1087080, 10870803],
  ["MAMANI HERNAN PABLO", "ISAURA", "6°D", "PROYECTO", "FINANCIADO", 60, 14, "10/10/2026", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1373094, 0, 0, 1373094, 1373094, 1373094, 20596404],
  ["PAZ FEDERICO", "ISAURA", "8°E", "PROYECTO", "FINANCIADO", 47, 9, "10/10/2026", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 949079, 0, 0, 949079, 949079, 949079, 9490790],
  ["PAZ FEDERICO", "ISAURA", "8°F", "PROYECTO", "FINANCIADO", 47, 9, "10/10/2026", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1062699, 0, 0, 1062699, 1062699, 1062699, 10626986],
  ["CLERICI LILIANA", "ISAURA", "11°D", "PROYECTO", "FINANCIADO", 120, 6, "10/10/2026", "10/11/2026", "13/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1581158, 0, 0, 1581158, 1581160, 1581158, 11068116],
  ["ALBORNOZ FERNANDO", "ISAURA", "12°B", "PROYECTO", "FINANCIADO", 68, 7, "10/10/2026", "10/11/2026", "23/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 2010590, 0, 0, 2010590, 2010804, 2010590, 16086220],
  ["MEDINA/JALDO MARIA FERNANDA", "ISAURA", "13 y 14 E", "PROYECTO", "FINANCIADO", 42, 13, "10/10/2026", "10/11/2026", "28/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1884565, 0, 0, 1884565, 1884565, 1884565, 26383912],
  ["SALVARREDY LILIANA", "ISAURA", "5° C", "PROYECTO", "FINANCIADO", 120, 12, "10/10/2026", "10/11/2026", "6/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1974201, 0, 0, 1974201, 1974201, 1974201, 25664616],
  ["URGEL CAMÚ HUGO SEBASTIAN", "DUO", "7H", "PROYECTO", "FINANCIADO", 60, 24, "10/10/2026", "10/11/2026", "30/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 989254, 0, 0, 989254, 985117, 989254, 24632069],
  ["MENA JUAN JAVIER", "DUO", "10 D", "PROYECTO", "FINANCIADO", 52, 1, "10/10/2026", "10/11/2026", "19/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3632706, 0, 0, 3632706, 3632706, 3632706, 7265412],
  ["MONAYER JOSE LUIS", "DUO", "15 G", "PROYECTO", "FINANCIADO", 60, 16, "10/10/2026", "10/11/2026", "27/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1780446, 0, 0, 1780446, 1780446, 1780446, 30267574],
  ["ARREDONDO JORGE GUSTAVO", "DUO", "17 J", "PROYECTO", "FINANCIADO", 36, 14, "10/10/2026", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 2765663, 0, 0, 2765663, 2765663, 2765663, 41484942],
  ["PINTO FATIMA", "+DUO", "1°B + 1°C", "PROYECTO", "FINANCIADO", 36, 36, "", "10/12/2026", "30/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 0, 0, 30000000, 30000000, 0, 0, 0],
  ["AUTINO ADRIAN", "+DUO", "2°C", "PROYECTO", "FINANCIADO", 36, 35, "", "10/11/2026", "13/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1457592, 0, 0, 1457592, 1457592, 1457592, 52473320],
  ["WAISMAN ROBERTO", "+DUO", "3°B", "CUPO LINK", "FINANCIADO", 40, 25, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 3262714, 1631366, 0, 0, 4894080, 1631366, 4894080, 45678226],
  ["CONTRERAS CAROLINA ISABEL", "+DUO", "3°C", "CUPO LINK", "FINANCIADO", 40, 24, "10/10/2026", "10/11/2026", "14/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1462958, 0, 0, 1462958, 1463666, 1462958, 36590943],
  ["BRUNET MICHAL MARIANO", "+DUO", "3°G", "PROYECTO", "FINANCIADO", 24, 14, "10/10/2026", "10/11/2026", "6/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1025050, 0, 0, 1025050, 1025050, 1025050, 15375752],
  ["BONANNO ESTEBAN JOSE DEL VA", "+DUO", "4°C", "CUPO LINK", "FINANCIADO", 36, 19, "10/10/2026", "10/11/2026", "14/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 323264, 0, 0, 323264, 328675, 323264, 6568093],
  ["BORDALLO PIERO", "+DUO", "4°D", "PROYECTO", "FINANCIADO", 36, 23, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 2398606, 2398606, 0, 0, 4797212, 2398606, 4797212, 59965150],
  ["APESTEY GASTON", "+DUO", "4°F", "PROYECTO", "FINANCIADO", 36, 31, "10/10/2026", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 948379, 0, 0, 948379, 948379, 948379, 30348121],
  ["GONZALEZ MARTIN", "+DUO", "5°D", "PROYECTO", "FINANCIADO", 36, 23, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 2398606, 2398606, 0, 0, 4797212, 2398606, 4797212, 59965150],
  ["PETRINO PABLO", "+DUO", "8°B", "CUPO LINK", "FINANCIADO", 42, 30, "10/10/2026", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1278023, 0, 0, 1278023, 1278023, 1278023, 39618715],
  ["BRANDAN MARIANA", "+DUO", "8°G", "PROYECTO", "FINANCIADO", 24, 21, "25/10/2026", "25/11/2026", "26/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 572912, 0, 0, 572912, 572912, 572912, 12604061],
  ["FLORES LOURDES", "+DUO", "9°G", "EX SP", "FINANCIADO", 36, 33, "25/10/2026", "25/11/2026", "23/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1420051, 0, 0, 1420051, 1420067, 1420051, 48282260],
  ["FRANCO ROSAS IVONNE", "+DUO", "10°F", "PROYECTO", "FINANCIADO", 24, 14, "10/10/2026", "10/11/2026", "16/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3035455, 0, 0, 3035455, 3035299, 3035455, 45529641],
  ["FLORES LOURDES", "+DUO", "10°G", "EX SP", "FINANCIADO", 36, 33, "25/10/2026", "25/11/2026", "23/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1420051, 0, 0, 1420051, 1420067, 1420051, 48282260],
  ["OLEA MARCELA", "+DUO", "16°G", "PROYECTO", "FINANCIADO", 36, 34, "20/10/2026", "10/11/2026", "19/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 836709, 0, 0, 836709, 836709, 836709, 29284819],
  ["MAUGERI ROMINA CARLA", "+DUO", "17°D", "CUPO LINK", "FINANCIADO", 40, 25, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 2520822, 0, 0, 2520822, 2520846, 2520822, 65541977],
  ["BOETTO MATIAS", "+DUO", "17°F", "PROYECTO", "FINANCIADO", 36, 34, "20/10/2026", "25/11/2026", "20/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 836709, 0, 0, 836709, 836709, 836709, 29284809],
  ["BOETTO MIGUEL", "+DUO", "17°G", "PROYECTO", "FINANCIADO", 36, 34, "20/10/2026", "25/11/2026", "15/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1330785, 0, 0, 1330785, 1330785, 1330785, 46577478],
  ["HERRERA DEOLINDA GRACIELA C", "+DUO", "18°F", "PROYECTO", "FINANCIADO", 36, 35, "", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 857782, 0, 0, 857782, 857782, 857782, 30880143],
  ["ROMERO DE LA PEÑA", "#300", "T2 COCH 50", "PROYECTO", "FINANCIADO", 12, 3, "10/10/2026", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 2297293, 0, 0, 2297293, 2297293, 1446051, 8337929],
  ["BORELLI DE LANGHE HUGO GALO", "#300", "T2 COCH 53", "PROYECTO", "FINANCIADO", 26, 1, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 3514285, 824062, 0, 0, 4338347, 824062, 4338347, 5162409],
  ["BORELLI DE LANGHE HUGO GALO", "#300", "T2 5°E", "PROYECTO", "FINANCIADO", 26, 1, "10/10/2026", "10/11/2026", "", "", 33, 2, 35, "VENCIDO", "VENCIDO 30 - 60 DIAS", 29025203, 6806100, 0, 0, 35831303, 6806100, 35831303, 42637402],
  ["SALVATIERRA MARIA INÉS", "#300", "T3 PB D", "CUPO LINK", "FINANCIADO", 34, 18, "10/10/2026", "10/11/2026", "6/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1496300, 0, 0, 1496300, 1496301, 1496300, 28429713],
  ["GARZON PILAR", "#300", "T3 COCH 16", "LINK HONORARIOS", "FINANCIADO", 56, 0, "10/10/2026", "10/11/2026", "13/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 1093857, 0, 0, 1093857, 0, 1093857, 1093857],
  ["PEZZA LUIS GUIDO", "#300", "T3 COCH 23 + 1°B", "CUPO LINK", "FINANCIADO", 48, 32, "10/10/2026", "10/11/2026", "8/10/2026", "6/11/2026", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 3235846, 0, 0, 3235846, 3235845, 0, 103547046],
  ["MARTIN CALLERI", "#300", "T3 COCH 33 + 3°D", "PROYECTO", "FINANCIADO", 6, 0, "10/10/2026", "10/11/2026", "27/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 8500734, 0, 0, 8500734, 0, 8500734, 8500734],
  ["GUERRERO ERIKA", "#300", "T3 2°C", "PROYECTO", "FINANCIADO", 36, 30, "10/10/2026", "10/11/2026", "7/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3352297, 0, 0, 3352297, 3352031, 3352297, 103913220],
  ["GARZON PILAR", "#300", "T3 2°E", "CUPO LINK", "FINANCIADO", 56, 0, "10/10/2026", "10/11/2026", "13/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 5167235, 0, 0, 5167235, 0, 5167235, 5167235],
  ["CARRIZO GUSTAVO", "#300", "T3 3°C", "PROYECTO", "FINANCIADO", 36, 28, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3678760, 0, 0, 3678760, 3678759, 3678760, 106684024],
  ["NIEVA JAVIER MARCELO", "#300", "T3 4°F", "LINK HONORARIOS", "FINANCIADO", 33, 26, "10/10/2026", "10/11/2026", "30/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3437075, 0, 0, 3437075, 3437838, 3437075, 92820873],
  ["RIVAS MARTA", "#300", "T3 4E", "LINK HONORARIOS", "FINANCIADO", 18, 16, "10/10/2026", "10/11/2026", "23/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 918112, 0, 0, 918112, 918112, 918112, 15607900],
  ["RAUL PILIPONSKY", "#300", "T3 5B", "LINK HONORARIOS", "FINANCIADO", 16, 9, "10/10/2026", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1900309, 0, 0, 1900309, 1907017, 1900309, 19063458],
  ["DEL PERO ENRIQUE", "#300", "T4 COCH 9 + 3 D", "CUPO LINK", "FINANCIADO", 36, 34, "20/10/2026", "20/11/2026", "20/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 6594230, 0, 0, 6594230, 6594214, 6594230, 230797504],
  ["SANTOS JUAN MANUEL", "BOULEVARD", "TR COCH R31 + 1°C", "PROYECTO", "FINANCIADO", 9, 8, "", "10/11/2026", "9/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 25657500, 0, 0, 25657500, 25657500, 25657500, 230917500],
  ["MARCIAL MAIRA BELÉN Y ENZO", "BOULEVARD", "TR COCH R1", "CUPO LINK", "FINANCIADO", 36, 12, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1242780, 0, 0, 1242780, 1242756, 1242780, 16155853],
  ["MARCIAL MAIRA BELÉN Y ENZO", "BOULEVARD", "TR 2°C", "CUPO LINK", "FINANCIADO", 36, 12, "10/10/2026", "10/11/2026", "8/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 7561994, 0, 0, 7561994, 7561851, 7561994, 98304207],
  ["NADAL LORENA", "BOULEVARD", "TR 1°E", "PROYECTO", "FINANCIADO", 40, 36, "10/10/2026", "10/11/2026", "22/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1908641, 0, 0, 1908641, 1908640, 1908641, 70619695],
  ["LLABRA GREGORIO", "BOULEVARD", "TR 1°D", "PROYECTO", "FINANCIADO", 36, 31, "22/10/2026", "22/11/2026", "21/10/2026", "", 0, 0, 0, "NO VENCIDO", "AL DIA", 0, 4319679, 0, 0, 4319679, 4319242, 4319679, 138216191],
  ["QUIROGA MARIA PAULA", "BOULEVARD", "TR 2°D", "CUPO LINK", "FINANCIADO", 48, 32, "10/10/2026", "10/11/2026", "7/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3897255, 0, 0, 3897255, 3897255, 3897255, 128609402],
  ["PILLITTERI FRANCO", "BOULEVARD", "TR 3°C", "PROYECTO", "FINANCIADO", 42, 37, "20/10/2026", "20/11/2026", "30/9/2026", "", 23, 0, 23, "VENCIDO", "VENCIDO 30 DIAS", 839591, 4745227, 0, 0, 5584818, 4745227, 5584818, 181158234],
  ["NUÑEZ MARCOS", "BOULEVARD", "TR 4°B", "PROYECTO", "FINANCIADO", 36, 24, "10/10/2026", "10/11/2026", "15/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 3330785, 0, 0, 3330785, 3330784, 3330785, 83269607],
  ["AGUILAR MARÍA VICTORIA", "BOULEVARD", "LOCAL PB 3", "CUPO LINK", "FINANCIADO", 48, 23, "10/10/2026", "10/11/2026", "7/10/2026", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1699037, 0, 0, 1699037, 1699038, 1699037, 40776911],
  ["JAIME ALEJANDRA NATALIA", "BOULEVARD", "LOCAL PB 6", "PROYECTO", "FINANCIADO", 36, 25, "10/10/2026", "10/11/2026", "", "", 0, 2, 2, "VENCIDO", "VENCIDO 30 DIAS", 0, 1937376, 0, 0, 1937376, 1937364, 1937376, 50371474],
  ["DELGADO BERNARDO LUIS", "VITTALIA", "13° FRENTE", "", "FINANCIADO", 48, 37, "10/5/2026", "10/7/2026", "18/5/2026", "", 0, 125, 125, "VENCIDO", "VENCIDO + 60 DIAS", 0, 0, 0, 0, 0, 0, 0, 0]
];

function construirCarteraReal() {
  const clientesMap = {};
  const clientes = [];
  const ventas = [];
  const cuotas = [];
  const cobranzas = [];

  RAW_CARTERA_2026_11.forEach((row, idx) => {
    const [
      clienteNombreRaw,
      proyecto,
      unidad,
      asignacion,
      condicionVenta,
      cuotasTotal,
      cuotasPend,
      vtoAntRaw,
      vtoActRaw,
      cobroAntRaw,
      cobroActRaw,
      retAnt,
      retAct,
      retTot,
      morosidad,
      segmentacion,
      saldoVencAnt,
      cuotaMes,
      adelanto,
      ingresoNvaVta,
      totalCobrar,
      cuotaSaldoAVenc,
      saldoFinMes,
      saldoAVencer
    ] = row;

    const nombreNorm = clienteNombreRaw.trim().toUpperCase();
    let cliId = clientesMap[nombreNorm];
    if (!cliId) {
      cliId = `cli_real_${Object.keys(clientesMap).length + 1}`;
      clientesMap[nombreNorm] = cliId;
      clientes.push({
        id: cliId,
        nombre: clienteNombreRaw.trim(),
        dni_cuit: "—",
        email: "",
        telefono: "",
        domicilio: "",
        condicion_fiscal: "Consumidor Final",
        observaciones: "Cliente cartera real al 30/11/2026.",
        created_at: "2026-11-01"
      });
    }

    const vtaId = `vta_real_${idx + 1}`;
    const codigoOp = `OP-${String(idx + 1).padStart(3, "0")}`;
    const vtoAntISO = parseDMYtoISO(vtoAntRaw);
    const vtoActISO = parseDMYtoISO(vtoActRaw) || "2026-11-10";
    const cobroAntISO = parseDMYtoISO(cobroAntRaw);
    const cobroActISO = parseDMYtoISO(cobroActRaw);

    const esLink = (asignacion || "").includes("LINK");
    const variableAct = esLink ? "INDICE_LINK" : "CAC";
    const indiceBase = esLink ? 121.0 : 1468.9;

    // Total cartera pendiente + cobrado estimado del mes = contrato vigente registrado
    const cobradoMes = Math.max(0, Number(totalCobrar) - Number(saldoFinMes));
    const carteraPendienteOperacion = Math.max(0, Number(saldoAVencer) + Number(ingresoNvaVta));
    const cuotasYaPagadas = Math.max(0, Number(cuotasTotal) - Number(cuotasPend) - 1);
    const montoHistoricoEstimado = cuotasYaPagadas * (Number(cuotaMes) || Number(cuotaSaldoAVenc) || 0);
    const precioTotalEstimado = carteraPendienteOperacion + cobradoMes + montoHistoricoEstimado;

    const venta = {
      id: vtaId,
      codigo: codigoOp,
      fecha_venta: vtoAntISO || "2026-11-01",
      cliente_id: cliId,
      proyecto,
      unidad_id: "",
      unidad_nombre: unidad,
      asignacion: asignacion || "SIN ASIGNAR",
      condicion_venta: condicionVenta || "FINANCIADO",
      moneda_origen: "ARS",
      precio_total: precioTotalEstimado > 0 ? precioTotalEstimado : Number(totalCobrar),
      anticipo: Number(ingresoNvaVta) || 0,
      saldo_financiar: carteraPendienteOperacion,
      cantidad_cuotas: Number(cuotasTotal),
      cuotas_pendientes: Number(cuotasPend),
      fecha_primer_vencimiento: vtoActISO,
      fecha_vto_anterior: vtoAntISO,
      fecha_vto_actual: vtoActISO,
      fecha_cobro_anterior: cobroAntISO,
      fecha_cobro_actual: cobroActISO,
      dias_retraso_anterior: Number(retAnt) || 0,
      dias_retraso_actual: Number(retAct) || 0,
      dias_retraso_total: Number(retTot) || 0,
      morosidad: morosidad || "NO VENCIDO",
      segmentacion: segmentacion || "AL DIA",
      saldo_vencido_anterior: Number(saldoVencAnt) || 0,
      cuota_mes: Number(cuotaMes) || 0,
      adelanto_cuotas: Number(adelanto) || 0,
      ingreso_nueva_venta: Number(ingresoNvaVta) || 0,
      total_a_cobrar: Number(totalCobrar) || 0,
      cuotas_para_saldo_a_vencer: Number(cuotaSaldoAVenc) || 0,
      saldo_fin_mes: Number(saldoFinMes) || 0,
      saldo_a_vencer: Number(saldoAVencer) || 0,
      variable_actualizacion: variableAct,
      indice_base: indiceBase,
      tasa_mensual_fija: 0,
      estado: "Activa",
      notas: `${asignacion ? asignacion + " · " : ""}${segmentacion || ""}`.trim()
    };
    ventas.push(venta);

    // 1) Cuota vencida mes anterior (si existe Saldo Vencido Mes Anterior > 0)
    if (saldoVencAnt > 0) {
      cuotas.push({
        id: `cta_${vtaId}_ant`,
        venta_id: vtaId,
        cliente_id: cliId,
        nro_cuota: Math.max(1, cuotasTotal - cuotasPend - 1),
        concepto: "Saldo Vencido Ant.",
        periodo: (vtoAntISO || "2026-10-10").slice(0, 7),
        fecha_vencimiento: vtoAntISO || "2026-10-10",
        moneda: "ARS",
        importe_original: saldoVencAnt,
        variable_actualizacion: variableAct,
        indice_base: indiceBase,
        indice_aplicado: indiceBase,
        coeficiente_ajuste: 1,
        importe_actualizado: saldoVencAnt,
        monto_cobrado: 0,
        saldo_pendiente: saldoVencAnt,
        estado: "Vencida",
        devengado: true,
        fecha_devengamiento: vtoAntISO || "2026-10-01"
      });
    }

    // 2) Ingreso Nueva Venta (ej: PINTO FATIMA $30.000.000)
    if (ingresoNvaVta > 0) {
      const cobradoNvaVta = Math.min(cobradoMes, ingresoNvaVta);
      const saldoNvaVta = Math.max(0, ingresoNvaVta - cobradoNvaVta);
      const ctaNvId = `cta_${vtaId}_nv`;
      cuotas.push({
        id: ctaNvId,
        venta_id: vtaId,
        cliente_id: cliId,
        nro_cuota: 0,
        concepto: "Ingreso Nueva Venta",
        periodo: "2026-11",
        fecha_vencimiento: vtoActISO || "2026-11-10",
        moneda: "ARS",
        importe_original: ingresoNvaVta,
        variable_actualizacion: "SIN_AJUSTE",
        indice_base: 1,
        indice_aplicado: 1,
        coeficiente_ajuste: 1,
        importe_actualizado: ingresoNvaVta,
        monto_cobrado: cobradoNvaVta,
        saldo_pendiente: saldoNvaVta,
        estado: saldoNvaVta <= 0.5 ? "Cobrada" : cobradoNvaVta > 0 ? "Cobrada Parcial" : "Devengada",
        devengado: true,
        fecha_devengamiento: "2026-11-01"
      });

      if (cobradoNvaVta > 0) {
        const fechaCobNv = cobroActISO || cobroAntISO || "2026-11-01";
        cobranzas.push({
          id: `cob_${vtaId}_nv`,
          fecha_cobro: fechaCobNv,
          periodo_cobro: fechaCobNv.slice(0, 7),
          cliente_id: cliId,
          venta_id: vtaId,
          cuota_id: ctaNvId,
          nro_cuota: 0,
          medio_pago: "Transferencia Bancaria ARS",
          moneda_pago: "ARS",
          tc_aplicado: 1550,
          importe_pagado: cobradoNvaVta,
          importe_ars_equivalente: cobradoNvaVta,
          referencia: `REC-${codigoOp}-NV`,
          sincronizado_cashflow: false,
          observaciones: "Ingreso por nueva venta / anticipo s/ planilla de cartera."
        });
      }
    }

    // 3) Cuota del Mes (Nov 2026)
    if (cuotaMes > 0) {
      const nroCuotaMes = Math.max(1, cuotasTotal - cuotasPend);
      const cobroEnNov = Math.min(cobradoMes, cuotaMes);
      const saldoCuotaNov = Math.max(0, cuotaMes - cobroEnNov);
      const estadoNov =
        saldoCuotaNov <= 0.5
          ? "Cobrada"
          : cobroEnNov > 0
            ? "Cobrada Parcial"
            : morosidad === "VENCIDO"
              ? "Vencida"
              : "Devengada";

      const cuotaNovId = `cta_${vtaId}_nov`;
      cuotas.push({
        id: cuotaNovId,
        venta_id: vtaId,
        cliente_id: cliId,
        nro_cuota: nroCuotaMes,
        concepto: `Cuota ${nroCuotaMes}/${cuotasTotal}`,
        periodo: vtoActISO.slice(0, 7) || "2026-11",
        fecha_vencimiento: vtoActISO,
        moneda: "ARS",
        importe_original: cuotaMes,
        variable_actualizacion: variableAct,
        indice_base: indiceBase,
        indice_aplicado: indiceBase,
        coeficiente_ajuste: 1,
        importe_actualizado: cuotaMes,
        monto_cobrado: cobroEnNov,
        saldo_pendiente: saldoCuotaNov,
        estado: estadoNov,
        devengado: true,
        fecha_devengamiento: "2026-11-01"
      });

      if (cobroEnNov > 0) {
        const fechaCob = cobroActISO || "2026-11-10";
        cobranzas.push({
          id: `cob_${vtaId}_nov`,
          fecha_cobro: fechaCob,
          periodo_cobro: fechaCob.slice(0, 7),
          cliente_id: cliId,
          venta_id: vtaId,
          cuota_id: cuotaNovId,
          nro_cuota: nroCuotaMes,
          medio_pago: "Transferencia Bancaria ARS",
          moneda_pago: "ARS",
          tc_aplicado: 1550,
          importe_pagado: cobroEnNov,
          importe_ars_equivalente: cobroEnNov,
          referencia: `REC-${codigoOp}-11`,
          sincronizado_cashflow: false,
          observaciones: cobroActISO
            ? `Cobro registrado el ${cobroActRaw} s/ planilla de cartera.`
            : "Cobranza parcial imputada en noviembre 2026."
        });
      }
    }

    // 4) Cuotas Futuras pendientes (a vencer desde Dic 2026) para igualar Saldo a Vencer
    const saldoFuturoRestante = Math.max(0, Number(saldoAVencer) - Number(saldoFinMes));
    if (cuotasPend > 0 && saldoFuturoRestante > 0) {
      const baseFuturo =
        cuotaSaldoAVenc > 0
          ? cuotaSaldoAVenc
          : Math.round(saldoFuturoRestante / cuotasPend);
      const startNro = Math.max(1, cuotasTotal - cuotasPend + 1);
      const baseVencFuturo = vtoActISO.slice(0, 7) > "2026-11"
        ? vtoActISO
        : sumarMesesFecha(vtoActISO, 1);

      let acumuladoFut = 0;
      for (let i = 0; i < cuotasPend; i++) {
        const esUltima = i === cuotasPend - 1;
        let imp = esUltima ? Math.max(0, saldoFuturoRestante - acumuladoFut) : baseFuturo;
        if (acumuladoFut + imp > saldoFuturoRestante && !esUltima) {
          imp = Math.max(0, saldoFuturoRestante - acumuladoFut);
        }
        acumuladoFut += imp;
        if (imp <= 0 && !esUltima) continue;

        const fechaVenc = sumarMesesFecha(baseVencFuturo, i);
        const nro = startNro + i;
        cuotas.push({
          id: `cta_${vtaId}_f_${i + 1}`,
          venta_id: vtaId,
          cliente_id: cliId,
          nro_cuota: nro,
          concepto: `Cuota ${nro}/${cuotasTotal}`,
          periodo: fechaVenc.slice(0, 7),
          fecha_vencimiento: fechaVenc,
          moneda: "ARS",
          importe_original: imp,
          variable_actualizacion: variableAct,
          indice_base: indiceBase,
          indice_aplicado: indiceBase,
          coeficiente_ajuste: 1,
          importe_actualizado: imp,
          monto_cobrado: 0,
          saldo_pendiente: imp,
          estado: "Proyectada",
          devengado: false,
          fecha_devengamiento: null
        });
      }
    }
  });

  return { clientes, ventas, cuotas, cobranzas };
}

const realSeed = construirCarteraReal();

export const REAL_CARTERA_OPERACIONES = RAW_CARTERA_2026_11;
export const DEFAULT_CC_CLIENTES = realSeed.clientes;
export const DEFAULT_CC_VENTAS = realSeed.ventas;
export const DEFAULT_CC_CUOTAS = realSeed.cuotas;
export const DEFAULT_CC_COBRANZAS = realSeed.cobranzas;
