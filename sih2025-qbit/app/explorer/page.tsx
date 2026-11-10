"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Compass,
  Search,
  Loader2,
  MapPin,
  Star,
  TrendingUp,
  Users,
  Clock,
  Navigation2,
  Sparkles,
  Globe,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Recommendation, SearchResult, SearchPerformanceStats } from "@/services/apiService"
import APIService from "@/services/apiService"

const DEMO_USER_ID = "explorer-demo"

type ExplorerSearchMetadata = {
  search_time_ms?: number
  algorithm?: string
  personalized?: boolean
  [key: string]: number | string | boolean | undefined | null
}

type NearbyPlace = {
  name: string
  latitude: number
  longitude: number
  category?: string
  distance_km?: number
}

const curatedCollections = [
  {
    title: "Living Heritage Walks",
    description: "Follow expert-led walks through centuries-old bazaars, stepwells, and artisan guilds.",
    highlights: ["Chandni Chowk Legacy Trail", "Ahmadabad Pol Houses", "Pondicherry Heritage Quarter"],
    tone: "from-amber-50 to-amber-100",
  },
  {
    title: "Spiritual Circuits",
    description: "Experience sunrise rituals, sacred river ghats, and evening chants across India's temple towns.",
    highlights: ["Varanasi Sunrise Arti", "Ayodhya Ram Path", "Ujjain Mahakal Jyotirlinga"],
    tone: "from-emerald-50 to-emerald-100",
  },
  {
    title: "Festival Immersions",
    description: "Plan travel around living traditions—music, dance, and community celebrations in their true homes.",
    highlights: ["Pushkar Camel Fair", "Hornbill Festival", "Thrissur Pooram"],
    tone: "from-sky-50 to-sky-100",
  },
]

const explorerTips = [
  {
    title: "Local Moments",
    description: "Save favourites and we will surface language tips, social cues, and what to gift your hosts.",
  },
  {
    title: "Sustainable Travel",
    description: "See low-footprint transit options and carbon impact before you confirm a journey.",
  },
  {
    title: "Community Signals",
    description: "Stay aware with live crowd insights, safety heatmaps, and women-led reviews.",
  },
]

export default function ExplorerPage() {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; category: string; rating: number; search_type: string }>
  >([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [stats, setStats] = useState<SearchPerformanceStats | null>(null)
  const [searching, setSearching] = useState(false)
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSearchMeta, setLastSearchMeta] = useState<ExplorerSearchMetadata | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])

  const initialSearchDone = useRef(false)

  const handleSearch = useCallback(
    async (term?: string, options?: { skipTracking?: boolean }) => {
      const searchTerm = (term ?? query).trim()
      if (!searchTerm) {
        setError("Enter a place, festival, or theme to explore.")
        return
      }

      setSearching(true)
      setError(null)

      try {
        const data = await APIService.searchPlaces(searchTerm, {
          user_id: DEMO_USER_ID,
          limit: 12,
        })

        setResults(data?.results ?? [])
        if (data?.metadata && typeof data.metadata === "object") {
          setLastSearchMeta(data.metadata as ExplorerSearchMetadata)
        } else {
          setLastSearchMeta(null)
        }

        if (!options?.skipTracking) {
          APIService.recordUserInteraction({
            user_id: DEMO_USER_ID,
            place_name: searchTerm,
            interaction_type: "search",
          }).catch((err) => console.warn("Failed to record search interaction", err))
        }
      } catch (err) {
        console.error("Explorer search failed", err)
        setResults([])
        setError("We couldn't fetch destinations right now. Please try again in a moment.")
      } finally {
        setSearching(false)
      }
    },
    [query],
  )

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [recommendationData, performanceData] = await Promise.all([
          APIService.getRecommendations(DEMO_USER_ID, { limit: 6 }),
          APIService.getSearchPerformance(),
        ])

        setRecommendations(recommendationData?.recommendations ?? [])
        setStats(performanceData)
      } catch (err) {
        console.error("Failed to bootstrap explorer data", err)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    const timeout = setTimeout(async () => {
      setSuggestionsLoading(true)
      try {
        const suggestionData = await APIService.getAutocomplete(query, 6)
        setSuggestions(suggestionData?.suggestions ?? [])
      } catch (err) {
        console.error("Failed to load suggestions", err)
      } finally {
        setSuggestionsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    if (!stats || initialSearchDone.current) return

    const topQuery = stats.performance_stats?.popular_searches?.[0]?.[0]
    if (!topQuery) return

    initialSearchDone.current = true
    setQuery(topQuery)
    handleSearch(topQuery, { skipTracking: true })
  }, [stats, handleSearch])

  const handleSuggestionClick = (value: string) => {
    setQuery(value)
    handleSearch(value)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNearbyError("Geolocation isn't supported in this browser.")
      return
    }

    setNearbyError(null)
    setNearbyLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const nearbyData = await APIService.findNearby(latitude, longitude, { limit: 6, radius: 15 })
          const normalizedPlaces: NearbyPlace[] = Array.isArray(nearbyData?.places)
            ? nearbyData.places
                .map((place): NearbyPlace | null => {
                  if (!place || typeof place !== "object") return null
                  const record = place as Record<string, unknown>
                  const latitudeValue = record.latitude
                  const longitudeValue = record.longitude
                  const distanceValue = record.distance_km

                  return {
                    name: typeof record.name === "string" ? record.name : "Cultural site",
                    latitude:
                      typeof latitudeValue === "number"
                        ? latitudeValue
                        : Number(typeof latitudeValue === "string" ? latitudeValue : 0),
                    longitude:
                      typeof longitudeValue === "number"
                        ? longitudeValue
                        : Number(typeof longitudeValue === "string" ? longitudeValue : 0),
                    category: typeof record.category === "string" ? record.category : undefined,
                    distance_km:
                      typeof distanceValue === "number"
                        ? distanceValue
                        : typeof distanceValue === "string" && distanceValue.trim() !== ""
                          ? Number(distanceValue)
                          : undefined,
                  }
                })
                .filter((place): place is NearbyPlace => place !== null)
            : []
          setNearbyPlaces(normalizedPlaces)
        } catch (err) {
          console.error("Failed to fetch nearby places", err)
          setNearbyError("Couldn't load nearby cultural spots. Try again later.")
        } finally {
          setNearbyLoading(false)
        }
      },
      (geoError) => {
        console.error("Geolocation error", geoError)
        setNearbyLoading(false)
        setNearbyError(geoError.message || "We couldn't access your location.")
      },
      { enableHighAccuracy: true },
    )
  }

  const renderResultCard = (result: SearchResult) => {
    const { place, relevance_score, distance_km, search_type } = result

    return (
      <Card key={`${place.name}-${place.latitude}-${place.longitude}`} className="border border-amber-200/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-stone-800">{place.name}</CardTitle>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{place.category || "Heritage"}</Badge>
          </div>
          <CardDescription className="text-stone-600">
            Relevance score {(relevance_score ?? 0).toFixed(2)} · {search_type === "text" ? "Semantic match" : "Discovery"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span>
              {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
            </span>
            {typeof distance_km === "number" && (
              <span className="text-stone-500">· {(distance_km ?? 0).toFixed(1)} km away</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <Star className="h-4 w-4 text-amber-500" />
            <span>{place.rating ? `${place.rating.toFixed(1)} traveller rating` : "New cultural listing"}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <span className="font-semibold text-amber-900">HeritEdge</span>
          </div>

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

      <div className="container mx-auto px-4 py-10 space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-amber-200 bg-white/90 shadow-lg"
        >
          <div className="grid gap-8 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-12">
            <div className="space-y-6">
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Destination Explorer</Badge>
              <h1 className="text-3xl font-bold text-stone-900 md:text-4xl">
                Discover cultural stories, rituals, and community-led journeys in minutes
              </h1>
              <p className="text-lg text-stone-600">
                Search any city, festival, or theme to uncover curated itineraries, safety intelligence, and sustainable
                ways to experience heritage spaces.
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  handleSearch()
                }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for Varanasi ghats, Hornbill Festival, heritage walks..."
                    className="h-12 rounded-full border-amber-200 pl-9 text-stone-800 focus-visible:ring-amber-500"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 rounded-full bg-amber-700 px-6 text-white hover:bg-amber-800"
                  disabled={searching}
                >
                  {searching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      <Compass className="mr-2 h-4 w-4" />
                      Explore now
                    </>
                  )}
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {suggestionsLoading && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                {!suggestionsLoading &&
                  suggestions.map((suggestion) => (
                    <Button
                      key={`${suggestion.name}-${suggestion.search_type}`}
                      type="button"
                      variant="outline"
                      onClick={() => handleSuggestionClick(suggestion.name)}
                      className="rounded-full border-amber-200 bg-white text-sm text-amber-700 hover:bg-amber-50"
                    >
                      {suggestion.name}
                    </Button>
                  ))}
              </div>

              {lastSearchMeta && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-amber-600" /> Optimized in
                    {lastSearchMeta?.search_time_ms !== undefined
                      ? ` ${lastSearchMeta.search_time_ms.toFixed(2)} ms`
                      : " --"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-amber-600" /> Collaborative + semantic recommendations
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-amber-600" /> Cache hit rate {(stats?.performance_stats?.cache_hit_rate ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100 p-6 shadow-inner"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-semibold">Explorer tips</span>
                </div>
                <div className="space-y-4">
                  {explorerTips.map((tip) => (
                    <Card key={tip.title} className="border border-amber-100 bg-white/70 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-stone-800">{tip.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-stone-600">{tip.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">Cultural discoveries</h2>
            {searching && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!searching && results.length === 0 && (
            <Card className="border border-amber-200 bg-white/70">
              <CardContent className="py-10 text-center">
                <p className="text-stone-600">
                  Start with a specific search—try <span className="font-semibold text-amber-700">Varanasi ghats</span>,
                  <span className="font-semibold text-amber-700"> textile clusters Surat</span>, or
                  <span className="font-semibold text-amber-700"> Hornbill Festival itinerary</span>.
                </p>
              </CardContent>
            </Card>
          )}

          {results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map(renderResultCard)}</div>
          )}
        </section>

        {recommendations.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-stone-900">Personalised inspiration</h2>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Using your explorer profile</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((item) => (
                <Card key={`${item.name}-${item.latitude}`} className="border border-emerald-100/80 bg-white/80 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-stone-800">{item.name}</CardTitle>
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{item.category}</Badge>
                    </div>
                    <CardDescription className="text-stone-600">
                      Relevance {(item.relevance_score ?? 0).toFixed(2)} · {item.recommendation_type.replace("_", " ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-stone-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span>
                        {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-emerald-500" />
                      <span>{item.rating ? `${item.rating.toFixed(1)} explorer rating` : "Emerging cultural spot"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {stats?.performance_stats?.popular_searches?.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-stone-900">Trending cultural themes</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stats.performance_stats.popular_searches.slice(0, 6).map(([topic, count]) => (
                <Card key={topic} className="border border-amber-100 bg-white/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-stone-800">
                      <TrendingUp className="h-5 w-5 text-amber-600" /> {topic}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-stone-600">Searched {count} times this week</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSuggestionClick(topic)}
                      className="rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      Explore this theme
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-stone-900">Curated explorer collections</h2>
            <Navigation2 className="h-5 w-5 text-amber-600" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {curatedCollections.map((collection) => (
              <Card
                key={collection.title}
                className={`border border-amber-100 bg-gradient-to-br ${collection.tone} via-white shadow-sm`}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-stone-900">{collection.title}</CardTitle>
                  <CardDescription className="text-stone-600">{collection.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {collection.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-2 text-sm text-stone-700">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">Nearby heritage radar</h2>
              <p className="text-sm text-stone-600">Use your location to surface calm hours, verified guides, and community hosts.</p>
            </div>
            <Button
              type="button"
              onClick={handleUseCurrentLocation}
              className="rounded-full border border-amber-200 bg-white text-amber-700 hover:bg-amber-600 hover:text-white"
              variant="outline"
              disabled={nearbyLoading}
            >
              {nearbyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Locating you
                </>
              ) : (
                <>
                  <Navigation2 className="mr-2 h-4 w-4" /> Use my location
                </>
              )}
            </Button>
          </div>
          {nearbyError && <p className="text-sm text-red-600">{nearbyError}</p>}
          {nearbyPlaces.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {nearbyPlaces.map((place) => (
                <Card key={`${place.name}-${place.latitude}`} className="border border-amber-100 bg-white/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-stone-800">{place.name}</CardTitle>
                    <CardDescription className="text-stone-600 capitalize">{place.category || "cultural spot"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-stone-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-amber-600" />
                      <span>
                        {Number(place.latitude).toFixed(2)}, {Number(place.longitude).toFixed(2)}
                      </span>
                    </div>
                    {place.distance_km && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span>{Number(place.distance_km).toFixed(1)} km away</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
