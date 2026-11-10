import "./globals.css"
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AccessibilityProvider } from "@/components/accessibility/accessibility-provider"
import { AccessibilityToolbar } from "@/components/accessibility/accessibility-toolbar"
import { EmergencyAssistButton } from "@/components/accessibility/emergency-assist-button"
import { AccessibilityObserver } from "@/components/accessibility/accessibility-observer"
import { AccessibilityCaptions } from "@/components/accessibility/accessibility-captions"
import { AccessibilityMagnifier } from "@/components/accessibility/accessibility-magnifier"
import { AccessibilityTextReader } from "@/components/accessibility/accessibility-text-reader"
import { TranslationProvider } from "@/components/translation/translation-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DevYatra - Cultural Travel Platform",
  description: "Discover and explore cultural heritage sites around the world",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>
          <AccessibilityProvider>
            <TranslationProvider>
              <AccessibilityObserver />
              <AccessibilityToolbar />
              <AccessibilityCaptions />
              <AccessibilityMagnifier />
              <AccessibilityTextReader />
              <div id="app-magnify-target" className="relative min-h-screen">
                <div
                  id="main-content"
                  role="main"
                  tabIndex={-1}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {children}
                </div>
              </div>
              <EmergencyAssistButton />
            </TranslationProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
