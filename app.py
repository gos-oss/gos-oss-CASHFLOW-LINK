import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN Y ESTILOS CSS (MÁXIMA PRIORIDAD MODO OSCURO)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Lector Exacto de Excel",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Estilos CSS oscuros para componentes de Streamlit
st.markdown("""
    <style>
    /* Fondo global de la aplicación */
    .stApp { 
        background-color: #0F1117 !important; 
        color: #F1F5F9 !important; 
        font-family: 'Inter', -apple-system, sans-serif;
    }
    
    .brand-title { color: #FFFFFF !important; font-weight: 800; font-size: 2.0rem; }
    .brand-subtitle { color: #94A3B8 !important; font-size: 0.9rem; margin-bottom: 20px; }
    
    /* Contenedores expandibles en tono oscuro */
    div[data-testid="stExpander"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
        margin-bottom: 15px !important;
    }
    div[data-testid="stExpander"] summary {
        background-color: #181B22 !important;
        color: #FFFFFF !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] summary * {
        color: #FFFFFF !important;
        font-weight: 700 !important;
    }
    .streamlit-expanderContent {
        background-color: #13151C !important;
        border-top: 1px solid #2D323E !important;
    }
    
    /* Inputs y Cargador de Archivos */
    div[data-baseweb="input"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 8px !important;
    }
    div[data-baseweb="input"] input {
        color: #FFFFFF !important;
        background-color: #181B22 !important;
    }
    
    [data-testid="stFileUploader"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
        padding: 10px !important;
    }
    [data-testid="stFileUploader"] section {
        background-color: #181B22 !important;
    }
    [data-testid="stFileUploader"] section * {
        color: #E2E8F0 !important;
    }
    [data-testid="stFileUploader"] button {
        background-color: #262B36 !important;
        color: #FFFFFF !important;
        border: 1px solid #3B82F6 !important;
        border-radius: 8px !important;
    }

    /* Tablas en modo oscuro */
    div[data-testid="stDataFrame"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 10px !important;
    }
    div[data-testid="stDataFrame"] * {
        color: #FFFFFF !important;
        border-color: #2D323E !important;
    }
    
    /* Tarjetas KPI */
    .dark-kpi-card { 
        background: #181B22; 
        border: 1px solid #2D323E; 
        border-radius: 14px; 
        padding: 18px 20px; 
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .kpi-label { font-size: 0.78rem; font-weight: 600; color: #94A3B8; text-transform: uppercase; }
    .kpi-num { font-size: 1.75rem; font-weight: 700; color: #FFFFFF; margin-top: 6px; }
    .badge-red { background-color: rgba(239, 68, 68, 0.15); color: #F87171; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    
    /* Pestañas */
    .stTabs [data-baseweb="tab-list"] { 
        gap: 8px; 
        background-color: #181B22; 
        padding: 6px; 
        border-radius: 25px; 
        border: 1px solid #2D323E; 
        width: fit-content;
        margin-bottom: 25px;
    }
    .stTabs [data-baseweb="tab"] { 
        height: 38px; 
        border-radius: 20px; 
        color: #CBD5E1 !important; 
        font-weight: 600; 
        font-size: 0.88rem;
        border: none !important;
        padding: 0px 20px;
    }
    .stTabs [aria-selected="true"] { 
        background-color: #3B82F6 !important; 
        color: #FFFFFF !important; 
        font-weight: 700 !important;
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado corporativo
st.markdown('<p class="brand-title">💼 CASHFLOW LINK <span style="font-size:1.1rem; font-weight:400; color:#94A3B8;">| Lector Directo y Fiel de Excel</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Procesamiento directo de celdas sin datos estáticos ni alteraciones.</p>', unsafe_allow_html=True)

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
# 3. FUNCIÓN DE LIMPIEZA DE CELDAS
# =============================================================================
def limpiar_valor_moneda(val):
    """
    Limpia los caracteres numéricos de la celda de Excel ($ y espacios)
    y los convierte a flotantes limpios para cálculo directo.
    """
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
# 5. LECTURA Y EXTRACCIÓN 100% DINÁMICA DE LA PLANILLA
# =============================================================================
if uploaded_file is not None:
    try:
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        # Identificar la primera columna de conceptos y las columnas de fechas
        col_concepto_nombre = df_raw.columns[0]
        df_raw[col_concepto_nombre] = df_raw[col_concepto_nombre].astype(str).str.strip()
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        # Convertir celdas a valores numéricos
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # Ubicar la fila exacta de "Saldo acumulado"
        row_saldo_acum = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo acumulado", case=False, na=False)]
        
        fecha_iliquidez_exacta = "Sin Iliquidez"
        dias_runway = "+90 Días"
        
        # Buscar el primer día donde el Saldo Acumulado sea negativo
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

        # Formatear la tabla final reflejando el Excel de forma fiel
        df_display = df_procesado[[col_concepto_nombre] + cols_fechas].copy()
        for col in cols_fechas:
            df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)

        # Pestañas
        tab_excel_raw, tab_dash = st.tabs([
            "📋 Matriz Directa Excel (Día por Día)", 
            "📊 Dashboard de Indicadores Reales"
        ])

        with tab_excel_raw:
            st.subheader("📋 Matriz Extraída Directamente Celda por Celda")
            st.caption("A continuación se presentan los datos exactos del archivo subido sin alteración de sumas.")
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        with tab_dash:
            st.subheader("📊 Indicadores Clave Extraídos")
            
            row_saldo_ini = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo inicial", case=False, na=False)]
            val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

            c1, c2, c3 = st.columns(3)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Saldo Inicial ({cols_fechas[0]})</div><div class="kpi-num">${val_saldo_ini:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo Real</div><div class="kpi-num">{dias_runway}</div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Primer Día Iliquidez Real</div><div class="kpi-num" style="color:#F87171;">{fecha_iliquidez_exacta} <span class="badge-red">ALERTA</span></div></div>', unsafe_allow_html=True)

    except Exception as e:
        st.error(f"Error procesando el archivo: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para validar la coincidencia exacta de datos.")
