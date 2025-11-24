addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const MODELS = ["flux", "magicstudio", "creart-ai"]
const DEV_INFO = {
  developer: "El Impaciente",
  telegram_channel: "https://t.me/Apisimpacientes"
}

const jsonRes = (msg, code = 400, extra = {}) => new Response(
  JSON.stringify({ status_code: code, message: msg, ...extra, ...DEV_INFO }), 
  { 
    status: code,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  }
)

const imgRes = (buffer) => new Response(buffer, {
  headers: { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' }
})

function createFormData(prompt, api) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).slice(2)}`
  const fields = api === "magic" ? {
    prompt,
    output_format: "bytes",
    user_profile_id: "null",
    anonymous_user_id: crypto.randomUUID(),
    request_timestamp: (Date.now() / 1000).toFixed(3),
    user_is_subscribed: "false",
    client_id: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  } : {
    prompt,
    input_image_type: "text2image",
    input_image_base64: "",
    negative_prompt: "",
    aspect_ratio: "1x1",
    guidance_scale: 9.5
  }

  const parts = Object.entries(fields).map(([k, v]) => 
    `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
  )
  
  return {
    body: parts.join('') + `--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

async function generateImage(prompt, model) {
  const apis = {
    magicstudio: {
      url: "https://ai-api.magicstudio.com/api/ai-art-generator",
      headers: { origin: "https://magicstudio.com", referer: "https://magicstudio.com/ai-art-generator/" }
    },
    "creart-ai": {
      url: "https://api.creartai.com/api/v1/text2image",
      headers: {}
    }
  }

  const api = apis[model]
  const formData = createFormData(prompt, model === "magicstudio" ? "magic" : "creart")
  
  const res = await fetch(api.url, {
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

  if (!res.ok) throw new Error(`API error ${res.status}`)
  return await res.arrayBuffer()
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === "/" || path === "") {
    return jsonRes("The prompt and model parameters are required", 400, {
      usage: "Use /generate?prompt=your_description&model=model_name or /models to see available models"
    })
  }

  if (path === "/models") {
    return new Response(
      JSON.stringify({ status_code: 200, available_models: MODELS, ...DEV_INFO }), 
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  if (path === "/generate") {
    if (request.method !== 'GET') {
      return jsonRes("Only GET requests are allowed")
    }

    const prompt = url.searchParams.get("prompt")?.trim()
    const model = url.searchParams.get("model")

    if (!prompt || !model) {
      return jsonRes("The prompt and model parameters are required")
    }

    if (prompt.length > 2000) {
      return jsonRes("The prompt parameter must be less than 2000 characters")
    }

    if (!MODELS.includes(model)) {
      return jsonRes(`Invalid model. Available models: ${MODELS.join(", ")}`)
    }

    try {
      if (model === "flux") {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=1024&height=1024&nologo=true`
        return Response.redirect(imageUrl, 302)
      }

      const buffer = await generateImage(prompt, model)
      return imgRes(buffer)
    } catch (error) {
      return jsonRes("Error generating the image. Please try again.")
    }
  }

  if (path === "/image") {
    if (request.method !== 'GET') {
      return jsonRes("Only GET requests are allowed")
    }

    const prompt = url.searchParams.get("prompt")?.trim()
    const model = url.searchParams.get("model")

    if (!prompt || !model) {
      return jsonRes("The prompt and model parameters are required")
    }

    if (model === "flux") {
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=1024&height=1024&nologo=true`
      return Response.redirect(imageUrl, 302)
    }

    return jsonRes("Direct image redirect only available for flux model")
  }

  return jsonRes("Not Found", 404)
}
