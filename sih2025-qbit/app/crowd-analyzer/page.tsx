"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, Users, MapPin, AlertTriangle, Globe } from 'lucide-react'
import Image from "next/image"
import Link from "next/link"

interface Incident {
  description: string
  severity: number
  type: number
  time: string
  fullDesc: string
  impacting: boolean
}

interface CrowdData {
  timestamp: string
  status: string
  radius: number
  device_count: number
  map_url: string
  incident_count: number
  top_incidents: Incident[]
}

// API base URL - adjust based on environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function CrowdAnalyzer() {
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [loading, setLoading] = useState(false)
  const [crowdData, setCrowdData] = useState<CrowdData | null>(null)
  const [error, setError] = useState("")
  const [mapLoaded, setMapLoaded] = useState(false)

  // Function to get current location from browser
  const getCurrentLocation = () => {
    setLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString())
          setLongitude(position.coords.longitude.toString())
          setLoading(false)
        },
        (error) => {
          setError("Could not get location: " + error.message)
          setLoading(false)
        },
      )
    } else {
      setError("Geolocation is not supported by this browser")
      setLoading(false)
    }
  }

  // Function to analyze crowd density
  const analyzeCrowd = async () => {
    if (!latitude || !longitude) {
      setError("Please enter both latitude and longitude")
      return
    }

    try {
      setLoading(true)
      setError("")
      setMapLoaded(false)

      const response = await fetch(`${API_BASE_URL}/api/check_activity?lat=${latitude}&lon=${longitude}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch crowd data: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === "error") {
        throw new Error(data.message || "Error analyzing crowd")
      }

      console.log("Received crowd data:", data)
      setCrowdData(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error analyzing crowd"
      console.error("Crowd analysis error:", err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Function to get badge color based on crowd status
  const getStatusBadge = (status: any) => {
    switch (status) {
      case "low":
        return <Badge className="bg-green-500 hover:bg-green-600">Low Crowd</Badge>
      case "medium":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Medium Crowd</Badge>
      case "high":
        return <Badge className="bg-red-500 hover:bg-red-600">High Crowd</Badge>
      default:
        return <Badge className="bg-stone-500">Unknown</Badge>
    }
  }

  // Format timestamp to readable date and time
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    return date.toLocaleString()
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

      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6 text-stone-800">Real-time Crowd Analyzer</h1>
        <p className="text-stone-600 mb-8">
          Check the crowd density at any location in real-time. Use the current location button or enter coordinates
          manually.
        </p>

        <Card className="mb-8 border border-amber-200 shadow-md">
          <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
            <CardTitle>Location Input</CardTitle>
            <CardDescription className="text-white/90">
              Enter latitude and longitude or use your current location
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block text-stone-700">Latitude</label>
                <Input
                  type="text"
                  placeholder="e.g. 28.6139"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="border-amber-200 focus-visible:ring-amber-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block text-stone-700">Longitude</label>
                <Input
                  type="text"
                  placeholder="e.g. 77.2090"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="border-amber-200 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-amber-100 bg-amber-50/50">
            <Button
              variant="outline"
              onClick={getCurrentLocation}
              disabled={loading}
              className="border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Use Current Location
                </>
              )}
            </Button>
            <Button
              onClick={analyzeCrowd}
              disabled={loading || !latitude || !longitude}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Crowd"
              )}
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {crowdData && (
          <Card className="border border-amber-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white border-b border-amber-800">
              <div className="flex justify-between items-center">
                <CardTitle>Crowd Analysis Results</CardTitle>
                {getStatusBadge(crowdData.status)}
              </div>
              <CardDescription className="text-white/90">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>As of {formatTimestamp(crowdData.timestamp)}</span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-amber-900">Location Details</h3>
                    <p className="text-sm text-stone-600">
                      Coordinates: {latitude}, {longitude}
                    </p>
                    <p className="text-sm text-stone-600">Scan radius: {crowdData.radius} meters</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium flex items-center text-amber-900">
                      <Users className="h-5 w-5 mr-2 text-amber-700" />
                      Crowd Density
                    </h3>
                    <div className="mt-2">
                      <div className="text-3xl font-bold text-amber-700">{crowdData.device_count}</div>
                      <p className="text-sm text-stone-600">Active devices detected within the radius</p>
                      {crowdData.incident_count > 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          {crowdData.incident_count} traffic incidents reported in this area
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Incidents section - only show if there are incidents */}
                  {crowdData.top_incidents && crowdData.top_incidents.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-amber-900">Traffic Incidents</h3>
                      <ul className="space-y-2 mt-2">
                        {crowdData.top_incidents.map((incident, index) => (
                          <li key={index} className="text-sm p-2 border border-amber-200 rounded bg-amber-50">
                            <div className="font-medium text-amber-900">{incident.description}</div>
                            <div className="text-xs text-stone-600">
                              Severity: {incident.severity}/4 •{" "}
                              {incident.time ? formatTimestamp(incident.time) : "No time data"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-medium text-amber-900">Recommendations</h3>
                    <ul className="list-disc list-inside text-sm text-stone-600 space-y-1 mt-2">
                      {crowdData.status === "low" && (
                        <>
                          <li>Great time to visit - fewer crowds</li>
                          <li>Perfect for photography and peaceful exploration</li>
                          <li>Should have minimal waiting times</li>
                        </>
                      )}
                      {crowdData.status === "medium" && (
                        <>
                          <li>Moderate crowd level - reasonable waiting times</li>
                          <li>Good balance for social atmosphere and space</li>
                          <li>Consider visiting popular attractions first</li>
                        </>
                      )}
                      {crowdData.status === "high" && (
                        <>
                          <li>Very crowded - expect longer waiting times</li>
                          <li>Consider visiting at a different time if possible</li>
                          <li>Keep belongings secure in crowded areas</li>
                          <li>Stay hydrated and take breaks from the crowd</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-amber-900">Area Map</h3>
                  <div className="relative h-[300px] w-full rounded-lg overflow-hidden border border-amber-200 bg-amber-50">
                    {crowdData.map_url ? (
                      <>
                        <Image
                          src={crowdData.map_url || "/placeholder.svg"}
                          alt="Location Map"
                          fill
                          style={{ objectFit: "cover" }}
                          onLoad={() => setMapLoaded(true)}
                          onError={() => {
                            console.error("Map failed to load")
                            setMapLoaded(false)
                          }}
                          className={mapLoaded ? "opacity-100" : "opacity-0"}
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority
                        />
                        {!mapLoaded && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-stone-500">Map unavailable</div>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    Red circle indicates the analyzed area. The pin marks your specified location.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
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
