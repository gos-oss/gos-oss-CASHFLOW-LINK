from fastapi import FastAPI, UploadFile, File
import pandas as pd
from io import BytesIO

# Inicializamos la aplicación FastAPI
app = FastAPI()

@app.get("/")
def ruta_principal():
    """Esta es la página de inicio de nuestra API en Vercel."""
    return {"mensaje": "¡El servidor de Cashflow Link está funcionando en Vercel!"}

@app.post("/procesar-excel/")
async def procesar_archivo_excel(archivo: UploadFile = File(...)):
    """Esta función recibe el Excel desde la web y usa Pandas para leerlo."""
    try:
        # Leemos el contenido del archivo subido
        contenido = await archivo.read()
        
        # Usamos Pandas para leer el Excel directamente desde la memoria
        df = pd.read_excel(BytesIO(contenido))
        
        # Devolvemos un resumen para confirmar que funcionó
        filas = len(df)
        columnas = len(df.columns)
        
        return {
            "estado": "éxito",
            "mensaje": f"Archivo '{archivo.filename}' procesado correctamente.",
            "detalles": f"El archivo tiene {filas} filas y {columnas} columnas."
        }
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}
