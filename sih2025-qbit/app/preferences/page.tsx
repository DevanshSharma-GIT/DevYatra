"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, MapPin, Loader2, CheckCircle, AlertCircle, Globe } from "lucide-react"
import Link from "next/link"
import { setCookie, getCookie } from "cookies-next"

// Define or import this helper function
const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
  // Ensure baseUrl does not end with /api, then add /api
  const cleanBase = baseUrl.replace(/\/$/, "").replace(/\/api$/, "") + "/api"
  const cleanPath = path.startsWith("/") ? path.substring(1) : path
  return `${cleanBase}/${cleanPath}`
}

export default function PreferencesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get("from") || "/chatbot"

  const [formData, setFormData] = useState({
    username: "",
    budget: "30000", // Default to a numeric string
    group_size: "2",
    group_type: "couple",
    interests: "culture, food, sightseeing",
    travel_dates: "flexible",
  default_location: "Somnath Temple, Gujarat",
  currency: "INR",
    home_location: "", // Default to empty
  })

  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [detectedLocationName, setDetectedLocationName] = useState<string | null>(null) // Added state for detected name
  const [isSubmitting, setIsSubmitting] = useState(false) // Added submission state
  const [submitStatus, setSubmitStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  }) // Added status state

  // Check if preferences already exist on mount
  useEffect(() => {
    try {
      // First check cookies (for SSR compatibility)
      const cookiePrefs = getCookie("travelPreferences")
      if (cookiePrefs) {
        let parsedPrefs: any

        // Handle different cookie value types
        if (typeof cookiePrefs === "object" && cookiePrefs !== null) {
          // Some cookie libraries already return parsed JSON objects
          parsedPrefs = cookiePrefs
        } else if (typeof cookiePrefs === "string") {
          // Skip empty strings or obviously non-JSON values
          if (
            !cookiePrefs.trim() ||
            (cookiePrefs !== "undefined" &&
              cookiePrefs !== "null" &&
              !cookiePrefs.startsWith("{") &&
              !cookiePrefs.startsWith("["))
          ) {
            console.warn("Invalid cookie format:", cookiePrefs)
            setCookie("travelPreferences", "", { maxAge: -1, path: "/" })
            return
          }

          try {
            parsedPrefs = JSON.parse(cookiePrefs)
          } catch (e) {
            console.error("Error parsing travelPreferences cookie:", e)
            console.log("Invalid cookie value:", cookiePrefs)
            // Clear invalid cookie
            setCookie("travelPreferences", "", { maxAge: -1, path: "/" })
            return
          }
        } else {
          console.warn("Unexpected type for travelPreferences cookie:", typeof cookiePrefs)
          setCookie("travelPreferences", "", { maxAge: -1, path: "/" })
          return
        }

        // Validate the parsed object has expected structure
        if (!parsedPrefs || typeof parsedPrefs !== "object") {
          console.warn("Cookie parsed but resulted in invalid object:", parsedPrefs)
          setCookie("travelPreferences", "", { maxAge: -1, path: "/" })
          return
        }

        // Ensure home_location is present
        if (!parsedPrefs.home_location) parsedPrefs.home_location = ""
        setFormData(parsedPrefs)
        if (parsedPrefs.detectedLocationName) {
          setDetectedLocationName(parsedPrefs.detectedLocationName)
        }
        return
      }

      // Then check localStorage
      const storedPreferences = localStorage.getItem("travelPreferences")
      if (storedPreferences) {
        try {
          const parsedPrefs = JSON.parse(storedPreferences)
          if (!parsedPrefs.home_location) parsedPrefs.home_location = ""
          setFormData(parsedPrefs)
        } catch (e) {
          console.error("Error parsing travelPreferences localStorage:", e, storedPreferences)
          // Clear potentially corrupted localStorage item
          localStorage.removeItem("travelPreferences")
          setFormData((prev) => ({ ...prev, home_location: "" })) // Reset to default
        }
      } else {
        // Set default empty home location if nothing is stored
        setFormData((prev) => ({ ...prev, home_location: "" }))
      }

      // Check if there's a stored location name from a previous detection in this session
      const storedCoordsData = localStorage.getItem("home_location_coords")
      if (storedCoordsData) {
        try {
          // Make sure we're parsing valid JSON
          if (
            typeof storedCoordsData === "string" &&
            (storedCoordsData.startsWith("{") || storedCoordsData.startsWith("["))
          ) {
            const parsedCoords = JSON.parse(storedCoordsData)
            if (parsedCoords.formatted_address) {
              setDetectedLocationName(parsedCoords.formatted_address)
            }
          } else {
            console.warn("Invalid JSON format in home_location_coords:", storedCoordsData)
            localStorage.removeItem("home_location_coords")
          }
        } catch (e) {
          console.error("Error parsing stored coords on mount:", e, storedCoordsData)
          // Clear potentially corrupted item
          localStorage.removeItem("home_location_coords")
        }
      }
    } catch (error) {
      console.error("Error loading preferences:", error)
      setFormData((prev) => ({ ...prev, home_location: "" })) // Ensure default on error
    }
  }, [])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // If user manually changes home location, clear stored coordinates and detected name
    if (field === "home_location") {
      localStorage.removeItem("home_location_coords")
      setLocationError(null) // Clear detection error if user types manually
      setDetectedLocationName(null) // Clear detected name
    }
    // Clear previous submission status on any change
    setSubmitStatus({ type: "idle", message: "" })
  }

  // Function to detect current location
  const detectCurrentLocation = () => {
    // Check if running in a browser environment and geolocation is supported
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser or unavailable.")
      setIsDetectingLocation(false)
      return
    }

    setLocationError(null)
    setIsDetectingLocation(true)
    setDetectedLocationName(null) // Clear previous detected name
    setSubmitStatus({ type: "idle", message: "" }) // Clear submission status

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // make lat/lon available to the catch block
        let lat: number | null = null
        let lon: number | null = null
        try {
          // Get coordinates with proper precision
          const latitude = position.coords.latitude
          const longitude = position.coords.longitude

          // Ensure we're working with numbers, not strings and assign to outer scope variables
          lat = Number.parseFloat(latitude.toFixed(6))
          lon = Number.parseFloat(longitude.toFixed(6))

          // Try to get location name using our API first
          try {
            const response = await fetch(getApiUrl(`reverse_geocode?lat=${lat}&lon=${lon}`))

            if (response.ok) {
              const data = await response.json()

              // Format the address in a user-friendly way
              let formattedAddress = ""

              // Extract components from the API response
              if (data.components) {
                const components = data.components
                const parts = []

                // Add neighborhood/suburb if available
                if (components.neighbourhood || components.suburb) {
                  parts.push(components.neighbourhood || components.suburb)
                }

                // Add city/town
                if (components.city || components.town) {
                  parts.push(components.city || components.town)
                }

                // Add state/province
                if (components.state || components.province) {
                  parts.push(components.state || components.province)
                }

                // Add country
                if (components.country) {
                  parts.push(components.country)
                }

                // Join all parts with commas
                formattedAddress = parts.join(", ")
              }

              // If we couldn't build a formatted address from components, use the API-provided address
              const address = formattedAddress || data.address || ""

              if (address) {
                // Update the home location field with the readable address
                handleChange("home_location", address)
                setDetectedLocationName(address) // Store detected name for display

                // Store the coordinates for backend submission - ensure they're numbers
                const coordsData = {
                  lat: lat,
                  lon: lon,
                  formatted_address: address, // Also store the formatted address
                }

                localStorage.setItem("home_location_coords", JSON.stringify(coordsData))
                setLocationError(null) // Clear error on success
                console.log("Location detected successfully:", { address, lat, lon })
                return // Exit early if successful
              }
            }
            // If we get here, either the API call failed or returned no usable address
            throw new Error("API did not return a valid address")
          } catch (apiError) {
            console.log("Primary API failed, trying fallback geocoding:", apiError)
            // Continue to fallback method
          }

          // Fallback: Use OpenStreetMap Nominatim API (free, no API key required)
          try {
            // Note: This is a public API with usage limits. For production, consider using a paid service
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`

            const nominatimResponse = await fetch(nominatimUrl, {
              headers: {
                // Add a user agent as required by Nominatim's usage policy
                "User-Agent": "TravelApp/1.0",
              },
            })

            if (nominatimResponse.ok) {
              const nominatimData = await nominatimResponse.json()

              // Extract a readable address from the response
              let readableAddress = ""

              if (nominatimData.address) {
                const addr = nominatimData.address
                const parts = []

                // Build a readable address from most specific to least specific
                // Neighborhood or suburb
                if (addr.neighbourhood || addr.suburb) {
                  parts.push(addr.neighbourhood || addr.suburb)
                }

                // City, town or village
                if (addr.city || addr.town || addr.village) {
                  parts.push(addr.city || addr.town || addr.village)
                }

                // State/province
                if (addr.state || addr.province) {
                  parts.push(addr.state || addr.province)
                }

                // Country
                if (addr.country) {
                  parts.push(addr.country)
                }

                readableAddress = parts.join(", ")
              }

              // Use display_name as fallback if we couldn't build a readable address
              const address = readableAddress || nominatimData.display_name || ""

              if (address) {
                // Update the home location field with the readable address
                handleChange("home_location", address)
                setDetectedLocationName(address) // Store detected name for display

                // Store the coordinates for backend submission
                const coordsData = {
                  lat: lat,
                  lon: lon,
                  formatted_address: address,
                }

                localStorage.setItem("home_location_coords", JSON.stringify(coordsData))
                setLocationError(null) // Clear error on success
                console.log("Location detected successfully (fallback):", { address, lat, lon })
                return // Exit early if successful
              }
            }
            // If we get here, the fallback also failed
            throw new Error("Fallback geocoding failed")
          } catch (fallbackError) {
            console.error("All geocoding attempts failed:", fallbackError)

            // Last resort: Use a readable format for the coordinates
            const fallbackAddress = `Location near ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
            handleChange("home_location", fallbackAddress)
            setDetectedLocationName(fallbackAddress) // Store fallback name for display

            // Create a proper object and stringify it
            const coordsData = {
              lat: lat,
              lon: lon,
              formatted_address: fallbackAddress,
            }

            localStorage.setItem("home_location_coords", JSON.stringify(coordsData))

            setLocationError("Could not retrieve location name. Using coordinates instead.")
            console.log("Using fallback coordinates:", { lat, lon })
          }
        } catch (error) {
          console.error("Location detection error:", error)
          let errorMsg = "Error detecting location"
          let genericLocation: string | null = null // Store potential generic location

          // Try to get coordinates if available, even on error
          if (lat !== null && lon !== null) {
            genericLocation = `Location near ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
          }

          if (typeof error === "object" && error !== null && "message" in error) {
            const errMessage = (error as { message?: string }).message || ""
            // Check for common error patterns
            if (errMessage.includes("timeout") || errMessage.includes("timed out")) {
              errorMsg = "Location detection timed out. Please try again or enter your location manually."
            } else if (errMessage.includes("permission") || errMessage.includes("denied")) {
              errorMsg = "Location permission denied. Please enable location services in your browser."
            } else if (errMessage.includes("network") || errMessage.includes("offline")) {
              errorMsg = "Network error. Please check your internet connection and try again."
            } else if (errMessage.includes("API") || errMessage.includes("geocod")) {
              errorMsg = "Could not determine your location name. Please enter it manually."
            } else {
              // Use the actual error message but keep it concise
              errorMsg = "Error: " + (errMessage.length > 50 ? errMessage.substring(0, 50) + "..." : errMessage)
            }
          }
          // else: Keep the default "Error detecting location" message

          // If we determined a generic location, use it and update the message
          if (genericLocation && lat !== null && lon !== null) {
            // Ensure lat/lon are still valid
            handleChange("home_location", genericLocation)
            setDetectedLocationName(genericLocation)
            // Store coordinates for backend use
            localStorage.setItem(
              "home_location_coords",
              JSON.stringify({
                lat: lat, // lat should be available here
                lon: lon, // lon should be available here
                formatted_address: genericLocation,
              }),
            )
            // Append to the error message only if it's not already specific
            if (errorMsg === "Error detecting location" || errorMsg.startsWith("Error: ")) {
              errorMsg += " Using approximate coordinates instead."
            }
          } else {
            // If no generic location could be determined or lat/lon became null, clear the detected name
            setDetectedLocationName(null)
          }

          setLocationError(errorMsg)
        } finally {
          setIsDetectingLocation(false)
        }
      },
      (posError: GeolocationPositionError) => {
        console.error("Geolocation error:", posError)
        let message = "An error occurred while retrieving location."
        // Handle standard Geolocation error codes
        if (posError && typeof posError.code === "number") {
          switch (posError.code) {
            case 1: // PERMISSION_DENIED
              message = "Location permission denied. Please enable location services."
              break
            case 2: // POSITION_UNAVAILABLE
              message = "Location information is unavailable."
              break
            case 3: // TIMEOUT
              message = "Location request timed out. Try again."
              break
            default:
              message = posError.message || message
          }
        } else if (posError && posError.message) {
          message = posError.message
        }
        setLocationError(message)
        setIsDetectingLocation(false)
        setDetectedLocationName(null) // Clear detected name on error
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const savePreferences = (data: typeof formData) => {
    try {
      // Save to localStorage for client-side access
      localStorage.setItem("travelPreferences", JSON.stringify(data))

      // Also save to cookies for server-side/middleware access
      setCookie("travelPreferences", JSON.stringify(data), {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })

      return true
    } catch (error) {
      console.error("Error saving preferences:", error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus({ type: "idle", message: "" })

    // Validate form - username is required
    if (!formData.username.trim()) {
      setSubmitStatus({ type: "error", message: "Please enter a username." })
      setIsSubmitting(false)
      return
    }

    if (!formData.home_location.trim()) {
      setSubmitStatus({ type: "error", message: "Please set your home location (type or detect)." })
      setIsSubmitting(false)
      return
    }

    // Save the preferences
    const saved = savePreferences(formData)
    if (!saved) {
      setSubmitStatus({ type: "error", message: "Failed to save preferences locally. Please try again." })
      setIsSubmitting(false)
      return
    }

    let homeLat: number | null = null
    let homeLon: number | null = null
    let backendError = null

    // 1. Register/Update User (optional, backend handles upsert)
    try {
      const userResponse = await fetch(getApiUrl("users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          role: "tourist",
          firebase_uid: formData.username,
        }),
      })

      if (!userResponse.ok) {
        const errorText = await userResponse.text()
        console.warn("Backend user registration/check warning:", errorText)
        // Don't stop here, maybe user already exists
      } else {
        console.log("User registration/update successful")
      }
    } catch (err) {
      console.error("Error contacting user endpoint:", err)
      // Continue, but log the error
    }

    // 2. Determine Home Coordinates
    try {
      let storedCoords = localStorage.getItem("home_location_coords")
      let locationData: any

      if (storedCoords) {
        // Use stored coordinates if available (means detect was used and field wasn't manually changed after)
        try {
          // Validate that we have a proper JSON string before parsing
          if (typeof storedCoords === "string" && (storedCoords.startsWith("{") || storedCoords.startsWith("["))) {
            locationData = JSON.parse(storedCoords)

            // Ensure we have valid numbers
            if (locationData && typeof locationData.lat === "number" && typeof locationData.lon === "number") {
              homeLat = Number.parseFloat(locationData.lat.toFixed(6))
              homeLon = Number.parseFloat(locationData.lon.toFixed(6))
              console.log("Using detected coordinates:", { homeLat, homeLon })
            } else {
              throw new Error("Invalid coordinate format in localStorage")
            }
          } else {
            console.warn("Invalid JSON format in home_location_coords:", storedCoords)
            storedCoords = null
            localStorage.removeItem("home_location_coords")
          }
        } catch (parseError) {
          console.error("Error parsing stored coordinates:", parseError, storedCoords)
          // Fall back to geocoding the text address
          storedCoords = null
          // Clear potentially corrupted item
          localStorage.removeItem("home_location_coords")
        }
      }

      // If we don't have valid coordinates from localStorage, geocode the address
      if (!storedCoords && formData.home_location) {
        // Check if the home_location is already in coordinate format (lat, lon)
        const coordsRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/
        const coordsMatch = formData.home_location.match(coordsRegex)

        if (coordsMatch) {
          // If it's already in coordinate format, parse directly
          homeLat = Number.parseFloat(coordsMatch[1])
          homeLon = Number.parseFloat(coordsMatch[3])
          console.log("Parsed coordinates from input:", { homeLat, homeLon })
        } else {
          // Geocode the manually entered address
          console.log("Geocoding address:", formData.home_location)
          const geocodeResponse = await fetch(
            getApiUrl(`geocode?address=${encodeURIComponent(formData.home_location)}`),
          )

          if (geocodeResponse.ok) {
            locationData = await geocodeResponse.json()

            if (
              locationData &&
              typeof locationData.latitude === "number" &&
              typeof locationData.longitude === "number"
            ) {
              homeLat = Number.parseFloat(locationData.latitude.toFixed(6))
              homeLon = Number.parseFloat(locationData.longitude.toFixed(6))
              console.log("Geocoded coordinates:", { homeLat, homeLon })
            } else {
              throw new Error("Invalid response from geocoding API")
            }
          } else {
            let errorText = "Unknown error"
            try {
              errorText = await geocodeResponse.text()
            } catch (e) {
              console.error("Error reading geocode response:", e)
            }

            console.error("Failed to geocode home location:", formData.home_location, errorText)
            backendError = `Could not find coordinates for '${formData.home_location}'. Please try a different address or use detection.`
          }
        }
      }
    } catch (geocodeErr) {
      console.error("Error determining home location coordinates:", geocodeErr)
      backendError = "An error occurred while processing your home location."
    }

    // 3. Send Home Coordinates to Backend (if found)
    if (homeLat !== null && homeLon !== null && !backendError) {
      try {
        console.log("Sending home location to backend:", {
          username: formData.username,
          home_lat: homeLat,
          home_lon: homeLon,
        })

        const homeResponse = await fetch(getApiUrl("users/home"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formData.username,
            home_lat: homeLat,
            home_lon: homeLon,
          }),
        })

        if (homeResponse.ok) {
          console.log("Home location coordinates saved successfully to backend.")
          // Clear stored coordinates and detected name only after successful backend save
          localStorage.removeItem("home_location_coords")
          setDetectedLocationName(null) // Clear detected name state
        } else {
          let errorText = "Server error"
          try {
            errorText = await homeResponse.text()
            // Try to parse as JSON, but fallback to raw text if it fails
            try {
              const errorJson = JSON.parse(errorText)
              backendError = `Failed to save home location: ${errorJson.error || "Server error"}`
            } catch (jsonError) {
              // If parsing fails, use the raw text (truncated if too long)
              console.warn("Backend error response was not valid JSON:", errorText)
              backendError = `Failed to save home location: ${errorText.substring(0, 100)}${
                errorText.length > 100 ? "..." : ""
              }`
            }
          } catch (e) {
            console.error("Error reading/parsing home location response:", e, errorText)
            backendError = `Failed to save home location: ${errorText}` // Use potentially partial text
          }
          console.error("Failed to save home location to backend:", backendError) // Log the final derived error
        }
      } catch (err) {
        console.error("Error saving home location to backend:", err)
        backendError = "Could not connect to server to save home location."
      }
    }

    setIsSubmitting(false)

    if (backendError) {
      setSubmitStatus({ type: "error", message: backendError })
    } else {
      setSubmitStatus({ type: "success", message: "Preferences saved successfully!" })
      // Navigate after a short delay to show success message
      setTimeout(() => {
        router.push(redirectPath)
      }, 1500)
    }
  }

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

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-800">Travel Preferences</h1>
              <p className="text-stone-600 mt-1">Customize your travel experience</p>
            </div>
            <Link href={redirectPath}>
              <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>

          <Card className="shadow-lg border border-amber-200">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
              <CardTitle className="text-xl">Personal Settings</CardTitle>
              <CardDescription className="text-amber-100">
                Set your username and home location to use all features
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-stone-700">
                    Your Username <span className="text-amber-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    placeholder="Choose a username (required)"
                    required
                    disabled={isSubmitting}
                    className="border-amber-200 focus-visible:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="budget" className="text-stone-700">
                      Budget (in your currency)
                    </Label>
                    <Input
                      id="budget"
                      type="number"
                      min="0"
                      value={formData.budget}
                      onChange={(e) => handleChange("budget", e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Enter your budget (e.g., 30000)"
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group_size" className="text-stone-700">
                      Group Size
                    </Label>
                    <Input
                      id="group_size"
                      type="number"
                      min="1"
                      value={formData.group_size}
                      onChange={(e) => handleChange("group_size", e.target.value)}
                      disabled={isSubmitting}
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="group_type" className="text-stone-700">
                      Group Type
                    </Label>
                    <Select
                      value={formData.group_type}
                      onValueChange={(value) => handleChange("group_type", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="border-amber-200 focus-visible:ring-amber-500">
                        <SelectValue placeholder="Select group type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-amber-200">
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="couple">Couple</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="friends">Friends</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-stone-700">
                      Preferred Currency
                    </Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => handleChange("currency", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="border-amber-200 focus-visible:ring-amber-500">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-amber-200">
                        <SelectItem value="USD">USD (US Dollar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                        <SelectItem value="JPY">JPY (Japanese Yen)</SelectItem>
                        <SelectItem value="INR">INR (Indian Rupee)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interests" className="text-stone-700">
                    Interests (comma separated)
                  </Label>
                  <Textarea
                    id="interests"
                    value={formData.interests}
                    onChange={(e) => handleChange("interests", e.target.value)}
                    placeholder="e.g., culture, food, sightseeing, adventure, relaxation"
                    disabled={isSubmitting}
                    className="border-amber-200 focus-visible:ring-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="home_location" className="text-stone-700">
                    Home Location <span className="text-amber-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="home_location"
                      value={formData.home_location}
                      onChange={(e) => handleChange("home_location", e.target.value)}
                      placeholder="Type address or click detect button (required)"
                      required
                      className="flex-1 border-amber-200 focus-visible:ring-amber-500"
                      disabled={isSubmitting || isDetectingLocation}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={detectCurrentLocation}
                      disabled={isDetectingLocation || isSubmitting}
                      title="Detect current location"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {isDetectingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Error message */}
                  {locationError && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      {locationError}
                    </p>
                  )}

                  {/* Success message */}
                  {!locationError && detectedLocationName && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      Detected: {detectedLocationName}. Click "Save Preferences" to confirm.
                    </p>
                  )}

                  {/* Help text */}
                  <p className="text-xs text-stone-500 mt-1">
                    Enter your home city or address, or use the detect button to automatically find your current
                    location. This helps calculate distances and provide personalized recommendations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="travel_dates" className="text-stone-700">
                      Travel Dates
                    </Label>
                    <Input
                      id="travel_dates"
                      value={formData.travel_dates}
                      onChange={(e) => handleChange("travel_dates", e.target.value)}
                      placeholder="e.g., June 2023 or flexible"
                      disabled={isSubmitting}
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_location" className="text-stone-700">
                      Destination of Interest
                    </Label>
                    <Input
                      id="default_location"
                      value={formData.default_location}
                      onChange={(e) => handleChange("default_location", e.target.value)}
                      placeholder="e.g., Paris, France"
                      disabled={isSubmitting}
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Submission Status Feedback */}
                {submitStatus.type === "error" && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span>{submitStatus.message}</span>
                  </div>
                )}
                {submitStatus.type === "success" && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                    <CheckCircle className="h-4 w-4" />
                    <span>{submitStatus.message} Redirecting...</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-amber-100 p-6 bg-amber-50">
                <Button
                  type="submit"
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Preferences & Continue"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Additional Information Card */}
          <Card className="mt-6 border border-amber-200 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-3 rounded-full">
                  <Globe className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-medium text-lg text-stone-800 mb-2">Why Set Preferences?</h3>
                  <p className="text-stone-600 text-sm">
                    Your preferences help us personalize your travel experience. Setting your home location enables
                    features like distance calculations, local recommendations, and cultural insights. Your username
                    allows you to earn points and track your contributions to the community.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
