addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const MODELS = {
  "flux": "flux",
  "magicstudio": "magicstudio",
  "creart-ai": "creart-ai"
}

const DEV_INFO = {
  developer: "El Impaciente",
  telegram_channel: "https://t.me/Apisimpacientes"
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({...data, ...DEV_INFO}), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': status === 200 ? 'no-cache' : undefined
    }
  })
}

function generateClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function createFormData(prompt, api = "magic") {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
  const parts = []
  
  const fields = api === "magic" ? {
    prompt,
    output_format: "bytes",
    user_profile_id: "null",
    anonymous_user_id: crypto.randomUUID(),
    request_timestamp: (Date.now() / 1000).toFixed(3),
    user_is_subscribed: "false",
    client_id: generateClientId()
  } : {
    prompt,
    input_image_type: "text2image",
    input_image_base64: "",
    negative_prompt: "",
    aspect_ratio: "1x1",
    guidance_scale: 9.5
  }

  for (const [key, value] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
  }
  parts.push(`--${boundary}--\r\n`)
  
  return { body: parts.join(''), contentType: `multipart/form-data; boundary=${boundary}` }
}

async function generateImage(prompt, model) {
  const apis = {
    magicstudio: {
      url: "https://ai-api.magicstudio.com/api/ai-art-generator",
      headers: {
        "origin": "https://magicstudio.com",
        "referer": "https://magicstudio.com/ai-art-generator/"
      }
    },
    "creart-ai": {
      url: "https://api.creartai.com/api/v1/text2image",
      headers: {}
    }
  }

  const api = apis[model]
  if (!api) return null

  const formData = createFormData(prompt, model === "magicstudio" ? "magic" : "creart")
  
  const response = await fetch(api.url, {
    method: "POST",
    headers: {
      "Content-Type": formData.contentType,
      "accept": "application/json, text/plain, */*",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...api.headers
    },
    body: formData.body,
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) throw new Error(`API returned status ${response.status}`)
  return await response.arrayBuffer()
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Root path - Welcome message
  if (path === "/" || path === "") {
    return jsonResponse({
      status: 200,
      message: "Welcome to Image Generation API",
      endpoints: {
        models: "/models - Get available models",
        generate: "/generate?prompt=your_text&model=model_name - Generate image",
        image: "/image?prompt=your_text&model=flux - Direct image redirect (flux only)"
      }
    })
  }

  // Get available models
  if (path === "/models") {
    return jsonResponse({
      status: 200,
      available_models: Object.keys(MODELS)
    })
  }

  // Generate image
  if (path === "/generate") {
    if (request.method !== 'GET') {
      return jsonResponse({ status: 400, message: "Only GET requests are allowed" }, 400)
    }

    const prompt = url.searchParams.get("prompt")
    const model = url.searchParams.get("model")

    if (!prompt?.trim() || !model) {
      return jsonResponse({ status: 400, message: "The prompt and model parameters are required" }, 400)
    }

    if (prompt.length > 2000) {
      return jsonResponse({ status: 400, message: "The prompt parameter must be less than 2000 characters" }, 400)
    }

    if (!MODELS[model]) {
      return jsonResponse({ 
        status: 400, 
        message: `Invalid model. Available models: ${Object.keys(MODELS).join(", ")}`
      }, 400)
    }

    try {
      if (model === "flux") {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?model=flux&width=1024&height=1024&nologo=true`
        return Response.redirect(imageUrl, 302)
      }

      const buffer = await generateImage(prompt.trim(), model)
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': buffer.byteLength.toString(),
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return jsonResponse({
        status: 400,
        message: "Error generating the image. Please try again."
      }, 400)
    }
  }

  // Direct image redirect
  if (path === "/image") {
    if (request.method !== 'GET') {
      return jsonResponse({ status: 400, message: "Only GET requests are allowed" }, 400)
    }

    const prompt = url.searchParams.get("prompt")
    const model = url.searchParams.get("model")

    if (!prompt?.trim() || !model) {
      return jsonResponse({ status: 400, message: "The prompt and model parameters are required" }, 400)
    }

    if (model === "flux") {
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?model=flux&width=1024&height=1024&nologo=true`
      return Response.redirect(imageUrl, 302)
    }

    return jsonResponse({ status: 400, message: "Direct image redirect only available for flux model" }, 400)
  }

  // 404 for any other path
  return jsonResponse({ status: 404, message: "Not Found" }, 404)
}
