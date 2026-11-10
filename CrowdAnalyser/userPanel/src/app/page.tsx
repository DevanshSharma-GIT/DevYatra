"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// TypeScript interfaces
interface Gate {
  id: number;
  name: string;
  status: 'open' | 'closed';
  loading?: boolean;
}

interface MedicalCamp {
  id: number;
  name: string;
  position: [number, number];
}

interface DensityZone {
  id: number;
  name: string;
  position: [number, number];
  density: 'low' | 'moderate' | 'high';
  level?: 'low' | 'moderate' | 'high';
  count: number;
  description?: string;
}

interface NearestCamp extends MedicalCamp {
  distance: number;
}

const LeafletMap = dynamic(() => import('../components/LeafletMap'), { ssr: false });

export default function SomnathDashboard() {
  const API_BASE = 'http://127.0.0.1:5000';

  const [gates, setGates] = useState<Gate[]>([
    { id: 1, name: 'Gate 1 (North)', status: 'closed', loading: false },
    { id: 2, name: 'Gate 2 (South)', status: 'closed', loading: false },
    { id: 3, name: 'Gate 3 (East)', status: 'closed', loading: false },
    { id: 4, name: 'Gate 4 (West)', status: 'closed', loading: false },
  ]);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearestCamp, setNearestCamp] = useState<NearestCamp | null>(null);
  const [densityZones, setDensityZones] = useState<DensityZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const templeCenter: [number, number] = [20.888074637207787, 70.40114310442645];

  // Medical camp locations (hardcoded)
  const medicalCamps: MedicalCamp[] = [
    { id: 1, name: 'Medical Camp A', position: [20.887762, 70.401234] },
    { id: 2, name: 'Medical Camp B', position: [20.888279, 70.401210] },
    { id: 3, name: 'Medical Camp C', position: [20.888021, 70.401620] },
  ];

  // Fetch density data from Flask backend
  useEffect(() => {
    fetchDensityData();
    getUserLocation();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchDensityData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDensityData = async () => {
    try {
      const res = await fetch(`${API_BASE}/zones`, { cache: 'no-store' });
      if (!res.ok) {
        console.error('Failed to fetch zones:', res.statusText);
        return;
      }
      const data: DensityZone[] = await res.json();
      
      // Map the backend response to our format
      const mappedZones = data.map(zone => ({
        ...zone,
        density: (zone.level || zone.density) as 'low' | 'moderate' | 'high',
        position: zone.position as [number, number]
      }));
      
      setDensityZones(mappedZones);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching density data:', error);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Using a mock location near the temple
          setUserLocation([20.887802, 70.401475] as [number, number]);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to temple location
          setUserLocation(templeCenter);
        }
      );
    } else {
      setUserLocation(templeCenter);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findNearestMedicalCamp = () => {
    if (!userLocation) {
      alert('User location not available');
      return;
    }

    const nearestCalculated: NearestCamp | null = medicalCamps.reduce<NearestCamp | null>((currentNearest, camp) => {
      const distance = calculateDistance(
        userLocation[0],
        userLocation[1],
        camp.position[0],
        camp.position[1]
      );
      if (!currentNearest || distance < currentNearest.distance) {
        return { ...camp, distance };
      }
      return currentNearest;
    }, null);

    setNearestCamp(nearestCalculated);

    if (nearestCalculated) {
      alert(`Nearest medical camp: ${nearestCalculated.name} (${(nearestCalculated.distance * 1000).toFixed(0)} meters away)`);
    }
  };

  const toggleGate = async (gateId: number) => {
    const gate = gates.find(g => g.id === gateId);
    if (!gate) return;
    
    setGates(gates.map(g => 
      g.id === gateId ? { ...g, loading: true } : g
    ));

    const newAction = gate.status === 'open' ? 'close' : 'open';

    try {
      const response = await fetch(`${API_BASE}/gate?gate=${gateId}&action=${newAction}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setGates(gates.map(g => 
          g.id === gateId 
            ? { ...g, status: data.status === 'opened' ? 'open' : 'closed', loading: false } 
            : g
        ));
      } else {
        console.error('Failed to toggle gate');
        setGates(gates.map(g => 
          g.id === gateId ? { ...g, loading: false } : g
        ));
      }
    } catch (error) {
      console.error('Error toggling gate:', error);
      alert('Failed to control gate. Check if Flask server is running on port 5000.');
      setGates(gates.map(g => 
        g.id === gateId ? { ...g, loading: false } : g
      ));
    }
  };

  const getColorForDensity = (density: 'high' | 'moderate' | 'low') => {
    switch (density) {
      case 'high': return '#ef4444';
      case 'moderate': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#10b981';
    }
  };

  const totalPeople = densityZones.reduce((sum, zone) => sum + (zone.count || 0), 0);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-orange-800 shadow-lg z-10">
        <div className="px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-full p-2">
                <svg className="w-8 h-8 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Somnath Crowd Dashboard</h1>
                <p className="text-orange-100 text-sm">Real-time Monitoring System</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={findNearestMedicalCamp}
                className="bg-white hover:bg-orange-50 text-orange-600 font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Find Nearest Medical Camp
              </button>
              <button
                onClick={fetchDensityData}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-orange-100 text-xs">Total People</p>
              <p className="text-2xl font-bold text-white">{totalPeople}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-orange-100 text-xs">Active Zones</p>
              <p className="text-2xl font-bold text-white">{densityZones.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-orange-100 text-xs">Medical Camps</p>
              <p className="text-2xl font-bold text-white">{medicalCamps.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-orange-100 text-xs">Last Update</p>
              <p className="text-sm font-bold text-white">{lastUpdate.toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Gate Controls */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {gates.map(gate => (
              <button
                key={gate.id}
                
                disabled={gate.loading}
                className={`py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                  gate.status === 'open'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                } ${gate.loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {gate.loading ? '...' : `${gate.name}: ${gate.status.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="bg-gray-800 px-4 py-2 flex flex-wrap gap-4 text-sm text-white">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span>High Density</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <span>Moderate Density</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span>Low Density</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
          <span>Medical Camp</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
          <span>Your Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-500" style={{background: 'repeating-linear-gradient(to right, #10b981 0px, #10b981 10px, transparent 10px, transparent 20px)'}}></div>
          <span>Direction to Nearest Camp</span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <LeafletMap
          center={templeCenter}
          densityZones={densityZones}
          medicalCamps={medicalCamps}
          userLocation={userLocation}
          nearestCamp={nearestCamp}
        />
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 px-4 py-2 text-white text-sm flex justify-between items-center">
        <div>
          Last Updated: {lastUpdate.toLocaleTimeString()}
          {nearestCamp && (
            <span className="ml-4 text-green-400">
              Nearest: {nearestCamp.name} ({(nearestCamp.distance * 1000).toFixed(0)} meters)
            </span>
          )}
        </div>
        <div className="flex gap-4">
          <span>Total People: {totalPeople}</span>
          <span>Zones: {densityZones.length}</span>
          <span>Medical Camps: {medicalCamps.length}</span>
        </div>
      </div>
    </div>
  );
}