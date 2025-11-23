# main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import httpx
import aiofiles
from urllib.parse import quote
import os

app = FastAPI(title="Flux-Realism + Catbox.moe Auto Upload")

# Carpeta temporal (se crea si no existe)
TEMP_DIR = "temp_images"
os.makedirs(TEMP_DIR, exist_ok=True)

async def upload_to_catbox(file_path: str) -> str:
    """Sube un archivo a Catbox.moe y devuelve la URL permanente"""
    url = "https://catbox.moe/user/api.php"
    async with httpx.AsyncClient() as client:
        with open(file_path, "rb") as f:
            files = {"fileToUpload": f}
            data = {"reqtype": "fileupload"}
            response = await client.post(url, data=data, files=files, timeout=300.0)
        if response.status_code == 200:
            return response.text.strip()
        else:
            raise Exception("Error al subir a Catbox")

@app.get("/")
async def root():
    return {"message": "API Flux + Catbox activa", "uso": "/generate?prompt=tu_descripción"}

@app.get("/generate")
async def generate_and_upload(prompt: str = ""):
    if not prompt or prompt.strip() == "":
        raise HTTPException(status_code=400, detail="El parámetro 'prompt' es obligatorio")

    try:
        # Paso 1: Generar imagen con Flux-Realism
        encoded_prompt = quote(prompt)
        image_gen_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux-realism&width=1024&height=1024&nologo=true&safe=0"

        # Descargar la imagen
        temp_path = f"{TEMP_DIR}/{hash(prompt)}.png"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(image_gen_url)
            resp.raise_for_status()
            async with aiofiles.open(temp_path, "wb") as f:
                await f.write(resp.content)

        # Paso 2: Subir a Catbox.moe
        catbox_url = await upload_to_catbox(temp_path)

        # Opcional: borrar temporal (descomenta si quieres ahorrar espacio)
        # os.remove(temp_path)

        return JSONResponse({
            "status_code": 200,
            "message": "Imagen generada y subida a Catbox.moe",
            "prompt": prompt,
            "temporary_generation_url": image_gen_url,
            "permanent_catbox_url": catbox_url,   # ← ESTA ES LA QUE QUERÍAS
            "file_size_kb": round(os.path.getsize(temp_path) / 1024, 1),
            "developer": "El Impaciente + Grok",
            "telegram": "https://t.me/Apisimpacientes"
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Ejecutar con: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
