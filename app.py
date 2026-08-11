import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN E INYECCIÓN DE ESTILOS (DARK EXECUTIVE PREMIUM)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Dashboard Corporativo",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# CSS Definitivo para erradicar fondos blancos y estilizar componentes
st.markdown("""
    <style>
    /* Fondo global */
    .stApp, .main { background-color: #0F1117 !important; color: #F1F5F9 !important; font-family: 'Inter', sans-serif; }
    
    /* Tipografía */
    .brand-title { color: #FFFFFF; font-weight: 800; font-size: 2.2rem; letter-spacing: -0.5px; margin-bottom: 0; }
    .brand-subtitle { color: #94A3B8; font-size: 0.95rem; margin-bottom: 25px; }
    
    /* Expanders (Paneles desplegables) */
    [data-testid="stExpander"] { background-color: #181B22 !important; border: 1px solid #2D323E !important; border-radius: 12px !important; }
    [data-testid="stExpander"] details summary { background-color: #181B22 !important; color: #FFFFFF !important; border-radius: 12px !important; }
    [data-testid="stExpander"] details summary:hover { background-color: #1F232D !important; }
    [data-testid="stExpander"] details summary p { color: #FFFFFF !important; font-weight: 700 !important; font-size: 1.05rem !important;}
    [data-testid="stExpander"] div[role="region"] { background-color: #13151C !important; border-top: 1px solid #2D323E !important; }
    
    /* Cargador de archivos y formularios */
    [data-testid="stFileUploader"] { background-color: #181B22 !important; border: 1px solid #2D323E !important; border-radius: 12px !important; }
    [data-testid="stFileUploader"] section { background-color: #181B22 !important; }
    [data-testid="stFileUploader"] * { color: #CBD5E1 !important; }
    [data-testid="stFileUploader"] button { background-color: #262B36 !important; border: 1px solid #3B82F6 !important; color: #FFF !important; }
    
    div[data-baseweb="input"], div[data-baseweb="select"] > div { background-color: #181B22 !important; border: 1px solid #2D323E !important; border-radius: 8px !important; color: #FFF !important; }
    div[data-baseweb="input"] input { background-color: #181B22 !important; color: #FFF !important; }
    
    /* Tablas de Datos (DataFrames) */
    [data-testid="stDataFrame"] { background-color: #181B22 !important; border: 1px solid #2D323E !important; border-radius: 10px !important; }
    [data-testid="stDataFrame"] * { color: #F1F5F9 !important; border-color: #2D323E !important; }
    
    /* Tarjetas de Indicadores (KPIs) */
    .dark-kpi-card { background: linear-gradient(145deg, #181B22 0%, #13151C 100%); border: 1px solid #2D323E; border-radius: 14px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .kpi-label { font-size: 0.8rem; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-num { font-size: 1.8rem; font-weight: 700; color: #FFFFFF; margin-top: 8px; display: flex; align-items: center; gap: 10px; }
    .badge-alert { background-color: rgba(248, 113, 113, 0.15); color: #F87171; font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(248, 113, 113, 0.3); }
    .badge-ok { background-color: rgba(74, 222, 128, 0.15); color: #4ADE80; font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(74, 222, 128, 0.3); }
    
    /* Pestañas (Tabs) estilo cápsula */
    .stTabs [data-baseweb="tab-list"] { background-color: #181B22; padding: 8px; border-radius: 30px; border: 1px solid #2D323E; gap: 5px; }
    .stTabs [data-baseweb="tab"] { border-radius: 20px; color: #94A3B8 !important; font-weight: 600; padding: 0 20px; border: none !important; background-color: transparent !important; }
    .stTabs [aria-selected="true"] { background-color: #3B82F6 !important; color: #FFFFFF !important; font-weight: 700 !important; }
    </style>
""", unsafe_allow_html=True)

# Encabezado Principal
st.markdown('<p class="brand-title">💼 CASHFLOW LINK <span style="font-size:1.2rem; font-weight:400; color:#94A3B8;">| Dashboard Corporativo</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Plataforma analítica de liquidez diaria, procesamiento exacto y proyecciones a futuro.</p>', unsafe_allow_html=True)

# =============================================================================
# 2. CONEXIÓN A BASE DE DATOS (SUPABASE)
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
# 3. LÓGICA DE LIMPIEZA DE DATOS Y AYUDANTES
# =============================================================================
def limpiar_valor_moneda(val):
    """Limpia cadenas como '$ 187.741.200' y las convierte en floats exactos."""
    if pd.isna(val) or val == '' or str(val).strip() == '-':
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).replace('$', '').replace(' ', '').strip()
    if '.' in val_str and ',' in val_str:
        val_str = val_str.replace('.', '').replace(',', '.')
    elif '.' in val_str and not ',' in val_str:
        val_str = val_str.replace('.', '')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def generar_periodos_diarios(fecha_inicio, num_dias=30):
    return [(fecha_inicio + timedelta(days=i)).strftime("%d/%m/%Y") for i in range(num_dias)]

# =============================================================================
# 4. CONTROLES Y CARGA DE ARCHIVOS
# =============================================================================
with st.expander("⚙️ CONFIGURACIÓN Y CARGA DE ARCHIVO DIARIO", expanded=True):
    col_file, col_sheet, col_date = st.columns([2, 1, 1])
    with col_file:
        uploaded_file = st.file_uploader("Cargar Planilla (.xlsx)", type=["xlsx"])
    with col_sheet:
        nombre_hoja = st.text_input("Hoja Objetivo", value="CASH EMPRESA")
    with col_date:
        fecha_corte = st.date_input("Fecha Inicio", value=date(2026, 8, 10))

# =============================================================================
# 5. PROCESAMIENTO DINÁMICO DE PANDAS (LECTURA EXACTA)
# =============================================================================
if uploaded_file is not None:
    try:
        # 5.1 Leer el archivo Excel
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        # 5.2 Limpieza de cabeceras y detección de columnas de fechas
        col_concepto = df_raw.columns[0]
        df_raw[col_concepto] = df_raw[col_concepto].astype(str).str.strip()
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        # 5.3 Crear el DataFrame procesado con valores numéricos limpios
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # 5.4 Extracción de KPIs críticos desde las filas exactas del Excel
        # Usamos regex para asegurar coincidencia exacta, ignorando mayúsculas
        row_ingresos = df_procesado[df_procesado[col_concepto].str.contains("^Total ingresos$", case=False, na=False, regex=True)]
        row_egresos = df_procesado[df_procesado[col_concepto].str.contains("^Total Egresos$", case=False, na=False, regex=True)]
        row_saldo_acum = df_procesado[df_procesado[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
        row_saldo_ini = df_procesado[df_procesado[col_concepto].str.contains("^Saldo inicial$", case=False, na=False, regex=True)]
        
        # Extracción de arrays de datos diarios (para gráficos y tablas)
        arr_ingresos = row_ingresos[cols_fechas].values[0].tolist() if not row_ingresos.empty else [0]*len(cols_fechas)
        arr_egresos = row_egresos[cols_fechas].values[0].tolist() if not row_egresos.empty else [0]*len(cols_fechas)
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        # 5.5 Cálculo de Runway (Días de Caja) e Iliquidez
        fecha_iliquidez_exacta = "Caja Saludable"
        dias_runway = "+90 Días"
        
        if not row_saldo_acum.empty:
            for col_fecha in cols_fechas:
                val_saldo = row_saldo_acum[col_fecha].values[0]
                if val_saldo < 0:
                    try:
                        # Identifica el día exacto de la caída
                        fecha_quiebre = pd.to_datetime(col_fecha, format='mixed', dayfirst=True).date()
                        fecha_iliquidez_exacta = fecha_quiebre.strftime("%d/%m/%Y")
                        dias_diff = (fecha_quiebre - fecha_corte).days
                        dias_runway = f"{max(0, dias_diff)} Días"
                    except Exception:
                        fecha_iliquidez_exacta = str(col_fecha).split(" ")[0]
                        dias_runway = "Crítico"
                    break

        # =====================================================================
        # 6. INTERFAZ DE 5 PESTAÑAS (TABS)
        # =====================================================================
        tab_dash, tab_analytics, tab_matriz_diaria, tab_hist, tab_sim = st.tabs([
            "📊 Visión General", 
            "🍩 Análisis por Rubro", 
            "📂 Matriz Diaria Excel", 
            "📜 Histórico Supabase",
            "📝 Simulaciones"
        ])

        # --- PESTAÑA 1: VISIÓN GENERAL ---
        with tab_dash:
            st.subheader("Indicadores de Liquidez")
            c1, c2, c3, c4 = st.columns(4)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Disponibilidad Inicial</div><div class="kpi-num">${val_saldo_ini:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo</div><div class="kpi-num">{dias_runway} <span class="badge-ok">OK</span></div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Día Crítico (Quiebre)</div><div class="kpi-num" style="color:#F87171;">{fecha_iliquidez_exacta} <span class="badge-alert">ALERTA</span></div></div>', unsafe_allow_html=True)
            c4.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Saldo Mínimo Periodo</div><div class="kpi-num" style="color:#F87171;">${min(arr_saldo_acum):,.0f}</div></div>', unsafe_allow_html=True)

            st.divider()

            # Gráfico de líneas diarias (Plotly Dark Theme)
            st.subheader("📈 Evolución Diaria de Liquidez y Egresos")
            fig_line = go.Figure()
            # Convertir fechas a string para el eje X
            eje_x_fechas = [str(f).split(" ")[0] for f in cols_fechas]

            fig_line.add_trace(go.Scatter(x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', name='Saldo Acumulado Real', line=dict(color='#C084FC', width=4, shape='spline'), marker=dict(size=6)))
            fig_line.add_trace(go.Scatter(x=eje_x_fechas, y=arr_egresos, mode='lines', name='Egresos Diarios', line=dict(color='#F87171', width=2, dash='dot')))
            
            fig_line.update_layout(
                paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#94A3B8', family="Inter"), height=400,
                legend=dict(orientation="h", y=1.1, x=0.3),
                xaxis=dict(showgrid=False, tickcolor='#2D323E'),
                yaxis=dict(showgrid=True, gridcolor='#1F232D')
            )
            st.plotly_chart(fig_line, use_container_width=True)

        # --- PESTAÑA 2: ANÁLISIS POR RUBRO ---
        with tab_analytics:
            st.subheader("Descomposición de Estructura de Costos")
            # Extraemos dinámicamente algunos rubros de egresos asumiendo que están entre ciertas filas (o extraemos los conocidos)
            # Para mayor robustez, crearemos una tabla de los totales por fila
            df_sumas = df_procesado.copy()
            df_sumas['Total_Row'] = df_sumas[cols_fechas].sum(axis=1)
            # Filtramos filas que no sean nulas y que tengan monto
            df_plot = df_sumas[(df_sumas['Total_Row'] > 0) & (~df_sumas[col_concepto].str.contains("Total|Saldo|Posicion", case=False, na=False))]
            
            c_dona, c_bar = st.columns([1, 1])
            with c_dona:
                st.markdown("**Distribución Total (Mayores Rubros)**")
                # Top 8 rubros para la dona
                df_top = df_plot.nlargest(8, 'Total_Row')
                fig_dona = px.pie(df_top, values='Total_Row', names=col_concepto, hole=0.6, color_discrete_sequence=px.colors.qualitative.Pastel)
                fig_dona.update_traces(textposition='inside', textinfo='percent', marker=dict(line=dict(color='#0F1117', width=2)))
                fig_dona.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font=dict(color='#FFF', size=12), height=400, showlegend=False)
                st.plotly_chart(fig_dona, use_container_width=True)

            with c_bar:
                st.markdown("**Top Egresos/Ingresos Acumulados ($)**")
                fig_bar = px.bar(df_top, x=col_concepto, y='Total_Row', color=col_concepto, color_discrete_sequence=px.colors.qualitative.Pastel)
                fig_bar.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font=dict(color='#CBD5E1'), height=400, showlegend=False, xaxis_title="", yaxis=dict(showgrid=True, gridcolor='#1F232D'))
                st.plotly_chart(fig_bar, use_container_width=True)

        # --- PESTAÑA 3: MATRIZ DIARIA EXCEL ---
        with tab_matriz_diaria:
            st.subheader("Matriz Fiel: Datos Extraídos Celda por Celda")
            st.caption("Esta tabla refleja tu archivo de Excel sin ninguna alteración o agrupamiento artificial.")
            
            # Formateo monetario para mostrar
            df_display = df_procesado[[col_concepto] + cols_fechas].copy()
            for col in cols_fechas:
                df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)
            
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        # --- PESTAÑA 4: HISTÓRICO SUPABASE ---
        with tab_hist:
            st.subheader("Registro Histórico de Auditoría")
            if supabase:
                try:
                    res = supabase.table("cashflow_historico").select("*").order("fecha_corte", desc=True).limit(50).execute()
                    if res.data:
                        st.dataframe(pd.DataFrame(res.data), use_container_width=True, hide_index=True)
                    else:
                        st.info("Sin registros previos en Supabase.")
                except Exception as e:
                    st.error(f"Error de conexión Supabase: {e}")
            else:
                st.warning("Credenciales de Supabase no configuradas en st.secrets.")

        # --- PESTAÑA 5: SIMULACIONES ---
        with tab_sim:
            st.subheader("Panel de Simulación Probabilística")
            st.info("Utiliza el panel superior para inyectar flujos proyectados y evaluar su impacto en el Runway.")
            if 'conceptos_adicionales' in st.session_state and len(st.session_state.conceptos_adicionales) > 0:
                st.dataframe(pd.DataFrame(st.session_state.conceptos_adicionales), use_container_width=True, hide_index=True)
                if st.button("🗑️ Limpiar Simulaciones"):
                    st.session_state.conceptos_adicionales = []
                    st.rerun()

    except Exception as e:
        st.error(f"Error de procesamiento: {e}")
else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para iniciar la plataforma.")
