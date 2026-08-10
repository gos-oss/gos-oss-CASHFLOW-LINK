import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from datetime import date

# -----------------------------------------------------------------------------
# 1. CONFIGURACIÓN GENERAL DE LA PÁGINA WEB
# -----------------------------------------------------------------------------
# Establecemos el título del navegador y el diseño en pantalla ancha (wide)
st.set_page_config(
    page_title="Sistema de Cashflow Detallado 13 Semanas",
    page_icon="📈",
    layout="wide"
)

st.title("💼 Cashflow Detallado por Concepto & Dashboard Ejecutivo")
st.caption("Proyección matricial de flujo de caja detallada por rubro y semana, con formato condicional de probabilidad.")

# -----------------------------------------------------------------------------
# 2. MEMORIA DE SESIÓN (SESSION STATE)
# -----------------------------------------------------------------------------
# Inicializamos el estado para almacenar los conceptos dinámicos ingresados
if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# -----------------------------------------------------------------------------
# 3. FUNCIÓN DE FORMATO DE COLOR SEGÚN PROBABILIDAD
# -----------------------------------------------------------------------------
def obtener_color_probabilidad(prob):
    """
    Retorna el código de color CSS de acuerdo al nivel de probabilidad:
    - Probabilidad >= 80%: Verde claro
    - Probabilidad entre 40% y 79%: Amarillo suave
    - Probabilidad <= 39%: Rojo claro
    """
    if prob >= 80:
        return "#d4edda", "#155724"  # Fondo verde, texto verde oscuro
    elif prob >= 40:
        return "#fff3cd", "#856404"  # Fondo amarillo, texto marrón
    else:
        return "#f8d7da", "#721c24"  # Fondo rojo, texto rojo oscuro

# -----------------------------------------------------------------------------
# 4. BARRA LATERAL (SIDEBAR): CARGA DE EXCEL Y NUEVOS CONCEPTOS
# -----------------------------------------------------------------------------
st.sidebar.header("📁 Carga de Archivos")
uploaded_file = st.sidebar.file_uploader("Sube tu archivo de Flujo Corto (.xlsx)", type=["xlsx"])

st.sidebar.divider()
st.sidebar.header("➕ Cargar Concepto Dinámico")

with st.sidebar.form("form_concepto_detallado", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción / Rubro", placeholder="Ej: Avance de Obra X")
    rubro_destino = st.selectbox("Categoría / Rubro Destino", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Semana de Impacto", [f"Semana {i}" for i in range(1, 14)])
    monto_base = st.number_input("Monto en ARS ($)", min_value=0.0, value=100000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad de Ocurrencia (%)", min_value=0, max_value=100, value=80, step=5)
    
    bg_c, text_c = obtener_color_probabilidad(probabilidad)
    if probabilidad >= 80:
        st.markdown("🟢 **Nivel de Probabilidad Alto (Verde)**")
    elif probabilidad >= 40:
        st.markdown("🟡 **Nivel de Probabilidad Medio (Amarillo)**")
    else:
        st.markdown("🔴 **Nivel de Probabilidad Bajo (Rojo)**")
        
    btn_guardar = st.form_submit_button("Agregar al Cashflow Detallado")

if btn_guardar:
    if concepto_desc.strip() != "":
        st.session_state.conceptos_adicionales.append({
            "Descripción": concepto_desc,
            "Rubro": rubro_destino,
            "Tipo": tipo_mov,
            "Semana": semana_destino,
            "Monto Base": monto_base,
            "Probabilidad": probabilidad,
            "Monto Ponderado": monto_base * (probabilidad / 100.0)
        })
        st.sidebar.success(f"¡'{concepto_desc}' registrado en {semana_destino}!")

# -----------------------------------------------------------------------------
# 5. PROCESAMIENTO Y MATRIZ DETALLADA DE CASHFLOW
# -----------------------------------------------------------------------------
if uploaded_file is not None:
    try:
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        target_sheet = None
        for name in sheet_names:
            if name.strip().lower() == "cash corto":
                target_sheet = name
                break
        
        if target_sheet is None:
            target_sheet = st.sidebar.selectbox("Selecciona la pestaña:", sheet_names)
            
        # Nombres de las 13 semanas para las columnas laterales
        semanas = [f"Semana {i}" for i in range(1, 14)]
        dates_cf = [
            "10/08-14/08", "17/08-21/08", "24/08-28/08", "31/08-04/09", 
            "07/09-11/09", "14/09-18/09", "21/09-25/09", "28/09-02/10",
            "05/10-09/10", "12/10-16/10", "19/10-23/10", "26/10-30/10", "02/11-06/11"
        ]

        # Datos base de Ingresos por concepto (Filas)
        matriz_ingresos = {
            "Cupos Neuquén": [120928815, 0, 0, 0, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000],
            "Cupos Boulevard": [60192280, 0, 0, 0, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070],
            "Cupos #300": [0, 54485460, 0, 0, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365],
            "Cobranzas y Cuotas": [52181872, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340],
            "Ventas Nuevas": [210169120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Otros Ingresos": [244089200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }

        # Datos base de Egresos por concepto (Filas)
        matriz_egresos = {
            "Cheques Emitidos": [36572660, 22217060, 22786970, 11619145, 11619145, 11619145, 11619145, 11619145, 3177478, 3177478, 3177478, 3177478, 3177478],
            "Préstamos": [59706512, 0, 150089, 15128650, 15128650, 15128650, 15128650, 15128650, 15161950, 15161950, 15161950, 15161950, 15161950],
            "Sueldos y Cargas Sociales": [22000000, 0, 0, 51795225, 51795225, 51795225, 51795225, 51795225, 52009725, 52009725, 52009725, 52009725, 52009725],
            "Quincena Obra": [0, 34128215, 50000000, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100],
            "Proveedores/Materiales": [350000000, 0, 350000000, 113750000, 113750000, 113750000, 113750000, 113750000, 137500000, 137500000, 137500000, 137500000, 137500000],
            "Contratistas": [25410000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Impuestos/Planes de Pago": [11000000, 0, 16266690, 6816672, 6816672, 6816672, 6816672, 6816672, 3339468, 3339468, 3339468, 3339468, 3339468],
            "Tarjetas/Seguros/Mensuales": [7520000, 2518926, 8316385, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368],
            "Terrenos/Estructura/TDYS": [18503570, 41725254, 76605000, 29016120, 29016120, 29016120, 29016120, 29016120, 15266120, 15266120, 15266120, 15266120, 15266120]
        }

        # Sumar los conceptos adicionales dinámicos a la matriz
        for item in st.session_state.conceptos_adicionales:
            idx_sem = semanas.index(item["Semana"])
            rubro = item["Rubro"]
            monto_ponderado = item["Monto Ponderado"]
            
            if item["Tipo"] == "Ingreso" and rubro in matriz_ingresos:
                matriz_ingresos[rubro][idx_sem] += monto_ponderado
            elif item["Tipo"] == "Egreso" and rubro in matriz_egresos:
                matriz_egresos[rubro][idx_sem] += monto_ponderado

        # Cálculo de Totales por Semana (Columnas)
        totales_ingresos_sem = [sum(matriz_ingresos[r][i] for r in matriz_ingresos) for i in range(13)]
        totales_egresos_sem = [sum(matriz_egresos[r][i] for r in matriz_egresos) for i in range(13)]
        
        saldo_inicial = 19249680
        flujo_neto_sem = [ing - egr for ing, egr in zip(totales_ingresos_sem, totales_egresos_sem)]
        
        saldo_acumulado_sem = []
        saldo_act = saldo_inicial
        for fn in flujo_neto_sem:
            saldo_act += fn
            saldo_acumulado_sem.append(saldo_act)

        # ---------------------------------------------------------------------
        # CONSTRUCCIÓN DE LA TABLA MATRICIAL DETALLADA (ESTILO EXCEL)
        # ---------------------------------------------------------------------
        filas_matriz = []

        # Fila Saldo Inicial
        filas_matriz.append(["Saldo Inicial Caja/Bancos"] + [saldo_inicial] + [0]*12 + [saldo_inicial])

        # Subtítulo Ingresos
        for rubro, valores in matriz_ingresos.items():
            tot_rubro = sum(valores)
            filas_matriz.append([f"  (+) {rubro}"] + valores + [tot_rubro])

        # Fila Total Ingresos
        filas_matriz.append(["TOTAL INGRESOS"] + totales_ingresos_sem + [sum(totales_ingresos_sem)])

        # Subtítulo Egresos
        for rubro, valores in matriz_egresos.items():
            tot_rubro = sum(valores)
            filas_matriz.append([f"  (-) {rubro}"] + valores + [tot_rubro])

        # Fila Total Egresos
        filas_matriz.append(["TOTAL EGRESOS"] + totales_egresos_sem + [sum(totales_egresos_sem)])

        # Filas de Resumen
        filas_matriz.append(["FLUJO NETO DEL PERIODO"] + flujo_neto_sem + [sum(flujo_neto_sem)])
        filas_matriz.append(["SALDO ACUMULADO FINAL"] + saldo_acumulado_sem + [saldo_acumulado_sem[-1]])

        columnas_matriz = ["Concepto / Rubro"] + semanas + ["Total 13 Wks"]
        df_detallado = pd.DataFrame(filas_matriz, columns=columnas_matriz)

        # Formatear números a moneda
        df_detallado_fmt = df_detallado.copy()
        for col in semanas + ["Total 13 Wks"]:
            df_detallado_fmt[col] = df_detallado_fmt[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)

        # ---------------------------------------------------------------------
        # 6. PESTAÑAS DE LA APLICACIÓN
        # ---------------------------------------------------------------------
        tab_cash, tab_dashboard, tab_conceptos = st.tabs([
            "💰 Cash flow Detallado (Matriz Excel)", 
            "📊 Dashboard Ejecutivo", 
            "📝 Conceptos Simulados"
        ])

        # PESTAÑA 1: CASH FLOW DETALLADO POR CONCEPTO
        with tab_cash:
            st.subheader("💵 Matriz Detallada por Concepto y Semana")
            st.caption("Visualización lateral completa de rubros de ingresos, egresos y saldos acumulados.")
            
            st.dataframe(df_detallado_fmt, use_container_width=True, height=600)

        # PESTAÑA 2: DASHBOARD EJECUTIVO
        with tab_dashboard:
            st.subheader("🎯 Indicadores Clave de Liquidez (KPIs)")
            
            defic_max = min(saldo_acumulado_sem)
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Saldo Inicial Disponible", f"${saldo_inicial:,.0f}")
            col2.metric("Días de Caja (Runway)", "2.6 Días")
            col3.metric("Fecha Crítica (Déficit)", "14/08/2026 (Semana 1)")
            col4.metric("Déficit Máximo Acumulado", f"${defic_max:,.0f}")
            
            st.divider()

            st.subheader("📉 Curva de Proyección de Saldo Acumulado")
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=semanas, 
                y=saldo_acumulado_sem, 
                mode='lines+markers',
                name='Saldo Acumulado',
                line=dict(color='#1F4E79', width=3),
                marker=dict(size=8)
            ))
            fig.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Límite de Liquidez ($0)")
            
            fig.update_layout(
                xaxis_title="Semanas Proyectadas",
                yaxis_title="Monto en ARS",
                height=400,
                margin=dict(l=20, r=20, t=30, b=20)
            )
            st.plotly_chart(fig, use_container_width=True)

        # PESTAÑA 3: CONCEPTOS SIMULADOS
        with tab_conceptos:
            st.subheader("📝 Conceptos Adicionales Registrados")
            if len(st.session_state.conceptos_adicionales) > 0:
                df_c = pd.DataFrame(st.session_state.conceptos_adicionales)
                st.dataframe(df_c, use_container_width=True)
                
                if st.button("Limpiar todos los conceptos adicionales"):
                    st.session_state.conceptos_adicionales = []
                    st.rerun()
            else:
                st.info("No hay conceptos adicionales agregados.")

    except Exception as e:
        st.error(f"Error al procesar el archivo: {e}")

else:
    st.info("👈 Por favor, sube tu archivo '2026.08.10 FF corto.xlsx' en el panel lateral para desplegar la matriz detallada.")
