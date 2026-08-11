import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date
import re
import sqlite3
import os
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN DE PÁGINA Y ESTILOS CORPORATIVOS PREMIUM (AZUL MARINO)
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Executive Board",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# CSS Avanzado para Interfaz Azul Corporativo y Logotipo
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    /* Fondo global con gradiente AZUL MARINO PROFUNDO */
    .stApp, .main { 
        background: radial-gradient(circle at 50% 0%, #1e3a8a 0%, #0f172a 100%) !important; 
        color: #f8fafc !important; 
        font-family: 'Inter', sans-serif !important; 
    }
    
    /* Banner Superior Corporativo con espacio para LOGO */
    .corporate-banner {
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        padding: 25px 35px;
        border-radius: 15px;
        margin-bottom: 30px;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .corporate-logo {
        max-height: 50px;
        width: auto;
        margin-bottom: 15px;
        object-fit: contain;
    }
    .corporate-header { font-size: 2.5rem; font-weight: 800; color: #ffffff; margin-bottom: 5px; letter-spacing: -1px; line-height: 1.2;}
    .corporate-subheader { font-size: 1.05rem; color: #93c5fd; font-weight: 400; }
    
    /* Estilización de las Métricas Nativas (Tarjetas 3D) */
    div[data-testid="metric-container"] {
        background: linear-gradient(145deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
        border: 1px solid rgba(147, 197, 253, 0.15);
        border-radius: 16px;
        padding: 20px 25px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        transition: transform 0.3s ease, border-color 0.3s ease;
    }
    div[data-testid="metric-container"]:hover {
        transform: translateY(-5px);
        border-color: rgba(96, 165, 250, 0.6);
    }
    div[data-testid="stMetricLabel"] > div {
        color: #bfdbfe !important;
        font-size: 0.85rem !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    div[data-testid="stMetricValue"] > div {
        color: #ffffff !important;
        font-size: 2.2rem !important;
        font-weight: 800 !important;
    }

    /* Pestañas (Tabs) Estilo Corporativo Altamente Pulido */
    .stTabs [data-baseweb="tab-list"] {
        background: rgba(15, 23, 42, 0.6);
        padding: 6px;
        border-radius: 14px;
        border: 1px solid rgba(147, 197, 253, 0.1);
        gap: 8px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 10px;
        color: #94a3b8 !important;
        font-weight: 600;
        font-size: 0.95rem;
        padding: 12px 24px;
        border: none !important;
        background: transparent !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .stTabs [data-baseweb="tab"]:hover {
        color: #e2e8f0 !important;
        background: rgba(255,255,255,0.05) !important;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 15px rgba(37, 99, 235, 0.5);
    }

    /* Títulos de Sección */
    .section-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #f1f5f9;
        margin-top: 25px;
        margin-bottom: 20px;
        border-left: 4px solid #60a5fa;
        padding-left: 12px;
        letter-spacing: -0.5px;
    }
    </style>
""", unsafe_allow_html=True)

# =============================================================================
# 2. MOTOR DE BASE DE DATOS (HISTORIAL)
# =============================================================================
DB_LOCAL = "cashflow_history.db"

def init_db_local():
    conn = sqlite3.connect(DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historico_diario_conceptos (
            fecha TEXT, concepto TEXT, concepto_norm TEXT, monto REAL,
            PRIMARY KEY (fecha, concepto_norm)
        )
    """)
    conn.commit()
    conn.close()

init_db_local()

@st.cache_resource
def init_supabase() -> Client:
    try:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
        return create_client(url, key)
    except Exception:
        return None

supabase = init_supabase()

def guardar_dia_en_historial(fecha_str, df_procesado):
    if fecha_str not in df_procesado.columns: return
    conn = sqlite3.connect(DB_LOCAL)
    cursor = conn.cursor()
    registros_supabase = []
    
    for _, row in df_procesado.iterrows():
        concepto = row['Concepto']
        concepto_norm = row['concepto_norm']
        monto = float(row[fecha_str])
        
        cursor.execute("""
            INSERT INTO historico_diario_conceptos (fecha, concepto, concepto_norm, monto)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(fecha, concepto_norm) DO UPDATE SET
                monto = excluded.monto, concepto = excluded.concepto
        """, (fecha_str, concepto, concepto_norm, monto))
        
        if supabase:
            registros_supabase.append({"fecha": fecha_str, "concepto": concepto, "concepto_norm": concepto_norm, "monto": monto})
            
    conn.commit()
    conn.close()
    if supabase and registros_supabase:
        try: supabase.table("historico_diario_conceptos").upsert(registros_supabase).execute()
        except Exception: pass

def cargar_fechas_historicas(fecha_corte_obj):
    conn = sqlite3.connect(DB_LOCAL)
    df_db = pd.read_sql_query("SELECT fecha, concepto, concepto_norm, monto FROM historico_diario_conceptos", conn)
    conn.close()
    if df_db.empty: return pd.DataFrame()
    
    fechas_validas = []
    for f_str in df_db['fecha'].unique():
        try:
            f_obj = pd.to_datetime(f_str, format='%d/%m/%Y').date()
            if f_obj < fecha_corte_obj: fechas_validas.append((f_obj, f_str))
        except Exception: pass
            
    if not fechas_validas: return pd.DataFrame()
    fechas_validas.sort(key=lambda x: x[0])
    
    df_pivot = df_db.pivot(index=['concepto_norm', 'concepto'], columns='fecha', values='monto').reset_index()
    df_pivot.rename(columns={'concepto': 'Concepto'}, inplace=True)
    
    cols_hist_ordenadas = [f[1] for f in fechas_validas if f[1] in df_pivot.columns]
    cols_finales = ['Concepto', 'concepto_norm'] + cols_hist_ordenadas
    return df_pivot[cols_finales]

# =============================================================================
# 3. FUNCIONES DE LIMPIEZA
# =============================================================================
def limpiar_valor_moneda(val):
    if pd.isna(val) or val == '': return 0.0
    if isinstance(val, (int, float)): return float(val)
    val_str = str(val)
    if '(' in val_str and ')' in val_str: val_str = '-' + val_str.replace('(', '').replace(')', '')
    val_str = re.sub(r'[^\d\.,\-]', '', val_str)
    if val_str.endswith('-'): val_str = '-' + val_str.replace('-', '')
    if val_str.count('-') > 1: val_str = '-' + val_str.replace('-', '')
    if val_str == '' or val_str == '-': return 0.0
    if '.' in val_str and ',' in val_str: val_str = val_str.replace('.', '').replace(',', '.')
    elif '.' in val_str and not ',' in val_str: val_str = val_str.replace('.', '')
    elif ',' in val_str: val_str = val_str.replace(',', '.')
    try: return float(val_str)
    except ValueError: return 0.0

def formato_moneda_texto(x):
    if not isinstance(x, (int, float)): return x
    if x == 0: return "-"
    if x < 0: return f"-${abs(x):,.0f}"
    return f"${x:,.0f}"

def pintar_negativos(val):
    if isinstance(val, str) and ('-' in val) and ('$' in val): return 'color: #f87171; font-weight: 600;'
    return ''

def normalizar_concepto(texto):
    if pd.isna(texto): return ""
    return re.sub(r'[^a-z0-9]', '', str(texto).lower())

# =============================================================================
# 4. PANEL LATERAL
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Centro de Control")
    uploaded_file = st.file_uploader("Cargar Archivo Excel", type=["xlsx"])
    hoja_seleccionada = None
    if uploaded_file is not None:
        excel_file = pd.ExcelFile(uploaded_file)
        hoja_seleccionada = st.selectbox("Seleccionar Hoja", excel_file.sheet_names)
    fecha_corte = st.date_input("Fecha Actual (Cierre)", value=date(2026, 8, 11))
    fecha_corte_str = fecha_corte.strftime("%d/%m/%Y")
    st.divider()

# =============================================================================
# 5. PANTALLA PRINCIPAL CON LOGOTIPO
# =============================================================================
# Cambia la URL de abajo por la ruta de tu logo, por ejemplo: "logo.png"
URL_LOGOTIPO = "https://via.placeholder.com/250x60/1e3a8a/ffffff?text=TU+LOGO+AQUI"

st.markdown(f"""
<div class="corporate-banner">
    <img src="{URL_LOGOTIPO}" class="corporate-logo" alt="Logo de la Empresa">
    <div class="corporate-header">CASHFLOW LINK</div>
    <div class="corporate-subheader">Executive Board • Sistema Unificado de Liquidez y Proyecciones</div>
</div>
""", unsafe_allow_html=True)

if uploaded_file is not None and hoja_seleccionada is not None:
    try:
        # LECTURA DEL EXCEL
        df_raw = pd.read_excel(uploaded_file, sheet_name=hoja_seleccionada)
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        
        df_raw[col_concepto] = df_raw[col_concepto].fillna("").astype(str).replace(['nan', 'None', 'NaN'], '')
        df_raw = df_raw[df_raw[col_concepto].str.strip() != ""]
        df_raw = df_raw[~df_raw[col_concepto].str.match(r'^[-_.\s]+$')]
        df_raw['concepto_norm'] = df_raw[col_concepto].apply(normalizar_concepto)
        
        cols_fechas_excel = []
        nombres_limpios = {col_concepto: col_concepto, 'concepto_norm': 'concepto_norm'}
        
        for col in df_raw.columns:
            if col in [col_concepto, 'concepto_norm']: continue
            col_str = str(col).upper()
            if "TOTAL" in col_str or "UNNAMED" in col_str or "COLUMNA_" in col_str: continue 
            try:
                fecha_obj = col.date() if isinstance(col, datetime) else pd.to_datetime(str(col).split(" ")[0], dayfirst=True).date()
                if fecha_obj >= fecha_corte:
                    fecha_formateada = fecha_obj.strftime("%d/%m/%Y")
                    nombres_limpios[col] = fecha_formateada
                    if fecha_formateada not in cols_fechas_excel:
                        cols_fechas_excel.append(fecha_formateada)
            except Exception: pass 

        df_raw.rename(columns=nombres_limpios, inplace=True)
        df_excel_proyeccion = df_raw[[col_concepto, 'concepto_norm'] + cols_fechas_excel].copy()
        
        for col in cols_fechas_excel:
            df_excel_proyeccion[col] = df_excel_proyeccion[col].apply(limpiar_valor_moneda)

        # BOTÓN GUARDAR (BARRA LATERAL)
        with st.sidebar:
            st.markdown("### 💾 Cierre Diario")
            if st.button(f"Confirmar Cierre del {fecha_corte_str}", type="primary", use_container_width=True):
                guardar_dia_en_historial(fecha_corte_str, df_excel_proyeccion)
                st.success(f"¡Día {fecha_corte_str} consolidado en el historial!")

        # HISTORIAL + FUSIÓN
        df_historico_db = cargar_fechas_historicas(fecha_corte)
        if not df_historico_db.empty:
            df_procesado = pd.merge(df_historico_db, df_excel_proyeccion, on=['concepto_norm'], how='outer', suffixes=('_hist', '_proj'))
            df_procesado['Concepto'] = df_procesado['Concepto_proj'].fillna(df_procesado['Concepto_hist'])
            cols_historicas = [c for c in df_historico_db.columns if c not in ['Concepto', 'concepto_norm']]
            cols_fechas = cols_historicas + cols_fechas_excel
        else:
            df_procesado = df_excel_proyeccion.copy()
            cols_fechas = cols_fechas_excel

        cols_finales = [col_concepto, 'concepto_norm'] + cols_fechas
        df_procesado = df_procesado[cols_finales].fillna(0.0)

        # INDICADORES
        row_saldo_acum = df_procesado[df_procesado['concepto_norm'].str.contains("saldoacumulado", na=False)]
        row_posicion_dia = df_procesado[df_procesado['concepto_norm'].str.contains("posiciondeldia", na=False)]
        row_saldo_ini = df_procesado[df_procesado['concepto_norm'].str.contains("saldoinicial", na=False)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_posicion_dia = row_posicion_dia[cols_fechas].values[0].tolist() if not row_posicion_dia.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        fecha_iliquidez_exacta = "Saludable"
        dias_runway = "+90"
        if not row_saldo_acum.empty:
            for col_fecha in cols_fechas:
                val_saldo = float(row_saldo_acum[col_fecha].values[0])
                if val_saldo < 0:
                    try:
                        fecha_quiebre = pd.to_datetime(col_fecha, format='%d/%m/%Y').date()
                        fecha_iliquidez_exacta = fecha_quiebre.strftime("%d/%m/%Y")
                        dias_diff = (fecha_quiebre - fecha_corte).days
                        dias_runway = str(max(0, dias_diff))
                    except Exception:
                        pass
                    break
        
        min_saldo = min(arr_saldo_acum)
        deficit_maximo = min_saldo if min_saldo < 0 else 0

        # =====================================================================
        # 6. RENDERIZADO VISUAL
        # =====================================================================
        tab_dashboard, tab_matriz, tab_analisis = st.tabs(["📊 Visión Ejecutiva", "📁 Estructura Financiera", "🍩 Análisis de Rubros"])

        with tab_dashboard:
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Disponibilidad Inicial", f"${val_saldo_ini:,.0f}")
            m2.metric("Déficit Máximo Proyectado", f"${deficit_maximo:,.0f}")
            m3.metric("Días de Caja (Runway)", dias_runway)
            m4.metric("Fecha de Saldo Crítico", fecha_iliquidez_exacta)

            st.markdown('<div class="section-title">Evolución Consolidada del Flujo de Caja</div>', unsafe_allow_html=True)
            eje_x_fechas = [str(f) for f in cols_fechas]
            
            fig_line = go.Figure()
            # Gráfico con hover elegante y modo unificado
            fig_line.add_trace(go.Scatter(
                x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', name='Saldo Acumulado', 
                line=dict(color='#60a5fa', width=4), marker=dict(size=8, color='#3b82f6'), 
                fill='tozeroy', fillcolor='rgba(96, 165, 250, 0.15)',
                hovertemplate='%{y:$,.0f}<extra></extra>'
            ))
            fig_line.add_trace(go.Bar(
                x=eje_x_fechas, y=arr_posicion_dia, name='Saldo Diario', 
                marker_color='rgba(148, 163, 184, 0.4)',
                hovertemplate='%{y:$,.0f}<extra></extra>'
            ))
            
            fig_line.update_layout(
                height=480, margin=dict(l=0, r=0, t=10, b=0),
                hovermode="x unified", # Muestra todos los valores del día en una sola etiqueta
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(color='#e2e8f0')),
                xaxis=dict(showgrid=False, tickfont=dict(color='#94a3b8')),
                yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.08)', tickfont=dict(color='#94a3b8')),
                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)'
            )
            st.plotly_chart(fig_line, use_container_width=True)

        with tab_matriz:
            st.markdown('<div class="section-title">Desglose Detallado por Rubro</div>', unsafe_allow_html=True)
            idx_ingresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalingresos", na=False)].tolist()
            idx_egresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalegresos", na=False)].tolist()
            
            if idx_ingresos_list and idx_egresos_list:
                idx_ing, idx_egr = idx_ingresos_list[0], idx_egresos_list[0]
                df_ing = df_procesado.iloc[:idx_ing + 1].copy()
                df_egr = df_procesado.iloc[idx_ing + 1:idx_egr + 1].copy()
                df_saldos = df_procesado.iloc[idx_egr + 1:].copy()
                columnas_a_mostrar = [col_concepto] + cols_fechas
                
                st.markdown("<h5 style='color: #4ADE80; font-weight: 700;'>Flujo de Ingresos</h5>", unsafe_allow_html=True)
                df_ing_display = df_ing[columnas_a_mostrar].copy()
                for col in cols_fechas: df_ing_display[col] = df_ing_display[col].apply(formato_moneda_texto)
                st.dataframe(df_ing_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                st.markdown("<h5 style='color: #F87171; font-weight: 700; margin-top: 25px;'>Estructura de Egresos</h5>", unsafe_allow_html=True)
                df_egr_display = df_egr[columnas_a_mostrar].copy()
                for col in cols_fechas: df_egr_display[col] = df_egr_display[col].apply(formato_moneda_texto)
                st.dataframe(df_egr_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                st.markdown("<h5 style='color: #60a5fa; font-weight: 700; margin-top: 25px;'>Resumen de Saldos</h5>", unsafe_allow_html=True)
                df_saldos_display = df_saldos[columnas_a_mostrar].copy()
                for col in cols_fechas: df_saldos_display[col] = df_saldos_display[col].apply(formato_moneda_texto)
                st.dataframe(df_saldos_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
            else:
                st.warning("Estructura de totales no encontrada.")

        with tab_analisis:
            st.markdown('<div class="section-title">Composición del Portafolio Operativo</div>', unsafe_allow_html=True)
            if idx_ingresos_list and idx_egresos_list:
                df_procesado['Suma_Periodo'] = df_procesado[cols_fechas].sum(axis=1)
                df_ingresos_chart = df_procesado.iloc[0:idx_ing]
                df_egresos_chart = df_procesado.iloc[idx_ing+1:idx_egr]
                
                df_ingresos_chart = df_ingresos_chart[(df_ingresos_chart['Suma_Periodo'] > 0) & (df_ingresos_chart[col_concepto] != "")]
                df_egresos_chart = df_egresos_chart[(df_egresos_chart['Suma_Periodo'] > 0) & (df_egresos_chart[col_concepto] != "")]

                c_torta1, c_torta2 = st.columns(2)
                with c_torta1:
                    fig_ing = px.pie(df_ingresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.6, color_discrete_sequence=px.colors.sequential.Teal)
                    fig_ing.update_traces(textposition='inside', textinfo='percent', hovertemplate='%{label}<br>%{value:$,.0f}<extra></extra>')
                    fig_ing.update_layout(title=dict(text="Distribución de Ingresos", font=dict(color='#e2e8f0', size=16)), height=420, showlegend=False, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=50, b=10, l=10, r=10))
                    st.plotly_chart(fig_ing, use_container_width=True)

                with c_torta2:
                    fig_egr = px.pie(df_egresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.6, color_discrete_sequence=px.colors.sequential.Reds_r)
                    fig_egr.update_traces(textposition='inside', textinfo='percent', hovertemplate='%{label}<br>%{value:$,.0f}<extra></extra>')
                    fig_egr.update_layout(title=dict(text="Distribución de Egresos", font=dict(color='#e2e8f0', size=16)), height=420, showlegend=False, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=50, b=10, l=10, r=10))
                    st.plotly_chart(fig_egr, use_container_width=True)

    except Exception as e:
        st.error(f"Error procesando la información: {e}")

else:
    st.info("Presentación lista. Por favor, cargue los datos fuente en el panel lateral para iniciar el análisis.")
