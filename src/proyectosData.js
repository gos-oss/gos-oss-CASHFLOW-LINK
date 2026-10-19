// MODELO DE DATOS DE OBRAS Y CURVAS DE EJECUCIÓN - LINK INVERSIONES
// Cartera Oficial de Proyectos: DUO, T2, Corporativo, Green, Auria (Ex Marcos Paz) y + DUO.

export const OBRAS_DATA_SUMMARY = [
  {
    id: "duo",
    nombre: "DUO",
    avance_pct: 84,
    saldo_presupuesto: 891873120.18,
    presupuesto_total: 5669203659.14,
    ejecutado: 4777330538.96,
    fecha_inicio: "2024-12",
    fecha_fin: "2026-11",
    fecha_inicio_label: "dic-24",
    fecha_fin_label: "nov-26",
    duracion_meses: 23,
    color: "#3B82F6", // Azul
    estado: "Fase Final / Entrega",
    tipologia: "Edificio Residencial DUO",
    descripcion: "Edificio residencial en fase final de terminaciones y posesión. 84% de avance físico/financiero ejecutado."
  },
  {
    id: "300_t2_am",
    nombre: "T2",
    avance_pct: 41,
    saldo_presupuesto: 1131830357.45,
    presupuesto_total: 1925523948.42,
    ejecutado: 793693590.97,
    fecha_inicio: "2024-12",
    fecha_fin: "2026-12",
    fecha_inicio_label: "dic-24",
    fecha_fin_label: "dic-26",
    duracion_meses: 24,
    color: "#6366F1", // Indigo
    estado: "En Ejecución",
    tipologia: "Torre 2 + Amenidades",
    descripcion: "Torre 2 y áreas de amenidades del complejo #300. Ritmo de obra con 41% de avance."
  },
  {
    id: "300_corp",
    nombre: "Corporativo",
    avance_pct: 47,
    saldo_presupuesto: 1153749721.25,
    presupuesto_total: 2175370966.50,
    ejecutado: 1021621245.25,
    fecha_inicio: "2024-12",
    fecha_fin: "2026-12",
    fecha_inicio_label: "dic-24",
    fecha_fin_label: "dic-26",
    duracion_meses: 24,
    color: "#EC4899", // Rosa fucsia
    estado: "En Ejecución",
    tipologia: "Edificio Corporativo / Oficinas",
    descripcion: "Edificio de oficinas corporativas #300 con 47% de ejecución y finalización hacia fin de 2026."
  },
  {
    id: "torre_green",
    nombre: "Green",
    avance_pct: 1,
    saldo_presupuesto: 3224016133.52,
    presupuesto_total: 3255621885.96,
    ejecutado: 31605752.45,
    fecha_inicio: "2026-07",
    fecha_fin: "2028-11",
    fecha_inicio_label: "jul-26",
    fecha_fin_label: "nov-28",
    duracion_meses: 28,
    color: "#10B981", // Esmeralda
    estado: "En Despegue",
    tipologia: "Torre Green Residencial",
    descripcion: "Torre sustentable de alta gama. Desembolsos iniciales en curso con aceleración fuerte en 2027."
  },
  {
    id: "auria",
    nombre: "Auria",
    avance_pct: 0,
    saldo_presupuesto: 5895457891.22,
    presupuesto_total: 5895457891.22,
    ejecutado: 0.00,
    fecha_inicio: "2027-06",
    fecha_fin: "2029-11",
    fecha_inicio_label: "jun-27",
    fecha_fin_label: "nov-29",
    duracion_meses: 29,
    color: "#EAB308", // Amarillo dorado
    estado: "Programada",
    tipologia: "Edificio Residencial & Comercial Auria",
    descripcion: "Emprendimiento Auria (anteriormente Marcos Paz 82). Presupuesto total de $5.895 millones de pesos a ejecutarse entre Junio 2027 y Noviembre 2029."
  },
  {
    id: "mas_duo",
    nombre: "+ DUO",
    avance_pct: 0,
    saldo_presupuesto: 7975823542.89,
    presupuesto_total: 7975823542.89,
    ejecutado: 0.00,
    fecha_inicio: "2026-12",
    fecha_fin: "2029-05",
    fecha_inicio_label: "dic-26",
    fecha_fin_label: "may-29",
    duracion_meses: 29,
    color: "#06B6D4", // Cyan
    estado: "Programada",
    tipologia: "Ampliación Complejo +DUO",
    descripcion: "Ampliación de gran escala del proyecto DUO. Presupuesto de $7.975 millones de pesos a ejecutar entre Dic 2026 y Mayo 2029."
  }
];

// LISTADO DE MESES DEL HORIZONTE COMPLETO (2024-12 A 2029-11: 60 MESES)
export const MESES_HORIZONTE_OBRAS = [
  // 2024
  "2024-12",
  // 2025
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  // 2026
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
  // 2027
  "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06",
  "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12",
  // 2028
  "2028-01", "2028-02", "2028-03", "2028-04", "2028-05", "2028-06",
  "2028-07", "2028-08", "2028-09", "2028-10", "2028-11", "2028-12",
  // 2029
  "2029-01", "2029-02", "2029-03", "2029-04", "2029-05", "2029-06",
  "2029-07", "2029-08", "2029-09", "2029-10", "2029-11"
];

// MATRIZ MENSUAL COMPLETA TRANSCRIPTA CON PRECISIÓN EXACTA DESDE LA PLANILLA
export const CURVAS_MENSUALES_OBRAS = {
  duo: {
    "2024-12": 81959122,
    "2025-01": 92499807,
    "2025-02": 115726873,
    "2025-03": 143354697,
    "2025-04": 175411949,
    "2025-05": 211449122,
    "2025-06": 250349167,
    "2025-07": 290189317,
    "2025-08": 328239774,
    "2025-09": 361185188,
    "2025-10": 385603761,
    "2025-11": 398633052,
    "2025-12": 398633052,
    "2026-01": 385603761,
    "2026-02": 361185188,
    "2026-03": 328239774,
    "2026-04": 290189317,
    "2026-05": 250349167,
    "2026-06": 211449122,
    "2026-07": 175411949,
    "2026-08": 143354697,
    "2026-09": 115726873,
    "2026-10": 92499807,
    "2026-11": 81959122,
    "2026-12": 0
  },
  "300_t2_am": {
    "2024-12": 26561767,
    "2025-01": 29824880,
    "2025-02": 36989936,
    "2025-03": 45467704,
    "2025-04": 55278791,
    "2025-05": 66319152,
    "2025-06": 78309333,
    "2025-07": 90753320,
    "2025-08": 102926993,
    "2025-09": 113918280,
    "2025-10": 122732795,
    "2025-11": 128457210,
    "2025-12": 130443630,
    "2026-01": 128457210,
    "2026-02": 122732795,
    "2026-03": 113918280,
    "2026-04": 102926993,
    "2026-05": 90753320,
    "2026-06": 78309333,
    "2026-07": 66319152,
    "2026-08": 55278791,
    "2026-09": 45467704,
    "2026-10": 36989936,
    "2026-11": 29824880,
    "2026-12": 26561767
  },
  "300_corp": {
    "2024-12": 30008298,
    "2025-01": 33694817,
    "2025-02": 41789578,
    "2025-03": 51367382,
    "2025-04": 62451509,
    "2025-05": 74924417,
    "2025-06": 88470387,
    "2025-07": 102529048,
    "2025-08": 116282320,
    "2025-09": 128699785,
    "2025-10": 138658031,
    "2025-11": 145125219,
    "2025-12": 147369388,
    "2026-01": 145125219,
    "2026-02": 138658031,
    "2026-03": 128699785,
    "2026-04": 116282320,
    "2026-05": 102529048,
    "2026-06": 88470387,
    "2026-07": 74924417,
    "2026-08": 62451509,
    "2026-09": 51367382,
    "2026-10": 41789578,
    "2026-11": 33694817,
    "2026-12": 30008298
  },
  torre_green: {
    "2026-07": 37948729,
    "2026-08": 41901366,
    "2026-09": 50476567,
    "2026-10": 60433585,
    "2026-11": 71824287,
    "2026-12": 84619972,
    "2027-01": 98677049,
    "2027-02": 113702887,
    "2027-03": 129229704,
    "2027-04": 144607225,
    "2027-05": 159025595,
    "2027-06": 171576771,
    "2027-07": 181354017,
    "2027-08": 187576483,
    "2027-09": 189713411,
    "2027-10": 187576483,
    "2027-11": 181354017,
    "2027-12": 171576771,
    "2028-01": 159025595,
    "2028-02": 144607225,
    "2028-03": 129229704,
    "2028-04": 113702887,
    "2028-05": 98677049,
    "2028-06": 84619972,
    "2028-07": 71824287,
    "2028-08": 60433585,
    "2028-09": 50476567,
    "2028-10": 41901366,
    "2028-11": 37948729
  },
  auria: {
    "2027-06": 66154138,
    "2027-07": 72791702,
    "2027-08": 87154944,
    "2027-09": 103763361,
    "2027-10": 122708132,
    "2027-11": 143963235,
    "2027-12": 167335421,
    "2028-01": 192413158,
    "2028-02": 218524573,
    "2028-03": 244718536,
    "2028-04": 269784955,
    "2028-05": 292327540,
    "2028-06": 310892953,
    "2028-07": 324144603,
    "2028-08": 331051694,
    "2028-09": 331051694,
    "2028-10": 324144603,
    "2028-11": 310892953,
    "2028-12": 292327540,
    "2029-01": 269784955,
    "2029-02": 244718536,
    "2029-03": 218524573,
    "2029-04": 192413158,
    "2029-05": 167335421,
    "2029-06": 143963235,
    "2029-07": 122708132,
    "2029-08": 103763361,
    "2029-09": 87154944,
    "2029-10": 72791702,
    "2029-11": 66154138
  },
  mas_duo: {
    "2026-12": 89498346,
    "2027-01": 98478147,
    "2027-02": 117909833,
    "2027-03": 140378962,
    "2027-04": 166008889,
    "2027-05": 194764406,
    "2027-06": 226384076,
    "2027-07": 260311146,
    "2027-08": 295636652,
    "2027-09": 331073836,
    "2027-10": 364985593,
    "2027-11": 395482916,
    "2027-12": 420599617,
    "2028-01": 438527457,
    "2028-02": 447871895,
    "2028-03": 447871895,
    "2028-04": 438527457,
    "2028-05": 420599617,
    "2028-06": 395482916,
    "2028-07": 364985593,
    "2028-08": 331073836,
    "2028-09": 295636652,
    "2028-10": 260311146,
    "2028-11": 226384076,
    "2028-12": 194764406,
    "2029-01": 166008889,
    "2029-02": 140378962,
    "2029-03": 117909833,
    "2029-04": 98478147,
    "2029-05": 89498346
  }
};

// Alias de retrocompatibilidad
CURVAS_MENSUALES_OBRAS["marcos_paz"] = CURVAS_MENSUALES_OBRAS["auria"];

export const MESES_HORIZONTE = MESES_HORIZONTE_OBRAS;

export const RUBROS_OBRA_ESTANDAR = [
  { nombre: "Estructura de Hormigón & Fundaciones", pct: 30, color: "#3B82F6" },
  { nombre: "Albañilería & Cerramientos", pct: 20, color: "#6366F1" },
  { nombre: "Instalaciones Sanitarias, Gas e Incendio", pct: 15, color: "#10B981" },
  { nombre: "Instalación Eléctrica & Conectividad", pct: 12, color: "#F59E0B" },
  { nombre: "Terminaciones, Carpinterías & Pintura", pct: 17, color: "#EC4899" },
  { nombre: "Ascensores & Equipamiento Especial", pct: 6, color: "#8B5CF6" }
];

// Generador de hitos de obra según fechas
const generarHitosObra = (fechaInicio, fechaFin, nombreObra) => {
  return [
    { mes: fechaInicio, titulo: "Inicio / Despliegue de Obra", desc: `Apertura de frentes y fundaciones de ${nombreObra}`, pct: 10 },
    { mes: fechaFin, titulo: "Fin de Obra & Posesión", desc: `Finalización de terminaciones y entrega`, pct: 100 }
  ];
};

// Generador de proyectos con sus costos integrados
export const getProyectosObrasCompletos = () => {
  return OBRAS_DATA_SUMMARY.map(obra => {
    return {
      ...obra,
      tag: obra.estado,
      categoria: "obra",
      fecha_entrega: obra.fecha_fin,
      m2_totales: Math.round(obra.presupuesto_total / 1200000), // m2 estimados según presupuesto
      unidades_totales: Math.round(obra.presupuesto_total / 85000000) || 1,
      hitos: generarHitosObra(obra.fecha_inicio, obra.fecha_fin, obra.nombre),
      rubros: RUBROS_OBRA_ESTANDAR,
      costos_mensuales: CURVAS_MENSUALES_OBRAS[obra.id] || CURVAS_MENSUALES_OBRAS[obra.id === "auria" ? "marcos_paz" : obra.id] || {}
    };
  });
};

export const PROYECTOS_INICIALES = getProyectosObrasCompletos();

export const NOMBRES_MESES = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
};

export const formatearMes = (mesKey) => {
  if (!mesKey) return "";
  const [anio, mes] = mesKey.split("-");
  const mesNombre = NOMBRES_MESES[mes] || mes;
  return `${mesNombre.slice(0, 3)} ${anio}`;
};
