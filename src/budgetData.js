// CATÁLOGOS BASE PARA 2026 (HISTÓRICO)
export const PLAN_INCOME_CATS_2026 = [
  { key: "custom_cuotas-mensuales", label: "Cobranzas CC Clientes", sublabel: "Cobro planes históricos", type: "clientes" },
  { key: "custom_ventas-cdo", label: "Ventas Estimadas", sublabel: "Ventas nuevas presupuestadas", type: "ventas" },
  { key: "custom_cupos-socios", label: "Cupos Socios", sublabel: "Aportes societarios externos", type: "socios" },
  { key: "custom_pesa", label: "PESA", sublabel: "Fondos PESA", type: "otros" },
  { key: "custom_aportes", label: "Aportes", sublabel: "Aportes extraordinarios", type: "otros" }
];

// CATÁLOGO OFICIAL 2027 - PROYECCIÓN LINK INVERSIONES (EXCEL OFICIAL)
// 1. Cuenta corriente Clientes
// 2. Honorarios Proyectos
// 3. SIGMA Proy Propios
// 4. SIGMA Proy Socios
// 5. Comercializacion
// 6. Gestión Comercial (Ventas mostrador, Canjes, Paquetes)
export const PLAN_INCOME_GROUPS_2027 = [
  {
    id: "clientes",
    label: "CC Clientes",
    sublabel: "Cobranzas cuentas corrientes cuotas",
    badge: "Cobranzas",
    isGroup: false,
    keys: ["custom_cuotas-mensuales"]
  },
  {
    id: "honorarios",
    label: "Honorarios Proyectos",
    sublabel: "Honorarios gerenciamiento de obras",
    badge: "Gerenciamiento",
    isGroup: false,
    keys: ["custom_honorarios-proyectos"]
  },
  {
    id: "sigma-propios",
    label: "Sigma Proy Propios",
    sublabel: "Fondos proyectos propios Sigma",
    badge: "Sigma",
    isGroup: false,
    keys: ["custom_sigma-propios"]
  },
  {
    id: "sigma-socios",
    label: "Sigma Proy Socios",
    sublabel: "Fondos proyectos socios Sigma",
    badge: "Sigma",
    isGroup: false,
    keys: ["custom_sigma-socios"]
  },
  {
    id: "comercializacion",
    label: "Comercializacion",
    sublabel: "Comisiones y comercialización de obras",
    badge: "Comercial",
    isGroup: false,
    keys: ["custom_comercializacion"]
  },
  {
    id: "comercial",
    label: "Gestión Comercial",
    sublabel: "Ventas mostrador, Canjes y Paquetes",
    badge: "Comercial",
    isGroup: true,
    keys: ["custom_gestion-comercial"]
  }
];

export const PLAN_INCOME_CATS_2027 = [
  // 1. Cuenta corriente Clientes
  { key: "custom_cuotas-mensuales", label: "CC Clientes", sublabel: "Cobranzas cuentas corrientes cuotas", type: "clientes", group: "clientes", groupLabel: "CC Clientes", pctTotal: 12.06 },
  
  // 2. Honorarios Proyectos
  { key: "custom_honorarios-proyectos", label: "Honorarios Proyectos", sublabel: "Honorarios gerenciamiento de obras", type: "honorarios", group: "honorarios", groupLabel: "Honorarios Proyectos", pctTotal: 6.60 },
  
  // 3. SIGMA Proy Propios
  { key: "custom_sigma-propios", label: "Sigma Proy Propios", sublabel: "Fondos proyectos propios Sigma", type: "sigma", group: "sigma", groupLabel: "SIGMA", pctTotal: 2.59 },

  // 4. SIGMA Proy Socios
  { key: "custom_sigma-socios", label: "Sigma Proy Socios", sublabel: "Fondos proyectos socios Sigma", type: "sigma", group: "sigma", groupLabel: "SIGMA", pctTotal: 2.17 },

  // 5. Comercializacion
  { key: "custom_comercializacion", label: "Comercializacion", sublabel: "Comisiones y comercialización de obras", type: "comercializacion", group: "comercializacion", groupLabel: "Comercializacion", pctTotal: 2.68 },

  // 6. Gestión Comercial
  { key: "custom_gestion-comercial", label: "Gestión Comercial", sublabel: "Ventas mostrador, Canjes y Paquetes", type: "ventas", group: "comercial", groupLabel: "Gestión Comercial", pctTotal: 73.90 }
];

export const PLAN_INCOME_SUB_CATS_2027 = [
  { key: "custom_ventas-paquetes", label: "Ventas Paquetes", sublabel: "Venta mayorista de paquetes ($187,76M/mes)", parentKey: "custom_gestion-comercial", pctTotal: 22.78 },
  { key: "custom_ventas-canjes", label: "Ventas Canjes", sublabel: "Canjes comerciales de unidades ($95,67M/mes)", parentKey: "custom_gestion-comercial", pctTotal: 11.61 },
  { key: "custom_ventas-mostrador", label: "Ventas Mostrador", sublabel: "Venta directa en pozo ($354,54M/mes, dic $272,56M)", parentKey: "custom_gestion-comercial", pctTotal: 42.19 }
];

export const PLAN_INCOME_CATS = PLAN_INCOME_CATS_2027;

// PROYECTOS LINK 2027 (EGRESOS OBRAS Y CUPOS)
export const PLAN_PROJECT_CATS_2027 = [
  // Cupos Fijos
  { key: "proy_300", label: "Cupo Link # 300", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($53,97M)", group: "cupos", pctEgreso: 6.68, pctProy: 9.22 },
  { key: "proy_boulevard", label: "Cupo Link Boulevard", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($49,31M)", group: "cupos", pctEgreso: 6.10, pctProy: 8.42 },
  { key: "proy_neuquen", label: "Cupo Link Neuquén", tag: "Cupo Fijo", sublabel: "Aporte mensual societario ($30,80M)", group: "cupos", pctEgreso: 3.81, pctProy: 5.26 },

  // Curvas de Obras Activas y Gastos Administrativos de Obra
  { key: "proy_torre-green", label: "Torre Green Proyecto", tag: "Curva S", sublabel: "Obra activa en ejecución", group: "obras", pctEgreso: 19.76, pctProy: 27.27 },
  { key: "proy_gastos-admin-green", label: "Gastos Admin Green", tag: "Admin Obra", sublabel: "Gastos administrativos Torre Green", group: "obras", pctEgreso: 0.28, pctProy: 0.39 },
  { key: "proy_mas-duo", label: "+ DUO Proyecto", tag: "Curva S", sublabel: "Obra activa en expansión", group: "obras", pctEgreso: 26.80, pctProy: 36.99 },
  { key: "proy_gastos-admin-duo", label: "Gastos Admin + DUO", tag: "Admin Obra", sublabel: "Gastos administrativos + DUO", group: "obras", pctEgreso: 0.12, pctProy: 0.17 },
  { key: "proy_auria", label: "Auria Proyecto", tag: "Nueva Obra", sublabel: "Inicio proyectado en junio", group: "obras", pctEgreso: 7.88, pctProy: 10.87 },
  { key: "proy_gastos-admin-auria", label: "Gastos Admin Auria", tag: "Admin Obra", sublabel: "Gastos administrativos Auria", group: "obras", pctEgreso: 0.23, pctProy: 0.31 },
  { key: "proy_tdys", label: "Tdys (ET)", tag: "Técnica", sublabel: "Gastos y ensayos técnicos", group: "obras", pctEgreso: 0.79, pctProy: 1.09 },

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
  { key: "est_rrhh", label: "RRHH", sublabel: "Recursos humanos y capacitaciones", group: "estructura", pctEgreso: 1.04, pctEstructura: 4.37 },
  { key: "est_sueldos-azlepi", label: "Sueldos Azlepi", sublabel: "Nómina fija Azlepi ($95,05M/mes)", group: "estructura", pctEgreso: 11.76, pctEstructura: 49.67 },
  { key: "est_sueldos-comercial", label: "Sueldos Comercial", sublabel: "Nómina comercial ($10,83M/mes)", group: "estructura", pctEgreso: 1.34, pctEstructura: 5.66 },
  { key: "est_cargas-sociales-azlepi", label: "Cargas Sociales Azlepi", sublabel: "Aportes patronales Azlepi ($11,48M/mes)", group: "estructura", pctEgreso: 1.42, pctEstructura: 6.00 },
  { key: "est_cargas-sociales-comercial", label: "Cargas Sociales Comercial", sublabel: "Aportes patronales comercial ($1,31M/mes)", group: "estructura", pctEgreso: 0.16, pctEstructura: 0.68 },
  { key: "est_impuestos", label: "Impuestos", sublabel: "Obligaciones impositivas mensuales ($36,44M/mes)", group: "estructura", pctEgreso: 4.51, pctEstructura: 19.04 },
  { key: "est_gastos-admin-link", label: "Gastos Admin Link", sublabel: "Operación general y suministros Link", group: "estructura", pctEgreso: 2.18, pctEstructura: 9.19 },
  { key: "est_gastos-admin-comercial", label: "Gastos Admin Comercial", sublabel: "Gastos comerciales operativos ($0)", group: "estructura", pctEgreso: 0.00, pctEstructura: 0.00 },
  { key: "est_gastos-admin-otros", label: "Gastos Admin Otros", sublabel: "Otros gastos administrativos corrientes", group: "estructura", pctEgreso: 1.09, pctEstructura: 4.61 },
  { key: "est_cx", label: "CX", sublabel: "Experiencia de clientes y fidelización ($0,39M/mes)", group: "estructura", pctEgreso: 0.05, pctEstructura: 0.20 },
  { key: "est_post-venta", label: "Post Venta", sublabel: "Garantías y atención post entrega ($0,97M/mes)", group: "estructura", pctEgreso: 0.12, pctEstructura: 0.51 },
  { key: "est_renta-anticipada", label: "Renta Anticipada", sublabel: "Renta comprometida a inversores (Enero)", group: "estructura", pctEgreso: 0.02, pctEstructura: 0.07 }
];

// INVERSIONES Y PASIVOS FINANCIEROS 2027
export const PLAN_FINANCIERO_CATS_2027 = [
  { key: "inv_colonia", label: "Colonia (Inversión)", sublabel: "Inversión fija mensual ($7,19M)", group: "inversiones", pctEgreso: 0.89 },
  { key: "pas_cudmani", label: "Cudmani (Pasivo)", sublabel: "Cuotas mensuales ene-abr ($50,75M)", group: "pasivos", pctEgreso: 2.09 },
  { key: "pas_otros-bancos", label: "Otros / Bancos", sublabel: "Vencimientos bancarios ene-mar ($8,77M)", group: "pasivos", pctEgreso: 0.09 },
  { key: "pas_baja-sposito", label: "Baja Sposito", sublabel: "Cuotas mensuales ene-abr ($18,99M)", group: "pasivos", pctEgreso: 0.78 }
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
// 1. Cuenta corriente Clientes ($1.192.535.159,00)
// 2. Honorarios Proyectos ($652.860.000,00)
// 3. SIGMA Proy Propios ($256.133.494,00)
// 4. SIGMA Proy Socios ($215.088.221,60)
// 5. Comercializacion ($265.076.388,76)
// 6. Gestión Comercial ($7.308.534.718,75)
//    - Ventas Paquetes ($2.253.086.150,40)
//    - Ventas Canjes ($1.147.995.381,14)
//    - Ventas Mostrador ($4.172.529.575,97)
// TOTAL INGRESOS: $9.890.227.982,11 | TOTAL EGRESOS: $9.695.380.569,73 | POSICION NETA: $194.847.412,38 (125.708,01 USD)
export const DEFAULT_PLAN_2027 = {
  "ingreso": {
    // 1. CC CLIENTES
    "custom_cuotas-mensuales": {
      "01": 113295831.00, "02": 109548122.00, "03": 105735735.00, "04": 105735735.00,
      "05": 105735735.00, "06": 102862746.00, "07": 97833898.00, "08": 97833898.00,
      "09": 93118900.00, "10": 92547465.00, "11": 90134803.00, "12": 78152291.00
    },

    // 2. HONORARIOS PROYECTOS
    "custom_honorarios-proyectos": {
      "01": 54405000.00, "02": 54405000.00, "03": 54405000.00, "04": 54405000.00,
      "05": 54405000.00, "06": 54405000.00, "07": 54405000.00, "08": 54405000.00,
      "09": 54405000.00, "10": 54405000.00, "11": 54405000.00, "12": 54405000.00
    },

    // 3. SIGMA PROY PROPIOS
    "custom_sigma-propios": {
      "01": 8871983.80, "02": 10422572.40, "03": 12132390.00, "04": 13977725.10,
      "05": 15920550.10, "06": 20885174.30, "07": 23150559.00, "08": 25666563.50,
      "09": 28104777.40, "10": 30387159.40, "11": 32436007.60, "12": 34178031.40
    },

    // 4. SIGMA PROY SOCIOS
    "custom_sigma-socios": {
      "01": 16998334.80, "02": 17643958.20, "03": 20024414.20, "04": 20252842.00,
      "05": 20266145.30, "06": 19865001.30, "07": 19109616.50, "08": 18122663.40,
      "09": 17051978.30, "10": 16029550.70, "11": 15142621.40, "12": 14581095.50
    },

    // 5. COMERCIALIZACION
    "custom_comercializacion": {
      "01": 22328813.89, "02": 22328813.89, "03": 22328813.89, "04": 22328813.89,
      "05": 22328813.89, "06": 22328813.89, "07": 22328813.89, "08": 22328813.89,
      "09": 22328813.89, "10": 22328813.89, "11": 22328813.89, "12": 19459436.01
    },

    // 6. GESTION COMERCIAL
    "custom_gestion-comercial": {
      "01": 615637297.16, "02": 615637297.16, "03": 615637297.16, "04": 615637297.16,
      "05": 615637297.16, "06": 615637297.16, "07": 615637297.16, "08": 615637297.16,
      "09": 615637297.16, "10": 615637297.16, "11": 615637297.16, "12": 536524450.04
    },

    // Subdesglose de Gestión Comercial (Paquetes, Canjes, Mostrador)
    "custom_ventas-paquetes": {
      "01": 187757179.20, "02": 187757179.20, "03": 187757179.20, "04": 187757179.20,
      "05": 187757179.20, "06": 187757179.20, "07": 187757179.20, "08": 187757179.20,
      "09": 187757179.20, "10": 187757179.20, "11": 187757179.20, "12": 187757179.20
    },
    "custom_ventas-canjes": {
      "01": 95666281.76, "02": 95666281.76, "03": 95666281.76, "04": 95666281.76,
      "05": 95666281.76, "06": 95666281.76, "07": 95666281.76, "08": 95666281.76,
      "09": 95666281.76, "10": 95666281.76, "11": 95666281.76, "12": 95666281.76
    },
    "custom_ventas-mostrador": {
      "01": 354542650.08, "02": 354542650.08, "03": 354542650.08, "04": 354542650.08,
      "05": 354542650.08, "06": 354542650.08, "07": 354542650.08, "08": 354542650.08,
      "09": 354542650.08, "10": 354542650.08, "11": 354542650.08, "12": 272560425.09
    },

    // Llaves anteriores inicializadas en 0 para retrocompatibilidad
    "custom_sigma": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
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
    "proy_gastos-admin-green": {
      "01": 1983147.66, "02": 2239573.25, "03": 2035546.26, "04": 2297531.48,
      "05": 2090332.39, "06": 2358017.03, "07": 2151694.90, "08": 2425223.22,
      "09": 2668805.60, "10": 2491126.45, "11": 2274265.25, "12": 2559932.30
    },
    "proy_mas-duo": {
      "01": 98478146.69, "02": 117909832.71, "03": 140378962.23, "04": 166008888.51,
      "05": 194764406.26, "06": 226384076.41, "07": 208248916.65, "08": 236509321.43,
      "09": 264859069.16, "10": 291988474.40, "11": 316386332.73, "12": 336479693.97
    },
    "proy_gastos-admin-duo": {
      "01": 729546.91, "02": 971432.22, "03": 752715.22, "04": 999868.64,
      "05": 777705.09, "06": 1030302.90, "07": 840349.42, "08": 1098582.55,
      "09": 1326786.83, "10": 1133663.09, "11": 901309.19, "12": 1171455.88
    },
    "proy_auria": {
      "01": 0.00, "02": 0.00, "03": 0.00, "04": 0.00, "05": 0.00,
      "06": 66154138.13, "07": 72791701.56, "08": 87154943.93,
      "09": 103763361.39, "10": 122708132.46, "11": 143963234.92, "12": 167335420.92
    },
    "proy_gastos-admin-auria": {
      "01": 1492494.50, "02": 2139408.64, "03": 1492494.50, "04": 2151700.05,
      "05": 1492494.50, "06": 2164224.99, "07": 1492494.50, "08": 2176987.91,
      "09": 1492494.50, "10": 2189993.32, "11": 1492494.50, "12": 2203245.84
    },
    "proy_tdys": {
      "01": 8224937.50, "02": 7554063.63, "03": 38325000.00, "04": 0.00, "05": 0.00,
      "06": 200980.00, "07": 9500.00, "08": 9843178.85, "09": 888419.50,
      "10": 3488880.00, "11": 2830414.43, "12": 5349505.07
    },

    // ESTRUCTURA
    "est_rrhh": {
      "01": 8368943.51, "02": 8368943.51, "03": 8368943.51, "04": 8368943.51,
      "05": 8368943.51, "06": 8368943.51, "07": 8368943.51, "08": 8368943.51,
      "09": 8368943.51, "10": 8368943.51, "11": 8368943.51, "12": 8368943.51
    },
    "est_sueldos-azlepi": {
      "01": 95046765.21, "02": 95046765.21, "03": 95046765.21, "04": 95046765.21,
      "05": 95046765.21, "06": 95046765.21, "07": 95046765.21, "08": 95046765.21,
      "09": 95046765.21, "10": 95046765.21, "11": 95046765.21, "12": 95046765.21
    },
    "est_sueldos-comercial": {
      "01": 10827526.21, "02": 10827526.21, "03": 10827526.21, "04": 10827526.21,
      "05": 10827526.21, "06": 10827526.21, "07": 10827526.21, "08": 10827526.21,
      "09": 10827526.21, "10": 10827526.21, "11": 10827526.21, "12": 10827526.21
    },
    "est_cargas-sociales-azlepi": {
      "01": 11481966.35, "02": 11481966.35, "03": 11481966.35, "04": 11481966.35,
      "05": 11481966.35, "06": 11481966.35, "07": 11481966.35, "08": 11481966.35,
      "09": 11481966.35, "10": 11481966.35, "11": 11481966.35, "12": 11481966.35
    },
    "est_cargas-sociales-comercial": {
      "01": 1308001.29, "02": 1308001.29, "03": 1308001.29, "04": 1308001.29,
      "05": 1308001.29, "06": 1308001.29, "07": 1308001.29, "08": 1308001.29,
      "09": 1308001.29, "10": 1308001.29, "11": 1308001.29, "12": 1308001.29
    },
    "est_impuestos": {
      "01": 36437033.58, "02": 36437033.58, "03": 36437033.58, "04": 36437033.58,
      "05": 36437033.58, "06": 36437033.58, "07": 36437033.58, "08": 36437033.58,
      "09": 36437033.58, "10": 36437033.58, "11": 36437033.58, "12": 36437033.58
    },
    "est_gastos-admin-link": {
      "01": 15069529.41, "02": 16021815.06, "03": 15622432.11, "04": 16599500.39,
      "05": 21848062.79, "06": 17194810.85, "07": 16926983.93, "08": 17957386.22,
      "09": 17558340.98, "10": 18607291.38, "11": 18218461.12, "12": 19296037.89
    },
    "est_gastos-admin-comercial": {
      "01": 0.00, "02": 0.00, "03": 0.00, "04": 0.00,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },
    "est_gastos-admin-otros": {
      "01": 9245212.25, "02": 14220116.44, "03": 9615941.64, "04": 7407386.05,
      "05": 7355090.45, "06": 7696021.43, "07": 7640050.06, "08": 8033364.00,
      "09": 9327485.08, "10": 8355504.81, "11": 8262958.46, "12": 8695946.62
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
      "01": 18992116.90, "02": 18992116.90, "03": 18992116.90, "04": 18992116.90,
      "05": 0.00, "06": 0.00, "07": 0.00, "08": 0.00,
      "09": 0.00, "10": 0.00, "11": 0.00, "12": 0.00
    },

    // Llaves anteriores inicializadas en 0 para retrocompatibilidad (sin duplicar sueldos)
    "est_sueldos": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "est_cargas-sociales": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "est_gastos-admin": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_rrhh": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_administracion": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_inversiones": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 },
    "custom_pasivos-financieros": { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 }
  }
};
