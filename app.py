import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN Y ESTILOS CSS SOFISTICADOS (GLASSMORPHISM & PREMIUM UI)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Dashboard Ejecutivo",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# CSS Avanzado: Fuentes web, gradientes, glassmorphism y transiciones suaves
st.markdown("""
    <style>
    /* Importar fuente premium 'Inter' */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    /* Fondo global con gradiente radial sutil */
    .stApp, .main { 
        background: radial-gradient(circle at top left, #161925 0%, #0B0C10 100%) !important; 
        color: #F8FAFC !important; 
        font-family: 'Inter', sans-serif !important; 
    }
    
    /* Tipografía elegante */
    .brand-title { color: #FFFFFF; font-weight: 800; font-size: 2.4rem; letter-spacing: -1px; margin-bottom: 0px; text-shadow: 0px 4px 10px rgba(0,0,0,0.5); }
    .brand-subtitle { color: #94A3B8; font-size: 0.95rem; font-weight: 300; margin-bottom: 30px; letter-spacing: 0.5px; }
    
    /* PANELS DESPLEGABLES (Efecto Cristal oscuro) */
    [data-testid="stExpander"] { 
        background: rgba(24, 27, 34, 0.4) !important; 
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important; 
        border-radius: 16px !important; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    }
    [data-testid="stExpander"] details summary { 
        background: transparent !important; 
        color: #E2E8F0 !important; 
        padding: 15px 20px !important;
    }
    [data-testid="stExpander"] details summary p { 
        color: #F8FAFC !important; 
        font-weight: 600 !important; 
        font-size: 1.05rem !important; 
        letter-spacing: 0.5px !important;
    }
    [data-testid="stExpander"] div[role="region"] { 
        background: rgba(11, 12, 16, 0.5) !important; 
        border-top: 1px solid rgba(255, 255, 255, 0.05) !important; 
    }
    
    /* CARGADOR DE ARCHIVOS Y FORMULARIOS */
    [data-testid="stFileUploader"] { 
        background: rgba(24, 27, 34, 0.6) !important; 
        border: 1px dashed rgba(255, 255, 255, 0.1) !important; 
        border-radius: 12px !important; 
    }
    [data-testid="stFileUploader"] section { background: transparent !important; }
    [data-testid="stFileUploader"] button { 
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%) !important; 
        border: none !important; 
        color: #FFF !important; 
        border-radius: 8px !important; 
        font-weight: 500 !important;
        transition: transform 0.2s ease, box-shadow 0.2s ease !important;
    }
    [data-testid="stFileUploader"] button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
    }
    
    /* INPUTS */
    div[data-baseweb="input"], div[data-baseweb="select"] > div { 
        background-color: rgba(24, 27, 34, 0.8) !important; 
        border: 1px solid rgba(255,255,255,0.08) !important; 
        border-radius: 8px !important; 
    }
    div[data-baseweb="input"] input { color: #FFF !important; background-color: transparent !important; }
    
    /* TABLAS DE DATOS (Sofisticadas) */
    [data-testid="stDataFrame"] { 
        background: rgba(24, 27, 34, 0.3) !important; 
        backdrop-filter: blur(8px) !important;
        border: 1px solid rgba(255,255,255,0.05) !important; 
        border-radius: 12px !important; 
    }
    [data-testid="stDataFrame"] * { color: #E2E8F0 !important; border-color: rgba(255,255,255,0.05) !important; }
    
    /* TARJETAS DE INDICADORES (KPIs Premium) */
    .dark-kpi-card { 
        background: rgba(24, 27, 34, 0.5); 
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08); 
        border-radius: 16px; 
        padding: 22px; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.15); 
        transition: transform 0.3s ease, border-color 0.3s ease;
    }
    .dark-kpi-card:hover {
        transform: translateY(-5px);
        border-color: rgba(255, 255, 255, 0.2);
    }
    .kpi-label { font-size: 0.75rem; font-weight: 500; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; }
    .kpi-num { font-size: 2.0rem; font-weight: 800; color: #FFFFFF; margin-top: 5px; display: flex; align-items: center; gap: 12px; }
    .badge-alert { background-color: rgba(244, 63, 94, 0.15); color: #F43F5E; font-size: 0.75rem; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(244, 63, 94, 0.3); font-weight: 600;}
    .badge-ok { background-color: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.75rem; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600;}
    
    /* PESTAÑAS (Estilo píldora minimalista) */
    .stTabs [data-baseweb="tab-list"] { 
        background: rgba(24, 27, 34, 0.4); 
        backdrop-filter: blur(5px);
        padding: 5px; 
        border-radius: 30px; 
        border: 1px solid rgba(255,255,255,0.05); 
        gap: 5px; 
    }
    .stTabs [data-baseweb="tab"] { 
        border-radius: 25px; 
        color: #64748B !important; 
        font-weight: 500; 
        padding: 8px 24px; 
        border: none !important; 
        background-color: transparent !important; 
        transition: all 0.3s ease;
    }
    .stTabs [aria-selected="true"] { 
        background: rgba(255, 255, 255, 0.1) !important; 
        color: #FFFFFF !important; 
        font-weight: 600 !important; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado Principal
st.markdown('<p class="brand-title">CASHFLOW LINK</p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Análisis avanzado de liquidez ejecutiva y proyecciones estratégicas.</p>', unsafe_allow_html=True)

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
# 3. LÓGICA DE LIMPIEZA DE DATOS (CÁLCULO EXACTO)
# =============================================================================
def limpiar_valor_moneda(val):
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

# =============================================================================
# 4. CONTROLES Y CARGA DE ARCHIVO
# =============================================================================
with st.expander("⚙️ CONFIGURACIÓN DEL MODELO DE DATOS", expanded=True):
    col_file, col_sheet, col_date = st.columns([2, 1, 1])
    with col_file:
        uploaded_file = st.file_uploader("Cargar Planilla (.xlsx)", type=["xlsx"])
    with col_sheet:
        nombre_hoja = st.text_input("Hoja Objetivo", value="CASH EMPRESA")
    with col_date:
        fecha_corte = st.date_input("Fecha Inicio", value=date(2026, 8, 10))

# =============================================================================
# 5. PROCESAMIENTO DINÁMICO DE PANDAS
# =============================================================================
if uploaded_file is not None:
    try:
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        col_concepto = df_raw.columns[0]
        df_raw[col_concepto] = df_raw[col_concepto].astype(str).str.strip()
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # Extracción exacta de filas
        row_ingresos = df_procesado[df_procesado[col_concepto].str.contains("^Total ingresos$", case=False, na=False, regex=True)]
        row_egresos = df_procesado[df_procesado[col_concepto].str.contains("^Total Egresos$", case=False, na=False, regex=True)]
        row_saldo_acum = df_procesado[df_procesado[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
        row_saldo_ini = df_procesado[df_procesado[col_concepto].str.contains("^Saldo inicial$", case=False, na=False, regex=True)]
        
        arr_ingresos = row_ingresos[cols_fechas].values[0].tolist() if not row_ingresos.empty else [0]*len(cols_fechas)
        arr_egresos = row_egresos[cols_fechas].values[0].tolist() if not row_egresos.empty else [0]*len(cols_fechas)
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        # Cálculo de Iliquidez y Runway
        fecha_iliquidez_exacta = "Caja Saludable"
        dias_runway = "+90 Días"
        
        if not row_saldo_acum.empty:
            for col_fecha in cols_fechas:
                val_saldo = row_saldo_acum[col_fecha].values[0]
                if val_saldo < 0:
                    try:
                        fecha_quiebre = pd.to_datetime(col_fecha, format='mixed', dayfirst=True).date()
                        fecha_iliquidez_exacta = fecha_quiebre.strftime("%d/%m/%Y")
                        dias_diff = (fecha_quiebre - fecha_corte).days
                        dias_runway = f"{max(0, dias_diff)} Días"
                    except Exception:
                        fecha_iliquidez_exacta = str(col_fecha).split(" ")[0]
                        dias_runway = "Crítico"
                    break

        # =====================================================================
        # 6. INTERFAZ SOFISTICADA DE PESTAÑAS
        # =====================================================================
        tab_dash, tab_analytics, tab_matriz, tab_sim = st.tabs([
            "📊 Visión General", 
            "🍩 Desglose de Rubros", 
            "📂 Matriz Contable", 
            "📝 Simulaciones"
        ])

        # --- PESTAÑA 1: VISIÓN GENERAL ---
        with tab_dash:
            c1, c2, c3, c4 = st.columns(4)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Disponibilidad Inicial</div><div class="kpi-num">${val_saldo_ini:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo</div><div class="kpi-num">{dias_runway} <span class="badge-ok">OK</span></div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Quiebre de Caja (Día)</div><div class="kpi-num" style="color:#F43F5E;">{fecha_iliquidez_exacta} <span class="badge-alert">ALERTA</span></div></div>', unsafe_allow_html=True)
            c4.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Pico Déficit Acumulado</div><div class="kpi-num" style="color:#F43F5E;">${min(arr_saldo_acum):,.0f}</div></div>', unsafe_allow_html=True)

            st.write("") # Espacio
            
            # Gráfico de líneas minimalista
            fig_line = go.Figure()
            eje_x_fechas = [str(f).split(" ")[0] for f in cols_fechas]

            fig_line.add_trace(go.Scatter(
                x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', 
                name='Saldo Acumulado', 
                line=dict(color='#8B5CF6', width=3, shape='spline'), # Violeta elegante
                marker=dict(size=7, color='#8B5CF6', line=dict(width=2, color='#0F1117')),
                fill='tozeroy', fillcolor='rgba(139, 92, 246, 0.05)' # Sutil gradiente debajo
            ))
            fig_line.add_trace(go.Scatter(
                x=eje_x_fechas, y=arr_egresos, mode='lines', 
                name='Egresos Diarios', 
                line=dict(color='#F43F5E', width=2, dash='dot') # Rojo sutil
            ))
            
            fig_line.update_layout(
                paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#94A3B8', family="Inter"), height=420,
                legend=dict(orientation="h", y=1.1, x=0.01),
                xaxis=dict(showgrid=False, tickcolor='rgba(255,255,255,0.05)', linecolor='rgba(255,255,255,0.1)'),
                yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.03)', zerolinecolor='rgba(255,255,255,0.1)')
            )
            st.plotly_chart(fig_line, use_container_width=True)

        # --- PESTAÑA 2: DESGLOSE POR RUBRO ---
        with tab_analytics:
            # Procesar totales por fila ignorando subtotales
            df_sumas = df_procesado.copy()
            df_sumas['Total_Row'] = df_sumas[cols_fechas].sum(axis=1)
            df_plot = df_sumas[(df_sumas['Total_Row'] > 0) & (~df_sumas[col_concepto].str.contains("Total|Saldo|Posicion", case=False, na=False))]
            df_top = df_plot.nlargest(10, 'Total_Row')
            
            c_dona, c_bar = st.columns([1, 1])
            with c_dona:
                st.markdown("<p style='color:#E2E8F0; font-weight:600;'>Distribución de Egresos Principales</p>", unsafe_allow_html=True)
                fig_dona = px.pie(df_top, values='Total_Row', names=col_concepto, hole=0.65, 
                                  color_discrete_sequence=['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#EC4899', '#6366F1'])
                fig_dona.update_traces(textposition='inside', textinfo='percent', marker=dict(line=dict(color='#0F1117', width=3)))
                fig_dona.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font=dict(color='#FFF', family="Inter"), height=400, showlegend=False)
                st.plotly_chart(fig_dona, use_container_width=True)

            with c_bar:
                st.markdown("<p style='color:#E2E8F0; font-weight:600;'>Top 10 Rubros Acumulados</p>", unsafe_allow_html=True)
                fig_bar = px.bar(df_top, x=col_concepto, y='Total_Row', color=col_concepto, 
                                 color_discrete_sequence=['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#EC4899', '#6366F1'])
                fig_bar.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font=dict(color='#94A3B8', family="Inter"), height=400, showlegend=False, xaxis_title="", yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.03)'))
                st.plotly_chart(fig_bar, use_container_width=True)

        # --- PESTAÑA 3: MATRIZ CONTABLE DIARIA ---
        with tab_matriz:
            st.markdown("<p style='color:#E2E8F0; font-weight:600; margin-bottom:15px;'>Matriz Exacta de Datos (Día por Día)</p>", unsafe_allow_html=True)
            df_display = df_procesado[[col_concepto] + cols_fechas].copy()
            for col in cols_fechas:
                df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)
            
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        # --- PESTAÑA 4: SIMULACIONES ---
        with tab_sim:
            st.info("Panel en construcción para proyecciones probabilísticas y guardado en Supabase.")

    except Exception as e:
        st.error(f"Error de procesamiento: {e}")
else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para desplegar la suite.")
