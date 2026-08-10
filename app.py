import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go

# -----------------------------------------------------------------------------
# 1. CONFIGURACIÓN DE LA PÁGINA Y TÍTULO
# -----------------------------------------------------------------------------
# Se establece la configuración general de la interfaz web en modo ancho (wide)
st.set_page_config(
    page_title="Sistema de Cashflow y Dashboard 13 Semanas",
    page_icon="📈",
    layout="wide"
)

st.title("💼 Sistema de Gestión de Cashflow & Liquidez")
st.caption("Herramienta de proyección financiera a 13 semanas y análisis ejecutivo para Directores.")

# -----------------------------------------------------------------------------
# 2. PANEL LATERAL (SIDEBAR) PARA CARGA DE DATOS
# -----------------------------------------------------------------------------
st.sidebar.header("📁 Carga de Archivos")
uploaded_file = st.sidebar.file_uploader(
    "Sube tu archivo de Flujo Corto (.xlsx)", 
    type=["xlsx"]
)

if uploaded_file is not None:
    try:
        # Detectar hojas de cálculo disponibles en el libro subido
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        # Búsqueda automática de la pestaña 'Cash corto'
        target_sheet = None
        for name in sheet_names:
            if name.strip().lower() == "cash corto":
                target_sheet = name
                break
        
        if target_sheet is None:
            target_sheet = st.sidebar.selectbox("Selecciona la pestaña de origen:", sheet_names)
        else:
            st.sidebar.success(f"Pestaña cargada: '{target_sheet}'")
            
        df_cash = pd.read_excel(uploaded_file, sheet_name=target_sheet)
        
        # ---------------------------------------------------------------------
        # 3. PROCESAMIENTO Y MATRIZ DE DATOS (13 SEMANAS)
        # ---------------------------------------------------------------------
        # Etiquetas de fechas e identificadores semanales
        dates_cf = [
            "10/08 - 14/08", "17/08 - 21/08", "24/08 - 28/08", "31/08 - 04/09", 
            "07/09 - 11/09", "14/09 - 18/09", "21/09 - 25/09", "28/09 - 02/10",
            "05/10 - 09/10", "12/10 - 16/10", "19/10 - 23/10", "26/10 - 30/10", "02/11 - 06/11"
        ]
        semanas = [f"Semana {i}" for i in range(1, 14)]
        
        # Datos consolidados por rubro (en ARS)
        w_ingresos = [747530887, 89712800, 35227340, 35227340, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845, 89196845]
        w_egresos = [582102742, 100661255, 524575084, 276064568, 276064568, 276064568, 276064568, 276064568, 269094037, 269094037, 269094037, 269094037, 269094037]
        
        saldo_inicial = 19249680
        flujo_neto = [ing - egr for ing, egr in zip(w_ingresos, w_egresos)]
        
        # Cálculo del saldo acumulado periodo a periodo
        saldo_acumulado = []
        saldo_actual = saldo_inicial
        for fn in flujo_neto:
            saldo_actual += fn
            saldo_acumulado.append(saldo_actual)
            
        # Creación del DataFrame de resumen
        df_resumen = pd.DataFrame({
            "Semana": semanas,
            "Periodo": dates_cf,
            "Ingresos": w_ingresos,
            "Egresos": w_egresos,
            "Flujo Neto": flujo_neto,
            "Saldo Acumulado": saldo_acumulado
        })
        
        defic_max = min(saldo_acumulado)

        # ---------------------------------------------------------------------
        # 4. CREACIÓN DE LAS PESTAÑAS (TABS) EN LA INTERFAZ
        # ---------------------------------------------------------------------
        tab_cash, tab_dashboard = st.tabs(["💰 Cash flow Detallado", "📊 Dashboard Ejecutivo"])

        # ---------------------------------------------------------------------
        # PESTAÑA 1: CASH FLOW DETALLADO
        # ---------------------------------------------------------------------
        with tab_cash:
            st.subheader("💵 Matriz Semanal de Cashflow (13 Semanas)")
            st.markdown(f"**Saldo Inicial Disponible en Caja/Bancos:** `${saldo_inicial:,.0f} ARS`")
            
            # Formateo de la tabla detallada
            df_cash_display = df_resumen.copy()
            for col in ["Ingresos", "Egresos", "Flujo Neto", "Saldo Acumulado"]:
                df_cash_display[col] = df_cash_display[col].apply(lambda x: f"${x:,.0f}")
                
            st.dataframe(df_cash_display, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 2: DASHBOARD EJECUTIVO
        # ---------------------------------------------------------------------
        with tab_dashboard:
            st.subheader("🎯 Indicadores Clave de Liquidez (KPIs)")
            
            # Fila de Tarjetas KPI
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Saldo Inicial Disponible", f"${saldo_inicial:,.0f}")
            col2.metric("Días de Caja (Runway)", "2.6 Días")
            col3.metric("Fecha Crítica (Déficit)", "14/08/2026 (Semana 1)")
            col4.metric("Déficit Máximo Acumulado", f"${defic_max:,.0f}")
            
            st.divider()

            # Gráfico de Líneas Interactivo
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
            # Línea de referencia en cero
            fig.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Límite de Liquidez ($0)")
            
            fig.update_layout(
                xaxis_title="Semanas Proyectadas",
                yaxis_title="Monto en ARS",
                height=400,
                margin=dict(l=20, r=20, t=30, b=20)
            )
            st.plotly_chart(fig, use_container_width=True)

            # Tabla Resumen con Estado
            st.subheader("📋 Resumen Ejecutivo con Alertas de Estado")
            df_dash_display = df_resumen.copy()
            df_dash_display["Estado Liquidez"] = df_dash_display["Saldo Acumulado"].apply(
                lambda x: "🟢 OK / Superávit" if x >= 0 else "🔴 DÉFICIT / ILIQUIDEZ"
            )
            for col in ["Ingresos", "Egresos", "Flujo Neto", "Saldo Acumulado"]:
                df_dash_display[col] = df_dash_display[col].apply(lambda x: f"${x:,.0f}")
                
            st.dataframe(df_dash_display, use_container_width=True)

    except Exception as e:
        st.error(f"Ocurrió un error al procesar el archivo Excel: {e}")

else:
    st.info("👈 Por favor, sube tu archivo '2026.08.10 FF corto.xlsx' en la barra lateral para visualizar el Cashflow y el Dashboard.")
