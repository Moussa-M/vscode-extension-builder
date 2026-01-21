import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Using Hugging Face's free inference API with Stable Diffusion
    const response = await fetch("https://router.huggingface.co/nscale/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.HF_TOKEN}`
      },
      body: JSON.stringify({
        prompt: `${prompt}, simple icon, flat design, logo style, minimalist, clean background, vector art, professional`,
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        parameters: {
          negative_prompt: "text, words, letters, watermark, signature, complex, detailed, photorealistic, 3d render",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: 512,
          height: 512,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Hugging Face API error:", errorText)
      
      // Check if it's a rate limit or loading error
      if (response.status === 503) {
        return NextResponse.json(
          { error: "Model is loading. Please try again in a few seconds." },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to generate image: ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the image buffer
    const imageBuffer = await response.arrayBuffer()
    
    // Convert to base64 data URL
    const base64 = Buffer.from(imageBuffer).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`

    return NextResponse.json({ dataUrl })
  } catch (error) {
    console.error("[v0] Error generating AI logo:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate logo" },
      { status: 500 }
    )
  }
}
