import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date

# =============================================================================
# 1. CONFIGURACIÓN DE PÁGINA Y ESTILOS CORPORATIVOS
# =============================================================================
st.set_page_config(
    page_title="Cashflow Link | Corporate",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilo minimalista y estable para la interfaz
st.markdown("""
    <style>
    .corporate-header { font-size: 2.2rem; font-weight: 700; margin-bottom: 0px; padding-bottom: 0px; }
    .corporate-subheader { font-size: 1rem; color: #888888; margin-bottom: 2rem; }
    /* Ajuste ligero para las tablas nativas */
    div[data-testid="stDataFrame"] { border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    </style>
""", unsafe_allow_html=True)

# =============================================================================
# 2. FUNCIONES DE PROCESAMIENTO (CORRECCIÓN DE PANDAS)
# =============================================================================
def limpiar_valor_moneda(val):
    """Convierte celdas con formato de texto a números flotantes para cálculo."""
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

def pintar_negativos(val):
    """Retorna la regla CSS si el valor contiene un signo negativo."""
    if isinstance(val, str) and ('-' in val):
        return 'color: #ef4444; font-weight: bold;'
    return ''

def formato_moneda(x):
    """Formatea el número con signo $ y separador de miles."""
    if not isinstance(x, (int, float)):
        return x
    if x < 0:
        return f"-${abs(x):,.0f}"
    return f"${x:,.0f}"

# =============================================================================
# 3. PANEL LATERAL (SIDEBAR) PARA CONFIGURACIÓN
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Configuración de Datos")
    uploaded_file = st.file_uploader("Cargar Planilla (.xlsx)", type=["xlsx"])
    nombre_hoja = st.text_input("Hoja Objetivo", value="CASH EMPRESA")
    fecha_corte = st.date_input("Fecha Inicio", value=date(2026, 8, 10))
    st.divider()
    st.caption("Cashflow Link © 2026")

# =============================================================================
# 4. PANTALLA PRINCIPAL
# =============================================================================
st.markdown('<p class="corporate-header">CASHFLOW LINK</p>', unsafe_allow_html=True)
st.markdown('<p class="corporate-subheader">Sistema Integrado de Análisis de Liquidez y Proyecciones Financieras</p>', unsafe_allow_html=True)

if uploaded_file is not None:
    try:
        # --- LECTURA DEL ARCHIVO ---
        excel_data = pd.read_excel(uploaded_file, sheet_name=None)
        sheet_target = nombre_hoja if nombre_hoja in excel_data else list(excel_data.keys())[0]
        df_raw = excel_data[sheet_target]
        
        # Limpieza de nombres de columna
        nuevas_columnas = []
        for i, col in enumerate(df_raw.columns):
            if "Unnamed" in str(col):
                nuevas_columnas.append(f"Columna_{i}")
            elif isinstance(col, datetime):
                nuevas_columnas.append(col.strftime("%d/%m/%Y"))
            else:
                nuevas_columnas.append(str(col))
        
        df_raw.columns = nuevas_columnas
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        
        # Limpiar celdas vacías en la columna de conceptos
        df_raw[col_concepto] = df_raw[col_concepto].astype(str).replace(['nan', 'None', 'NaN'], '')
        
        # Obtener columnas de fechas
        cols_fechas = [c for c in df_raw.columns[1:] if "TOTAL" not in str(c).upper() and "Columna_" not in str(c)]
        
        # Crear tabla procesada puramente numérica
        df_procesado = df_raw.copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # --- EXTRACCIÓN DE DATOS CLAVE ---
        row_saldo_acum = df_procesado[df_procesado[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
        row_saldo_ini = df_procesado[df_procesado[col_concepto].str.contains("^Saldo inicial$", case=False, na=False, regex=True)]
        row_egresos = df_procesado[df_procesado[col_concepto].str.contains("^Total Egresos$", case=False, na=False, regex=True)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_egresos = row_egresos[cols_fechas].values[0].tolist() if not row_egresos.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        # Cálculo de Iliquidez y Runway
        fecha_iliquidez_exacta = "Saludable"
        dias_runway = "+90"
        
        if not row_saldo_acum.empty:
            for col_fecha in cols_fechas:
                val_saldo = row_saldo_acum[col_fecha].values[0]
                if val_saldo < 0:
                    try:
                        fecha_quiebre = pd.to_datetime(col_fecha, format='mixed', dayfirst=True).date()
                        fecha_iliquidez_exacta = fecha_quiebre.strftime("%d/%m/%Y")
                        dias_diff = (fecha_quiebre - fecha_corte).days
                        dias_runway = str(max(0, dias_diff))
                    except Exception:
                        fecha_iliquidez_exacta = str(col_fecha).split(" ")[0]
                        dias_runway = "0"
                    break

        # --- TABS CORPORATIVOS ---
        tab_dashboard, tab_analisis, tab_matriz = st.tabs(["📊 Visión General", "🍩 Análisis Financiero", "📁 Matriz de Cashflow"])

        with tab_dashboard:
            # Métricas Nativas de Streamlit (Estables y elegantes)
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Disponibilidad Inicial", f"${val_saldo_ini:,.0f}")
            m2.metric("Déficit Pico Registrado", f"${min(arr_saldo_acum):,.0f}")
            m3.metric("Iliquidez Crítica", fecha_iliquidez_exacta)
            m4.metric("Runway Operativo (Días)", dias_runway)

            st.write("---")
            
            # Gráfico Corporativo de Plotly
            st.markdown("#### Evolución de Liquidez vs Egresos")
            eje_x_fechas = [str(f).split(" ")[0] for f in cols_fechas]
            
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=eje_x_fechas, y=arr_saldo_acum, mode='lines', name='Saldo Acumulado',
                line=dict(color='#3b82f6', width=3), fill='tozeroy', fillcolor='rgba(59, 130, 246, 0.1)'
            ))
            fig.add_trace(go.Bar(
                x=eje_x_fechas, y=arr_egresos, name='Egresos Diarios', marker_color='rgba(239, 68, 68, 0.7)'
            ))
            
            fig.update_layout(
                height=450, margin=dict(l=0, r=0, t=30, b=0),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                xaxis=dict(showgrid=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)')
            )
            st.plotly_chart(fig, use_container_width=True)

        with tab_analisis:
            st.markdown("#### Composición de la Estructura de Egresos")
            df_sumas = df_procesado.copy()
            df_sumas['Total'] = df_sumas[cols_fechas].sum(axis=1)
            df_plot = df_sumas[(df_sumas['Total'] > 0) & (~df_sumas[col_concepto].str.contains("Total|Saldo|Posicion", case=False, na=False))]
            df_top = df_plot.nlargest(8, 'Total')
            
            c_dona, c_bar = st.columns(2)
            with c_dona:
                fig_pie = px.pie(df_top, values='Total', names=col_concepto, hole=0.5, color_discrete_sequence=px.colors.sequential.Blues_r)
                fig_pie.update_traces(textposition='inside', textinfo='percent')
                fig_pie.update_layout(height=400, showlegend=True, legend=dict(orientation="h", y=-0.2))
                st.plotly_chart(fig_pie, use_container_width=True)
            with c_bar:
                fig_bar = px.bar(df_top, x='Total', y=col_concepto, orientation='h', color='Total', color_continuous_scale='Blues')
                fig_bar.update_layout(height=400, showlegend=False, yaxis={'categoryorder':'total ascending'}, xaxis_title="Monto Acumulado")
                st.plotly_chart(fig_bar, use_container_width=True)

        with tab_matriz:
            st.markdown("#### Detalle Estructurado por Concepto")
            df_display = df_procesado[[col_concepto] + cols_fechas].copy()
            
            # Aplicar formato de moneda a los números
            for col in cols_fechas:
                df_display[col] = df_display[col].apply(formato_moneda)
            
            # SOLUCIÓN AL ERROR: Uso de .map() en lugar de .applymap()
            columnas_numericas = df_display.columns[1:]
            df_estilizado = df_display.style.map(pintar_negativos, subset=columnas_numericas)
            
            st.dataframe(df_estilizado, use_container_width=True, hide_index=True, height=600)

    except Exception as e:
        st.error(f"Error procesando la información: {e}")

else:
    st.info("Por favor, utilice el panel lateral izquierdo para cargar su archivo Excel de Cashflow.")
