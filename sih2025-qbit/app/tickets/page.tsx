"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  MapPin,
  Clock,
  Navigation,
  Camera,
  Ticket,
  Star,
  X,
  ArrowLeft,
  MessageCircle,
  Shield,
  CameraIcon,
  Globe,
  Award,
  BookOpen,
  Calendar,
  Lightbulb,
  Zap,
  History,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SearchResult {
  name: string
  location: {
    latitude: number
    longitude: number
  }
  map_url: string
  crowd_density: string
  dynamic_price: number
  recommendation: string
  is_tourist_attraction: boolean
  route_info?: {
    distance: { text: string; value: number }
    duration: { text: string; value: number }
  }
  vr_videos?: Array<{
    title: string
    video_id: string
  }>
}

interface AutocompleteSuggestion {
  label: string
  latitude: number
  longitude: number
}

interface RouteInfo {
  distance: { text: string; value: number }
  duration: { text: string; value: number }
  route_map_url?: string
}

// Define or import this helper function
const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
  // Ensure baseUrl does not end with /api, then add /api
  const cleanBase = baseUrl.replace(/\/$/, "").replace(/\/api$/, "") + "/api"
  const cleanPath = path.startsWith("/") ? path.substring(1) : path
  return `${cleanBase}/${cleanPath}`
}

export default function TicketsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [userName, setUserName] = useState("")
  const [bookingComplete, setBookingComplete] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [username, setUsername] = useState<string>("")
  const [points, setPoints] = useState<number>(0)
  const [recommendedPlace, setRecommendedPlace] = useState<string | null>(null)
  const router = useRouter()
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedRef = useRef(false)

  // New states for the enhanced integrated experience
  const [userJourney, setUserJourney] = useState<{
    chatbotUsed: boolean;
    ticketsBooked: number;
    memoriesUploaded: number;
    safetyReports: number;
    arGuideUsed: boolean;
  }>({
    chatbotUsed: false,
    ticketsBooked: 0,
    memoriesUploaded: 0,
    safetyReports: 0,
    arGuideUsed: false
  })
  const [relatedAttractions, setRelatedAttractions] = useState<any[]>([])
  const [crowdInsights, setCrowdInsights] = useState<any>(null)
  const [recentUserActivities, setRecentUserActivities] = useState<any[]>([])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  }

  // Get user's location and profile on component mount
  useEffect(() => {
    // Get username from localStorage
    const storedPreferences = localStorage.getItem("travelPreferences")
    if (storedPreferences) {
      const preferences = JSON.parse(storedPreferences)
      if (preferences.username) {
        setUsername(preferences.username)
        setUserName(preferences.username)
        fetchUserData(preferences.username)
        fetchUserJourneyData(preferences.username) // New function to get integrated user journey data
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting location:", error)
        },
      )
    }

    // Check for a recommended place in sessionStorage (set by chatbot)
    const recPlace = sessionStorage.getItem("recommendedPlace")
    if (recPlace) {
      setRecommendedPlace(recPlace)
      setSearchQuery(recPlace)
      sessionStorage.removeItem("recommendedPlace")
      // Update user journey - chatbot has been used
      setUserJourney(prev => ({ ...prev, chatbotUsed: true }))
    }
  }, [])

  // New function to fetch comprehensive user data across features
  const fetchUserJourneyData = async (user: string) => {
    try {
      // This would be implemented to fetch data from various endpoints
      // and compile a comprehensive view of the user's activities
      const userJourneyData = {
        chatbotUsed: false,
        ticketsBooked: 0,
        memoriesUploaded: 0,
        safetyReports: 0,
        arGuideUsed: false
      }

      // Example: fetch tickets data
      const ticketsResponse = await fetch(getApiUrl(`user/${user}/tickets`)).catch(() => null)
      if (ticketsResponse?.ok) {
        const ticketsData = await ticketsResponse.json()
        userJourneyData.ticketsBooked = ticketsData.count || 0
      }

      // Example: fetch memories data
      const memoriesResponse = await fetch(getApiUrl(`memories/${user}`)).catch(() => null)
      if (memoriesResponse?.ok) {
        const memoriesData = await memoriesResponse.json()
        userJourneyData.memoriesUploaded = memoriesData.length || 0
        
        // Get recent activities for the activity feed
        const recentActivities = memoriesData.slice(0, 3).map((memory: any) => ({
          type: 'memory',
          title: memory.location_name || 'A location',
          timestamp: new Date().toISOString(),
          points: memory.points_earned || 5
        }))
        setRecentUserActivities(recentActivities)
      }

      // Example: fetch safety reports
      const safetyResponse = await fetch(getApiUrl(`safety/reports`)).catch(() => null)
      if (safetyResponse?.ok) {
        const safetyData = await safetyResponse.json()
        userJourneyData.safetyReports = safetyData.filter((report: any) => report.username === user).length
      }

      setUserJourney(userJourneyData)
    } catch (error) {
      console.error("Error fetching user journey data:", error)
    }
  }

  const fetchUserData = async (user: string) => {
    try {
      const response = await fetch(getApiUrl(`users/${user}`))
      if (response.ok) {
        const userData = await response.json()
        setPoints(userData.points || 0)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setErrorMessage(null)
    setSearchResult(null)
    setRouteInfo(null)

    // Create the base URL for search
    let searchUrl = getApiUrl(`search?place=${encodeURIComponent(searchQuery)}`)

    // Add user location if available
    if (userLocation) {
      searchUrl += `&origin_lat=${userLocation.lat}&origin_lon=${userLocation.lon}`
    }

    fetch(searchUrl)
      .then((response) => response.json())
      .then((data) => {
        setLoading(false)
        if (data.error) {
          setErrorMessage(data.error)
          return
        }
        setSearchResult(data)

        // If the response contains route_info, set it as routeInfo state
        if (data.route_info) {
          setRouteInfo(data.route_info)
        }
        // If we have user location and data.location but no route_info, fetch it separately
        else if (userLocation && data.location && !data.route_info) {
          fetchRouteInfo(userLocation.lat, userLocation.lon, data.location.latitude, data.location.longitude)
        }
        
        // Fetch nearby attractions for recommendations
        if (data.location) {
          fetchNearbyAttractions(data.location.latitude, data.location.longitude)
          fetchCrowdInsights(data.location.latitude, data.location.longitude)
        }
      })
      .catch((error) => {
        setLoading(false)
        setErrorMessage("An error occurred while searching")
        console.error(error)
      })
  }

  // New function to fetch nearby attractions
  const fetchNearbyAttractions = async (lat: number, lon: number) => {
    try {
      const response = await fetch(getApiUrl(`nearby_places?lat=${lat}&lon=${lon}`))
      if (response.ok) {
        const data = await response.json()
        if (data.places && Array.isArray(data.places)) {
          setRelatedAttractions(data.places.slice(0, 3)) // Limit to 3 attractions
        }
      }
    } catch (error) {
      console.error("Error fetching nearby attractions:", error)
    }
  }

  // New function to fetch crowd insights
  const fetchCrowdInsights = async (lat: number, lon: number) => {
    try {
      const response = await fetch(getApiUrl(`check_activity?lat=${lat}&lon=${lon}`))
      if (response.ok) {
        const data = await response.json()
        setCrowdInsights(data)
      }
    } catch (error) {
      console.error("Error fetching crowd insights:", error)
    }
  }

  const fetchRouteInfo = (originLat: number, originLon: number, destLat: number, destLon: number) => {
    setRouteLoading(true)
    fetch(
      getApiUrl(
        `route_distance?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}`,
      ),
    )
      .then((response) => response.json())
      .then((data) => {
        setRouteLoading(false)
        if (data.error) {
          console.error("Route error:", data.error)
          return
        }
        setRouteInfo(data)
      })
      .catch((error) => {
        setRouteLoading(false)
        console.error("Route fetch error:", error)
      })
  }

  const handleAutocomplete = (query: string) => {
    setSearchQuery(query)
    selectedRef.current = false

    if (!query.trim()) {
    }

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set a new timeout to debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      if (!selectedRef.current) {
        fetchSuggestions(query)
      }
    }, 300) // 300ms debounce
  }

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await fetch(getApiUrl(`autocomplete?query=${encodeURIComponent(query)}`))
      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setShowSuggestions(true)
    } catch (error) {
      console.error("Autocomplete error:", error)
      setSuggestions([])
    }
  }

  const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
    selectedRef.current = true
    setSearchQuery(suggestion.label)
    setShowSuggestions(false)

    // Optional: Focus somewhere else or blur input to prevent reopening
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }

  const handleBookTicket = () => {
    if (!searchResult || !userName.trim()) return

    setLoading(true)

    fetch(getApiUrl(`book`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place: searchResult.name, user_name: userName }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Booking failed")
        return response.blob()
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.style.display = "none"
        a.href = url
        a.download = "ticket_qr.png"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        setBookingComplete(true)
        setLoading(false)
        
        // Update user journey - increment tickets booked
        setUserJourney(prev => ({
          ...prev,
          ticketsBooked: prev.ticketsBooked + 1
        }))
        
        // Refetch user data to update points
        if (username) {
          fetchUserData(username)
        }
      })
      .catch((error) => {
        setLoading(false)
        setErrorMessage("Failed to book ticket: " + error.message)
      })
  }

  const getCrowdDensityBadgeClass = (density: string) => {
    switch (density.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-stone-100 text-stone-800 border-stone-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <Link href="/">
            <span className="font-semibold text-amber-900">HeritEdge</span>
            </Link>
          </div>

          {/* User points/rewards badge */}
          {username && (
            <div className="flex items-center bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Award className="h-4 w-4 text-amber-600 mr-2" />
              <span className="text-sm font-medium text-amber-800">{points} points</span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Link href="/destinations" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Destinations
            </Link>
            <Link href="/experiences" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Experiences
            </Link>
            <Link href="/dashboard" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Journey Stepper with active state */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex items-center justify-center gap-2 text-xs md:text-sm">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${userJourney.chatbotUsed ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
              <MessageCircle className="h-4 w-4" /> 
              <span>Chatbot</span>
              {userJourney.chatbotUsed && <span className="ml-1">✓</span>}
            </div>
            <span className="mx-1">→</span>
            <div className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-md text-amber-700 font-medium">
              <Ticket className="h-4 w-4" /> 
              <span>Book Tickets</span>
              <Badge variant="outline" className="ml-1 h-5 bg-white text-amber-700 text-xs">Active</Badge>
            </div>
            <span className="mx-1">→</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${userJourney.memoriesUploaded > 0 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
              <CameraIcon className="h-4 w-4" /> 
              <span>Memories</span>
              {userJourney.memoriesUploaded > 0 && <span className="ml-1 text-xs">({userJourney.memoriesUploaded})</span>}
            </div>
            <span className="mx-1">→</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${userJourney.safetyReports > 0 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
              <Shield className="h-4 w-4" /> 
              <span>Safety</span>
              {userJourney.safetyReports > 0 && <span className="ml-1 text-xs">({userJourney.safetyReports})</span>}
            </div>
            <span className="mx-1">→</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${userJourney.arGuideUsed ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
              <Lightbulb className="h-4 w-4" /> 
              <span>AR Guide</span>
              {userJourney.arGuideUsed && <span className="ml-1">✓</span>}
            </div>
          </div>
        </div>

        {/* User journey progress card */}
        {username && (
          <div className="max-w-4xl mx-auto mb-6">
            <Card className="bg-white/70 border-amber-100">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-md text-amber-900">Your Heritage Journey</CardTitle>
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">View Full Journey</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Cultural Explorer Level</span>
                    <span className="font-medium text-amber-700">{points < 50 ? 'Novice' : points < 100 ? 'Explorer' : points < 200 ? 'Expert' : 'Master'}</span>
                  </div>
                  <Progress value={Math.min((points % 50) / 50 * 100, 100)} className="h-2 bg-amber-100" />
                  <div className="flex justify-between text-xs text-stone-500 pt-1">
                    <span>{points} points</span>
                    <span>{Math.ceil(points / 50) * 50} points</span>
                  </div>
                </div>

                {/* Recent activity feed */}
                {recentUserActivities.length > 0 && (
                  <div className="mt-4 border-t border-amber-100 pt-3">
                    <h4 className="text-sm font-medium text-amber-800 flex items-center gap-2 mb-2">
                      <History className="h-4 w-4" /> Recent Activities
                    </h4>
                    <div className="space-y-2">
                      {recentUserActivities.map((activity, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-stone-600">{activity.title}</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">+{activity.points} points</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Intro */}
        <div className="max-w-2xl mx-auto mb-8 text-center">
          <div className="bg-white/70 rounded-lg p-4 shadow-sm border border-amber-100">
            <p className="text-amber-900 font-semibold">
              Book tickets for attractions recommended by your AI assistant.
              <span className="block text-amber-700 font-normal text-sm mt-1">
                Plan, book, visit, and capture memories—all in one seamless journey.
              </span>
            </p>
          </div>
        </div>
        
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <Card className="shadow-lg overflow-hidden border border-amber-200">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
              <div className="flex justify-between items-center">
                <Link href="/chatbot">
                  <Button variant="ghost" className="text-white p-0 hover:bg-amber-700/50">
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    <span>Back</span>
                  </Button>
                </Link>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  India Tourism Ticket Booking
                </CardTitle>
                <div className="w-[76px]"></div> {/* Spacer for alignment */}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                <motion.div variants={itemVariants} className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-amber-600" />
                    <h3 className="font-medium text-amber-900">Search for Tourist Attractions</h3>
                    {recommendedPlace && (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 border-none">
                        Recommended by Chatbot
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      placeholder="Search for a tourist attraction in India..."
                      value={searchQuery}
                      onChange={(e) => handleAutocomplete(e.target.value)}
                      onFocus={() => !selectedRef.current && searchQuery.trim() && fetchSuggestions(searchQuery)}
                      onBlur={() => {
                        // Delay hiding suggestions to allow click on suggestion
                        setTimeout(() => setShowSuggestions(false), 200)
                      }}
                      className="w-full border-amber-200 focus-visible:ring-amber-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSearch()
                        }
                      }}
                    />

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-amber-100 max-h-60 overflow-auto">
                        {suggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-amber-50 cursor-pointer transition-colors"
                            onMouseDown={(e) => {
                              // Prevent input from losing focus before click is processed
                              e.preventDefault()
                              selectSuggestion(suggestion)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0" />
                              <span>{suggestion.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleSearch}
                    disabled={loading || !searchQuery.trim()}
                    className="w-full mt-3 bg-amber-700 hover:bg-amber-800 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </motion.div>

                <AnimatePresence>
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 bg-red-50 text-red-800 rounded-md flex items-start gap-3 border border-red-200"
                    >
                      <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Error</p>
                        <p>{errorMessage}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {searchResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="space-y-6"
                    >
                      <Tabs defaultValue="details" className="w-full">
                        <TabsList className="mb-4 bg-amber-50 border border-amber-100">
                          <TabsTrigger value="details">Details & Map</TabsTrigger>
                          <TabsTrigger value="experience">Experience</TabsTrigger>
                          <TabsTrigger value="insights">Visitor Insights</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="space-y-4">
                          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-100">
                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-amber-900">
                              <MapPin className="h-5 w-5 text-amber-600" />
                              {searchResult.name}
                            </h3>

                            {searchResult.location && (
                              <div className="mt-4 rounded-md overflow-hidden border border-amber-200">
                                <motion.div
                                  initial={{ opacity: 0, scale: 1.05 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.5 }}
                                  className="w-full h-[400px]"
                                >
                                  <iframe 
                                    width="100%" 
                                    height="100%"                                
                                    src={`https://maps.google.com/maps?width=100%&height=600&hl=en&q=${searchResult.location.latitude},${searchResult.location.longitude}+(${encodeURIComponent(searchResult.name)})&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
                                    title={`Map of ${searchResult.name}`}
                                    className="rounded-md"
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                  />
                                </motion.div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                              <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm">
                                <div className="text-sm text-stone-500 mb-1">Crowd Density</div>
                                <Badge variant="outline" className={getCrowdDensityBadgeClass(searchResult.crowd_density)}>
                                  {searchResult.crowd_density}
                                </Badge>
                              </div>

                              <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm">
                                <div className="text-sm text-stone-500 mb-1">Dynamic Price</div>
                                <div className="text-lg font-semibold text-amber-700">
                                  ₹{searchResult.dynamic_price.toFixed(2)}
                                </div>
                              </div>

                              {(searchResult.route_info || routeInfo) && (
                                <>
                                  <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm">
                                    <div className="text-sm text-stone-500 mb-1">Distance</div>
                                    <div className="flex items-center gap-1 font-medium text-amber-900">
                                      <Navigation className="h-4 w-4 text-amber-600" />
                                      <span>{searchResult.route_info?.distance.text || routeInfo?.distance.text}</span>
                                    </div>
                                  </div>

                                  <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm">
                                    <div className="text-sm text-stone-500 mb-1">Travel Time</div>
                                    <div className="flex items-center gap-1 font-medium text-amber-900">
                                      <Clock className="h-4 w-4 text-amber-600" />
                                      <span>{searchResult.route_info?.duration.text || routeInfo?.duration.text}</span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="mt-6">
                              <div className="text-sm text-stone-500 mb-2">Expert Recommendation</div>
                              <div className="bg-amber-50 border border-amber-100 rounded-md p-4 text-amber-800">
                                {searchResult.recommendation}
                              </div>
                            </div>

                            {userLocation && searchResult.location && (
                              <div className="mt-6">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${searchResult.location.latitude},${searchResult.location.longitude}&travelmode=driving`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-md transition-colors"
                                >
                                  <Navigation className="h-4 w-4 mr-2" /> Get Directions
                                </a>
                              </div>
                            )}

                            {/* Cross-links to other features - Enhanced with badges showing benefits */}
                            <div className="mt-8 space-y-3">
                              <h4 className="font-medium text-amber-900 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-600" />
                                Continue Your Journey
                              </h4>
                              <div className="flex flex-wrap gap-3">
                                <Link href={`/chatbot`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                  >
                                    <MessageCircle className="h-4 w-4 mr-1" />
                                    Ask AI Guide
                                    <Badge className="ml-2 bg-green-100 text-green-700 border-none">+10 pts</Badge>
                                  </Button>
                                </Link>
                                <Link href={`/safety?place=${encodeURIComponent(searchResult.name)}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                  >
                                    <Shield className="h-4 w-4 mr-1" />
                                    Safety Info
                                    <Badge className="ml-2 bg-green-100 text-green-700 border-none">+5 pts</Badge>
                                  </Button>
                                </Link>
                                <Link href={`/memory?place=${encodeURIComponent(searchResult.name)}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                  >
                                    <CameraIcon className="h-4 w-4 mr-1" />
                                    Upload Memory
                                    <Badge className="ml-2 bg-green-100 text-green-700 border-none">+15 pts</Badge>
                                  </Button>
                                </Link>
                                <Link href={`/ar-guide?place=${encodeURIComponent(searchResult.name)}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                  >
                                    <Lightbulb className="h-4 w-4 mr-1" />
                                    AR Guide
                                    <Badge className="ml-2 bg-green-100 text-green-700 border-none">+20 pts</Badge>
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="experience" className="space-y-4">
                          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-100">
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-amber-900">
                              <Camera className="h-5 w-5 text-amber-600" />
                              Experience in VR
                            </h4>
                            
                            {searchResult.vr_videos && searchResult.vr_videos.length > 0 ? (
                              <div className="space-y-4">
                                {searchResult.vr_videos.map((video, index) => (
                                  <div
                                    key={index}
                                    className="border border-amber-200 rounded-md overflow-hidden shadow-sm"
                                  >
                                    <div className="bg-amber-50 p-3 border-b border-amber-200">
                                      <h5 className="font-medium text-amber-900">{video.title}</h5>
                                    </div>
                                    <div style={{ height: "400px" }}>
                                      <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${video.video_id}?autoplay=0&controls=1&rel=0&modestbranding=1`}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      ></iframe>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center p-8 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-amber-700">No VR experiences available for this location yet.</p>
                                <Button className="mt-4 bg-amber-600 hover:bg-amber-700">
                                  <Camera className="h-4 w-4 mr-2" />
                                  Upload Your Own VR Experience
                                </Button>
                              </div>
                            )}
                            
                            {/* User memories integration */}
                            <div className="mt-8 border-t border-amber-100 pt-6">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                                  <BookOpen className="h-5 w-5 text-amber-600" />
                                  Community Memories
                                </h4>
                                <Link href={`/memory?place=${encodeURIComponent(searchResult.name)}`}>
                                  <Button variant="outline" size="sm">View All</Button>
                                </Link>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* This would show actual user memories for this location */}
                                <div className="aspect-square bg-amber-50 rounded-md flex items-center justify-center border border-amber-200">
                                  <div className="text-center p-4">
                                    <CameraIcon className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                                    <p className="text-sm text-amber-700">Share your experience at this location</p>
                                    <Link href={`/memory?place=${encodeURIComponent(searchResult.name)}`}>
                                      <Button size="sm" className="mt-2 bg-amber-600 hover:bg-amber-700">
                                        Upload Memory
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="insights" className="space-y-4">
                          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-100">
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-amber-900">
                              <Calendar className="h-5 w-5 text-amber-600" />
                              Best Time to Visit
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                <h5 className="text-sm font-medium text-amber-800 mb-2">Peak Season</h5>
                                <p className="text-stone-600">October - March</p>
                                <Badge className="mt-2 bg-red-100 text-red-700 border-none">High Crowd</Badge>
                              </div>
                              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                <h5 className="text-sm font-medium text-amber-800 mb-2">Optimal Visit</h5>
                                <p className="text-stone-600">January - February</p>
                                <Badge className="mt-2 bg-amber-100 text-amber-700 border-none">Medium Crowd</Badge>
                              </div>
                              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                <h5 className="text-sm font-medium text-amber-800 mb-2">Off Season</h5>
                                <p className="text-stone-600">June - September</p>
                                <Badge className="mt-2 bg-green-100 text-green-700 border-none">Low Crowd</Badge>
                              </div>
                            </div>
                            
                            {/* Live crowd intelligence */}
                            {crowdInsights && (
                              <div className="mt-6 border-t border-amber-100 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-amber-600" />
                                    Live Visitor Insights
                                  </h4>
                                  <Badge className="bg-blue-100 text-blue-700 border-none">
                                    Live Data
                                  </Badge>
                                </div>
                                
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <h5 className="text-sm font-medium text-blue-800">Current Crowd</h5>
                                      <div className="flex items-center mt-1">
                                        <Badge className={`
                                          ${crowdInsights.status === 'low' ? 'bg-green-100 text-green-700' : 
                                            crowdInsights.status === 'medium' ? 'bg-amber-100 text-amber-700' : 
                                            'bg-red-100 text-red-700'} 
                                          border-none mr-2`}
                                        >
                                          {crowdInsights.status.charAt(0).toUpperCase() + crowdInsights.status.slice(1)}
                                        </Badge>
                                        <span className="text-sm text-stone-600">
                                          ~{crowdInsights.device_count} visitors now
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="text-right">
                                      <span className="text-xs text-stone-500">Last updated:</span>
                                      <p className="text-sm text-stone-600">
                                        {new Date(crowdInsights.timestamp).toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Related safety alerts if any */}
                                {crowdInsights.top_incidents && crowdInsights.top_incidents.length > 0 && (
                                  <div className="mt-4">
                                    <h5 className="text-sm font-medium text-amber-800 mb-2">Active Alerts</h5>
                                    <div className="space-y-2">
                                      {crowdInsights.top_incidents.map((incident:any, i:any) => (
                                        <Alert key={i} className="bg-amber-50 border-amber-200">
                                          <AlertTitle className="text-amber-800 text-sm font-medium">
                                            {incident.description}
                                          </AlertTitle>
                                          <AlertDescription className="text-amber-700 text-xs">
                                            {incident.fullDesc?.substring(0, 100) || "No additional details"}
                                          </AlertDescription>
                                        </Alert>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Related attractions nearby */}
                            {relatedAttractions.length > 0 && (
                              <div className="mt-6 border-t border-amber-100 pt-6">
                                <h4 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
                                  <MapPin className="h-5 w-5 text-amber-600" />
                                  Nearby Attractions
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {relatedAttractions.map((attraction, i) => (
                                    <div key={i} className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm">
                                      <h5 className="font-medium text-amber-900 mb-1">{attraction.name}</h5>
                                      <div className="text-xs text-stone-500 mb-2">{attraction.categories.join(', ')}</div>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full mt-2"
                                        onClick={() => {
                                          setSearchQuery(attraction.name);
                                          handleSearch();
                                        }}
                                      >
                                        View Details
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-100">
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-amber-900">
                          <Ticket className="h-5 w-5 text-amber-600" />
                          Book Your Ticket
                        </h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label htmlFor="userName" className="text-sm text-stone-500">
                              Your Full Name
                            </label>
                            <Input
                              id="userName"
                              placeholder="Enter your name"
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              className="border-amber-200 focus-visible:ring-amber-500"
                            />
                          </div>

                          <Button
                            onClick={handleBookTicket}
                            disabled={loading || !userName.trim() || bookingComplete}
                            className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Ticket className="h-4 w-4 mr-2" />
                                Book Ticket & Download QR
                              </>
                            )}
                          </Button>

                          <AnimatePresence>
                            {bookingComplete && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-md"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="bg-green-100 p-1 rounded-full">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5 text-green-600"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                  <p className="font-medium">Booking complete!</p>
                                </div>
                                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-3">
                                  <p className="text-sm">
                                    QR ticket has been downloaded. Continue your journey with HeritEdge:
                                  </p>
                                  <div className="flex space-x-2">
                                    <Link href="/memory">
                                      <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-100">
                                        <Camera className="h-3 w-3 mr-1" />
                                        Upload Memory
                                      </Button>
                                    </Link>
                                    <Link href="/ar-guide">
                                      <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-100">
                                        <Lightbulb className="h-3 w-3 mr-1" />
                                        AR Guide
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </CardContent>

            <CardFooter className="border-t border-amber-100 p-4 text-sm text-stone-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span>Dynamic pricing based on real-time crowd density data. Prices may vary.</span>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-amber-700 mr-2" />
            <span className="text-lg font-semibold text-stone-800">HeritEdge</span>
          </div>
          <p className="text-stone-600 text-sm">© {new Date().getFullYear()} HeritEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
