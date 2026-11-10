"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "heritedge.accessibility.settings"

const AVAILABLE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
]

type TextScale = "normal" | "large" | "xlarge"

type AccessibilityState = {
  highContrast: boolean
  textScale: TextScale
  voiceFeedback: boolean
  language: string
  reducedMotion: boolean
  captionsEnabled: boolean
  magnificationEnabled: boolean
  textReaderEnabled: boolean
}

type SpeakOptions = {
  lang?: string
  interrupt?: boolean
  rate?: number
  pitch?: number
  skipCaption?: boolean
  force?: boolean
}

type AnnounceOptions = {
  politeness?: "polite" | "assertive"
  lang?: string
  interrupt?: boolean
}

type AccessibilityContextValue = AccessibilityState & {
  availableLanguages: typeof AVAILABLE_LANGUAGES
  supportsSpeechSynthesis: boolean
  toggleHighContrast: () => void
  setTextScale: (scale: TextScale) => void
  toggleVoiceFeedback: () => void
  toggleCaptions: () => void
  toggleMagnification: () => void
  toggleTextReader: () => void
  setLanguage: (language: string) => void
  setReducedMotion: (value: boolean) => void
  speak: (message: string, options?: SpeakOptions) => void
  announce: (message: string, options?: AnnounceOptions) => void
  triggerHaptic: (pattern?: number | number[]) => void
  activeCaption: { id: number; message: string } | null
  clearCaption: () => void
}

const defaultState: AccessibilityState = {
  highContrast: false,
  textScale: "normal",
  voiceFeedback: false,
  language: "en",
  reducedMotion: false,
  captionsEnabled: false,
  magnificationEnabled: false,
  textReaderEnabled: false,
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(defaultState)
  const [supportsSpeechSynthesis, setSupportsSpeechSynthesis] = useState(false)
  const [announcement, setAnnouncement] = useState<{ id: number; message: string } | null>(null)
  const [liveRegionPoliteness, setLiveRegionPoliteness] = useState<"polite" | "assertive">("polite")
  const [captionEntry, setCaptionEntry] = useState<{ id: number; message: string } | null>(null)
  const hasHydratedRef = useRef(false)
  const voiceFeedbackEnabledRef = useRef(defaultState.voiceFeedback)
  const captionsEnabledRef = useRef(defaultState.captionsEnabled)
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hydrateFromStorage = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<AccessibilityState>
      setState((prev) => ({
        ...prev,
        ...parsed,
      }))
    } catch (error) {
      console.warn("Failed to parse accessibility settings", error)
    }
  }, [])

  const recordCaption = useCallback((message: string) => {
    if (!message) return
    setCaptionEntry({ id: Date.now(), message })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    setSupportsSpeechSynthesis("speechSynthesis" in window)

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setState((prev) => ({ ...prev, reducedMotion: reduceMotionQuery.matches }))

    const handleMotionChange = (event: MediaQueryListEvent) => {
      setState((prev) => ({ ...prev, reducedMotion: event.matches }))
    }
    reduceMotionQuery.addEventListener("change", handleMotionChange)

    hydrateFromStorage()
    hasHydratedRef.current = true

    return () => {
      reduceMotionQuery.removeEventListener("change", handleMotionChange)
    }
  }, [hydrateFromStorage])

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    root.dataset.highContrast = state.highContrast ? "true" : "false"
    root.dataset.textScale = state.textScale
    root.dataset.reducedMotion = state.reducedMotion ? "true" : "false"
    root.lang = state.language
  }, [state.highContrast, state.language, state.reducedMotion, state.textScale])

  useEffect(() => {
    if (!hasHydratedRef.current || typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const speak = useCallback(
    (message: string, options?: SpeakOptions) => {
      if (typeof window === "undefined") return
      if (!message) return
      if (captionsEnabledRef.current && !options?.skipCaption) {
        recordCaption(message)
      }
  if (!supportsSpeechSynthesis) return
  if (!voiceFeedbackEnabledRef.current && !options?.force) return

      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = options?.lang ?? state.language ?? "en"
      utterance.rate = options?.rate ?? 1
      utterance.pitch = options?.pitch ?? 1

      if (options?.interrupt ?? true) {
        window.speechSynthesis.cancel()
      }

      window.speechSynthesis.speak(utterance)
    },
    [recordCaption, state.language, supportsSpeechSynthesis],
  )

  const announce = useCallback(
    (message: string, options?: AnnounceOptions) => {
      if (!message) return
      setLiveRegionPoliteness(options?.politeness ?? "polite")
      setAnnouncement({ id: Date.now(), message })
      speak(message, { ...options, interrupt: options?.interrupt ?? false })
    },
    [speak],
  )

  useEffect(() => {
    if (!announcementTimerRef.current) return
    return () => {
      clearTimeout(announcementTimerRef.current!)
    }
  }, [])

  useEffect(() => {
    if (!announcement) return
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current)
    }
    announcementTimerRef.current = setTimeout(() => {
      setAnnouncement(null)
    }, 4000)
  }, [announcement])
  useEffect(() => {
    voiceFeedbackEnabledRef.current = state.voiceFeedback
    if (!state.voiceFeedback && typeof window !== "undefined" && supportsSpeechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
        console.warn("Speech synthesis cancel failed", error)
      }
    }
  }, [state.voiceFeedback, supportsSpeechSynthesis])

  useEffect(() => {
    captionsEnabledRef.current = state.captionsEnabled
    if (!state.captionsEnabled) {
      setCaptionEntry(null)
    }
  }, [state.captionsEnabled])

  const toggleHighContrast = useCallback(() => {
    setState((prev) => ({ ...prev, highContrast: !prev.highContrast }))
    announce("High contrast mode toggled")
  }, [announce])

  const setTextScale = useCallback(
    (scale: TextScale) => {
      setState((prev) => ({ ...prev, textScale: scale }))
      announce(`Text size set to ${scale}`)
    },
    [announce],
  )

  const toggleVoiceFeedback = useCallback(() => {
    let nextValue = false
    setState((prev) => {
      nextValue = !prev.voiceFeedback
      voiceFeedbackEnabledRef.current = nextValue
      return { ...prev, voiceFeedback: nextValue }
    })

    if (!nextValue && typeof window !== "undefined" && supportsSpeechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch (error) {
        console.warn("Speech synthesis cancel failed", error)
      }
    }

    announce(`Voice feedback ${nextValue ? "enabled" : "disabled"}`)
  }, [announce, supportsSpeechSynthesis])

  const toggleCaptions = useCallback(() => {
    let nextValue = false
    setState((prev) => {
      nextValue = !prev.captionsEnabled
      captionsEnabledRef.current = nextValue
      return { ...prev, captionsEnabled: nextValue }
    })

    if (!nextValue) {
      setCaptionEntry(null)
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current)
        captionTimerRef.current = null
      }
    }

    announce(`Captions ${nextValue ? "enabled" : "disabled"}`)
  }, [announce])

  const toggleMagnification = useCallback(() => {
    let nextValue = false
    setState((prev) => {
      nextValue = !prev.magnificationEnabled
      return { ...prev, magnificationEnabled: nextValue }
    })
    announce(`Magnification ${nextValue ? "enabled" : "disabled"}`)
  }, [announce])

  const toggleTextReader = useCallback(() => {
    let nextValue = false
    setState((prev) => {
      nextValue = !prev.textReaderEnabled
      return { ...prev, textReaderEnabled: nextValue }
    })
    announce(`Select to speak ${nextValue ? "enabled" : "disabled"}`)
  }, [announce])

  const setLanguage = useCallback(
    (language: string) => {
      setState((prev) => ({ ...prev, language }))
      announce(`Language set to ${AVAILABLE_LANGUAGES.find((entry) => entry.code === language)?.label ?? language}`)
    },
    [announce],
  )

  const setReducedMotion = useCallback(
    (value: boolean) => {
      setState((prev) => ({ ...prev, reducedMotion: value }))
      announce(`Reduced motion ${value ? "enabled" : "disabled"}`)
    },
    [announce],
  )

  const triggerHaptic = useCallback((pattern?: number | number[]) => {
    if (typeof navigator === "undefined") return
    if (!navigator.vibrate) return
    try {
      navigator.vibrate(pattern ?? [60, 40, 60])
    } catch (error) {
      console.warn("Haptic feedback failed", error)
    }
  }, [])

  const clearCaption = useCallback(() => {
    setCaptionEntry(null)
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current)
      captionTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!captionEntry) return
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current)
    }
    captionTimerRef.current = setTimeout(() => {
      setCaptionEntry(null)
      captionTimerRef.current = null
    }, 7000)

    return () => {
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current)
        captionTimerRef.current = null
      }
    }
  }, [captionEntry])

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      ...state,
      availableLanguages: AVAILABLE_LANGUAGES,
      supportsSpeechSynthesis,
      toggleHighContrast,
      setTextScale,
      toggleVoiceFeedback,
      toggleCaptions,
    toggleMagnification,
    toggleTextReader,
      setLanguage,
      setReducedMotion,
      speak,
      announce,
      triggerHaptic,
      activeCaption: captionEntry,
      clearCaption,
    }),
    [
      state,
      supportsSpeechSynthesis,
      toggleHighContrast,
      setTextScale,
      toggleVoiceFeedback,
      toggleCaptions,
    toggleMagnification,
    toggleTextReader,
      setLanguage,
      setReducedMotion,
      speak,
      announce,
      triggerHaptic,
      captionEntry,
      clearCaption,
    ],
  )

  return (
    <AccessibilityContext.Provider value={value}>
      <div aria-live={liveRegionPoliteness} aria-atomic="true" className="sr-only">
        {announcement?.message}
      </div>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider")
  }
  return context
}

export type { TextScale }
