from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse, Response
import httpx
from urllib.parse import quote

app = FastAPI(title="Image Generation API")

@app.get("/")
async def root():
    return JSONResponse(
        content={
            "status_code": 400,
            "message": "The prompt parameter is required to generate the image",
            "developer": "El Impaciente",
            "telegram_channel": "https://t.me/Apisimpacientes"
        },
        status_code=400
    )

@app.get("/generate")
async def generate_image(prompt: str = ""):
    # Validate that prompt is not empty
    if not prompt or prompt.strip() == "":
        return JSONResponse(
            content={
                "status_code": 400,
                "message": "The prompt parameter is required to generate the image",
                "developer": "El Impaciente",
                "telegram_channel": "https://t.me/Apisimpacientes"
            },
            status_code=400
        )
    
    try:
        # Fixed configuration with flux-realism
        model = "flux-realism"
        width = 1024
        height = 1024
        
        # Encode prompt for URL
        encoded_prompt = quote(prompt)
        
        # Build Pollinations URL
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?model={model}&width={width}&height={height}&nologo=true"
        
        # Download the image
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url)
            
            if response.status_code != 200:
                return JSONResponse(
                    content={
                        "status_code": 400,
                        "message": "Error generating the image. Try with another prompt.",
                        "developer": "El Impaciente",
                        "telegram_channel": "https://t.me/Apisimpacientes"
                    },
                    status_code=400
                )
            
            # Return the image directly
            from fastapi.responses import Response
            return Response(
                content=response.content,
                media_type="image/png",
                headers={
                    "Content-Disposition": "inline; filename=generated_image.png"
                }
            )
        
    except httpx.TimeoutException:
        return JSONResponse(
            content={
                "status_code": 400,
                "message": "Request timeout. Please try again.",
                "developer": "El Impaciente",
                "telegram_channel": "https://t.me/Apisimpacientes"
            },
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            content={
                "status_code": 400,
                "message": "Error generating the image. Please try again.",
                "developer": "El Impaciente",
                "telegram_channel": "https://t.me/Apisimpacientes"
            },
            status_code=400
        )

@app.get("/image")
async def get_image_direct(prompt: str = ""):
    """Endpoint that redirects directly to the image"""
    if not prompt or prompt.strip() == "":
        return JSONResponse(
            content={
                "status_code": 400,
                "message": "The prompt parameter is required",
                "developer": "El Impaciente",
                "telegram_channel": "https://t.me/Apisimpacientes"
            },
            status_code=400
        )
    
    # Encode and redirect directly to the image
    encoded_prompt = quote(prompt)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux-realism&width=1024&height=1024&nologo=true"
    
    return RedirectResponse(url=image_url)

# To run: uvicorn main:app --reload
