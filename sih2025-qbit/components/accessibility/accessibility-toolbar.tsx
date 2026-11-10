"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Accessibility, BookOpen, Contrast, PanelsTopLeft, TextQuote, Type, Volume2, VolumeX, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"

const TEXT_SCALE_OPTIONS = [
  { label: "Normal", value: "normal" as const },
  { label: "Large", value: "large" as const },
  { label: "XL", value: "xlarge" as const },
]

export function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 16, right: 16 })
  const dragStateRef = useRef<{
    startX: number
    startY: number
    lastX: number
    lastY: number
    hasMoved: boolean
  } | null>(null)
  const ignoreClickRef = useRef(false)
  const {
    highContrast,
    toggleHighContrast,
    textScale,
    setTextScale,
    voiceFeedback,
    toggleVoiceFeedback,
    supportsSpeechSynthesis,
    reducedMotion,
    setReducedMotion,
    announce,
    captionsEnabled,
    toggleCaptions,
    magnificationEnabled,
    toggleMagnification,
    textReaderEnabled,
    toggleTextReader,
  } = useAccessibility()

  const handleToggle = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }
    setIsOpen((prev) => !prev)
    announce(isOpen ? "Accessibility menu collapsed" : "Accessibility menu expanded")
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const storageKey = "heritedge.accessibility.toolbar"
    const stored = window.localStorage.getItem(storageKey)
    let storedPosition: { top: number; right: number; version?: number } | null = null

    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed?.top === "number" && typeof parsed?.right === "number") {
          storedPosition = parsed
        }
      } catch (error) {
        console.warn("Failed to parse toolbar position", error)
      }
    }

    if (storedPosition?.version === 2) {
      setPosition({ top: storedPosition.top, right: storedPosition.right })
      return
    }

    const viewportHeight = window.innerHeight || 0
    const bottomPreferredTop = Math.max(viewportHeight - 240, 16)
    const defaultRight = typeof storedPosition?.right === "number" ? storedPosition.right : 16
    setPosition({ top: bottomPreferredTop, right: defaultRight })

    window.localStorage.setItem(storageKey, JSON.stringify({ top: bottomPreferredTop, right: defaultRight, version: 2 }))
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("heritedge.accessibility.toolbar", JSON.stringify({ ...position, version: 2 }))
  }, [position])

  const clampPosition = useCallback((top: number, right: number) => {
    if (typeof window === "undefined") return { top, right }
    const margin = 12
    const maxTop = Math.max(window.innerHeight - 80, margin)
    const maxRight = Math.max(window.innerWidth - 80, margin)
    return {
      top: Math.min(Math.max(top, margin), maxTop),
      right: Math.min(Math.max(right, margin), maxRight),
    }
  }, [])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      hasMoved: false,
    }
  }, [])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current
      if (!state) return

      const deltaX = event.clientX - state.lastX
      const deltaY = event.clientY - state.lastY

      if (!state.hasMoved) {
        const totalDistance = Math.abs(event.clientX - state.startX) + Math.abs(event.clientY - state.startY)
        if (totalDistance > 4) {
          state.hasMoved = true
          ignoreClickRef.current = true
        }
      }

      if (state.hasMoved) {
        setPosition((prev) => clampPosition(prev.top + deltaY, prev.right - deltaX))
      }

      state.lastX = event.clientX
      state.lastY = event.clientY
    },
    [clampPosition],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current
      event.currentTarget.releasePointerCapture(event.pointerId)

      if (state?.hasMoved) {
        announce("Accessibility button repositioned")
      }

      dragStateRef.current = null
      requestAnimationFrame(() => {
        ignoreClickRef.current = false
      })
    },
    [announce],
  )

  const toolbarStyles = {
    top: `${position.top}px`,
    right: `${position.right}px`,
  }

  return (
    <div
      className="pointer-events-none fixed z-[1100] flex flex-col items-end gap-2"
      style={toolbarStyles}
    >
      <button
        type="button"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        aria-expanded={isOpen}
        aria-controls="accessibility-toolbar-panel"
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-draggable
      >
        <Accessibility className="h-4 w-4" aria-hidden />
        <span>Accessibility</span>
      </button>

      <section
        id="accessibility-toolbar-panel"
        aria-label="Accessibility controls"
        className={cn(
          "pointer-events-auto w-72 overflow-hidden rounded-2xl border border-border bg-background/95 text-sm shadow-xl backdrop-blur transition-all",
          isOpen ? "max-h-[46rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="space-y-4 p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Quick preferences</h2>
            <PanelsTopLeft className="h-4 w-4 text-muted-foreground" aria-hidden />
          </header>

          <div className="space-y-3" role="group" aria-label="Contrast settings">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Contrast className="h-4 w-4" aria-hidden />
                <span>High contrast</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                onClick={toggleHighContrast}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  highContrast ? "border-primary bg-primary/80" : "border-border bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    highContrast ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Improves readability by boosting contrast ratios across the interface.
            </p>
          </div>

          <fieldset className="space-y-3" aria-label="Text size">
            <legend className="flex items-center gap-2 text-sm font-semibold">
              <Type className="h-4 w-4" aria-hidden />
              Text size
            </legend>
            <div className="flex items-center justify-between gap-2">
              {TEXT_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={textScale === option.value}
                  onClick={() => setTextScale(option.value)}
                  className={cn(
                    "flex-1 rounded-full border px-2 py-1.5 text-sm transition",
                    textScale === option.value ? "border-primary bg-primary/10 text-primary" : "border-border",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3" role="group" aria-label="Voice feedback">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {voiceFeedback ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
                <span>Screen narration</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={voiceFeedback}
                onClick={toggleVoiceFeedback}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  voiceFeedback ? "border-primary bg-primary/80" : "border-border bg-muted",
                  !supportsSpeechSynthesis && "opacity-60",
                )}
                disabled={!supportsSpeechSynthesis}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    voiceFeedback ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            {!supportsSpeechSynthesis && (
              <p className="text-xs text-destructive">
                Narration requires a browser with speech synthesis support.
              </p>
            )}
          </div>

          <div className="space-y-3" role="group" aria-label="Screen captions">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TextQuote className="h-4 w-4" aria-hidden />
                <span>Narration captions</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={captionsEnabled}
                onClick={toggleCaptions}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  captionsEnabled ? "border-primary bg-primary/80" : "border-border bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    captionsEnabled ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Show on-screen captions in sync with narration, respecting your selected text size.
            </p>
          </div>

          <div className="space-y-3" role="group" aria-label="Magnification">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" aria-hidden />
                <span>Screen magnifier</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={magnificationEnabled}
                onClick={toggleMagnification}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  magnificationEnabled ? "border-primary bg-primary/80" : "border-border bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    magnificationEnabled ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enable a magnifier to zoom into any region of the screen on demand.
            </p>
          </div>

          <div className="space-y-3" role="group" aria-label="Select to speak">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" aria-hidden />
                <span>Select to speak</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={textReaderEnabled}
                onClick={toggleTextReader}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  textReaderEnabled ? "border-primary bg-primary/80" : "border-border bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    textReaderEnabled ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Activate a floating reader to speak selected text or any block you tap.
            </p>
          </div>

          <div className="space-y-3" role="group" aria-label="Motion preferences">
            <div className="flex items-center justify-between gap-3">
              <span>Reduce motion</span>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion(!reducedMotion)}
                className={cn(
                  "inline-flex h-9 w-16 items-center rounded-full border px-1 transition",
                  reducedMotion ? "border-primary bg-primary/80" : "border-border bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-7 w-7 rounded-full bg-background shadow transition",
                    reducedMotion ? "translate-x-7" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimises animations for motion-sensitive travellers.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
