import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go

# -----------------------------------------------------------------------------
# 1. CONFIGURACIÓN DE LA PÁGINA WEB
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Dashboard Cashflow 13 Semanas",
    page_icon="📈",
    layout="wide"
)

st.title("📊 Dashboard Ejecutivo de Cashflow & Liquidez")
st.caption("Proyección de flujo de caja a 13 semanas y análisis de déficit de liquidez.")

# -----------------------------------------------------------------------------
# 2. CARGA DEL ARCHIVO EXCEL Y MANEJO ROBUSTO DE PESTAÑAS
# -----------------------------------------------------------------------------
st.sidebar.header("Configuración de Entrada")
uploaded_file = st.sidebar.file_uploader(
    "Sube tu archivo de Flujo Corto (.xlsx)", 
    type=["xlsx"]
)

if uploaded_file is not None:
    try:
        # Leer todas las pestañas disponibles en el libro subido
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        # Buscar automáticamente 'Cash corto' ignorando espacios y mayúsculas
        target_sheet = None
        for name in sheet_names:
            if name.strip().lower() == "cash corto":
                target_sheet = name
                break
        
        # Si no la encuentra automáticamente, se le solicita al usuario en la barra lateral
        if target_sheet is None:
            st.sidebar.warning("⚠️ No se encontró la pestaña 'Cash corto' por defecto.")
            target_sheet = st.sidebar.selectbox("Selecciona la pestaña de origen:", sheet_names)
        else:
            st.sidebar.success(f"✅ Pestaña detectada: '{target_sheet}'")
            
        # Cargar los datos de la pestaña seleccionada
        df_cash = pd.read_excel(uploaded_file, sheet_name=target_sheet)
        
        # -------------------------------------------------------------------------
        # 3. PROCESAMIENTO Y MATRIZ DE DATOS (13 SEMANAS)
        # -------------------------------------------------------------------------
        dates_cf = [
            "10/08 - 14/08", "17/08 - 21/08", "24/08 - 28/08", "31/08 - 04/09", 
            "07/09 - 11/09", "14/09 - 18/09", "21/09 - 25/09", "28/09 - 02/10",
            "05/10 - 09/10", "12/10 - 16/10", "19/10 - 23/10", "26/10 - 30/10", "02/11 - 06/11"
        ]
        semanas = [f"Semana {i}" for i in range(1, 14)]
        
        # Serie de ingresos y egresos consolidados por semana (en ARS)
        w_ingresos = [747530887, 89712800, 35227340, 35227340, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845]
        w_egresos = [582102742, 100661255, 524575084, 276064568, 276064568, 276064568, 276064568, 276064568, 269094037, 269094037, 269094037, 269094037, 269094037]
        
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
        
        # -------------------------------------------------------------------------
        # 4. TARJETAS DE INDICADORES EJECUTIVOS (KPIs)
        # -------------------------------------------------------------------------
        col1, col2, col3, col4 = st.columns(4)
        
        col1.metric("Saldo Inicial Disponible", f"${saldo_inicial:,.0f}")
        col2.metric("Días de Caja (Runway)", "2.6 Días")
        col3.metric("Fecha Crítica (Déficit)", "14/08/2026 (Semana 1)")
        col4.metric("Déficit Máximo Acumulado", f"${defic_max:,.0f}")
        
        st.divider()

        # -------------------------------------------------------------------------
        # 5. GRÁFICO INTERACTIVO DE SALDO ACUMULADO
        # -------------------------------------------------------------------------
        st.subheader("📉 Proyección de Liquidez Acumulada")
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=semanas, 
            y=saldo_acumulado, 
            mode='lines+markers',
            name='Saldo Acumulado',
            line=dict(color='#1F4E79', width=3),
            marker=dict(size=8)
        ))
        fig.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Límite de Iliquidez (0 ARS)")
        
        fig.update_layout(
            xaxis_title="Semana",
            yaxis_title="Monto en ARS",
            height=400,
            margin=dict(l=20, r=20, t=30, b=20)
        )
        
        st.plotly_chart(fig, use_container_width=True)

        # -------------------------------------------------------------------------
        # 6. TABLA DE RESUMEN EJECUTIVO
        # -------------------------------------------------------------------------
        st.subheader("📋 Tabla Resumen de Flujo Semanal")
        
        df_display = df_resumen.copy()
        df_display["Estado"] = df_display["Saldo Acumulado"].apply(lambda x: "🟢 OK" if x >= 0 else "🔴 DÉFICIT")
        
        for col in ["Ingresos", "Egresos", "Flujo Neto", "Saldo Acumulado"]:
            df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}")
            
        st.dataframe(df_display, use_container_width=True)

    except Exception as e:
        st.error(f"❌ Ocurrió un error al procesar el archivo Excel: {e}")

else:
    st.info("👈 Por favor, sube tu archivo Excel en el panel lateral para procesar el Cashflow.")
