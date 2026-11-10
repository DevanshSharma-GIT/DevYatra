"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react"
import { getCookie } from "cookies-next"

import { cn } from "@/lib/utils"
import { getApiUrl } from "@/utils/api"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"

const LONG_PRESS_DURATION = 3200
const SOS_RESET_DELAY = 12000

type SosState = "idle" | "sending" | "success" | "error"

interface CoordinatesPayload {
  lat: number
  lon: number
  accuracy?: number
}

interface TravellerProfile {
  name: string
  locationLabel: string | null
  homeCoordinates: CoordinatesPayload | null
}

export function EmergencyAssistButton() {
  const { announce, speak, triggerHaptic } = useAccessibility()

  const [isHolding, setIsHolding] = useState(false)
  const [profile, setProfile] = useState<TravellerProfile>({
    name: "Guest Traveller",
    locationLabel: null,
    homeCoordinates: null,
  })
  const [sosStatus, setSosStatus] = useState<{ state: SosState; detail?: string }>({ state: "idle" })

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  const loadProfileFromStorage = useCallback(() => {
    if (typeof window === "undefined") return

    let storedPrefs: any = null

    const localPrefs = window.localStorage.getItem("travelPreferences")
    if (localPrefs) {
      try {
        storedPrefs = JSON.parse(localPrefs)
      } catch (error) {
        console.warn("Unable to parse travelPreferences from localStorage", error)
      }
    }

    if (!storedPrefs) {
      const cookiePrefs = getCookie("travelPreferences")
      if (cookiePrefs && typeof cookiePrefs === "string") {
        try {
          storedPrefs = JSON.parse(cookiePrefs)
        } catch (error) {
          console.warn("Unable to parse travelPreferences cookie", error)
        }
      } else if (cookiePrefs && typeof cookiePrefs === "object") {
        storedPrefs = cookiePrefs
      }
    }

    let name = "Guest Traveller"
    let locationLabel: string | null = null

    if (storedPrefs && typeof storedPrefs === "object") {
      if (typeof storedPrefs.username === "string" && storedPrefs.username.trim()) {
        name = storedPrefs.username.trim()
      }
      if (typeof storedPrefs.home_location === "string" && storedPrefs.home_location.trim()) {
        locationLabel = storedPrefs.home_location.trim()
      } else if (
        typeof storedPrefs.detectedLocationName === "string" &&
        storedPrefs.detectedLocationName.trim()
      ) {
        locationLabel = storedPrefs.detectedLocationName.trim()
      }
    }

    let coordinates: CoordinatesPayload | null = null
    try {
      const storedCoords = window.localStorage.getItem("home_location_coords")
      if (storedCoords) {
        const parsedCoords = JSON.parse(storedCoords)
        const latValue =
          typeof parsedCoords.lat === "number" ? parsedCoords.lat : parseFloat(parsedCoords.lat ?? "")
        const lonValue =
          typeof parsedCoords.lon === "number" ? parsedCoords.lon : parseFloat(parsedCoords.lon ?? "")

        if (!Number.isNaN(latValue) && !Number.isNaN(lonValue)) {
          coordinates = {
            lat: latValue,
            lon: lonValue,
            accuracy:
              typeof parsedCoords.accuracy === "number"
                ? parsedCoords.accuracy
                : typeof parsedCoords.accuracyMeters === "number"
                  ? parsedCoords.accuracyMeters
                  : undefined,
          }

          if (!locationLabel && typeof parsedCoords.formatted_address === "string") {
            const formatted = parsedCoords.formatted_address.trim()
            if (formatted) {
              locationLabel = formatted
            }
          }
        }
      }
    } catch (error) {
      console.warn("Unable to parse stored coordinates", error)
    }

    setProfile({
      name: name || "Guest Traveller",
      locationLabel,
      homeCoordinates: coordinates,
    })
  }, [])

  useEffect(() => {
    loadProfileFromStorage()
  }, [loadProfileFromStorage])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || ["travelPreferences", "home_location_coords"].includes(event.key)) {
        loadProfileFromStorage()
      }
    }

    const handleCustomUpdate = () => loadProfileFromStorage()

    window.addEventListener("storage", handleStorage)
    window.addEventListener("heritedge:preferences-updated", handleCustomUpdate)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("heritedge:preferences-updated", handleCustomUpdate)
    }
  }, [loadProfileFromStorage])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (sosStatus.state === "success" || sosStatus.state === "error") {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
      resetTimerRef.current = window.setTimeout(() => {
        setSosStatus({ state: "idle" })
        resetTimerRef.current = null
      }, SOS_RESET_DELAY)
    }

    return () => {
      if (resetTimerRef.current && (sosStatus.state === "success" || sosStatus.state === "error")) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [sosStatus.state])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
      }
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const sendEmergencySignal = useCallback(async () => {
    try {
      let deviceCoordinates: CoordinatesPayload | null = null

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        deviceCoordinates = await new Promise<CoordinatesPayload | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) =>
              resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy || undefined,
              }),
            () => resolve(null),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
          )
        })
      }

      const payload: Record<string, unknown> = {
        name: profile.name,
        homeLocation: profile.locationLabel,
        homeCoordinates: profile.homeCoordinates,
        deviceCoordinates,
        triggeredAt: new Date().toISOString(),
      }

      if (!payload.homeLocation && profile.homeCoordinates) {
        payload.homeLocation = `Lat ${profile.homeCoordinates.lat.toFixed(5)}, Lon ${profile.homeCoordinates.lon.toFixed(5)}`
      }

      const response = await fetch(getApiUrl("sos/trigger"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let data: any = null
      try {
        data = await response.json()
      } catch (error) {
        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}`)
        }
      }

      if (!response.ok || !data?.success) {
        const message = data?.message || data?.detail || response.statusText || "Unable to dispatch emergency alert"
        throw new Error(typeof message === "string" ? message : "Unable to dispatch emergency alert")
      }

      setSosStatus({ state: "success" })
      triggerHaptic([60, 40, 60])
      announce("Emergency assistance confirmed. Response team notified.", {
        politeness: "assertive",
        interrupt: true,
      })
      speak("Emergency team has been notified. Stay safe and await help.", { interrupt: false })

      return data
    } catch (error) {
      console.error("Emergency SOS dispatch failed", error)
      const detail = error instanceof Error ? error.message : "Unable to contact emergency desk"
      setSosStatus({ state: "error", detail })
      announce("Emergency SOS failed. Please try again or dial 1 1 2 immediately.", {
        politeness: "assertive",
        interrupt: true,
      })
      speak("We could not reach the emergency desk. Please dial one one two immediately.", { interrupt: false })
      return null
    }
  }, [announce, profile, speak, triggerHaptic])

  const handleActivate = useCallback(() => {
    if (sosStatus.state === "sending") return

    triggerHaptic([120, 60, 120])
    setSosStatus({ state: "sending" })
    announce("Contacting emergency response desk now.", { politeness: "assertive", interrupt: true })
    speak("Hold tight, we're alerting the emergency desk now.", { interrupt: false })

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("heritedge:sos"))
    }

    void sendEmergencySignal()
  }, [announce, sendEmergencySignal, sosStatus.state, speak, triggerHaptic])

  const handleClick = useCallback(() => {
    if (isHolding || sosStatus.state === "sending") return
    handleActivate()
  }, [handleActivate, isHolding, sosStatus.state])

  const handlePointerDown = useCallback(() => {
    if (sosStatus.state === "sending") return
    setIsHolding(true)

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
    }

    holdTimerRef.current = setTimeout(() => {
      setIsHolding(false)
      handleActivate()
    }, LONG_PRESS_DURATION)
  }, [handleActivate, sosStatus.state])

  const resetHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    setIsHolding(false)
    resetHoldTimer()
  }, [resetHoldTimer])

  const handlePointerLeave = useCallback(() => {
    if (!isHolding) return
    setIsHolding(false)
    resetHoldTimer()
  }, [isHolding, resetHoldTimer])

  const statusText = useMemo(() => {
    if (sosStatus.state === "sending") return "Contacting emergency desk…"
    if (sosStatus.state === "success") return "SOS sent to responders"
    if (sosStatus.state === "error") return "SOS failed. Tap to retry"
    return isHolding ? "Hold to confirm" : "Tap or press and hold for SOS"
  }, [isHolding, sosStatus.state])

  const statusTone = useMemo(() => {
    switch (sosStatus.state) {
      case "sending":
        return "bg-amber-500 text-white"
      case "success":
        return "bg-emerald-600 text-white"
      case "error":
        return "bg-rose-600 text-white"
      default:
        return "bg-destructive/90 text-destructive-foreground"
    }
  }, [sosStatus.state])

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[1200] flex flex-col items-end gap-2">
      <span
        className={cn(
          "pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-lg transition",
          statusTone,
        )}
        role="status"
        aria-live="polite"
        title={sosStatus.state === "error" && sosStatus.detail ? sosStatus.detail : undefined}
      >
        {statusText}
      </span>
      <button
        type="button"
        disabled={sosStatus.state === "sending"}
        className={cn(
          "pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground shadow-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/40",
          isHolding && "scale-105",
          sosStatus.state === "sending" && "opacity-95",
        )}
        aria-label="Emergency assistance"
        aria-busy={sosStatus.state === "sending"}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
        {sosStatus.state === "sending" ? (
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
        ) : isHolding ? (
          <ShieldAlert className="h-8 w-8" aria-hidden />
        ) : (
          <AlertTriangle className="h-7 w-7" aria-hidden />
        )}
        <span className="sr-only">Emergency assistance button</span>
      </button>
    </div>
  )
}
