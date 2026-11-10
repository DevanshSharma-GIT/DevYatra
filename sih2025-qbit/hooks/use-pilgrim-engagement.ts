"use client"

import { useState, useEffect, useCallback } from "react"
import PilgrimEngagementService, { 
  TempleInfo, 
  TempleSchedule, 
  CrowdDensityData, 
  UserProgress, 
  LeaderboardEntry,
  SafetyAlert 
} from "@/services/pilgrimEngagementService"

export function usePilgrimEngagement() {
  const [templeInfo, setTempleInfo] = useState<TempleInfo | null>(null)
  const [schedule, setSchedule] = useState<TempleSchedule[]>([])
  const [crowdData, setCrowdData] = useState<CrowdDensityData[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activeAlerts, setActiveAlerts] = useState<SafetyAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const service = PilgrimEngagementService.getInstance()

  const fetchTempleInfo = useCallback(async () => {
    try {
      const data = await service.getTempleInfo()
      setTempleInfo(data)
    } catch (err) {
      setError('Failed to fetch temple information')
      console.error('Error fetching temple info:', err)
    }
  }, [service])

  const fetchSchedule = useCallback(async (date?: string) => {
    try {
      const data = await service.getTempleSchedule(date)
      setSchedule(data)
    } catch (err) {
      setError('Failed to fetch temple schedule')
      console.error('Error fetching schedule:', err)
    }
  }, [service])

  const fetchCrowdData = useCallback(async () => {
    try {
      const data = await service.getCrowdDensityData()
      setCrowdData(data)
    } catch (err) {
      setError('Failed to fetch crowd data')
      console.error('Error fetching crowd data:', err)
    }
  }, [service])

  const fetchUserProgress = useCallback(async (userId: string) => {
    try {
      const data = await service.getUserProgress(userId)
      setUserProgress(data)
    } catch (err) {
      setError('Failed to fetch user progress')
      console.error('Error fetching user progress:', err)
    }
  }, [service])

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await service.getLeaderboard()
      setLeaderboard(data)
    } catch (err) {
      setError('Failed to fetch leaderboard')
      console.error('Error fetching leaderboard:', err)
    }
  }, [service])

  const fetchActiveAlerts = useCallback(async () => {
    try {
      const data = await service.getActiveAlerts()
      setActiveAlerts(data)
    } catch (err) {
      setError('Failed to fetch active alerts')
      console.error('Error fetching active alerts:', err)
    }
  }, [service])

  const sendSafetyAlert = useCallback(async (alertData: Omit<SafetyAlert, 'id' | 'timestamp'>) => {
    try {
      const alert = await service.sendSafetyAlert(alertData)
      // Refresh alerts after sending
      await fetchActiveAlerts()
      return alert
    } catch (err) {
      setError('Failed to send safety alert')
      console.error('Error sending safety alert:', err)
      throw err
    }
  }, [service, fetchActiveAlerts])

  const awardPoints = useCallback(async (userId: string, points: number, reason: string) => {
    try {
      const result = await service.awardPoints(userId, points, reason)
      // Refresh user progress after awarding points
      await fetchUserProgress(userId)
      return result
    } catch (err) {
      setError('Failed to award points')
      console.error('Error awarding points:', err)
      throw err
    }
  }, [service, fetchUserProgress])

  const getOfflineData = useCallback(async () => {
    try {
      return await service.getOfflineData()
    } catch (err) {
      setError('Failed to get offline data')
      console.error('Error getting offline data:', err)
      throw err
    }
  }, [service])

  const refreshAll = useCallback(async (userId?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        fetchTempleInfo(),
        fetchSchedule(),
        fetchCrowdData(),
        fetchLeaderboard(),
        fetchActiveAlerts(),
        ...(userId ? [fetchUserProgress(userId)] : [])
      ])
    } catch (err) {
      setError('Failed to refresh data')
      console.error('Error refreshing data:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchTempleInfo, fetchSchedule, fetchCrowdData, fetchLeaderboard, fetchActiveAlerts, fetchUserProgress])

  const clearCache = useCallback(() => {
    service.clearCache()
  }, [service])

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [refreshAll])

  // Initial data fetch
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  return {
    // Data
    templeInfo,
    schedule,
    crowdData,
    userProgress,
    leaderboard,
    activeAlerts,
    loading,
    error,
    
    // Actions
    fetchTempleInfo,
    fetchSchedule,
    fetchCrowdData,
    fetchUserProgress,
    fetchLeaderboard,
    fetchActiveAlerts,
    sendSafetyAlert,
    awardPoints,
    getOfflineData,
    refreshAll,
    clearCache,
    
    // Utilities
    setError
  }
}
