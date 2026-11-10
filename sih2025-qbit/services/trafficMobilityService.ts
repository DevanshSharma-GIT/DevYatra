/**
 * Traffic & Mobility Management Service
 * Handles all traffic, parking, and shuttle-related API communications
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Types
export interface ParkingZone {
  id: string;
  name: string;
  available: number;
  total: number;
  status: 'available' | 'limited' | 'full';
  estimatedWalk: string;
  pricePerHour: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  amenities?: string[];
  lastUpdated?: Date;
}

export interface ParkingData {
  zones: ParkingZone[];
  totalAvailable: number;
  totalCapacity: number;
  lastUpdated: Date;
  recommendations?: {
    zoneId: string;
    reason: string;
    savings?: number;
  }[];
}

export interface Shuttle {
  id: string;
  currentLocation: string;
  nextStop: string;
  eta: number;
  capacity: number;
  occupancy: number;
  status: 'active' | 'maintenance' | 'offline';
  route: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface ShuttleRoute {
  id: string;
  name: string;
  shuttles: Shuttle[];
  schedule: {
    time: string;
    frequency: string;
  }[];
  stops: {
    id: string;
    name: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    estimatedArrival?: number;
  }[];
}

export interface ShuttleData {
  routes: ShuttleRoute[];
  announcements: {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'emergency';
    timestamp: Date;
    route?: string;
    priority?: 'low' | 'medium' | 'high';
  }[];
  globalStatus: {
    totalActiveShuttles: number;
    operationalRoutes: number;
    averageWaitTime: number;
  };
}

export interface TrafficAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'closure' | 'congestion' | 'accident' | 'weather' | 'event';
  duration: string;
  affectedRoutes: string[];
  timestamp: Date;
  coordinates: {
    lat: number;
    lng: number;
  };
  alternativeRoutes?: string[];
}

export interface RouteDiversion {
  id: string;
  title: string;
  originalRoute: string;
  alternativeRoute: string;
  additionalTime: string;
  reason: string;
  savings?: {
    time?: string;
    fuel?: string;
  };
  coordinates?: {
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
  };
}

export interface RoadCondition {
  status: 'normal' | 'heavy' | 'slow' | 'closed';
  reason?: string;
  duration?: string;
  trafficDensity?: number;
  averageSpeed?: number;
}

export interface TrafficData {
  alerts: TrafficAlert[];
  diversions: RouteDiversion[];
  roadConditions: Record<string, RoadCondition>;
  emergencyContacts: {
    name: string;
    number: string;
    type: 'police' | 'traffic' | 'emergency' | 'helpdesk';
  }[];
  coordinationStatus: {
    policeActive: boolean;
    trafficCenterOnline: boolean;
    emergencyServicesAvailable: boolean;
    lastCoordinationUpdate: Date;
  };
}

export interface SystemStatus {
  parking: {
    online: boolean;
    lastUpdate: Date;
    dataFreshness: 'real-time' | 'cached' | 'offline';
  };
  shuttles: {
    tracking: boolean;
    gpsAccuracy: number;
    lastUpdate: Date;
  };
  traffic: {
    monitoring: boolean;
    alertsActive: boolean;
    lastUpdate: Date;
  };
  connectivity: {
    websocket: boolean;
    api: boolean;
    offline: boolean;
  };
}

// Mock Data Generator Functions
export const generateMockParkingData = (): ParkingData => {
  const zones: ParkingZone[] = [
    {
      id: "zone-a",
      name: "Zone A - Main Entrance",
      available: Math.floor(Math.random() * 50) + 30,
      total: 200,
      status: "available",
      estimatedWalk: "2 min",
      pricePerHour: 50,
      coordinates: { lat: 28.6139, lng: 77.2090 },
      amenities: ["CCTV", "Security", "Lighting"],
      lastUpdated: new Date()
    },
    {
      id: "zone-b",
      name: "Zone B - East Gate",
      available: Math.floor(Math.random() * 20) + 5,
      total: 150,
      status: "limited",
      estimatedWalk: "5 min",
      pricePerHour: 30,
      coordinates: { lat: 28.6149, lng: 77.2100 },
      amenities: ["CCTV", "Restrooms"],
      lastUpdated: new Date()
    },
    {
      id: "zone-c",
      name: "Zone C - West Side",
      available: Math.floor(Math.random() * 10),
      total: 100,
      status: "full",
      estimatedWalk: "8 min",
      pricePerHour: 25,
      coordinates: { lat: 28.6129, lng: 77.2080 },
      amenities: ["Basic"],
      lastUpdated: new Date()
    },
    {
      id: "zone-d",
      name: "Zone D - VIP Area",
      available: Math.floor(Math.random() * 30) + 15,
      total: 50,
      status: "available",
      estimatedWalk: "1 min",
      pricePerHour: 100,
      coordinates: { lat: 28.6144, lng: 77.2095 },
      amenities: ["Valet", "Premium Security", "Covered"],
      lastUpdated: new Date()
    }
  ];

  // Update status based on availability
  zones.forEach(zone => {
    const occupancyRate = (zone.total - zone.available) / zone.total;
    if (occupancyRate >= 0.95) zone.status = 'full';
    else if (occupancyRate >= 0.75) zone.status = 'limited';
    else zone.status = 'available';
  });

  const totalAvailable = zones.reduce((sum, zone) => sum + zone.available, 0);
  const totalCapacity = zones.reduce((sum, zone) => sum + zone.total, 0);

  return {
    zones,
    totalAvailable,
    totalCapacity,
    lastUpdated: new Date(),
    recommendations: [
      {
        zoneId: zones.find(z => z.status === 'available')?.id || zones[0].id,
        reason: "Best availability and walking distance",
        savings: 15
      }
    ]
  };
};

export const generateMockShuttleData = (): ShuttleData => {
  const routes: ShuttleRoute[] = [
    {
      id: "route-1",
      name: "Main Circuit",
      shuttles: [
        {
          id: "shuttle-1",
          currentLocation: "Main Entrance",
          nextStop: "Zone B Parking",
          eta: Math.floor(Math.random() * 5) + 2,
          capacity: 45,
          occupancy: Math.floor(Math.random() * 35) + 10,
          status: "active",
          route: "route-1",
          coordinates: { lat: 28.6139, lng: 77.2090 }
        },
        {
          id: "shuttle-2",
          currentLocation: "Zone C Parking",
          nextStop: "Temple Complex",
          eta: Math.floor(Math.random() * 8) + 5,
          capacity: 45,
          occupancy: Math.floor(Math.random() * 25) + 5,
          status: "active",
          route: "route-1",
          coordinates: { lat: 28.6129, lng: 77.2080 }
        }
      ],
      schedule: [
        { time: "06:00", frequency: "Every 5 mins" },
        { time: "12:00", frequency: "Every 3 mins" },
        { time: "18:00", frequency: "Every 5 mins" },
        { time: "22:00", frequency: "Every 10 mins" }
      ],
      stops: [
        { id: "stop-1", name: "Main Entrance", coordinates: { lat: 28.6139, lng: 77.2090 } },
        { id: "stop-2", name: "Zone B Parking", coordinates: { lat: 28.6149, lng: 77.2100 } },
        { id: "stop-3", name: "Temple Complex", coordinates: { lat: 28.6155, lng: 77.2105 } }
      ]
    },
    {
      id: "route-2",
      name: "Express Service",
      shuttles: [
        {
          id: "shuttle-3",
          currentLocation: "Railway Station",
          nextStop: "Temple Main Gate",
          eta: Math.floor(Math.random() * 15) + 8,
          capacity: 60,
          occupancy: Math.floor(Math.random() * 50) + 20,
          status: "active",
          route: "route-2",
          coordinates: { lat: 28.6100, lng: 77.2050 }
        }
      ],
      schedule: [
        { time: "06:00", frequency: "Every 15 mins" },
        { time: "09:00", frequency: "Every 10 mins" },
        { time: "15:00", frequency: "Every 15 mins" },
        { time: "20:00", frequency: "Every 20 mins" }
      ],
      stops: [
        { id: "stop-4", name: "Railway Station", coordinates: { lat: 28.6100, lng: 77.2050 } },
        { id: "stop-5", name: "Bus Terminal", coordinates: { lat: 28.6120, lng: 77.2070 } },
        { id: "stop-6", name: "Temple Main Gate", coordinates: { lat: 28.6139, lng: 77.2090 } }
      ]
    }
  ];

  const announcements = [
    {
      id: "ann-1",
      message: "Express shuttle service temporarily suspended due to road maintenance",
      type: "warning" as const,
      timestamp: new Date(),
      route: "route-2",
      priority: "high" as const
    },
    {
      id: "ann-2",
      message: "Additional shuttles deployed for festival rush hours",
      type: "info" as const,
      timestamp: new Date(),
      priority: "medium" as const
    }
  ];

  const totalActiveShuttles = routes.reduce((sum, route) => 
    sum + route.shuttles.filter(s => s.status === 'active').length, 0
  );

  return {
    routes,
    announcements,
    globalStatus: {
      totalActiveShuttles,
      operationalRoutes: routes.length,
      averageWaitTime: Math.floor(Math.random() * 8) + 5
    }
  };
};

export const generateMockTrafficData = (): TrafficData => {
  const alerts: TrafficAlert[] = [
    {
      id: "alert-1",
      title: "Road Closure - NH-1",
      description: "Due to VIP movement, NH-1 will be closed from 2:00 PM to 4:00 PM",
      severity: "high",
      type: "closure",
      duration: "2 hours",
      affectedRoutes: ["Main Highway", "Express Route"],
      timestamp: new Date(),
      coordinates: { lat: 28.6150, lng: 77.2050 },
      alternativeRoutes: ["Ring Road", "Inner City Route"]
    },
    {
      id: "alert-2",
      title: "Heavy Traffic - City Center",
      description: "Unusual congestion reported near city center due to festival preparations",
      severity: "medium",
      type: "congestion",
      duration: "Ongoing",
      affectedRoutes: ["Inner Ring Road"],
      timestamp: new Date(),
      coordinates: { lat: 28.6120, lng: 77.2070 }
    }
  ];

  const diversions: RouteDiversion[] = [
    {
      id: "div-1",
      title: "Diversion via Ring Road",
      originalRoute: "NH-1 → Temple Complex",
      alternativeRoute: "Ring Road → East Gate → Temple Complex",
      additionalTime: "15 minutes",
      reason: "Road closure for VIP movement",
      savings: { fuel: "5%" },
      coordinates: {
        start: { lat: 28.6100, lng: 77.2000 },
        end: { lat: 28.6155, lng: 77.2105 }
      }
    }
  ];

  const roadConditions: Record<string, RoadCondition> = {
    "NH-1": { 
      status: "closed", 
      reason: "VIP movement", 
      duration: "2 hours",
      trafficDensity: 0,
      averageSpeed: 0
    },
    "Ring Road": { 
      status: "heavy", 
      reason: "Festival traffic", 
      duration: "Ongoing",
      trafficDensity: 85,
      averageSpeed: 15
    },
    "East Gate Road": { 
      status: "normal", 
      trafficDensity: 35,
      averageSpeed: 45
    },
    "West Side Road": { 
      status: "normal",
      trafficDensity: 25,
      averageSpeed: 50
    }
  };

  return {
    alerts,
    diversions,
    roadConditions,
    emergencyContacts: [
      { name: "Traffic Control Center", number: "+91-98765-43210", type: "traffic" },
      { name: "Police Headquarters", number: "+91-98765-43211", type: "police" },
      { name: "Emergency Services", number: "112", type: "emergency" },
      { name: "Mobility Helpdesk", number: "+91-98765-43212", type: "helpdesk" }
    ],
    coordinationStatus: {
      policeActive: true,
      trafficCenterOnline: true,
      emergencyServicesAvailable: true,
      lastCoordinationUpdate: new Date()
    }
  };
};

/**
 * Main Traffic & Mobility Service Class
 */
export class TrafficMobilityService {
  private static baseUrl = API_BASE_URL;
  private static websocket: WebSocket | null = null;
  private static listeners: Set<(data: any) => void> = new Set();

  // WebSocket Connection Management
  static initializeWebSocket(): void {
    if (typeof window === 'undefined') return; // Skip on server
    
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws/traffic-mobility';
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Traffic & Mobility WebSocket connected');
      };
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.listeners.forEach(listener => listener(data));
      };
      
      this.websocket.onclose = () => {
        console.log('Traffic & Mobility WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
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

  // Parking Services
  static async getParkingData(): Promise<ParkingData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/parking/status`);
      if (!response.ok) throw new Error('Failed to fetch parking data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching parking data:', error);
      // Return mock data as fallback
      return generateMockParkingData();
    }
  }

  static async reserveParkingSpot(zoneId: string, duration: number): Promise<{
    success: boolean;
    reservationId?: string;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/parking/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, duration })
      });
      return await response.json();
    } catch (error) {
      console.error('Error reserving parking spot:', error);
      return { 
        success: false, 
        message: 'Reservation service temporarily unavailable. Using mock confirmation.' 
      };
    }
  }

  // Shuttle Services
  static async getShuttleData(): Promise<ShuttleData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/shuttles/status`);
      if (!response.ok) throw new Error('Failed to fetch shuttle data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching shuttle data:', error);
      // Return mock data as fallback
      return generateMockShuttleData();
    }
  }

  static async trackShuttle(shuttleId: string): Promise<{
    shuttle: Shuttle;
    route: { coordinates: { lat: number; lng: number }[] };
    estimatedStops: { stop: string; eta: number }[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/shuttles/${shuttleId}/track`);
      if (!response.ok) throw new Error('Failed to track shuttle');
      return await response.json();
    } catch (error) {
      console.error('Error tracking shuttle:', error);
      // Return mock tracking data
      const mockData = generateMockShuttleData();
      const shuttle = mockData.routes
        .flatMap(r => r.shuttles)
        .find(s => s.id === shuttleId) || mockData.routes[0].shuttles[0];
      
      return {
        shuttle,
        route: {
          coordinates: [
            { lat: 28.6139, lng: 77.2090 },
            { lat: 28.6149, lng: 77.2100 },
            { lat: 28.6155, lng: 77.2105 }
          ]
        },
        estimatedStops: [
          { stop: "Next Stop", eta: shuttle.eta },
          { stop: "Final Stop", eta: shuttle.eta + 8 }
        ]
      };
    }
  }

  // Traffic Services
  static async getTrafficData(): Promise<TrafficData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/traffic/status`);
      if (!response.ok) throw new Error('Failed to fetch traffic data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching traffic data:', error);
      // Return mock data as fallback
      return generateMockTrafficData();
    }
  }

  static async reportTrafficIncident(incident: {
    type: string;
    location: { lat: number; lng: number };
    description: string;
    severity: string;
  }): Promise<{ success: boolean; incidentId?: string; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/traffic/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident)
      });
      return await response.json();
    } catch (error) {
      console.error('Error reporting traffic incident:', error);
      return { 
        success: false, 
        message: 'Incident reporting service temporarily unavailable.' 
      };
    }
  }

  // System Status
  static async getSystemStatus(): Promise<SystemStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/traffic-mobility/status`);
      if (!response.ok) throw new Error('Failed to fetch system status');
      return await response.json();
    } catch (error) {
      console.error('Error fetching system status:', error);
      // Return mock status
      return {
        parking: {
          online: true,
          lastUpdate: new Date(),
          dataFreshness: 'cached'
        },
        shuttles: {
          tracking: true,
          gpsAccuracy: 95,
          lastUpdate: new Date()
        },
        traffic: {
          monitoring: true,
          alertsActive: true,
          lastUpdate: new Date()
        },
        connectivity: {
          websocket: false,
          api: true,
          offline: false
        }
      };
    }
  }

  // Authority Coordination
  static async contactAuthority(type: 'police' | 'traffic' | 'emergency', message?: string): Promise<{
    success: boolean;
    contactId?: string;
    estimatedResponse?: string;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/authority/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message })
      });
      return await response.json();
    } catch (error) {
      console.error('Error contacting authority:', error);
      return { 
        success: false, 
        message: 'Authority coordination service temporarily unavailable. Please use emergency numbers directly.' 
      };
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

// React hook for using the Traffic & Mobility service
export function useTrafficMobilityService() {
  return {
    getParkingData: TrafficMobilityService.getParkingData,
    reserveParkingSpot: TrafficMobilityService.reserveParkingSpot,
    getShuttleData: TrafficMobilityService.getShuttleData,
    trackShuttle: TrafficMobilityService.trackShuttle,
    getTrafficData: TrafficMobilityService.getTrafficData,
    reportTrafficIncident: TrafficMobilityService.reportTrafficIncident,
    getSystemStatus: TrafficMobilityService.getSystemStatus,
    contactAuthority: TrafficMobilityService.contactAuthority,
    subscribeToUpdates: TrafficMobilityService.subscribeToUpdates,
    initializeWebSocket: TrafficMobilityService.initializeWebSocket,
    cleanup: TrafficMobilityService.cleanup,
    // Mock data generators for testing
    generateMockParkingData,
    generateMockShuttleData,
    generateMockTrafficData
  };
}

export default TrafficMobilityService;
