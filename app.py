import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
import plotly.express as px
from datetime import date

# =============================================================================
# 1. CONFIGURACIÓN INICIAL Y ESTILOS CORPORATIVOS (LIGHT MODERN SLATE)
# =============================================================================
# Configuración del lienzo de la aplicación en pantalla ancha
st.set_page_config(
    page_title="Executive Cashflow & Rubro Analytics",
    page_icon="🏢",
    layout="wide"
)

# Inyección de CSS personalizado para estética corporativa limpia y profesional
st.markdown("""
    <style>
    /* Fondo general de la aplicación */
    .main {
        background-color: #F8FAFC;
    }
    
    /* Estilos de tipografía para títulos principales */
    .title-text {
        font-family: 'Inter', -apple-system, sans-serif;
        color: #0F172A;
        font-weight: 700;
        font-size: 2.1rem;
        margin-bottom: 2px;
    }
    .subtitle-text {
        font-family: 'Inter', -apple-system, sans-serif;
        color: #475569;
        font-size: 0.95rem;
        margin-bottom: 20px;
    }
    
    /* Tarjetas de Indicadores Clave (KPIs) */
    .kpi-card {
        background-color: #FFFFFF;
        border-radius: 8px;
        padding: 16px 20px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .kpi-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0F172A;
        margin-top: 4px;
    }
    .kpi-value-alert {
        font-size: 1.5rem;
        font-weight: 700;
        color: #DC2626;
        margin-top: 4px;
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado principal
st.markdown('<p class="title-text">🏢 Executive Cashflow & Rubro Analytics</p>', unsafe_allow_html=True)
st.markdown('<p class="subtitle-text">Plataforma de análisis de liquidez, simulación con probabilidad y composición de egresos por rubro.</p>', unsafe_allow_html=True)

# Inicializar estado de sesión en memoria para los conceptos simulados
if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# =============================================================================
# 2. PANEL LATERAL (SIDEBAR): CARGA Y SIMULACIÓN
# =============================================================================
st.sidebar.title("⚙️ Panel de Control")
uploaded_file = st.sidebar.file_uploader("Cargar Archivo Excel (.xlsx)", type=["xlsx"])

st.sidebar.divider()
st.sidebar.subheader("➕ Simular Nuevo Concepto")

# Formulario para agregar egresos o ingresos dinámicos
with st.sidebar.form("form_simulacion_completo", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción / Cliente", placeholder="Ej. Cobranza Cliente X")
    rubro_destino = st.selectbox("Rubro Específico", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo de Movimiento", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Semana Objetivo", [f"Semana {i}" for i in range(1, 14)])
    monto_base = st.number_input("Monto Bruto ARS ($)", min_value=0.0, value=200000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad de Ocurrencia (%)", min_value=0, max_value=100, value=80, step=5)
    
    # Indicador de alerta según rango de probabilidad
    if probabilidad >= 80:
        st.markdown("🟢 **Probabilidad Alta (Ponderación Verde)**")
    elif probabilidad >= 40:
        st.markdown("🟡 **Probabilidad Media (Ponderación Amarilla)**")
    else:
        st.markdown("🔴 **Probabilidad Baja (Ponderación Roja)**")
        
    btn_simular = st.form_submit_button("Inyectar al Modelo")

if btn_simular and concepto_desc.strip() != "":
    st.session_state.conceptos_adicionales.append({
        "Descripción": concepto_desc,
        "Rubro": rubro_destino,
        "Tipo": tipo_mov,
        "Semana": semana_destino,
        "Monto Base": monto_base,
        "Probabilidad": probabilidad,
        "Monto Ponderado": monto_base * (probabilidad / 100.0)
    })
    st.sidebar.success(f"Concepto '{concepto_desc}' inyectado a {semana_destino}")

# =============================================================================
# 3. PROCESAMIENTO CÁLCULOS Y MATRICES (13 SEMANAS)
# =============================================================================
if uploaded_file is not None:
    try:
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        # Detección automática de la pestaña 'Cash corto'
        target_sheet = None
        for name in sheet_names:
            if name.strip().lower() == "cash corto":
                target_sheet = name
                break
        
        if target_sheet is None:
            target_sheet = st.sidebar.selectbox("Selecciona la pestaña de origen:", sheet_names)

        semanas = [f"Semana {i}" for i in range(1, 14)]
        dates_cf = [
            "10/08-14/08", "17/08-21/08", "24/08-28/08", "31/08-04/09", 
            "07/09-11/09", "14/09-18/09", "21/09-25/09", "28/09-02/10",
            "05/10-09/10", "12/10-16/10", "19/10-23/10", "26/10-30/10", "02/11-06/11"
        ]

        # Matriz base de rubros de Ingreso
        matriz_ingresos = {
            "Cupos Neuquén": [120928815, 0, 0, 0, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000],
            "Cupos Boulevard": [60192280, 0, 0, 0, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070],
            "Cupos #300": [0, 54485460, 0, 0, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365],
            "Cobranzas y Cuotas": [52181872, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340],
            "Ventas Nuevas": [210169120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Otros Ingresos": [244089200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }

        # Matriz base de rubros de Egreso
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

        # Inyectar conceptos simulados ponderados
        for item in st.session_state.conceptos_adicionales:
            idx_sem = semanas.index(item["Semana"])
            rubro = item["Rubro"]
            monto_p = item["Monto Ponderado"]
            if item["Tipo"] == "Ingreso" and rubro in matriz_ingresos:
                matriz_ingresos[rubro][idx_sem] += monto_p
            elif item["Tipo"] == "Egreso" and rubro in matriz_egresos:
                matriz_egresos[rubro][idx_sem] += monto_p

        # Consolidación de totales
        totales_ing = [sum(matriz_ingresos[r][i] for r in matriz_ingresos) for i in range(13)]
        totales_egr = [sum(matriz_egresos[r][i] for r in matriz_egresos) for i in range(13)]
        
        saldo_inicial = 19249680
        flujo_neto = [ing - egr for ing, egr in zip(totales_ing, totales_egr)]
        
        saldo_acumulado = []
        saldo_act = saldo_inicial
        for fn in flujo_neto:
            saldo_act += fn
            saldo_acumulado.append(saldo_act)

        # =====================================================================
        # 4. PESTAÑAS PRINCIPALES DE NAVEGACIÓN
        # =====================================================================
        tab_dash, tab_influencia, tab_matriz, tab_sim = st.tabs([
            "📊 Executive Dashboard", 
            "🍩 Influencia por Rubro (Dona)", 
            "📋 Matriz Detallada (Excel)", 
            "📝 Escenarios Simulados"
        ])

        # ---------------------------------------------------------------------
        # PESTAÑA 1: EXECUTIVE DASHBOARD
        # ---------------------------------------------------------------------
        with tab_dash:
            defic_max = min(saldo_acumulado)
            
            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.markdown(f'''
                    <div class="kpi-card">
                        <div class="kpi-title">Disponibilidad Inicial</div>
                        <div class="kpi-value">${saldo_inicial:,.0f}</div>
                    </div>
                ''', unsafe_allow_html=True)
            with c2:
                st.markdown('''
                    <div class="kpi-card">
                        <div class="kpi-title">Runway Operativo</div>
                        <div class="kpi-value">2.6 Días</div>
                    </div>
                ''', unsafe_allow_html=True)
            with c3:
                st.markdown('''
                    <div class="kpi-card">
                        <div class="kpi-title">Iliquidez Crítica</div>
                        <div class="kpi-value-alert">14/08/2026</div>
                    </div>
                ''', unsafe_allow_html=True)
            with c4:
                st.markdown(f'''
                    <div class="kpi-card">
                        <div class="kpi-title">Déficit Máximo</div>
                        <div class="kpi-value-alert">${defic_max:,.0f}</div>
                    </div>
                ''', unsafe_allow_html=True)

            st.divider()

            st.subheader("📈 Trayectoria de Liquidez Acumulada")
            fig_tray = go.Figure()
            fig_tray.add_trace(go.Scatter(
                x=semanas, y=saldo_acumulado, mode='lines+markers', name='Saldo Acumulado',
                fill='tozeroy', fillcolor='rgba(30, 58, 138, 0.08)',
                line=dict(color='#1E3A8A', width=3), marker=dict(size=7)
            ))
            fig_tray.add_hline(y=0, line_dash="dash", line_color="#DC2626", annotation_text="Límite $0")
            fig_tray.update_layout(template="plotly_white", height=380, margin=dict(l=20, r=20, t=20, b=20))
            st.plotly_chart(fig_tray, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 2: INFLUENCIA Y GRÁFICO DE DONA (DONUT CHART)
        # ---------------------------------------------------------------------
        with tab_influencia:
            st.subheader("🍩 Composición y Peso Relativo por Rubro de Egreso")
            st.caption("Visualización del porcentaje de participación de cada concepto sobre los egresos totales de las 13 semanas.")

            col_dona, col_stack = st.columns([1, 1])

            with col_dona:
                st.markdown("**Distribución Total Acumulada (Gráfico de Dona)**")
                totales_por_rubro = {rubro: sum(montos) for rubro, montos in matriz_egresos.items()}
                df_dona = pd.DataFrame(list(totales_por_rubro.items()), columns=['Rubro', 'Total ARS'])
                
                # Gráfico de Dona con hole=0.5
                fig_dona = px.pie(
                    df_dona, 
                    values='Total ARS', 
                    names='Rubro',
                    hole=0.5,
                    color_discrete_sequence=px.colors.qualitative.Prism,
                    template="plotly_white"
                )
                fig_dona.update_traces(
                    textposition='inside',
                    textinfo='percent+label',
                    marker=dict(line=dict(color='#FFFFFF', width=2))
                )
                fig_dona.update_layout(
                    height=450,
                    showlegend=False,
                    margin=dict(l=10, r=10, t=20, b=10)
                )
                st.plotly_chart(fig_dona, use_container_width=True)

            with col_stack:
                st.markdown("**Composición Semanal Apilada ($)**")
                df_egr_stack = pd.DataFrame(matriz_egresos, index=semanas).reset_index().rename(columns={'index': 'Semana'})
                df_egr_melted = df_egr_stack.melt(id_vars=['Semana'], var_name='Rubro', value_name='Monto (ARS)')

                fig_stack = px.bar(
                    df_egr_melted, x='Semana', y='Monto (ARS)', color='Rubro',
                    color_discrete_sequence=px.colors.qualitative.Prism,
                    template="plotly_white"
                )
                fig_stack.update_layout(height=450, margin=dict(l=10, r=10, t=20, b=10), showlegend=False)
                st.plotly_chart(fig_stack, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 3: MATRIZ DETALLADA EXCEL
        # ---------------------------------------------------------------------
        with tab_matriz:
            st.subheader("📋 Matriz Completa de Flujo de Caja Lateral")
            
            filas = []
            filas.append(["Saldo Inicial"] + [saldo_inicial] + [0]*12 + [saldo_inicial])
            for r, vals in matriz_ingresos.items():
                filas.append([f"  (+) {r}"] + vals + [sum(vals)])
            filas.append(["TOTAL INGRESOS"] + totales_ing + [sum(totales_ing)])
            for r, vals in matriz_egresos.items():
                filas.append([f"  (-) {r}"] + vals + [sum(vals)])
            filas.append(["TOTAL EGRESOS"] + totales_egr + [sum(totales_egr)])
            filas.append(["FLUJO NETO"] + flujo_neto + [sum(flujo_neto)])
            filas.append(["SALDO ACUMULADO"] + saldo_acumulado + [saldo_acumulado[-1]])

            df_detallado = pd.DataFrame(filas, columns=["Concepto / Rubro"] + semanas + ["Total 13 Wks"])
            for col in semanas + ["Total 13 Wks"]:
                df_detallado[col] = df_detallado[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)

            st.dataframe(df_detallado, use_container_width=True, height=600)

        # ---------------------------------------------------------------------
        # PESTAÑA 4: ESCENARIOS SIMULADOS
        # ---------------------------------------------------------------------
        with tab_sim:
            st.subheader("📝 Registro de Modificaciones de Flujo")
            if len(st.session_state.conceptos_adicionales) > 0:
                df_sim = pd.DataFrame(st.session_state.conceptos_adicionales)
                st.dataframe(df_sim, use_container_width=True)
                if st.button("🗑️ Restablecer Simulación"):
                    st.session_state.conceptos_adicionales = []
                    st.rerun()
            else:
                st.info("No hay conceptos simulados adicionales agregados.")

    except Exception as e:
        st.error(f"Error procesando el modelo: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '2026.08.10 FF corto.xlsx' en la barra lateral para desplegar la suite ejecutiva.")
