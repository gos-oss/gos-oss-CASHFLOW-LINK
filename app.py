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
# 1. CONFIGURACIÓN DE PÁGINA Y ESTILOS
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Executive",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
    .corporate-header { font-size: 2.2rem; font-weight: 800; font-family: 'Inter', sans-serif; margin-bottom: 0px; }
    .corporate-subheader { font-size: 1.1rem; color: #64748B; font-family: 'Inter', sans-serif; margin-bottom: 30px; }
    </style>
""", unsafe_allow_html=True)

# =============================================================================
# 2. MOTOR DE BASE DE DATOS (HISTORIAL)
# =============================================================================
DB_LOCAL = "cashflow_history.db"

def init_db_local():
    """Crea la tabla si no existe para guardar los cierres diarios."""
    conn = sqlite3.connect(DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historico_diario_conceptos (
            fecha TEXT,
            concepto TEXT,
            concepto_norm TEXT,
            monto REAL,
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
    """Toma la columna del día actual y la guarda en la base de datos de forma permanente."""
    if fecha_str not in df_procesado.columns:
        st.sidebar.error(f"Error: La fecha {fecha_str} no se encontró en el archivo.")
        return
    
    conn = sqlite3.connect(DB_LOCAL)
    cursor = conn.cursor()
    registros_supabase = []
    
    for _, row in df_procesado.iterrows():
        concepto = row['Concepto']
        concepto_norm = row['concepto_norm']
        monto = float(row[fecha_str])
        
        # Guardar en SQLite local
        cursor.execute("""
            INSERT INTO historico_diario_conceptos (fecha, concepto, concepto_norm, monto)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(fecha, concepto_norm) DO UPDATE SET
                monto = excluded.monto,
                concepto = excluded.concepto
        """, (fecha_str, concepto, concepto_norm, monto))
        
        if supabase:
            registros_supabase.append({
                "fecha": fecha_str,
                "concepto": concepto,
                "concepto_norm": concepto_norm,
                "monto": monto
            })
            
    conn.commit()
    conn.close()
    
    if supabase and registros_supabase:
        try:
            supabase.table("historico_diario_conceptos").upsert(registros_supabase).execute()
        except Exception:
            pass

def cargar_fechas_historicas(fecha_corte_obj):
    """Extrae de la base de datos todos los días guardados que sean ANTERIORES a la fecha actual."""
    conn = sqlite3.connect(DB_LOCAL)
    df_db = pd.read_sql_query("SELECT fecha, concepto, concepto_norm, monto FROM historico_diario_conceptos", conn)
    conn.close()
    
    if df_db.empty:
        return pd.DataFrame()
    
    fechas_validas = []
    for f_str in df_db['fecha'].unique():
        try:
            f_obj = pd.to_datetime(f_str, format='%d/%m/%Y').date()
            if f_obj < fecha_corte_obj:
                fechas_validas.append((f_obj, f_str))
        except Exception:
            pass
            
    if not fechas_validas:
        return pd.DataFrame()
        
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
    if isinstance(val, str) and ('-' in val) and ('$' in val): return 'color: #ef4444; font-weight: 600;'
    return ''

def normalizar_concepto(texto):
    if pd.isna(texto): return ""
    return re.sub(r'[^a-z0-9]', '', str(texto).lower())

# =============================================================================
# 4. PANEL LATERAL DE CONFIGURACIÓN
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Configuración de Datos")
    uploaded_file = st.file_uploader("1. Cargar Archivo Excel (.xlsx)", type=["xlsx"])
    
    hoja_seleccionada = None
    if uploaded_file is not None:
        excel_file = pd.ExcelFile(uploaded_file)
        hoja_seleccionada = st.selectbox("2. Seleccionar Hoja", excel_file.sheet_names)
    
    fecha_corte = st.date_input("3. Fecha Actual (Inicio de Proyección)", value=date(2026, 8, 11))
    fecha_corte_str = fecha_corte.strftime("%d/%m/%Y")
    
    st.divider()

# =============================================================================
# 5. LÓGICA PRINCIPAL DE UNIFICACIÓN
# =============================================================================
st.markdown('<p class="corporate-header">CASHFLOW LINK</p>', unsafe_allow_html=True)
st.markdown('<p class="corporate-subheader">Sistema Unificado: Cierres Históricos + Proyecciones Futuras</p>', unsafe_allow_html=True)

if uploaded_file is not None and hoja_seleccionada is not None:
    try:
        # A. LECTURA DEL EXCEL (Presente y Futuro)
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
            except Exception:
                pass 

        df_raw.rename(columns=nombres_limpios, inplace=True)
        df_excel_proyeccion = df_raw[[col_concepto, 'concepto_norm'] + cols_fechas_excel].copy()
        
        for col in cols_fechas_excel:
            df_excel_proyeccion[col] = df_excel_proyeccion[col].apply(limpiar_valor_moneda)

        # B. BOTÓN DE GUARDADO EN BARRA LATERAL (Aparece al cargar el archivo)
        with st.sidebar:
            st.markdown("### 💾 Cierre Diario")
            st.caption(f"Guarda los movimientos del **{fecha_corte_str}** en el historial.")
            if st.button(f"Confirmar Cierre del {fecha_corte_str}", use_container_width=True):
                guardar_dia_en_historial(fecha_corte_str, df_excel_proyeccion)
                st.success(f"¡Día {fecha_corte_str} guardado con éxito!")

        # C. LECTURA DEL HISTORIAL (Pasado)
        df_historico_db = cargar_fechas_historicas(fecha_corte)

        # D. FUSIÓN DE LÍNEAS DE TIEMPO
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

        # E. CÁLCULO DE INDICADORES
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
                        fecha_iliquidez_exacta = str(col_fecha).split(" ")[0]
                        dias_runway = "0"
                    break
        
        min_saldo = min(arr_saldo_acum)
        deficit_maximo = min_saldo if min_saldo < 0 else 0

        # =====================================================================
        # 6. VISUALIZACIÓN DEL DASHBOARD UNIFICADO
        # =====================================================================
        tab_dashboard, tab_matriz, tab_analisis = st.tabs(["📊 Dashboard Unificado", "📁 Matriz Segmentada", "🍩 Análisis de Rubros"])

        with tab_dashboard:
            st.markdown("### 📌 Indicadores Estratégicos")
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Disponibilidad Inicial", f"${val_saldo_ini:,.0f}")
            m2.metric("Déficit Máximo Proyectado", f"${deficit_maximo:,.0f}")
            m3.metric("Días de Caja (Runway)", dias_runway)
            m4.metric("Fecha de Saldo Crítico", fecha_iliquidez_exacta)

            st.divider()

            st.markdown("### 📈 Evolución Unificada del Flujo de Caja")
            eje_x_fechas = [str(f) for f in cols_fechas]
            
            fig_line = go.Figure()
            fig_line.add_trace(go.Scatter(x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', name='Saldo Acumulado', line=dict(color='#3b82f6', width=3), fill='tozeroy', fillcolor='rgba(59, 130, 246, 0.1)'))
            fig_line.add_trace(go.Bar(x=eje_x_fechas, y=arr_posicion_dia, name='Saldo Diario', marker_color='rgba(16, 185, 129, 0.6)'))
            fig_line.update_layout(height=400, margin=dict(l=0, r=0, t=10, b=0), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1), xaxis=dict(showgrid=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)'), plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
            st.plotly_chart(fig_line, use_container_width=True)

        with tab_matriz:
            st.markdown("### 📋 Matriz Detallada Segmentada (Histórico + Proyección)")
            idx_ingresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalingresos", na=False)].tolist()
            idx_egresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalegresos", na=False)].tolist()
            
            if idx_ingresos_list and idx_egresos_list:
                idx_ing, idx_egr = idx_ingresos_list[0], idx_egresos_list[0]
                df_ing = df_procesado.iloc[:idx_ing + 1].copy()
                df_egr = df_procesado.iloc[idx_ing + 1:idx_egr + 1].copy()
                df_saldos = df_procesado.iloc[idx_egr + 1:].copy()
                columnas_a_mostrar = [col_concepto] + cols_fechas
                
                st.markdown("<h5 style='color: #4ADE80; margin-top: 20px;'>Flujo de Ingresos</h5>", unsafe_allow_html=True)
                df_ing_display = df_ing[columnas_a_mostrar].copy()
                for col in cols_fechas: df_ing_display[col] = df_ing_display[col].apply(formato_moneda_texto)
                st.dataframe(df_ing_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                st.markdown("<h5 style='color: #F87171; margin-top: 20px;'>Estructura de Egresos</h5>", unsafe_allow_html=True)
                df_egr_display = df_egr[columnas_a_mostrar].copy()
                for col in cols_fechas: df_egr_display[col] = df_egr_display[col].apply(formato_moneda_texto)
                st.dataframe(df_egr_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                st.markdown("<h5 style='color: #3b82f6; margin-top: 20px;'>Resumen de Saldos</h5>", unsafe_allow_html=True)
                df_saldos_display = df_saldos[columnas_a_mostrar].copy()
                for col in cols_fechas: df_saldos_display[col] = df_saldos_display[col].apply(formato_moneda_texto)
                st.dataframe(df_saldos_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
            else:
                st.warning("Estructura de totales no encontrada.")

        with tab_analisis:
            st.markdown("### 🍩 Participación de Conceptos")
            if idx_ingresos_list and idx_egresos_list:
                df_procesado['Suma_Periodo'] = df_procesado[cols_fechas].sum(axis=1)
                df_ingresos_chart = df_procesado.iloc[0:idx_ing]
                df_egresos_chart = df_procesado.iloc[idx_ing+1:idx_egr]
                
                df_ingresos_chart = df_ingresos_chart[(df_ingresos_chart['Suma_Periodo'] > 0) & (df_ingresos_chart[col_concepto] != "")]
                df_egresos_chart = df_egresos_chart[(df_egresos_chart['Suma_Periodo'] > 0) & (df_egresos_chart[col_concepto] != "")]

                c_torta1, c_torta2 = st.columns(2)
                with c_torta1:
                    fig_ing = px.pie(df_ingresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.5, color_discrete_sequence=px.colors.sequential.Teal)
                    fig_ing.update_traces(textposition='inside', textinfo='percent')
                    fig_ing.update_layout(title="Estructura de Ingresos", height=350, showlegend=False, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                    st.plotly_chart(fig_ing, use_container_width=True)

                with c_torta2:
                    fig_egr = px.pie(df_egresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.5, color_discrete_sequence=px.colors.sequential.Reds_r)
                    fig_egr.update_traces(textposition='inside', textinfo='percent')
                    fig_egr.update_layout(title="Estructura de Egresos", height=350, showlegend=False, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                    st.plotly_chart(fig_egr, use_container_width=True)

    except Exception as e:
        st.error(f"Error procesando la información: {e}")

else:
    st.info("Por favor, cargue su archivo Excel y seleccione la hoja desde el panel lateral izquierdo.")
