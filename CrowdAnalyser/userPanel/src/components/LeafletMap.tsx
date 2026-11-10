"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type DensityLevel = 'low' | 'moderate' | 'high';

interface MedicalCamp {
  id: number;
  name: string;
  position: [number, number];
}

interface DensityZone {
  id: number;
  name: string;
  position: [number, number];
  density: DensityLevel;
  level?: DensityLevel;
  count: number;
  description?: string;
}

interface NearestCamp extends MedicalCamp {
  distance: number;
}

interface LeafletMapProps {
  center: [number, number];
  densityZones: DensityZone[];
  medicalCamps: MedicalCamp[];
  userLocation: [number, number] | null;
  nearestCamp: NearestCamp | null;
}

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createColorIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = createColorIcon('red');
const yellowIcon = createColorIcon('yellow');
const greenIcon = createColorIcon('green');
const blueIcon = createColorIcon('blue');
const violetIcon = createColorIcon('violet');

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 17);
    }
  }, [center, map]);
  return null;
}

const getIconForDensity = (density: DensityLevel) => {
  switch (density) {
    case 'high': return redIcon;
    case 'moderate': return yellowIcon;
    case 'low': return greenIcon;
    default: return greenIcon;
  }
};

const getColorForDensity = (density: DensityLevel) => {
  switch (density) {
    case 'high': return '#ef4444';
    case 'moderate': return '#f59e0b';
    case 'low': return '#10b981';
    default: return '#10b981';
  }
};

export default function LeafletMap({ center, densityZones, medicalCamps, userLocation, nearestCamp }: LeafletMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={17}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {nearestCamp && <RecenterMap center={nearestCamp.position} />}

      {densityZones.map(zone => (
        <React.Fragment key={zone.id}>
          <Marker position={zone.position} icon={getIconForDensity(zone.density)}>
            <Popup>
              <div className="text-center">
                <strong className="text-lg">{zone.name}</strong>
                <p className="text-sm capitalize mt-1">
                  Density: <span className="font-semibold">{zone.density}</span>
                </p>
                <p className="text-sm">People: {zone.count}</p>
                {zone.description && <p className="text-xs text-gray-600 mt-1">{zone.description}</p>}
              </div>
            </Popup>
          </Marker>
          <Circle
            center={zone.position}
            radius={30}
            pathOptions={{
              color: getColorForDensity(zone.density),
              fillColor: getColorForDensity(zone.density),
              fillOpacity: 0.2
            }}
          />
        </React.Fragment>
      ))}

      {medicalCamps.map(camp => (
        <Marker
          key={camp.id}
          position={camp.position}
          icon={nearestCamp && nearestCamp.id === camp.id ? createColorIcon('red') : blueIcon}
        >
          <Popup>
            <div className="text-center">
              <strong className="text-lg">{camp.name}</strong>
              <p className="text-sm mt-1">Medical Facility</p>
              {nearestCamp && nearestCamp.id === camp.id && (
                <p className="text-xs text-green-600 font-semibold mt-2">
                  Nearest Camp ({(nearestCamp.distance * 1000).toFixed(0)} m)
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {userLocation && (
        <Marker position={userLocation} icon={violetIcon}>
          <Popup>
            <div className="text-center">
              <strong>Your Location</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {userLocation && nearestCamp && (
        <Polyline
          positions={[userLocation, nearestCamp.position]}
          pathOptions={{
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
          }}
        />
      )}
    </MapContainer>
  );
}



