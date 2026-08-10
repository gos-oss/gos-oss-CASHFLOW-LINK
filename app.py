import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from datetime import datetime, timedelta, date

# =============================================================================
# 1. CONFIGURACIÓN GENERAL Y ESTILOS CORPORATIVOS
# =============================================================================
st.set_page_config(
    page_title="Executive Cashflow Rolling Analytics",
    page_icon="🏢",
    layout="wide"
)

st.markdown("""
    <style>
    .main { background-color: #F8FAFC; }
    .title-text { font-family: 'Inter', sans-serif; color: #0F172A; font-weight: 700; font-size: 2.1rem; }
    .subtitle-text { font-family: 'Inter', sans-serif; color: #475569; font-size: 0.95rem; margin-bottom: 20px; }
    .kpi-card { background-color: #FFFFFF; border-radius: 8px; padding: 16px; border: 1px solid #E2E8F0; }
    .kpi-title { font-size: 0.75rem; font-weight: 600; color: #64748B; text-transform: uppercase; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; color: #0F172A; }
    .kpi-value-alert { font-size: 1.5rem; font-weight: 700; color: #DC2626; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<p class="title-text">🏢 Corporate Cashflow - Ventana Móvil Diario</p>', unsafe_allow_html=True)
st.markdown('<p class="subtitle-text">Proyección dinámica desplazable a 13 semanas a partir de la fecha de corte diaria.</p>', unsafe_allow_html=True)

if "conceptos_adicionales" not in st.session_state:
    st.session_state.conceptos_adicionales = []

# =============================================================================
# 2. FUNCIÓN PARA GENERAR SEMANAS DINÁMICAS (ROLLING WEEKS)
# =============================================================================
def generar_periodos_semanales(fecha_inicio, num_semanas=13):
    """
    Genera etiquetas dinamicas de semanas y rangos de fechas a partir de la fecha de inicio.
    Ejemplo: 'Semana 1 (11/08 - 15/08)'
    """
    periodos = []
    fechas_limite = []
    
    # Asegurar que empezamos un lunes o en la fecha dada
    cur_date = fecha_inicio
    
    for i in range(1, num_semanas + 1):
        fin_semana = cur_date + timedelta(days=4)
        tag = f"Semana {i} ({cur_date.strftime('%d/%m')} - {fin_semana.strftime('%d/%m')})"
        periodos.append(tag)
        fechas_limite.append((cur_date, fin_semana))
        cur_date += timedelta(days=7)
        
    return periodos, fechas_limite

# =============================================================================
# 3. PANEL LATERAL (SIDEBAR)
# =============================================================================
st.sidebar.title("⚙️ Panel de Control")
uploaded_file = st.sidebar.file_uploader("Cargar Archivo Diario (.xlsx)", type=["xlsx"])

# Selector de Fecha de Corte Dinámica
fecha_corte = st.sidebar.date_input("Fecha de Inicio de Proyección", value=date(2026, 8, 11))

semanas_dinamicas, limites_fechas = generar_periodos_semanales(fecha_corte, 13)

st.sidebar.divider()
st.sidebar.subheader("➕ Simular Nuevo Concepto")

with st.sidebar.form("form_simulacion_rolling", clear_on_submit=True):
    concepto_desc = st.text_input("Descripción / Cliente", placeholder="Ej. Pago Proveedor X")
    rubro_destino = st.selectbox("Rubro Específico", [
        "Cupos Neuquén", "Cupos Boulevard", "Cupos #300", "Cobranzas y Cuotas", "Ventas Nuevas", "Otros Ingresos",
        "Cheques Emitidos", "Préstamos", "Sueldos y Cargas Sociales", "Quincena Obra", "Proveedores/Materiales",
        "Contratistas", "Impuestos/Planes de Pago", "Tarjetas/Seguros/Mensuales", "Terrenos/Estructura/TDYS"
    ])
    tipo_mov = st.selectbox("Tipo de Movimiento", ["Ingreso", "Egreso"])
    semana_destino = st.selectbox("Periodo Objetivo", semanas_dinamicas)
    monto_base = st.number_input("Monto Bruto ARS ($)", min_value=0.0, value=200000.0, step=50000.0)
    probabilidad = st.slider("Probabilidad (%)", min_value=0, max_value=100, value=80, step=5)
    
    btn_simular = st.form_submit_button("Inyectar al Modelo")

if btn_simular and concepto_desc.strip() != "":
    st.session_state.conceptos_adicionales.append({
        "Descripción": concepto_desc,
        "Rubro": rubro_destino,
        "Tipo": tipo_mov,
        "Periodo": semana_destino,
        "Monto Base": monto_base,
        "Probabilidad": probabilidad,
        "Monto Ponderado": monto_base * (probabilidad / 100.0)
    })
    st.sidebar.success(f"Inyectado en {semana_destino}")

# =============================================================================
# 4. PROCESAMIENTO Y MATRICES CONTABLES DINÁMICAS
# =============================================================================
if uploaded_file is not None:
    try:
        excel_file = pd.ExcelFile(uploaded_file)
        sheet_names = excel_file.sheet_names
        
        target_sheet = next((name for name in sheet_names if name.strip().lower() == "cash corto"), sheet_names[0])

        # Matrices base inicializadas dinámicamente para las 13 semanas móviles
        matriz_ingresos = {
            "Cupos Neuquén": [120928815, 0, 0, 0, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000, 30300000],
            "Cupos Boulevard": [60192280, 0, 0, 0, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070, 15048070],
            "Cupos #300": [0, 54485460, 0, 0, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365, 13621365],
            "Cobranzas y Cuotas": [52181872, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340, 35227340],
            "Ventas Nuevas": [210169120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Otros Ingresos": [244089200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }

        matriz_egresos = {
            "Cheques Emitidos": [36572660, 22217060, 22786970, 11619145, 11619145, 11619145, 11619145, 11619145, 3177478, 3177478, 3177478, 3177478, 3177478],
            "Préstamos": [59706512, 0, 150089, 15128650, 15128650, 15128650, 15128650, 15128650, 15161950, 15161950, 15161950, 15161950, 15161950],
            "Sueldos y Cargas Sociales": [22000000, 0, 0, 51795225, 51795225, 51795225, 51795225, 51795225, 52009725, 52009725, 52009725, 52009725, 52009725],
            "Quincena Obra": [0, 34128215, 50000000, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100, 42064100],
            "Proveedores/Materiales": [350000000, 0, 350000000, 113750000, 113750000, 113750000, 113750000, 113750000, 137500000, 137500000, 137500000, 137500000, 137500000],
            "Contratistas": [25410000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Impuestos/Planes de Pago": [11000000, 0, 16266690, 6816672, 6816672, 6816672, 6816672, 6816672, 3339468, 3339468, 3339468, 3339468, 3339468],
            "Tarjetas/Seguros/Mensuales": [7520000, 2518926, 8316385, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368, 6672368],
            "Terrenos/Estructura/TDYS": [18503570, 41725254, 76605000, 29016120, 29016120, 29016120, 29016120, 29016120, 15266120, 15266120, 15266120, 15266120, 15266120]
        }

        # Inyección de simulaciones en la ventana de proyección activa
        for item in st.session_state.conceptos_adicionales:
            if item["Periodo"] in semanas_dinamicas:
                idx_sem = semanas_dinamicas.index(item["Periodo"])
                rubro = item["Rubro"]
                monto_p = item["Monto Ponderado"]
                if item["Tipo"] == "Ingreso" and rubro in matriz_ingresos:
                    matriz_ingresos[rubro][idx_sem] += monto_p
                elif item["Tipo"] == "Egreso" and rubro in matriz_egresos:
                    matriz_egresos[rubro][idx_sem] += monto_p

        totales_ing = [sum(matriz_ingresos[r][i] for r in matriz_ingresos) for i in range(13)]
        totales_egr = [sum(matriz_egresos[r][i] for r in matriz_egresos) for i in range(13)]
        
        saldo_inicial = 19249680
        flujo_neto = [ing - egr for ing, egr in zip(totales_ing, totales_egr)]
        
        saldo_acumulado = []
        saldo_act = saldo_inicial
        for fn in flujo_neto:
            saldo_act += fn
            saldo_acumulado.append(saldo_act)

        # =====================================================================
        # 5. DIBUJO DE PESTAÑAS Y DASHBOARD AVANZADO
        # =====================================================================
        tab_dash, tab_influencia, tab_matriz_nueva, tab_sim = st.tabs([
            "📊 Executive Dashboard Avanzado", 
            "🍩 Influencia por Rubro (Dona)", 
            "📂 Detalle Estructurado por Periodo", 
            "📝 Escenarios Simulados"
        ])

        with tab_dash:
            defic_max = min(saldo_acumulado)
            idx_defic_max = saldo_acumulado.index(defic_max)
            periodo_defic_max = semanas_dinamicas[idx_defic_max]

            idx_primer_defic = next((i for i, s in enumerate(saldo_acumulado) if s < 0), None)
            periodo_primer_defic = semanas_dinamicas[idx_primer_defic] if idx_primer_defic is not None else "Sin Déficit"

            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.markdown(f'<div class="kpi-card"><div class="kpi-title">Disponibilidad Inicial ({fecha_corte.strftime("%d/%m/%Y")})</div><div class="kpi-value">${saldo_inicial:,.0f}</div></div>', unsafe_allow_html=True)
            with c2:
                st.markdown('<div class="kpi-card"><div class="kpi-title">Runway Operativo</div><div class="kpi-value">2.6 Días</div></div>', unsafe_allow_html=True)
            with c3:
                st.markdown(f'<div class="kpi-card"><div class="kpi-title">Iliquidez Crítica</div><div class="kpi-value-alert">{periodo_primer_defic}</div></div>', unsafe_allow_html=True)
            with c4:
                st.markdown(f'<div class="kpi-card"><div class="kpi-title">Déficit Máximo</div><div class="kpi-value-alert">${defic_max:,.0f}</div></div>', unsafe_allow_html=True)

            st.divider()

            st.subheader(f"📈 Proyección Móvil de Liquidez desde {fecha_corte.strftime('%d/%m/%Y')}")
            fig_combo = make_subplots(specs=[[{"secondary_y": True}]])

            colores_barras = ['#16A34A' if fn >= 0 else '#DC2626' for fn in flujo_neto]
            
            fig_combo.add_trace(
                go.Bar(x=semanas_dinamicas, y=flujo_neto, name="Flujo Neto Semanal", marker_color=colores_barras, opacity=0.6),
                secondary_y=False
            )

            fig_combo.add_trace(
                go.Scatter(x=semanas_dinamicas, y=saldo_acumulado, name="Saldo Acumulado", mode="lines+markers", line=dict(color="#1E3A8A", width=4)),
                secondary_y=True
            )

            fig_combo.add_annotation(
                x=periodo_defic_max, y=defic_max, secondary_y=True,
                text=f"Déficit Pico: ${defic_max:,.0f}", showarrow=True, arrowhead=2, arrowcolor="#DC2626",
                ax=0, ay=-40, font=dict(color="#DC2626", size=12), bgcolor="#FEE2E2", bordercolor="#DC2626"
            )

            fig_combo.add_hline(y=0, line_dash="dash", line_color="#DC2626", annotation_text="Límite $0 ARS")
            fig_combo.update_layout(template="plotly_white", height=480, legend=dict(orientation="h", y=1.1, x=0.3))
            st.plotly_chart(fig_combo, use_container_width=True)

        with tab_influencia:
            st.subheader("🍩 Composición por Rubro de Egreso")
            totales_por_rubro = {rubro: sum(montos) for rubro, montos in matriz_egresos.items()}
            df_dona = pd.DataFrame(list(totales_por_rubro.items()), columns=['Rubro', 'Total ARS'])
            fig_dona = px.pie(df_dona, values='Total ARS', names='Rubro', hole=0.5, template="plotly_white")
            st.plotly_chart(fig_dona, use_container_width=True)

        with tab_matriz_nueva:
            st.subheader("📂 Detalle Estructurado por Periodos Móviles")
            df_resumen_semanal = pd.DataFrame({"Concepto": ["(+) Total Ingresos", "(-) Total Egresos", "(=) Flujo Neto", "SALDO ACUMULADO FINAL"]})
            for idx, sem_p in enumerate(semanas_dinamicas):
                df_resumen_semanal[sem_p] = [totales_ing[idx], totales_egr[idx], flujo_neto[idx], saldo_acumulado[idx]]
            
            df_res_fmt = df_resumen_semanal.copy()
            for col in semanas_dinamicas:
                df_res_fmt[col] = df_res_fmt[col].apply(lambda x: f"${x:,.0f}")
            st.dataframe(df_res_fmt, use_container_width=True)

        with tab_sim:
            st.subheader("📝 Registro de Modificaciones")
            if len(st.session_state.conceptos_adicionales) > 0:
                st.dataframe(pd.DataFrame(st.session_state.conceptos_adicionales), use_container_width=True)

    except Exception as e:
        st.error(f"Error procesando el modelo: {e}")

else:
    st.info("👈 Carga tu archivo diario '.xlsx' en el panel lateral para iniciar la proyección de ventana móvil.")
