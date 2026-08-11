import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date
from supabase import create_client, Client

# =============================================================================
# 1. CONFIGURACIÓN DE LA PÁGINA Y ESTILOS
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
# 2. CONEXIÓN A BASE DE DATOS (SUPABASE) PARA EL HISTORIAL
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

def guardar_historial_diario(fecha, df, col_concepto):
    """Guarda los totales del día analizado en la base de datos Supabase."""
    if supabase is None:
        return
    
    fecha_str = fecha.strftime("%d/%m/%Y")
    
    # Verificamos si la fecha actual existe en las columnas del dataframe
    if fecha_str in df.columns:
        try:
            # Extraemos los datos clave de esa fecha
            row_ing = df[df[col_concepto].str.contains("^Total ingresos$", case=False, na=False, regex=True)]
            row_egr = df[df[col_concepto].str.contains("^Total Egresos$", case=False, na=False, regex=True)]
            row_saldo = df[df[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
            
            ingresos = float(row_ing[fecha_str].values[0]) if not row_ing.empty else 0.0
            egresos = float(row_egr[fecha_str].values[0]) if not row_egr.empty else 0.0
            saldo = float(row_saldo[fecha_str].values[0]) if not row_saldo.empty else 0.0
            
            # Preparamos el registro
            registro = {
                "fecha_registro": fecha_str,
                "ingresos_totales": ingresos,
                "egresos_totales": egresos,
                "saldo_acumulado": saldo
            }
            
            # Guardamos en la tabla 'historial_cashflow' (Debes crear esta tabla en tu proyecto de Supabase)
            supabase.table("historial_cashflow").upsert([registro]).execute()
            st.sidebar.success(f"✅ Historial del {fecha_str} guardado.")
        except Exception as e:
            st.sidebar.warning("No se pudo guardar el historial en la base de datos.")

# =============================================================================
# 3. FUNCIONES DE LIMPIEZA
# =============================================================================
def limpiar_valor_moneda(val):
    """Convierte texto de moneda a número flotante para realizar cálculos matemáticos."""
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

def formato_moneda_texto(x):
    """Aplica el signo $ a los números para visualización en tablas."""
    if not isinstance(x, (int, float)):
        return x
    if x == 0:
        return "-"
    if x < 0:
        return f"-${abs(x):,.0f}"
    return f"${x:,.0f}"

def pintar_negativos(val):
    """Pinta de rojo los valores negativos en la tabla."""
    if isinstance(val, str) and ('-' in val) and ('$' in val):
        return 'color: #ef4444; font-weight: 600;'
    return ''

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
    
    fecha_corte = st.date_input("3. Fecha de Análisis (Hoy)", value=date(2026, 8, 10))
    st.divider()

# =============================================================================
# 5. PANTALLA PRINCIPAL Y LÓGICA DE DATOS
# =============================================================================
st.markdown('<p class="corporate-header">CASHFLOW LINK</p>', unsafe_allow_html=True)
st.markdown('<p class="corporate-subheader">Panel de Control de Liquidez, Evolución Diaria y Composición de Cartera</p>', unsafe_allow_html=True)

if uploaded_file is not None and hoja_seleccionada is not None:
    try:
        df_raw = pd.read_excel(uploaded_file, sheet_name=hoja_seleccionada)
        
        # Limpieza de encabezados de columnas
        nuevas_columnas = []
        for i, col in enumerate(df_raw.columns):
            if "Unnamed" in str(col):
                nuevas_columnas.append(f"Columna_{i}")
            elif isinstance(col, datetime):
                nuevas_columnas.append(col.strftime("%d/%m/%Y"))
            else:
                col_str = str(col)
                if "00:00:00" in col_str:
                    col_str = col_str.split(" ")[0]
                nuevas_columnas.append(col_str)
        
        df_raw.columns = nuevas_columnas
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        
        # ---------------------------------------------------------------------
        # CORRECCIÓN DE FILAS VACÍAS: 
        # Rellenamos nulos y eliminamos las filas donde el Concepto esté vacío
        # ---------------------------------------------------------------------
        df_raw[col_concepto] = df_raw[col_concepto].fillna("").astype(str).replace(['nan', 'None', 'NaN'], '')
        df_raw = df_raw[df_raw[col_concepto].str.strip() != ""]
        
        # Filtrado temporal (Solo fechas >= fecha_corte)
        cols_fechas = []
        nombres_limpios = {col_concepto: col_concepto}
        
        for col in df_raw.columns[1:]:
            col_str = str(col).upper()
            if "TOTAL" in col_str or "UNNAMED" in col_str or "COLUMNA_" in col_str:
                continue 
                
            try:
                if isinstance(col, datetime):
                    fecha_obj = col.date()
                else:
                    texto_fecha = str(col).split(" ")[0]
                    fecha_obj = pd.to_datetime(texto_fecha, dayfirst=True).date()
                
                if fecha_obj >= fecha_corte:
                    fecha_formateada = fecha_obj.strftime("%d/%m/%Y")
                    nombres_limpios[col] = fecha_formateada
                    if fecha_formateada not in cols_fechas:
                        cols_fechas.append(fecha_formateada)
            except Exception:
                pass 

        df_raw.rename(columns=nombres_limpios, inplace=True)
        
        if not cols_fechas:
            st.warning("⚠️ No se encontraron fechas en el Excel que sean iguales o posteriores a la 'Fecha de Análisis'.")
            st.stop()

        df_procesado = df_raw[[col_concepto] + cols_fechas].copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # Extracción de filas clave
        row_saldo_acum = df_procesado[df_procesado[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
        row_posicion_dia = df_procesado[df_procesado[col_concepto].str.contains("^Posicion del dia$", case=False, na=False, regex=True)]
        row_saldo_ini = df_procesado[df_procesado[col_concepto].str.contains("^Saldo inicial$", case=False, na=False, regex=True)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_posicion_dia = row_posicion_dia[cols_fechas].values[0].tolist() if not row_posicion_dia.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        # Guardar en Base de Datos (Si Supabase está configurado)
        guardar_historial_diario(fecha_corte, df_procesado, col_concepto)

        # Cálculo de Iliquidez y Runway
        fecha_iliquidez_exacta = "Saludable"
        dias_runway = "+90"
        
        if not row_saldo_acum.empty:
            for col_fecha in cols_fechas:
                val_saldo = row_saldo_acum[col_fecha].values[0]
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

        # =====================================================================
        # 6. VISUALIZACIÓN DE PESTAÑAS
        # =====================================================================
        tab_dash, tab_matriz, tab_hist = st.tabs([
            "📊 Dashboard Proyectado", 
            "📋 Matriz Detallada",
            "📜 Histórico Consolidado"
        ])

        with tab_dash:
            st.markdown("### 📌 Indicadores Estratégicos (Proyección)")
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Disponibilidad Inicial", f"${val_saldo_ini:,.0f}")
            m2.metric("Déficit Máximo Proyectado", f"${min(arr_saldo_acum):,.0f}")
            m3.metric("Días de Caja (Runway)", dias_runway)
            m4.metric("Fecha de Saldo Crítico", fecha_iliquidez_exacta)

            st.divider()

            st.markdown(f"### 📈 Evolución del Flujo de Caja (Desde {fecha_corte.strftime('%d/%m/%Y')})")
            eje_x_fechas = [str(f) for f in cols_fechas]
            
            fig_line = go.Figure()
            fig_line.add_trace(go.Scatter(
                x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', name='Saldo Acumulado',
                line=dict(color='#3b82f6', width=3), fill='tozeroy', fillcolor='rgba(59, 130, 246, 0.1)'
            ))
            fig_line.add_trace(go.Bar(
                x=eje_x_fechas, y=arr_posicion_dia, name='Saldo Diario (Posición)', marker_color='rgba(16, 185, 129, 0.6)'
            ))
            
            fig_line.update_layout(
                height=400, margin=dict(l=0, r=0, t=10, b=0),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                xaxis=dict(showgrid=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)'),
                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)'
            )
            st.plotly_chart(fig_line, use_container_width=True)

        with tab_matriz:
            st.markdown(f"### 📋 Matriz Detallada (Desde {fecha_corte.strftime('%d/%m/%Y')})")
            
            columnas_a_mostrar = [col_concepto] + cols_fechas
            df_display = df_procesado[columnas_a_mostrar].copy()
            
            for col in cols_fechas:
                df_display[col] = df_display[col].apply(formato_moneda_texto)
            
            df_estilizado = df_display.style.map(pintar_negativos, subset=cols_fechas)
            st.dataframe(df_estilizado, use_container_width=True, hide_index=True, height=500)

        with tab_hist:
            st.markdown("### 📜 Registros Históricos Almacenados")
            if supabase is not None:
                try:
                    res = supabase.table("historial_cashflow").select("*").order("fecha_registro", desc=True).execute()
                    if res.data:
                        df_historico = pd.DataFrame(res.data)
                        st.dataframe(df_historico, use_container_width=True, hide_index=True)
                    else:
                        st.info("Aún no hay registros en el historial.")
                except Exception as e:
                    st.warning("Asegúrate de haber creado la tabla 'historial_cashflow' en tu panel de Supabase.")
            else:
                st.warning("Conexión a Supabase no configurada.")

    except Exception as e:
        st.error(f"Error procesando la información: {e}")

else:
    st.info("Por favor, cargue su archivo Excel y seleccione la hoja desde el panel lateral izquierdo.")
