"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, MapPin, AlertTriangle, Info, ArrowLeft, Loader2, MessageSquareWarning, UserCircle, Clock, Map, BarChart2, X, Globe } from 'lucide-react'
import Link from "next/link"
import Navbar from "@/components/navbar"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import FeatureRecommendations from "@/components/feature-recommendations"

// --- Leaflet Imports ---
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import L, { LatLng } from 'leaflet';
// --- End Leaflet Imports ---

// Updated UserReport interface (remains the same)
interface UserReport {
  id: number
  username: string | null
  latitude: number
  longitude: number
  type: string
  description: string | null
  timestamp: string
}

// --- Dynamic Map Component ---
const SafetyMap = dynamic(
  () => import('@/components/SafetyMap'),
  {
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-[75vh]"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /> <p className="ml-2">Loading Map...</p></div>
  }
);
// --- End Dynamic Map Component ---

// Define or import this helper function
const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Remove any trailing slashes from baseUrl
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Ensure path doesn't start with slash
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${cleanBase}/api/${cleanPath}`;
}

export default function SafetyPage() {
  const [userReports, setUserReports] = useState<UserReport[]>([])
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [username, setUsername] = useState<string>("")
  const [points, setPoints] = useState<number>(0)
  const [reportType, setReportType] = useState<string>("pickpocketing")
  const [reportDescription, setReportDescription] = useState<string>("")
  const [showReportForm, setShowReportForm] = useState(false)
  const [newReportCoords, setNewReportCoords] = useState<LatLng | null>(null); // State for coordinates from map click
  const { toast } = useToast()

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  
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
  };

  useEffect(() => {
    // Get username from localStorage
    const storedPreferences = localStorage.getItem("travelPreferences")
    if (storedPreferences) {
      const preferences = JSON.parse(storedPreferences)
      if (preferences.username) {
        setUsername(preferences.username)
        fetchUserData(preferences.username)
      }
    } else {
       toast({ title: "Username Required", description: "Please set your username in Preferences.", variant: "destructive" });
    }

    // Fetch all user reports initially
    fetchAllUserReports()
  }, [])

  // ... fetchUserData remains the same ...
  const fetchUserData = async (user: string) => {
    try {
      const response = await fetch(getApiUrl(`users/${user}`))
      if (response.ok) {
        const userData = await response.json()
        setPoints(userData.points || 0)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  };

  // ... fetchAllUserReports remains the same ...
   const fetchAllUserReports = async () => {
    setLoading(true)
    try {
      // Use the helper function to construct the URL
      const response = await fetch(getApiUrl('safety/reports')) // Fetch all reports
      if (response.ok) {
        const data: UserReport[] = await response.json()
        setUserReports(data)
      } else {
         toast({
          title: "Error",
          description: "Failed to fetch community reports",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching user reports:", error)
       toast({
          title: "Error",
          description: "Failed to connect to server",
          variant: "destructive",
        })
    } finally {
      setLoading(false)
    }
  }

  // Handle clicks on the map
  const handleMapClick = (latlng: LatLng) => {
    console.log("Map clicked at:", latlng); // Debug log
    setNewReportCoords(latlng);
    setShowReportForm(true); // Open the form when map is clicked
    toast({
      title: "Location Selected",
      description: `Selected: Lat: ${latlng.lat.toFixed(4)}, Lng: ${latlng.lng.toFixed(4)}`,
    });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportDescription.trim()) {
       toast({ title: "Missing Description", description: "Please describe the incident or tip.", variant: "destructive" });
       return;
    }
    // Use coordinates from map click state
    if (!newReportCoords) {
       toast({ title: "Location Required", description: "Please click on the map to select a location for the report.", variant: "destructive" });
       return;
    }
     if (!username) {
       toast({ title: "Username Required", description: "Cannot submit report without username.", variant: "destructive" });
       return;
    }

    setReportLoading(true)
    
    // Debug log the API URL
    const apiUrl = getApiUrl('safety/report');
    console.log("Submitting report to:", apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          latitude: newReportCoords.lat, // Use clicked latitude
          longitude: newReportCoords.lng, // Use clicked longitude
          type: reportType,
          description: reportDescription,
        }),
      })

      console.log("Report submission response status:", response.status); // Debug log
      
      const resultText = await response.text();
      console.log("Report submission response:", resultText); // Debug raw response
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        console.error("Failed to parse response JSON:", e);
        toast({
          title: "Error Processing Response",
          description: "Server returned invalid response format",
          variant: "destructive",
        });
        return;
      }

      if (response.ok) {
        toast({
          title: "Report submitted",
          description: "Thank you for contributing! (+5 points)",
        })
        setReportDescription("")
        setShowReportForm(false)
        setNewReportCoords(null); // Clear selected coordinates
        // Add the new report to the map optimistically or refetch
        if (result.report) {
           setUserReports(prev => [result.report, ...prev]);
        } else {
           fetchAllUserReports(); // Refetch all reports
        }
        fetchUserData(username) // Update user points
      } else {
         toast({
          title: "Error Submitting Report",
          description: result.error || "Failed to submit report",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error submitting report:", error)
      toast({
        title: "Connection Error",
        description: "Failed to connect to server. Check your network and try again.",
        variant: "destructive",
      })
    } finally {
      setReportLoading(false)
    }
  }

  // ... getReportTypeIcon remains the same ...
  const getReportTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pickpocketing': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'scam': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'harassment': return <AlertTriangle className="h-4 w-4 text-purple-500" />;
      case 'health': return <Info className="h-4 w-4 text-blue-500" />;
      case 'transportation': return <Info className="h-4 w-4 text-cyan-500" />;
      case 'safe_locker': return <Shield className="h-4 w-4 text-green-500" />;
      case 'tip': return <Info className="h-4 w-4 text-gray-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // ... formatDate remains the same ...
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Filter reports with valid coordinates for the map
  const mapReports = userReports.filter(report => report.latitude != null && report.longitude != null);

  // Add console log to track reportType changes
  const handleReportTypeChange = (value: string) => {
    console.log("Selected report type:", value);
    setReportType(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <Link href="/">
            <span className="font-semibold text-amber-900">HeritEdge</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/destinations" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Destinations
            </Link>
            <Link href="/experiences" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Experiences
            </Link>
            <Link href="/dashboard" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Dashboard
            </Link>
            <div className="flex items-center gap-1 bg-amber-100 px-3 py-1 rounded-full">
              <UserCircle className="h-4 w-4 text-amber-700" />
              <span className="text-xs font-medium text-amber-800">{points} points</span>
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-800">Community Safety Map</h1>
              <p className="text-stone-600 mt-1">View and report safety information for travelers</p>
            </div>
            <div className="flex gap-3">
              <Link href="/safety/analysis">
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Safety Analysis
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <Card className="shadow-lg overflow-hidden border border-amber-200 relative">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  Safety Reports
                </CardTitle>
                <Badge className="bg-white text-amber-800">
                  {mapReports.length} {mapReports.length === 1 ? 'Report' : 'Reports'}
                </Badge>
              </div>
            </CardHeader>

            {/* Map View is now the main content */}
            <CardContent className="p-0 relative">
              {loading ? (
                <div className="flex justify-center items-center h-[75vh] bg-amber-50">
                  <Loader2 className="h-12 w-12 animate-spin text-amber-600" />
                  <p className="ml-3 text-amber-800">Loading safety map...</p>
                </div>
              ) : (
                <SafetyMap reports={mapReports} onMapClick={handleMapClick} />
              )}

              {/* Floating Action Button to Add Report */}
              {!showReportForm && (
                <Button
                  onClick={() => {
                    console.log("Add report button clicked"); // Debug log
                    if (!newReportCoords) {
                      toast({ 
                        title: "Click Map", 
                        description: "Click on the map where you want to add a report.", 
                        variant: "default" 
                      });
                    }
                    setShowReportForm(true);
                  }}
                  size="lg"
                  className="absolute bottom-4 right-4 z-[1000] rounded-full shadow-lg bg-amber-600 hover:bg-amber-700 h-14 w-14 p-0"
                  disabled={!username}
                  title={!username ? "Set username in Preferences" : "Add Safety Report"}
                >
                  <MapPin className="h-6 w-6" />
                </Button>
              )}
            </CardContent>

            {/* Report Form - Absolutely Positioned or Modal */}
            {showReportForm && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-0 left-0 right-0 z-[1001] bg-white border-t border-amber-200 shadow-lg p-4 rounded-t-lg"
              >
                {(() => {
                  console.log("Rendering report form", { newReportCoords });
                  return null;
                })()} {/* Debug log */}
                <form onSubmit={handleReportSubmit} className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-lg text-stone-800">Add Safety Report</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setShowReportForm(false); setNewReportCoords(null); }} 
                      className="p-1 h-auto text-amber-700 hover:bg-amber-50"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {newReportCoords ? (
                    <p className="text-sm text-stone-600">
                      Reporting for: Lat: {newReportCoords.lat.toFixed(4)}, Lng: {newReportCoords.lng.toFixed(4)}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      Please click on the map to select a location.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="report-type" className="text-stone-700">Report Type</Label>
                      <Select 
                        value={reportType} 
                        onValueChange={handleReportTypeChange} 
                        disabled={reportLoading}
                        name="report-type"
                      >
                        <SelectTrigger 
                          className="border-amber-200 focus-visible:ring-amber-500 w-full"
                          id="report-type"
                          aria-label="Select report type"
                        >
                          <SelectValue placeholder="Select report type" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[1002] min-w-[200px]">
                          <SelectItem value="pickpocketing">Pickpocketing</SelectItem>
                          <SelectItem value="scam">Scam</SelectItem>
                          <SelectItem value="harassment">Harassment</SelectItem>
                          <SelectItem value="health">Health/Safety Concern</SelectItem>
                          <SelectItem value="transportation">Transportation Issue</SelectItem>
                          <SelectItem value="safe_locker">Safe Locker Info</SelectItem>
                          <SelectItem value="tip">General Safety Tip</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="report-description" className="text-stone-700">Description</Label>
                      <Textarea
                        id="report-description"
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        placeholder="Describe the incident or tip..."
                        className="border-amber-200 focus-visible:ring-amber-500 h-[80px]" 
                        required
                        disabled={reportLoading}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={reportLoading || !reportDescription.trim() || !newReportCoords || !username || !reportType}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {reportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Report
                  </Button>
                </form>
              </motion.div>
            )}

            <CardFooter className="bg-amber-50 border-t border-amber-100 p-4">
              <div className="flex items-center text-sm text-amber-800">
                <Info className="h-4 w-4 mr-2 text-amber-600" />
                Click on the map to add a safety report. Your contributions help keep fellow travelers safe.
              </div>
            </CardFooter>
          </Card>

          {/* Feature Recommendations Section */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Recommended Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border border-amber-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-amber-100 p-3 rounded-full mb-4">
                      <MessageSquareWarning className="h-6 w-6 text-amber-700" />
                    </div>
                    <h3 className="font-medium text-stone-800 mb-2">Ask AI Assistant</h3>
                    <p className="text-stone-600 text-sm mb-4">Get personalized safety tips for any destination from our AI travel assistant.</p>
                    <Link href="/chatbot">
                      <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                        Chat Now
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-amber-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-amber-100 p-3 rounded-full mb-4">
                      <BarChart2 className="h-6 w-6 text-amber-700" />
                    </div>
                    <h3 className="font-medium text-stone-800 mb-2">Safety Analysis</h3>
                    <p className="text-stone-600 text-sm mb-4">View detailed safety statistics and trends for popular destinations.</p>
                    <Link href="/safety/analysis">
                      <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                        View Analysis
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-amber-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-amber-100 p-3 rounded-full mb-4">
                      <Map className="h-6 w-6 text-amber-700" />
                    </div>
                    <h3 className="font-medium text-stone-800 mb-2">Offline Maps</h3>
                    <p className="text-stone-600 text-sm mb-4">Download safety maps for offline use during your travels.</p>
                    <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
