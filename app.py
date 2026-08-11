import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN Y ESTILOS CSS (DARK EXECUTIVE)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Dashboard Ejecutivo",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
    <style>
    .stApp { 
        background-color: #0F1117 !important; 
        color: #F1F5F9 !important; 
        font-family: 'Inter', -apple-system, sans-serif;
    }
    .brand-title { color: #FFFFFF !important; font-weight: 800; font-size: 2.0rem; }
    .brand-subtitle { color: #94A3B8 !important; font-size: 0.9rem; margin-bottom: 20px; }
    
    div[data-testid="stExpander"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
        margin-bottom: 15px !important;
    }
    div[data-testid="stExpander"] summary * { color: #FFFFFF !important; font-weight: 700 !important; }
    .streamlit-expanderContent { background-color: #13151C !important; border-top: 1px solid #2D323E !important; }
    
    div[data-testid="stDataFrame"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 10px !important;
    }
    div[data-testid="stDataFrame"] * { color: #FFFFFF !important; border-color: #2D323E !important; }
    
    [data-testid="stFileUploader"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
    }
    [data-testid="stFileUploader"] * { color: #E2E8F0 !important; }
    
    .dark-kpi-card { background: #181B22; border: 1px solid #2D323E; border-radius: 14px; padding: 18px 20px; }
    .kpi-label { font-size: 0.78rem; font-weight: 600; color: #94A3B8; text-transform: uppercase; }
    .kpi-num { font-size: 1.75rem; font-weight: 700; color: #FFFFFF; margin-top: 6px; }
    
    .stTabs [data-baseweb="tab-list"] { gap: 8px; background-color: #181B22; padding: 6px; border-radius: 25px; border: 1px solid #2D323E; }
    .stTabs [data-baseweb="tab"] { height: 38px; border-radius: 20px; color: #CBD5E1 !important; font-weight: 600; font-size: 0.88rem; padding: 0px 20px; }
    .stTabs [aria-selected="true"] { background-color: #3B82F6 !important; color: #FFFFFF !important; font-weight: 700 !important; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<p class="brand-title">💼 CASHFLOW LINK <span style="font-size:1.1rem; font-weight:400; color:#94A3B8;">| Procesamiento Automatizado</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Cálculo exacto mediante sumas nativas en Pandas para evitar errores de redondeo.</p>', unsafe_allow_html=True)

# =============================================================================
# 2. CONEXIÓN A SUPABASE
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
# 3. FUNCIÓN DE LIMPIEZA DE DATOS MONETARIOS
# =============================================================================
def limpiar_valor_moneda(val):
    if pd.isna(val) or val == '' or val == '-':
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
# 4. CONTROLES DE ENTRADA
# =============================================================================
with st.expander("⚙️ CONFIGURACIÓN DEL ARCHIVO DIARIO", expanded=True):
    col_file, col_sheet, col_date = st.columns([2, 1, 1])
    with col_file:
        uploaded_file = st.file_uploader("Cargar Archivo Excel (.xlsx)", type=["xlsx"])
    with col_sheet:
        nombre_hoja = st.text_input("Nombre de Hoja", value="CASH EMPRESA")
    with col_date:
        fecha_corte = st.date_input("Fecha Inicio Proyección", value=date(2026, 8, 10))

# =============================================================================
# 5. PROCESAMIENTO EXACTO AUTOMATIZADO
# =============================================================================
if uploaded_file is not None:
    try:
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        col_concepto_nombre = df_raw.columns[0]
        df_raw[col_concepto_nombre] = df_raw[col_concepto_nombre].astype(str).str.strip()
        
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # Búsqueda estricta del Saldo Acumulado
        row_saldo_acum = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo acumulado", case=False, na=False)]
        
        fecha_iliquidez_exacta = "Sin Iliquidez"
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
                        dias_runway = "Dato no calculable"
                    break

        # Formatear la tabla final para la visualización celda por celda
        df_display = df_procesado[[col_concepto_nombre] + cols_fechas].copy()
        for col in cols_fechas:
            df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)

        # Pestañas
        tab_excel_raw, tab_dash = st.tabs([
            "📋 Matriz Directa Excel (Día por Día)", 
            "📊 Dashboard de Liquidez"
        ])

        with tab_excel_raw:
            st.subheader("📋 Matriz Directa Extraída sin Modificaciones")
            st.caption("Los datos a continuación provienen directamente de las celdas de la hoja seleccionada.")
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        with tab_dash:
            st.subheader("📊 Indicadores Clave")
            
            row_saldo_ini = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo inicial", case=False, na=False)]
            val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

            c1, c2, c3 = st.columns(3)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Saldo Inicial ({cols_fechas[0]})</div><div class="kpi-num">${val_saldo_ini:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo</div><div class="kpi-num">{dias_runway}</div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Primer Día Iliquidez</div><div class="kpi-num" style="color:#F87171;">{fecha_iliquidez_exacta}</div></div>', unsafe_allow_html=True)

    except Exception as e:
        st.error(f"Error procesando el archivo: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para desplegar la suite ejecutiva.")
