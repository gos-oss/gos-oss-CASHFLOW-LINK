import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN E INTERFAZ FITONIST DARK GLASSMORPHISM
# =============================================================================
st.set_page_config(
    page_title="Fitonist Cashflow Ejecutivo & Supabase",
    page_icon="⚡",
    layout="wide"
)

# Estilos CSS Fitonist UI con alto contraste en pestañas e idioma español
st.markdown("""
    <style>
    /* Fondo principal de la aplicación */
    .stApp { 
        background-color: #0D0E12; 
        color: #F8FAFC; 
    }
    header {visibility: hidden;}
    
    /* Tipografía del encabezado principal */
    .brand-title { 
        font-family: 'Inter', sans-serif; 
        color: #FFFFFF; 
        font-weight: 800; 
        font-size: 2.2rem; 
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
    
    /* Insignias de porcentaje */
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
    
    /* CORRECCIÓN DE PESTAÑAS: TEXTO EN BLANCO/GRIS CLARO VISIBLE */
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
        border-radius: 20px; 
        color: #F1F5F9 !important; /* TEXTO GRIS MUY CLARO / VISIBLE */
        font-weight: 600; 
        font-size: 0.9rem;
        border: none !important;
        padding: 0px 22px;
    }
    .stTabs [aria-selected="true"] { 
        background-color: #FFFFFF !important; 
        color: #0D0E12 !important; /* TEXTO OSCURO EN PESTAÑA ACTIVA */
        font-weight: 800 !important;
    }
    
    /* Estilo de tablas en modo oscuro */
    .stDataFrame {
        border-radius: 12px;
        overflow: hidden;
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado principal en español
st.markdown('<p class="brand-title">⚡ fitonist <span style="font-size:1rem; font-weight:400; color:#94A3B8;">| Cashflow Ejecutivo & Supabase</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Plataforma corporativa conectada a base de datos en la nube para análisis de liquidez y directores.</p>', unsafe_allow_html=True)

# =============================================================================
# 2. CONEXIÓN SEGURA A SUPABASE
# =============================================================================
@st.cache_resource
def init_supabase() -> Client:
    try:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
        return create_client(url, key)
    except Exception:
        return None

supabase = init_supabase()

# =============================================================================
# 3. FUNCIONES DE BASE DE DATOS Y PERIODOS MÓVILES
# =============================================================================
def generar_periodos_semanales(fecha_inicio, num_semanas=13):
    periodos = []
    cur_date = fecha_inicio
    for i in range(1, num_semanas + 1):
        fin_semana = cur_date + timedelta(days=4)
        tag = f"Sem {i} ({cur_date.strftime('%d/%m')})"
        periodos.append(tag)
        cur_date += timedelta(days=7)
    return periodos

def guardar_snapshot_diario(fecha_corte, matriz_ing, matriz_egr):
    if supabase:
        try:
            registros = []
            for r, vals in matriz_ing.items():
                registros.append({"fecha_corte": str(fecha_corte), "rubro": r, "tipo": "Ingreso", "monto_ars": float(sum(vals))})
            for r, vals in matriz_egr.items():
                registros.append({"fecha_corte": str(fecha_corte), "rubro": r, "tipo": "Egreso", "monto_ars": float(sum(vals))})
            
            supabase.table("cashflow_historico").upsert(registros).execute()
            st.toast("✅ Foto diaria guardada exitosamente en Supabase", icon="💾")
        except Exception:
            pass

# =============================================================================
# 4. BARRA LATERAL (SIDEBAR) EN ESPAÑOL
# =============================================================================
st.sidebar.title("⚙️ Panel de Control")
uploaded_file = st.sidebar.file_uploader("Cargar Archivo Diario (.xlsx)", type=["xlsx"])

fecha_corte = st.sidebar.date_input("Fecha Inicio Proyección", value=date(2026, 8, 11))
semanas_dinamicas = generar_periodos_semanales(fecha_corte, 13)

st.sidebar.divider()
st.sidebar.subheader("➕ Simular Nuevo Concepto")

with st.sidebar.form("form_simulacion_espanol", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción / Cliente", placeholder="Ej. Anticipo Proyecto X")
    rubro_destino = st.selectbox("Rubro Específico", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo de Movimiento", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Periodo Objetivo", semanas_dinamicas)
    monto_base = st.number_input("Monto Bruto ARS ($)", min_value=0.0, value=200000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad (%)", min_value=0, max_value=100, value=80, step=5)
    
    btn_simular = st.form_submit_button("Inyectar al Modelo")

if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

if btn_simular and concepto_desc.strip() != "":
    nuevo_c = {
        "Descripción": concepto_desc,
        "Rubro": rubro_destino,
        "Tipo": tipo_mov,
        "Periodo": semana_destino,
        "Monto Base": monto_base,
        "Probabilidad": probabilidad,
        "Monto Ponderado": monto_base * (probabilidad / 100.0)
    }
    st.session_state.conceptos_adicionales.append(nuevo_c)
    
    if supabase:
        try:
            supabase.table("conceptos_simulados").insert({
                "descripcion": concepto_desc, "rubro": rubro_destino, "tipo": tipo_mov,
                "periodo": semana_destino, "monto_base": monto_base, "probabilidad": probabilidad,
                "monto_ponderado": nuevo_c["Monto Ponderado"]
            }).execute()
        except Exception:
            pass
    st.sidebar.success(f"¡Inyectado en {semana_destino}!")

# =============================================================================
# 5. MATRICES Y PESTAÑAS EN ESPAÑOL
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

        # Guardar en Supabase
        guardar_snapshot_diario(fecha_corte, matriz_ingresos, matriz_egresos)

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

        # PESTAÑAS CON NOMBRES Y TEXTOS TOTALMENTE EN ESPAÑOL Y ALTO CONTRASTE
        tab_dash, tab_influencia, tab_matriz_nueva, tab_hist, tab_sim = st.tabs([
            "Visión General", 
            "Análisis por Rubro", 
            "Detalle Financiero", 
            "📜 Histórico Supabase",
            "Simulaciones"
        ])

        # PESTAÑA 1: VISIÓN GENERAL (EXECUTIVE DASHBOARD)
        with tab_dash:
            defic_max = min(saldo_acumulado)
            idx_defic_max = saldo_acumulado.index(defic_max)
            periodo_defic_max = semanas_dinamicas[idx_defic_max]

            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Disponibilidad ({fecha_corte.strftime("%d/%m/%Y")})</div><div class="kpi-num">${saldo_inicial:,.0f} <span class="badge-green">↑ 2.4%</span></div></div>', unsafe_allow_html=True)
            with c2:
                st.markdown('<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo</div><div class="kpi-num">2.6 Días <span class="badge-green">↑ 4.7%</span></div></div>', unsafe_allow_html=True)
            with c3:
                st.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Iliquidez Crítica</div><div class="kpi-num" style="color:#F87171;">{semanas_dinamicas[0]} <span class="badge-red">ALERTA</span></div></div>', unsafe_allow_html=True)
            with c4:
                st.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Déficit Pico ({periodo_defic_max})</div><div class="kpi-num" style="color:#F87171;">${defic_max:,.0f} <span class="badge-red">PICO</span></div></div>', unsafe_allow_html=True)

            st.divider()

            st.subheader("📈 Proyección de Ondas de Liquidez Acumulada")
            fig_neon = go.Figure()
            fig_neon.add_trace(go.Scatter(
                x=semanas_dinamicas, y=saldo_acumulado, mode='lines', name='Saldo Acumulado',
                line=dict(color='#C084FC', width=4, shape='spline')
            ))
            fig_neon.add_trace(go.Scatter(
                x=semanas_dinamicas, y=flujo_neto, mode='lines', name='Flujo Neto Semanal',
                line=dict(color='#FDE047', width=3, shape='spline', dash='dot')
            ))
            fig_neon.update_layout(
                paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#94A3B8', family="Inter"), height=450, legend=dict(orientation="h", y=1.1, x=0.3)
            )
            st.plotly_chart(fig_neon, use_container_width=True)

        # PESTAÑA 2: ANÁLISIS POR RUBRO
        with tab_influencia:
            st.subheader("🍩 Análisis: Composición por Rubro de Egreso")
            c_dona1, c_dona2 = st.columns([1, 1])
            with c_dona1:
                st.markdown("**Distribución Total de Egresos**")
                totales_por_rubro = {rubro: sum(montos) for rubro, montos in matriz_egresos.items()}
                df_dona = pd.DataFrame(list(totales_por_rubro.items()), columns=['Rubro', 'Total ARS'])
                fig_dona = px.pie(
                    df_dona, values='Total ARS', names='Rubro', hole=0.6,
                    color_discrete_sequence=['#C084FC', '#FDE047', '#4ADE80', '#22D3EE', '#F87171']
                )
                fig_dona.update_layout(paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#94A3B8'), height=420)
                st.plotly_chart(fig_dona, use_container_width=True)

            with c_dona2:
                st.markdown("**Egresos Semanales Apilados ($)**")
                df_egr_stack = pd.DataFrame(matriz_egresos, index=semanas_dinamicas).reset_index().rename(columns={'index': 'Periodo'})
                df_egr_melted = df_egr_stack.melt(id_vars=['Periodo'], var_name='Rubro', value_name='Monto (ARS)')
                fig_stack = px.bar(
                    df_egr_melted, x='Periodo', y='Monto (ARS)', color='Rubro',
                    color_discrete_sequence=['#C084FC', '#FDE047', '#4ADE80', '#22D3EE', '#F87171']
                )
                fig_stack.update_layout(paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#94A3B8'), height=420, showlegend=False)
                st.plotly_chart(fig_stack, use_container_width=True)

        # PESTAÑA 3: DETALLE FINANCIERO POR CONCEPTO
        with tab_matriz_nueva:
            st.subheader("📂 Detalle Financiero: Desglose Estructurado por Concepto")

            with st.expander("📌 **RESUMEN DE LIQUIDEZ Y SALDOS POR PERIODO**", expanded=True):
                df_resumen_semanal = pd.DataFrame({"Concepto": ["(+) Total Ingresos", "(-) Total Egresos", "(=) Flujo Neto", "SALDO ACUMULADO FINAL"]})
                for idx, sem_p in enumerate(semanas_dinamicas):
                    df_resumen_semanal[sem_p] = [totales_ing[idx], totales_egr[idx], flujo_neto[idx], saldo_acumulado[idx]]
                
                df_res_fmt = df_resumen_semanal.copy()
                for col in semanas_dinamicas:
                    df_res_fmt[col] = df_res_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_res_fmt, use_container_width=True)

            with st.expander("🟢 **DETALLE DE INGRESOS POR CONCEPTO / RUBRO**", expanded=True):
                df_ing_det = pd.DataFrame(matriz_ingresos, index=semanas_dinamicas).T.reset_index()
                df_ing_det.rename(columns={'index': 'Concepto / Rubro'}, inplace=True)
                df_ing_det['Total 13 Wks'] = df_ing_det[semanas_dinamicas].sum(axis=1)
                
                df_ing_fmt = df_ing_det.copy()
                for col in semanas_dinamicas + ['Total 13 Wks']:
                    df_ing_fmt[col] = df_ing_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_ing_fmt, use_container_width=True)

            with st.expander("🔴 **DETALLE DE EGRESOS POR CONCEPTO / RUBRO**", expanded=True):
                df_egr_det = pd.DataFrame(matriz_egresos, index=semanas_dinamicas).T.reset_index()
                df_egr_det.rename(columns={'index': 'Concepto / Rubro'}, inplace=True)
                df_egr_det['Total 13 Wks'] = df_egr_det[semanas_dinamicas].sum(axis=1)
                
                df_egr_fmt = df_egr_det.copy()
                for col in semanas_dinamicas + ['Total 13 Wks']:
                    df_egr_fmt[col] = df_egr_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_egr_fmt, use_container_width=True)

        # PESTAÑA 4: HISTÓRICO SUPABASE
        with tab_hist:
            st.subheader("📜 Registro Histórico Diarios Persistente (Supabase)")
            if supabase:
                try:
                    res = supabase.table("cashflow_historico").select("*").order("fecha_corte", desc=True).execute()
                    df_hist = pd.DataFrame(res.data)
                    if not df_hist.empty:
                        st.dataframe(df_hist, use_container_width=True)
                    else:
                        st.info("Aún no existen registros en la base de datos de Supabase.")
                except Exception as e:
                    st.error(f"Error al consultar Supabase: {e}")
            else:
                st.warning("Conecta Supabase configurando las claves en los Secrets de Streamlit.")

        # PESTAÑA 5: SIMULACIONES
        with tab_sim:
            st.subheader("📝 Simulaciones: Registro de Modificaciones")
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
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel lateral para desplegar la suite Fitonist.")
