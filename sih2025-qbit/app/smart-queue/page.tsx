"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  QrCode,
  Clock,
  Users,
  Calendar,
  MapPin,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  User,
  Globe,
  Star,
  Zap,
  Timer,
  Activity,
  Bell,
  CreditCard,
  Ticket,
  Shield,
  Phone,
  Navigation,
} from "lucide-react"
import { getCookie } from "cookies-next"
import { useSmartQueue } from "@/hooks/use-smart-queue"
import { VirtualQueueManager } from "@/components/smart-queue/VirtualQueueManager"


export default function SmartQueuePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("queue")
  const [selectedSlot, setSelectedSlot] = useState("")
  const [pilgrimName, setPilgrimName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [bookingComplete, setBookingComplete] = useState(false)

  // Use the Smart Queue hook for state management
  const {
    // State
    queues,
    statistics,
    systemStatus,
    userTickets,
    activeTickets,
    availableSlots,
    loading,
    error,
    isOnline,
    lastUpdate,
    refreshing,
    notificationsEnabled,
    
    // Actions
    refreshQueueStatus,
    joinQueue,
    leaveQueue,
    refreshSlots,
    bookSlot,
    cancelSlotBooking,
    refreshUserTickets,
    downloadTicket,
    forceRefresh,
  } = useSmartQueue({
    userId: userProfile?.username || 'guest-user',
    autoRefreshInterval: 30000,
    enableWebSocket: true,
    enableNotifications: true,
  })

  useEffect(() => {
    // Get user profile from cookies/localStorage
    const preferencesFromCookie = getCookie("travelPreferences")
    if (preferencesFromCookie) {
      try {
        const preferences = JSON.parse(preferencesFromCookie as string)
        setUserProfile(preferences)
        setPilgrimName(preferences.username || "")
      } catch (e) {
        console.error("Error parsing preferences:", e)
      }
    }

    // Check for cached tickets in localStorage
    const cachedTickets = localStorage.getItem("smartQueueTickets")
    if (cachedTickets) {
      try {
        const tickets = JSON.parse(cachedTickets)
        setUserTickets(tickets)
      } catch (e) {
        console.error("Error parsing cached tickets:", e)
      }
    }

    // Simulate real-time updates
    const updateInterval = setInterval(() => {
      setLastUpdate(new Date())
      updateQueuePositions()
    }, 30000) // Update every 30 seconds

    // Check online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted')
      })
    }

    return () => {
      clearInterval(updateInterval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle slot booking with hook function
  const handleBookSlot = async () => {
    if (!selectedSlot || !pilgrimName) return

    const result = await bookSlot(selectedSlot, {
      name: pilgrimName,
      phoneNumber: phoneNumber || "",
    })

    if (result.success) {
      setSelectedSlot("")
      setPilgrimName("")
      setPhoneNumber("")
      setBookingComplete(true)
      setTimeout(() => setBookingComplete(false), 5000)
    }
  }

  const getQueueStatusColor = (type: string) => {
    switch (type) {
      case "general": return "bg-blue-100 text-blue-800 border-blue-200"
      case "priority": return "bg-purple-100 text-purple-800 border-purple-200"
      case "special": return "bg-amber-100 text-amber-800 border-amber-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "ready": return "bg-green-100 text-green-800 border-green-200"
      case "completed": return "bg-gray-100 text-gray-800 border-gray-200"
      case "expired": return "bg-red-100 text-red-800 border-red-200"
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-indigo-700" />
            <Link href="/" className="font-semibold text-indigo-900">
              HeritEdge
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-indigo-800 hover:text-indigo-600 text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/safety" className="text-indigo-800 hover:text-indigo-600 text-sm font-medium">
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
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs">Offline</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={forceRefresh}
                disabled={refreshing}
                className="text-indigo-700 hover:bg-indigo-50"
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
            <Badge className="mb-4 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-none">
              Smart Queue & Ticketing System
            </Badge>
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Digital <span className="text-indigo-700">Darshan</span> Management
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Skip the physical lines with our intelligent virtual queue system and pre-book your darshan slots
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
                      <p className="text-sm text-green-700 font-medium">Today's Visitors</p>
                      <p className="text-2xl font-bold text-green-800">{statistics.totalVisitorsToday}</p>
                    </div>
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-blue-200 bg-blue-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Avg Wait Time</p>
                      <p className="text-2xl font-bold text-blue-800">{statistics.averageWaitTime} min</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-purple-200 bg-purple-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700 font-medium">Active Queues</p>
                      <p className="text-2xl font-bold text-purple-800">{queues.filter(q => q.status === 'active').length}</p>
                    </div>
                    <Activity className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-amber-200 bg-amber-50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-700 font-medium">Current Load</p>
                      <p className="text-2xl font-bold text-amber-800">{statistics.currentLoad}%</p>
                    </div>
                    <Zap className="h-8 w-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Notification Banner */}
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <WifiOff className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-amber-800 font-medium">Offline Mode</p>
                      <p className="text-amber-700 text-sm">You're viewing cached data. Some features may be limited.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* My Tickets Section */}
          {userTickets.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-8"
            >
              <Card className="shadow-sm border border-indigo-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1"></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-indigo-800">
                    <Ticket className="h-5 w-5 text-indigo-600" />
                    My Digital Passes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userTickets.map((ticket) => (
                      <motion.div key={ticket.id} variants={itemVariants}>
                        <Card className={`border-l-4 ${
                          ticket.status === 'ready' ? 'border-l-green-500 shadow-lg' :
                          ticket.status === 'waiting' ? 'border-l-blue-500' :
                          ticket.status === 'completed' ? 'border-l-gray-500' :
                          'border-l-red-500'
                        }`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-indigo-600" />
                                <span className="font-bold text-lg">#{ticket.ticketNumber}</span>
                              </div>
                              <Badge className={getTicketStatusColor(ticket.status)}>
                                {ticket.status.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="font-medium text-slate-800">{ticket.queueName}</p>
                              <p className="text-sm text-slate-600">
                                {ticket.type === 'slot' ? 
                                  `Slot Time: ${ticket.slotTime}` : 
                                  `Position: ${ticket.position} | ETA: ${ticket.estimatedTime} min`
                                }
                              </p>
                            </div>
                            
                            {ticket.status === 'ready' && (
                              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2 text-green-800">
                                  <Bell className="h-4 w-4" />
                                  <span className="font-medium">Ready for Darshan!</span>
                                </div>
                                <p className="text-sm text-green-700 mt-1">Please proceed to the gate</p>
                              </div>
                            )}
                            
                            {ticket.status === 'waiting' && ticket.type === 'queue' && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Queue Progress</span>
                                  <span className="font-medium">{Math.max(0, 100 - (ticket.position * 10))}%</span>
                                </div>
                                <Progress value={Math.max(0, 100 - (ticket.position * 10))} className="h-2" />
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadTicket(ticket)}
                                className="flex-1"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                              >
                                <QrCode className="h-3 w-3 mr-1" />
                                View QR
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm border border-indigo-200 rounded-lg mb-6">
              <TabsTrigger
                value="queue"
                className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-900"
              >
                <Users className="h-4 w-4 mr-2" />
                Virtual Queue
              </TabsTrigger>
              <TabsTrigger
                value="slots"
                className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-900"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Darshan Slots
              </TabsTrigger>
              <TabsTrigger
                value="passes"
                className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-900"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Digital Passes
              </TabsTrigger>
            </TabsList>

            {/* Virtual Queue Tab */}
            <TabsContent value="queue" className="mt-6">
              <VirtualQueueManager
                queues={queues}
                userTickets={userTickets}
                loading={loading}
                onJoinQueue={async (queueId, userData) => {
                  const result = await joinQueue(queueId, userData)
                  return result
                }}
                onLeaveQueue={leaveQueue}
                onRefresh={forceRefresh}
                refreshing={refreshing}
              />
            </TabsContent>

            {/* Darshan Slots Tab */}
            <TabsContent value="slots" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Available Slots */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-purple-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-1"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        Available Darshan Slots
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {availableSlots.map((slot) => (
                          <div key={slot.id} className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-slate-800">{slot.time}</h4>
                                <p className="text-sm text-slate-600">
                                  Duration: {slot.duration} | Type: {slot.type}
                                </p>
                              </div>
                              <div className="text-right">
                                {slot.price > 0 ? (
                                  <Badge className="bg-amber-100 text-amber-800">₹{slot.price}</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800">Free</Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <span className="text-slate-500">Available:</span>
                                <p className="font-medium text-slate-800">{slot.capacity - slot.booked}/{slot.capacity}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Booked:</span>
                                <p className="font-medium text-slate-800">{slot.booked}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Availability:</span>
                                <span className="font-medium">
                                  {Math.round(((slot.capacity - slot.booked) / slot.capacity) * 100)}%
                                </span>
                              </div>
                              <Progress 
                                value={((slot.capacity - slot.booked) / slot.capacity) * 100} 
                                className="h-2"
                              />
                            </div>

                            {slot.capacity - slot.booked === 0 ? (
                              <Badge className="mt-3 bg-red-100 text-red-800">
                                Fully Booked
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-3"
                                onClick={() => setSelectedSlot(slot.id)}
                              >
                                Select This Slot
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Book Slot Form */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                        <Timer className="h-5 w-5 text-amber-600" />
                        Book Darshan Slot
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Pilgrim Name</label>
                        <Input
                          placeholder="Enter your name"
                          value={pilgrimName}
                          onChange={(e) => setPilgrimName(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">Phone Number</label>
                        <Input
                          placeholder="Required for slot booking"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      {selectedSlot && (
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                          <p className="text-sm font-medium text-amber-800">Selected Slot:</p>
                          <p className="text-sm text-amber-700">
                            {availableSlots.find(s => s.id === selectedSlot)?.time} - 
                            {availableSlots.find(s => s.id === selectedSlot)?.type}
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleBookSlot}
                        disabled={loading || !selectedSlot || !pilgrimName || !phoneNumber}
                        className="w-full bg-amber-600 hover:bg-amber-700"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Booking Slot...
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4 mr-2" />
                            Book Selected Slot
                          </>
                        )}
                      </Button>

                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-2">
                          <Timer className="h-4 w-4 text-purple-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-purple-800">Slot Booking Benefits</p>
                            <ul className="text-xs text-purple-700 mt-1 space-y-1">
                              <li>• Guaranteed darshan time</li>
                              <li>• No queue waiting required</li>
                              <li>• Priority gate access</li>
                              <li>• SMS confirmation & reminders</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Digital Passes Tab */}
            <TabsContent value="passes" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Pass Verification Demo */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-blue-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                        <QrCode className="h-5 w-5 text-blue-600" />
                        Digital Pass Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold text-slate-800 mb-3">How It Works</h4>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="bg-blue-100 rounded-full p-1">
                                <Smartphone className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">1. Get Your Digital Pass</p>
                                <p className="text-sm text-slate-600">Join queue or book slot to receive QR code</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="bg-blue-100 rounded-full p-1">
                                <QrCode className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">2. Show QR at Gate</p>
                                <p className="text-sm text-slate-600">Present digital pass for instant verification</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="bg-blue-100 rounded-full p-1">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">3. Quick Entry</p>
                                <p className="text-sm text-slate-600">Verified passes get priority gate access</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-slate-800 mb-3">Scanner Simulation</h4>
                          <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300 text-center">
                            <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">QR Code Scanner View</p>
                            <p className="text-xs text-gray-500 mt-1">
                              In production, this would integrate with physical scanners
                            </p>
                          </div>
                          <Button variant="outline" className="w-full mt-3">
                            <QrCode className="h-4 w-4 mr-2" />
                            Test Scanner
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Offline Access */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-green-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 h-1"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                        <Shield className="h-5 w-5 text-green-600" />
                        Offline Pass Access
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                          <h4 className="font-semibold text-slate-800 mb-3">Works Without Internet</h4>
                          <p className="text-slate-600 mb-4">
                            Your digital passes are automatically cached on your device, ensuring access even in areas with poor connectivity.
                          </p>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-slate-700">Passes stored locally on device</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-slate-700">QR codes work offline</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-slate-700">Auto-sync when connection restored</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-slate-700">Backup SMS delivery option</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              {isOnline ? (
                                <Wifi className="h-8 w-8 text-green-600" />
                              ) : (
                                <WifiOff className="h-8 w-8 text-orange-600" />
                              )}
                            </div>
                            <p className="font-medium text-slate-800">
                              {isOnline ? "Connected" : "Offline Mode"}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {isOnline ? 
                                "All features available" : 
                                "Cached passes accessible"
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Security Features */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-purple-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-1"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                        <Shield className="h-5 w-5 text-purple-600" />
                        Security & Anti-Fraud
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <QrCode className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <p className="font-medium text-purple-800">Unique QR Codes</p>
                          <p className="text-xs text-purple-600 mt-1">Each pass has a unique, time-stamped QR code</p>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <p className="font-medium text-purple-800">Encrypted Data</p>
                          <p className="text-xs text-purple-600 mt-1">All pass data is encrypted and secure</p>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <Timer className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <p className="font-medium text-purple-800">Time-Limited</p>
                          <p className="text-xs text-purple-600 mt-1">Passes expire after use or time limit</p>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <Activity className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <p className="font-medium text-purple-800">Real-time Sync</p>
                          <p className="text-xs text-purple-600 mt-1">Instant verification against live database</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Success Message */}
          <AnimatePresence>
            {bookingComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              >
                <Card className="bg-white max-w-md w-full">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-green-800 mb-2">Success!</h3>
                    <p className="text-gray-600 mb-4">
                      Your digital pass has been generated and saved to your device.
                    </p>
                    <div className="space-y-2">
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <Download className="h-4 w-4 mr-2" />
                        Download Pass
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Navigation className="h-4 w-4 mr-2" />
                        Get Directions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-indigo-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-indigo-700 mr-2" />
            <span className="text-lg font-semibold text-slate-800">HeritEdge</span>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} HeritEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
