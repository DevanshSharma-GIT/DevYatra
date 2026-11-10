"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { getCookie } from "cookies-next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowLeft,
  Clock,
  HeartPulse,
  MapPin,
  PhoneCall,
  RefreshCcw,
  Shield,
  Siren,
  Stethoscope,
  ThermometerSun,
  Users,
} from "lucide-react"
import type { AuthRole } from "@/lib/auth"
import type { MedicalFacilityMarker } from "@/components/medical-assistance/MedicalMap"

const MedicalMap = dynamic(() => import("@/components/medical-assistance/MedicalMap").then((mod) => mod.MedicalMap), {
  ssr: false,
})

const SOMNATH_COORDS = {
  lat: 20.88802,
  lng: 70.40178,
}

const MEDICAL_FACILITIES = [
  {
    id: "somnath-trust",
    name: "Somnath Trust Hospital",
    type: "hospital" as const,
    position: [20.88891, 70.40185] as [number, number],
    address: "Somnath Temple Campus, Prabhas Patan",
    contact: "+91-2876-242761",
    services: ["24x7 Emergency", "Trauma Care", "Ambulance Dispatch"],
  },
  {
    id: "civil-hospital",
    name: "Civil Hospital Prabhas Patan",
    type: "hospital" as const,
    position: [20.89672, 70.39081] as [number, number],
    address: "Civil Hospital Road, Prabhas Patan",
    contact: "+91-2876-221122",
    services: ["General OPD", "Pharmacy", "Emergency Ward"],
  },
  {
    id: "veraval-chc",
    name: "Community Health Centre, Veraval",
    type: "clinic" as const,
    position: [20.90741, 70.36396] as [number, number],
    address: "Rajendra Bhuvan Road, Veraval",
    contact: "+91-2876-244211",
    services: ["Stabilisation Unit", "Maternity Support", "Diagnostics"],
  },
  {
    id: "first-aid-somnath",
    name: "Somnath First Aid & Rescue Unit",
    type: "first_aid" as const,
    position: [20.88678, 70.39844] as [number, number],
    address: "Shivaji Circle, Prabhas Patan",
    contact: "+91-90234-77821",
    services: ["On-ground First Aid", "Volunteer Network", "Wheelchair Support"],
  },
  {
    id: "108-ambulance-base",
    name: "108 Ambulance Base - Somnath",
    type: "clinic" as const,
    position: [20.88298, 70.41527] as [number, number],
    address: "Somnath-Veraval Highway Service Road",
    contact: "108",
    services: ["Critical Ambulance", "Rapid Response Crew"],
  },
]

const AMBULANCE_UNITS = [
  {
    id: "GJ-11-ER-203",
    driver: "Mahesh V.",
    status: "Ready",
    etaMinutes: 6,
    lastUpdated: "2 mins ago",
  },
  {
    id: "GJ-11-ER-117",
    driver: "Zahid S.",
    status: "On Duty",
    etaMinutes: 11,
    lastUpdated: "4 mins ago",
  },
  {
    id: "GJ-11-QRT-09",
    driver: "Ramesh P.",
    status: "Standby",
    etaMinutes: 14,
    lastUpdated: "7 mins ago",
  },
]

const ASSISTANCE_STORAGE_KEY = "heritedge_medical_assistance_state"
const HEALTH_ALERT_STORAGE_KEY = "heritedge_medical_health_alert"

interface AssistanceLogEntry {
  id: string
  facilityId: string
  facilityName: string
  timestamp: string
}

interface MedicalAssistanceState {
  totalRequests: number
  requests: AssistanceLogEntry[]
  escalations: number
  lastFacilityId?: string | null
}

interface WeatherSnapshot {
  temperature: number
  feelsLike: number
  humidity: number
  condition: string
  windSpeed: number
  fetchedAt: string
}

interface RiskAssessment {
  level: "low" | "moderate" | "high" | "extreme"
  summary: string
  detail: string
  recommendedActions: string[]
}

const haversineDistanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const R = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const classifyHeatRisk = (temperature: number, humidity: number): RiskAssessment => {
  const feelsHot = temperature >= 32
  const highHumidity = humidity >= 75

  if (temperature >= 42 || (feelsHot && highHumidity && temperature >= 38)) {
    return {
      level: "extreme",
      summary: "Extreme heat stress – immediate action required",
      detail: "Conditions can trigger heatstroke and dehydration within minutes. Extra precautions necessary for elderly and children.",
      recommendedActions: [
        "Activate shaded cooling zones around the temple complex",
        "Deploy hydration volunteers near queue lanes",
        "Alert emergency teams to prioritise high-risk devotees",
      ],
    }
  }

  if (temperature >= 37 || (feelsHot && highHumidity)) {
    return {
      level: "high",
      summary: "High heat load on crowds",
      detail: "Prolonged exposure will cause fatigue and rapid dehydration. Monitor senior citizens closely.",
      recommendedActions: [
        "Issue heat advisories on public announcement system",
        "Ensure water distribution counters are replenished",
        "Increase medical patrol frequency in queue corridors",
      ],
    }
  }

  if (temperature >= 30) {
    return {
      level: "moderate",
      summary: "Moderate warmth – stay hydrated",
      detail: "Weather is manageable but may feel humid inside enclosed queue lanes. Encourage short breaks.",
      recommendedActions: [
        "Keep first-aid volunteers on a 15-minute rotation",
        "Promote use of lightweight stoles or caps",
        "Remind devotees to sip water every 30 minutes",
      ],
    }
  }

  return {
    level: "low",
    summary: "Comfortable conditions",
    detail: "Weather at Somnath temple is presently comfortable. Continue regular monitoring of vulnerable groups.",
    recommendedActions: [
      "Maintain baseline medical patrols",
      "Keep a standby hydration counter",
      "Educate visitors on available medical points",
    ],
  }
}

const formatTimeAgo = (isoString: string) => {
  try {
    const now = Date.now()
    const then = new Date(isoString).getTime()
    const diffMinutes = Math.floor((now - then) / 60000)
    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes} min ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return "1 hour ago"
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`
  } catch (error) {
    return "recently"
  }
}

const initialState: MedicalAssistanceState = {
  totalRequests: 0,
  requests: [],
  escalations: 0,
  lastFacilityId: null,
}

export default function MedicalAssistancePage() {
  const [userRole, setUserRole] = useState<AuthRole>("user")
  const [username, setUsername] = useState<string>("Guest Traveller")
  const [assistanceState, setAssistanceState] = useState<MedicalAssistanceState>(() => {
    if (typeof window === "undefined") return initialState
    try {
      const stored = window.localStorage.getItem(ASSISTANCE_STORAGE_KEY)
      if (!stored) return initialState
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed === "object") {
        return {
          ...initialState,
          ...parsed,
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        }
      }
    } catch (error) {
      console.warn("Unable to load assistance state", error)
    }
    return initialState
  })
  const [highlightedFacilityId, setHighlightedFacilityId] = useState<string | null>(
    typeof assistanceState.lastFacilityId === "string" ? assistanceState.lastFacilityId : null,
  )
  const [weatherInfo, setWeatherInfo] = useState<WeatherSnapshot | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
  const [assistanceFeedback, setAssistanceFeedback] = useState<string | null>(null)
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)
  const [isFetchingWeather, setIsFetchingWeather] = useState<boolean>(true)

  const facilitiesWithDistance: MedicalFacilityMarker[] = useMemo(
    () =>
      MEDICAL_FACILITIES.map((facility) => ({
        ...facility,
        distanceKm: haversineDistanceKm(SOMNATH_COORDS, { lat: facility.position[0], lng: facility.position[1] }),
      })),
    [],
  )

  const nearestFacility = useMemo(() => {
    return [...facilitiesWithDistance].sort((a, b) => a.distanceKm - b.distanceKm)[0]
  }, [facilitiesWithDistance])

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (!response.ok) return
        const data = await response.json()
        const role = data?.session?.role
        if (role === "admin" || role === "user") {
          setUserRole(role)
        }
      } catch (error) {
        console.warn("Unable to fetch session for medical assistance page", error)
      }
    }

    fetchSession()
  }, [])

  useEffect(() => {
    const preferencesFromCookie = getCookie("travelPreferences")
    if (!preferencesFromCookie) return
    try {
      const parsed = JSON.parse(preferencesFromCookie as string)
      if (parsed?.username) {
        setUsername(parsed.username)
      }
    } catch (error) {
      console.warn("Unable to parse travel preferences", error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(ASSISTANCE_STORAGE_KEY, JSON.stringify(assistanceState))
    } catch (error) {
      console.warn("Unable to persist assistance state", error)
    }
  }, [assistanceState])

  useEffect(() => {
    if (!assistanceState.lastFacilityId) return
    setHighlightedFacilityId(assistanceState.lastFacilityId)
  }, [assistanceState.lastFacilityId])

  useEffect(() => {
    if (!assistanceFeedback) return
    const timer = window.setTimeout(() => setAssistanceFeedback(null), 9000)
    return () => window.clearTimeout(timer)
  }, [assistanceFeedback])

  useEffect(() => {
    if (!adminFeedback) return
    const timer = window.setTimeout(() => setAdminFeedback(null), 7000)
    return () => window.clearTimeout(timer)
  }, [adminFeedback])

  useEffect(() => {
    if (typeof window === "undefined") return

    const controller = new AbortController()
    const fetchWeather = async () => {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
      if (!apiKey) {
        setWeatherError("OpenWeather API key missing. Please configure NEXT_PUBLIC_OPENWEATHER_API_KEY.")
        setIsFetchingWeather(false)
        return
      }

      try {
        setIsFetchingWeather(true)
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${SOMNATH_COORDS.lat}&lon=${SOMNATH_COORDS.lng}&units=metric&appid=${apiKey}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error(`Weather request failed with status ${response.status}`)
        }

        const data = await response.json()
        const snapshot: WeatherSnapshot = {
          temperature: data.main?.temp ?? 0,
          feelsLike: data.main?.feels_like ?? data.main?.temp ?? 0,
          humidity: data.main?.humidity ?? 0,
          condition: data.weather?.[0]?.description ?? "Clear",
          windSpeed: data.wind?.speed ?? 0,
          fetchedAt: new Date().toISOString(),
        }

        setWeatherInfo(snapshot)
        const risk = classifyHeatRisk(snapshot.temperature, snapshot.humidity)
        setRiskAssessment(risk)

        try {
          window.localStorage.setItem(
            HEALTH_ALERT_STORAGE_KEY,
            JSON.stringify({
              level: risk.level,
              summary: risk.summary,
              detail: risk.detail,
              updatedAt: snapshot.fetchedAt,
            }),
          )
        } catch (error) {
          console.warn("Unable to persist health alert", error)
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to fetch weather", error)
          setWeatherError("Unable to load weather data right now.")
        }
      } finally {
        setIsFetchingWeather(false)
      }
    }

    fetchWeather()

    const interval = window.setInterval(fetchWeather, 15 * 60 * 1000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [])

  const recentRequests = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000
    return assistanceState.requests.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff).length
  }, [assistanceState.requests])

  const handleRequestAssistance = () => {
    if (!nearestFacility) return

    const timestamp = new Date().toISOString()
    const entry: AssistanceLogEntry = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      facilityId: nearestFacility.id,
      facilityName: nearestFacility.name,
      timestamp,
    }

    setAssistanceState((prev) => {
      const updatedRequests = [entry, ...prev.requests].slice(0, 30)
      return {
        ...prev,
        totalRequests: prev.totalRequests + 1,
        requests: updatedRequests,
        lastFacilityId: nearestFacility.id,
      }
    })

    setHighlightedFacilityId(nearestFacility.id)
    setAssistanceFeedback(
      `${nearestFacility.name} has been highlighted on the map. The temple medical desk and ambulance teams have been notified.`,
    )
  }

  const handleContactStaff = () => {
    setAssistanceState((prev) => ({
      ...prev,
      escalations: prev.escalations + 1,
    }))
    setAdminFeedback("Broadcast sent to additional medical staff, local clinics, and Somnath control room.")
  }

  const handleFacilityFocus = (facilityId: string | null) => {
    setHighlightedFacilityId(facilityId)
  }

  const riskLevelColor = riskAssessment?.level === "extreme"
    ? "bg-red-600 text-white"
    : riskAssessment?.level === "high"
      ? "bg-orange-500 text-white"
      : riskAssessment?.level === "moderate"
        ? "bg-amber-400 text-amber-900"
        : "bg-emerald-200 text-emerald-800"

  const AssistanceCTA = () => (
    <Card className="border-amber-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-amber-800 flex items-center gap-2 dark:text-amber-200">
          <Siren className="h-5 w-5 text-red-500" /> Need medical care?
        </CardTitle>
        <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
          We will connect you to the closest temple-authorised medical point and dispatch the nearest ambulance team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:border-amber-500/40 dark:text-amber-100">
          <p>
            You are viewing Somnath temple&apos;s medical coverage. Tap the button below and walk towards the highlighted location for
            priority treatment.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full bg-rose-600 text-white hover:bg-rose-700"
          onClick={handleRequestAssistance}
        >
          <Ambulance className="h-4 w-4 mr-2" /> Request immediate assistance
        </Button>
        {assistanceFeedback && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:border-rose-500/40 dark:text-rose-100">
            {assistanceFeedback}
          </div>
        )}
        <div className="space-y-2 text-sm text-stone-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-emerald-600" /> Temple emergency desk: <span className="font-semibold">+91-2876-232766</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" /> Highlighted facility: {nearestFacility?.name ?? "Somnath Trust Hospital"}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const AdminControls = () => (
    <Card className="border-rose-200 bg-white/95 shadow-md dark:bg-slate-900/60 dark:border-rose-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-rose-800 flex items-center gap-2 dark:text-rose-200">
          <Shield className="h-5 w-5" /> Medical coordination console
        </CardTitle>
        <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
          Monitor incoming assistance requests and deploy additional medical coverage across Somnath shrine premises.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
            <div className="text-xs uppercase text-amber-600 font-semibold">Total assistance requests today</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-800 dark:text-amber-200">{assistanceState.totalRequests}</span>
              <Badge variant="secondary" className="bg-white/90 text-amber-700 border border-amber-200">
                {recentRequests} in last hour
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
            <div className="text-xs uppercase text-sky-700 font-semibold">Escalations</div>
            <div className="mt-1 text-2xl font-bold text-sky-900 dark:text-sky-200">{assistanceState.escalations}</div>
            <p className="text-xs text-sky-700 mt-1">Additional medical staff calls triggered.</p>
          </div>
        </div>
        <Button onClick={handleContactStaff} className="w-full bg-rose-600 text-white hover:bg-rose-700">
          <Users className="h-4 w-4 mr-2" /> Contact additional medical staff
        </Button>
        {adminFeedback && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:border-rose-500/40 dark:text-rose-100">
            {adminFeedback}
          </div>
        )}
        <div className="space-y-2 text-sm text-stone-600 dark:text-slate-300">
          <p className="font-medium text-stone-800 dark:text-amber-100">Suggested next steps</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Coordinate with Somnath Trust Hospital triage desk for stretcher-ready response.</li>
            <li>Notify security to maintain a clear corridor from Garba Graha queue to medical base.</li>
            <li>Share updates with public announcement system every 10 minutes until alert eases.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen page-surface">
      <header className="glass-header sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-amber-800 hover:text-amber-600 flex items-center gap-2 font-medium">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <div className="h-6 w-px bg-amber-200" aria-hidden></div>
            <div className="flex items-center gap-2">
              <Ambulance className="h-5 w-5 text-rose-600" />
              <span className="font-semibold text-amber-900">Medical Assistance</span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Somnath Temple Campus
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 space-y-8">
        <section className="max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <Badge className="bg-rose-100 text-rose-700 mb-3 w-fit">Live medical coverage</Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-amber-100">
                Rapid medical response for Somnath pilgrims
              </h1>
              <p className="mt-3 text-stone-600 max-w-2xl dark:text-slate-300">
                Monitor real-time health risk, coordinate ambulance availability, and guide devotees to verified medical points across
                the temple precinct.
              </p>
            </div>
            <div className="text-sm text-stone-500 dark:text-slate-400">
              <div className="font-semibold text-stone-700 dark:text-amber-100">Signed in as</div>
              <div className="text-stone-800 dark:text-amber-100">{username}</div>
              <Badge variant="outline" className="mt-1 border-amber-200 text-amber-700 dark:border-amber-500 dark:text-amber-200">
                {userRole === "admin" ? "Admin" : "Traveller"}
              </Badge>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-amber-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-200">
                <ThermometerSun className="h-5 w-5" /> Somnath weather now
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                Updated with OpenWeather data every 15 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isFetchingWeather && !weatherInfo ? (
                <div className="text-sm text-stone-500">Fetching current conditions…</div>
              ) : weatherError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:border-rose-500/40 dark:text-rose-100">
                  {weatherError}
                </div>
              ) : weatherInfo ? (
                <div className="grid grid-cols-2 gap-3 text-sm text-stone-700 dark:text-slate-200">
                  <div>
                    <div className="text-xs uppercase text-stone-500">Temperature</div>
                    <div className="text-2xl font-semibold text-amber-800 dark:text-amber-100">
                      {Math.round(weatherInfo.temperature)}°C
                    </div>
                    <div className="text-xs text-stone-500">Feels like {Math.round(weatherInfo.feelsLike)}°C</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-stone-500">Humidity</div>
                    <div className="text-2xl font-semibold text-amber-800 dark:text-amber-100">{weatherInfo.humidity}%</div>
                    <div className="text-xs text-stone-500">Wind {weatherInfo.windSpeed.toFixed(1)} m/s</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-stone-500">Condition</div>
                    <div className="font-medium capitalize">{weatherInfo.condition}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-stone-500">Updated</div>
                    <div>{new Date(weatherInfo.fetchedAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-stone-500">Weather data currently unavailable.</div>
              )}
              {riskAssessment && (
                <div className={`rounded-lg px-3 py-2 text-sm font-medium ${riskLevelColor}`}>
                  {riskAssessment.summary}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-rose-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-rose-800 dark:text-rose-200">
                <HeartPulse className="h-5 w-5" /> Crowd health alert
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                Automated risk scoring across Somnath darshan queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskAssessment ? (
                <>
                  <p className="text-sm text-stone-600 dark:text-slate-300">{riskAssessment.detail}</p>
                  <ul className="text-sm text-stone-600 list-disc list-inside space-y-1 dark:text-slate-300">
                    {riskAssessment.recommendedActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-stone-500">Risk profile will appear once weather data loads.</p>
              )}
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Activity className="h-4 w-4" />
                Alert shared with dashboard status banner.
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-emerald-800 dark:text-emerald-200">
                <Ambulance className="h-5 w-5" /> Ambulance availability
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                Powered by Somnath Trust emergency grid.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AMBULANCE_UNITS.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-800 flex items-center justify-between dark:bg-emerald-900/25 dark:border-emerald-500/40 dark:text-emerald-100"
                >
                  <div>
                    <div className="font-semibold">{unit.id}</div>
                    <div className="text-xs">Driver: {unit.driver}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase font-semibold">{unit.status}</div>
                    <div className="text-xs">ETA to temple: {unit.etaMinutes} min</div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-200/80">Updated {unit.lastUpdated}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <RefreshCcw className="h-3.5 w-3.5" /> Data refreshed every 5 minutes.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[520px]">
            <MedicalMap
              facilities={facilitiesWithDistance}
              userLocation={[SOMNATH_COORDS.lat, SOMNATH_COORDS.lng]}
              highlightedFacilityId={highlightedFacilityId}
              onFacilityFocus={handleFacilityFocus}
            />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-5">
            {userRole === "admin" ? <AdminControls /> : <AssistanceCTA />}
            <Card className="border-stone-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-stone-700/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-stone-800 flex items-center gap-2 dark:text-amber-200">
                  <MapPin className="h-4 w-4" /> Verified medical points
                </CardTitle>
                <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                  Tap a facility to focus it on the map.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64">
                  <div className="divide-y divide-amber-100 dark:divide-slate-700/40">
                    {facilitiesWithDistance.map((facility) => (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => setHighlightedFacilityId(facility.id)}
                        className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-amber-50/60 dark:hover:bg-slate-800/50 ${
                          highlightedFacilityId === facility.id ? "bg-amber-50/70 dark:bg-amber-900/20" : ""
                        }`}
                      >
                        <div className="mt-1">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              facility.type === "hospital"
                                ? "bg-blue-500"
                                : facility.type === "clinic"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                            }`}
                          ></div>
                        </div>
                        <div>
                          <div className="font-semibold text-stone-800 dark:text-amber-100">{facility.name}</div>
                          <div className="text-xs text-stone-500 mb-1">{facility.address}</div>
                          <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-slate-300">
                            <span>{facility.contact}</span>
                            <span>•</span>
                            <span>{facility.distanceKm.toFixed(2)} km</span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-1 dark:text-slate-400">{facility.services.join(" · ")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-stone-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-stone-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-stone-800 dark:text-amber-100">
                <Clock className="h-4 w-4" /> Recent assistance trail
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                Track how the medical desk responded to devotees requesting support.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {assistanceState.requests.length === 0 ? (
                <div className="p-6 text-sm text-stone-500">No assistance requests have been recorded yet today.</div>
              ) : (
                <div className="divide-y divide-amber-100 dark:divide-slate-700/40">
                  {assistanceState.requests.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="p-4 flex items-start gap-3">
                      <div className="mt-1">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                      </div>
                      <div>
                        <div className="font-medium text-stone-800 dark:text-amber-100">{entry.facilityName}</div>
                        <div className="text-xs text-stone-500">Routed {formatTimeAgo(entry.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-white/90 shadow-md dark:bg-slate-900/60 dark:border-stone-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-stone-800 dark:text-amber-100">
                <Stethoscope className="h-4 w-4" /> Quick response checklist
              </CardTitle>
              <CardDescription className="text-sm text-stone-600 dark:text-slate-300">
                Shared guidelines for field volunteers and temple admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-stone-600 dark:text-slate-300">
              <ul className="list-disc list-inside space-y-2">
                <li>Confirm the devotee&apos;s location and guide them verbally while the map is highlighted.</li>
                <li>Notify the nearest ambulance unit on standby and share the incident code via radio.</li>
                <li>Keep the darshan queue moving by requesting volunteers to manage alternate lanes.</li>
                <li>Record symptoms, hydration level, and escort details in the medical ledger.</li>
              </ul>
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:border-amber-500/40 dark:text-amber-100">
                <strong>High risk guidance:</strong> If alert level is High or Extreme, keep cold packs ready at the medical desk and
                prioritise shade shelters around the queue.
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
