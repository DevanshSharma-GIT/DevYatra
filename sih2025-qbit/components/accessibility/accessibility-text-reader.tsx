"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpenCheck, Ban } from "lucide-react"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"
import { cn } from "@/lib/utils"

function cleanReaderText(text: string | null | undefined): string {
  if (!text) return ""
  return text.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim()
}

function findReadableElement(target: HTMLElement | null): HTMLElement | null {
  if (!target) return null
  const root = document.getElementById("app-magnify-target")
  let node: HTMLElement | null = target

  while (node) {
    if (node === root) {
      const rootText = cleanReaderText(node.innerText ?? node.textContent ?? "")
      if (rootText.length > 0) {
        return node
      }
      return null
    }

    if (node.dataset.readerExclude === "true") {
      node = node.parentElement
      continue
    }

    const text = cleanReaderText(node.innerText ?? node.textContent ?? "")
    if (text.length > 0 && text.length <= 4000) {
      return node
    }

    node = node.parentElement
  }

  return null
}

function prepareSpeechText(raw: string): { content: string; truncated: boolean } {
  const maxLength = 1600
  if (raw.length <= maxLength) {
    return { content: raw, truncated: false }
  }
  const trimmed = raw.slice(0, maxLength - 40)
  return { content: `${trimmed} … Additional content truncated.`, truncated: true }
}

function setReaderState(state: "armed" | null) {
  if (typeof document === "undefined") return
  if (!state) {
    document.documentElement.removeAttribute("data-reader-state")
    return
  }
  document.documentElement.setAttribute("data-reader-state", state)
}

export function AccessibilityTextReader() {
  const { textReaderEnabled, textScale, speak, announce } = useAccessibility()
  const [armed, setArmed] = useState(false)
  const suppressNextActivationRef = useMemo(() => ({ value: false }), [])

  const sizeClass = useMemo(() => {
    if (textScale === "large") return "text-base md:text-lg"
    if (textScale === "xlarge") return "text-lg md:text-xl"
    return "text-sm md:text-base"
  }, [textScale])

  useEffect(() => {
    if (!textReaderEnabled) {
      setArmed(false)
      setReaderState(null)
    }
  }, [textReaderEnabled])

  useEffect(() => {
    if (!armed) {
      setReaderState(null)
      return
    }
    setReaderState("armed")
    return () => {
      setReaderState(null)
    }
  }, [armed])

  const readContent = useCallback(
    (text: string) => {
      const cleaned = cleanReaderText(text)
      if (!cleaned) {
        announce("No readable text found at that location.", { politeness: "assertive" })
        return
      }
      const { content } = prepareSpeechText(cleaned)
      speak(content, { force: true, interrupt: true })
    },
    [announce, speak],
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (!armed) return
      const root = document.getElementById("app-magnify-target")
      if (!root || !root.contains(event.target as Node)) return

      window.setTimeout(() => {
        const selection = window.getSelection()
        const selectedText = cleanReaderText(selection?.toString())
        if (selectedText) {
          suppressNextActivationRef.value = true
          window.dispatchEvent(
            new CustomEvent("heritedge:skip-activation", {
              detail: { reason: "text-selection" },
            }),
          )
          readContent(selectedText)
          selection?.removeAllRanges()
          return
        }

        const target = event.target as HTMLElement | null
        const element = findReadableElement(target)
        if (!element) {
          announce("Tap on text or highlight a passage to hear it.", { politeness: "assertive" })
          return
        }

        const text = cleanReaderText(element.innerText ?? element.textContent ?? "")
        readContent(text)
      }, 24)
    },
    [announce, armed, readContent, suppressNextActivationRef],
  )

  useEffect(() => {
    if (!armed) return
    document.addEventListener("pointerup", handlePointerUp, true)
    return () => document.removeEventListener("pointerup", handlePointerUp, true)
  }, [armed, handlePointerUp])

  useEffect(() => {
    if (!armed) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setArmed(false)
        setReaderState(null)
        announce("Select to speak cancelled")
      }
    }

    window.addEventListener("keydown", handleKey, true)
    return () => window.removeEventListener("keydown", handleKey, true)
  }, [announce, armed])

  useEffect(() => {
    return () => {
      setReaderState(null)
    }
  }, [])

  if (!textReaderEnabled) {
    return null
  }

  const handleToggle = () => {
    setArmed((prev) => {
      const next = !prev
      if (next) {
        announce("Select to speak ready. Highlight or tap content to hear it.")
      } else {
        announce("Select to speak cancelled")
        setReaderState(null)
      }
      return next
    })
  }

  return (
    <>
      <div className="pointer-events-none fixed right-4 z-[1150]" style={{ top: "calc(50% + 7rem)" }}>
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-3 shadow-lg backdrop-blur",
            "transition hover:border-primary/80 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60",
            armed ? "border-emerald-500/80 shadow-emerald-400/40" : "",
          )}
          onClick={handleToggle}
          aria-pressed={armed}
          aria-label={armed ? "Cancel select to speak" : "Activate select to speak"}
        >
          {armed ? <Ban className="h-5 w-5" aria-hidden /> : <BookOpenCheck className="h-5 w-5" aria-hidden />}
          <span className={cn("font-medium", sizeClass)}>{armed ? "Cancel" : "Read"}</span>
        </button>
      </div>

      {armed ? (
        <div className="pointer-events-none fixed bottom-12 left-1/2 z-[1140] w-[min(90vw,420px)] -translate-x-1/2">
          <div
            className={cn(
              "rounded-2xl border border-emerald-400/60 bg-background/95 px-6 py-4 text-center shadow-xl backdrop-blur",
              sizeClass,
            )}
          >
            <p className="font-semibold text-foreground/90">Select text or tap a block to hear it.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag to highlight a passage or tap once to read the entire section. Press Escape to cancel.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
