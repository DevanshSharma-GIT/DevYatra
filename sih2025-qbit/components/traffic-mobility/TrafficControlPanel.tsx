"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertTriangle, 
  Shield, 
  Phone, 
  Radio, 
  Activity,
  Navigation,
  Route,
  MapPin,
  Clock,
  Truck,
  Car,
  Users,
  Settings,
  Eye,
  Send,
  RefreshCw
} from "lucide-react"
import { TrafficData, useTrafficMobilityService } from "@/services/trafficMobilityService"

interface TrafficControlPanelProps {
  showAuthorityPanel?: boolean;
  compact?: boolean;
  userRole?: 'public' | 'authority' | 'admin';
}

export default function TrafficControlPanel({ 
  showAuthorityPanel = true, 
  compact = false,
  userRole = 'public'
}: TrafficControlPanelProps) {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("alerts")
  const [reportForm, setReportForm] = useState({
    type: '',
    description: '',
    severity: 'medium',
    location: ''
  })
  const [submittingReport, setSubmittingReport] = useState(false)
  const [coordinationMessage, setCoordinationMessage] = useState('')
  const [contactingAuthority, setContactingAuthority] = useState<string | null>(null)
  
  const { getTrafficData, reportTrafficIncident, contactAuthority } = useTrafficMobilityService()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getTrafficData()
        setTrafficData(data)
      } catch (error) {
        console.error('Error fetching traffic data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Set up real-time updates
    const interval = setInterval(fetchData, 20000) // Update every 20 seconds
    
    return () => clearInterval(interval)
  }, [getTrafficData])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-800 border-red-200"
      case "high": return "bg-red-100 text-red-800 border-red-200"
      case "medium": return "bg-orange-100 text-orange-800 border-orange-200"
      case "low": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "closure": return <Route className="h-4 w-4" />
      case "congestion": return <Activity className="h-4 w-4" />
      case "accident": return <AlertTriangle className="h-4 w-4" />
      case "weather": return <Eye className="h-4 w-4" />
      case "event": return <Users className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getRoadStatusColor = (status: string) => {
    switch (status) {
      case "normal": return "bg-green-100 text-green-800 border-green-200"
      case "slow": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "heavy": return "bg-orange-100 text-orange-800 border-orange-200"
      case "closed": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingReport(true)
    
    try {
      const result = await reportTrafficIncident({
        type: reportForm.type,
        location: { lat: 28.6139, lng: 77.2090 }, // Mock coordinates
        description: reportForm.description,
        severity: reportForm.severity
      })
      
      if (result.success) {
        // Reset form
        setReportForm({ type: '', description: '', severity: 'medium', location: '' })
        // Show success message (in a real app, use toast notification)
        console.log('Report submitted successfully')
      }
    } catch (error) {
      console.error('Error submitting report:', error)
    } finally {
      setSubmittingReport(false)
    }
  }

  const handleContactAuthority = async (authorityType: 'police' | 'traffic' | 'emergency') => {
    setContactingAuthority(authorityType)
    
    try {
      const result = await contactAuthority(authorityType, coordinationMessage)
      if (result.success) {
        setCoordinationMessage('')
        console.log('Authority contacted successfully')
      }
    } catch (error) {
      console.error('Error contacting authority:', error)
    } finally {
      setContactingAuthority(null)
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading traffic control data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!trafficData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Unable to load traffic control data. Please try again later.
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
    <div className="space-y-6">
      {/* System Status Bar */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card className={`${trafficData.coordinationStatus.policeActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Police Unit</p>
                  <p className="text-xs text-gray-600">
                    {trafficData.coordinationStatus.policeActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <Shield className={`h-6 w-6 ${trafficData.coordinationStatus.policeActive ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className={`${trafficData.coordinationStatus.trafficCenterOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Traffic Center</p>
                  <p className="text-xs text-gray-600">
                    {trafficData.coordinationStatus.trafficCenterOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                <Activity className={`h-6 w-6 ${trafficData.coordinationStatus.trafficCenterOnline ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className={`${trafficData.coordinationStatus.emergencyServicesAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Emergency Services</p>
                  <p className="text-xs text-gray-600">
                    {trafficData.coordinationStatus.emergencyServicesAvailable ? 'Available' : 'Unavailable'}
                  </p>
                </div>
                <AlertTriangle className={`h-6 w-6 ${trafficData.coordinationStatus.emergencyServicesAvailable ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Last Update</p>
                  <p className="text-xs text-gray-600">
                    {trafficData.coordinationStatus.lastCoordinationUpdate.toLocaleTimeString()}
                  </p>
                </div>
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Control Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm border border-red-200 rounded-lg mb-6">
          <TabsTrigger
            value="alerts"
            className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger
            value="roads"
            className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
          >
            <Route className="h-4 w-4 mr-2" />
            Roads
          </TabsTrigger>
          <TabsTrigger
            value="diversions"
            className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Diversions
          </TabsTrigger>
          {showAuthorityPanel && (
            <TabsTrigger
              value="coordination"
              className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
            >
              <Shield className="h-4 w-4 mr-2" />
              Coordination
            </TabsTrigger>
          )}
        </TabsList>

        {/* Traffic Alerts */}
        <TabsContent value="alerts" className="mt-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Active Alerts */}
            <div className="grid gap-4">
              {trafficData.alerts.map((alert) => (
                <motion.div key={alert.id} variants={itemVariants}>
                  <Card className={`border-l-4 ${
                    alert.severity === 'critical' || alert.severity === 'high' ? 'border-l-red-500' :
                    alert.severity === 'medium' ? 'border-l-orange-500' : 'border-l-yellow-500'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getAlertIcon(alert.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">{alert.title}</h4>
                            <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                          </div>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <p className="font-medium text-gray-700 capitalize">{alert.type}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Duration:</span>
                          <p className="font-medium text-gray-700">{alert.duration}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Reported:</span>
                          <p className="font-medium text-gray-700">{alert.timestamp.toLocaleTimeString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Location:</span>
                          <p className="font-medium text-gray-700">
                            {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>

                      {/* Affected Routes */}
                      <div className="mb-3">
                        <span className="text-sm text-gray-500">Affected Routes:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.affectedRoutes.map((route, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {route}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Alternative Routes */}
                      {alert.alternativeRoutes && alert.alternativeRoutes.length > 0 && (
                        <div className="mb-3">
                          <span className="text-sm text-gray-500">Alternative Routes:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {alert.alternativeRoutes.map((route, index) => (
                              <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                                {route}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          View on Map
                        </Button>
                        {userRole === 'authority' && (
                          <>
                            <Button size="sm" variant="outline">
                              <Settings className="h-3 w-3 mr-1" />
                              Update
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Report New Incident */}
            {userRole !== 'public' && (
              <motion.div variants={itemVariants}>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-800">
                      <Send className="h-5 w-5 text-yellow-600" />
                      Report New Incident
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleReportSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Incident Type</label>
                          <select 
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                            value={reportForm.type}
                            onChange={(e) => setReportForm({...reportForm, type: e.target.value})}
                            required
                          >
                            <option value="">Select type</option>
                            <option value="accident">Accident</option>
                            <option value="closure">Road Closure</option>
                            <option value="congestion">Heavy Traffic</option>
                            <option value="weather">Weather Issue</option>
                            <option value="event">Special Event</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Severity</label>
                          <select 
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                            value={reportForm.severity}
                            onChange={(e) => setReportForm({...reportForm, severity: e.target.value})}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700">Location</label>
                        <Input
                          placeholder="Enter location or landmark"
                          value={reportForm.location}
                          onChange={(e) => setReportForm({...reportForm, location: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <Textarea
                          placeholder="Describe the incident in detail..."
                          value={reportForm.description}
                          onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                          required
                        />
                      </div>
                      
                      <Button type="submit" disabled={submittingReport} className="w-full">
                        {submittingReport ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Report
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </TabsContent>

        {/* Road Conditions */}
        <TabsContent value="roads" className="mt-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {Object.entries(trafficData.roadConditions).map(([road, condition]) => (
              <motion.div key={road} variants={itemVariants}>
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">{road}</h4>
                      <Badge className={getRoadStatusColor(condition.status)}>
                        {condition.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    {condition.reason && (
                      <p className="text-sm text-gray-600 mb-2">{condition.reason}</p>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      {condition.duration && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Duration:</span>
                          <span className="font-medium">{condition.duration}</span>
                        </div>
                      )}
                      
                      {condition.trafficDensity !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Traffic Density:</span>
                          <span className="font-medium">{condition.trafficDensity}%</span>
                        </div>
                      )}
                      
                      {condition.averageSpeed !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Avg Speed:</span>
                          <span className="font-medium">{condition.averageSpeed} km/h</span>
                        </div>
                      )}
                    </div>
                    
                    {condition.status !== 'normal' && (
                      <Button size="sm" variant="outline" className="w-full mt-3">
                        <Navigation className="h-3 w-3 mr-1" />
                        Find Alternative
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Route Diversions */}
        <TabsContent value="diversions" className="mt-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {trafficData.diversions.map((diversion) => (
              <motion.div key={diversion.id} variants={itemVariants}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800">{diversion.title}</h4>
                      <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-500">Original Route:</span>
                        <p className="font-medium text-gray-700 mt-1">{diversion.originalRoute}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Alternative Route:</span>
                        <p className="font-medium text-green-700 mt-1">{diversion.alternativeRoute}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Additional Time:</span>
                        <p className="font-medium text-orange-700">{diversion.additionalTime}</p>
                      </div>
                      {diversion.savings?.time && (
                        <div>
                          <span className="text-gray-500">Time Saved:</span>
                          <p className="font-medium text-green-700">{diversion.savings.time}</p>
                        </div>
                      )}
                      {diversion.savings?.fuel && (
                        <div>
                          <span className="text-gray-500">Fuel Saved:</span>
                          <p className="font-medium text-green-700">{diversion.savings.fuel}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg mb-4">
                      <span className="text-sm text-gray-500">Reason:</span>
                      <p className="text-sm text-gray-700 mt-1">{diversion.reason}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Navigation className="h-3 w-3 mr-1" />
                        Use This Route
                      </Button>
                      <Button size="sm" variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        View on Map
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Authority Coordination */}
        {showAuthorityPanel && (
          <TabsContent value="coordination" className="mt-6">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Quick Contact */}
              <motion.div variants={itemVariants}>
                <Card className="bg-red-50 border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <Phone className="h-5 w-5 text-red-600" />
                      Emergency Coordination
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button 
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={contactingAuthority === 'police'}
                        onClick={() => handleContactAuthority('police')}
                      >
                        {contactingAuthority === 'police' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Shield className="h-4 w-4 mr-2" />
                        )}
                        Contact Police
                      </Button>
                      
                      <Button 
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={contactingAuthority === 'traffic'}
                        onClick={() => handleContactAuthority('traffic')}
                      >
                        {contactingAuthority === 'traffic' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Activity className="h-4 w-4 mr-2" />
                        )}
                        Traffic Control
                      </Button>
                      
                      <Button 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={contactingAuthority === 'emergency'}
                        onClick={() => handleContactAuthority('emergency')}
                      >
                        {contactingAuthority === 'emergency' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                          <AlertTriangle className="h-4 w-4 mr-2" />
                        )}
                        Emergency Services
                      </Button>
                    </div>
                    
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700">Coordination Message (Optional)</label>
                      <Textarea
                        placeholder="Additional details for coordination..."
                        value={coordinationMessage}
                        onChange={(e) => setCoordinationMessage(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Emergency Contacts */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-gray-600" />
                      Emergency Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trafficData.emergencyContacts.map((contact, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-800">{contact.name}</h5>
                              <p className="text-sm text-gray-600 capitalize">{contact.type}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-lg text-gray-800">{contact.number}</p>
                              <Button size="sm" variant="outline" className="mt-1">
                                <Phone className="h-3 w-3 mr-1" />
                                Call
                              </Button>
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
        )}
      </Tabs>
    </div>
  )
}
