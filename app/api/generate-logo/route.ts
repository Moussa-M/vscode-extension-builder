import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Check for HF_TOKEN
    if (!process.env.HF_TOKEN) {
      return NextResponse.json(
        { error: "HF_TOKEN environment variable not set. Please add your Hugging Face token." },
        { status: 500 }
      )
    }

    // Using Hugging Face's router API with b64_json format
    const response = await fetch("https://router.huggingface.co/nscale/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        prompt: `${prompt}, simple icon, flat design, logo style, minimalist, clean background, vector art, professional`,
        response_format: "b64_json",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[App] Hugging Face API error:", response.status, errorText)
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Invalid Hugging Face token. Please check your HF_TOKEN is correct." },
          { status: 401 }
        )
      }
      
      if (response.status === 503) {
        return NextResponse.json(
          { error: "Model is loading. Please try again in 10-20 seconds." },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to generate image: ${response.statusText}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log("[App] HF API response structure:", Object.keys(result))
    
    // Handle b64_json response format
    const base64Image = result.data?.[0]?.b64_json || result.images?.[0]
    
    if (!base64Image) {
      console.error("[App] No image data in response:", result)
      throw new Error("No image data returned from API")
    }
    
    const dataUrl = `data:image/png;base64,${base64Image}`

    return NextResponse.json({ dataUrl })
  } catch (error) {
    console.error("[App] Error generating AI logo:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate logo" },
      { status: 500 }
    )
  }
}
