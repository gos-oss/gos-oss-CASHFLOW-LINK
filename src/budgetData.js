// CATÁLOGOS BASE PARA 2026 (HISTÓRICO)
export const PLAN_INCOME_CATS_2026 = [
  { key: "custom_cuotas-mensuales", label: "Cobranzas CC Clientes", sublabel: "Cobro planes históricos", type: "clientes" },
  { key: "custom_ventas-cdo", label: "Ventas Estimadas", sublabel: "Ventas nuevas presupuestadas", type: "ventas" },
  { key: "custom_cupos-socios", label: "Cupos Socios", sublabel: "Aportes societarios externos", type: "socios" },
  { key: "custom_pesa", label: "PESA", sublabel: "Fondos PESA", type: "otros" },
  { key: "custom_aportes", label: "Aportes", sublabel: "Aportes extraordinarios", type: "otros" }
];

// CATÁLOGO OFICIAL 2027 - PROYECCIÓN LINK INVERSIONES (EXCEL OFICIAL)
export const PLAN_INCOME_CATS_2027 = [
  { key: "custom_ventas-mostrador", label: "Ventas Mostrador", sublabel: "Venta directa de unidades en pozo", type: "ventas", pctTotal: 40.88 },
  { key: "custom_ventas-paquetes", label: "Ventas Paquetes", sublabel: "Venta mayorista de paquetes", type: "ventas", pctTotal: 33.96 },
  { key: "custom_cuotas-mensuales", label: "CC Clientes", sublabel: "Cobranzas cuentas corrientes cuotas", type: "clientes", pctTotal: 15.34 },
  { key: "custom_honorarios-proyectos", label: "Honorarios Proyectos", sublabel: "Honorarios gerenciamiento", type: "honorarios", pctTotal: 8.40 },
  { key: "custom_ventas-canjes", label: "Ventas Canjes", sublabel: "Canjes comerciales de unidades", type: "canjes", pctTotal: 1.43 }
];

export const PLAN_INCOME_CATS = PLAN_INCOME_CATS_2027;

// PROYECTOS LINK 2027 (EGRESOS OBRAS Y CUPOS)
export const PLAN_PROJECT_CATS_2027 = [
  // Cupos Fijos
  { key: "proy_300", label: "Cupo Link # 300", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($53,97M)", group: "cupos", pctEgreso: 6.45, pctProy: 9.30 },
  { key: "proy_boulevard", label: "Cupo Link Boulevard", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($49,31M)", group: "cupos", pctEgreso: 5.90, pctProy: 8.50 },
  { key: "proy_neuquen", label: "Cupo Link Neuquén", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($30,80M)", group: "cupos", pctEgreso: 3.68, pctProy: 5.31 },

  // Curvas de Obras Activas
  { key: "proy_torre-green", label: "Torre Green Proyecto", tag: "Curva S", sublabel: "Obra activa en ejecución", group: "obras", pctEgreso: 19.09, pctProy: 27.51 },
  { key: "proy_mas-duo", label: "+ DUO Proyecto", tag: "Curva S", sublabel: "Obra activa en expansión", group: "obras", pctEgreso: 25.89, pctProy: 37.31 },
  { key: "proy_auria", label: "Auria Proyecto", tag: "Nueva Obra", sublabel: "Inicio proyectado en junio", group: "obras", pctEgreso: 7.61, pctProy: 10.97 },
  { key: "proy_tdys", label: "Tdys (ET)", tag: "Técnica", sublabel: "Gastos y ensayos técnicos", group: "obras", pctEgreso: 0.76, pctProy: 1.10 },

  // Obras anteriores sin desembolso 2027
  { key: "proy_duo", label: "DUO", tag: "Cierre", sublabel: "Finalizada dic 2026", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_torre-blue", label: "Torre Blue", tag: "Finalizada", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_zoe", label: "Zoe", tag: "Finalizada", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_torre-red", label: "Torre Red", tag: "Finalizada", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_isaura", label: "Isaura", tag: "Finalizada", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_300-t3-am", label: "#300 - T3 + AM", tag: "Etapa previa", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 },
  { key: "proy_300-t4-am", label: "#300 - T4 + AM", tag: "Etapa previa", sublabel: "Sin desembolsos 2027", group: "obras", pctEgreso: 0, pctProy: 0 }
];

export const PLAN_PROJECT_CATS = PLAN_PROJECT_CATS_2027;

// ESTRUCTURA 2027
export const PLAN_ESTRUCTURA_CATS_2027 = [
  { key: "est_sueldos", label: "Sueldos", sublabel: "Nómina fija + SAC en Jun y Dic", group: "estructura", pctEgreso: 16.68, pctEstructura: 60.37 },
  { key: "est_impuestos", label: "Impuestos", sublabel: "Obligaciones impositivas mensuales", group: "estructura", pctEgreso: 4.36, pctEstructura: 15.77 },
  { key: "est_gastos-admin", label: "Gastos Administrativos", sublabel: "Operación general, servicios y suministros", group: "estructura", pctEgreso: 3.36, pctEstructura: 12.16 },
  { key: "est_cargas-sociales", label: "Cargas Sociales", sublabel: "Aportes patronales y seguridad social", group: "estructura", pctEgreso: 2.02, pctEstructura: 7.29 },
  { key: "est_rrhh", label: "RRHH", sublabel: "Recursos humanos y capacitaciones", group: "estructura", pctEgreso: 1.04, pctEstructura: 3.77 },
  { key: "est_post-venta", label: "Post Venta", sublabel: "Garantías y atención post entrega", group: "estructura", pctEgreso: 0.12, pctEstructura: 0.42 },
  { key: "est_cx", label: "CX", sublabel: "Experiencia de clientes y fidelización", group: "estructura", pctEgreso: 0.05, pctEstructura: 0.17 },
  { key: "est_renta-anticipada", label: "Renta Anticipada", sublabel: "Renta comprometida a inversores", group: "estructura", pctEgreso: 0.02, pctEstructura: 0.05 }
];

// INVERSIONES Y PASIVOS FINANCIEROS 2027
export const PLAN_FINANCIERO_CATS_2027 = [
  { key: "inv_colonia", label: "Colonia (Inversión)", sublabel: "Inversión fija mensual ($7,19M)", group: "inversiones", pctEgreso: 0.86 },
  { key: "pas_cudmani", label: "Cudmani (Pasivo)", sublabel: "Cuotas mensuales hasta Abril 2027", group: "pasivos", pctEgreso: 2.02 },
  { key: "pas_otros-bancos", label: "Otros / Bancos", sublabel: "Vencimientos bancarios ene-mar", group: "pasivos", pctEgreso: 0.09 },
  { key: "pas_baja-sposito", label: "Baja Sposito", sublabel: "Sin desembolsos proyectados", group: "pasivos", pctEgreso: 0.00 }
];

// TOTAL DE EGRESOS PARA EL PLAN
export const PLAN_EXPENSE_CATS_2027 = [
  ...PLAN_PROJECT_CATS_2027,
  ...PLAN_ESTRUCTURA_CATS_2027,
  ...PLAN_FINANCIERO_CATS_2027
];

export const PLAN_EXPENSE_CATS = PLAN_EXPENSE_CATS_2027;

// DATOS 2026 (HISTÓRICOS)
export const DEFAULT_PLAN_2026 = {
  "ingreso": {
    "custom_cupos-socios": { "01": 188542320, "02": 188542320, "03": 188542320, "04": 188542320, "05": 188542320, "06": 188542320, "07": 233273820, "08": 233273820, "09": 233273820, "10": 233273820, "11": 233273820, "12": 233273820 },
    "custom_cuotas-mensuales": { "01": 216094107, "02": 210193927, "03": 207243837, "04": 208718882, "05": 210931449, "06": 221256765, "07": 166503716, "08": 394424755, "09": 391424755, "10": 138308206, "11": 135987535, "12": 120871098 },
    "custom_ventas-cdo": { "01": 471643593, "02": 477543773, "03": 480493863, "04": 479018818, "05": 179921317, "06": 217557504, "07": 214152451, "08": 271670000, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pesa": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 389439155, "06": 248923431, "07": 248923431, "08": 248923431, "09": 248923431, "10": 0, "11": 0, "12": 0 },
    "custom_aportes": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
  },
  "egreso": {
    "proy_torre-blue": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_zoe": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_torre-red": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_isaura": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_duo": { "01": 356384338, "02": 356384338, "03": 356384338, "04": 356384338, "05": 356384338, "06": 356384338, "07": 34161635, "08": 97952376, "09": 287148043, "10": 124680990, "11": 0, "12": 0 },
    "proy_300": { "01": 38681705, "02": 38936292, "03": 38457672, "04": 38651151, "05": 39700052, "06": 37021814, "07": 39231587, "08": 42846754, "09": 28987102, "10": 29403226, "11": 24324540, "12": 24226764 },
    "proy_boulevard": { "01": 59173435, "02": 57847286, "03": 54816315, "04": 64856703, "05": 53868840, "06": 45723403, "07": 94977865, "08": 20905253, "09": 21287090, "10": 43573541, "11": 84850271, "12": 105764448 },
    "proy_torre-green": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 22809604, "08": 0, "09": 15495939, "10": 14429867, "11": 9950226, "12": 19195745 },
    "proy_mas-duo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_auria": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_neuquen": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300-t3-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "proy_300-t4-am": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "est_sueldos": { "01": 369633317, "02": 397685053, "03": 441780756, "04": 358521345, "05": 475970162, "06": 331050035, "07": 536536134, "08": 513321326, "09": 648915774, "10": 551957302, "11": 520529781, "12": 548314385 },
    "est_gastos-admin": { "01": 71586530, "02": 80850508, "03": 103285984, "04": 151720670, "05": 167830241, "06": 233343182, "07": 242145502, "08": 290031520, "09": 243703467, "10": 257845660, "11": 226979694, "12": 118455502 },
    "inv_colonia": { "01": 80318625, "02": 78125625, "03": 77029125, "04": 77577375, "05": 78399750, "06": 80592750, "07": 84736950, "08": 84736950, "09": 84736950, "10": 84736950, "11": 7236950, "12": 7236950 },
    "pas_cudmani": { "01": 57268446, "02": 55950406, "03": 55291386, "04": 55620896, "05": 73580581, "06": 75387164, "07": 79000330, "08": 79743600, "09": 79000330, "10": 79000330, "11": 79000330, "12": 79000330 },
  },
};

// DATOS EXACTOS OFICIALES 2027 SEGÚN PLANILLA "PROYECCION 2027 , PROYECTOS LINK"
export const DEFAULT_PLAN_2027 = {
  "ingreso": {
    "custom_ventas-mostrador": {
      "01": 264836789.29, "02": 264836789.29, "03": 264836789.29, "04": 264836789.29,
      "05": 264836789.29, "06": 264836789.29, "07": 264836789.29, "08": 264836789.29,
      "09": 264836789.29, "10": 264836789.29, "11": 264836789.29, "12": 264836789.29
    },
    "custom_ventas-paquetes": {
      "01": 219983987.00, "02": 219983987.00, "03": 219983987.00, "04": 219983987.00,
      "05": 219983987.00, "06": 219983987.00, "07": 219983987.00, "08": 219983987.00,
      "09": 219983987.00, "10": 219983987.00, "11": 219983987.00, "12": 219983987.00
    },
    "custom_cuotas-mensuales": {
      "01": 113295831.00, "02": 109548122.00, "03": 105735735.00, "04": 105735735.00,
      "05": 105735735.00, "06": 102862746.00, "07": 97833898.00, "08": 97833898.00,
      "09": 93118900.00, "10": 92547465.00, "11": 90134803.00, "12": 78152291.00
    },
    "custom_honorarios-proyectos": {
      "01": 54405000.00, "02": 54405000.00, "03": 54405000.00, "04": 54405000.00,
      "05": 54405000.00, "06": 54405000.00, "07": 54405000.00, "08": 54405000.00,
      "09": 54405000.00, "10": 54405000.00, "11": 54405000.00, "12": 54405000.00
    },
    "custom_ventas-canjes": {
      "01": 9240000.29, "02": 9240000.29, "03": 9240000.29, "04": 9240000.29,
      "05": 9240000.29, "06": 9240000.29, "07": 9240000.29, "08": 9240000.29,
      "09": 9240000.29, "10": 9240000.29, "11": 9240000.29, "12": 9240000.29
    },
    // Llaves anteriores para retrocompatibilidad
    "custom_ventas-cdo": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_cupos-socios": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pesa": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_aportes": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 }
  },
  "egreso": {
    // PROYECTOS
    "proy_300": {
      "01": 53971118.99, "02": 53971118.99, "03": 53971118.99, "04": 53971118.99,
      "05": 53971118.99, "06": 53971118.99, "07": 53971118.99, "08": 53971118.99,
      "09": 53971118.99, "10": 53971118.99, "11": 53971118.99, "12": 53971118.99
    },
    "proy_boulevard": {
      "01": 49310786.16, "02": 49310786.16, "03": 49310786.16, "04": 49310786.16,
      "05": 49310786.16, "06": 49310786.16, "07": 49310786.16, "08": 49310786.16,
      "09": 49310786.16, "10": 49310786.16, "11": 49310786.16, "12": 49310786.16
    },
    "proy_neuquen": {
      "01": 30800000.00, "02": 30800000.00, "03": 30800000.00, "04": 30800000.00,
      "05": 30800000.00, "06": 30800000.00, "07": 30800000.00, "08": 30800000.00,
      "09": 30800000.00, "10": 30800000.00, "11": 30800000.00, "12": 30800000.00
    },
    "proy_torre-green": {
      "01": 98677049.46, "02": 113702886.58, "03": 129229704.06, "04": 144607225.04,
      "05": 159025595.17, "06": 171576771.39, "07": 181354016.76, "08": 187576482.62,
      "09": 189713411.30, "10": 187576482.62, "11": 181354016.76, "12": 171576771.39
    },
    "proy_mas-duo": {
      "01": 98478146.69, "02": 117909832.71, "03": 140378962.23, "04": 166008888.51,
      "05": 194764406.26, "06": 226384076.41, "07": 208248916.65, "08": 236509321.43,
      "09": 264859069.16, "10": 291988474.40, "11": 316386332.73, "12": 336479693.97
    },
    "proy_auria": {
      "01": 0.00, "02": 0.00, "03": 0.00, "04": 0.00, "05": 0.00,
      "06": 66154138.13, "07": 72791701.56, "08": 87154943.93,
      "09": 103763361.39, "10": 122708132.46, "11": 143963234.60, "12": 167335420.92
    },
    "proy_tdys": {
      "01": 8224937.50, "02": 7554063.63, "03": 38325000.00, "04": 0.00, "05": 0.00,
      "06": 200980.00, "07": 9500.00, "08": 9843178.85, "09": 888419.50,
      "10": 3488880.00, "11": 2830414.43, "12": 5349505.07
    },

    // ESTRUCTURA
    "est_rrhh": {
      "01": 8702355.97, "02": 8702355.97, "03": 8702355.97, "04": 8702355.97,
      "05": 8702355.97, "06": 8702355.97, "07": 8702355.97, "08": 8702355.97,
      "09": 8702355.97, "10": 8702355.97, "11": 8702355.97, "12": 8702355.97
    },
    "est_sueldos": {
      "01": 128796257.84, "02": 128796257.84, "03": 128796257.84, "04": 128796257.84,
      "05": 128796257.84, "06": 193194386.77, "07": 128796257.84, "08": 128796257.84,
      "09": 128796257.84, "10": 128796257.84, "11": 128796257.84, "12": 193194386.77
    },
    "est_cargas-sociales": {
      "01": 15559017.66, "02": 15559017.66, "03": 15559017.66, "04": 15559017.66,
      "05": 15559017.66, "06": 23338526.49, "07": 15559017.66, "08": 15559017.66,
      "09": 15559017.66, "10": 15559017.66, "11": 15559017.66, "12": 23338526.49
    },
    "est_impuestos": {
      "01": 36437033.58, "02": 36437033.58, "03": 36437033.58, "04": 36437033.58,
      "05": 36437033.58, "06": 36437033.58, "07": 36437033.58, "08": 36437033.58,
      "09": 36437033.58, "10": 36437033.58, "11": 36437033.58, "12": 36437033.58
    },
    "est_gastos-admin": {
      "01": 28284198.15, "02": 32389613.43, "03": 28806648.63, "04": 24539869.98,
      "05": 27031930.98, "06": 25296381.62, "07": 27887914.19, "08": 26164293.89,
      "09": 32400810.74, "10": 27001562.38, "11": 29623698.63, "12": 27882789.89
    },
    "est_cx": {
      "01": 385818.18, "02": 385818.18, "03": 385818.18, "04": 385818.18,
      "05": 385818.18, "06": 385818.18, "07": 385818.18, "08": 385818.18,
      "09": 385818.18, "10": 385818.18, "11": 385818.18, "12": 385818.18
    },
    "est_post-venta": {
      "01": 968662.33, "02": 968662.33, "03": 968662.33, "04": 968662.33,
      "05": 968662.33, "06": 968662.33, "07": 968662.33, "08": 968662.33,
      "09": 968662.33, "10": 968662.33, "11": 968662.33, "12": 968662.33
    },
    "est_renta-anticipada": {
      "01": 1522905.00, "02": 0.00, "03": 0.00, "04": 0.00,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },

    // INVERSIONES
    "inv_colonia": {
      "01": 7187180.00, "02": 7187180.00, "03": 7187180.00, "04": 7187180.00,
      "05": 7187180.00, "06": 7187180.00, "07": 7187180.00, "08": 7187180.00,
      "09": 7187180.00, "10": 7187180.00, "11": 7187180.00, "12": 7187180.00
    },

    // PASIVOS FINANCIEROS
    "pas_cudmani": {
      "01": 50745203.06, "02": 50745203.06, "03": 50745203.06, "04": 50745203.06,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },
    "pas_otros-bancos": {
      "01": 8477729.66, "02": 144314.86, "03": 143201.38, "04": 0.00,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },
    "pas_baja-sposito": {
      "01": 0.00, "02": 0.00, "03": 0.00, "04": 0.00,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },

    // Retrocompatibilidad con llaves genéricas anteriores
    "custom_rrhh": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_administracion": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_inversiones": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pasivos-financieros": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 }
  }
};
