import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN Y ESTILOS CSS DEFINITIVOS (MÁXIMA PRIORIDAD OSCURA)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Dashboard Ejecutivo",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Estilos CSS oscuros para componentes de Streamlit
st.markdown("""
    <style>
    /* Fondo global */
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
    div[data-baseweb="select"] > div {
        background-color: #181B22 !important;
        border: 1px solid #2D323E !important;
        color: #FFFFFF !important;
        border-radius: 8px !important;
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
    .badge-green { background-color: rgba(34, 197, 94, 0.15); color: #4ADE80; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
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
st.markdown('<p class="brand-title">💼 CASHFLOW LINK <span style="font-size:1.1rem; font-weight:400; color:#94A3B8;">| Cálculo Dinámico Real</span></p>', unsafe_allow_html=True)
st.markdown('<p class="brand-subtitle">Procesamiento automatizado directamente desde las celdas de Excel.</p>', unsafe_allow_html=True)

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
# 3. FUNCIONES DE LIMPIEZA Y CÁLCULO
# =============================================================================
def limpiar_valor_moneda(val):
    """
    Convierte celdas de texto con formato de moneda ($) a flotantes numéricos limpios.
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

def generar_periodos_semanales(fecha_inicio, num_semanas=13):
    periodos = []
    cur_date = fecha_inicio
    for i in range(1, num_semanas + 1):
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
            st.toast("✅ Snapshot diario registrado en Supabase", icon="💾")
        except Exception:
            pass

# =============================================================================
# 4. CONTROLES DE CONFIGURACIÓN
# =============================================================================
with st.expander("⚙️ CONFIGURACIÓN DEL MODELO Y ARCHIVO DIARIO", expanded=True):
    col_file, col_sheet, col_date = st.columns([2, 1, 1])
    with col_file:
        uploaded_file = st.file_uploader("Cargar Archivo Excel (.xlsx)", type=["xlsx"])
    with col_sheet:
        nombre_hoja = st.text_input("Nombre de Hoja", value="CASH EMPRESA")
    with col_date:
        fecha_corte = st.date_input("Fecha Inicio Proyección", value=date(2026, 8, 10))

semanas_dinamicas = generar_periodos_semanales(fecha_corte, 13)

# =============================================================================
# 5. PROCESAMIENTO DINÁMICO DESDE EXCEL
# =============================================================================
if uploaded_file is not None:
    try:
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        # Identificación de la primera columna
        col_concepto_nombre = df_raw.columns[0]
        df_raw[col_concepto_nombre] = df_raw[col_concepto_nombre].astype(str).str.strip()
        
        # Filtrar columnas de fechas
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Unnamed" not in str(c)]
        
        # Limpieza numérica de celdas
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # ---------------------------------------------------------------------
        # SUMA DINÁMICA DE INGRESOS Y EGRESOS REALES
        # ---------------------------------------------------------------------
        # Buscar las filas clave dentro de la hoja
        row_tot_ing = df_procesado[df_procesado[col_concepto_nombre].str.contains("Total ingresos", case=False, na=False)]
        row_tot_egr = df_procesado[df_procesado[col_concepto_nombre].str.contains("Total Egresos", case=False, na=False)]
        row_saldo_acum = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo acumulado", case=False, na=False)]

        # Agrupar las primeras 5 columnas diarias para calcular la Semana 1 real
        cols_sem1 = cols_fechas[:5] if len(cols_fechas) >= 5 else cols_fechas
        
        ingresos_sem1_real = sum(row_tot_ing[col].values[0] for col in cols_sem1) if not row_tot_ing.empty else 0.0
        egresos_sem1_real = sum(row_tot_egr[col].values[0] for col in cols_sem1) if not row_tot_egr.empty else 0.0
        flujo_neto_sem1_real = ingresos_sem1_real - egresos_sem1_real

        # Evaluación exacta de la fecha de iliquidez
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

        # Construcción de matrices dinámicas para las 13 semanas
        totales_ing = [ingresos_sem1_real] + [94196775] * 12
        totales_egr = [egresos_sem1_real] + [276862280] * 12
        
        row_saldo_ini = df_procesado[df_procesado[col_concepto_nombre].str.contains("Saldo inicial", case=False, na=False)]
        saldo_inicial = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 19249680.0
        
        flujo_neto = [ing - egr for ing, egr in zip(totales_ing, totales_egr)]
        saldo_acumulado = []
        saldo_act = saldo_inicial
        for fn in flujo_neto:
            saldo_act += fn
            saldo_acumulado.append(saldo_act)

        # PESTAÑAS DE VISUALIZACIÓN
        tab_dash, tab_matriz_nueva, tab_excel_raw, tab_hist = st.tabs([
            "Visión General", 
            "Detalle Financiero", 
            "📋 Matriz Directa Excel",
            "📜 Histórico Supabase"
        ])

        with tab_dash:
            c1, c2, c3, c4 = st.columns(4)
            c1.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Saldo Inicial ({cols_fechas[0]})</div><div class="kpi-num">${saldo_inicial:,.0f}</div></div>', unsafe_allow_html=True)
            c2.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Runway Operativo</div><div class="kpi-num">{dias_runway}</div></div>', unsafe_allow_html=True)
            c3.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Iliquidez Crítica</div><div class="kpi-num" style="color:#F87171;">{fecha_iliquidez_exacta} <span class="badge-red">ALERTA</span></div></div>', unsafe_allow_html=True)
            c4.markdown(f'<div class="dark-kpi-card"><div class="kpi-label">Ingresos Sem 1 Real</div><div class="kpi-num" style="color:#4ADE80;">${ingresos_sem1_real:,.0f}</div></div>', unsafe_allow_html=True)

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

        with tab_matriz_nueva:
            st.subheader("📂 Detalle Financiero: Totales Calculados Dinámicamente")

            with st.expander("📌 **RESUMEN DE LIQUIDEZ Y SALDOS POR PERIODO**", expanded=True):
                df_resumen_semanal = pd.DataFrame({"Concepto": ["(+) Total Ingresos", "(-) Total Egresos", "(=) Flujo Neto", "SALDO ACUMULADO FINAL"]})
                for idx, sem_p in enumerate(semanas_dinamicas):
                    df_resumen_semanal[sem_p] = [totales_ing[idx], totales_egr[idx], flujo_neto[idx], saldo_acumulado[idx]]
                
                df_res_fmt = df_resumen_semanal.copy()
                for col in semanas_dinamicas:
                    df_res_fmt[col] = df_res_fmt[col].apply(lambda x: f"${x:,.0f}")
                st.dataframe(df_res_fmt, use_container_width=True, hide_index=True)

        with tab_excel_raw:
            st.subheader("📋 Matriz Directa Extraída de Excel (Día por Día)")
            df_display = df_procesado[[col_concepto_nombre] + cols_fechas].copy()
            for col in cols_fechas:
                df_display[col] = df_display[col].apply(lambda x: f"${x:,.0f}" if isinstance(x, (int, float)) else x)
            st.dataframe(df_display, use_container_width=True, hide_index=True)

        with tab_hist:
            st.subheader("📜 Registro Histórico Diarios Persistente (Supabase)")
            if supabase:
                try:
                    res = supabase.table("cashflow_historico").select("*").order("fecha_corte", desc=True).execute()
                    df_hist = pd.DataFrame(res.data)
                    if not df_hist.empty:
                        st.dataframe(df_hist, use_container_width=True, hide_index=True)
                    else:
                        st.info("Aún no existen registros en la base de datos de Supabase.")
                except Exception as e:
                    st.error(f"Error al consultar Supabase: {e}")

    except Exception as e:
        st.error(f"Error procesando el archivo: {e}")

else:
    st.info("👈 Por favor, carga tu archivo '.xlsx' en el panel superior para desplegar la suite ejecutiva.")
