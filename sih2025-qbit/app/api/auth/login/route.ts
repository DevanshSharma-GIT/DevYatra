import { NextResponse } from "next/server"
import { createSessionToken, validateCredentials } from "@/lib/auth"

export async function POST(request: Request) {
  const { email, password, role } = await request.json()

  if (!email || !password || !role) {
    return NextResponse.json({ success: false, message: "Missing credentials" }, { status: 400 })
  }

  const user = validateCredentials({ email, password, role })
  if (!user) {
    return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
  }

  const response = NextResponse.json({
    success: true,
    redirectTo: "/preferences?from=/chatbot",
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  })

  response.cookies.set({
    name: "heritedge-session",
    value: createSessionToken(user),
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return response
}
