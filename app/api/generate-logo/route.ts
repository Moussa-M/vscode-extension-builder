/**
 * API Route: /api/generate-logo
 *
 * Generates extension logos using Hugging Face's Stable Diffusion XL model.
 *
 * Free Tier Limitations:
 * - First request may take 20-30 seconds (model cold start)
 * - Rate limits apply (429 errors if exceeded)
 * - No guaranteed availability
 *
 * For Better Performance:
 * Add your Hugging Face API token to .env.local:
 * HF_TOKEN=your_huggingface_token_here
 *
 * Get a free token at: https://huggingface.co/settings/tokens
 */
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Enhance prompt for better icon generation
    const enhancedPrompt = `Simple, clean, minimalist icon design. ${prompt}. Flat design, vector style, centered composition, suitable for app icon, no text, no background, professional quality`

    // Use Hugging Face Inference API (free tier)
    // Using stabilityai/stable-diffusion-xl-base-1.0 for better reliability
    const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"

    // Note: Hugging Face Inference API is rate-limited on free tier
    // For production, users should add their own HF_TOKEN as env variable
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Using public inference API (free tier with rate limits)
        // If HF_TOKEN is available in env, use it for better rate limits
        ...(process.env.HF_TOKEN && { Authorization: `Bearer ${process.env.HF_TOKEN}` }),
      },
      body: JSON.stringify({
        inputs: enhancedPrompt,
        parameters: {
          negative_prompt: "text, words, letters, watermark, signature, blurry, low quality, photo, realistic",
          width: 512,
          height: 512,
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
      }),
    })

    if (!response.ok) {
      let errorText = await response.text()
      console.error("[API] Hugging Face API error:", response.status, errorText)

      // Handle model loading errors
      if (response.status === 503) {
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error && errorJson.error.includes("loading")) {
            const estimatedTime = errorJson.estimated_time || 20
            return Response.json(
              {
                error: `Model is loading. Estimated wait time: ${Math.ceil(estimatedTime)} seconds. Please try again shortly.`,
              },
              { status: 503 }
            )
          }
        } catch {
          // Fallback error message
        }

        return Response.json(
          { error: "Model is currently loading. Please try again in 20-30 seconds." },
          { status: 503 }
        )
      }

      // Handle rate limiting
      if (response.status === 429) {
        return Response.json(
          { error: "Rate limit exceeded. Please try again in a few minutes." },
          { status: 429 }
        )
      }

      return Response.json(
        { error: `Image generation failed: ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the image as a blob
    const imageBlob = await response.blob()

    // Validate that we got an image
    if (!imageBlob.type.startsWith("image/")) {
      console.error("[API] Unexpected response type:", imageBlob.type)
      return Response.json(
        { error: "Unexpected response from image generation service" },
        { status: 500 }
      )
    }

    // Convert blob to base64 data URL
    const arrayBuffer = await imageBlob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    const dataUrl = `data:${imageBlob.type};base64,${base64}`

    return Response.json({ dataUrl })
  } catch (error) {
    console.error("[API] Logo generation error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate logo" },
      { status: 500 }
    )
  }
}
