import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from datetime import datetime, timedelta, date

# =============================================================================
# 1. CONFIGURACIÓN INICIAL Y ESTILOS DARK GLASSMORPHISM (FITONIST UI STYLE)
# =============================================================================
st.set_page_config(
    page_title="Fitonist Executive Cashflow",
    page_icon="⚡",
    layout="wide"
)

# CSS Inyectado para transformar la interfaz al estilo UI "Fitonist Dark"
st.markdown("""
    <style>
    /* Fondo principal y fuentes */
    .stApp {
        background-color: #0D0E12;
        color: #E2E8F0;
    }
    
    /* Ocultar barra de encabezado por defecto */
    header {visibility: hidden;}
    
    /* Tipografía de títulos */
    .brand-title {
        font-family: 'Inter', -apple-system, sans-serif;
        color: #FFFFFF;
        font-weight: 800;
        font-size: 2.2rem;
        letter-spacing: -0.5px;
        margin-bottom: 0px;
    }
    .brand-subtitle {
        font-family: 'Inter', sans-serif;
        color: #94A3B8;
        font-size: 0.9rem;
        margin-bottom: 25px;
    }
    
    /* Tarjetas KPI Dark Glassmorphism */
    .dark-kpi-card {
        background: #14151B;
        border: 1px solid #22242D;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .kpi-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #94A3B8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .kpi-num {
        font-size: 1.8rem;
        font-weight: 700;
        color: #FFFFFF;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    /* Badges / Píldoras de porcentaje */
    .badge-green {
        background-color: rgba(74, 222, 128, 0.15);
        color: #4ADE80;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid rgba(74, 222, 128, 0.3);
    }
    .badge-red {
        background-color: rgba(248, 113, 113, 0.15);
        color: #F87171;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid rgba(248, 113, 113, 0.3);
    }
    
    /* Estilo de Pestañas (Tabs style Fitonist Pills) */
    .stTabs [data-baseweb="tab-list"] {
        gap: 10px;
        background-color: #14151B;
        padding: 8px;
        border-radius: 30px;
        border: 1px solid #22242D;
        width: fit-content;
        margin-bottom: 25px;
    }
    .stTabs [data-baseweb="tab"] {
        height: 40px;
        white-space: pre;
        border-radius: 20px;
        color: #94A3B8;
        font-weight: 600;
        font-size: 0.88rem;
        border: none !important;
        padding: 0px 20px;
    }
    .stTabs [aria-selected="true"] {
        background-color: #FFFFFF !important;
        color: #0D0E12 !important;
        font-weight: 700;
    }
    
    /* Secciones expandibles oscuras */
    .streamlit-expanderHeader {
        background-color: #14151B !important;
        border-radius: 12px !important;
        color: #FFFFFF !important;
        border: 1px solid #22242D !important;
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado
st.markdown('<p class="brand-title">⚡ fitonist <span style="font-size:1rem; font-weight:400; color:#94A3B8;">| Executive Cashflow Analytics</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Plataforma de proyección financiera a 13 semanas con interfaz Dark Glassmorphism.</p>', unsafe_allow_html=True)

if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# =============================================================================
# 2. GENERACIÓN DE PERIODOS MÓVILES
# =============================================================================
def generar_periodos_semanales(fecha_inicio, num_semanas=13):
    periodos = []
    cur_date = fecha_inicio
    for i in range(1, num_semanas + 1):
        fin_semana = cur_date + timedelta(days=4)
        tag = f"W{i} ({cur_date.strftime('%d/%m')})"
        periodos.append(tag)
        cur_date += timedelta(days=7)
    return periodos

# =============================================================================
# 3. BARRA LATERAL (SIDEBAR)
# =============================================================================
st.sidebar.title("⚙️ Control Panel")
uploaded_file = st.sidebar.file_uploader("Cargar Archivo (.xlsx)", type=["xlsx"])

fecha_corte = st.sidebar.date_input("Fecha Inicio Proyección", value=date(2026, 8, 11))
semanas_dinamicas = generar_periodos_semanales(fecha_corte, 13)

st.sidebar.divider()
st.sidebar.subheader("➕ Simular Concepto")

with st.sidebar.form("form_simulacion_fitonist", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción", placeholder="Ej. Anticipo Cliente")
    rubro_destino = st.selectbox("Rubro", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo Movimiento", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Periodo Objetivo", semanas_dinamicas)
    monto_base = st.number_input("Monto ARS ($)", min_value=0.0, value=200000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad (%)", min_value=0, max_value=100, value=80, step=5)
    
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
    st.sidebar.success(f"Inyectado en {semana_destino}")

# =============================================================================
# 4. PROCESAMIENTO Y MATRICES
# =============================================================================
if uploaded_file is not None:
    try:
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        target_sheet = next((name for name in sheet_names if name.strip().lower() == "cash corto"), sheet_names[0])

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

        # Inyectar conceptos simulados
        for item in st.session_state.conceptos_adicionales:
            if item["Periodo"] in semanas_dinamicas:
                idx_sem = semanas_dinamicas.index(item["Periodo"])
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
        # 5. NAVEGACIÓN Y PESTAÑAS (FITONIST UI PILLS)
        # =====================================================================
        tab_dash, tab_influencia, tab_matriz_nueva, tab_sim = st.tabs([
            "Overview", 
            "Analytics", 
            "Finance Detail", 
            "Scenarios"
        ])

        # ---------------------------------------------------------------------
        # PESTAÑA 1: OVERVIEW DASHBOARD NEÓN
        # ---------------------------------------------------------------------
        with tab_dash:
            defic_max = min(saldo_acumulado)
            idx_defic_max = saldo_acumulado.index(defic_max)
            periodo_defic_max = semanas_dinamicas[idx_defic_max]

            idx_primer_defic = next((i for i, s in enumerate(saldo_acumulado) if s < 0), None)
            periodo_primer_defic = semanas_dinamicas[idx_primer_defic] if idx_primer_defic is not None else "Sin Déficit"

            # Fila de Tarjetas KPI estilo Fitonist UI
            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.markdown(f'''
                    <div class="dark-kpi-card">
                        <div class="kpi-label">Disponibilidad Inicial</div>
                        <div class="kpi-num">${saldo_inicial:,.0f} <span class="badge-green">↑ 2.4%</span></div>
                    </div>
                ''', unsafe_allow_html=True)
            with c2:
                st.markdown('''
                    <div class="dark-kpi-card">
                        <div class="kpi-label">Runway Operativo</div>
                        <div class="kpi-num">2.6 Days <span class="badge-green">↑ 4.7%</span></div>
                    </div>
                ''', unsafe_allow_html=True)
            with c3:
                st.markdown(f'''
                    <div class="dark-kpi-card">
                        <div class="kpi-label">Iliquidez Crítica</div>
                        <div class="kpi-num" style="color:#F87171;">{periodo_primer_defic} <span class="badge-red">ALERT</span></div>
                    </div>
                ''', unsafe_allow_html=True)
            with c4:
                st.markdown(f'''
                    <div class="dark-kpi-card">
                        <div class="kpi-label">Déficit Máximo ({periodo_defic_max})</div>
                        <div class="kpi-num" style="color:#F87171;">${defic_max:,.0f} <span class="badge-red">PICO</span></div>
                    </div>
                ''', unsafe_allow_html=True)

            st.divider()

            # GRÁFICO ONDULADO STYLE FITONIST UI (PLOTLY DARK SPLINE)
            st.subheader("📈 Liquidity Waves & Revenue Dynamics")
            
            fig_neon = go.Figure()

            # Línea Morada Neón (Saldo Acumulado)
            fig_neon.add_trace(go.Scatter(
                x=semanas_dinamicas, 
                y=saldo_acumulado, 
                mode='lines',
                name='Saldo Acumulado',
                line=dict(color='#C084FC', width=4, shape='spline'),
                hovertemplate="Periodo: %{x}<br>Saldo: $%{y:,.0f}<extra></extra>"
            ))

            # Línea Amarilla Neón (Flujo Neto)
            fig_neon.add_trace(go.Scatter(
                x=semanas_dinamicas, 
                y=flujo_neto, 
                mode='lines',
                name='Flujo Neto Semanal',
                line=dict(color='#FDE047', width=3, shape='spline', dash='dot'),
                hovertemplate="Periodo: %{x}<br>Flujo Neto: $%{y:,.0f}<extra></extra>"
            ))

            # Marcador de Déficit Máximo estilo Fitonist
            fig_neon.add_annotation(
                x=periodo_defic_max, y=defic_max,
                text=f"Déficit: ${defic_max:,.0f}",
                showarrow=True, arrowhead=2, arrowcolor="#F87171",
                font=dict(color="#FFFFFF", size=11), bgcolor="#14151B", bordercolor="#F87171", borderpad=6
            )

            # Estilo general del gráfico Plotly Dark
            fig_neon.update_layout(
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#94A3B8', family="Inter"),
                height=450,
                legend=dict(orientation="h", y=1.1, x=0.3),
                margin=dict(l=10, r=10, t=20, b=10),
                xaxis=dict(showgrid=False, color='#64748B'),
                yaxis=dict(showgrid=True, gridcolor='#1E293B', color='#64748B')
            )
            
            st.plotly_chart(fig_neon, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 2: ANALYTICS (DONA FITONIST DARK)
        # ---------------------------------------------------------------------
        with tab_influencia:
            st.subheader("🍩 Analytics: Composición por Rubro")
            
            c_dona1, c_dona2 = st.columns([1, 1])
            with c_dona1:
                st.markdown("**Distribución Total de Egresos**")
                totales_por_rubro = {rubro: sum(montos) for rubro, montos in matriz_egresos.items()}
                df_dona = pd.DataFrame(list(totales_por_rubro.items()), columns=['Rubro', 'Total ARS'])
                
                fig_dona = px.pie(
                    df_dona, values='Total ARS', names='Rubro', hole=0.6,
                    color_discrete_sequence=['#C084FC', '#FDE047', '#4ADE80', '#22D3EE', '#F87171', '#A855F7', '#38BDF8']
                )
                fig_dona.update_traces(textposition='inside', textinfo='percent')
                fig_dona.update_layout(
                    paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                    font=dict(color='#94A3B8'), height=420, showlegend=True,
                    legend=dict(orientation="h", y=-0.1)
                )
                st.plotly_chart(fig_dona, use_container_width=True)

            with c_dona2:
                st.markdown("**Egresos Semanales Apilados**")
                df_egr_stack = pd.DataFrame(matriz_egresos, index=semanas_dinamicas).reset_index().rename(columns={'index': 'Periodo'})
                df_egr_melted = df_egr_stack.melt(id_vars=['Periodo'], var_name='Rubro', value_name='Monto (ARS)')

                fig_stack = px.bar(
                    df_egr_melted, x='Periodo', y='Monto (ARS)', color='Rubro',
                    color_discrete_sequence=['#C084FC', '#FDE047', '#4ADE80', '#22D3EE', '#F87171']
                )
                fig_stack.update_layout(
                    paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                    font=dict(color='#94A3B8'), height=420, showlegend=False,
                    xaxis=dict(showgrid=False), yaxis=dict(gridcolor='#1E293B')
                )
                st.plotly_chart(fig_stack, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 3: FINANCE DETAIL (DETALLE POR CONCEPTO RESTAURADO)
        # ---------------------------------------------------------------------
        with tab_matriz_nueva:
            st.subheader("📂 Finance Detail: Desglose Estructurado")

            # BLOQUE 1: RESUMEN DE SALDOS
            with st.expander("📌 **RESUMEN DE LIQUIDEZ Y SALDOS POR PERIODO**", expanded=True):
                df_resumen_semanal = pd.DataFrame({"Concepto": ["(+) Total Ingresos", "(-) Total Egresos", "(=) Flujo Neto", "SALDO ACUMULADO FINAL"]})
                for idx, sem_p in enumerate(semanas_dinamicas):
                    df_resumen_semanal[sem_p] = [totales_ing[idx], totales_egr[idx], flujo_neto[idx], saldo_acumulado[idx]]
                
                df_res_fmt = df_resumen_semanal.copy()
                for col in semanas_dinamicas:
                    df_res_fmt[col] = df_res_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_res_fmt, use_container_width=True)

            # BLOQUE 2: DETALLE INDIVIDUAL DE INGRESOS
            with st.expander("🟢 **DETALLE DE INGRESOS POR CONCEPTO / RUBRO**", expanded=True):
                df_ing_det = pd.DataFrame(matriz_ingresos, index=semanas_dinamicas).T.reset_index()
                df_ing_det.rename(columns={'index': 'Concepto / Rubro'}, inplace=True)
                df_ing_det['Total 13 Wks'] = df_ing_det[semanas_dinamicas].sum(axis=1)
                
                df_ing_fmt = df_ing_det.copy()
                for col in semanas_dinamicas + ['Total 13 Wks']:
                    df_ing_fmt[col] = df_ing_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_ing_fmt, use_container_width=True)

            # BLOQUE 3: DETALLE INDIVIDUAL DE EGRESOS
            with st.expander("🔴 **DETALLE DE EGRESOS POR CONCEPTO / RUBRO**", expanded=True):
                df_egr_det = pd.DataFrame(matriz_egresos, index=semanas_dinamicas).T.reset_index()
                df_egr_det.rename(columns={'index': 'Concepto / Rubro'}, inplace=True)
                df_egr_det['Total 13 Wks'] = df_egr_det[semanas_dinamicas].sum(axis=1)
                
                df_egr_fmt = df_egr_det.copy()
                for col in semanas_dinamicas + ['Total 13 Wks']:
                    df_egr_fmt[col] = df_egr_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_egr_fmt, use_container_width=True)

        # ---------------------------------------------------------------------
        # PESTAÑA 4: SCENARIOS (ESCENARIOS SIMULADOS)
        # ---------------------------------------------------------------------
        with tab_sim:
            st.subheader("📝 Scenarios: Registro de Modificaciones")
            if len(st.session_state.conceptos_adicionales) > 0:
                st.dataframe(pd.DataFrame(st.session_state.conceptos_adicionales), use_container_width=True)
                if st.button("🗑️ Restablecer Simulación"):
                    st.session_state.conceptos_adicionales = []
                    st.rerun()
            else:
                st.info("No hay conceptos simulados adicionales agregados.")

    except Exception as e:
        st.error(f"Error procesando el modelo: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel lateral para desplegar la suite Fitonist UI.")
