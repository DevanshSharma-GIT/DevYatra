"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Popup, useMapEvents, useMap, Marker, CircleMarker } from "react-leaflet"
import { type LatLng, type LatLngExpression, type LatLngBoundsExpression, DivIcon } from "leaflet"
import { Badge } from "@/components/ui/badge"
import { UserCircle, Clock } from "lucide-react"
import "leaflet/dist/leaflet.css"

// Define UserReport interface locally
interface UserReport {
  id: number
  latitude: number
  longitude: number
  type: string
  description?: string | null
  username?: string | null
  timestamp: string
}

// Format date helper
const formatDate = (isoString: string) => {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch (e) {
    return "Invalid Date"
  }
}

// Get color based on report type - updated to match amber theme
const getMarkerColor = (type: string): string => {
  switch (type.toLowerCase()) {
    case "pickpocketing":
      return "#ef4444" // red-500
    case "scam":
      return "#f97316" // orange-500
    case "safe_locker":
      return "#0ea5e9" // sky-500
    case "harassment":
      return "#a855f7" // purple-500
    case "health":
      return "#22c55e" // green-500
    case "tip":
      return "#0d9488" // teal-600
    case "transportation":
      return "#3b82f6" // blue-500
    default:
      return "#d97706" // amber-600 as default
  }
}

// Component to handle map events
const MapEventsHandler: React.FC<{ onClick: (latlng: LatLng) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e: any) {
      console.log("Map click event detected", e.latlng)
      onClick(e.latlng)
    },
  })
  return null
}

const GujaratBoundsSetter: React.FC<{ bounds: LatLngBoundsExpression }> = ({ bounds }) => {
  const map = useMap()

  useEffect(() => {
    map.setMaxBounds(bounds)
    map.setMinZoom(6)
    map.fitBounds(bounds)
  }, [map, bounds])

  return null
}

// Component to recenter the map based on user location
const LocateUser = ({
  setUserLocation,
  isWithinBounds,
}: {
  setUserLocation: (coords: [number, number]) => void
  isWithinBounds: (lat: number, lng: number) => boolean
}) => {
  const map = useMap()

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos: [number, number] = [position.coords.latitude, position.coords.longitude]
          if (isWithinBounds(userPos[0], userPos[1])) {
            map.setView(userPos, 13)
            setUserLocation(userPos)
          }
        },
        (error) => {
          console.error("Error getting location:", error)
        },
      )
    }
  }, [map, setUserLocation, isWithinBounds])

  return null
}

interface SafetyMapProps {
  reports: UserReport[]
  onMapClick: (latlng: LatLng) => void
}

const SafetyMap: React.FC<SafetyMapProps> = ({ reports, onMapClick }) => {
  const GUJARAT_BOUNDS: LatLngBoundsExpression = [
    [20.0, 68.0],
    [24.7, 74.5],
  ]
  const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924]

  const isWithinBounds = (lat: number, lng: number) => lat >= 20.0 && lat <= 24.7 && lng >= 68.0 && lng <= 74.5

  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER)
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null)
  const [popupPosition, setPopupPosition] = useState<LatLngExpression | null>(null)

  // Function to show report details when clicking near a report
  const handleMapClick = (latlng: LatLng) => {
    onMapClick(latlng)

    // Find if user clicked near any report (within ~50 meters)
    const nearbyReport = reports.find((report) => {
      const distance = Math.sqrt(Math.pow(report.latitude - latlng.lat, 2) + Math.pow(report.longitude - latlng.lng, 2))
      return distance < 0.0005 // Rough approximation
    })

    if (nearbyReport) {
      setSelectedReport(nearbyReport)
      setPopupPosition([nearbyReport.latitude, nearbyReport.longitude])
    } else {
      setSelectedReport(null)
      setPopupPosition(null)
    }
  }

  return (
    <MapContainer
      center={userLocation}
      zoom={7}
      scrollWheelZoom={true}
      style={{ height: "75vh", width: "100%", zIndex: 10 }}
      className="safety-map rounded-md overflow-hidden"
      maxBounds={GUJARAT_BOUNDS}
      maxBoundsViscosity={1.0}
      minZoom={6}
    >
      <GujaratBoundsSetter bounds={GUJARAT_BOUNDS} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Add circle markers for each report */}
      {reports.map((report) => (
        <CircleMarker
          key={report.id}
          center={[report.latitude, report.longitude]}
          radius={8}
          fillColor={getMarkerColor(report.type)}
          color={getMarkerColor(report.type)}
          weight={1}
          opacity={1}
          fillOpacity={0.7}
          eventHandlers={{
            click: () => {
              setSelectedReport(report)
              setPopupPosition([report.latitude, report.longitude])
            },
          }}
        />
      ))}

      {/* Center on user's current location */}
  <LocateUser setUserLocation={setUserLocation} isWithinBounds={isWithinBounds} />

      {/* User location marker */}
      <Marker
        position={userLocation}
        icon={
          new DivIcon({
            html: `<div class="pulse-marker" style="background-color: #d97706;"></div>`, // Amber color
            className: "user-location-marker",
            iconSize: [20, 20],
          })
        }
      />

      {/* Event handler */}
      <MapEventsHandler onClick={handleMapClick} />

      {/* Popup for selected report */}
      {selectedReport && popupPosition && (
        <Popup position={popupPosition}>
          <div className="space-y-1 text-sm">
            <Badge variant="secondary" className="text-xs capitalize mb-1 bg-amber-100 text-amber-800 border-amber-200">
              {selectedReport.type.replace("_", " ")}
            </Badge>
            <p className="font-medium">{selectedReport.description || "No description"}</p>
            <div className="text-xs text-stone-500 flex items-center gap-1">
              <UserCircle className="h-3 w-3" /> {selectedReport.username || "Anonymous"}
            </div>
            <div className="text-xs text-stone-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDate(selectedReport.timestamp)}
            </div>
          </div>
        </Popup>
      )}
    </MapContainer>
  )
}

export default SafetyMap
