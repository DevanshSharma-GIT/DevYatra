"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Clock,
  MapPin,
  Shield,
  Users,
  Trophy,
  Star,
  AlertTriangle,
  Phone,
  Navigation,
  Calendar,
  Award,
  Heart,
  Leaf,
  Globe,
  Menu,
} from "lucide-react"
import { getCookie } from "cookies-next"

// Mock data services
const mockTempleData = {
  currentWaitTime: "45 minutes",
  nextPuja: "Evening Aarti - 6:30 PM",
  isOpen: true,
  crowdLevel: "Moderate",
  emergencyContact: "+91-9876543210",
  helpdeskLocation: "Main Entrance, Gate 1"
}

const mockSchedule = [
  { time: "5:00 AM", event: "Morning Darshan Opens", type: "opening" },
  { time: "6:00 AM", event: "Suprabhatam", type: "puja" },
  { time: "8:00 AM", event: "Morning Aarti", type: "puja" },
  { time: "12:00 PM", event: "Midday Puja", type: "puja" },
  { time: "6:30 PM", event: "Evening Aarti", type: "puja" },
  { time: "9:00 PM", event: "Darshan Closes", type: "closing" }
]

const mockGamificationData = {
  userPoints: 1250,
  currentLevel: "Devoted Pilgrim",
  badges: [
    { name: "Queue Champion", description: "Waited patiently for 3+ hours", earned: true },
    { name: "Eco Warrior", description: "Used eco-friendly practices 5 times", earned: true },
    { name: "Temple Explorer", description: "Visited all major areas", earned: false },
    { name: "Community Helper", description: "Helped 3+ fellow pilgrims", earned: false }
  ],
  leaderboard: [
    { name: "Priya Sharma", points: 2100, group: "Mumbai Group" },
    { name: "Rajesh Kumar", points: 1950, group: "Delhi Group" },
    { name: "Anita Patel", points: 1800, group: "Gujarat Group" }
  ]
}

export default function PilgrimEngagementPage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("temple-info")
  const [showAlert, setShowAlert] = useState(false)

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
  }, [])

  const handleSafetyAlert = () => {
    setShowAlert(true)
    // In a real implementation, this would trigger the alert system
    setTimeout(() => setShowAlert(false), 3000)
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
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <Link href="/" className="font-semibold text-amber-900">
              HeritEdge
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/safety" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Safety
            </Link>
            <div className="flex items-center gap-1 bg-amber-100 px-3 py-1 rounded-full">
              <Star className="h-4 w-4 text-amber-700" />
              <span className="text-xs font-medium text-amber-800">{mockGamificationData.userPoints} points</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          {/* Page Header */}
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">
              Pilgrim Engagement Platform
            </Badge>
            <h1 className="text-4xl font-bold text-stone-800 mb-4">
              Sacred Journey <span className="text-amber-700">Companion</span>
            </h1>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
              Your comprehensive guide to a safe, organized, and meaningful temple visit experience
            </p>
          </div>

          {/* Emergency Alert Button */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={handleSafetyAlert}
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg h-16 w-16 p-0"
            >
              <AlertTriangle className="h-8 w-8" />
            </Button>
          </motion.div>

          {/* Alert Popup */}
          {showAlert && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <Card className="bg-white max-w-md w-full">
                <CardHeader className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                  <CardTitle className="text-red-700">Safety Alert Sent</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-stone-600 mb-4">
                    Your safety alert has been sent to temple security and nearby pilgrims.
                  </p>
                  <p className="text-sm text-stone-500">
                    Emergency contact: {mockTempleData.emergencyContact}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm border border-amber-200 rounded-lg mb-6">
              <TabsTrigger
                value="temple-info"
                className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Temple Info
              </TabsTrigger>
              <TabsTrigger
                value="safety"
                className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <Shield className="h-4 w-4 mr-2" />
                Safety
              </TabsTrigger>
              <TabsTrigger
                value="engagement"
                className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Engagement
              </TabsTrigger>
            </TabsList>

            {/* Temple Information Tab */}
            <TabsContent value="temple-info" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Real-time Wait Times */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                        <Clock className="h-5 w-5 text-amber-600" />
                        Current Wait Times
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                          <div className="text-2xl font-bold text-amber-800 mb-1">
                            {mockTempleData.currentWaitTime}
                          </div>
                          <div className="text-sm text-amber-600">Average wait time for darshan</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600">Crowd Level:</span>
                          <Badge className="bg-orange-100 text-orange-800">
                            {mockTempleData.crowdLevel}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600">Temple Status:</span>
                          <Badge className="bg-green-100 text-green-800">
                            {mockTempleData.isOpen ? "Open" : "Closed"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Daily Schedule */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-stone-500 to-stone-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-stone-800">
                        <Calendar className="h-5 w-5 text-stone-600" />
                        Today's Schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mockSchedule.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-stone-50 rounded-md border border-stone-100"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                item.type === 'puja' ? 'bg-amber-500' : 
                                item.type === 'opening' ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                              <div>
                                <div className="font-medium text-stone-800">{item.event}</div>
                                <div className="text-xs text-stone-500 capitalize">{item.type}</div>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-stone-700">{item.time}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Route Guidance */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-emerald-800">
                        <Navigation className="h-5 w-5 text-emerald-600" />
                        Temple Navigation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <MapPin className="h-4 w-4 mr-2" />
                            Main Shrine
                          </Button>
                          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <MapPin className="h-4 w-4 mr-2" />
                            Queue Area
                          </Button>
                          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <MapPin className="h-4 w-4 mr-2" />
                            Restrooms
                          </Button>
                          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <MapPin className="h-4 w-4 mr-2" />
                            Helpdesk
                          </Button>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                          <div className="text-sm text-emerald-800 font-medium mb-1">Quick Tip</div>
                          <div className="text-xs text-emerald-600">
                            Follow the guided path for the most efficient darshan experience
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Emergency Contacts */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-red-800">
                        <Phone className="h-5 w-5 text-red-600" />
                        Emergency & Help
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                          <div className="text-lg font-bold text-red-800 mb-1">
                            {mockTempleData.emergencyContact}
                          </div>
                          <div className="text-sm text-red-600">24/7 Emergency Helpline</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Helpdesk Location:</span>
                            <span className="text-sm font-medium text-stone-800">
                              {mockTempleData.helpdeskLocation}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Security:</span>
                            <span className="text-sm font-medium text-stone-800">Available 24/7</span>
                          </div>
                        </div>
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                          <Phone className="h-4 w-4 mr-2" />
                          Call Emergency
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Safety Tab */}
            <TabsContent value="safety" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Crowd Density Heatmap */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                        <Users className="h-5 w-5 text-blue-600" />
                        Crowd Density Map
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-800 mb-2">Live Heatmap</div>
                            <div className="text-sm text-blue-600 mb-4">
                              Real-time crowd density visualization
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-green-100 p-2 rounded text-green-800">Low</div>
                              <div className="bg-yellow-100 p-2 rounded text-yellow-800">Medium</div>
                              <div className="bg-red-100 p-2 rounded text-red-800">High</div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Main Shrine:</span>
                            <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Queue Area:</span>
                            <Badge className="bg-red-100 text-red-800">High</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Rest Area:</span>
                            <Badge className="bg-green-100 text-green-800">Low</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Women's Safety Features */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-500 to-pink-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-pink-800">
                        <Heart className="h-5 w-5 text-pink-600" />
                        Women's Safety
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
                          <div className="text-center">
                            <div className="text-lg font-bold text-pink-800 mb-2">Safety Features</div>
                            <div className="text-sm text-pink-600">
                              Dedicated support for women pilgrims
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white">
                            <Shield className="h-4 w-4 mr-2" />
                            Women's Helpdesk
                          </Button>
                          <Button className="w-full bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-200">
                            <Users className="h-4 w-4 mr-2" />
                            Safe Zone Locations
                          </Button>
                          <Button className="w-full bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-200">
                            <Phone className="h-4 w-4 mr-2" />
                            Women's Helpline
                          </Button>
                        </div>
                        <div className="bg-pink-50 p-3 rounded-lg border border-pink-100">
                          <div className="text-sm text-pink-800 font-medium mb-1">Quick Access</div>
                          <div className="text-xs text-pink-600">
                            Use the red alert button for immediate assistance
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            {/* Engagement Tab */}
            <TabsContent value="engagement" className="mt-6">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* User Progress */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                        <Trophy className="h-5 w-5 text-amber-600" />
                        Your Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center">
                          <div className="text-3xl font-bold text-amber-800 mb-1">
                            {mockGamificationData.userPoints}
                          </div>
                          <div className="text-sm text-amber-600 mb-2">Total Points</div>
                          <Badge className="bg-amber-200 text-amber-800">
                            {mockGamificationData.currentLevel}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Queue Discipline:</span>
                            <span className="text-sm font-medium text-stone-800">+50 points</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Eco-friendly:</span>
                            <span className="text-sm font-medium text-stone-800">+25 points</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-stone-600">Community Help:</span>
                            <span className="text-sm font-medium text-stone-800">+100 points</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Badges */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                        <Award className="h-5 w-5 text-purple-600" />
                        Your Badges
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mockGamificationData.badges.map((badge, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              badge.earned
                                ? 'bg-purple-50 border-purple-200'
                                : 'bg-stone-50 border-stone-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                badge.earned ? 'bg-purple-500' : 'bg-stone-300'
                              }`}>
                                <Award className={`h-4 w-4 ${
                                  badge.earned ? 'text-white' : 'text-stone-500'
                                }`} />
                              </div>
                              <div className="flex-1">
                                <div className={`font-medium ${
                                  badge.earned ? 'text-purple-800' : 'text-stone-500'
                                }`}>
                                  {badge.name}
                                </div>
                                <div className={`text-xs ${
                                  badge.earned ? 'text-purple-600' : 'text-stone-400'
                                }`}>
                                  {badge.description}
                                </div>
                              </div>
                              {badge.earned && (
                                <Badge className="bg-purple-200 text-purple-800">Earned</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Leaderboard */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                  <Card className="shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg text-emerald-800">
                        <Users className="h-5 w-5 text-emerald-600" />
                        Community Recognition
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mockGamificationData.leaderboard.map((person, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-emerald-50 rounded-md border border-emerald-100"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-yellow-500' : 
                                index === 1 ? 'bg-stone-400' : 
                                'bg-amber-600'
                              }`}>
                                <span className="text-white font-bold text-sm">
                                  {index + 1}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-emerald-800">{person.name}</div>
                                <div className="text-xs text-emerald-600">{person.group}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-800">{person.points}</div>
                              <div className="text-xs text-emerald-600">points</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="text-sm text-emerald-800 font-medium mb-1">About Recognition</div>
                        <div className="text-xs text-emerald-600">
                          This is a non-competitive leaderboard celebrating community spirit and positive contributions.
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
      <footer className="bg-white border-t border-amber-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-amber-700 mr-2" />
            <span className="text-lg font-semibold text-stone-800">HeritEdge</span>
          </div>
          <p className="text-stone-600 text-sm">© {new Date().getFullYear()} HeritEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
