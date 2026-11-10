import { NextResponse } from "next/server"
import { getApiUrl } from "@/utils/api"

interface TranslateBatchPayload {
  texts: string[]
  target_language_code: string
  source_language_code?: string
}

const MAX_TEXTS_PER_REQUEST = 100

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<TranslateBatchPayload>
    const { texts, target_language_code: targetLanguage, source_language_code: sourceLanguage } = payload

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ success: false, message: "No texts provided for translation" }, { status: 400 })
    }

    if (!targetLanguage) {
      return NextResponse.json({ success: false, message: "Target language is required" }, { status: 400 })
    }

    if (texts.length > MAX_TEXTS_PER_REQUEST) {
      return NextResponse.json(
        { success: false, message: `Cannot translate more than ${MAX_TEXTS_PER_REQUEST} entries at once` },
        { status: 413 },
      )
    }

    const backendResponse = await fetch(getApiUrl("translate-batch"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts,
        target_language_code: targetLanguage,
        source_language_code: sourceLanguage ?? "en-IN",
      }),
      cache: "no-store",
    })

    const responseText = await backendResponse.text()
    let data: unknown
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = { success: false, message: responseText || "Unable to parse translation response" }
    }

    if (!backendResponse.ok) {
      return NextResponse.json(
        typeof data === "object" && data !== null ? data : { success: false, message: "Translation request failed" },
        { status: backendResponse.status },
      )
    }

    return NextResponse.json(data ?? { success: true, translations: [] })
  } catch (error) {
    console.error("/api/translate-batch proxy failed", error)
    const message = error instanceof Error ? error.message : "Unexpected error occurred"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
