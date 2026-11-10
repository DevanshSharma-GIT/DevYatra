"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { SmartQueueService, QueueInfo, QueueStatistics, UserQueueTicket, DarshanSlot, QueueSystemStatus, NotificationSettings } from '@/services/smartQueueService'

export interface UseSmartQueueState {
  // Queue Status
  queues: QueueInfo[]
  statistics: QueueStatistics
  systemStatus: QueueSystemStatus
  
  // User Tickets
  userTickets: UserQueueTicket[]
  activeTickets: UserQueueTicket[]
  
  // Slots
  availableSlots: DarshanSlot[]
  
  // UI State
  loading: boolean
  error: string | null
  isOnline: boolean
  lastUpdate: Date
  refreshing: boolean
  
  // Notification state
  notificationsEnabled: boolean
  notificationSettings: NotificationSettings
}

export interface UseSmartQueueActions {
  // Queue actions
  refreshQueueStatus: () => Promise<void>
  joinQueue: (queueId: string, userData: { name: string; phoneNumber?: string; email?: string }) => Promise<{ success: boolean; ticket?: UserQueueTicket; message: string }>
  leaveQueue: (ticketId: string) => Promise<{ success: boolean; message: string }>
  
  // Slot actions
  refreshSlots: (date?: string) => Promise<void>
  bookSlot: (slotId: string, userData: { name: string; phoneNumber: string; email?: string }) => Promise<{ success: boolean; ticket?: UserQueueTicket; message: string }>
  cancelSlotBooking: (ticketId: string) => Promise<{ success: boolean; message: string }>
  
  // Ticket actions
  refreshUserTickets: (userId?: string) => Promise<void>
  downloadTicket: (ticket: UserQueueTicket) => void
  validateQRCode: (qrCode: string) => Promise<{ valid: boolean; ticket?: UserQueueTicket; message: string }>
  
  // System actions
  updateNotificationSettings: (settings: NotificationSettings) => Promise<void>
  enableNotifications: () => Promise<boolean>
  markTicketAsUsed: (ticketId: string) => Promise<void>
  
  // Manual refresh
  forceRefresh: () => Promise<void>
}

export interface UseSmartQueueOptions {
  userId?: string
  autoRefreshInterval?: number // milliseconds
  enableWebSocket?: boolean
  enableNotifications?: boolean
  offlineMode?: boolean
}

export function useSmartQueue(options: UseSmartQueueOptions = {}): UseSmartQueueState & UseSmartQueueActions {
  const {
    userId = 'default-user',
    autoRefreshInterval = 30000, // 30 seconds
    enableWebSocket = true,
    enableNotifications = true,
    offlineMode = false
  } = options

  // State
  const [state, setState] = useState<UseSmartQueueState>({
    queues: [],
    statistics: {
      totalVisitorsToday: 0,
      averageWaitTime: 0,
      peakHours: '',
      currentLoad: 0,
      completedToday: 0,
      cancelledToday: 0,
      noShowRate: 0
    },
    systemStatus: {
      online: true,
      lastUpdate: new Date(),
      activeQueues: 0,
      totalCapacity: 0,
      systemLoad: 0,
      maintenanceMode: false,
      emergencyMode: false
    },
    userTickets: [],
    activeTickets: [],
    availableSlots: [],
    loading: false,
    error: null,
    isOnline: !offlineMode,
    lastUpdate: new Date(),
    refreshing: false,
    notificationsEnabled: false,
    notificationSettings: {
      sms: true,
      push: true,
      email: false,
      reminderTime: 15,
      languages: ['en']
    }
  })

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const wsUnsubscribeRef = useRef<(() => void) | null>(null)
  const notificationPermissionRef = useRef<boolean>(false)

  // Helper to update state
  const updateState = useCallback((updates: Partial<UseSmartQueueState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Initialize notifications
  const enableNotificationsFunc = useCallback(async (): Promise<boolean> => {
    if (!enableNotifications || typeof window === 'undefined') return false
    
    try {
      if ('Notification' in window) {
        let permission = Notification.permission
        
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }
        
        const enabled = permission === 'granted'
        notificationPermissionRef.current = enabled
        updateState({ notificationsEnabled: enabled })
        return enabled
      }
    } catch (error) {
      console.error('Error enabling notifications:', error)
    }
    
    return false
  }, [enableNotifications, updateState])

  // Queue Status Management
  const refreshQueueStatus = useCallback(async () => {
    try {
      updateState({ loading: true, error: null })
      
      const { queues, statistics } = await SmartQueueService.getQueueStatus()
      const systemStatus = await SmartQueueService.getSystemStatus()
      
      updateState({
        queues,
        statistics,
        systemStatus,
        lastUpdate: new Date(),
        loading: false,
        isOnline: true
      })
    } catch (error) {
      console.error('Error refreshing queue status:', error)
      updateState({
        error: 'Failed to refresh queue status',
        loading: false,
        isOnline: false
      })
    }
  }, [updateState])

  // Slot Management
  const refreshSlots = useCallback(async (date?: string) => {
    try {
      const slots = await SmartQueueService.getAvailableSlots(date)
      updateState({ availableSlots: slots })
    } catch (error) {
      console.error('Error refreshing slots:', error)
      updateState({ error: 'Failed to refresh available slots' })
    }
  }, [updateState])

  // User Tickets Management
  const refreshUserTickets = useCallback(async (targetUserId?: string) => {
    try {
      const tickets = await SmartQueueService.getUserTickets(targetUserId || userId)
      const activeTickets = tickets.filter(t => t.status === 'waiting' || t.status === 'ready')
      
      updateState({ userTickets: tickets, activeTickets })
      
      // Cache for offline access
      SmartQueueService.cacheUserTickets(targetUserId || userId, tickets)
    } catch (error) {
      console.error('Error refreshing user tickets:', error)
      
      // Fallback to cached tickets
      const cachedTickets = SmartQueueService.getCachedTickets(targetUserId || userId)
      const activeTickets = cachedTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
      updateState({ userTickets: cachedTickets, activeTickets })
    }
  }, [userId, updateState])

  // Queue Actions
  const joinQueue = useCallback(async (queueId: string, userData: { name: string; phoneNumber?: string; email?: string }) => {
    try {
      updateState({ loading: true })
      
      const result = await SmartQueueService.joinQueue(queueId, userData)
      
      if (result.success && result.ticket) {
        // Add new ticket to state
        const newTickets = [...state.userTickets, result.ticket]
        const newActiveTickets = newTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
        
        updateState({
          userTickets: newTickets,
          activeTickets: newActiveTickets,
          loading: false
        })
        
        // Cache updated tickets
        SmartQueueService.cacheUserTickets(userId, newTickets)
        
        // Show notification
        if (state.notificationsEnabled) {
          new Notification('Queue Joined Successfully!', {
            body: `You're now in the ${result.ticket.queueName} queue. Position: ${result.ticket.position}`,
            icon: '/favicon.ico'
          })
        }
      } else {
        updateState({ loading: false, error: result.message })
      }
      
      return result
    } catch (error) {
      console.error('Error joining queue:', error)
      updateState({ loading: false, error: 'Failed to join queue' })
      return { success: false, message: 'Failed to join queue' }
    }
  }, [state.userTickets, state.notificationsEnabled, userId, updateState])

  const leaveQueue = useCallback(async (ticketId: string) => {
    try {
      const result = await SmartQueueService.leaveQueue(ticketId)
      
      if (result.success) {
        // Remove ticket from state
        const updatedTickets = state.userTickets.filter(t => t.id !== ticketId)
        const updatedActiveTickets = updatedTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
        
        updateState({
          userTickets: updatedTickets,
          activeTickets: updatedActiveTickets
        })
        
        // Update cache
        SmartQueueService.cacheUserTickets(userId, updatedTickets)
      }
      
      return result
    } catch (error) {
      console.error('Error leaving queue:', error)
      return { success: false, message: 'Failed to leave queue' }
    }
  }, [state.userTickets, userId, updateState])

  // Slot Actions
  const bookSlot = useCallback(async (slotId: string, userData: { name: string; phoneNumber: string; email?: string }) => {
    try {
      updateState({ loading: true })
      
      const result = await SmartQueueService.bookSlot(slotId, userData)
      
      if (result.success && result.ticket) {
        // Add new ticket to state
        const newTickets = [...state.userTickets, result.ticket]
        const newActiveTickets = newTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
        
        updateState({
          userTickets: newTickets,
          activeTickets: newActiveTickets,
          loading: false
        })
        
        // Cache updated tickets
        SmartQueueService.cacheUserTickets(userId, newTickets)
        
        // Show notification
        if (state.notificationsEnabled) {
          new Notification('Slot Booked Successfully!', {
            body: `Your ${result.ticket.queueName} is confirmed for ${result.ticket.slotTime}`,
            icon: '/favicon.ico'
          })
        }
      } else {
        updateState({ loading: false, error: result.message })
      }
      
      return result
    } catch (error) {
      console.error('Error booking slot:', error)
      updateState({ loading: false, error: 'Failed to book slot' })
      return { success: false, message: 'Failed to book slot' }
    }
  }, [state.userTickets, state.notificationsEnabled, userId, updateState])

  const cancelSlotBooking = useCallback(async (ticketId: string) => {
    try {
      const result = await SmartQueueService.cancelSlotBooking(ticketId)
      
      if (result.success) {
        // Remove ticket from state
        const updatedTickets = state.userTickets.filter(t => t.id !== ticketId)
        const updatedActiveTickets = updatedTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
        
        updateState({
          userTickets: updatedTickets,
          activeTickets: updatedActiveTickets
        })
        
        // Update cache
        SmartQueueService.cacheUserTickets(userId, updatedTickets)
      }
      
      return result
    } catch (error) {
      console.error('Error cancelling slot:', error)
      return { success: false, message: 'Failed to cancel slot' }
    }
  }, [state.userTickets, userId, updateState])

  // Utility Actions
  const downloadTicket = useCallback((ticket: UserQueueTicket) => {
    try {
      const ticketData = `
SMART QUEUE DIGITAL PASS
========================
Pilgrim: ${ticket.userName}
Queue: ${ticket.queueName}
Ticket #: ${ticket.ticketNumber}
${ticket.type === 'slot' ? `Time Slot: ${ticket.slotTime}` : `Position: ${ticket.position}`}
Status: ${ticket.status.toUpperCase()}
QR Code: ${ticket.qrCode}
Generated: ${ticket.joinTime.toLocaleString()}

${ticket.type === 'queue' ? 
  `Estimated wait time: ${ticket.estimatedTime} minutes` :
  `Please arrive 15 minutes before your slot time`
}

This is your digital darshan pass. Please keep it safe
and present the QR code at the entrance for verification.

HeritEdge Smart Queue System
      `
      
      const blob = new Blob([ticketData], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smart-queue-pass-${ticket.ticketNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading ticket:', error)
    }
  }, [])

  const validateQRCode = useCallback(async (qrCode: string) => {
    try {
      return await SmartQueueService.validateQRCode(qrCode)
    } catch (error) {
      console.error('Error validating QR code:', error)
      return { valid: false, message: 'Validation service unavailable' }
    }
  }, [])

  const markTicketAsUsed = useCallback(async (ticketId: string) => {
    try {
      await SmartQueueService.markTicketUsed(ticketId)
      
      // Update ticket status in state
      const updatedTickets = state.userTickets.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: 'completed' as const }
          : ticket
      )
      const updatedActiveTickets = updatedTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
      
      updateState({
        userTickets: updatedTickets,
        activeTickets: updatedActiveTickets
      })
      
      // Update cache
      SmartQueueService.cacheUserTickets(userId, updatedTickets)
    } catch (error) {
      console.error('Error marking ticket as used:', error)
    }
  }, [state.userTickets, userId, updateState])

  const updateNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    try {
      await SmartQueueService.updateNotificationSettings(userId, settings)
      updateState({ notificationSettings: settings })
    } catch (error) {
      console.error('Error updating notification settings:', error)
    }
  }, [userId, updateState])

  const forceRefresh = useCallback(async () => {
    updateState({ refreshing: true })
    await Promise.all([
      refreshQueueStatus(),
      refreshUserTickets(),
      refreshSlots()
    ])
    updateState({ refreshing: false })
  }, [refreshQueueStatus, refreshUserTickets, refreshSlots, updateState])

  // Simulate queue position updates for active tickets
  const updateQueuePositions = useCallback(() => {
    updateState(prev => ({
      ...prev,
      userTickets: prev.userTickets.map(ticket => {
        if (ticket.status === 'waiting' && ticket.type === 'queue') {
          // Simulate queue movement
          const newPosition = Math.max(0, ticket.position - Math.floor(Math.random() * 3))
          const newEstimatedTime = newPosition * 3 // 3 minutes per person
          
          // Check if ready for darshan
          if (newPosition <= 2 && ticket.status === 'waiting') {
            if (prev.notificationsEnabled) {
              new Notification("Ready for Darshan!", {
                body: `Your turn for ${ticket.queueName} is ready. Please proceed to the gate.`,
                icon: "/favicon.ico"
              })
            }
            return { ...ticket, position: newPosition, estimatedTime: newEstimatedTime, status: 'ready' as const }
          }
          
          return { ...ticket, position: newPosition, estimatedTime: newEstimatedTime }
        }
        return ticket
      }),
      activeTickets: prev.userTickets.filter(t => t.status === 'waiting' || t.status === 'ready')
    }))
  }, [updateState])

  // Effects
  useEffect(() => {
    // Initial data load
    refreshQueueStatus()
    refreshUserTickets()
    refreshSlots()
    
    // Enable notifications if requested
    if (enableNotifications) {
      enableNotificationsFunc()
    }
  }, [refreshQueueStatus, refreshUserTickets, refreshSlots, enableNotificationsFunc])

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0 && !offlineMode) {
      intervalRef.current = setInterval(() => {
        refreshQueueStatus()
        refreshUserTickets()
        updateQueuePositions()
      }, autoRefreshInterval)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefreshInterval, offlineMode, refreshQueueStatus, refreshUserTickets, updateQueuePositions])

  // WebSocket connection
  useEffect(() => {
    if (enableWebSocket && !offlineMode) {
      SmartQueueService.initializeWebSocket()
      
      wsUnsubscribeRef.current = SmartQueueService.subscribeToUpdates((data) => {
        // Handle real-time updates
        switch (data.type) {
          case 'queue_update':
            refreshQueueStatus()
            break
          case 'ticket_update':
            refreshUserTickets()
            break
          case 'slot_update':
            refreshSlots()
            break
          case 'system_alert':
            updateState({ error: data.message })
            break
        }
      })
    }
    
    return () => {
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current()
      }
    }
  }, [enableWebSocket, offlineMode, refreshQueueStatus, refreshUserTickets, refreshSlots, updateState])

  // Online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleOnline = () => updateState({ isOnline: true })
    const handleOffline = () => updateState({ isOnline: false })
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [updateState])

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current()
      }
      SmartQueueService.cleanup()
    }
  }, [])

  return {
    // State
    ...state,
    
    // Actions
    refreshQueueStatus,
    joinQueue,
    leaveQueue,
    refreshSlots,
    bookSlot,
    cancelSlotBooking,
    refreshUserTickets,
    downloadTicket,
    validateQRCode,
    updateNotificationSettings,
    enableNotifications: enableNotificationsFunc,
    markTicketAsUsed,
    forceRefresh
  }
}

export default useSmartQueue
