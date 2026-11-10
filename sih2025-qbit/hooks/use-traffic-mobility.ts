"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ParkingData, 
  ShuttleData, 
  TrafficData, 
  SystemStatus,
  TrafficMobilityService,
  useTrafficMobilityService 
} from '@/services/trafficMobilityService'

interface TrafficMobilityState {
  parkingData: ParkingData | null;
  shuttleData: ShuttleData | null;
  trafficData: TrafficData | null;
  systemStatus: SystemStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isOnline: boolean;
  autoRefresh: boolean;
}

interface UseTrafficMobilityOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableWebSocket?: boolean;
  onError?: (error: Error) => void;
  onUpdate?: (data: any) => void;
}

export function useTrafficMobility(options: UseTrafficMobilityOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    enableWebSocket = true,
    onError,
    onUpdate
  } = options

  const [state, setState] = useState<TrafficMobilityState>({
    parkingData: null,
    shuttleData: null,
    trafficData: null,
    systemStatus: null,
    loading: true,
    error: null,
    lastUpdate: null,
    isOnline: true,
    autoRefresh
  })

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const wsUnsubscribeRef = useRef<(() => void) | null>(null)
  const { 
    getParkingData, 
    getShuttleData, 
    getTrafficData, 
    getSystemStatus,
    initializeWebSocket,
    subscribeToUpdates,
    cleanup
  } = useTrafficMobilityService()

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const [parkingData, shuttleData, trafficData, systemStatus] = await Promise.allSettled([
        getParkingData(),
        getShuttleData(),
        getTrafficData(),
        getSystemStatus()
      ])

      setState(prev => ({
        ...prev,
        parkingData: parkingData.status === 'fulfilled' ? parkingData.value : prev.parkingData,
        shuttleData: shuttleData.status === 'fulfilled' ? shuttleData.value : prev.shuttleData,
        trafficData: trafficData.status === 'fulfilled' ? trafficData.value : prev.trafficData,
        systemStatus: systemStatus.status === 'fulfilled' ? systemStatus.value : prev.systemStatus,
        loading: false,
        lastUpdate: new Date(),
        error: null
      }))

      // Trigger onUpdate callback
      if (onUpdate) {
        onUpdate({
          parking: parkingData.status === 'fulfilled' ? parkingData.value : null,
          shuttle: shuttleData.status === 'fulfilled' ? shuttleData.value : null,
          traffic: trafficData.status === 'fulfilled' ? trafficData.value : null,
          system: systemStatus.status === 'fulfilled' ? systemStatus.value : null
        })
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))

      if (onError && error instanceof Error) {
        onError(error)
      }
    }
  }, [getParkingData, getShuttleData, getTrafficData, getSystemStatus, onUpdate, onError])

  // Handle real-time updates via WebSocket
  useEffect(() => {
    if (!enableWebSocket) return

    // Initialize WebSocket connection
    initializeWebSocket()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUpdates((data) => {
      setState(prev => {
        const updated = { ...prev, lastUpdate: new Date() }

        // Update specific data based on the type received
        switch (data.type) {
          case 'parking_update':
            updated.parkingData = { ...prev.parkingData, ...data.data }
            break
          case 'shuttle_update':
            updated.shuttleData = { ...prev.shuttleData, ...data.data }
            break
          case 'traffic_update':
            updated.trafficData = { ...prev.trafficData, ...data.data }
            break
          case 'system_status':
            updated.systemStatus = { ...prev.systemStatus, ...data.data }
            break
          case 'full_update':
            return {
              ...prev,
              parkingData: data.data.parking || prev.parkingData,
              shuttleData: data.data.shuttle || prev.shuttleData,
              trafficData: data.data.traffic || prev.trafficData,
              systemStatus: data.data.system || prev.systemStatus,
              lastUpdate: new Date()
            }
        }

        return updated
      })

      if (onUpdate) {
        onUpdate(data)
      }
    })

    wsUnsubscribeRef.current = unsubscribe

    return () => {
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current()
      }
    }
  }, [enableWebSocket, initializeWebSocket, subscribeToUpdates, onUpdate])

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return

    // Initial fetch
    fetchAllData()

    // Set up interval for regular updates
    refreshIntervalRef.current = setInterval(fetchAllData, refreshInterval)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, fetchAllData])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }))
      if (autoRefresh) {
        fetchAllData() // Refresh data when coming back online
      }
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [autoRefresh, fetchAllData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current()
      }
      if (enableWebSocket) {
        cleanup()
      }
    }
  }, [enableWebSocket, cleanup])

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchAllData()
  }, [fetchAllData])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setState(prev => {
      const newAutoRefresh = !prev.autoRefresh
      
      if (newAutoRefresh) {
        // Start auto-refresh
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
        refreshIntervalRef.current = setInterval(fetchAllData, refreshInterval)
      } else {
        // Stop auto-refresh
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
          refreshIntervalRef.current = null
        }
      }

      return { ...prev, autoRefresh: newAutoRefresh }
    })
  }, [fetchAllData, refreshInterval])

  // Get specific data by type
  const getParkingDataOnly = useCallback(async () => {
    try {
      const data = await getParkingData()
      setState(prev => ({ 
        ...prev, 
        parkingData: data,
        lastUpdate: new Date() 
      }))
      return data
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error)
      }
      throw error
    }
  }, [getParkingData, onError])

  const getShuttleDataOnly = useCallback(async () => {
    try {
      const data = await getShuttleData()
      setState(prev => ({ 
        ...prev, 
        shuttleData: data,
        lastUpdate: new Date() 
      }))
      return data
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error)
      }
      throw error
    }
  }, [getShuttleData, onError])

  const getTrafficDataOnly = useCallback(async () => {
    try {
      const data = await getTrafficData()
      setState(prev => ({ 
        ...prev, 
        trafficData: data,
        lastUpdate: new Date() 
      }))
      return data
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error)
      }
      throw error
    }
  }, [getTrafficData, onError])

  // Connection status
  const connectionStatus = {
    online: state.isOnline,
    websocket: state.systemStatus?.connectivity?.websocket || false,
    api: state.systemStatus?.connectivity?.api || false,
    lastUpdate: state.lastUpdate
  }

  // Data freshness indicators
  const dataFreshness = {
    parking: state.systemStatus?.parking?.dataFreshness || 'unknown',
    shuttle: state.systemStatus?.shuttles?.lastUpdate ? 
      Date.now() - new Date(state.systemStatus.shuttles.lastUpdate).getTime() < 60000 ? 'fresh' : 'stale' : 'unknown',
    traffic: state.systemStatus?.traffic?.lastUpdate ? 
      Date.now() - new Date(state.systemStatus.traffic.lastUpdate).getTime() < 60000 ? 'fresh' : 'stale' : 'unknown'
  }

  return {
    // State
    ...state,

    // Data refresh functions
    refresh,
    refreshParking: getParkingDataOnly,
    refreshShuttle: getShuttleDataOnly,
    refreshTraffic: getTrafficDataOnly,

    // Controls
    toggleAutoRefresh,

    // Status information
    connectionStatus,
    dataFreshness,

    // Computed values
    hasData: !!(state.parkingData || state.shuttleData || state.trafficData),
    isStale: state.lastUpdate ? Date.now() - state.lastUpdate.getTime() > refreshInterval * 2 : true,
    totalAlerts: state.trafficData?.alerts?.length || 0,
    availableSpots: state.parkingData?.totalAvailable || 0,
    activeShuttles: state.shuttleData?.globalStatus?.totalActiveShuttles || 0,
  }
}

// Hook for specific modules
export function useParkingData(options: UseTrafficMobilityOptions = {}) {
  const { parkingData, refreshParking, loading, error, connectionStatus } = useTrafficMobility({
    ...options,
    autoRefresh: false // Manage refresh manually for specific data
  })

  return {
    data: parkingData,
    refresh: refreshParking,
    loading,
    error,
    connectionStatus
  }
}

export function useShuttleData(options: UseTrafficMobilityOptions = {}) {
  const { shuttleData, refreshShuttle, loading, error, connectionStatus } = useTrafficMobility({
    ...options,
    autoRefresh: false
  })

  return {
    data: shuttleData,
    refresh: refreshShuttle,
    loading,
    error,
    connectionStatus
  }
}

export function useTrafficData(options: UseTrafficMobilityOptions = {}) {
  const { trafficData, refreshTraffic, loading, error, connectionStatus } = useTrafficMobility({
    ...options,
    autoRefresh: false
  })

  return {
    data: trafficData,
    refresh: refreshTraffic,
    loading,
    error,
    connectionStatus
  }
}

export default useTrafficMobility
