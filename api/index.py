from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
import pandas as pd
from io import BytesIO
import re

# Inicializamos la aplicación FastAPI
app = FastAPI()

def normalizar_concepto(texto):
    """Limpia el texto para buscar filas sin fallos."""
    if pd.isna(texto): return ""
    return re.sub(r'[^a-z0-9]', '', str(texto).lower())

def limpiar_valor_moneda(val):
    """Convierte texto de dinero a números para graficar."""
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

# 1. RUTA PRINCIPAL: La interfaz visual con HTML, CSS y JavaScript
@app.get("/", response_class=HTMLResponse)
def ruta_principal():
    html_content = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Cashflow Link | Executive Board</title>
        <!-- Importamos la librería Plotly para Javascript -->
        <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            body {
                background: radial-gradient(circle at 50% 0%, #1e3a8a 0%, #0f172a 100%);
                color: #f8fafc;
                font-family: 'Inter', sans-serif;
                margin: 0; padding: 20px;
            }
            .corporate-banner {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 30px; border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                text-align: center; margin-bottom: 20px;
            }
            h1 { margin: 0; font-size: 2.5rem; font-weight: 800; }
            .metrics-container {
                display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px;
            }
            .metric-card {
                background: linear-gradient(145deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
                border: 1px solid rgba(147, 197, 253, 0.15);
                padding: 20px; border-radius: 16px; width: 100%;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            }
            .metric-title { color: #93c5fd; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; }
            .metric-value { font-size: 2.2rem; font-weight: 800; color: #ffffff; margin-top: 10px; }
            
            #chart-container {
                background: rgba(15, 23, 42, 0.5);
                border-radius: 16px; padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                height: 450px; display: none; /* Oculto hasta que haya datos */
            }
            button {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white; border: none; padding: 12px 25px;
                font-weight: bold; border-radius: 8px; cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="corporate-banner">
            <h1>CASHFLOW LINK</h1>
            <p>Sube tu archivo Excel para generar el tablero en Vercel</p>
            <input type="file" id="fileInput" accept=".xlsx">
            <button onclick="procesarArchivo()">Generar Tablero</button>
            <p id="status-msg" style="color: #60a5fa; margin-top: 15px;"></p>
        </div>

        <!-- Contenedores para las métricas (Inician vacíos) -->
        <div class="metrics-container" id="metrics-panel" style="display: none;">
            <div class="metric-card">
                <div class="metric-title">Disponibilidad Inicial</div>
                <div class="metric-value" id="val-inicial">$0</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Déficit Máximo Proyectado</div>
                <div class="metric-value" id="val-deficit">$0</div>
            </div>
        </div>

        <!-- Contenedor donde Plotly dibujará el gráfico -->
        <div id="chart-container"></div>

        <!-- Lógica JavaScript para conectar con Python y dibujar -->
        <script>
            async function procesarArchivo() {
                const fileInput = document.getElementById('fileInput');
                const statusMsg = document.getElementById('status-msg');
                
                if (fileInput.files.length === 0) {
                    statusMsg.innerText = "⚠️ Por favor, selecciona un archivo primero.";
                    return;
                }

                statusMsg.innerText = "⚙️ Procesando datos en la nube...";
                
                // Preparamos el archivo para enviarlo a Python
                const formData = new FormData();
                formData.append("archivo", fileInput.files[0]);

                try {
                    // Enviamos el archivo a nuestra ruta /procesar-excel/
                    const response = await fetch('/procesar-excel/', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await response.json();

                    if (data.estado === "error") {
                        statusMsg.innerText = "❌ Error: " + data.mensaje;
                        return;
                    }

                    statusMsg.innerText = "✅ ¡Tablero generado con éxito!";
                    
                    // Mostrar los paneles ocultos
                    document.getElementById('metrics-panel').style.display = 'flex';
                    document.getElementById('chart-container').style.display = 'block';

                    // Actualizar Métricas
                    document.getElementById('val-inicial').innerText = "$" + data.saldo_inicial.toLocaleString('en-US');
                    document.getElementById('val-deficit').innerText = "$" + data.deficit_maximo.toLocaleString('en-US');

                    // Dibujar el Gráfico con Plotly
                    const trazoAcumulado = {
                        x: data.fechas,
                        y: data.saldo_acumulado,
                        name: 'Saldo Acumulado',
                        type: 'scatter',
                        mode: 'lines+markers',
                        line: {color: '#60a5fa', width: 4},
                        marker: {size: 8, color: '#3b82f6'},
                        fill: 'tozeroy',
                        fillcolor: 'rgba(96, 165, 250, 0.15)'
                    };

                    const trazoDiario = {
                        x: data.fechas,
                        y: data.posicion_dia,
                        name: 'Saldo Diario',
                        type: 'bar',
                        marker: {color: 'rgba(148, 163, 184, 0.4)'}
                    };

                    const layout = {
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        font: {color: '#e2e8f0'},
                        hovermode: 'x unified',
                        xaxis: {showgrid: false},
                        yaxis: {showgrid: true, gridcolor: 'rgba(255,255,255,0.08)'},
                        margin: {l: 40, r: 20, t: 30, b: 40}
                    };

                    Plotly.newPlot('chart-container', [trazoAcumulado, trazoDiario], layout);

                } catch (error) {
                    statusMsg.innerText = "❌ Error de conexión con el servidor.";
                }
            }
        </script>
    </body>
    </html>
    """
    return html_content

# 2. RUTA DE PROCESAMIENTO: El Cerebro Python (Backend)
@app.post("/procesar-excel/")
async def procesar_archivo_excel(archivo: UploadFile = File(...)):
    try:
        contenido = await archivo.read()
        df_raw = pd.read_excel(BytesIO(contenido))
        
        # Limpieza básica
        df_raw.rename(columns={df_raw.columns[0]: "Concepto"}, inplace=True)
        col_concepto = "Concepto"
        df_raw[col_concepto] = df_raw[col_concepto].fillna("").astype(str).replace(['nan', 'None', 'NaN'], '')
        df_raw['concepto_norm'] = df_raw[col_concepto].apply(normalizar_concepto)
        
        # Extraer fechas válidas (simulado para las primeras 10 columnas para esta prueba)
        cols_fechas = [col for col in df_raw.columns if col not in [col_concepto, 'concepto_norm']][:15]
        fechas_str = [str(col).split(" ")[0] for col in cols_fechas]
        
        for col in cols_fechas:
            df_raw[col] = df_raw[col].apply(limpiar_valor_moneda)
            
        # Extraer filas clave
        row_saldo_acum = df_raw[df_raw['concepto_norm'].str.contains("saldoacumulado", na=False)]
        row_posicion_dia = df_raw[df_raw['concepto_norm'].str.contains("posiciondeldia", na=False)]
        row_saldo_ini = df_raw[df_raw['concepto_norm'].str.contains("saldoinicial", na=False)]
        
        arr_saldo_acum = row_saldo_acum[cols_fechas].values[0].tolist() if not row_saldo_acum.empty else [0]*len(cols_fechas)
        arr_posicion_dia = row_posicion_dia[cols_fechas].values[0].tolist() if not row_posicion_dia.empty else [0]*len(cols_fechas)
        val_saldo_ini = row_saldo_ini[cols_fechas[0]].values[0] if not row_saldo_ini.empty else 0.0
        
        min_saldo = min(arr_saldo_acum) if arr_saldo_acum else 0
        deficit_maximo = min_saldo if min_saldo < 0 else 0
        
        # Devolvemos un diccionario JSON limpio a JavaScript
        return {
            "estado": "éxito",
            "fechas": fechas_str,
            "saldo_acumulado": arr_saldo_acum,
            "posicion_dia": arr_posicion_dia,
            "saldo_inicial": val_saldo_ini,
            "deficit_maximo": deficit_maximo
        }
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}
