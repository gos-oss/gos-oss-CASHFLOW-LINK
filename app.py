import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date

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
# 2. FUNCIONES DE LIMPIEZA
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
    """Pinta de rojo los valores negativos en la tabla para rápida identificación visual."""
    if isinstance(val, str) and ('-' in val) and ('$' in val):
        return 'color: #ef4444; font-weight: 600;'
    return ''

# =============================================================================
# 3. PANEL LATERAL DE CONFIGURACIÓN
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Configuración de Datos")
    uploaded_file = st.file_uploader("1. Cargar Archivo Excel (.xlsx)", type=["xlsx"])
    
    hoja_seleccionada = None
    if uploaded_file is not None:
        excel_file = pd.ExcelFile(uploaded_file)
        hoja_seleccionada = st.selectbox("2. Seleccionar Hoja", excel_file.sheet_names)
    
    # ESTA FECHA AHORA DETERMINA EL INICIO DE TODO EL ANÁLISIS
    fecha_corte = st.date_input("3. Fecha de Análisis (Inicio de Proyección)", value=date(2026, 8, 10))
    st.divider()

# =============================================================================
# 4. PANTALLA PRINCIPAL Y LÓGICA DE FILTRADO DE FECHAS
# =============================================================================
st.markdown('<p class="corporate-header">CASHFLOW LINK</p>', unsafe_allow_html=True)
st.markdown('<p class="corporate-subheader">Panel de Control de Liquidez, Evolución Diaria y Composición de Cartera</p>', unsafe_allow_html=True)

if uploaded_file is not None and hoja_seleccionada is not None:
    try:
        # --- LECTURA DEL ARCHIVO ---
        df_raw = pd.read_excel(uploaded_file, sheet_name=hoja_seleccionada)
        
        # 1. Renombrar la primera columna a "Concepto"
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        df_raw[col_concepto] = df_raw[col_concepto].fillna("").astype(str).replace(['nan', 'None', 'NaN'], '')
        
        # 2. LÓGICA DE FILTRADO TEMPORAL (Solo fechas >= fecha_corte)
        cols_fechas = []
        nombres_limpios = {col_concepto: col_concepto}
        
        for col in df_raw.columns[1:]:
            col_str = str(col).upper()
            if "TOTAL" in col_str or "UNNAMED" in col_str:
                continue # Ignorar columnas que no son fechas
                
            try:
                # Convertimos el encabezado de la columna a un objeto Date de Python
                if isinstance(col, datetime):
                    fecha_obj = col.date()
                else:
                    # Limpiamos ceros y tratamos de parsear
                    texto_fecha = str(col).split(" ")[0]
                    fecha_obj = pd.to_datetime(texto_fecha, dayfirst=True).date()
                
                # CONDICIÓN DE FILTRO: ¿La columna es igual o más reciente que la configuración?
                if fecha_obj >= fecha_corte:
                    fecha_formateada = fecha_obj.strftime("%d/%m/%Y")
                    nombres_limpios[col] = fecha_formateada
                    if fecha_formateada not in cols_fechas:
                        cols_fechas.append(fecha_formateada)
            except Exception:
                pass # Si no es una fecha válida, la ignoramos

        # Renombrar columnas válidas en el dataframe
        df_raw.rename(columns=nombres_limpios, inplace=True)
        
        # Validar si quedaron fechas después del filtro
        if not cols_fechas:
            st.warning("⚠️ No se encontraron fechas en el Excel que sean iguales o posteriores a la 'Fecha de Análisis' seleccionada.")
            st.stop()

        # Procesar valores a numéricos limpios solo en las columnas filtradas
        df_procesado = df_raw[[col_concepto] + cols_fechas].copy()
        for col in cols_fechas:
            df_procesado[col] = df_procesado[col].apply(limpiar_valor_moneda)

        # --- EXTRACCIÓN DE FILAS CLAVE ---
        row_saldo_acum = df_procesado[df_procesado[col_concepto].str.contains("^Saldo acumulado$", case=False, na=False, regex=True)]
        row_posicion_dia = df_procesado[df_procesado[col_concepto].str.contains("^Posicion del dia$", case=False, na=False, regex=True)]
        row_saldo_ini = df_procesado[df_procesado[col_concepto].str.contains("^Saldo inicial$", case=False, na=False, regex=True)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_posicion_dia = row_posicion_dia[cols_fechas].values[0].tolist() if not row_posicion_dia.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0

        # --- CÁLCULO DE DÍAS DE CAJA E ILIQUIDEZ (PROYECCIÓN) ---
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
        # 5. VISUALIZACIÓN DEL DASHBOARD (AHORA SOLO VE EL FUTURO)
        # =====================================================================
        
        # --- BLOQUE 1: INDICADORES PRINCIPALES ---
        st.markdown("### 📌 Indicadores Estratégicos (Proyección)")
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Disponibilidad Inicial", f"${val_saldo_ini:,.0f}")
        m2.metric("Déficit Máximo Proyectado", f"${min(arr_saldo_acum):,.0f}")
        m3.metric("Días de Caja (Runway)", dias_runway)
        m4.metric("Fecha de Saldo Crítico", fecha_iliquidez_exacta)

        st.divider()

        # --- BLOQUE 2: GRÁFICO DE EVOLUCIÓN (LÍNEA) ---
        st.markdown(f"### 📈 Evolución del Flujo de Caja (Desde {fecha_corte.strftime('%d/%m/%Y')})")
        eje_x_fechas = [str(f) for f in cols_fechas]
        
        fig_line = go.Figure()
        # Saldo Acumulado
        fig_line.add_trace(go.Scatter(
            x=eje_x_fechas, y=arr_saldo_acum, mode='lines+markers', name='Saldo Acumulado',
            line=dict(color='#3b82f6', width=3), fill='tozeroy', fillcolor='rgba(59, 130, 246, 0.1)'
        ))
        # Saldo Diario
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

        st.divider()

        # --- BLOQUE 3: GRÁFICOS DE TORTA (COMPOSICIÓN PROYECTADA) ---
        st.markdown("### 🍩 Participación de Conceptos (Periodo Proyectado)")
        
        idx_ingresos = df_procesado.index[df_procesado[col_concepto].str.contains("^Total ingresos$", case=False, na=False, regex=True)].tolist()
        idx_egresos = df_procesado.index[df_procesado[col_concepto].str.contains("^Total Egresos$", case=False, na=False, regex=True)].tolist()
        
        if idx_ingresos and idx_egresos:
            idx_ing = idx_ingresos[0]
            idx_egr = idx_egresos[0]
            
            df_procesado['Suma_Periodo'] = df_procesado[cols_fechas].sum(axis=1)
            
            df_ingresos_chart = df_procesado.iloc[0:idx_ing]
            df_egresos_chart = df_procesado.iloc[idx_ing+1:idx_egr]
            
            df_ingresos_chart = df_ingresos_chart[(df_ingresos_chart['Suma_Periodo'] > 0) & (df_ingresos_chart[col_concepto] != "")]
            df_egresos_chart = df_egresos_chart[(df_egresos_chart['Suma_Periodo'] > 0) & (df_egresos_chart[col_concepto] != "")]

            c_torta1, c_torta2 = st.columns(2)
            with c_torta1:
                st.markdown("<h5 style='text-align: center; color: #4ADE80;'>Estructura de Ingresos</h5>", unsafe_allow_html=True)
                fig_ing = px.pie(df_ingresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.5, color_discrete_sequence=px.colors.sequential.Teal)
                fig_ing.update_traces(textposition='inside', textinfo='percent')
                fig_ing.update_layout(height=350, showlegend=True, legend=dict(orientation="h", y=-0.2), plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                st.plotly_chart(fig_ing, use_container_width=True)

            with c_torta2:
                st.markdown("<h5 style='text-align: center; color: #F87171;'>Estructura de Egresos</h5>", unsafe_allow_html=True)
                fig_egr = px.pie(df_egresos_chart, values='Suma_Periodo', names=col_concepto, hole=0.5, color_discrete_sequence=px.colors.sequential.Reds_r)
                fig_egr.update_traces(textposition='inside', textinfo='percent')
                fig_egr.update_layout(height=350, showlegend=True, legend=dict(orientation="h", y=-0.2), plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                st.plotly_chart(fig_egr, use_container_width=True)
        else:
            st.warning("No se encontraron las filas 'Total ingresos' o 'Total Egresos' para generar los gráficos de torta.")

        st.divider()

        # --- BLOQUE 4: TABLA DE DETALLE FILTRADA ---
        st.markdown(f"### 📋 Matriz Detallada (Desde {fecha_corte.strftime('%d/%m/%Y')})")
        
        columnas_a_mostrar = [col_concepto] + cols_fechas
        df_display = df_procesado[columnas_a_mostrar].copy()
        
        for col in cols_fechas:
            df_display[col] = df_display[col].apply(formato_moneda_texto)
        
        df_estilizado = df_display.style.map(pintar_negativos, subset=cols_fechas)
        
        st.dataframe(df_estilizado, use_container_width=True, hide_index=True, height=500)

    except Exception as e:
        st.error(f"Error procesando la información: {e}")

else:
    st.info("Por favor, cargue su archivo Excel y seleccione la hoja desde el panel lateral izquierdo.")
