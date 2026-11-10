"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plane,
  Hotel,
  Car,
  Map,
  Calendar,
  Users,
  Search,
  Loader2,
  Star,
  MapPin,
  Route,
  Building,
  Bus,
  Package,
  AlertCircle,
  Globe,
} from "lucide-react"
import Link from "next/link"

// Travel Services API URL - runs on separate port
const API_BASE_URL = process.env.NEXT_PUBLIC_TRAVEL_API_URL || "http://localhost:5001/api"

type GujaratAirport = {
  code: string
  city: string
  name: string
}

const GUJARAT_AIRPORTS: GujaratAirport[] = [
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International Airport" },
  { code: "STV", city: "Surat", name: "Surat International Airport" },
  { code: "BDQ", city: "Vadodara", name: "Vadodara Airport" },
  { code: "RAJ", city: "Rajkot", name: "Rajkot Airport" },
  { code: "HSR", city: "Rajkot", name: "Rajkot International Airport (Hirasar)" },
  { code: "BHJ", city: "Bhuj", name: "Bhuj Airport" },
  { code: "BHU", city: "Bhavnagar", name: "Bhavnagar Airport" },
  { code: "JGA", city: "Jamnagar", name: "Jamnagar Airport" },
  { code: "IXY", city: "Gandhidham", name: "Kandla Airport" },
  { code: "PBD", city: "Porbandar", name: "Porbandar Airport" },
  { code: "IXK", city: "Keshod", name: "Keshod Airport" },
  { code: "DIU", city: "Diu", name: "Diu Airport" },
]

const GUJARAT_AIRPORT_LIST_ID = "gujarat-airport-options"

const isValidGujaratAirport = (code: string) =>
  !!code && GUJARAT_AIRPORTS.some((airport) => airport.code === code.toUpperCase())

export default function TravelServices() {
  const [activeTab, setActiveTab] = useState("flights")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Reusable form hooks for different services
  const flightForm = useForm()
  const routesForm = useForm()
  const airlinesForm = useForm()
  const amadeusFlightForm = useForm()
  const locationSearchForm = useForm()
  const hotelSearchForm = useForm()
  const activitiesForm = useForm()
  const poiForm = useForm()
  const checkinLinksForm = useForm()
  const tripPurposeForm = useForm()
  const carRentalForm = useForm()
  const transferForm = useForm()
  const connectionPackageForm = useForm()

  // Airport search results for autocomplete functionality
  const [airports, setAirports] = useState<any[]>([])
  const [searchingAirport, setSearchingAirport] = useState(false)

  const searchAirports = async (keyword: string) => {
    if (!keyword || keyword.length < 2) return

    setSearchingAirport(true)
    try {
      const response = await axios.get(`${API_BASE_URL}/amadeus_location_search`, {
        params: { keyword },
      })
      setAirports(response.data)
    } catch (err) {
      console.error("Error searching airports:", err)
    } finally {
      setSearchingAirport(false)
    }
  }

  // Handle API requests
  const fetchData = async (endpoint: string, params: any) => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`${API_BASE_URL}/${endpoint}`, { params })
      setResults(response.data)
      return response.data
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred")
      console.error(`Error fetching ${endpoint}:`, err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Flight search
  const handleFlightSearch = flightForm.handleSubmit(async (data) => {
    const departureCode = (data.depIata || "").toUpperCase()
    const arrivalCode = (data.arrIata || "").toUpperCase()

    if (!isValidGujaratAirport(arrivalCode)) {
      setError("Please select the arrival airport from the Gujarat list.")
      return
    }

    flightForm.setValue("depIata", departureCode)
    flightForm.setValue("arrIata", arrivalCode)

    await fetchData("flights", {
      dep_iata: departureCode,
      arr_iata: arrivalCode,
      limit: data.limit || 10,
      offset: data.offset || 0,
    })
  })

  // Routes search
  const handleRoutesSearch = routesForm.handleSubmit(async (data) => {
    const departureCode = (data.depIata || "").toUpperCase()
    const arrivalCode = (data.arrIata || "").toUpperCase()

    if (!isValidGujaratAirport(arrivalCode)) {
      setError("Routes can only arrive at Gujarat airports from the list.")
      return
    }

    routesForm.setValue("depIata", departureCode)
    routesForm.setValue("arrIata", arrivalCode)

    await fetchData("routes", {
      dep_iata: departureCode,
      arr_iata: arrivalCode,
      limit: data.limit || 10,
      offset: data.offset || 0,
    })
  })

  // Airlines search
  const handleAirlinesSearch = airlinesForm.handleSubmit(async (data) => {
    await fetchData("airlines", {
      airline_name: data.airlineName,
      limit: data.limit || 10,
      offset: data.offset || 0,
    })
  })

  // Amadeus flight search
  const handleAmadeusFlightSearch = amadeusFlightForm.handleSubmit(async (data) => {
    const originCode = (data.origin || "").toUpperCase()
    const destinationCode = (data.destination || "").toUpperCase()

    if (!isValidGujaratAirport(destinationCode)) {
      setError("Please choose a Gujarat destination airport from the dropdown.")
      return
    }

    amadeusFlightForm.setValue("origin", originCode)
    amadeusFlightForm.setValue("destination", destinationCode)

    await fetchData("amadeus_flight_search", {
      origin: originCode,
      destination: destinationCode,
      departure_date: data.departureDate,
      adults: data.adults || 1,
    })
  })

  // Location search
  const handleLocationSearch = locationSearchForm.handleSubmit(async (data) => {
    await fetchData("amadeus_location_search", {
      keyword: data.keyword,
    })
  })

  // Hotel search
  const handleHotelSearch = hotelSearchForm.handleSubmit(async (data) => {
    await fetchData("serpapi_hotel_search", {
      query: data.query,
      check_in_date: data.checkInDate,
      check_out_date: data.checkOutDate,
      adults: data.adults || 2,
      currency: data.currency || "USD",
    })
  })

  // Activities search
  const handleActivitiesSearch = activitiesForm.handleSubmit(async (data) => {
    await fetchData("amadeus_activities", {
      latitude: data.latitude,
      longitude: data.longitude,
      radius: data.radius || 20,
    })
  })

  // Points of interest search
  const handlePOISearch = poiForm.handleSubmit(async (data) => {
    await fetchData("amadeus_points_of_interest", {
      latitude: data.latitude,
      longitude: data.longitude,
    })
  })

  // Check-in links search
  const handleCheckinLinksSearch = checkinLinksForm.handleSubmit(async (data) => {
    await fetchData("amadeus_checkin_links", {
      airline_code: data.airlineCode,
    })
  })

  // Trip purpose prediction
  const handleTripPurposeSearch = tripPurposeForm.handleSubmit(async (data) => {
    await fetchData("amadeus_trip_purpose", {
      origin: data.origin,
      destination: data.destination,
      departure_date: data.departureDate,
      return_date: data.returnDate,
    })
  })

  // Car rental search
  const handleCarRentalSearch = carRentalForm.handleSubmit(async (data) => {
    await fetchData("amadeus_car_rental_search", {
      pickup_location: data.pickupLocation,
      drop_off_location: data.dropOffLocation || data.pickupLocation,
      pickup_date: data.pickupDate,
      pickup_time: data.pickupTime,
      drop_off_date: data.dropOffDate,
      drop_off_time: data.dropOffTime,
      currency_code: data.currencyCode || "USD",
    })
  })

  // Transfer search
  const handleTransferSearch = transferForm.handleSubmit(async (data) => {
    await fetchData("amadeus_transfer_search", {
      pickup_location: data.pickupLocation,
      drop_off_location: data.dropOffLocation,
      date: data.date,
      time: data.time,
      currency_code: data.currencyCode || "USD",
    })
  })

  // Connection package search
  const handleConnectionPackageSearch = connectionPackageForm.handleSubmit(async (data) => {
    await fetchData("amadeus_connection_package", {
      origin: data.origin,
      destination: data.destination,
      departure_date: data.departureDate,
      adults: data.adults || 1,
      currency_code: data.currencyCode || "USD",
    })
  })

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

  // Service categories with icons
  const serviceCategories = [
    { id: "flights", label: "Flights", icon: <Plane className="h-5 w-5" /> },
    { id: "routes", label: "Routes", icon: <Route className="h-5 w-5" /> },
    { id: "airlines", label: "Airlines", icon: <Building className="h-5 w-5" /> },
    { id: "amadeus-flights", label: "Amadeus Flights", icon: <Plane className="h-5 w-5" /> },
    { id: "locations", label: "Locations", icon: <MapPin className="h-5 w-5" /> },
    { id: "hotels", label: "Hotels", icon: <Hotel className="h-5 w-5" /> },
    { id: "activities", label: "Activities", icon: <Map className="h-5 w-5" /> },
    { id: "poi", label: "Points of Interest", icon: <MapPin className="h-5 w-5" /> },
    { id: "checkin", label: "Check-in Links", icon: <Calendar className="h-5 w-5" /> },
    { id: "purpose", label: "Trip Purpose", icon: <Users className="h-5 w-5" /> },
    { id: "car-rental", label: "Car Rental", icon: <Car className="h-5 w-5" /> },
    { id: "transfers", label: "Transfers", icon: <Bus className="h-5 w-5" /> },
    { id: "packages", label: "Connection Packages", icon: <Package className="h-5 w-5" /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <span className="font-semibold text-amber-900">DevYatra</span>
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

      <datalist id={GUJARAT_AIRPORT_LIST_ID}>
        {GUJARAT_AIRPORTS.map((airport) => (
          <option
            key={airport.code}
            value={airport.code}
            label={`${airport.city}, Gujarat (${airport.code}) – ${airport.name}`}
          >
            {`${airport.city}, Gujarat (${airport.code}) – ${airport.name}`}
          </option>
        ))}
      </datalist>

      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold mb-6 text-stone-800">Travel Services Platform</h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="sticky top-20 border border-amber-200">
              <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Services
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col">
                  {serviceCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setActiveTab(category.id)}
                      className={`flex items-center gap-3 p-3 text-left transition-colors ${
                        activeTab === category.id
                          ? "bg-amber-50 text-amber-800 border-l-4 border-amber-600"
                          : "hover:bg-stone-100 border-l-4 border-transparent"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-full ${activeTab === category.id ? "bg-amber-100" : "bg-stone-100"}`}
                      >
                        {category.icon}
                      </div>
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <motion.div
            className="lg:col-span-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="shadow-md border border-amber-200">
              <CardHeader className="border-b border-amber-100">
                <CardTitle className="text-amber-900">
                  {serviceCategories.find((cat) => cat.id === activeTab)?.label || "Travel Services"}
                </CardTitle>
                <CardDescription className="text-stone-600">Search for travel information and services</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Flight Search (Aviation Stack) */}
                    {activeTab === "flights" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Flight Search</h2>
                        <form onSubmit={handleFlightSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Departure Airport (IATA Code)</Label>
                              <Input
                                {...flightForm.register("depIata")}
                                placeholder="e.g. JFK"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Arrival Airport (Gujarat only)</Label>
                              <Input
                                {...flightForm.register("arrIata")}
                                placeholder="Select Gujarat airport"
                                list={GUJARAT_AIRPORT_LIST_ID}
                                autoComplete="off"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                              <p className="text-xs text-stone-500">Start typing to search Gujarat airports.</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Limit</Label>
                              <Input
                                type="number"
                                {...flightForm.register("limit")}
                                placeholder="10"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Offset</Label>
                              <Input
                                type="number"
                                {...flightForm.register("offset")}
                                placeholder="0"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Flights
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Routes Search */}
                    {activeTab === "routes" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Route Search</h2>
                        <form onSubmit={handleRoutesSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Departure Airport (IATA Code)</Label>
                              <Input
                                {...routesForm.register("depIata")}
                                placeholder="e.g. JFK"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Arrival Airport (Gujarat only)</Label>
                              <Input
                                {...routesForm.register("arrIata")}
                                placeholder="Select Gujarat airport"
                                list={GUJARAT_AIRPORT_LIST_ID}
                                autoComplete="off"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                              <p className="text-xs text-stone-500">Choose one of the Gujarat airports from the list.</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Limit</Label>
                              <Input
                                type="number"
                                {...routesForm.register("limit")}
                                placeholder="10"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Offset</Label>
                              <Input
                                type="number"
                                {...routesForm.register("offset")}
                                placeholder="0"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Routes
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Airlines Search */}
                    {activeTab === "airlines" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Airline Search</h2>
                        <form onSubmit={handleAirlinesSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Airline Name</Label>
                              <Input
                                {...airlinesForm.register("airlineName")}
                                placeholder="e.g. American Airlines"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Limit</Label>
                              <Input
                                type="number"
                                {...airlinesForm.register("limit")}
                                placeholder="10"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Offset</Label>
                              <Input
                                type="number"
                                {...airlinesForm.register("offset")}
                                placeholder="0"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Airlines
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Amadeus Flight Search */}
                    {activeTab === "amadeus-flights" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Amadeus Flight Search</h2>
                        <form onSubmit={handleAmadeusFlightSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Origin (IATA Code)</Label>
                              <Input
                                {...amadeusFlightForm.register("origin")}
                                placeholder="e.g. JFK"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Destination (IATA Code)</Label>
                              <Input
                                {...amadeusFlightForm.register("destination")}
                                placeholder="Select Gujarat airport"
                                list={GUJARAT_AIRPORT_LIST_ID}
                                autoComplete="off"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                              <p className="text-xs text-stone-500">Restricted to Gujarat airports.</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Departure Date</Label>
                              <Input
                                type="date"
                                {...amadeusFlightForm.register("departureDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Number of Adults</Label>
                              <Input
                                type="number"
                                {...amadeusFlightForm.register("adults")}
                                placeholder="1"
                                defaultValue={1}
                                min={1}
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Flights
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Location Search */}
                    {activeTab === "locations" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Airport & City Search</h2>
                        <form onSubmit={handleLocationSearch} className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-stone-700">Keyword (Gujarat heritage / pilgrim sites)</Label>
                            <Input
                              {...locationSearchForm.register("keyword")}
                              placeholder="e.g. Somnath Temple, Dwarka, AMD"
                              required
                              className="border-amber-200 focus-visible:ring-amber-500"
                            />
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Locations
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Hotel Search */}
                    {activeTab === "hotels" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Hotel Search</h2>
                        <form onSubmit={handleHotelSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Search Query (e.g. "Somnath temple stay")</Label>
                              <Input
                                {...hotelSearchForm.register("query")}
                                placeholder="Somnath temple stay"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Number of Adults</Label>
                              <Input
                                type="number"
                                {...hotelSearchForm.register("adults")}
                                placeholder="2"
                                defaultValue="2"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Check-in Date</Label>
                              <Input
                                type="date"
                                {...hotelSearchForm.register("checkInDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Check-out Date</Label>
                              <Input
                                type="date"
                                {...hotelSearchForm.register("checkOutDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Currency</Label>
                              <Select
                                defaultValue="USD"
                                onValueChange={(value) => hotelSearchForm.setValue("currency", value)}
                              >
                                <SelectTrigger className="border-amber-200 focus:ring-amber-500">
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent className="border-amber-200">
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="GBP">GBP</SelectItem>
                                  <SelectItem value="INR">INR</SelectItem>
                                  <SelectItem value="JPY">JPY</SelectItem>
                                  <SelectItem value="AUD">AUD</SelectItem>
                                  <SelectItem value="CAD">CAD</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Hotels
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Activities Search */}
                    {activeTab === "activities" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Activities Search</h2>
                        <form onSubmit={handleActivitiesSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Latitude</Label>
                              <Input
                                {...activitiesForm.register("latitude")}
                                placeholder="e.g. 48.8566"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Longitude</Label>
                              <Input
                                {...activitiesForm.register("longitude")}
                                placeholder="e.g. 2.3522"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Radius (km)</Label>
                              <Input
                                type="number"
                                {...activitiesForm.register("radius")}
                                placeholder="20"
                                defaultValue={20}
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Activities
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Points of Interest Search */}
                    {activeTab === "poi" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Points of Interest</h2>
                        <form onSubmit={handlePOISearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Latitude</Label>
                              <Input
                                {...poiForm.register("latitude")}
                                placeholder="e.g. 48.8566"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Longitude</Label>
                              <Input
                                {...poiForm.register("longitude")}
                                placeholder="e.g. 2.3522"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Points of Interest
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Check-in Links Search */}
                    {activeTab === "checkin" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Airline Check-in Links</h2>
                        <form onSubmit={handleCheckinLinksSearch} className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-stone-700">Airline Code</Label>
                            <Input
                              {...checkinLinksForm.register("airlineCode")}
                              placeholder="e.g. AA"
                              required
                              className="border-amber-200 focus-visible:ring-amber-500"
                            />
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Get Check-in Links
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Trip Purpose Prediction */}
                    {activeTab === "purpose" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Trip Purpose Prediction</h2>
                        <form onSubmit={handleTripPurposeSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Origin (IATA Code)</Label>
                              <Input
                                {...tripPurposeForm.register("origin")}
                                placeholder="e.g. JFK"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Destination (IATA Code)</Label>
                              <Input
                                {...tripPurposeForm.register("destination")}
                                placeholder="e.g. LAX"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Departure Date</Label>
                              <Input
                                type="date"
                                {...tripPurposeForm.register("departureDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Return Date</Label>
                              <Input
                                type="date"
                                {...tripPurposeForm.register("returnDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Predicting...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Predict Trip Purpose
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Car Rental Search */}
                    {activeTab === "car-rental" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Car Rental Search</h2>
                        <form onSubmit={handleCarRentalSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Pickup Location</Label>
                              <Input
                                {...carRentalForm.register("pickupLocation")}
                                placeholder="e.g. JFK"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Drop-off Location (optional)</Label>
                              <Input
                                {...carRentalForm.register("dropOffLocation")}
                                placeholder="Same as pickup if empty"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Pickup Date</Label>
                              <Input
                                type="date"
                                {...carRentalForm.register("pickupDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Pickup Time</Label>
                              <Input
                                type="time"
                                {...carRentalForm.register("pickupTime")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Drop-off Date</Label>
                              <Input
                                type="date"
                                {...carRentalForm.register("dropOffDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Drop-off Time</Label>
                              <Input
                                type="time"
                                {...carRentalForm.register("dropOffTime")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Currency Code</Label>
                              <Input
                                {...carRentalForm.register("currencyCode")}
                                placeholder="USD"
                                defaultValue="USD"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Car Rentals
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Transfer Search */}
                    {activeTab === "transfers" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">Transfer Search</h2>
                        <form onSubmit={handleTransferSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Pickup Location</Label>
                              <Input
                                {...transferForm.register("pickupLocation")}
                                placeholder="e.g. JFK"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Drop-off Location</Label>
                              <Input
                                {...transferForm.register("dropOffLocation")}
                                placeholder="e.g. Manhattan"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Date</Label>
                              <Input
                                type="date"
                                {...transferForm.register("date")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Time</Label>
                              <Input
                                type="time"
                                {...transferForm.register("time")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Currency Code</Label>
                              <Input
                                {...transferForm.register("currencyCode")}
                                placeholder="USD"
                                defaultValue="USD"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Transfers
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* Connection Packages */}
                    {activeTab === "packages" && (
                      <div>
                        <h2 className="text-2xl font-semibold mb-4 text-amber-900">
                          Connection Packages (Flight + Transfer)
                        </h2>
                        <form onSubmit={handleConnectionPackageSearch} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-stone-700">Origin (IATA Code)</Label>
                              <Input
                                {...connectionPackageForm.register("origin")}
                                placeholder="e.g. JFK"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Destination (IATA Code)</Label>
                              <Input
                                {...connectionPackageForm.register("destination")}
                                placeholder="e.g. LAX"
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Departure Date</Label>
                              <Input
                                type="date"
                                {...connectionPackageForm.register("departureDate")}
                                required
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Number of Adults</Label>
                              <Input
                                type="number"
                                {...connectionPackageForm.register("adults")}
                                placeholder="1"
                                defaultValue={1}
                                min={1}
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-stone-700">Currency Code</Label>
                              <Input
                                {...connectionPackageForm.register("currencyCode")}
                                placeholder="USD"
                                defaultValue="USD"
                                className="border-amber-200 focus-visible:ring-amber-500"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Connection Packages
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Results Section */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="mt-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded"
                    >
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                        <p>{error}</p>
                      </div>
                    </motion.div>
                  )}

                  {loading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-8 flex justify-center"
                    >
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-12 w-12 animate-spin text-amber-600" />
                        <p className="mt-4 text-stone-600">Searching for results...</p>
                      </div>
                    </motion.div>
                  )}

                  {results && !loading && !error && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="mt-8"
                    >
                      <h3 className="text-xl font-semibold mb-4 text-amber-900">Results</h3>
                      <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm overflow-auto max-h-[600px]">
                        {/* Display Results based on active tab */}
                        {activeTab === "flights" && (
                          <div>
                            {results.data ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Total flights: {results.pagination?.total || 0}</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-amber-50">
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">Flight</th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Departure
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Arrival
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {results.data.map((flight: any, index: number) => (
                                        <motion.tr
                                          key={index}
                                          variants={itemVariants}
                                          className="border-b border-amber-100 hover:bg-amber-50"
                                        >
                                          <td className="border border-amber-200 p-2">
                                            {flight.airline?.name || "N/A"} {flight.flight?.iata || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            {flight.departure?.airport || "N/A"} ({flight.departure?.iata || "N/A"})
                                            <br />
                                            {flight.departure?.scheduled || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            {flight.arrival?.airport || "N/A"} ({flight.arrival?.iata || "N/A"})<br />
                                            {flight.arrival?.scheduled || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            <span
                                              className={`px-2 py-1 rounded-full text-xs ${
                                                flight.flight_status === "scheduled"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : flight.flight_status === "active"
                                                    ? "bg-green-100 text-green-800"
                                                    : flight.flight_status === "landed"
                                                      ? "bg-amber-100 text-amber-800"
                                                      : flight.flight_status === "cancelled"
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-stone-100 text-stone-800"
                                              }`}
                                            >
                                              {flight.flight_status || "N/A"}
                                            </span>
                                          </td>
                                        </motion.tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No flight data available</p>
                            )}
                          </div>
                        )}

                        {activeTab === "routes" && (
                          <div>
                            {results.data ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Total routes: {results.pagination?.total || 0}</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-amber-50">
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Airline
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Flight Number
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Departure
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Arrival
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {results.data.map((route: any, index: number) => (
                                        <motion.tr
                                          key={index}
                                          variants={itemVariants}
                                          className="border-b border-amber-100 hover:bg-amber-50"
                                        >
                                          <td className="border border-amber-200 p-2">
                                            {route.airline?.name || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            {route.flight_number || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            {route.departure?.airport || "N/A"} ({route.departure?.iata || "N/A"})
                                          </td>
                                          <td className="border border-amber-200 p-2">
                                            {route.arrival?.airport || "N/A"} ({route.arrival?.iata || "N/A"})
                                          </td>
                                        </motion.tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No route data available</p>
                            )}
                          </div>
                        )}

                        {activeTab === "airlines" && (
                          <div>
                            {results.data ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Total airlines: {results.pagination?.total || 0}</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-amber-50">
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Airline Name
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          IATA Code
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          ICAO Code
                                        </th>
                                        <th className="border border-amber-200 p-2 text-left text-amber-900">
                                          Country
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {results.data.map((airline: any, index: number) => (
                                        <motion.tr
                                          key={index}
                                          variants={itemVariants}
                                          className="border-b border-amber-100 hover:bg-amber-50"
                                        >
                                          <td className="border border-amber-200 p-2">
                                            {airline.airline_name || "N/A"}
                                          </td>
                                          <td className="border border-amber-200 p-2">{airline.iata_code || "N/A"}</td>
                                          <td className="border border-amber-200 p-2">{airline.icao_code || "N/A"}</td>
                                          <td className="border border-amber-200 p-2">
                                            {airline.country_name || "N/A"}
                                          </td>
                                        </motion.tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No airline data available</p>
                            )}
                          </div>
                        )}

                        {/* Hotel Search Results */}
                        {activeTab === "hotels" && (
                          <div>
                            {results && results.data && results.data.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.data.length} hotels</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {results.data.map((hotel: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg overflow-hidden shadow-md border border-amber-200"
                                    >
                                      {hotel.thumbnail && (
                                        <div className="h-48 overflow-hidden">
                                          <img
                                            src={hotel.thumbnail || "/placeholder.svg"}
                                            alt={hotel.name || "Hotel image"}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <div className="p-4">
                                        <h4 className="font-bold text-lg mb-2 text-amber-900">
                                          {hotel.name || "Unknown Hotel"}
                                        </h4>
                                        {hotel.rating && (
                                          <div className="flex items-center mb-2">
                                            <Star className="h-4 w-4 text-amber-500 mr-1" />
                                            <span>{hotel.rating}</span>
                                          </div>
                                        )}
                                        {hotel.price && (
                                          <p className="text-amber-600 font-semibold mb-2">{hotel.price}</p>
                                        )}
                                        {hotel.address && (
                                          <p className="text-stone-600 text-sm mb-2">{hotel.address}</p>
                                        )}
                                        {hotel.description && (
                                          <p className="text-stone-700 text-sm mb-3">
                                            {hotel.description.substring(0, 100)}...
                                          </p>
                                        )}
                                        {hotel.link && (
                                          <a
                                            href={hotel.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
                                          >
                                            View Details
                                          </a>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No hotel results available</p>
                            )}
                          </div>
                        )}

                        {/* Amadeus Flights Results */}
                        {activeTab === "amadeus-flights" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} Amadeus flights</p>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {results.map((flight: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-6 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                          <Plane className="h-5 w-5 text-amber-600 mr-2" />
                                          <h4 className="font-bold text-lg text-amber-900">
                                            {flight.itineraries?.[0]?.segments?.[0]?.carrierCode || "N/A"}
                                            {flight.itineraries?.[0]?.segments?.[0]?.number || ""}
                                          </h4>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-2xl font-bold text-amber-700">
                                            {flight.price?.currency || ""} {flight.price?.total || "N/A"}
                                          </p>
                                          <p className="text-sm text-stone-600">per person</p>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-4">
                                        {flight.itineraries?.map((itinerary: any, itinIndex: number) => (
                                          <div key={itinIndex} className="border-l-4 border-amber-200 pl-4">
                                            <h5 className="font-semibold text-stone-800 mb-2">
                                              {itinIndex === 0 ? "Outbound" : "Return"} - Duration: {itinerary.duration || "N/A"}
                                            </h5>
                                            {itinerary.segments?.map((segment: any, segIndex: number) => (
                                              <div key={segIndex} className="bg-amber-50 rounded p-3 mb-2">
                                                <div className="flex justify-between items-center">
                                                  <div>
                                                    <p className="font-semibold text-stone-800">
                                                      {segment.departure?.iataCode || "N/A"}
                                                    </p>
                                                    <p className="text-sm text-stone-600">
                                                      {segment.departure?.at ? new Date(segment.departure.at).toLocaleString() : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="flex-1 text-center">
                                                    <Route className="h-4 w-4 text-amber-600 mx-auto" />
                                                    <p className="text-xs text-stone-500">{segment.duration || "N/A"}</p>
                                                  </div>
                                                  <div className="text-right">
                                                    <p className="font-semibold text-stone-800">
                                                      {segment.arrival?.iataCode || "N/A"}
                                                    </p>
                                                    <p className="text-sm text-stone-600">
                                                      {segment.arrival?.at ? new Date(segment.arrival.at).toLocaleString() : "N/A"}
                                                    </p>
                                                  </div>
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-amber-200">
                                                  <p className="text-sm text-stone-700">
                                                    <span className="font-medium">Aircraft:</span> {segment.aircraft?.code || "N/A"} |
                                                    <span className="font-medium"> Class:</span> {segment.cabin || "N/A"}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ))}
                                      </div>
                                      
                                      <div className="mt-4 pt-4 border-t border-amber-200">
                                        <div className="flex justify-between items-center text-sm text-stone-600">
                                          <span>Seats Available: {flight.numberOfBookableSeats || "N/A"}</span>
                                          <span>Last Ticketing: {flight.lastTicketingDate || "N/A"}</span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No Amadeus flight results available</p>
                            )}
                          </div>
                        )}

                        {/* Locations Results */}
                        {activeTab === "locations" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} locations</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {results.map((location: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-4 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center">
                                          <MapPin className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" />
                                          <div>
                                            <h4 className="font-bold text-lg text-amber-900">
                                              {location.name || "Unknown Location"}
                                            </h4>
                                            <p className="text-sm text-stone-600">
                                              {location.subType || location.type || "Location"}
                                            </p>
                                          </div>
                                        </div>
                                        {location.iataCode && (
                                          <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm font-semibold">
                                            {location.iataCode}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="space-y-2">
                                        {location.address?.cityName && (
                                          <p className="text-stone-700">
                                            <span className="font-medium">City:</span> {location.address.cityName}
                                          </p>
                                        )}
                                        {location.address?.countryName && (
                                          <p className="text-stone-700">
                                            <span className="font-medium">Country:</span> {location.address.countryName}
                                          </p>
                                        )}
                                        {location.geoCode && (
                                          <p className="text-stone-600 text-sm">
                                            <span className="font-medium">Coordinates:</span> {location.geoCode.latitude}, {location.geoCode.longitude}
                                          </p>
                                        )}
                                        {location.timeZoneOffset && (
                                          <p className="text-stone-600 text-sm">
                                            <span className="font-medium">Timezone:</span> UTC{location.timeZoneOffset}
                                          </p>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No location results available</p>
                            )}
                          </div>
                        )}

                        {/* Activities Results */}
                        {activeTab === "activities" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} activities</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {results.map((activity: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg overflow-hidden shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      {activity.pictures && activity.pictures.length > 0 && (
                                        <div className="h-48 overflow-hidden">
                                          <img
                                            src={activity.pictures[0] || "/placeholder.svg"}
                                            alt={activity.name || "Activity image"}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <div className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                          <h4 className="font-bold text-lg text-amber-900 flex-1">
                                            {activity.name || "Unknown Activity"}
                                          </h4>
                                          {activity.rating && (
                                            <div className="flex items-center ml-2">
                                              <Star className="h-4 w-4 text-amber-500 mr-1" />
                                              <span className="text-sm font-semibold">{activity.rating}</span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {activity.price && (
                                          <p className="text-amber-600 font-semibold mb-2">
                                            {activity.price.currencyCode} {activity.price.amount}
                                          </p>
                                        )}
                                        
                                        {activity.shortDescription && (
                                          <p className="text-stone-700 text-sm mb-3 line-clamp-3">
                                            {activity.shortDescription}
                                          </p>
                                        )}
                                        
                                        <div className="space-y-2">
                                          {activity.geoCode && (
                                            <p className="text-stone-600 text-sm">
                                              <MapPin className="h-3 w-3 inline mr-1" />
                                              {activity.geoCode.latitude}, {activity.geoCode.longitude}
                                            </p>
                                          )}
                                          {activity.tags && activity.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {activity.tags.slice(0, 3).map((tag: string, tagIndex: number) => (
                                                <span
                                                  key={tagIndex}
                                                  className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs"
                                                >
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        
                                        {activity.bookingLink && (
                                          <div className="mt-4">
                                            <a
                                              href={activity.bookingLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center px-3 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
                                            >
                                              Book Now
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No activities available</p>
                            )}
                          </div>
                        )}

                        {/* Points of Interest Results */}
                        {activeTab === "poi" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} points of interest</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {results.map((poi: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-4 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center">
                                          <MapPin className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" />
                                          <div>
                                            <h4 className="font-bold text-lg text-amber-900">
                                              {poi.name || "Point of Interest"}
                                            </h4>
                                            <p className="text-sm text-stone-600 capitalize">
                                              {poi.category || poi.type || "POI"}
                                            </p>
                                          </div>
                                        </div>
                                        {poi.rank && (
                                          <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm font-semibold">
                                            #{poi.rank}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="space-y-2">
                                        {poi.tags && poi.tags.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-3">
                                            {poi.tags.slice(0, 4).map((tag: string, tagIndex: number) => (
                                              <span
                                                key={tagIndex}
                                                className="bg-stone-100 text-stone-700 px-2 py-1 rounded text-xs"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        
                                        {poi.geoCode && (
                                          <p className="text-stone-600 text-sm">
                                            <span className="font-medium">Location:</span> {poi.geoCode.latitude}, {poi.geoCode.longitude}
                                          </p>
                                        )}
                                        
                                        {poi.relevance && (
                                          <div className="flex items-center">
                                            <span className="text-sm font-medium text-stone-700 mr-2">Relevance:</span>
                                            <div className="flex-1 bg-stone-200 rounded-full h-2">
                                              <div
                                                className="bg-amber-600 h-2 rounded-full"
                                                style={{ width: `${poi.relevance * 100}%` }}
                                              ></div>
                                            </div>
                                            <span className="text-sm text-stone-600 ml-2">
                                              {Math.round(poi.relevance * 100)}%
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No points of interest available</p>
                            )}
                          </div>
                        )}

                        {/* Check-in Links Results */}
                        {activeTab === "checkin" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} check-in links</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {results.map((checkin: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-6 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-center mb-4">
                                        <Calendar className="h-6 w-6 text-amber-600 mr-3" />
                                        <div>
                                          <h4 className="font-bold text-lg text-amber-900">
                                            {checkin.airline?.name || "Airline"} Check-in
                                          </h4>
                                          <p className="text-sm text-stone-600">
                                            Flight {checkin.flightNumber || "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        {checkin.href && (
                                          <div>
                                            <a
                                              href={checkin.href}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                                            >
                                              <Plane className="h-4 w-4 mr-2" />
                                              Online Check-in
                                            </a>
                                          </div>
                                        )}
                                        
                                        {checkin.parameters && (
                                          <div className="bg-amber-50 rounded p-3">
                                            <h5 className="font-semibold text-stone-800 mb-2">Flight Details:</h5>
                                            <div className="space-y-1 text-sm">
                                              {Object.entries(checkin.parameters).map(([key, value]: [string, any]) => (
                                                <p key={key} className="text-stone-700">
                                                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {value}
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No check-in links available</p>
                            )}
                          </div>
                        )}

                        {/* Trip Purpose Results */}
                        {activeTab === "purpose" && (
                          <div>
                            {results && (results.result || results.prediction) ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <div className="bg-white rounded-lg p-6 shadow-md border border-amber-200">
                                  <div className="flex items-center mb-4">
                                    <Users className="h-6 w-6 text-amber-600 mr-3" />
                                    <h4 className="font-bold text-xl text-amber-900">Trip Purpose Analysis</h4>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    {(results.result || results.prediction) && (
                                      <div className="bg-amber-50 rounded-lg p-4">
                                        <h5 className="font-semibold text-amber-900 mb-2">Purpose:</h5>
                                        <p className="text-stone-700 text-lg">{results.result || results.prediction}</p>
                                      </div>
                                    )}
                                    
                                    {results.confidence && (
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-semibold text-stone-800">Confidence Level:</span>
                                          <span className="text-amber-700 font-bold">
                                            {Math.round(results.confidence * 100)}%
                                          </span>
                                        </div>
                                        <div className="w-full bg-stone-200 rounded-full h-3">
                                          <div
                                            className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                                            style={{ width: `${results.confidence * 100}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {results.subType && (
                                      <div className="border-t border-amber-200 pt-4">
                                        <h5 className="font-semibold text-stone-800 mb-2">Category:</h5>
                                        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                                          {results.subType}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No trip purpose data available</p>
                            )}
                          </div>
                        )}

                        {/* Car Rental Results */}
                        {activeTab === "car-rental" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} car rental options</p>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {results.map((rental: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-6 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                          <Car className="h-6 w-6 text-amber-600 mr-3" />
                                          <div>
                                            <h4 className="font-bold text-lg text-amber-900">
                                              {rental.vehicle?.category || "Car Rental"}
                                            </h4>
                                            <p className="text-sm text-stone-600">
                                              {rental.vehicle?.make} {rental.vehicle?.model}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-2xl font-bold text-amber-700">
                                            {rental.price?.currency} {rental.price?.total}
                                          </p>
                                          <p className="text-sm text-stone-600">Total</p>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        <div className="bg-amber-50 rounded p-3">
                                          <h5 className="font-semibold text-stone-800 mb-2">Vehicle Details:</h5>
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            {rental.vehicle?.seats && (
                                              <p className="text-stone-700">
                                                <Users className="h-3 w-3 inline mr-1" />
                                                {rental.vehicle.seats} seats
                                              </p>
                                            )}
                                            {rental.vehicle?.doors && (
                                              <p className="text-stone-700">Doors: {rental.vehicle.doors}</p>
                                            )}
                                            {rental.vehicle?.transmission && (
                                              <p className="text-stone-700">Trans: {rental.vehicle.transmission}</p>
                                            )}
                                            {rental.vehicle?.fuel && (
                                              <p className="text-stone-700">Fuel: {rental.vehicle.fuel}</p>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {rental.vendor && (
                                          <div>
                                            <h5 className="font-semibold text-stone-800 mb-1">Vendor:</h5>
                                            <p className="text-stone-700">{rental.vendor.name}</p>
                                          </div>
                                        )}
                                        
                                        {rental.pickupDropoff && (
                                          <div>
                                            <h5 className="font-semibold text-stone-800 mb-1">Pickup/Dropoff:</h5>
                                            <p className="text-sm text-stone-600">
                                              {rental.pickupDropoff.pickupDateTime} - {rental.pickupDropoff.dropoffDateTime}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No car rental options available</p>
                            )}
                          </div>
                        )}

                        {/* Transfers Results */}
                        {activeTab === "transfers" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} transfer options</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {results.map((transfer: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-6 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                          <Bus className="h-6 w-6 text-amber-600 mr-3" />
                                          <div>
                                            <h4 className="font-bold text-lg text-amber-900">
                                              {transfer.transferType || "Transfer Service"}
                                            </h4>
                                            <p className="text-sm text-stone-600">
                                              {transfer.vehicle?.category || transfer.serviceType}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xl font-bold text-amber-700">
                                            {transfer.price?.currency} {transfer.price?.total}
                                          </p>
                                          <p className="text-sm text-stone-600">Total</p>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        <div className="bg-amber-50 rounded p-3">
                                          <div className="flex justify-between items-center">
                                            <div>
                                              <p className="font-semibold text-stone-800">From:</p>
                                              <p className="text-sm text-stone-600">{transfer.pickup?.location || "Pickup location"}</p>
                                            </div>
                                            <Route className="h-4 w-4 text-amber-600" />
                                            <div className="text-right">
                                              <p className="font-semibold text-stone-800">To:</p>
                                              <p className="text-sm text-stone-600">{transfer.dropoff?.location || "Dropoff location"}</p>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {transfer.duration && (
                                          <p className="text-stone-700">
                                            <span className="font-medium">Duration:</span> {transfer.duration}
                                          </p>
                                        )}
                                        
                                        {transfer.distance && (
                                          <p className="text-stone-700">
                                            <span className="font-medium">Distance:</span> {transfer.distance}
                                          </p>
                                        )}
                                        
                                        {transfer.vehicle && (
                                          <div>
                                            <p className="text-stone-700">
                                              <span className="font-medium">Vehicle:</span> {transfer.vehicle.description}
                                            </p>
                                            {transfer.vehicle.seats && (
                                              <p className="text-sm text-stone-600">
                                                <Users className="h-3 w-3 inline mr-1" />
                                                Up to {transfer.vehicle.seats} passengers
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No transfer options available</p>
                            )}
                          </div>
                        )}

                        {/* Connection Packages Results */}
                        {activeTab === "packages" && (
                          <div>
                            {results && Array.isArray(results) && results.length > 0 ? (
                              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                <p className="mb-4">Found {results.length} connection packages</p>
                                <div className="space-y-6">
                                  {results.map((package_: any, index: number) => (
                                    <motion.div
                                      key={index}
                                      variants={itemVariants}
                                      className="bg-white rounded-lg p-6 shadow-md border border-amber-200 hover:shadow-lg transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                          <Package className="h-6 w-6 text-amber-600 mr-3" />
                                          <div>
                                            <h4 className="font-bold text-lg text-amber-900">
                                              Flight + Transfer Package
                                            </h4>
                                            <p className="text-sm text-stone-600">
                                              {package_.origin} → {package_.destination}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-2xl font-bold text-amber-700">
                                            {package_.price?.currency} {package_.price?.total}
                                          </p>
                                          <p className="text-sm text-stone-600">Total package</p>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Flight Details */}
                                        {package_.flight && (
                                          <div className="bg-blue-50 rounded p-4">
                                            <div className="flex items-center mb-2">
                                              <Plane className="h-4 w-4 text-blue-600 mr-2" />
                                              <h5 className="font-semibold text-blue-900">Flight Details</h5>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                              <p className="text-blue-800">
                                                <span className="font-medium">Flight:</span> {package_.flight.number}
                                              </p>
                                              <p className="text-blue-700">
                                                <span className="font-medium">Departure:</span> {package_.flight.departure}
                                              </p>
                                              <p className="text-blue-700">
                                                <span className="font-medium">Arrival:</span> {package_.flight.arrival}
                                              </p>
                                              {package_.flight.duration && (
                                                <p className="text-blue-700">
                                                  <span className="font-medium">Duration:</span> {package_.flight.duration}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Transfer Details */}
                                        {package_.transfer && (
                                          <div className="bg-green-50 rounded p-4">
                                            <div className="flex items-center mb-2">
                                              <Bus className="h-4 w-4 text-green-600 mr-2" />
                                              <h5 className="font-semibold text-green-900">Transfer Details</h5>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                              <p className="text-green-800">
                                                <span className="font-medium">Type:</span> {package_.transfer.type}
                                              </p>
                                              <p className="text-green-700">
                                                <span className="font-medium">From:</span> {package_.transfer.pickup}
                                              </p>
                                              <p className="text-green-700">
                                                <span className="font-medium">To:</span> {package_.transfer.dropoff}
                                              </p>
                                              {package_.transfer.duration && (
                                                <p className="text-green-700">
                                                  <span className="font-medium">Duration:</span> {package_.transfer.duration}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {package_.savings && (
                                        <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                                          <p className="text-amber-800 font-medium text-center">
                                            💰 Save {package_.savings.currency} {package_.savings.amount} with this package!
                                          </p>
                                        </div>
                                      )}
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ) : (
                              <p className="text-stone-600">No connection packages available</p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-amber-700 mr-2" />
            <span className="text-lg font-semibold text-stone-800">DevYatra</span>
          </div>
          <p className="text-stone-600 text-sm">© {new Date().getFullYear()} DevYatra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
