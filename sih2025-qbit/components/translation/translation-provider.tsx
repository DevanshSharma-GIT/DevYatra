"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"

const SUPPORTED_LANGUAGES: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "mr-IN": "Marathi",
  "bn-IN": "Bengali",
  "gu-IN": "Gujarati",
  "pa-IN": "Punjabi",
  "or-IN": "Odia",
}

const LANGUAGE_STORAGE_KEY = "heritedge.translation.language"

interface TranslationContextValue {
  currentLanguage: string
  isTranslating: boolean
  translateTo: (languageCode: string) => Promise<void>
  languages: { code: string; label: string }[]
}

const TranslationContext = createContext<TranslationContextValue | null>(null)

const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"])

function shouldIncludeTextNode(node: Text) {
  const parentElement = node.parentElement
  if (!parentElement) return false
  if (parentElement.closest("[data-translate-exclude]")) return false
  if (EXCLUDED_TAGS.has(parentElement.tagName)) return false
  const value = node.textContent?.trim()
  return Boolean(value)
}

function syncSnapshotForNode(
  node: Node,
  action: "add" | "remove" | "update",
  snapshot: Map<Text, string>,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text
    if (action === "remove") {
      snapshot.delete(textNode)
      return
    }

    if (!shouldIncludeTextNode(textNode)) {
      snapshot.delete(textNode)
      return
    }

    snapshot.set(textNode, textNode.textContent ?? "")
    return
  }

  if (!(node instanceof Element)) return

  if (action !== "remove" && node.closest("[data-translate-exclude]")) {
    return
  }

  if (EXCLUDED_TAGS.has(node.tagName)) {
    return
  }

  node.childNodes.forEach((child) => syncSnapshotForNode(child, action, snapshot))
}

function createTextNodeSnapshot(root: HTMLElement) {
  const map = new Map<Text, string>()

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT
      const parentElement = node.parentElement
      if (!parentElement) return NodeFilter.FILTER_REJECT
      if (parentElement.closest("[data-translate-exclude]")) return NodeFilter.FILTER_REJECT
      if (EXCLUDED_TAGS.has(parentElement.tagName)) return NodeFilter.FILTER_REJECT
      const value = node.textContent?.trim()
      if (!value) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let current: Text | null = walker.nextNode() as Text | null
  while (current) {
    map.set(current, current.textContent ?? "")
    current = walker.nextNode() as Text | null
  }

  return map
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize))
  }
  return result
}

async function requestTranslations(texts: string[], targetLanguage: string, sourceLanguage: string) {
  const response = await fetch("/api/translate-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts,
      target_language_code: targetLanguage,
      source_language_code: sourceLanguage,
    }),
  })

  if (!response.ok) {
    throw new Error(`Translation failed with status ${response.status}`)
  }

  const data = await response.json()
  if (!data?.success || !Array.isArray(data.translations)) {
    throw new Error("Unexpected translation response")
  }

  return data.translations as string[]
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [currentLanguage, setCurrentLanguage] = useState("en-IN")
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const originalNodesRef = useRef<Map<Text, string>>(new Map())
  const translationsCacheRef = useRef<Map<string, Map<string, string>>>(new Map())
  const isApplyingTranslationsRef = useRef(false)
  const translationObserverRef = useRef<MutationObserver | null>(null)
  const pendingMutationTimeoutRef = useRef<number | null>(null)
  const translationInFlightRef = useRef<Promise<void> | null>(null)
  const { setLanguage: setAccessibilityLanguage } = useAccessibility()

  const restoreOriginalText = useCallback(() => {
    originalNodesRef.current.forEach((value, node) => {
      if (node.textContent !== value) {
        node.textContent = value
      }
    })
  }, [])

  const updateSnapshot = useCallback(() => {
    if (typeof document === "undefined") {
      return originalNodesRef.current
    }
    const snapshot = createTextNodeSnapshot(document.body)
    originalNodesRef.current = snapshot
    return snapshot
  }, [])

  useEffect(() => {
    return () => {
      restoreOriginalText()
    }
  }, [restoreOriginalText])

  const applyTranslations = useCallback((map: Map<string, string>) => {
    if (isApplyingTranslationsRef.current) return
    isApplyingTranslationsRef.current = true
    try {
      originalNodesRef.current.forEach((originalValue, node) => {
        const translatedValue = map.get(originalValue)
        if (translatedValue && node.textContent !== translatedValue) {
          node.textContent = translatedValue
        }
      })
    } finally {
      isApplyingTranslationsRef.current = false
    }
  }, [])

  const ensureTranslations = useCallback(
    async (languageCode: string, { forceSnapshot = false }: { forceSnapshot?: boolean } = {}) => {
      if (typeof document === "undefined") return

      if (languageCode === "en-IN") {
        updateSnapshot()
        return
      }

      if (translationInFlightRef.current) {
        try {
          await translationInFlightRef.current
        } catch (error) {
          console.error("Pending translation failed", error)
        }
      }

      const snapshot = forceSnapshot || originalNodesRef.current.size === 0 ? updateSnapshot() : originalNodesRef.current
      let cache = translationsCacheRef.current.get(languageCode)
      if (!cache) {
        cache = new Map<string, string>()
        translationsCacheRef.current.set(languageCode, cache)
      }

      const uniqueOriginals = Array.from(new Set(Array.from(snapshot.values()))).filter(Boolean)
      const missingOriginals = uniqueOriginals.filter((text) => !cache!.has(text))

      if (missingOriginals.length > 0) {
        const runTranslation = async () => {
          const chunks = chunkArray(missingOriginals, 20)
          for (const chunk of chunks) {
            const translations = await requestTranslations(chunk, languageCode, "en-IN")
            chunk.forEach((original, index) => {
              cache!.set(original, translations[index] ?? original)
            })
          }
        }

        const promise = runTranslation().finally(() => {
          if (translationInFlightRef.current === promise) {
            translationInFlightRef.current = null
          }
        })

        translationInFlightRef.current = promise
        await promise
      }

      applyTranslations(cache)
    },
    [applyTranslations, updateSnapshot],
  )

  const translateTo = useCallback(
    async (languageCode: string) => {
      if (languageCode === currentLanguage && languageCode !== "en-IN") {
        setIsTranslating(true)
        setPendingLanguage(languageCode)
        try {
          await ensureTranslations(languageCode)
          setPendingLanguage(null)
        } catch (error) {
          console.error("Failed to reapply translations", error)
        } finally {
          setIsTranslating(false)
        }
        return
      }
      if (typeof document === "undefined") return

      if (languageCode === "en-IN") {
        restoreOriginalText()
        updateSnapshot()
        setCurrentLanguage("en-IN")
        setPendingLanguage(null)
        return
      }

      setIsTranslating(true)
      setPendingLanguage(languageCode)
      try {
        await ensureTranslations(languageCode, { forceSnapshot: true })
        setCurrentLanguage(languageCode)
        setPendingLanguage(null)
      } catch (error) {
        console.error("Failed to translate page", error)
      } finally {
        setIsTranslating(false)
      }
    },
    [currentLanguage, ensureTranslations, restoreOriginalText, updateSnapshot],
  )

  useEffect(() => {
    if (typeof document === "undefined") return

    restoreOriginalText()
    updateSnapshot()

    if (currentLanguage !== "en-IN") {
      ensureTranslations(currentLanguage, { forceSnapshot: true }).catch((error) => {
        console.error("Failed to translate new route", error)
      })
    }
  }, [currentLanguage, ensureTranslations, pathname, restoreOriginalText, updateSnapshot])

  useEffect(() => {
    const rootLanguageCode = currentLanguage
    const accessibilityLanguage = rootLanguageCode.split("-")[0] || rootLanguageCode
    setAccessibilityLanguage(accessibilityLanguage)
    if (typeof document !== "undefined") {
      document.documentElement.lang = rootLanguageCode
    }
  }, [currentLanguage, setAccessibilityLanguage])

  const value = useMemo<TranslationContextValue>(
    () => ({
      currentLanguage,
      isTranslating,
      translateTo,
      languages: Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => ({ code, label })),
    }),
    [currentLanguage, isTranslating, translateTo],
  )

  useEffect(() => {
    if (typeof document === "undefined") return

    if (currentLanguage === "en-IN") {
      restoreOriginalText()
      updateSnapshot()
      return
    }

    updateSnapshot()
    ensureTranslations(currentLanguage).catch((error) => {
      console.error("Failed to reapply translations", error)
    })
  }, [currentLanguage, ensureTranslations, restoreOriginalText, updateSnapshot])

  useEffect(() => {
    if (typeof document === "undefined") return

    translationObserverRef.current?.disconnect()
    translationObserverRef.current = null

    const language = currentLanguage
    if (language === "en-IN") {
      return
    }

    const observer = new MutationObserver((mutations) => {
      if (isApplyingTranslationsRef.current) {
        return
      }

      const snapshot = originalNodesRef.current

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.removedNodes.forEach((node) => syncSnapshotForNode(node, "remove", snapshot))
          mutation.addedNodes.forEach((node) => syncSnapshotForNode(node, "add", snapshot))
        } else if (mutation.type === "characterData") {
          syncSnapshotForNode(mutation.target, "update", snapshot)
        }
      })

      if (pendingMutationTimeoutRef.current) {
        window.clearTimeout(pendingMutationTimeoutRef.current)
      }

      pendingMutationTimeoutRef.current = window.setTimeout(() => {
        pendingMutationTimeoutRef.current = null

        ensureTranslations(language).catch((error) => console.error("Live translation failed", error))
      }, 16)
    })

    observer.observe(document.body, { childList: true, characterData: true, subtree: true })
    translationObserverRef.current = observer

    return () => {
      if (pendingMutationTimeoutRef.current) {
        window.clearTimeout(pendingMutationTimeoutRef.current)
        pendingMutationTimeoutRef.current = null
      }
      observer.disconnect()
      if (translationObserverRef.current === observer) {
        translationObserverRef.current = null
      }
    }
  }, [currentLanguage, ensureTranslations])

  useEffect(() => {
    if (typeof window === "undefined") return

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored && stored !== "en-IN" && stored !== currentLanguage && stored in SUPPORTED_LANGUAGES) {
      setCurrentLanguage(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage)
  }, [currentLanguage])

  return (
    <TranslationContext.Provider value={value}>
      {children}
      {isTranslating && (
        <div
          data-translate-exclude
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="rounded-2xl bg-white px-6 py-4 text-center shadow-xl">
            <p className="text-sm font-medium text-stone-700">
              Converting to {SUPPORTED_LANGUAGES[pendingLanguage ?? currentLanguage] ?? "selected language"}…
            </p>
            <p className="mt-1 text-xs text-stone-500">Please hold on while we localise the experience.</p>
          </div>
        </div>
      )}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}
