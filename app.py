import streamlit as st
import pandas as pd
import openpyxl
import plotly.graph_objects as go

# Configuración de la página web
st.set_page_config(page_title="Dashboard Cashflow", layout="wide")
st.title("📊 Dashboard Ejecutivo de Cashflow")

# Carga interactiva de archivo Excel
uploaded_file = st.sidebar.file_uploader("Carga tu archivo Excel (.xlsx)", type=["xlsx"])

if uploaded_file is not None:
    st.success("¡Archivo cargado correctamente!")
    df = pd.read_excel(uploaded_file, sheet_name="Cash corto")
    st.dataframe(df.head())
else:
    st.info("👈 Sube tu archivo '2026.08.10 FF corto.xlsx' en la barra lateral para comenzar.")