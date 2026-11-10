"use client"

import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react"
import { ZoomIn, X } from "lucide-react"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"
import { cn } from "@/lib/utils"

const MAGNIFY_SCALE = 2.2

export function AccessibilityMagnifier() {
  const { magnificationEnabled, textScale, announce } = useAccessibility()
  const [isZoomed, setIsZoomed] = useState(false)
  const [overlayActive, setOverlayActive] = useState(false)

  const sizeClass = useMemo(() => {
    if (textScale === "large") return "text-base md:text-lg"
    if (textScale === "xlarge") return "text-lg md:text-xl"
    return "text-sm md:text-base"
  }, [textScale])

  const setMagnifyState = useCallback((state: "selecting" | "zoom" | null) => {
    if (typeof document === "undefined") return
    if (!state) {
      document.documentElement.removeAttribute("data-magnify-state")
      document.documentElement.style.removeProperty("--magnify-origin-x")
      document.documentElement.style.removeProperty("--magnify-origin-y")
      document.documentElement.style.removeProperty("--magnify-scale")
      return
    }
    document.documentElement.setAttribute("data-magnify-state", state)
  }, [])

  const resetMagnifier = useCallback(
    (announceMessage = "Magnification reset") => {
      setOverlayActive(false)
      setIsZoomed(false)
      setMagnifyState(null)
      if (announceMessage) {
        announce(announceMessage)
      }
    },
    [announce, setMagnifyState],
  )

  const applyMagnification = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const xPercent = Math.min(Math.max((clientX / viewportWidth) * 100, 0), 100)
      const yPercent = Math.min(Math.max((clientY / viewportHeight) * 100, 0), 100)

      document.documentElement.style.setProperty("--magnify-origin-x", `${xPercent}%`)
      document.documentElement.style.setProperty("--magnify-origin-y", `${yPercent}%`)
      document.documentElement.style.setProperty("--magnify-scale", `${MAGNIFY_SCALE}`)
      setMagnifyState("zoom")
      setIsZoomed(true)
      setOverlayActive(false)
      announce("Area magnified")
    },
    [announce, setMagnifyState],
  )

  const handleOverlayClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      applyMagnification(event.clientX, event.clientY)
    },
    [applyMagnification],
  )

  const handleToggle = useCallback(() => {
    if (!magnificationEnabled) return
    if (isZoomed) {
      resetMagnifier()
      return
    }
    setOverlayActive((prev) => {
      const next = !prev
      setMagnifyState(next ? "selecting" : null)
      if (next) {
        announce("Magnifier armed. Tap or click anywhere to zoom in.")
      } else {
        announce("Magnifier cancelled")
      }
      return next
    })
  }, [announce, isZoomed, magnificationEnabled, resetMagnifier, setMagnifyState])

  useEffect(() => {
    if (!magnificationEnabled) {
      if (isZoomed || overlayActive) {
        resetMagnifier("")
      } else {
        setMagnifyState(null)
      }
      return
    }
  }, [overlayActive, isZoomed, magnificationEnabled, resetMagnifier, setMagnifyState])

  useEffect(() => {
    if (!magnificationEnabled) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (overlayActive || isZoomed) {
          event.preventDefault()
          resetMagnifier("Magnifier dismissed")
        }
      }
    }
    window.addEventListener("keydown", handleKey, { capture: true })
    return () => window.removeEventListener("keydown", handleKey, { capture: true })
  }, [overlayActive, isZoomed, magnificationEnabled, resetMagnifier])

  useEffect(() => {
    return () => {
      setMagnifyState(null)
    }
  }, [setMagnifyState])

  if (!magnificationEnabled) {
    return null
  }

  return (
    <>
      <div className="pointer-events-none fixed top-1/2 right-4 z-[1150] -translate-y-1/2">
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-3 shadow-lg backdrop-blur",
            "transition hover:border-primary/80 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60",
            overlayActive || isZoomed ? "border-primary/80 shadow-primary/30" : "",
          )}
          onClick={handleToggle}
          aria-pressed={overlayActive || isZoomed}
          aria-label={isZoomed ? "Reset magnifier" : overlayActive ? "Cancel magnifier" : "Activate magnifier"}
        >
          <ZoomIn className="h-5 w-5" aria-hidden />
          <span className={cn("font-medium", sizeClass)}>{isZoomed ? "Reset" : overlayActive ? "Cancel" : "Magnify"}</span>
        </button>
      </div>

      {overlayActive ? (
        <div onClick={handleOverlayClick} className="fixed inset-0 z-[1140] cursor-crosshair">
          <div className="pointer-events-none absolute inset-3 rounded-[24px] border-[5px] border-yellow-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
          <div
            className={cn(
              "pointer-events-none absolute bottom-12 left-1/2 w-[min(90vw,420px)] -translate-x-1/2 rounded-2xl border border-primary/40 bg-background/95 px-6 py-4 text-center shadow-xl backdrop-blur",
              sizeClass,
            )}
          >
            <p className="font-semibold text-foreground/90">Tap anywhere to magnify</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your view stays visible; highlighted borders show the active window. Press Escape to cancel.
            </p>
          </div>
        </div>
      ) : null}

      {isZoomed ? (
        <div className="pointer-events-none fixed inset-0 z-[1140] flex items-start justify-center">
          <div className="pointer-events-auto mt-6 flex items-center gap-3 rounded-full border border-border/80 bg-background/95 px-4 py-2 shadow-lg">
            <span className={cn("font-medium text-foreground/90", sizeClass)}>Magnified view active</span>
            <button
              type="button"
              onClick={() => resetMagnifier("Magnifier closed")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
            >
              <X className="h-4 w-4" aria-hidden />
              Exit
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
