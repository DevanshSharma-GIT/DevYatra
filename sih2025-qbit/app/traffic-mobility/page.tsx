"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Car,
  MapPin,
  Bus,
  Navigation,
  Clock,
  Users,
  AlertTriangle,
  Shield,
  Zap,
  Globe,
  Wifi,
  RefreshCw,
  Timer,
  Route,
  ParkingCircle,
  Truck,
  Phone,
  Radio,
  Activity,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { getCookie } from "cookies-next"

// Mock data for MVP
const mockParkingData = {
  zones: [
    { 
      id: "zone-a", 
      name: "Zone A - Main Entrance", 
      available: 45, 
      total: 200, 
      status: "available", 
      estimatedWalk: "2 min",
      pricePerHour: 50,
      coordinates: { lat: 28.6139, lng: 77.2090 }
    },
    { 
      id: "zone-b", 
      name: "Zone B - East Gate", 
      available: 12, 
      total: 150, 
      status: "limited", 
      estimatedWalk: "5 min",
      pricePerHour: 30,
      coordinates: { lat: 28.6149, lng: 77.2100 }
    },
    { 
      id: "zone-c", 
      name: "Zone C - West Side", 
      available: 0, 
      total: 100, 
      status: "full", 
      estimatedWalk: "8 min",
      pricePerHour: 25,
      coordinates: { lat: 28.6129, lng: 77.2080 }
    },
    { 
      id: "zone-d", 
      name: "Zone D - VIP Area", 
      available: 25, 
      total: 50, 
      status: "available", 
      estimatedWalk: "1 min",
      pricePerHour: 100,
      coordinates: { lat: 28.6144, lng: 77.2095 }
    },
  ],
  lastUpdated: new Date(),
  totalAvailable: 82,
  totalCapacity: 500
}

const mockShuttleData = {
  routes: [
    {
      id: "route-1",
      name: "Main Circuit",
      shuttles: [
        { 
          id: "shuttle-1", 
          currentLocation: "Main Entrance", 
          nextStop: "Zone B Parking", 
          eta: 3, 
          capacity: 45, 
          occupancy: 32,
          status: "active"
        },
        { 
          id: "shuttle-2", 
          currentLocation: "Zone C Parking", 
          nextStop: "Temple Complex", 
          eta: 7, 
          capacity: 45, 
          occupancy: 18,
          status: "active"
        }
      ],
      schedule: [
        { time: "06:00", frequency: "Every 5 mins" },
        { time: "12:00", frequency: "Every 3 mins" },
        { time: "18:00", frequency: "Every 5 mins" },
        { time: "22:00", frequency: "Every 10 mins" }
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
          eta: 12, 
          capacity: 60, 
          occupancy: 45,
          status: "active"
        }
      ],
      schedule: [
        { time: "06:00", frequency: "Every 15 mins" },
        { time: "09:00", frequency: "Every 10 mins" },
        { time: "15:00", frequency: "Every 15 mins" },
        { time: "20:00", frequency: "Every 20 mins" }
      ]
    }
  ],
  announcements: [
    {
      id: "ann-1",
      message: "Express shuttle service temporarily suspended due to road maintenance",
      type: "warning",
      timestamp: new Date(),
      route: "route-2"
    }
  ]
}

const mockTrafficData = {
  alerts: [
    {
      id: "alert-1",
      title: "Road Closure - NH-1",
      description: "Due to VIP movement, NH-1 will be closed from 2:00 PM to 4:00 PM",
      severity: "high",
      type: "closure",
      duration: "2 hours",
      affectedRoutes: ["Main Highway", "Express Route"],
      timestamp: new Date(),
      coordinates: { lat: 28.6150, lng: 77.2050 }
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
  ],
  diversions: [
    {
      id: "div-1",
      title: "Diversion via Ring Road",
      originalRoute: "NH-1 → Temple Complex",
      alternativeRoute: "Ring Road → East Gate → Temple Complex",
      additionalTime: "15 minutes",
      reason: "Road closure for VIP movement"
    }
  ],
  roadConditions: {
    "NH-1": { status: "closed", reason: "VIP movement", duration: "2 hours" },
    "Ring Road": { status: "heavy", reason: "Festival traffic", duration: "Ongoing" },
    "East Gate Road": { status: "normal", reason: null, duration: null },
    "West Side Road": { status: "normal", reason: null, duration: null }
  }
}

export default function TrafficMobilityPage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("parking")
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [selectedParkingZone, setSelectedParkingZone] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // Get user profile from cookies/localStorage
    const preferencesFromCookie = getCookie("travelPreferences")
    if (preferencesFromCookie) {
      try {
        const preferences = JSON.parse(preferencesFromCookie as string)
        setUserProfile(preferences)
      } catch (e) {
        console.error("Error parsing preferences:", e)
      }
    }

    // Simulate real-time updates
    const updateInterval = setInterval(() => {
      setLastUpdate(new Date())
    }, 30000) // Update every 30 seconds

    // Check online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(updateInterval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 border-green-200"
      case "limited": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "full": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-100 text-red-800 border-red-200"
      case "medium": return "bg-orange-100 text-orange-800 border-orange-200"
      case "low": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-700" />
            <Link href="/" className="font-semibold text-blue-900">
              HeritEdge
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-800 hover:text-blue-600 text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/safety" className="text-blue-800 hover:text-blue-600 text-sm font-medium">
              Safety
            </Link>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-xs">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-xs">Offline</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto"
        >
          {/* Page Header */}
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">
              Traffic & Mobility Management
            </Badge>
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Smart <span className="text-blue-700">Transportation</span> Hub
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Real-time parking guidance, shuttle coordination, and traffic management for seamless mobility
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Status Overview Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <motion.div variants={itemVariants}>
              <Card className="border-green-200 bg-green-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Available Parking</p>
                      <p className="text-2xl font-bold text-green-800">{mockParkingData.totalAvailable}</p>
                    </div>
                    <ParkingCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-blue-200 bg-blue-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Active Shuttles</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {mockShuttleData.routes.reduce((acc, route) => acc + route.shuttles.length, 0)}
                      </p>
                    </div>
                    <Bus className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-orange-200 bg-orange-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-700 font-medium">Traffic Alerts</p>
                      <p className="text-2xl font-bold text-orange-800">{mockTrafficData.alerts.length}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-purple-200 bg-purple-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700 font-medium">System Status</p>
                      <p className="text-lg font-bold text-purple-800">
                        {isOnline ? "Online" : "Offline"}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm border border-blue-200 rounded-lg mb-6">
              <TabsTrigger
                value="parking"
                className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
              >
                <ParkingCircle className="h-4 w-4 mr-2" />
                Smart Parking
              </TabsTrigger>
              <TabsTrigger
                value="shuttles"
                className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
              >
                <Bus className="h-4 w-4 mr-2" />
                Shuttle Services
              </TabsTrigger>
              <TabsTrigger
                value="traffic"
                className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
              >
                <Activity className="h-4 w-4 mr-2" />
                Traffic Control
              </TabsTrigger>
            </TabsList>

            {/* Parking Tab */}
            <TabsContent value="parking" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Parking Zones List */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-blue-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        Available Parking Zones
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockParkingData.zones.map((zone) => (
                          <div
                            key={zone.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              selectedParkingZone === zone.id 
                                ? 'border-blue-300 bg-blue-50' 
                                : 'border-gray-200 hover:border-blue-200 hover:bg-blue-25'
                            }`}
                            onClick={() => setSelectedParkingZone(zone.id)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-slate-800">{zone.name}</h4>
                                <p className="text-sm text-slate-600">Walk time: {zone.estimatedWalk}</p>
                              </div>
                              <Badge className={getStatusColor(zone.status)}>
                                {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Available:</span>
                                <span className="font-medium">{zone.available}/{zone.total}</span>
                              </div>
                              <Progress 
                                value={(zone.available / zone.total) * 100} 
                                className="h-2"
                              />
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Rate:</span>
                                <span className="font-medium">₹{zone.pricePerHour}/hour</span>
                              </div>
                            </div>

                            {zone.status !== 'full' && (
                              <Button 
                                size="sm" 
                                className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                Navigate to Zone
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Parking Summary & Quick Actions */}
                <motion.div variants={itemVariants} className="space-y-6">
                  {/* Overall Parking Status */}
                  <Card className="shadow-sm border border-green-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                        <Car className="h-5 w-5 text-green-600" />
                        Parking Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-800 mb-1">
                              {mockParkingData.totalAvailable}
                            </div>
                            <div className="text-sm text-green-600">Spots Available</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Total Capacity:</span>
                            <span className="font-medium">{mockParkingData.totalCapacity}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Occupancy:</span>
                            <span className="font-medium">
                              {Math.round(((mockParkingData.totalCapacity - mockParkingData.totalAvailable) / mockParkingData.totalCapacity) * 100)}%
                            </span>
                          </div>
                        </div>

                        <Button className="w-full bg-green-600 hover:bg-green-700">
                          <MapPin className="h-4 w-4 mr-2" />
                          Find Best Spot
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card className="shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-500 to-slate-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                        <Zap className="h-5 w-5 text-slate-600" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full justify-start">
                          <Phone className="h-4 w-4 mr-2" />
                          Call Parking Support
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Report Issue
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Timer className="h-4 w-4 mr-2" />
                          Set Reminder
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Shuttles Tab */}
            <TabsContent value="shuttles" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {mockShuttleData.routes.map((route) => (
                  <motion.div key={route.id} variants={itemVariants}>
                    <Card className="shadow-sm border border-blue-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                          <Bus className="h-5 w-5 text-blue-600" />
                          {route.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Active Shuttles */}
                          <div>
                            <h4 className="font-medium text-slate-800 mb-3">Live Tracking</h4>
                            <div className="space-y-3">
                              {route.shuttles.map((shuttle) => (
                                <div key={shuttle.id} className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Bus className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium text-blue-800">
                                        Shuttle {shuttle.id.split('-')[1]}
                                      </span>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800">
                                      {shuttle.eta} min
                                    </Badge>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-600">Current:</span>
                                      <span className="text-slate-800">{shuttle.currentLocation}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-600">Next Stop:</span>
                                      <span className="text-slate-800">{shuttle.nextStop}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-600">Occupancy:</span>
                                      <span className="text-slate-800">
                                        {shuttle.occupancy}/{shuttle.capacity}
                                      </span>
                                    </div>
                                  </div>
                                  <Progress 
                                    value={(shuttle.occupancy / shuttle.capacity) * 100} 
                                    className="h-2 mt-2"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Schedule */}
                          <div>
                            <h4 className="font-medium text-slate-800 mb-3">Today's Schedule</h4>
                            <div className="space-y-2">
                              {route.schedule.map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600">{item.time}</span>
                                  <span className="text-slate-800 font-medium">{item.frequency}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button className="w-full bg-blue-600 hover:bg-blue-700">
                            <MapPin className="h-4 w-4 mr-2" />
                            Track on Map
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {/* Announcements */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                        <Radio className="h-5 w-5 text-amber-600" />
                        Service Announcements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mockShuttleData.announcements.map((announcement) => (
                          <div key={announcement.id} className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-amber-800 font-medium mb-1">{announcement.message}</p>
                                <div className="flex items-center gap-2 text-xs text-amber-600">
                                  <Clock className="h-3 w-3" />
                                  <span>{announcement.timestamp.toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Traffic Control Tab */}
            <TabsContent value="traffic" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Traffic Alerts */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-red-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-red-800">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Active Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTrafficData.alerts.map((alert) => (
                          <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-800 mb-1">{alert.title}</h4>
                                <p className="text-sm text-slate-600 mb-2">{alert.description}</p>
                              </div>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Duration:</span>
                                <p className="font-medium text-slate-700">{alert.duration}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Type:</span>
                                <p className="font-medium text-slate-700">{alert.type}</p>
                              </div>
                            </div>

                            <div className="mt-3">
                              <span className="text-xs text-slate-500">Affected Routes:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {alert.affectedRoutes.map((route, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {route}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Route Diversions */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-orange-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-orange-800">
                        <Route className="h-5 w-5 text-orange-600" />
                        Route Diversions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTrafficData.diversions.map((diversion) => (
                          <div key={diversion.id} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-800 mb-3">{diversion.title}</h4>
                            
                            <div className="space-y-3">
                              <div>
                                <span className="text-xs text-slate-500">Original Route:</span>
                                <p className="text-sm font-medium text-slate-700">{diversion.originalRoute}</p>
                              </div>
                              
                              <div>
                                <span className="text-xs text-slate-500">Alternative Route:</span>
                                <p className="text-sm font-medium text-green-700">{diversion.alternativeRoute}</p>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-xs text-slate-500">Additional Time:</span>
                                  <p className="text-sm font-medium text-orange-700">{diversion.additionalTime}</p>
                                </div>
                                <Button size="sm" variant="outline" className="text-orange-700 border-orange-200">
                                  <Navigation className="h-3 w-3 mr-1" />
                                  Navigate
                                </Button>
                              </div>
                              
                              <div className="bg-orange-50 p-2 rounded text-xs text-orange-700">
                                <strong>Reason:</strong> {diversion.reason}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Road Conditions */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-blue-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                        <Activity className="h-5 w-5 text-blue-600" />
                        Road Conditions Monitor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(mockTrafficData.roadConditions).map(([road, condition]) => (
                          <div key={road} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-slate-800 text-sm">{road}</h5>
                              <Badge className={
                                condition.status === 'normal' ? 'bg-green-100 text-green-800' :
                                condition.status === 'heavy' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {condition.status}
                              </Badge>
                            </div>
                            {condition.reason && (
                              <p className="text-xs text-slate-600 mb-1">{condition.reason}</p>
                            )}
                            {condition.duration && (
                              <p className="text-xs text-slate-500">Duration: {condition.duration}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Authority Coordination Panel */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-purple-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                        <Shield className="h-5 w-5 text-purple-600" />
                        Authority Coordination
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                          <Phone className="h-4 w-4 mr-2" />
                          Contact Traffic Police
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Report Emergency
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white">
                          <Radio className="h-4 w-4 mr-2" />
                          Request Assistance
                        </Button>
                      </div>
                      
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <h5 className="font-medium text-purple-800 mb-2">Emergency Contacts</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-purple-700">Traffic Control:</span>
                            <span className="text-purple-800 font-medium">+91-98765-43210</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-700">Police Headquarters:</span>
                            <span className="text-purple-800 font-medium">+91-98765-43211</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-700">Emergency Services:</span>
                            <span className="text-purple-800 font-medium">112</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-blue-700 mr-2" />
            <span className="text-lg font-semibold text-slate-800">HeritEdge</span>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} HeritEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
