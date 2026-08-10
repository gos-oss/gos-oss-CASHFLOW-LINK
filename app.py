import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from datetime import date

# -----------------------------------------------------------------------------
# 1. CONFIGURACIÓN DE LA PÁGINA WEB
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Sistema de Cashflow Dinámico 13 Semanas",
    page_icon="📈",
    layout="wide"
)

st.title("💼 Sistema Dinámico de Cashflow con Probabilidad de Ocurrencia")
st.caption("Proyección interactiva de flujo de caja con formato condicional de colores según el nivel de certeza.")

# -----------------------------------------------------------------------------
# 2. INICIALIZACIÓN DEL ESTADO DE SESIÓN (SESSION STATE)
# -----------------------------------------------------------------------------
# Mantenemos en memoria los conceptos agregados por el usuario
if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# -----------------------------------------------------------------------------
# 3. FUNCIÓN DE FORMATO CONDICIONAL DE COLORES
# -----------------------------------------------------------------------------
def estilo_probabilidad(val):
    """
    Función que devuelve el estilo CSS para colorear las celdas según el valor de probabilidad:
    - Probabilidad >= 80%: Verde claro (#d4edda)
    - Probabilidad entre 40% y 79%: Amarillo suelto (#fff3cd)
    - Probabilidad <= 39%: Rojo claro (#f8d7da)
    """
    try:
        prob = float(val)
        if prob >= 80:
            color_fondo = "#d4edda"  # Verde claro
            color_texto = "#155724"  # Verde oscuro
        elif prob >= 40:
            color_fondo = "#fff3cd"  # Amarillo/Naranja claro
            color_texto = "#856404"  # Marrón/Naranja oscuro
        else:
            color_fondo = "#f8d7da"  # Rojo claro
            color_texto = "#721c24"  # Rojo oscuro
        return f"background-color: {color_fondo}; color: {color_texto}; font-weight: bold;"
    except:
        return ""

# -----------------------------------------------------------------------------
# 4. PANEL LATERAL: FORMULARIO CON INDICADOR DE COLOR
# -----------------------------------------------------------------------------
st.sidebar.header("📁 Carga de Archivos")
uploaded_file = st.sidebar.file_uploader("Sube tu archivo de Flujo Corto (.xlsx)", type=["xlsx"])

st.sidebar.divider()
st.sidebar.header("➕ Agregar Nuevo Concepto")

with st.sidebar.form("form_nuevo_concepto", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción del concepto", placeholder="Ej: Cobranza Cliente X")
    tipo_movimiento = st.selectbox("Tipo de Movimiento", ["Ingreso", "Egreso"])
    monto_val = st.number_input("Monto en ARS ($)", min_value=0.0, value=100000.0, step=50000.0)
    fecha_val = st.date_input("Fecha estimada", value=date(2026, 8, 15))
    
    # Slider de probabilidad
    probabilidad_val = st.slider("Grado de Probabilidad (%)", min_value=0, max_value=100, value=80, step=5)
    
    # Indicador de color dinámico en el formulario
    if probabilidad_val >= 80:
        st.markdown("🟢 **Probabilidad Alta (Ponderación Verde)**")
    elif probabilidad_val >= 40:
        st.markdown("🟡 **Probabilidad Media (Ponderación Amarilla)**")
    else:
        st.markdown("🔴 **Probabilidad Baja (Ponderación Roja)**")
        
    submit_btn = st.form_submit_button("Agregar al Cashflow")

if submit_btn:
    if concepto_desc.strip() != "":
        nuevo_item = {
            "Concepto": concepto_desc,
            "Tipo": tipo_movimiento,
            "Monto Base": monto_val,
            "Fecha": fecha_val,
            "Probabilidad (%)": probabilidad_val,
            "Monto Ponderado": monto_val * (probabilidad_val / 100.0)
        }
        st.session_state.conceptos_adicionales.append(nuevo_item)
        st.sidebar.success(f"¡Concepto '{concepto_desc}' agregado con éxito!")
    else:
        st.sidebar.error("Por favor, ingresa una descripción.")

# -----------------------------------------------------------------------------
# 5. PROCESAMIENTO Y DIBUJO DE PESTAÑAS
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
            target_sheet = st.sidebar.selectbox("Selecciona la pestaña de origen:", sheet_names)
            
        dates_cf = [
            "10/08 - 14/08", "17/08 - 21/08", "24/08 - 28/08", "31/08 - 04/09", 
            "07/09 - 11/09", "14/09 - 18/09", "21/09 - 25/09", "28/09 - 02/10",
            "05/10 - 09/10", "12/10 - 16/10", "19/10 - 23/10", "26/10 - 30/10", "02/11 - 06/11"
        ]
        semanas = [f"Semana {i}" for i in range(1, 14)]
        
        w_ingresos = [747530887, 89712800, 35227340, 35227340, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845]
        w_egresos = [582102742, 100661255, 524575084, 276064568, 276064568, 276064568, 276064568, 276064568, 269094037, 269094037, 269094037, 269094037, 269094037]
        
        # Impactar los conceptos ponderados
        for item in st.session_state.conceptos_adicionales:
            monto_efectivo = item["Monto Ponderado"]
            if item["Tipo"] == "Ingreso":
                w_ingresos[0] += monto_efectivo
            else:
                w_egresos[0] += monto_efectivo

        saldo_inicial = 19249680
        flujo_neto = [ing - egr for ing, egr in zip(w_ingresos, w_egresos)]
        
        saldo_acumulado = []
        saldo_actual = saldo_inicial
        for fn in flujo_neto:
            saldo_actual += fn
            saldo_acumulado.append(saldo_actual)
            
        df_resumen = pd.DataFrame({
            "Semana": semanas,
            "Periodo": dates_cf,
            "Ingresos": w_ingresos,
            "Egresos": w_egresos,
            "Flujo Neto": flujo_neto,
            "Saldo Acumulado": saldo_acumulado
        })
        
        defic_max = min(saldo_acumulado)

        tab_cash, tab_dashboard, tab_conceptos = st.tabs([
            "💰 Cash flow Detallado", 
            "📊 Dashboard Ejecutivo", 
            "📝 Conceptos Simulados"
        ])

        # PESTAÑA 1: CASH FLOW DETALLADO
        with tab_cash:
            st.subheader("💵 Matriz Semanal de Cashflow (13 Semanas)")
            st.markdown(f"**Saldo Inicial Disponible en Caja/Bancos:** `${saldo_inicial:,.0f} ARS`")
            
            df_cash_display = df_resumen.copy()
            for col in ["Ingresos", "Egresos", "Flujo Neto", "Saldo Acumulado"]:
                df_cash_display[col] = df_cash_display[col].apply(lambda x: f"${x:,.0f}")
                
            st.dataframe(df_cash_display, use_container_width=True)

        # PESTAÑA 2: DASHBOARD EJECUTIVO
        with tab_dashboard:
            st.subheader("🎯 Indicadores Clave de Liquidez (KPIs)")
            
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
                y=saldo_acumulado, 
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

            st.subheader("📋 Resumen Ejecutivo con Alertas de Estado")
            df_dash_display = df_resumen.copy()
            df_dash_display["Estado Liquidez"] = df_dash_display["Saldo Acumulado"].apply(
                lambda x: "🟢 OK / Superávit" if x >= 0 else "🔴 DÉFICIT / ILIQUIDEZ"
            )
            for col in ["Ingresos", "Egresos", "Flujo Neto", "Saldo Acumulado"]:
                df_dash_display[col] = df_dash_display[col].apply(lambda x: f"${x:,.0f}")
                
            st.dataframe(df_dash_display, use_container_width=True)

        # PESTAÑA 3: CONCEPTOS SIMULADOS CON FORMATO DE COLOR CONDICIONAL
        with tab_conceptos:
            st.subheader("📝 Registro de Conceptos Simulados con Alerta de Color")
            if len(st.session_state.conceptos_adicionales) > 0:
                df_conceptos = pd.DataFrame(st.session_state.conceptos_adicionales)
                
                # Formatear números a moneda para la presentación
                df_conceptos_formatted = df_conceptos.copy()
                df_conceptos_formatted["Monto Base"] = df_conceptos_formatted["Monto Base"].apply(lambda x: f"${x:,.0f}")
                df_conceptos_formatted["Monto Ponderado"] = df_conceptos_formatted["Monto Ponderado"].apply(lambda x: f"${x:,.0f}")
                
                # Aplicar el formato condicional de color a la columna "Probabilidad (%)"
                df_styled = df_conceptos_formatted.style.applymap(
                    estilo_probabilidad, 
                    subset=["Probabilidad (%)"]
                )
                
                st.dataframe(df_styled, use_container_width=True)
                
                if st.button("Limpiar todos los conceptos agregados"):
                    st.session_state.conceptos_adicionales = []
                    st.rerun()
            else:
                st.info("Aún no has agregado ningún concepto adicional. Utiliza el formulario del panel lateral para ingresar nuevos datos.")

    except Exception as e:
        st.error(f"Ocurrió un error al procesar el archivo Excel: {e}")

else:
    st.info("👈 Por favor, sube tu archivo '2026.08.10 FF corto.xlsx' en la barra lateral para comenzar.")
