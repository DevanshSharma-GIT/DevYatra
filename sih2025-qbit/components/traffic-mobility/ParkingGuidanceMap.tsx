"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Car, 
  Zap, 
  DollarSign,
  Shield,
  Timer,
  Phone
} from "lucide-react"
import { ParkingZone, ParkingData, useTrafficMobilityService } from "@/services/trafficMobilityService"

interface ParkingGuidanceMapProps {
  onZoneSelect?: (zone: ParkingZone) => void;
  showMap?: boolean;
  compact?: boolean;
}

export default function ParkingGuidanceMap({ 
  onZoneSelect, 
  showMap = true, 
  compact = false 
}: ParkingGuidanceMapProps) {
  const [parkingData, setParkingData] = useState<ParkingData | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)
  const { getParkingData, reserveParkingSpot } = useTrafficMobilityService()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getParkingData()
        setParkingData(data)
      } catch (error) {
        console.error('Error fetching parking data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchData, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [getParkingData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 border-green-200"
      case "limited": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "full": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getAvailabilityIcon = (status: string) => {
    switch (status) {
      case "available": return <Car className="h-4 w-4 text-green-600" />
      case "limited": return <Timer className="h-4 w-4 text-yellow-600" />
      case "full": return <Clock className="h-4 w-4 text-red-600" />
      default: return <Car className="h-4 w-4 text-gray-600" />
    }
  }

  const handleZoneSelect = (zone: ParkingZone) => {
    setSelectedZone(zone.id)
    onZoneSelect?.(zone)
  }

  const handleReservation = async (zoneId: string) => {
    setReserving(zoneId)
    try {
      const result = await reserveParkingSpot(zoneId, 2) // 2 hour reservation
      if (result.success) {
        // Handle successful reservation
        console.log('Reservation successful:', result.reservationId)
      }
    } catch (error) {
      console.error('Reservation failed:', error)
    } finally {
      setReserving(null)
    }
  }

  const handleNavigation = (zone: ParkingZone) => {
    // In a real app, this would integrate with navigation APIs
    const url = `https://www.google.com/maps/dir/?api=1&destination=${zone.coordinates.lat},${zone.coordinates.lng}&destination_place_id=${zone.name}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading parking data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!parkingData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Unable to load parking data. Please try again later.
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

  return (
    <div className={`space-y-6 ${compact ? 'space-y-4' : ''}`}>
      {/* Overall Status */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Available Spots</p>
                  <p className="text-2xl font-bold text-green-800">{parkingData.totalAvailable}</p>
                </div>
                <Car className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Total Capacity</p>
                  <p className="text-2xl font-bold text-blue-800">{parkingData.totalCapacity}</p>
                </div>
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {Math.round(((parkingData.totalCapacity - parkingData.totalAvailable) / parkingData.totalCapacity) * 100)}%
                  </p>
                </div>
                <Zap className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Interactive Map Placeholder */}
      {showMap && !compact && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Parking Zone Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg h-64 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MapPin className="h-12 w-12 text-slate-400 mx-auto" />
                  <p className="text-slate-600 font-medium">Interactive Map</p>
                  <p className="text-sm text-slate-500">Real-time parking zone visualization</p>
                </div>
              </div>
              
              {/* Zone Markers */}
              {parkingData.zones.map((zone, index) => (
                <motion.div
                  key={zone.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer transform hover:scale-110 transition-transform ${
                    zone.status === 'available' ? 'bg-green-500' :
                    zone.status === 'limited' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{
                    left: `${20 + index * 20}%`,
                    top: `${30 + (index % 2) * 40}%`
                  }}
                  onClick={() => handleZoneSelect(zone)}
                  title={zone.name}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parking Zones List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
      >
        {parkingData.zones.map((zone) => (
          <motion.div key={zone.id} variants={itemVariants}>
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedZone === zone.id 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => handleZoneSelect(zone)}
            >
              <CardHeader className={`pb-3 ${compact ? 'pb-2' : ''}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
                    {getAvailabilityIcon(zone.status)}
                    {zone.name}
                  </CardTitle>
                  <Badge className={getStatusColor(zone.status)}>
                    {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className={`space-y-4 ${compact ? 'space-y-3' : ''}`}>
                {/* Availability Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Available: {zone.available}/{zone.total}</span>
                    <span className="font-medium">
                      {Math.round((zone.available / zone.total) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(zone.available / zone.total) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Zone Details */}
                <div className={`grid grid-cols-2 gap-4 text-sm ${compact ? 'gap-2' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Walk: {zone.estimatedWalk}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">₹{zone.pricePerHour}/hr</span>
                  </div>
                </div>

                {/* Amenities */}
                {zone.amenities && zone.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {zone.amenities.map((amenity, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                {zone.status !== 'full' && (
                  <div className={`flex gap-2 ${compact ? 'flex-col' : ''}`}>
                    <Button 
                      size="sm" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNavigation(zone)
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                      disabled={reserving === zone.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReservation(zone.id)
                      }}
                    >
                      {reserving === zone.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-2"></div>
                          Reserving...
                        </>
                      ) : (
                        <>
                          <Timer className="h-4 w-4 mr-2" />
                          Reserve
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {zone.status === 'full' && (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 text-red-700">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">This zone is currently full</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recommendations */}
      {parkingData.recommendations && parkingData.recommendations.length > 0 && !compact && (
        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Zap className="h-5 w-5 text-amber-600" />
              Smart Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parkingData.recommendations.map((rec, index) => {
                const zone = parkingData.zones.find(z => z.id === rec.zoneId)
                if (!zone) return null
                
                return (
                  <div key={index} className="bg-white p-3 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-amber-800">{zone.name}</h4>
                        <p className="text-sm text-amber-600">{rec.reason}</p>
                      </div>
                      {rec.savings && (
                        <Badge className="bg-green-100 text-green-800">
                          Save ₹{rec.savings}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button variant="outline" className="justify-start">
                <Phone className="h-4 w-4 mr-2" />
                Call Parking Support
              </Button>
              <Button variant="outline" className="justify-start">
                <Timer className="h-4 w-4 mr-2" />
                Set Reminder
              </Button>
              <Button variant="outline" className="justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {parkingData.lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  )
}
