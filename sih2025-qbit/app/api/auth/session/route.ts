import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { parseSessionToken } from "@/lib/auth"

export async function GET() {
  const sessionToken = cookies().get("heritedge-session")?.value
  const session = parseSessionToken(sessionToken)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ session })
}
