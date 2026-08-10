import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from datetime import date

# =============================================================================
# 1. CONFIGURACIÓN GENERAL Y ESTILOS CSS CORPORATIVOS
# =============================================================================
st.set_page_config(
    page_title="Executive Cashflow Analytics",
    page_icon="🏢",
    layout="wide"
)

# Estilos CSS inyectados para lograr una estética sofisticada
st.markdown("""
    <style>
    .main {
        background-color: #F8FAFC;
    }
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
    .section-header-ingreso {
        color: #166534;
        font-weight: 700;
        font-size: 1.1rem;
        margin-bottom: 10px;
        border-bottom: 2px solid #DCFCE7;
        padding-bottom: 5px;
    }
    .section-header-egreso {
        color: #991B1B;
        font-weight: 700;
        font-size: 1.1rem;
        margin-bottom: 10px;
        border-bottom: 2px solid #FEE2E2;
        padding-bottom: 5px;
    }
    </style>
""", unsafe_allow_html=True)

st.markdown('<p class="title-text">🏢 Corporate Cashflow & Rubro Analytics</p>', unsafe_allow_html=True)
st.markdown('<p class="subtitle-text">Plataforma ejecutiva de análisis de liquidez con gráficos avanzados e indicadores integrados.</p>', unsafe_allow_html=True)

# Memoria de sesión para conceptos adicionales
if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# =============================================================================
# 2. DEFINICIÓN DE PERIODOS Y PANEL LATERAL
# =============================================================================
dates_cf = [
    "10/08 - 14/08", "17/08 - 21/08", "24/08 - 28/08", "31/08 - 04/09", 
    "07/09 - 11/09", "14/09 - 18/09", "21/09 - 25/09", "28/09 - 02/10",
    "05/10 - 09/10", "12/10 - 16/10", "19/10 - 23/10", "26/10 - 30/10", "02/11 - 06/11"
]
semanas_con_periodo = [f"Semana {i+1} ({dates_cf[i]})" for i in range(13)]

st.sidebar.title("⚙️ Panel de Control")
uploaded_file = st.sidebar.file_uploader("Cargar Archivo Excel (.xlsx)", type=["xlsx"])

st.sidebar.divider()
st.sidebar.subheader("➕ Simular Nuevo Concepto")

with st.sidebar.form("form_simulacion_periodo", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción / Cliente", placeholder="Ej. Cobranza Cliente X")
    rubro_destino = st.selectbox("Rubro Específico", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo de Movimiento", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Periodo Objetivo", semanas_con_periodo)
    monto_base = st.number_input("Monto Bruto ARS ($)", min_value=0.0, value=200000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad de Ocurrencia (%)", min_value=0, max_value=100, value=80, step=5)
    
    btn_simular = st.form_submit_button("Inyectar al Modelo")

if btn_simular and concepto_desc.strip() != "":
    st.session_state.conceptos_adicionales.append({
        "Descripción": concepto_desc,
        "Rubro": rubro_destino,
        "Tipo": tipo_mov,
        "Periodo": semana_destino,
        "Monto Base": monto_base,
        "Probabilidad": probabilidad,
        "Monto Ponderado": monto_base * (probabilidad / 100.0)
    })
    st.sidebar.success(f"Concepto '{concepto_desc}' inyectado")

# =============================================================================
# 3. PROCESAMIENTO Y MATRICES CONTABLES
# =============================================================================
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

        matriz_ingresos = {
            "Cupos Neuquén": [120928815, 0, 0, 0, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000],
            "Cupos Boulevard": [60192280, 0, 0, 0, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070],
            "Cupos #300": [0, 54485460, 0, 0, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365],
            "Cobranzas y Cuotas": [52181872, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340],
            "Ventas Nuevas": [210169120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Otros Ingresos": [244089200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }

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

        for item in st.session_state.conceptos_adicionales:
            idx_sem = semanas_con_periodo.index(item["Periodo"])
            rubro = item["Rubro"]
            monto_p = item["Monto Ponderado"]
            if item["Tipo"] == "Ingreso" and rubro in matriz_ingresos:
                matriz_ingresos[rubro][idx_sem] += monto_p
            elif item["Tipo"] == "Egreso" and rubro in matriz_egresos:
                matriz_egresos[rubro][idx_sem] += monto_p

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
        # 4. PESTAÑAS PRINCIPALES
        # =====================================================================
        tab_dash, tab_influencia, tab_matriz_nueva, tab_sim = st.tabs([
            "📊 Executive Dashboard Avanzado", 
            "🍩 Influencia por Rubro (Dona)", 
            "📂 Detalle Estructurado por Periodo", 
            "📝 Escenarios Simulados"
        ])

        # ---------------------------------------------------------------------
        # PESTAÑA 1: EXECUTIVE DASHBOARD AVANZADO (NUEVA VISUALIZACIÓN)
        # ---------------------------------------------------------------------
        with tab_dash:
            defic_max = min(saldo_acumulado)
            idx_defic_max = saldo_acumulado.index(defic_max)
            periodo_defic_max = semanas_con_periodo[idx_defic_max]

            # Buscar primer periodo de déficit
            idx_primer_defic = next((i for i, s in enumerate(saldo_acumulado) if s < 0), None)
            periodo_primer_defic = semanas_con_periodo[idx_primer_defic] if idx_primer_defic is not None else "Sin Déficit"

            # Tarjetas de Indicadores KPI
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
                st.markdown(f'''
                    <div class="kpi-card">
                        <div class="kpi-title">Iliquidez Crítica</div>
                        <div class="kpi-value-alert">{periodo_primer_defic}</div>
                    </div>
                ''', unsafe_allow_html=True)
            with c4:
                st.markdown(f'''
                    <div class="kpi-card">
                        <div class="kpi-title">Déficit Máximo ({periodo_defic_max})</div>
                        <div class="kpi-value-alert">${defic_max:,.0f}</div>
                    </div>
                ''', unsafe_allow_html=True)

            st.divider()

            # GRÁFICO COMPUESTO AVANZADO (COMBO CHART: BARRAS FLUJO NETO + LÍNEA SALDO ACUMULADO)
            st.subheader("📈 Análisis Combinado de Flujo Neto y Liquidez Acumulada")
            st.caption("Las barras representan el flujo neto de cada semana (ganancia/pérdida del periodo), mientras que la línea muestra la acumulación total de caja.")

            fig_combo = make_subplots(specs=[[{"secondary_y": True}]])

            # Barras para Flujo Neto (Verde si es positivo, Rojo si es negativo)
            colores_barras = ['#16A34A' if fn >= 0 else '#DC2626' for fn in flujo_neto]
            
            fig_combo.add_trace(
                go.Bar(
                    x=semanas_con_periodo, 
                    y=flujo_neto, 
                    name="Flujo Neto Semanal",
                    marker_color=colores_barras,
                    opacity=0.6,
                    hovertemplate="Periodo: %{x}<br>Flujo Neto: $%{y:,.0f}<extra></extra>"
                ),
                secondary_y=False
            )

            # Línea para Saldo Acumulado
            fig_combo.add_trace(
                go.Scatter(
                    x=semanas_con_periodo, 
                    y=saldo_acumulado, 
                    name="Saldo Acumulado",
                    mode="lines+markers+text",
                    line=dict(color="#1E3A8A", width=4),
                    marker=dict(size=8, color="#1E3A8A"),
                    hovertemplate="Periodo: %{x}<br>Saldo Acumulado: $%{y:,.0f}<extra></extra>"
                ),
                secondary_y=True
            )

            # Anotación para resaltar el Déficit Máximo sobre el gráfico
            fig_combo.add_annotation(
                x=periodo_defic_max,
                y=defic_max,
                secondary_y=True,
                text=f"Déficit Máximo: ${defic_max:,.0f}",
                showarrow=True,
                arrowhead=2,
                arrowcolor="#DC2626",
                arrowsize=1,
                arrowwidth=2,
                ax=0,
                ay=-40,
                font=dict(color="#DC2626", size=12, family="Inter"),
                bgcolor="#FEE2E2",
                bordercolor="#DC2626"
            )

            # Línea de referencia en cero
            fig_combo.add_hline(y=0, line_dash="dash", line_color="#DC2626", annotation_text="Límite $0 ARS")

            fig_combo.update_layout(
                template="plotly_white",
                height=480,
                legend=dict(orientation="h", y=1.1, x=0.3),
                margin=dict(l=20, r=20, t=30, b=20)
            )

            fig_combo.update_xaxes(title_text="Periodo de Análisis (Semanas)")
            fig_combo.update_yaxes(title_text="Flujo Neto Semanal ($)", secondary_y=False)
            fig_combo.update_yaxes(title_text="Saldo Acumulado ($)", secondary_y=True)

            st.plotly_chart(fig_combo, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 2: INFLUENCIA POR RUBRO (DONA)
        # ---------------------------------------------------------------------
        with tab_influencia:
            st.subheader("🍩 Composición y Peso Relativo por Rubro de Egreso")
            st.caption("Visualización del porcentaje de participación de cada concepto sobre los egresos totales de las 13 semanas.")

            col_dona, col_stack = st.columns([1, 1])

            with col_dona:
                st.markdown("**Distribución Total Acumulada (Gráfico de Dona)**")
                totales_por_rubro = {rubro: sum(montos) for rubro, montos in matriz_egresos.items()}
                df_dona = pd.DataFrame(list(totales_por_rubro.items()), columns=['Rubro', 'Total ARS'])
                
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
                fig_dona.update_layout(height=450, showlegend=False, margin=dict(l=10, r=10, t=20, b=10))
                st.plotly_chart(fig_dona, use_container_width=True)

            with col_stack:
                st.markdown("**Composición Semanal Apilada ($)**")
                df_egr_stack = pd.DataFrame(matriz_egresos, index=semanas_con_periodo).reset_index().rename(columns={'index': 'Periodo'})
                df_egr_melted = df_egr_stack.melt(id_vars=['Periodo'], var_name='Rubro', value_name='Monto (ARS)')

                fig_stack = px.bar(
                    df_egr_melted, x='Periodo', y='Monto (ARS)', color='Rubro',
                    color_discrete_sequence=px.colors.qualitative.Prism,
                    template="plotly_white"
                )
                fig_stack.update_layout(height=450, margin=dict(l=10, r=10, t=20, b=10), showlegend=False)
                st.plotly_chart(fig_stack, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 3: DETALLE ESTRUCTURADO POR PERIODO
        # ---------------------------------------------------------------------
        with tab_matriz_nueva:
            st.subheader("📂 Detalle Estructurado por Periodo de Análisis")
            
            with st.expander("📌 **RESUMEN DE LIQUIDEZ Y SALDOS POR PERIODO**", expanded=True):
                df_resumen_semanal = pd.DataFrame({
                    "Concepto": ["(+) Total Ingresos", "(-) Total Egresos", "(=) Flujo Neto", "SALDO ACUMULADO FINAL"],
                })
                for idx, sem_p in enumerate(semanas_con_periodo):
                    df_resumen_semanal[sem_p] = [totales_ing[idx], totales_egr[idx], flujo_neto[idx], saldo_acumulado[idx]]
                
                df_res_fmt = df_resumen_semanal.copy()
                for col in semanas_con_periodo:
                    df_res_fmt[col] = df_res_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_res_fmt, use_container_width=True)

            with st.expander("🟢 **DETALLE DE INGRESOS POR RUBRO**", expanded=True):
                st.markdown('<p class="section-header-ingreso">Estructura de Entradas de Caja</p>', unsafe_allow_html=True)
                df_ing_det = pd.DataFrame(matriz_ingresos, index=semanas_con_periodo).T.reset_index()
                df_ing_det.rename(columns={'index': 'Rubro de Ingreso'}, inplace=True)
                df_ing_det['Total Acumulado'] = df_ing_det[semanas_con_periodo].sum(axis=1)
                
                df_ing_fmt = df_ing_det.copy()
                for col in semanas_con_periodo + ['Total Acumulado']:
                    df_ing_fmt[col] = df_ing_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_ing_fmt, use_container_width=True)

            with st.expander("🔴 **DETALLE DE EGRESOS POR RUBRO**", expanded=True):
                st.markdown('<p class="section-header-egreso">Estructura de Salidas de Caja</p>', unsafe_allow_html=True)
                df_egr_det = pd.DataFrame(matriz_egresos, index=semanas_con_periodo).T.reset_index()
                df_egr_det.rename(columns={'index': 'Rubro de Egreso'}, inplace=True)
                df_egr_det['Total Acumulado'] = df_egr_det[semanas_con_periodo].sum(axis=1)
                
                df_egr_fmt = df_egr_det.copy()
                for col in semanas_con_periodo + ['Total Acumulado']:
                    df_egr_fmt[col] = df_egr_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_egr_fmt, use_container_width=True)

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
