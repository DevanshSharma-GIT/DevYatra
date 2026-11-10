/**
 * Pilgrim Engagement Service
 * Handles all data operations for the Pilgrim Engagement Platform
 * Uses mock data for MVP, designed to be easily replaced with real API calls
 */

export interface TempleInfo {
  currentWaitTime: string;
  nextPuja: string;
  isOpen: boolean;
  crowdLevel: 'Low' | 'Moderate' | 'High';
  emergencyContact: string;
  helpdeskLocation: string;
  lastUpdated: string;
}

export interface TempleSchedule {
  time: string;
  event: string;
  type: 'opening' | 'closing' | 'puja' | 'ceremony';
  description?: string;
}

export interface CrowdDensityData {
  area: string;
  density: 'Low' | 'Medium' | 'High';
  lastUpdated: string;
  estimatedWaitTime?: string;
}

export interface SafetyAlert {
  id: string;
  type: 'emergency' | 'crowd' | 'weather' | 'general';
  message: string;
  timestamp: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface GamificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  points: number;
  category: 'queue' | 'eco' | 'community' | 'exploration' | 'safety';
}

export interface UserProgress {
  userId: string;
  totalPoints: number;
  currentLevel: string;
  levelProgress: number;
  badges: GamificationBadge[];
  achievements: string[];
  lastActivity: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  group: string;
  points: number;
  rank: number;
  avatar?: string;
}

export interface NavigationPoint {
  id: string;
  name: string;
  type: 'shrine' | 'queue' | 'restroom' | 'helpdesk' | 'exit' | 'parking';
  coordinates: { lat: number; lng: number };
  description: string;
  accessibility: boolean;
  estimatedTime?: string;
}

class PilgrimEngagementService {
  private static instance: PilgrimEngagementService;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PilgrimEngagementService {
    if (!PilgrimEngagementService.instance) {
      PilgrimEngagementService.instance = new PilgrimEngagementService();
    }
    return PilgrimEngagementService.instance;
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get real-time temple information
   */
  async getTempleInfo(): Promise<TempleInfo> {
    const cacheKey = 'temple-info';
    const cached = this.getCachedData<TempleInfo>(cacheKey);
    if (cached) return cached;

    // Mock API call - replace with real API
    const mockData: TempleInfo = {
      currentWaitTime: "45 minutes",
      nextPuja: "Evening Aarti - 6:30 PM",
      isOpen: true,
      crowdLevel: "Moderate",
      emergencyContact: "+91-9876543210",
      helpdeskLocation: "Main Entrance, Gate 1",
      lastUpdated: new Date().toISOString()
    };

    this.setCachedData(cacheKey, mockData);
    return mockData;
  }

  /**
   * Get daily temple schedule
   */
  async getTempleSchedule(date?: string): Promise<TempleSchedule[]> {
    const cacheKey = `temple-schedule-${date || 'today'}`;
    const cached = this.getCachedData<TempleSchedule[]>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockSchedule: TempleSchedule[] = [
      { time: "5:00 AM", event: "Morning Darshan Opens", type: "opening" },
      { time: "6:00 AM", event: "Suprabhatam", type: "puja", description: "Morning prayers" },
      { time: "8:00 AM", event: "Morning Aarti", type: "puja", description: "Sacred fire ceremony" },
      { time: "12:00 PM", event: "Midday Puja", type: "puja", description: "Noon prayers" },
      { time: "6:30 PM", event: "Evening Aarti", type: "puja", description: "Evening ceremony" },
      { time: "9:00 PM", event: "Darshan Closes", type: "closing" }
    ];

    this.setCachedData(cacheKey, mockSchedule);
    return mockSchedule;
  }

  /**
   * Get crowd density data
   */
  async getCrowdDensityData(): Promise<CrowdDensityData[]> {
    const cacheKey = 'crowd-density';
    const cached = this.getCachedData<CrowdDensityData[]>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockData: CrowdDensityData[] = [
      { area: "Main Shrine", density: "Medium", lastUpdated: new Date().toISOString(), estimatedWaitTime: "30 min" },
      { area: "Queue Area", density: "High", lastUpdated: new Date().toISOString(), estimatedWaitTime: "45 min" },
      { area: "Rest Area", density: "Low", lastUpdated: new Date().toISOString() },
      { area: "Parking", density: "Medium", lastUpdated: new Date().toISOString() },
      { area: "Food Court", density: "Low", lastUpdated: new Date().toISOString() }
    ];

    this.setCachedData(cacheKey, mockData);
    return mockData;
  }

  /**
   * Send safety alert
   */
  async sendSafetyAlert(alert: Omit<SafetyAlert, 'id' | 'timestamp'>): Promise<SafetyAlert> {
    // Mock API call - replace with real API
    const newAlert: SafetyAlert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...alert
    };

    // In a real implementation, this would send to backend
    console.log('Safety alert sent:', newAlert);
    
    return newAlert;
  }

  /**
   * Get user gamification progress
   */
  async getUserProgress(userId: string): Promise<UserProgress> {
    const cacheKey = `user-progress-${userId}`;
    const cached = this.getCachedData<UserProgress>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockProgress: UserProgress = {
      userId,
      totalPoints: 1250,
      currentLevel: "Devoted Pilgrim",
      levelProgress: 75,
      badges: [
        { id: "queue-champion", name: "Queue Champion", description: "Waited patiently for 3+ hours", icon: "⏰", earned: true, earnedDate: "2024-01-15", points: 100, category: "queue" },
        { id: "eco-warrior", name: "Eco Warrior", description: "Used eco-friendly practices 5 times", icon: "🌱", earned: true, earnedDate: "2024-01-20", points: 150, category: "eco" },
        { id: "temple-explorer", name: "Temple Explorer", description: "Visited all major areas", icon: "🗺️", earned: false, points: 200, category: "exploration" },
        { id: "community-helper", name: "Community Helper", description: "Helped 3+ fellow pilgrims", icon: "🤝", earned: false, points: 300, category: "community" }
      ],
      achievements: ["First Visit", "Queue Patience", "Eco-Friendly"],
      lastActivity: new Date().toISOString()
    };

    this.setCachedData(cacheKey, mockProgress);
    return mockProgress;
  }

  /**
   * Get community leaderboard
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const cacheKey = 'leaderboard';
    const cached = this.getCachedData<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockLeaderboard: LeaderboardEntry[] = [
      { userId: "user1", name: "Priya Sharma", group: "Mumbai Group", points: 2100, rank: 1 },
      { userId: "user2", name: "Rajesh Kumar", group: "Delhi Group", points: 1950, rank: 2 },
      { userId: "user3", name: "Anita Patel", group: "Gujarat Group", points: 1800, rank: 3 },
      { userId: "user4", name: "Suresh Singh", group: "Punjab Group", points: 1650, rank: 4 },
      { userId: "user5", name: "Meera Reddy", group: "Andhra Group", points: 1500, rank: 5 }
    ];

    this.setCachedData(cacheKey, mockLeaderboard);
    return mockLeaderboard;
  }

  /**
   * Get navigation points
   */
  async getNavigationPoints(): Promise<NavigationPoint[]> {
    const cacheKey = 'navigation-points';
    const cached = this.getCachedData<NavigationPoint[]>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockPoints: NavigationPoint[] = [
      { id: "main-shrine", name: "Main Shrine", type: "shrine", coordinates: { lat: 12.9716, lng: 77.5946 }, description: "Primary deity shrine", accessibility: true, estimatedTime: "5 min" },
      { id: "queue-area", name: "Queue Area", type: "queue", coordinates: { lat: 12.9718, lng: 77.5948 }, description: "Main darshan queue", accessibility: true, estimatedTime: "2 min" },
      { id: "restroom-1", name: "Restroom Block A", type: "restroom", coordinates: { lat: 12.9714, lng: 77.5944 }, description: "Clean restroom facilities", accessibility: true },
      { id: "helpdesk", name: "Information Desk", type: "helpdesk", coordinates: { lat: 12.9712, lng: 77.5942 }, description: "24/7 help and information", accessibility: true },
      { id: "parking", name: "Main Parking", type: "parking", coordinates: { lat: 12.9710, lng: 77.5940 }, description: "Vehicle parking area", accessibility: true }
    ];

    this.setCachedData(cacheKey, mockPoints);
    return mockPoints;
  }

  /**
   * Award points to user
   */
  async awardPoints(userId: string, points: number, reason: string): Promise<{ success: boolean; newTotal: number }> {
    // Mock API call - replace with real API
    console.log(`Awarding ${points} points to ${userId} for: ${reason}`);
    
    // In a real implementation, this would update the backend
    return {
      success: true,
      newTotal: 1250 + points // Mock new total
    };
  }

  /**
   * Check for new safety alerts
   */
  async getActiveAlerts(): Promise<SafetyAlert[]> {
    const cacheKey = 'active-alerts';
    const cached = this.getCachedData<SafetyAlert[]>(cacheKey);
    if (cached) return cached;

    // Mock data - replace with real API
    const mockAlerts: SafetyAlert[] = [
      {
        id: "alert-1",
        type: "weather",
        message: "Heavy rain expected in the next hour. Please use covered areas.",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        severity: "medium"
      }
    ];

    this.setCachedData(cacheKey, mockAlerts);
    return mockAlerts;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get offline data (for offline-first capability)
   */
  async getOfflineData(): Promise<{
    templeInfo: TempleInfo;
    schedule: TempleSchedule[];
    navigationPoints: NavigationPoint[];
  }> {
    // Return cached data or fallback to static data
    const templeInfo = this.getCachedData<TempleInfo>('temple-info') || {
      currentWaitTime: "Check when online",
      nextPuja: "Schedule unavailable offline",
      isOpen: true,
      crowdLevel: "Unknown",
      emergencyContact: "+91-9876543210",
      helpdeskLocation: "Main Entrance, Gate 1",
      lastUpdated: new Date().toISOString()
    };

    const schedule = this.getCachedData<TempleSchedule[]>('temple-schedule-today') || [
      { time: "5:00 AM", event: "Morning Darshan Opens", type: "opening" },
      { time: "9:00 PM", event: "Darshan Closes", type: "closing" }
    ];

    const navigationPoints = this.getCachedData<NavigationPoint[]>('navigation-points') || [
      { id: "main-shrine", name: "Main Shrine", type: "shrine", coordinates: { lat: 12.9716, lng: 77.5946 }, description: "Primary deity shrine", accessibility: true },
      { id: "helpdesk", name: "Information Desk", type: "helpdesk", coordinates: { lat: 12.9712, lng: 77.5942 }, description: "24/7 help and information", accessibility: true }
    ];

    return { templeInfo, schedule, navigationPoints };
  }
}

export default PilgrimEngagementService;
