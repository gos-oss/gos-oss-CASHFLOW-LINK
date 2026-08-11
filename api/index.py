from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
import pandas as pd
from io import BytesIO
import re

app = FastAPI()

def normalizar_concepto(texto):
    if pd.isna(texto): return ""
    return re.sub(r'[^a-z0-9]', '', str(texto).lower())

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

# 1. RUTA PRINCIPAL: Interfaz Completa (HTML + CSS + JS)
@app.get("/", response_class=HTMLResponse)
def ruta_principal():
    html_content = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Cashflow Link | Vercel Edition</title>
        <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            body {
                background: radial-gradient(circle at 50% 0%, #1e3a8a 0%, #0f172a 100%);
                color: #f8fafc; font-family: 'Inter', sans-serif;
                margin: 0; padding: 20px; min-height: 100vh;
            }
            .corporate-banner {
                background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 25px 35px; border-radius: 15px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                margin-bottom: 20px;
            }
            h1 { margin: 0 0 5px 0; font-size: 2.2rem; font-weight: 800; color: #ffffff; }
            .btn-subir {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white; border: none; padding: 10px 20px; border-radius: 8px;
                font-weight: bold; cursor: pointer; margin-top: 10px;
            }
            
            /* --- ESTILOS DE PESTAÑAS --- */
            .tabs-container {
                display: flex; gap: 10px; background: rgba(15, 23, 42, 0.8);
                padding: 8px; border-radius: 12px; margin-bottom: 20px; display: none;
            }
            .tab-btn {
                background: transparent; border: none; color: #cbd5e1; font-weight: 600;
                font-size: 1rem; padding: 10px 20px; border-radius: 8px; cursor: pointer;
            }
            .tab-btn.active {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: #ffffff; font-weight: 800;
            }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            
            /* --- ESTILOS DE TARJETAS Y TABLA --- */
            .metrics-row { display: flex; gap: 15px; margin-bottom: 20px; }
            .metric-card {
                background: linear-gradient(145deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
                border: 1px solid rgba(147, 197, 253, 0.15); border-radius: 16px; padding: 20px; flex: 1;
            }
            .chart-box {
                background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px; padding: 20px; height: 500px; margin-bottom: 20px;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
            th, td { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px; text-align: left; }
            th { color: #93c5fd; }
            .negativo { color: #f87171; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="corporate-banner">
            <h1>CASHFLOW LINK</h1>
            <p style="color: #93c5fd; margin-bottom: 15px;">Executive Board • Procesado en Vercel</p>
            <input type="file" id="fileInput" accept=".xlsx" style="color: white;">
            <button class="btn-subir" onclick="procesarArchivo()">Generar Tablero Unificado</button>
            <div id="status-msg" style="color: #60a5fa; margin-top: 10px; font-weight: bold;"></div>
        </div>

        <!-- SISTEMA DE PESTAÑAS -->
        <div class="tabs-container" id="tabs-menu">
            <button class="tab-btn active" onclick="cambiarPestana('tab-vision', this)">📊 Visión Ejecutiva</button>
            <button class="tab-btn" onclick="cambiarPestana('tab-matriz', this)">📁 Estructura Financiera</button>
            <button class="tab-btn" onclick="cambiarPestana('tab-analisis', this)">🍩 Análisis de Rubros</button>
        </div>

        <!-- CONTENIDO: Visión Ejecutiva -->
        <div id="tab-vision" class="tab-content active">
            <div class="metrics-row">
                <div class="metric-card">
                    <div style="color: #93c5fd; font-size: 0.85rem; font-weight: bold;">DISPONIBILIDAD INICIAL</div>
                    <div id="val-inicial" style="font-size: 2rem; font-weight: 800; margin-top: 5px;">$0</div>
                </div>
                <div class="metric-card">
                    <div style="color: #93c5fd; font-size: 0.85rem; font-weight: bold;">DÉFICIT MÁXIMO PROYECTADO</div>
                    <div id="val-deficit" style="font-size: 2rem; font-weight: 800; margin-top: 5px;">$0</div>
                </div>
            </div>
            <div id="chart-lineas" class="chart-box"></div>
        </div>

        <!-- CONTENIDO: Estructura Financiera (Matriz) -->
        <div id="tab-matriz" class="tab-content">
            <div class="chart-box" style="height: auto; overflow-x: auto;">
                <h3 style="color: #4ADE80; margin-top: 0;">Resumen Consolidado</h3>
                <table id="tabla-matriz">
                    <thead><tr id="tabla-header"></tr></thead>
                    <tbody id="tabla-body"></tbody>
                </table>
            </div>
        </div>

        <!-- CONTENIDO: Análisis de Rubros -->
        <div id="tab-analisis" class="tab-content">
            <div style="display: flex; gap: 20px;">
                <div id="chart-ingresos" class="chart-box" style="flex: 1;"></div>
                <div id="chart-egresos" class="chart-box" style="flex: 1;"></div>
            </div>
        </div>

        <script>
            // Función para alternar pestañas
            function cambiarPestana(idDestino, btnElement) {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                document.getElementById(idDestino).classList.add('active');
                btnElement.classList.add('active');
            }

            // Formatear Moneda
            function formatMoney(num) {
                if(num < 0) return "-$" + Math.abs(num).toLocaleString('en-US');
                return "$" + num.toLocaleString('en-US');
            }

            async function procesarArchivo() {
                const fileInput = document.getElementById('fileInput');
                const statusMsg = document.getElementById('status-msg');
                if (fileInput.files.length === 0) { statusMsg.innerText = "Selecciona un archivo."; return; }

                statusMsg.innerText = "Procesando...";
                const formData = new FormData(); formData.append("archivo", fileInput.files[0]);

                try {
                    const res = await fetch('/procesar-excel/', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.estado === "error") { statusMsg.innerText = "Error: " + data.mensaje; return; }
                    statusMsg.innerText = "";
                    document.getElementById('tabs-menu').style.display = 'flex';

                    // 1. Llenar Métricas
                    document.getElementById('val-inicial').innerText = formatMoney(data.saldo_inicial);
                    document.getElementById('val-deficit').innerText = formatMoney(data.deficit_maximo);

                    // 2. Gráfico de Evolución
                    Plotly.newPlot('chart-lineas', [
                        { x: data.fechas, y: data.saldo_acumulado, name: 'Saldo Acumulado', type: 'scatter', mode: 'lines+markers', line: {color: '#60a5fa', width: 4}, fill: 'tozeroy', fillcolor: 'rgba(96, 165, 250, 0.15)' },
                        { x: data.fechas, y: data.posicion_dia, name: 'Saldo Diario', type: 'bar', marker: {color: 'rgba(148, 163, 184, 0.4)'} }
                    ], {
                        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: {color: '#e2e8f0'},
                        hovermode: 'x unified', xaxis: {showgrid: false}, yaxis: {showgrid: true, gridcolor: 'rgba(255,255,255,0.08)'}, margin: {t: 30, b: 40, l: 50, r: 20}
                    });

                    // 3. Gráficos de Torta (Donas con automargin y textposition)
                    const layoutPie = {
                        paper_bgcolor: 'rgba(0,0,0,0)', font: {color: '#e2e8f0'},
                        showlegend: false, margin: {t: 40, b: 60, l: 80, r: 80}
                    };
                    
                    Plotly.newPlot('chart-ingresos', [{
                        values: data.ingresos_vals, labels: data.ingresos_nombres, type: 'pie', hole: 0.5,
                        textposition: 'outside', textinfo: 'label+percent', automargin: true
                    }], { ...layoutPie, title: 'Estructura de Ingresos' });

                    Plotly.newPlot('chart-egresos', [{
                        values: data.egresos_vals, labels: data.egresos_nombres, type: 'pie', hole: 0.5,
                        textposition: 'outside', textinfo: 'label+percent', automargin: true
                    }], { ...layoutPie, title: 'Estructura de Egresos' });

                    // 4. Llenar Tabla Matriz
                    const thRow = document.getElementById('tabla-header');
                    thRow.innerHTML = "<th>Concepto</th>" + data.fechas.map(f => `<th>${f}</th>`).join("");
                    
                    const tbody = document.getElementById('tabla-body');
                    tbody.innerHTML = data.saldos_matriz.map(row => {
                        return `<tr>
                            <td><strong>${row.concepto}</strong></td>
                            ${data.fechas.map((f, i) => {
                                let val = row.valores[i];
                                let clase = val < 0 ? "negativo" : "";
                                return `<td class="${clase}">${formatMoney(val)}</td>`;
                            }).join("")}
                        </tr>`;
                    }).join("");

                } catch (e) {
                    statusMsg.innerText = "Error de red.";
                }
            }
        </script>
    </body>
    </html>
    """
    return html_content

# 2. RUTA BACKEND: Procesa Excel y envía JSON
@app.post("/procesar-excel/")
async def procesar_archivo_excel(archivo: UploadFile = File(...)):
    try:
        contenido = await archivo.read()
        df_raw = pd.read_excel(BytesIO(contenido))
        
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        df_raw[col_concepto] = df_raw[col_concepto].fillna("").astype(str)
        df_raw['concepto_norm'] = df_raw[col_concepto].apply(normalizar_concepto)
        
        cols_fechas = [col for col in df_raw.columns if col not in [col_concepto, 'concepto_norm']][:15]
        fechas_str = [str(col).split(" ")[0] for col in cols_fechas]
        
        for col in cols_fechas:
            df_raw[col] = df_raw[col].apply(limpiar_valor_moneda)
            
        row_saldo_acum = df_raw[df_raw['concepto_norm'].str.contains("saldoacumulado", na=False)]
        row_posicion_dia = df_raw[df_raw['concepto_norm'].str.contains("posiciondeldia", na=False)]
        row_saldo_ini = df_raw[df_raw['concepto_norm'].str.contains("saldoinicial", na=False)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_posicion_dia = row_posicion_dia[cols_fechas].values[0].tolist() if not row_posicion_dia.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0
        
        # Procesamiento para Gráficos de Torta
        idx_ingresos_list = df_raw.index[df_raw['concepto_norm'].str.contains("totalingresos", na=False)].tolist()
        idx_egresos_list = df_raw.index[df_raw['concepto_norm'].str.contains("totalegresos", na=False)].tolist()
        
        ingresos_nombres, ingresos_vals = [], []
        egresos_nombres, egresos_vals = [], []
        
        if idx_ingresos_list and idx_egresos_list:
            idx_ing, idx_egr = idx_ingresos_list[0], idx_egresos_list[0]
            
            df_raw['suma'] = df_raw[cols_fechas].sum(axis=1)
            
            df_ing = df_raw.iloc[0:idx_ing]
            df_ing = df_ing[(df_ing['suma'] > 0) & (df_ing[col_concepto] != "")]
            ingresos_nombres = df_ing[col_concepto].tolist()
            ingresos_vals = df_ing['suma'].tolist()
            
            df_egr = df_raw.iloc[idx_ing+1:idx_egr]
            df_egr = df_egr[(df_egr['suma'] > 0) & (df_egr[col_concepto] != "")]
            egresos_nombres = df_egr[col_concepto].tolist()
            egresos_vals = df_egr['suma'].tolist()

        # Filas para la Matriz
        saldos_matriz = [
            {"concepto": "Posición del Día", "valores": arr_posicion_dia},
            {"concepto": "Saldo Acumulado", "valores": arr_saldo_acum}
        ]
        
        return {
            "estado": "éxito",
            "fechas": fechas_str,
            "saldo_acumulado": arr_saldo_acum,
            "posicion_dia": arr_posicion_dia,
            "saldo_inicial": val_saldo_ini,
            "deficit_maximo": min(arr_saldo_acum) if arr_saldo_acum and min(arr_saldo_acum) < 0 else 0,
            "ingresos_nombres": ingresos_nombres,
            "ingresos_vals": ingresos_vals,
            "egresos_nombres": egresos_nombres,
            "egresos_vals": egresos_vals,
            "saldos_matriz": saldos_matriz
        }
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}
