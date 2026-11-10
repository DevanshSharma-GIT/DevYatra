"use client"

import { useMemo } from "react"
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMap,
  useMapEvent,
} from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import { DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"

export interface MedicalFacilityMarker {
  id: string
  name: string
  type: "hospital" | "clinic" | "first_aid"
  position: LatLngExpression
  address: string
  contact: string
  services: string[]
  distanceKm: number
  isHighlighted?: boolean
}

interface MedicalMapProps {
  facilities: MedicalFacilityMarker[]
  userLocation: LatLngExpression
  highlightedFacilityId?: string | null
  onFacilityFocus?: (facilityId: string | null) => void
}

const getFacilityColor = (facility: MedicalFacilityMarker, highlightedFacilityId?: string | null) => {
  if (facility.id === highlightedFacilityId || facility.isHighlighted) {
    return "#dc2626" // red-600
  }

  switch (facility.type) {
    case "hospital":
      return "#2563eb" // blue-600
    case "clinic":
      return "#2563eb"
    case "first_aid":
      return "#047857" // emerald-700
    default:
      return "#7c3aed" // violet-600
  }
}

const UserLocationMarker = ({ position }: { position: LatLngExpression }) => {
  const icon = useMemo(
    () =>
      new DivIcon({
        html: '<div class="pulse-marker" style="background-color:#d97706;"></div>',
        className: "user-location-marker",
        iconSize: [18, 18],
      }),
    [],
  )

  return <Marker position={position} icon={icon} />
}

const FitView = ({ userLocation }: { userLocation: LatLngExpression }) => {
  const map = useMap()

  useMemo(() => {
    map.setView(userLocation, 14)
  }, [map, userLocation])

  return null
}

const HighlightClickHandler = ({ onFacilityFocus }: { onFacilityFocus?: (facilityId: string | null) => void }) => {
  useMapEvent("click", () => onFacilityFocus?.(null))
  return null
}

export function MedicalMap({ facilities, userLocation, highlightedFacilityId, onFacilityFocus }: MedicalMapProps) {
  const sortedFacilities = useMemo(
    () => [...facilities].sort((a, b) => a.distanceKm - b.distanceKm),
    [facilities],
  )

  return (
    <MapContainer
      center={userLocation}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      className="rounded-2xl overflow-hidden border border-amber-200 shadow-md"
      scrollWheelZoom
      attributionControl
    >
      <FitView userLocation={userLocation} />
      <HighlightClickHandler onFacilityFocus={onFacilityFocus} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <UserLocationMarker position={userLocation} />

      {sortedFacilities.map((facility) => (
        <CircleMarker
          key={facility.id}
          center={facility.position}
          radius={facility.id === highlightedFacilityId ? 16 : 10}
          weight={facility.id === highlightedFacilityId ? 2 : 1}
          color={getFacilityColor(facility, highlightedFacilityId)}
          fillColor={getFacilityColor(facility, highlightedFacilityId)}
          fillOpacity={facility.id === highlightedFacilityId ? 0.75 : 0.55}
          eventHandlers={{
            click: (event) => {
              event.originalEvent.stopPropagation()
              onFacilityFocus?.(facility.id)
            },
          }}
        >
          <Popup>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-stone-800">{facility.name}</h3>
              <p className="text-xs text-stone-500">{facility.address}</p>
              <p className="text-xs text-stone-500">{facility.contact}</p>
              <p className="text-xs font-medium text-amber-700">{facility.distanceKm.toFixed(2)} km away</p>
              <ul className="mt-1 text-xs text-stone-500 list-disc list-inside space-y-0.5">
                {facility.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
