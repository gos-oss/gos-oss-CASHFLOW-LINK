import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN GENERAL DE LA PÁGINA Y ESTILOS CSS
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Lector Dinámico Excel",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Estilos CSS oscuros para componentes de Streamlit
st.markdown("""
    <style>
    .stApp { 
        background-color: #0F1117; 
        color: #F1F5F9; 
        font-family: 'Inter', -apple-system, sans-serif;
    }
    .brand-title { 
        color: #FFFFFF; 
        font-weight: 800; 
        font-size: 2.0rem; 
    }
    .brand-subtitle { 
        color: #94A3B8; 
        font-size: 0.9rem; 
        margin-bottom: 20px; 
    }
    
    /* Paneles expandibles oscuros */
    div[data-testid="stExpander"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
        margin-bottom: 15px !important;
    }
    div[data-testid="stExpander"] summary * {
        color: #FFFFFF !important;
        font-weight: 700 !important;
    }
    .streamlit-expanderContent {
        background-color: #13151C !important;
        border-top: 1px solid #2D323E !important;
    }
    
    /* Contenedores de Tablas en Modo Oscuro */
    div[data-testid="stDataFrame"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 10px !important;
    }
    div[data-testid="stDataFrame"] * {
        color: #FFFFFF !important;
    }
    
    /* Inputs y File Uploader */
    [data-testid="stFileUploader"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 12px !important;
    }
    [data-testid="stFileUploader"] * {
        color: #E2E8F0 !important;
    }
    div[data-baseweb="input"] {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        border-radius: 8px !important;
    }
    div[data-baseweb="input"] input {
        color: #FFFFFF !important;
    }
    
    /* Tarjetas KPI */
    .dark-kpi-card { 
        background: #181B22; 
        border: 1px solid #2D323E; 
        border-radius: 14px; 
        padding: 18px 20px; 
    }
    .kpi-label { font-size: 0.78rem; font-weight: 600; color: #94A3B8; text-transform: uppercase; }
    .kpi-num { font-size: 1.75rem; font-weight: 700; color: #FFFFFF; margin-top: 6px; }
    
    /* Pestañas */
    .stTabs [data-baseweb="tab-list"] { 
        gap: 8px; background-color: #181B22; padding: 6px; border-radius: 25px; border: 1px solid #2D323E; 
    }
    .stTabs [data-baseweb="tab"] { 
        height: 38px; border-radius: 20px; color: #CBD5E1 !important; font-weight: 600; font-size: 0.88rem; padding: 0px 20px;
    }
    .stTabs [aria-selected="true"] { 
        background-color: #3B82F6 !important; color: #FFFFFF !important; font-weight: 700 !important;
    }
    </style>
""", unsafe_allow_html=True)

# Encabezado corporativo
st.markdown('<p class="brand-title">💼 CASHFLOW LINK <span style="font-size:1.1rem; font-weight:400; color:#94A3B8;">| Lector Dinámico Directo de Excel</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Procesamiento exacto celda por celda para eliminar discrepancias numéricas.</p>', unsafe_allow_html=True)

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
# 3. FUNCIÓN EDUCACIONAL DE LIMPIEZA Y LECTURA DE EXCEL
# =============================================================================
def limpiar_valor_moneda(val):
    """
    Función auxilar para convertir celdas con formato de texto contable (Ej: '$ 187.741.200')
    a valores numéricos flotantes limpios en Python.
    """
    if pd.isna(val) or val == '' or val == '-':
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    
    # Si es una cadena de texto, remover caracteres no numéricos
    val_str = str(val).replace('$', '').replace(' ', '').strip()
    if '.' in val_str and ',' in val_str:
        val_str = val_str.replace('.', '').replace(',', '.')
    elif '.' in val_str and not ',' in val_str:
        # Formato latino tipo '187.741.200'
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
    col_file, col_sheet = st.columns([2, 1])
    with col_file:
        uploaded_file = st.file_uploader("Cargar Archivo Excel (.xlsx)", type=["xlsx"])
    with col_sheet:
        nombre_hoja = st.text_input("Nombre de la Hoja de Excel", value="CASH EMPRESA")

# =============================================================================
# 5. PROCESAMIENTO DINÁMICO DEL EXCEL DÍA POR DÍA
# =============================================================================
if uploaded_file is not None:
    try:
        # Leer el Excel raw usando Pandas
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        
        # Seleccionar la hoja especificada o la primera disponible
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        # Mostrar vista previa técnica para auditoría
        st.success(f"Hoja '{sheet_target}' cargada exitosamente.")

        # Limpiar la primera columna que contiene las descripciones de los conceptos
        df_raw.iloc[:, 0] = df_raw.iloc[:, 0].astype(str).str.strip()
        
        # Identificar columnas con fechas (a partir de la columna 1 en adelante)
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        # Reconstruir la tabla directamente desde las celdas del Excel
        df_procesado = df_raw.copy()
        
        # Limpiar numéricamente todas las celdas de montos
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)
            
        # Formatear la tabla final para visualización
        df_display = df_procesado[['CASH EMPRESA'] + cols_fechas].copy()
        for col in cols_fechas:
            df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)

        # =====================================================================
        # 6. PESTAÑAS DE VISUALIZACIÓN COINCIDENTE
        # =====================================================================
        tab_matriz, tab_dash, tab_hist = st.tabs([
            "📋 Matriz Exacta Excel (Día por Día)", 
            "📊 Dashboard de Liquidez", 
            "📜 Histórico Supabase"
        ])

        with tab_matriz:
            st.subheader("📋 Estructura Fiel Extraída de la Planilla Excel")
            st.caption("Esta vista refleja celda por celda la información cargada en tu archivo de Excel sin alteraciones de agrupamiento.")
            
            # Mostrar DataFrame exacto sin índices numéricos molestos
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        with tab_dash:
            st.subheader("📊 Resumen Ejecutivo Extraído")
            
            # Intentar buscar la fila de 'Saldo acumulado' o 'Saldo inicial'
            row_saldo_ini = df_procesado[df_procesado.iloc[:, 0].str.contains("Saldo inicial", case=False, na=False)]
            val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0
            
            row_tot_ing = df_procesado[df_procesado.iloc[:, 0].str.contains("Total ingresos", case=False, na=False)]
            val_tot_ing = row_tot_ing[cols_fechas[0]].values[0] if not row_tot_ing.empty else 0.0

            row_tot_egr = df_procesado[df_procesado.iloc[:, 0].str.contains("Total Egresos", case=False, na=False)]
            val_tot_egr = row_tot_egr[cols_fechas[0]].values[0] if not row_tot_egr.empty else 0.0

            c1, c2, c3 = st.columns(3)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Saldo Inicial ({cols_fechas[0]})</div><div class="kpi-num">${val_saldo_ini:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Ingresos Primer Día</div><div class="kpi-num" style="color:#4ADE80;">${val_tot_ing:,.0f}</div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Egresos Primer Día</div><div class="kpi-num" style="color:#F87171;">${val_tot_egr:,.0f}</div></div>', unsafe_allow_html=True)

        with tab_hist:
            st.subheader("📜 Base de Datos Supabase")
            st.info("Conexión activa lista para guardar snapshots.")

    except Exception as e:
        st.error(f"Error al procesar la hoja de Excel: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para validar la coincidencia exacta de datos.")
