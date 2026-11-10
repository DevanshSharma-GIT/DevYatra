"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Bus, 
  MapPin, 
  Clock, 
  Users, 
  Navigation, 
  Radio,
  AlertTriangle,
  Timer,
  Route,
  Wifi,
  Phone
} from "lucide-react"
import { ShuttleData, Shuttle, useTrafficMobilityService } from "@/services/trafficMobilityService"

interface ShuttleTrackerProps {
  selectedRoute?: string;
  compact?: boolean;
  showAnnouncements?: boolean;
}

export default function ShuttleTracker({ 
  selectedRoute, 
  compact = false,
  showAnnouncements = true 
}: ShuttleTrackerProps) {
  const [shuttleData, setShuttleData] = useState<ShuttleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trackingShuttle, setTrackingShuttle] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("routes")
  const { getShuttleData, trackShuttle } = useTrafficMobilityService()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getShuttleData()
        setShuttleData(data)
      } catch (error) {
        console.error('Error fetching shuttle data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Set up real-time updates
    const interval = setInterval(fetchData, 15000) // Update every 15 seconds
    
    return () => clearInterval(interval)
  }, [getShuttleData])

  const getOccupancyLevel = (occupancy: number, capacity: number) => {
    const percentage = (occupancy / capacity) * 100
    if (percentage >= 90) return { level: 'high', color: 'bg-red-500', text: 'Full' }
    if (percentage >= 70) return { level: 'medium', color: 'bg-yellow-500', text: 'Busy' }
    return { level: 'low', color: 'bg-green-500', text: 'Available' }
  }

  const getETAColor = (eta: number) => {
    if (eta <= 3) return 'text-green-600'
    if (eta <= 8) return 'text-yellow-600'
    return 'text-orange-600'
  }

  const handleTrackShuttle = async (shuttleId: string) => {
    setTrackingShuttle(shuttleId)
    try {
      const trackingData = await trackShuttle(shuttleId)
      console.log('Tracking data:', trackingData)
      // In a real app, this would open a detailed tracking view
    } catch (error) {
      console.error('Error tracking shuttle:', error)
    } finally {
      setTrackingShuttle(null)
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading shuttle data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!shuttleData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Unable to load shuttle data. Please try again later.
          </div>
        </CardContent>
      </Card>
    )
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  }

  // Filter routes if a specific route is selected
  const routesToShow = selectedRoute 
    ? shuttleData.routes.filter(route => route.id === selectedRoute)
    : shuttleData.routes

  return (
    <div className="space-y-6">
      {/* Global Status */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Active Shuttles</p>
                  <p className="text-2xl font-bold text-blue-800">{shuttleData.globalStatus.totalActiveShuttles}</p>
                </div>
                <Bus className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Operational Routes</p>
                  <p className="text-2xl font-bold text-green-800">{shuttleData.globalStatus.operationalRoutes}</p>
                </div>
                <Route className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Avg Wait Time</p>
                  <p className="text-2xl font-bold text-purple-800">{shuttleData.globalStatus.averageWaitTime} min</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white shadow-sm border border-blue-200 rounded-lg mb-6">
          <TabsTrigger
            value="routes"
            className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
          >
            <Bus className="h-4 w-4 mr-2" />
            Live Tracking
          </TabsTrigger>
          {showAnnouncements && (
            <TabsTrigger
              value="announcements"
              className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
            >
              <Radio className="h-4 w-4 mr-2" />
              Announcements
            </TabsTrigger>
          )}
        </TabsList>

        {/* Routes & Live Tracking */}
        <TabsContent value="routes" className="mt-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {routesToShow.map((route) => (
              <motion.div key={route.id} variants={itemVariants}>
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bus className="h-5 w-5 text-blue-600" />
                        {route.name}
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {route.shuttles.filter(s => s.status === 'active').length} Active
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Live Shuttles */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-green-500" />
                        Live Tracking
                      </h4>
                      <div className="grid gap-4">
                        {route.shuttles.map((shuttle) => (
                          <div 
                            key={shuttle.id} 
                            className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  shuttle.status === 'active' ? 'bg-green-500' :
                                  shuttle.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                                <span className="font-medium text-gray-800">
                                  Shuttle {shuttle.id.split('-')[1]}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {shuttle.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge className={`${getETAColor(shuttle.eta)}`}>
                                  {shuttle.eta} min
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={trackingShuttle === shuttle.id}
                                  onClick={() => handleTrackShuttle(shuttle.id)}
                                >
                                  {trackingShuttle === shuttle.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                                  ) : (
                                    <MapPin className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <span className="text-gray-500">Current Location:</span>
                                <p className="font-medium text-gray-800">{shuttle.currentLocation}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Next Stop:</span>
                                <p className="font-medium text-gray-800">{shuttle.nextStop}</p>
                              </div>
                            </div>

                            {/* Occupancy */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">
                                  Occupancy: {shuttle.occupancy}/{shuttle.capacity}
                                </span>
                                <span className="text-gray-600">
                                  {Math.round((shuttle.occupancy / shuttle.capacity) * 100)}%
                                </span>
                              </div>
                              <Progress 
                                value={(shuttle.occupancy / shuttle.capacity) * 100} 
                                className="h-2"
                              />
                              <div className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${getOccupancyLevel(shuttle.occupancy, shuttle.capacity).color}`}></div>
                                <span className="text-gray-600">
                                  {getOccupancyLevel(shuttle.occupancy, shuttle.capacity).text}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Schedule */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <Timer className="h-4 w-4 text-gray-600" />
                        Today's Schedule
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {route.schedule.map((item, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                            <div className="font-medium text-gray-800">{item.time}</div>
                            <div className="text-sm text-gray-600">{item.frequency}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Route Stops */}
                    {!compact && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-gray-600" />
                          Route Stops
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {route.stops.map((stop) => (
                            <Badge key={stop.id} variant="secondary" className="text-sm">
                              <MapPin className="h-3 w-3 mr-1" />
                              {stop.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                        <MapPin className="h-4 w-4 mr-2" />
                        View on Map
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Phone className="h-4 w-4 mr-2" />
                        Contact Driver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Announcements */}
        {showAnnouncements && (
          <TabsContent value="announcements" className="mt-6">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {shuttleData.announcements.length > 0 ? (
                shuttleData.announcements.map((announcement) => (
                  <motion.div key={announcement.id} variants={itemVariants}>
                    <Card className={`border-l-4 ${
                      announcement.type === 'emergency' ? 'border-l-red-500 bg-red-50' :
                      announcement.type === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
                      'border-l-blue-500 bg-blue-50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {announcement.type === 'emergency' ? (
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                            ) : announcement.type === 'warning' ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            ) : (
                              <Radio className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={`${
                                announcement.type === 'emergency' ? 'bg-red-100 text-red-800' :
                                announcement.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {announcement.type.toUpperCase()}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {announcement.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            
                            <p className={`text-sm ${
                              announcement.type === 'emergency' ? 'text-red-800' :
                              announcement.type === 'warning' ? 'text-yellow-800' :
                              'text-blue-800'
                            }`}>
                              {announcement.message}
                            </p>
                            
                            {announcement.route && (
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  Route: {shuttleData.routes.find(r => r.id === announcement.route)?.name || announcement.route}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Radio className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No announcements at this time</p>
                      <p className="text-sm text-gray-400 mt-1">All shuttle services are operating normally</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
