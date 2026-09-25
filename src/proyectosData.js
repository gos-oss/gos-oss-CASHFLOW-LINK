// CATÁLOGO Y MODELO DE DATOS DE PROYECTOS - LINK INVERSIONES
// Curvas de ejecución, costos mensuales, hitos y datos de obra desde inicio a entrega

import { DEFAULT_PLAN_2026, DEFAULT_PLAN_2027 } from "./budgetData";

export const RUBROS_OBRA_ESTANDAR = [
  { key: "estructura", label: "Estructura H°A°", pct: 34, color: "#2563EB" },
  { key: "albanileria", label: "Albañilería y Mampostería", pct: 18, color: "#10B981" },
  { key: "instalaciones", label: "Instalaciones (Sanit/Eléct/Gas)", pct: 16, color: "#F59E0B" },
  { key: "carpinterias", label: "Carpinterías & Vidrios", pct: 14, color: "#8B5CF6" },
  { key: "terminaciones", label: "Terminaciones & Pintura", pct: 11, color: "#EC4899" },
  { key: "gerenciamiento", label: "Gerenciamiento & Permisos", pct: 7, color: "#64748B" }
];

export const PROYECTOS_INICIALES = [
  {
    id: "proy_torre-green",
    nombre: "Torre Green Proyecto",
    tag: "Curva S Activa",
    categoria: "obra",
    tipologia: "Torre Residencial Premium",
    ubicacion: "Córdoba Capital",
    m2_totales: 4200,
    unidades_totales: 38,
    fecha_inicio: "2026-07",
    fecha_entrega: "2027-12",
    duracion_meses: 18,
    estado: "En Ejecución",
    color: "#10B981", // Esmeralda / Green
    descripcion: "Torre residencial de alta gama con amenidades completas, piscina panorámica y cocheras subterráneas. Curva S en fase central de albañilería e instalaciones.",
    hitos: [
      { mes: "2026-07", titulo: "Inicio de Desembolsos", desc: "Replanteo y contrataciones principales", pct: 5 },
      { mes: "2026-11", titulo: "Fundaciones Concluidas", desc: "Hormigonado de bases y subsuelo", pct: 18 },
      { mes: "2027-04", titulo: "Hormigón Armado 70%", desc: "Avance de losas en torre", pct: 45 },
      { mes: "2027-09", titulo: "Pico de Inversión (Mes 09)", desc: "Simultaneidad de instalaciones y cerramientos", pct: 80 },
      { mes: "2027-12", titulo: "Entrega y Posesión", desc: "Terminaciones finales y recepción de unidades", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Estructura H°A°", pct: 32, color: "#2563EB" },
      { key: "albanileria", label: "Albañilería y Tabiques", pct: 20, color: "#10B981" },
      { key: "instalaciones", label: "Instalaciones Clima/Sanit/Elect", pct: 18, color: "#F59E0B" },
      { key: "carpinterias", label: "Carpinterías DVH y Fachada", pct: 15, color: "#8B5CF6" },
      { key: "terminaciones", label: "Terminaciones Prémium", pct: 10, color: "#EC4899" },
      { key: "gerenciamiento", label: "Gerenciamiento Técnico", pct: 5, color: "#64748B" }
    ],
    costos_mensuales: {
      // 2026 (Presupuesto 2026)
      "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 22809604, "2026-08": 0, "2026-09": 15495939, "2026-10": 14429867, "2026-11": 9950226, "2026-12": 19195745,
      // 2027 (Plan Oficial 2027)
      "2027-01": 98677049.46, "2027-02": 113702886.58, "2027-03": 129229704.06, "2027-04": 144607225.04,
      "2027-05": 159025595.17, "2027-06": 171576771.39, "2027-07": 181354016.76, "2027-08": 187576482.62,
      "2027-09": 189713411.30, "2027-10": 187576482.62, "2027-11": 181354016.76, "2027-12": 171576771.39
    }
  },
  {
    id: "proy_mas-duo",
    nombre: "+ DUO Proyecto",
    tag: "Curva S Expansión",
    categoria: "obra",
    tipologia: "Complejo Multifamiliar & Amenidades",
    ubicacion: "Córdoba Capital",
    m2_totales: 6800,
    unidades_totales: 58,
    fecha_inicio: "2027-01",
    fecha_entrega: "2027-12",
    duracion_meses: 12,
    estado: "En Ejecución",
    color: "#2563EB", // Azul
    descripcion: "Ampliación del complejo DUO con nuevas torres residenciales y áreas de recreación. Mayor demanda de inversión mensual de la cartera en el segundo semestre de 2027.",
    hitos: [
      { mes: "2027-01", titulo: "Lanzamiento y Replanteo", desc: "Inicio de obras civiles y contratistas", pct: 8 },
      { mes: "2027-04", titulo: "Avance de Estructura", desc: "Ritmo continuo de hormigonado", pct: 32 },
      { mes: "2027-08", titulo: "Etapa de Mampostería", desc: "Cierre de envolvente e interiores", pct: 60 },
      { mes: "2027-11", titulo: "Instalaciones Integrales", desc: "Acometidas generales y cableados", pct: 85 },
      { mes: "2027-12", titulo: "Hito Etapa 1 / Entrega", desc: "Cierre del ejercicio con $336M/mes", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Estructura H°A°", pct: 36, color: "#2563EB" },
      { key: "albanileria", label: "Albañilería y Muros", pct: 21, color: "#10B981" },
      { key: "instalaciones", label: "Instalaciones Generales", pct: 17, color: "#F59E0B" },
      { key: "carpinterias", label: "Carpinterías de Aluminio", pct: 12, color: "#8B5CF6" },
      { key: "terminaciones", label: "Pisos y Revestimientos", pct: 9, color: "#EC4899" },
      { key: "gerenciamiento", label: "Gastos Técnicos y Dirección", pct: 5, color: "#64748B" }
    ],
    costos_mensuales: {
      "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 0, "2026-08": 0, "2026-09": 0, "2026-10": 0, "2026-11": 0, "2026-12": 0,
      // 2027
      "2027-01": 98478146.69, "2027-02": 117909832.71, "2027-03": 140378962.23, "2027-04": 166008888.51,
      "2027-05": 194764406.26, "2027-06": 226384076.41, "2027-07": 208248916.65, "2027-08": 236509321.43,
      "2027-09": 264859069.16, "2027-10": 291988474.40, "2027-11": 316386332.73, "2027-12": 336479693.97
    }
  },
  {
    id: "proy_auria",
    nombre: "Auria Proyecto",
    tag: "Nueva Obra",
    categoria: "obra",
    tipologia: "Edificio Residencial & Comercial",
    ubicacion: "Córdoba Capital",
    m2_totales: 5100,
    unidades_totales: 44,
    fecha_inicio: "2027-06",
    fecha_entrega: "2028-12",
    duracion_meses: 19,
    estado: "Por Iniciar",
    color: "#F59E0B", // Ámbar / Naranja
    descripcion: "Nuevo emprendimiento de vanguardia con inicio de desembolsos en Junio 2027. Curva S con rampa progresiva de fundaciones hasta alcanzar su régimen pleno a fin de 2027 y 2028.",
    hitos: [
      { mes: "2027-06", titulo: "Inicio de Obra", desc: "Movimiento de suelos y submuración ($66,1M)", pct: 8 },
      { mes: "2027-08", titulo: "Bases y Cabezales", desc: "Hormigón de fundaciones profundas", pct: 22 },
      { mes: "2027-10", titulo: "Primera Losa Sobre Planta Baja", desc: "Estructura en altura", pct: 48 },
      { mes: "2027-12", titulo: "Régimen Pleno 2027", desc: "Cierre del año con $167,3M ejecutados/mes", pct: 75 },
      { mes: "2028-12", titulo: "Posesión y Entrega Proyectada", desc: "Finalización de obra y habitabilidad", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Estructura H°A°", pct: 38, color: "#2563EB" },
      { key: "albanileria", label: "Albañilería y Cerramientos", pct: 19, color: "#10B981" },
      { key: "instalaciones", label: "Instalaciones Termomecánicas", pct: 15, color: "#F59E0B" },
      { key: "carpinterias", label: "Carpinterías & Fachada", pct: 13, color: "#8B5CF6" },
      { key: "terminaciones", label: "Terminaciones y Pintura", pct: 10, color: "#EC4899" },
      { key: "gerenciamiento", label: "Honorarios y Permisos", pct: 5, color: "#64748B" }
    ],
    costos_mensuales: {
      "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 0, "2026-08": 0, "2026-09": 0, "2026-10": 0, "2026-11": 0, "2026-12": 0,
      "2027-01": 0.00, "2027-02": 0.00, "2027-03": 0.00, "2027-04": 0.00, "2027-05": 0.00,
      "2027-06": 66154138.13, "2027-07": 72791701.56, "2027-08": 87154943.93,
      "2027-09": 103763361.39, "2027-10": 122708132.46, "2027-11": 143963234.60, "2027-12": 167335420.92
    }
  },
  {
    id: "proy_300",
    nombre: "Cupo Link # 300",
    tag: "Cupo Fijo",
    categoria: "cupo",
    tipologia: "Edificio Residencial Link #300",
    ubicacion: "Córdoba Capital",
    m2_totales: 3400,
    unidades_totales: 32,
    fecha_inicio: "2026-01",
    fecha_entrega: "2027-12",
    duracion_meses: 24,
    estado: "En Ejecución",
    color: "#8B5CF6", // Púrpura
    descripcion: "Aporte y ejecución mensual societaria para el proyecto #300. Flujo estable y parejo de $53,97M mensuales durante todo 2027.",
    hitos: [
      { mes: "2026-01", titulo: "Inicio Desembolsos 2026", desc: "Aportes regulares de inicio", pct: 15 },
      { mes: "2026-08", titulo: "Consolidación de Aportes", desc: "Pico de $42,8M en 2026", pct: 40 },
      { mes: "2027-01", titulo: "Fase 2 - Régimen Fijo", desc: "Aporte regular de $53,97M/mes", pct: 55 },
      { mes: "2027-07", titulo: "Mitad de Ejercicio", desc: "Continuidad sin desvíos", pct: 78 },
      { mes: "2027-12", titulo: "Cierre Cupo Anual", desc: "Cumplimiento del 100% presupuestado", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Aporte Societario Obra", pct: 60, color: "#2563EB" },
      { key: "albanileria", label: "Contratistas e Insumos", pct: 25, color: "#10B981" },
      { key: "gerenciamiento", label: "Gerenciamiento Fiduciario", pct: 15, color: "#64748B" }
    ],
    costos_mensuales: {
      // 2026
      "2026-01": 38681705, "2026-02": 38936292, "2026-03": 38457672, "2026-04": 38651151,
      "2026-05": 39700052, "2026-06": 37021814, "2026-07": 39231587, "2026-08": 42846754,
      "2026-09": 28987102, "2026-10": 29403226, "2026-11": 24324540, "2026-12": 24226764,
      // 2027
      "2027-01": 53971118.99, "2027-02": 53971118.99, "2027-03": 53971118.99, "2027-04": 53971118.99,
      "2027-05": 53971118.99, "2027-06": 53971118.99, "2027-07": 53971118.99, "2027-08": 53971118.99,
      "2027-09": 53971118.99, "2027-10": 53971118.99, "2027-11": 53971118.99, "2027-12": 53971118.99
    }
  },
  {
    id: "proy_boulevard",
    nombre: "Cupo Link Boulevard",
    tag: "Cupo Fijo",
    categoria: "cupo",
    tipologia: "Edificio Link Boulevard",
    ubicacion: "Córdoba Capital",
    m2_totales: 3600,
    unidades_totales: 34,
    fecha_inicio: "2026-01",
    fecha_entrega: "2027-12",
    duracion_meses: 24,
    estado: "En Ejecución",
    color: "#EC4899", // Rosa / Fucsia
    descripcion: "Aporte societario y ejecución continua para el edificio Link Boulevard. $49,31M mensuales en 2027 tras el fuerte pico de desembolso a fines de 2026.",
    hitos: [
      { mes: "2026-01", titulo: "Arranque 2026", desc: "Aportes iniciales", pct: 12 },
      { mes: "2026-07", titulo: "Pico de Avance 2026", desc: "Desembolso de $94,9M en Julio", pct: 38 },
      { mes: "2026-12", titulo: "Pico Máximo 2026", desc: "Cierre récord con $105,7M en Diciembre", pct: 54 },
      { mes: "2027-01", titulo: "Régimen Fijo 2027", desc: "Aporte mensual de $49,31M", pct: 60 },
      { mes: "2027-12", titulo: "Cierre de Cupo", desc: "Consolidación total de la obra", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Aporte Societario Obra", pct: 65, color: "#2563EB" },
      { key: "albanileria", label: "Materiales y Contratistas", pct: 23, color: "#10B981" },
      { key: "gerenciamiento", label: "Gerenciamiento Fiduciario", pct: 12, color: "#64748B" }
    ],
    costos_mensuales: {
      // 2026
      "2026-01": 59173435, "2026-02": 57847286, "2026-03": 54816315, "2026-04": 64856703,
      "2026-05": 53868840, "2026-06": 45723403, "2026-07": 94977865, "2026-08": 20905253,
      "2026-09": 21287090, "2026-10": 43573541, "2026-11": 84850271, "2026-12": 105764448,
      // 2027
      "2027-01": 49310786.16, "2027-02": 49310786.16, "2027-03": 49310786.16, "2027-04": 49310786.16,
      "2027-05": 49310786.16, "2027-06": 49310786.16, "2027-07": 49310786.16, "2027-08": 49310786.16,
      "2027-09": 49310786.16, "2027-10": 49310786.16, "2027-11": 49310786.16, "2027-12": 49310786.16
    }
  },
  {
    id: "proy_neuquen",
    nombre: "Cupo Link Neuquén",
    tag: "Cupo Fijo",
    categoria: "cupo",
    tipologia: "Desarrollo Link Neuquén",
    ubicacion: "Neuquén Capital",
    m2_totales: 2800,
    unidades_totales: 26,
    fecha_inicio: "2027-01",
    fecha_entrega: "2027-12",
    duracion_meses: 12,
    estado: "En Ejecución",
    color: "#06B6D4", // Cyan
    descripcion: "Proyecto Link en Neuquén. Desembolso constante presupuestado de $30,80M por mes durante todo 2027.",
    hitos: [
      { mes: "2027-01", titulo: "Inicio Desembolsos", desc: "Activación del cupo mensual ($30,8M)", pct: 10 },
      { mes: "2027-06", titulo: "Mitad de Período", desc: "Continuidad operativa", pct: 50 },
      { mes: "2027-12", titulo: "Cierre de Ejercicio", desc: "Cumplimiento del plan anual", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Aporte Societario Obra", pct: 70, color: "#2563EB" },
      { key: "albanileria", label: "Contratistas Locales", pct: 20, color: "#10B981" },
      { key: "gerenciamiento", label: "Gerenciamiento Fiduciario", pct: 10, color: "#64748B" }
    ],
    costos_mensuales: {
      "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 0, "2026-08": 0, "2026-09": 0, "2026-10": 0, "2026-11": 0, "2026-12": 0,
      // 2027
      "2027-01": 30800000.00, "2027-02": 30800000.00, "2027-03": 30800000.00, "2027-04": 30800000.00,
      "2027-05": 30800000.00, "2027-06": 30800000.00, "2027-07": 30800000.00, "2027-08": 30800000.00,
      "2027-09": 30800000.00, "2027-10": 30800000.00, "2027-11": 30800000.00, "2027-12": 30800000.00
    }
  },
  {
    id: "proy_duo",
    nombre: "DUO (Histórico)",
    tag: "Finalizada / Cierre",
    categoria: "finalizada",
    tipologia: "Edificio DUO Original",
    ubicacion: "Córdoba Capital",
    m2_totales: 4500,
    unidades_totales: 42,
    fecha_inicio: "2026-01",
    fecha_entrega: "2026-10",
    duracion_meses: 10,
    estado: "Finalizado",
    color: "#64748B", // Slate
    descripcion: "Obra finalizada y entregada a fines de 2026 con un fuerte desembolso de $356M mensuales en el primer semestre de 2026. Sin desembolsos previstos en 2027.",
    hitos: [
      { mes: "2026-01", titulo: "Fase Final de Hormigón", desc: "Desembolso pleno de $356,3M", pct: 25 },
      { mes: "2026-06", titulo: "Terminaciones Generales", desc: "Último mes de obra gruesa masiva", pct: 85 },
      { mes: "2026-10", titulo: "Cierre y Entrega de Llaves", desc: "Entrega a propietarios y fin de desembolsos", pct: 100 }
    ],
    rubros: [
      { key: "estructura", label: "Estructura & Obra Gruesa", pct: 40, color: "#2563EB" },
      { key: "albanileria", label: "Albañilería y Terminaciones", pct: 35, color: "#10B981" },
      { key: "instalaciones", label: "Instalaciones y Conexiones", pct: 25, color: "#F59E0B" }
    ],
    costos_mensuales: {
      "2026-01": 356384338, "2026-02": 356384338, "2026-03": 356384338, "2026-04": 356384338,
      "2026-05": 356384338, "2026-06": 356384338, "2026-07": 34161635, "2026-08": 97952376,
      "2026-09": 287148043, "2026-10": 124680990, "2026-11": 0, "2026-12": 0,
      // 2027 sin desembolso
      "2027-01": 0, "2027-02": 0, "2027-03": 0, "2027-04": 0, "2027-05": 0, "2027-06": 0,
      "2027-07": 0, "2027-08": 0, "2027-09": 0, "2027-10": 0, "2027-11": 0, "2027-12": 0
    }
  }
];

export const MESES_HORIZONTE = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
  "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06",
  "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12"
];

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
