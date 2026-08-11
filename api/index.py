from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
import pandas as pd
from io import BytesIO

# Inicializamos la aplicación
app = FastAPI()

# 1. RUTA PRINCIPAL: Devuelve la interfaz visual (Frontend HTML/CSS)
@app.get("/", response_class=HTMLResponse)
def ruta_principal():
    html_content = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Cashflow Link | Executive Board</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            body {
                background: radial-gradient(circle at 50% 0%, #1e3a8a 0%, #0f172a 100%);
                color: #f8fafc;
                font-family: 'Inter', sans-serif;
                text-align: center;
                height: 100vh;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .corporate-banner {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 40px 60px;
                border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
            }
            h1 {
                font-size: 2.5rem;
                font-weight: 800;
                margin-bottom: 5px;
            }
            p {
                color: #93c5fd;
                margin-bottom: 30px;
            }
            input[type="file"] {
                padding: 10px;
                margin-bottom: 20px;
                color: white;
            }
            button {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 1.1rem;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            button:hover {
                transform: scale(1.05);
            }
        </style>
    </head>
    <body>
        <div class="corporate-banner">
            <h1>CASHFLOW LINK</h1>
            <p>Executive Board • Módulo de Procesamiento en Vercel</p>
            
            <!-- Formulario que envía el archivo a la ruta de procesamiento -->
            <form action="/procesar-excel/" method="post" enctype="multipart/form-data">
                <input type="file" name="archivo" accept=".xlsx" required><br>
                <button type="submit">Subir Excel y Analizar</button>
            </form>
        </div>
    </body>
    </html>
    """
    return html_content

# 2. RUTA DE PROCESAMIENTO: Recibe el Excel y lo lee con Pandas (Backend)
@app.post("/procesar-excel/")
async def procesar_archivo_excel(archivo: UploadFile = File(...)):
    try:
        contenido = await archivo.read()
        df = pd.read_excel(BytesIO(contenido))
        filas = len(df)
        columnas = len(df.columns)
        
        return {
            "estado": "éxito",
            "mensaje": f"Archivo '{archivo.filename}' procesado correctamente en Vercel.",
            "detalles": f"El archivo tiene {filas} filas y {columnas} columnas. Pandas está listo para calcular proyecciones."
        }
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}
