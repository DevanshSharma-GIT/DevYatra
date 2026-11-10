"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, type Variants } from "framer-motion"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Landmark,
  MapPin,
  Camera,
  Shield,
  MessageSquare,
  Ticket,
  Users,
  Plane,
  Clock,
  Calendar,
  ArrowRight,
  Globe,
  BarChart2,
  Star,
  Trophy,
  Users2,
  Menu,
  Compass,
  Leaf,
  Car,
  QrCode,
  Ambulance,
} from "lucide-react"
import { getCookie, deleteCookie } from "cookies-next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getApiUrl } from "@/utils/api"
import { LanguageSelector } from "@/components/translation/language-selector"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { ReviewsRatingsCard } from "@/components/dashboard/ReviewsRatingsCard"
import type { AuthRole } from "@/lib/auth"

interface UserProfile {
  username?: string
  budget: string
  group_size: string
  group_type: string
  interests: string
  travel_dates: string
  default_location: string
  currency: string
  home_location: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userRole, setUserRole] = useState<AuthRole>("user")
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [recentDestinations, setRecentDestinations] = useState<string[]>([])
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([])
  const [userLevel, setUserLevel] = useState({ level: 1, title: "Novice Explorer" })
  const [nextLevelPoints, setNextLevelPoints] = useState(50)
  const [progressToNextLevel, setProgressToNextLevel] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [healthAlert, setHealthAlert] = useState<
    | {
        level: "low" | "moderate" | "high" | "extreme"
        summary: string
        detail?: string
        updatedAt: string
      }
    | null
  >(null)
  const { setLanguage } = useAccessibility()

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (!response.ok) {
          setUserRole("user")
          return
        }

        const data = await response.json()
        const role = data?.session?.role
        if (role === "admin" || role === "user") {
          setUserRole(role)
        }
      } catch (error) {
        console.error("Failed to load session info", error)
        setUserRole("user")
      }
    }

    fetchSession()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const STORAGE_KEY = "heritedge_medical_health_alert"

    const readAlert = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          setHealthAlert(null)
          return
        }

        const parsed = JSON.parse(stored)
        if (parsed?.level && parsed?.summary) {
          setHealthAlert(parsed)
        }
      } catch (error) {
        console.warn("Unable to read health alert status", error)
      }
    }

    readAlert()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        readAlert()
      }
    }

    window.addEventListener("storage", handleStorage)

    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleLanguageSync = (value: string) => {
    const languageCode = value.split("-")[0] || value
    setLanguage(languageCode)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
      },
    },
  }

  // Calculate user level based on points
  const calculateUserLevel = useCallback((currentPoints: number) => {
    let levelInfo = { level: 1, title: "Novice Explorer", nextLevel: 50 }
    if (currentPoints >= 500) levelInfo = { level: 5, title: "Heritage Master", nextLevel: currentPoints + 100 }
    else if (currentPoints >= 200) levelInfo = { level: 4, title: "Cultural Ambassador", nextLevel: 500 }
    else if (currentPoints >= 100) levelInfo = { level: 3, title: "Heritage Enthusiast", nextLevel: 200 }
    else if (currentPoints >= 50) levelInfo = { level: 2, title: "Cultural Tourist", nextLevel: 100 }

    setUserLevel({ level: levelInfo.level, title: levelInfo.title })
    setNextLevelPoints(levelInfo.nextLevel)
    const progress = levelInfo.nextLevel > 0 ? Math.min(100, (currentPoints / levelInfo.nextLevel) * 100) : 100
    setProgressToNextLevel(progress)
  }, [])

  const fetchUserPoints = useCallback(
    async (username: string) => {
      try {
        const response = await fetch(getApiUrl(`users/${username}`))
        if (response.ok) {
          const userData = await response.json()
          const fetchedPoints = userData.points || 0
          setPoints(fetchedPoints)
          calculateUserLevel(fetchedPoints) // Calculate level after fetching points
        } else {
          // Handle API error - maybe set default points or show error
          console.error("Failed to fetch user points, status:", response.status)
          setPoints(0) // Default to 0 on error
          calculateUserLevel(0)
        }
      } catch (error) {
        console.error("Error fetching user points:", error)
        setPoints(0) // Default to 0 on network error
        calculateUserLevel(0)
      }
    },
    [calculateUserLevel],
  )

  // Load user profile and data
  useEffect(() => {
    let preferences: UserProfile | null = null
    let needsRedirect = false

    const preferencesFromCookie = getCookie("travelPreferences")
    if (preferencesFromCookie) {
      try {
        preferences = JSON.parse(preferencesFromCookie as string)
        if (!preferences || !preferences.username) {
          needsRedirect = true
        }
      } catch (e) {
        console.error("Error parsing preferences from cookie:", e)
        needsRedirect = true
      }
    } else {
      const storedPreferences = localStorage.getItem("travelPreferences")
      if (storedPreferences) {
        try {
          preferences = JSON.parse(storedPreferences)
          if (!preferences || !preferences.username) {
            needsRedirect = true
          }
        } catch (e) {
          console.error("Error parsing preferences from localStorage:", e)
          needsRedirect = true
        }
      } else {
        needsRedirect = true
      }
    }

    if (needsRedirect || !preferences) {
      router.push("/preferences?from=/dashboard")
      return // Stop execution if redirecting
    }

    // Preferences are valid
    setUserProfile(preferences)
  fetchUserPoints(preferences.username!) // Fetch points using the username

    // Mock data (replace with actual API calls later)
    setRecentDestinations(["Paris, France", "Rome, Italy", "Barcelona, Spain"])
    setUpcomingTrips([
      { destination: "Tokyo, Japan", dates: "Dec 15-25, 2024", status: "Confirmed" },
      { destination: "Cairo, Egypt", dates: "Feb 10-20, 2025", status: "Planning" },
    ])

    setLoading(false)
  }, [fetchUserPoints, router])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch (error) {
      console.error("Failed to invalidate session during logout", error)
    }

    localStorage.removeItem("travelPreferences")
    deleteCookie("travelPreferences", { path: "/" })
    setUserProfile(null)
    setPoints(0)
    router.replace("/login")
  }

  // Feature cards data
  const featureCards = [
    {
      title: "AI Travel Assistant",
      description: "Personalized travel planning and recommendations",
      icon: <MessageSquare className="h-8 w-8 text-amber-700" />,
      color:
        "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/60 dark:via-amber-900/40 dark:to-amber-800/30 dark:border-amber-700/60",
      textColor: "text-amber-800 dark:text-amber-200",
      link: "/chatbot",
    },
    {
      title: "Destination Explorer",
      description: "Discover new places with cultural insights",
      icon: <Compass className="h-8 w-8 text-emerald-700" />,
      color:
        "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-900/60 dark:via-emerald-900/40 dark:to-emerald-800/30 dark:border-emerald-700/60",
      textColor: "text-emerald-800 dark:text-emerald-200",
      link: "/travel-services",
      badge: "New",
    },
    {
      title: "Safety Map",
      description: "View community safety reports and heatmaps",
      icon: <Shield className="h-8 w-8 text-stone-700" />,
      color:
        "bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200 dark:from-slate-900/70 dark:via-slate-900/50 dark:to-slate-800/30 dark:border-slate-700/70",
      textColor: "text-stone-800 dark:text-slate-100",
      link: "/safety",
    },
    {
      title: "Medical Assistance",
      description: "Locate clinics, get ambulance support, monitor health alerts",
      icon: <Ambulance className="h-8 w-8 text-rose-700" />,
      color:
        "bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 dark:from-rose-900/55 dark:via-rose-900/35 dark:to-rose-800/25 dark:border-rose-800/50",
      textColor: "text-rose-900 dark:text-rose-200",
      link: "/medical-assistance",
      badge: healthAlert?.level ? `${healthAlert.level.charAt(0).toUpperCase()}${healthAlert.level.slice(1)} alert` : "Vital",
    },
    {
      title: "Ticket Booking",
      description: "Book attraction tickets with dynamic pricing",
      icon: <Ticket className="h-8 w-8 text-orange-700" />,
      color:
        "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:from-orange-900/60 dark:via-orange-900/40 dark:to-orange-800/25 dark:border-orange-800/60",
      textColor: "text-orange-800 dark:text-orange-200",
      link: "/tickets",
      hidden: true,
    },
    {
      title: "Cultural Memories",
      description: "Upload photos, earn points, track visits",
      icon: <Camera className="h-8 w-8 text-lime-700" />,
      color:
        "bg-gradient-to-br from-lime-50 to-lime-100 border-lime-200 dark:from-lime-900/60 dark:via-lime-900/40 dark:to-lime-800/30 dark:border-lime-800/60",
      textColor: "text-lime-800 dark:text-lime-200",
      link: "/memory",
    },
    {
      title: "Crowd Analyzer",
      description: "Check real-time crowd density at locations",
      icon: <Users className="h-8 w-8 text-amber-700" />,
      color:
        "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/60 dark:via-amber-900/40 dark:to-amber-800/30 dark:border-amber-700/60",
      textColor: "text-amber-800 dark:text-amber-200",
      link: "/crowd-analyzer",
      badge: "Live Data",
      hidden: true,
    },
    {
      title: "Group Expense Splitter",
      description: "Manage shared travel expenses with your group",
      icon: <Users2 className="h-8 w-8 text-amber-700" />,
      color:
        "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/60 dark:via-amber-900/40 dark:to-amber-800/30 dark:border-amber-700/60",
      textColor: "text-amber-800 dark:text-amber-200",
      link: "/split",
      badge: "New",
    },
    {
      title: "Native Chat",
      description: "Chat with locals and fellow travelers",
      icon: <MessageSquare className="h-8 w-8 text-amber-700" />,
      color:
        "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/60 dark:via-amber-900/40 dark:to-amber-800/30 dark:border-amber-700/60",
      textColor: "text-amber-900 dark:text-amber-100",
      link: "/native",
    },
    {
      title: "Smart Queue",
      description: "Virtual queueing, slot booking, and digital darshan passes",
      icon: <QrCode className="h-8 w-8 text-purple-700" />,
      color:
        "bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-200 dark:from-purple-900/60 dark:via-indigo-950/40 dark:to-purple-800/30 dark:border-purple-800/60",
      textColor: "text-purple-900 dark:text-purple-200",
      link: "/smart-queue",
      badge: "Smart System",
    },
    {
      title: "Smart Ticketing",
      description: "Digital queueing and seamless entry for temple visits",
      icon: <Ticket className="h-8 w-8 text-teal-700" />,
      color:
        "bg-gradient-to-br from-teal-50 to-emerald-100 border-teal-200 dark:from-teal-900/60 dark:via-emerald-900/45 dark:to-teal-800/30 dark:border-teal-700/60",
      textColor: "text-teal-900 dark:text-teal-200",
      link: "/ticketing",
      hidden: true,
    },
    {
      title: "Traffic & Mobility",
      description: "Smart parking, shuttle tracking, and traffic management",
      icon: <Car className="h-8 w-8 text-blue-700" />,
      color:
        "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 dark:from-blue-900/60 dark:via-indigo-950/40 dark:to-blue-800/25 dark:border-blue-800/60",
      textColor: "text-blue-900 dark:text-indigo-200",
      link: "/traffic-mobility",
      badge: "Live Data",
    },
    {
      title: "IoT & Surveillance",
      description: "Monitor smart sensors, cameras, and safety devices",
      icon: <BarChart2 className="h-8 w-8 text-cyan-700" />,
      color:
        "bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200 dark:from-cyan-900/60 dark:via-slate-950/35 dark:to-cyan-800/30 dark:border-cyan-800/60",
      textColor: "text-cyan-900 dark:text-cyan-200",
      link: "/iot-surveillance",
      badge: "Beta",
    },
    ...(userRole === "admin"
      ? [
          {
            title: "AIML CrowdPrediction",
            description: "Forecast visitor flow with AI-driven insights",
            icon: <Star className="h-8 w-8 text-slate-700" />,
            color:
              "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-900/65 dark:via-slate-900/45 dark:to-slate-800/30 dark:border-slate-700/60",
            textColor: "text-slate-900 dark:text-slate-100",
            link: "/aiml-crowd-prediction",
            badge: "Admin",
          },
        ]
      : []),
  ]

  const visibleFeatureCards = featureCards.filter((card) => !card.hidden)

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen page-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  const username = userProfile?.username ?? "Guest" // Use Guest as fallback

  return (
    <div className="min-h-screen page-surface dashboard-page">
      {/* Header */}
      <header className="glass-header sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700 dark:text-amber-300" />
            <Link href="/" className="font-semibold text-amber-900 dark:text-amber-200 dashboard-link">
              DevYatra
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-amber-800 dark:text-amber-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/destinations"
              className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium dashboard-link"
            >
              Destinations
            </Link>
            <Link
              href="/experiences"
              className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium dashboard-link"
            >
              Experiences
            </Link>
            <Link
              href="/about"
              className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium dashboard-link"
            >
              About
            </Link>
            <ThemeToggle />
            <LanguageSelector size="sm" ariaLabel="Interface language" onSyncLanguage={handleLanguageSync} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/preferences")}
              className="text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-200 dark:border-slate-600 dark:hover:bg-slate-800/70 dashboard-button"
            >
              Preferences
            </Button>
            <Button
              size="sm"
              onClick={handleLogout}
              className="bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 dashboard-button dashboard-button--solid"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden glass-panel border-b-0 py-3"
          >
            <div className="container mx-auto px-4 flex flex-col space-y-3">
              <Link
                href="/destinations"
                className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium py-2 dashboard-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Destinations
              </Link>
              <Link
                href="/experiences"
                className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium py-2 dashboard-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Experiences
              </Link>
              <Link
                href="/about"
                className="text-amber-800 hover:text-amber-600 dark:text-amber-200 dark:hover:text-amber-100 text-sm font-medium py-2 dashboard-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <ThemeToggle className="justify-between" />
              <LanguageSelector
                className="w-full"
                size="sm"
                ariaLabel="Interface language"
                onSyncLanguage={handleLanguageSync}
                onAfterSelect={() => setMobileMenuOpen(false)}
              />
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    router.push("/preferences")
                    setMobileMenuOpen(false)
                  }}
                  className="text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-200 dark:border-slate-600 dark:hover:bg-slate-800/70 flex-1 dashboard-button"
                >
                  Preferences
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleLogout()
                    setMobileMenuOpen(false)
                  }}
                  className="bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 flex-1 dashboard-button dashboard-button--solid"
                >
                  Logout
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto"
        >
          {/* Welcome Section */}
          <Card className="shadow-lg overflow-hidden bg-white border border-amber-200 mb-8 dashboard-card">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Left Side: User Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-amber-200">
                    <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${username}`} alt={username} />
                    <AvatarFallback>{username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-semibold text-stone-900 dark:text-amber-100">Welcome, {username}!</h1>
                    <p className="text-stone-700 dark:text-slate-300">Ready for your next cultural adventure?</p>
                  </div>
                </div>

                {/* Right Side: Points & Level */}
                <div className="w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center dark:bg-slate-900/70 dark:border-amber-500/30 dashboard-surface">
                    <div className="text-sm text-amber-700 mb-1 font-medium dark:text-amber-200 dashboard-accent-text">Your Points</div>
                    <div className="text-3xl font-bold text-amber-800 mb-2 flex items-center justify-center gap-1 dark:text-amber-100">
                      <Star className="h-6 w-6 text-amber-500 fill-amber-500 dark:text-amber-300 dark:fill-amber-300" />
                      {points}
                    </div>
                    <div className="text-xs text-amber-700 mb-1 dark:text-amber-200/90">
                      {userLevel.title} (Level {userLevel.level})
                    </div>
                    <Progress value={progressToNextLevel} className="h-1.5 bg-amber-200 dark:bg-slate-800" />
                    {userLevel.level < 5 && (
                      <div className="text-xs text-amber-600 mt-1 dark:text-amber-200/80">
                        {Math.max(0, nextLevelPoints - points)} points to Level {userLevel.level + 1}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mb-8">
            <Card className="shadow-md bg-white/90 border border-rose-100 dark:bg-slate-900/60 dark:border-rose-500/30 dashboard-card">
              <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 uppercase tracking-wide dark:text-rose-200">
                    <Ambulance className="h-4 w-4" /> Current Crowd Health Alert
                  </div>
                  {healthAlert ? (
                    <div className="mt-2 text-stone-800 dark:text-amber-100">
                      <div className="text-lg font-semibold">
                        {healthAlert.summary}
                      </div>
                      {healthAlert.detail && <p className="text-sm text-stone-600 dark:text-slate-300 mt-1">{healthAlert.detail}</p>}
                      <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                        Updated {new Date(healthAlert.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-stone-600 dark:text-slate-300">
                      No active alerts. Stay hydrated and keep emergency contacts handy.
                    </div>
                  )}
                </div>
                <Badge
                  className={`px-4 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                    healthAlert?.level === "extreme"
                      ? "bg-red-600 text-white"
                      : healthAlert?.level === "high"
                        ? "bg-orange-500 text-white"
                        : healthAlert?.level === "moderate"
                          ? "bg-amber-400 text-amber-900"
                          : "bg-emerald-200 text-emerald-800"
                  }`}
                >
                  {healthAlert?.level ? `${healthAlert.level} risk` : "Low risk"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="features" className="mb-8">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 bg-white shadow-sm border border-amber-200 rounded-lg">
              <TabsTrigger
                value="features"
                className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <Landmark className="h-4 w-4 mr-2" /> Features
              </TabsTrigger>
              <TabsTrigger
                value="trips"
                className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <Plane className="h-4 w-4 mr-2" /> Your Trips
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="hidden md:flex data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <BarChart2 className="h-4 w-4 mr-2" /> Stats
              </TabsTrigger>
            </TabsList>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {visibleFeatureCards.map((feature, index) => (
                  <motion.div key={index} variants={itemVariants}>
                    <Link href={feature.link} legacyBehavior>
                      <a className="block h-full">
                        <Card
                          className={`shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col border rounded-xl dashboard-card ${feature.color}`}
                        >
                          <CardHeader className="flex-shrink-0 pb-2">
                            <div className="flex justify-between items-start">
                              {feature.icon}
                              {feature.badge && (
                                <Badge variant="secondary" className="text-xs bg-white/70 rounded-full dashboard-accent-bg">
                                  {feature.badge}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="flex-grow pt-2">
                            <CardTitle className={`text-lg font-semibold mb-1 ${feature.textColor}`}>
                              {feature.title}
                            </CardTitle>
                            <p className={`text-sm ${feature.textColor}/80`}>{feature.description}</p>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`text-xs p-0 h-auto ${feature.textColor} hover:bg-black/5 dashboard-button`}
                            >
                              Explore <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </CardFooter>
                        </Card>
                      </a>
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={itemVariants}>
                  <Link href="/carbon-offset" legacyBehavior>
                    <a className="block h-full">
                      <Card className="shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-100/60 dashboard-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-emerald-800">Carbon Offset</CardTitle>
                          <Leaf className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <div className="text-2xl font-bold text-emerald-900 dashboard-accent-text">Track & Reduce</div>
                          <p className="text-xs text-emerald-700/90">
                            Calculate and offset your travel carbon footprint
                          </p>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs p-0 h-auto text-emerald-700 hover:bg-emerald-50 dashboard-button"
                          >
                            Explore <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </CardFooter>
                      </Card>
                    </a>
                  </Link>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent value="trips" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* Upcoming Trips */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm bg-white border border-amber-200 overflow-hidden dashboard-card">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1 dashboard-divider"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                        <Calendar className="h-5 w-5 text-amber-600" /> Upcoming Trips
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {upcomingTrips.length > 0 ? (
                        <ul className="space-y-3">
                          {upcomingTrips.map((trip, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between p-3 bg-amber-50 rounded-md border border-amber-100 hover:bg-amber-100 transition-colors dashboard-surface"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-full shadow-sm dashboard-surface">
                                  <MapPin className="h-4 w-4 text-amber-500" />
                                </div>
                                <div>
                                  <div className="font-medium text-amber-800 dashboard-accent-text">{trip.destination}</div>
                                  <div className="text-xs text-amber-600">{trip.dates}</div>
                                </div>
                              </div>
                              <Badge
                                variant={trip.status === "Confirmed" ? "default" : "outline"}
                                className={
                                  trip.status === "Confirmed"
                                    ? "bg-green-100 text-green-800 border-green-200 dashboard-badge"
                                    : "bg-amber-100 text-amber-800 border-amber-200 dashboard-badge"
                                }
                              >
                                {trip.status}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-6 bg-amber-50 rounded-lg dashboard-surface">
                          <Plane className="h-10 w-10 text-amber-300 mx-auto mb-2" />
                          <p className="text-amber-700 text-sm">No upcoming trips planned yet.</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        size="sm"
                        className="bg-amber-700 hover:bg-amber-800 text-white w-full dashboard-button dashboard-button--solid"
                        onClick={() => router.push("/chatbot")}
                      >
                        <Plane className="h-4 w-4 mr-2" /> Plan a New Trip
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>

                {/* Recent Destinations */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm bg-white border border-amber-200 overflow-hidden dashboard-card">
                    <div className="bg-gradient-to-r from-stone-500 to-stone-600 h-1 dashboard-divider"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-stone-800">
                        <Clock className="h-5 w-5 text-stone-600" /> Recent Destinations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {recentDestinations.length > 0 ? (
                        <ul className="space-y-2">
                          {recentDestinations.map((dest, index) => (
                            <li
                              key={index}
                              className="flex items-center gap-3 p-3 bg-stone-50 rounded-md border border-stone-100 hover:bg-stone-100 transition-colors dashboard-surface"
                            >
                              <div className="bg-white p-2 rounded-full shadow-sm dashboard-surface">
                                <MapPin className="h-4 w-4 text-stone-500" />
                              </div>
                              <span className="text-sm text-stone-800 font-medium">{dest}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-6 bg-stone-50 rounded-lg dashboard-surface">
                          <MapPin className="h-10 w-10 text-stone-300 mx-auto mb-2" />
                          <p className="text-stone-600 text-sm">No recent destinations logged.</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-stone-200 text-stone-700 hover:bg-stone-50 dashboard-button"
                        onClick={() => router.push("/memory")}
                      >
                        <Camera className="h-4 w-4 mr-2" /> View Memories
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="mt-6">
              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <Card className="shadow-sm bg-white border border-amber-200 overflow-hidden dashboard-card">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1 dashboard-divider"></div>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                      <Trophy className="h-5 w-5 text-amber-600" /> Your Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <motion.div
                        variants={itemVariants}
                        className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200 shadow-sm text-center dashboard-surface dark:bg-slate-900/70 dark:border-slate-700 dark:bg-none"
                      >
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm dashboard-surface dark:bg-slate-800/80">
                          <Star className="h-6 w-6 text-amber-500 fill-amber-500 dark:text-amber-300 dark:fill-amber-300" />
                        </div>
                        <div className="text-sm text-amber-700 mb-1 dashboard-accent-text dark:text-amber-200">Total Points</div>
                        <div className="text-2xl font-bold text-amber-800 dashboard-accent-text dark:text-amber-100">{points}</div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="bg-gradient-to-br from-stone-50 to-stone-100 p-4 rounded-lg border border-stone-200 shadow-sm text-center dashboard-surface dark:bg-slate-900/70 dark:border-slate-700 dark:bg-none"
                      >
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm dashboard-surface dark:bg-slate-800/80">
                          <Trophy className="h-6 w-6 text-stone-500 dark:text-slate-200" />
                        </div>
                        <div className="text-sm text-stone-700 mb-1 dashboard-accent-text dark:text-slate-200">Current Level</div>
                        <div className="text-xl font-bold text-stone-800 dashboard-accent-text dark:text-slate-100">{userLevel.level}</div>
                        <div className="text-xs text-stone-600 dashboard-accent-text dark:text-slate-300/90">{userLevel.title}</div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200 shadow-sm text-center dashboard-surface dark:bg-slate-900/70 dark:border-slate-700 dark:bg-none"
                      >
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm dashboard-surface dark:bg-slate-800/80">
                          <Camera className="h-6 w-6 text-orange-500 dark:text-orange-300" />
                        </div>
                        <div className="text-sm text-orange-700 mb-1 dashboard-accent-text dark:text-orange-200">Memories</div>
                        <div className="text-2xl font-bold text-orange-800 dashboard-accent-text dark:text-orange-100">0</div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200 shadow-sm text-center dashboard-surface dark:bg-slate-900/70 dark:border-slate-700 dark:bg-none"
                      >
                        <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm dashboard-surface dark:bg-slate-800/80">
                          <Shield className="h-6 w-6 text-emerald-500 dark:text-emerald-300" />
                        </div>
                        <div className="text-sm text-emerald-700 mb-1 dashboard-accent-text dark:text-emerald-200">Safety Reports</div>
                        <div className="text-2xl font-bold text-emerald-800 dashboard-accent-text dark:text-emerald-100">0</div>
                      </motion.div>
                    </div>

                    {/* Level Progress */}
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200 dashboard-surface dark:bg-slate-900/70 dark:border-slate-700">
                      <h3 className="text-sm font-medium text-amber-800 mb-3 dashboard-accent-text dark:text-amber-200">Level Progress</h3>
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-amber-700 bg-amber-200 dashboard-accent-bg dark:text-amber-900">
                              Level {userLevel.level}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold inline-block text-amber-700 dashboard-accent-text dark:text-amber-200">
                              {progressToNextLevel}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-amber-200 dashboard-accent-bg dark:bg-amber-400">
                          <div
                            style={{ width: `${progressToNextLevel}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-amber-500 to-amber-600 dashboard-accent-bg dark:from-amber-400 dark:to-amber-300"
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-amber-700 dashboard-accent-text dark:text-amber-200">
                          <span>0 pts</span>
                          <span>{nextLevelPoints} pts</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-10"
          >
            <ReviewsRatingsCard userRole={userRole} username={username} />
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200 py-8 mt-12 dashboard-surface">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Globe className="h-5 w-5 text-amber-700 mr-2" />
              <span className="text-lg font-semibold text-stone-800">DevYatra</span>
            </div>
            <div className="text-stone-600 text-sm">© {new Date().getFullYear()} DevYatra. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
