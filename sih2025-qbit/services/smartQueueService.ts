/**
 * Smart Queue & Ticketing Service
 * Handles all queue management, slot booking, and digital pass functionalities
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Types
export interface QueueInfo {
  id: string;
  name: string;
  type: 'general' | 'priority' | 'special';
  currentServing: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  capacity: number;
  status: 'active' | 'paused' | 'closed';
  avgProcessingTime: number;
  lastUpdate: Date;
  pricePerEntry?: number;
  description?: string;
  requirements?: string[];
}

export interface DarshanSlot {
  id: string;
  time: string;
  date: string;
  capacity: number;
  booked: number;
  price: number;
  type: 'general' | 'priority' | 'special';
  duration: string;
  status: 'available' | 'full' | 'closed';
  specialRequirements?: string[];
}

export interface UserQueueTicket {
  id: string;
  queueId: string;
  queueName: string;
  ticketNumber: number;
  position: number;
  estimatedTime: number;
  status: 'waiting' | 'ready' | 'completed' | 'expired' | 'cancelled';
  joinTime: Date;
  qrCode: string;
  userId: string;
  userName: string;
  phoneNumber?: string;
  slotTime?: string;
  type: 'queue' | 'slot';
  notificationsSent?: number;
  lastNotification?: Date;
}

export interface QueueStatistics {
  totalVisitorsToday: number;
  averageWaitTime: number;
  peakHours: string;
  currentLoad: number;
  completedToday: number;
  cancelledToday: number;
  noShowRate: number;
  satisfactionScore?: number;
}

export interface NotificationSettings {
  sms: boolean;
  push: boolean;
  email: boolean;
  reminderTime: number; // minutes before slot/turn
  languages: string[];
}

export interface QueueSystemStatus {
  online: boolean;
  lastUpdate: Date;
  activeQueues: number;
  totalCapacity: number;
  systemLoad: number;
  maintenanceMode: boolean;
  emergencyMode: boolean;
}

// Mock Data Generators
export const generateMockQueueData = (): { queues: QueueInfo[]; statistics: QueueStatistics } => {
  const queues: QueueInfo[] = [
    {
      id: "general-darshan",
      name: "General Darshan",
      type: "general",
      currentServing: Math.floor(Math.random() * 200) + 100,
      totalInQueue: Math.floor(Math.random() * 100) + 50,
      estimatedWaitTime: Math.floor(Math.random() * 60) + 30,
      capacity: 200,
      status: "active",
      avgProcessingTime: 3,
      lastUpdate: new Date(),
      pricePerEntry: 0,
      description: "Standard darshan queue for all devotees",
      requirements: ["Valid ID", "Dress code compliance"]
    },
    {
      id: "priority-darshan",
      name: "Priority Darshan",
      type: "priority",
      currentServing: Math.floor(Math.random() * 50) + 20,
      totalInQueue: Math.floor(Math.random() * 20) + 5,
      estimatedWaitTime: Math.floor(Math.random() * 30) + 10,
      capacity: 50,
      status: "active",
      avgProcessingTime: 2,
      lastUpdate: new Date(),
      pricePerEntry: 100,
      description: "Fast-track darshan with reduced waiting time",
      requirements: ["Payment confirmation", "Valid ID"]
    },
    {
      id: "special-darshan",
      name: "Special Pooja",
      type: "special",
      currentServing: Math.floor(Math.random() * 20) + 5,
      totalInQueue: Math.floor(Math.random() * 10) + 2,
      estimatedWaitTime: Math.floor(Math.random() * 40) + 20,
      capacity: 30,
      status: "active",
      avgProcessingTime: 5,
      lastUpdate: new Date(),
      pricePerEntry: 250,
      description: "Exclusive special pooja ceremony",
      requirements: ["Advance booking", "Special attire", "Payment confirmation"]
    }
  ];

  const statistics: QueueStatistics = {
    totalVisitorsToday: Math.floor(Math.random() * 1000) + 2000,
    averageWaitTime: Math.floor(Math.random() * 20) + 25,
    peakHours: "10:00 AM - 12:00 PM",
    currentLoad: Math.floor(Math.random() * 40) + 50,
    completedToday: Math.floor(Math.random() * 500) + 1500,
    cancelledToday: Math.floor(Math.random() * 50) + 20,
    noShowRate: Math.floor(Math.random() * 5) + 3,
    satisfactionScore: Math.floor(Math.random() * 20) + 80
  };

  return { queues, statistics };
};

export const generateMockSlotData = (date?: string): DarshanSlot[] => {
  const baseDate = date || new Date().toISOString().split('T')[0];
  
  return [
    {
      id: "slot-09-00",
      time: "09:00 AM",
      date: baseDate,
      capacity: 50,
      booked: Math.floor(Math.random() * 20) + 5,
      price: 0,
      type: "general",
      duration: "30 min",
      status: "available"
    },
    {
      id: "slot-10-00",
      time: "10:00 AM",
      date: baseDate,
      capacity: 50,
      booked: Math.floor(Math.random() * 30) + 20,
      price: 0,
      type: "general",
      duration: "30 min",
      status: "available"
    },
    {
      id: "slot-11-00",
      time: "11:00 AM",
      date: baseDate,
      capacity: 50,
      booked: Math.floor(Math.random() * 15) + 40,
      price: 0,
      type: "general",
      duration: "30 min",
      status: "available"
    },
    {
      id: "slot-14-00",
      time: "02:00 PM",
      date: baseDate,
      capacity: 25,
      booked: Math.floor(Math.random() * 10) + 5,
      price: 100,
      type: "priority",
      duration: "20 min",
      status: "available",
      specialRequirements: ["Payment required"]
    },
    {
      id: "slot-16-00",
      time: "04:00 PM",
      date: baseDate,
      capacity: 15,
      booked: Math.floor(Math.random() * 5) + 2,
      price: 200,
      type: "special",
      duration: "15 min",
      status: "available",
      specialRequirements: ["Advance booking", "Special ceremony"]
    },
    {
      id: "slot-18-00",
      time: "06:00 PM",
      date: baseDate,
      capacity: 40,
      booked: Math.floor(Math.random() * 25) + 15,
      price: 50,
      type: "general",
      duration: "25 min",
      status: "available"
    }
  ].map(slot => ({
    ...slot,
    status: slot.booked >= slot.capacity ? 'full' as const : slot.status
  }));
};

/**
 * Smart Queue Service Class
 */
export class SmartQueueService {
  private static baseUrl = API_BASE_URL;
  private static websocket: WebSocket | null = null;
  private static listeners: Set<(data: any) => void> = new Set();

  // WebSocket Connection Management
  static initializeWebSocket(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws/smart-queue';
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Smart Queue WebSocket connected');
      };
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.listeners.forEach(listener => listener(data));
      };
      
      this.websocket.onclose = () => {
        console.log('Smart Queue WebSocket disconnected');
        setTimeout(() => this.initializeWebSocket(), 5000);
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  static subscribeToUpdates(callback: (data: any) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Queue Management
  static async getQueueStatus(): Promise<{ queues: QueueInfo[]; statistics: QueueStatistics }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/queue/status`);
      if (!response.ok) throw new Error('Failed to fetch queue status');
      return await response.json();
    } catch (error) {
      console.error('Error fetching queue status:', error);
      return generateMockQueueData();
    }
  }

  static async joinQueue(queueId: string, userData: {
    name: string;
    phoneNumber?: string;
    email?: string;
    specialRequests?: string;
  }): Promise<{
    success: boolean;
    ticket?: UserQueueTicket;
    message: string;
    estimatedWaitTime?: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, ...userData })
      });
      
      if (!response.ok) throw new Error('Failed to join queue');
      return await response.json();
    } catch (error) {
      console.error('Error joining queue:', error);
      
      // Mock successful response for MVP
      const queueData = generateMockQueueData();
      const queue = queueData.queues.find(q => q.id === queueId);
      
      if (!queue) {
        return { success: false, message: 'Queue not found' };
      }

      const mockTicket: UserQueueTicket = {
        id: `ticket-${Date.now()}`,
        queueId,
        queueName: queue.name,
        ticketNumber: queue.currentServing + queue.totalInQueue + 1,
        position: queue.totalInQueue + 1,
        estimatedTime: (queue.totalInQueue + 1) * queue.avgProcessingTime,
        status: 'waiting',
        joinTime: new Date(),
        qrCode: `QR-${Date.now()}-${queueId}`,
        userId: 'user-' + Date.now(),
        userName: userData.name,
        phoneNumber: userData.phoneNumber,
        type: 'queue'
      };

      return {
        success: true,
        ticket: mockTicket,
        message: 'Successfully joined the queue',
        estimatedWaitTime: mockTicket.estimatedTime
      };
    }
  }

  static async leaveQueue(ticketId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/queue/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      return await response.json();
    } catch (error) {
      console.error('Error leaving queue:', error);
      return { success: false, message: 'Failed to leave queue' };
    }
  }

  // Slot Booking
  static async getAvailableSlots(date?: string): Promise<DarshanSlot[]> {
    try {
      const params = date ? `?date=${date}` : '';
      const response = await fetch(`${this.baseUrl}/api/slots/available${params}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      return await response.json();
    } catch (error) {
      console.error('Error fetching slots:', error);
      return generateMockSlotData(date);
    }
  }

  static async bookSlot(slotId: string, userData: {
    name: string;
    phoneNumber: string;
    email?: string;
    specialRequests?: string;
  }): Promise<{
    success: boolean;
    ticket?: UserQueueTicket;
    message: string;
    paymentRequired?: boolean;
    paymentAmount?: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/slots/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, ...userData })
      });
      return await response.json();
    } catch (error) {
      console.error('Error booking slot:', error);
      
      // Mock response for MVP
      const slots = generateMockSlotData();
      const slot = slots.find(s => s.id === slotId);
      
      if (!slot) {
        return { success: false, message: 'Slot not found' };
      }

      if (slot.booked >= slot.capacity) {
        return { success: false, message: 'Slot is fully booked' };
      }

      const mockTicket: UserQueueTicket = {
        id: `slot-ticket-${Date.now()}`,
        queueId: slotId,
        queueName: `${slot.type.charAt(0).toUpperCase() + slot.type.slice(1)} Darshan Slot`,
        ticketNumber: slot.booked + 1,
        position: 0,
        estimatedTime: 0,
        status: 'waiting',
        joinTime: new Date(),
        qrCode: `QR-SLOT-${Date.now()}-${slotId}`,
        userId: 'user-' + Date.now(),
        userName: userData.name,
        phoneNumber: userData.phoneNumber,
        slotTime: slot.time,
        type: 'slot'
      };

      return {
        success: true,
        ticket: mockTicket,
        message: 'Slot booked successfully',
        paymentRequired: slot.price > 0,
        paymentAmount: slot.price
      };
    }
  }

  static async cancelSlotBooking(ticketId: string): Promise<{
    success: boolean;
    message: string;
    refundAmount?: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/slots/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      return await response.json();
    } catch (error) {
      console.error('Error cancelling slot:', error);
      return { success: false, message: 'Failed to cancel slot booking' };
    }
  }

  // Digital Pass Management
  static async getUserTickets(userId: string): Promise<UserQueueTicket[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tickets/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user tickets');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      
      // Return cached tickets from localStorage as fallback
      const cached = localStorage.getItem(`smartQueueTickets-${userId}`);
      return cached ? JSON.parse(cached) : [];
    }
  }

  static async validateQRCode(qrCode: string): Promise<{
    valid: boolean;
    ticket?: UserQueueTicket;
    message: string;
    allowEntry?: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tickets/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode })
      });
      return await response.json();
    } catch (error) {
      console.error('Error validating QR code:', error);
      return { valid: false, message: 'Validation service unavailable' };
    }
  }

  static async markTicketUsed(ticketId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tickets/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      return await response.json();
    } catch (error) {
      console.error('Error marking ticket as used:', error);
      return { success: false, message: 'Failed to process ticket' };
    }
  }

  // Notification Management
  static async updateNotificationSettings(userId: string, settings: NotificationSettings): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, settings })
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return { success: false, message: 'Failed to update settings' };
    }
  }

  static async sendNotification(ticketId: string, type: 'ready' | 'reminder' | 'update'): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, type })
      });
      return await response.json();
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, message: 'Notification service unavailable' };
    }
  }

  // System Status
  static async getSystemStatus(): Promise<QueueSystemStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/queue/system-status`);
      if (!response.ok) throw new Error('Failed to fetch system status');
      return await response.json();
    } catch (error) {
      console.error('Error fetching system status:', error);
      return {
        online: false,
        lastUpdate: new Date(),
        activeQueues: 3,
        totalCapacity: 280,
        systemLoad: 65,
        maintenanceMode: false,
        emergencyMode: false
      };
    }
  }

  // Analytics & Reporting
  static async getQueueAnalytics(dateRange?: { start: string; end: string }): Promise<{
    dailyStats: any[];
    hourlyDistribution: any[];
    queuePerformance: any[];
    userSatisfaction: any[];
  }> {
    try {
      const params = dateRange ? 
        `?start=${dateRange.start}&end=${dateRange.end}` : '';
      const response = await fetch(`${this.baseUrl}/api/queue/analytics${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        dailyStats: [],
        hourlyDistribution: [],
        queuePerformance: [],
        userSatisfaction: []
      };
    }
  }

  // Offline Support
  static cacheUserTickets(userId: string, tickets: UserQueueTicket[]): void {
    try {
      localStorage.setItem(`smartQueueTickets-${userId}`, JSON.stringify(tickets));
      localStorage.setItem(`smartQueueTickets-lastSync`, new Date().toISOString());
    } catch (error) {
      console.error('Error caching tickets:', error);
    }
  }

  static getCachedTickets(userId: string): UserQueueTicket[] {
    try {
      const cached = localStorage.getItem(`smartQueueTickets-${userId}`);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error retrieving cached tickets:', error);
      return [];
    }
  }

  static getLastSyncTime(): Date | null {
    try {
      const lastSync = localStorage.getItem(`smartQueueTickets-lastSync`);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  // Cleanup
  static cleanup(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.listeners.clear();
  }
}

// React Hook for Smart Queue Service
export function useSmartQueueService() {
  return {
    getQueueStatus: SmartQueueService.getQueueStatus,
    joinQueue: SmartQueueService.joinQueue,
    leaveQueue: SmartQueueService.leaveQueue,
    getAvailableSlots: SmartQueueService.getAvailableSlots,
    bookSlot: SmartQueueService.bookSlot,
    cancelSlotBooking: SmartQueueService.cancelSlotBooking,
    getUserTickets: SmartQueueService.getUserTickets,
    validateQRCode: SmartQueueService.validateQRCode,
    markTicketUsed: SmartQueueService.markTicketUsed,
    updateNotificationSettings: SmartQueueService.updateNotificationSettings,
    sendNotification: SmartQueueService.sendNotification,
    getSystemStatus: SmartQueueService.getSystemStatus,
    getQueueAnalytics: SmartQueueService.getQueueAnalytics,
    cacheUserTickets: SmartQueueService.cacheUserTickets,
    getCachedTickets: SmartQueueService.getCachedTickets,
    getLastSyncTime: SmartQueueService.getLastSyncTime,
    subscribeToUpdates: SmartQueueService.subscribeToUpdates,
    initializeWebSocket: SmartQueueService.initializeWebSocket,
    cleanup: SmartQueueService.cleanup,
    // Mock data generators for testing
    generateMockQueueData,
    generateMockSlotData
  };
}

export default SmartQueueService;
