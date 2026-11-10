"use client";
import React, { useState, useEffect, useRef } from 'react';

// Base URL for the IoT Building Management API
const API_BASE = 'http://127.0.0.1:5000';
// Base URL for the Servo Motor API (ngrok)
const SERVO_API_BASE = 'https://cebc17ffd644.ngrok-free.app';

function mapLevelToDensity(level?: string): 'low' | 'moderate' | 'high' {
  if (!level) return 'low';
  const l = level.toLowerCase();
  if (l === 'high') return 'high';
  if (l === 'moderate' || l === 'medium') return 'moderate';
  return 'low';
}

export default function AdminPanel() {
  const [gates, setGates] = useState([
    { id: 1, name: 'Gate 1 (North)', status: 'closed', loading: false },
    { id: 2, name: 'Gate 2 (South)', status: 'closed', loading: false },
    { id: 3, name: 'Gate 3 (East)', status: 'closed', loading: false },
    { id: 4, name: 'Gate 4 (West)', status: 'closed', loading: false },
  ]);

  const [cameras, setCameras] = useState([
    { id: 1, name: 'Camera 1 - North Gate', peopleCount: 0, density: 'low'  },
    { id: 2, name: 'Camera 2 - South Gate', peopleCount: 0, density: 'low'  },
    { id: 3, name: 'Camera 3 - East Gate', peopleCount: 0, density: 'low'  },
    { id: 4, name: 'Camera 4 - West Gate', peopleCount: 0, density: 'low'  },
  ]);

  const [microphones, setMicrophones] = useState([
    { id: 1, name: 'Mic 1 - North', decibel: 0, status: 'normal' },
    { id: 2, name: 'Mic 2 - South', decibel: 0, status: 'normal' },
    { id: 3, name: 'Mic 3 - East', decibel: 0, status: 'normal' },
    { id: 4, name: 'Mic 4 - West', decibel: 0, status: 'normal' },
  ]);


  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [feedModeById, setFeedModeById] = useState<Record<number, 'raw' | 'annotated'>>({ 
    1: 'raw', 2: 'raw', 3: 'raw', 4: 'raw' 
  });
  const [densityLoadingById, setDensityLoadingById] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const servoStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll /zones every 5s to update people counts and density per camera (always on)
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch(`${API_BASE}/zones`, { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCameras(prev => {
            const next = [...prev];
            data.forEach((z: any) => {
              const camIndex = next.findIndex(c => c.id === z.id);
              if (camIndex >= 0) {
                const count = Number(z?.count ?? 0);
                const density = mapLevelToDensity((z?.level ?? z?.density) as string);
                next[camIndex] = { ...next[camIndex], peopleCount: count, density };
              }
            });
            return next;
          });
          setDensityLoadingById(prev => {
            const updated = { ...prev } as Record<number, boolean>;
            data.forEach((z: any) => {
              updated[z.id] = false;
            });
            return updated;
          });
        }
        setLastUpdate(new Date());
      } catch (e) {
        console.error('Failed to fetch /zones', e);
      }
    };

    fetchZones();
    intervalRef.current = setInterval(fetchZones, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Control gate via Servo Motor API (ngrok)
  const controlGate = async (gateId: number, action: string) => {
    setGates(prev => prev.map(g => 
      g.id === gateId ? { ...g, loading: true } : g
    ));

    try {
      const response = await fetch(`${SERVO_API_BASE}/${action}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update all gates to reflect the servo motor status
      const newStatus = action === 'open' ? 'open' : 'closed';
      setGates(prev => prev.map(g => ({ ...g, status: newStatus, loading: false })));
      
      console.log(`Servo motor ${action} successful:`, data);
    } catch (error) {
      console.error('Error controlling servo motor:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to control servo motor: ${errorMessage}. Check ngrok connection and CORS settings.`);
      setGates(prev => prev.map(g => 
        g.id === gateId ? { ...g, loading: false } : g
      ));
    }
  };


  // Measure sound level for each microphone individually
  const measureAllSound = async () => {
    try {
      const promises = microphones.map(async (mic) => {
        try {
          const response = await fetch(`${API_BASE}/sound?zone=${mic.id}`, { 
            method: 'GET', 
            cache: 'no-store' 
          });
          const data = await response.json();
          if (response.ok) {
            const db = Number(data?.decibel ?? 0);
            let status = 'normal';
            if (db > 80) status = 'critical';
            else if (db > 65) status = 'warning';
            return { ...mic, decibel: db, status };
          }
          return mic;
        } catch (error) {
          console.error(`Error measuring sound for mic ${mic.id}:`, error);
          return mic;
        }
      });
      
      const updatedMics = await Promise.all(promises);
      setMicrophones(updatedMics);
    } catch (error) {
      console.error('Error measuring sound:', error);
    }
  };

  // Auto-refresh sound levels every 3s while monitoring
  useEffect(() => {
    if (!isMonitoring) return;
    measureAllSound();
    soundIntervalRef.current = setInterval(measureAllSound, 3000);
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, [isMonitoring]);

  // Test connection to servo API
  const testServoConnection = async () => {
    try {
      const response = await fetch(`${SERVO_API_BASE}/status`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Servo API connection test successful:', data);
        return true;
      } else {
        console.error('Servo API connection test failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Servo API connection test error:', error);
      return false;
    }
  };

  // Poll servo motor status every 5s and sync with all gates
  useEffect(() => {
    const syncServoStatus = async () => {
      try {
        const response = await fetch(`${SERVO_API_BASE}/servo_status`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Map the API response to our expected status
        const gateState = data.gate_status;
        let status = 'closed';
        if (gateState === 'open') status = 'open';
        else if (gateState === 'closed') status = 'closed';
        else if (gateState === 'moving/unknown') status = 'closed'; // Default to closed for moving
        
        // Update all gates to match servo motor status
        setGates(prev => prev.map(g => ({ ...g, status })));
        
        console.log('Servo status synced:', gateState, '->', status);
      } catch (error) {
        console.error('Error fetching servo status:', error);
        // Don't show alerts for status polling errors, just log them
      }
    };

    // Test connection first
    testServoConnection();
    
    syncServoStatus();
    servoStatusIntervalRef.current = setInterval(syncServoStatus, 5000);
    return () => {
      if (servoStatusIntervalRef.current) clearInterval(servoStatusIntervalRef.current);
    };
  }, []);

  const getDensityColor = (density: string) => {
    switch (density) {
      case 'high': return 'bg-red-500';
      case 'moderate': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getDensityTextColor = (density: string) => {
    switch (density) {
      case 'high': return 'text-red-600';
      case 'moderate': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getSoundStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'normal': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const totalPeople = cameras.reduce((sum, cam) => sum + cam.peopleCount, 0);
  const avgDecibel = microphones.reduce((sum, mic) => sum + mic.decibel, 0) / microphones.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
        <div className="px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <svg className="w-10 h-10 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Somnath Admin Control Panel</h1>
                <p className="text-purple-100 text-sm mt-1">Real-time Monitoring & Control System</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 ${
                  isMonitoring
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isMonitoring ? '⏸ Stop Monitoring' : '▶ Start Monitoring'}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">Total People</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalPeople}</p>
                </div>
                <div className="bg-white/20 rounded-full p-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">Avg. Sound Level</p>
                  <p className="text-3xl font-bold text-white mt-1">{avgDecibel.toFixed(1)} dB</p>
                </div>
                <div className="bg-white/20 rounded-full p-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">Active Cameras</p>
                  <p className="text-3xl font-bold text-white mt-1">4/4</p>
                </div>
                <div className="bg-white/20 rounded-full p-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">Last Update</p>
                  <p className="text-lg font-bold text-white mt-1">{lastUpdate.toLocaleTimeString()}</p>
                </div>
                <div className="bg-white/20 rounded-full p-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Camera Feeds Grid */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Live Camera Feeds
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cameras.map(camera => {
              const mode = feedModeById[camera.id] ?? 'raw';
              const rawUrl = `${API_BASE}/video_feed/${camera.id}`;
              const annotatedUrl = `${API_BASE}/video_feed_annotated/${camera.id}`;
              return (
                <div key={camera.id} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
                  <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
                    {mode === 'raw' ? (
                      <img className="w-full h-full object-cover" src={rawUrl} alt={camera.name} />
                    ) : (
                      <img className="w-full h-full object-cover" src={annotatedUrl} alt={`${camera.name} annotated`} />
                    )}
                    {/* Live indicator */}
                    <div className="absolute top-4 left-4 bg-red-500 px-3 py-1 rounded-full flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white text-sm font-semibold">{mode === 'raw' ? 'LIVE' : 'AI'}</span>
                    </div>
                    {/* Density badge */}
                    {densityLoadingById[camera.id] ? (
                      <div className="absolute top-4 right-4 bg-gray-500 px-4 py-2 rounded-full animate-pulse">
                        <span className="text-white text-sm font-bold uppercase">Loading…</span>
                      </div>
                    ) : (
                      <div className={`absolute top-4 right-4 ${getDensityColor(camera.density)} px-4 py-2 rounded-full`}>
                        <span className="text-white text-sm font-bold uppercase">{camera.density}</span>
                      </div>
                    )}
                    {/* Mode toggle */}
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button
                        onClick={() => setFeedModeById(prev => ({ ...prev, [camera.id]: 'raw' }))}
                        className={`px-3 py-1 rounded-md text-sm font-semibold ${mode === 'raw' ? 'bg-white text-gray-900' : 'bg-gray-600 text-white'}`}
                      >
                        Raw Feed
                      </button>
                      <button
                        onClick={() => setFeedModeById(prev => ({ ...prev, [camera.id]: 'annotated' }))}
                        className={`px-3 py-1 rounded-md text-sm font-semibold ${mode === 'annotated' ? 'bg-white text-gray-900' : 'bg-gray-600 text-white'}`}
                      >
                        Bounding Box
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-750">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">{camera.name}</h3>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className={`text-2xl font-bold ${getDensityTextColor(camera.density)}`}>
                          {camera.peopleCount}
                        </span>
                        <span className="text-gray-400 text-sm">people</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${getDensityColor(camera.density)}`}
                          style={{ width: `${Math.min((camera.peopleCount / 300) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {Math.min(Math.round((camera.peopleCount / 300) * 100), 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gate Controls */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Manual Gate Controls 
          </h2>
         
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gates.map(gate => (
              <div key={gate.id} className="bg-gray-700 rounded-lg p-5 border border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{gate.name}</h3>
                  <div className={`w-3 h-3 rounded-full ${gate.status === 'open' ? 'bg-green-400' : 'bg-red-400'} shadow-lg`}></div>
                </div>
                <div className="mb-4">
                  <div className={`text-center py-2 px-4 rounded-lg font-bold ${
                    gate.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {gate.status.toUpperCase()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => controlGate(gate.id, 'open')}
                    disabled={gate.loading || gate.status === 'open'}
                    className={`py-3 rounded-lg font-semibold transition-all ${
                      gate.status === 'open'
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {gate.loading ? '...' : 'OPEN'}
                  </button>
                  <button
                    onClick={() => controlGate(gate.id, 'close')}
                    disabled={gate.loading || gate.status === 'closed'}
                    className={`py-3 rounded-lg font-semibold transition-all ${
                      gate.status === 'closed'
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {gate.loading ? '...' : 'CLOSE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sound Level Monitoring */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Sound Level Monitoring (Decibels)
            </h2>
            <button
              onClick={measureAllSound}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {microphones.map(mic => (
              <div key={mic.id} className="bg-gray-700 rounded-lg p-5 border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-white">{mic.name}</h3>
                  <div className={`w-3 h-3 rounded-full ${getSoundStatusColor(mic.status)} animate-pulse`}></div>
                </div>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-white mb-1">{mic.decibel.toFixed(1)}</div>
                  <div className="text-gray-400 text-sm">dB</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0 dB</span>
                    <span>100 dB</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${getSoundStatusColor(mic.status)}`}
                      style={{ width: `${Math.min((mic.decibel / 100) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className={`text-center text-sm font-semibold ${
                    mic.status === 'critical' ? 'text-red-400' :
                    mic.status === 'warning' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {mic.status.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-gray-700 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2">Sound Level Reference:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-300">0-65 dB: Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-300">65-80 dB: Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-300">80+ dB: Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Controls */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-red-700">
          <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Emergency Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                if (confirm('Open ALL gates immediately?')) {
                  gates.forEach(gate => controlGate(gate.id, 'open'));
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-lg font-bold text-lg transition-all shadow-lg"
            >
              🚨 OPEN ALL GATES
            </button>
            <button
              onClick={() => {
                if (confirm('Close ALL gates immediately?')) {
                  gates.forEach(gate => controlGate(gate.id, 'close'));
                }
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white py-4 px-6 rounded-lg font-bold text-lg transition-all shadow-lg"
            >
              🚫 CLOSE ALL GATES
            </button>
            <button
              onClick={() => alert('Emergency alert sent to all personnel!')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-4 px-6 rounded-lg font-bold text-lg transition-all shadow-lg"
            >
              📢 SEND ALERT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}