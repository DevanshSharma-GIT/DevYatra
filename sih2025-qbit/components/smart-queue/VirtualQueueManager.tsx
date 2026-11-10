"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  Users,
  Clock,
  Activity,
  RefreshCw,
  Smartphone,
  Zap,
  AlertCircle,
  CheckCircle,
  Bell,
} from "lucide-react"
import { QueueInfo, UserQueueTicket } from "@/services/smartQueueService"

interface VirtualQueueManagerProps {
  queues: QueueInfo[]
  userTickets: UserQueueTicket[]
  loading: boolean
  onJoinQueue: (queueId: string, userData: { name: string; phoneNumber?: string }) => Promise<{ success: boolean; message: string }>
  onLeaveQueue: (ticketId: string) => Promise<{ success: boolean; message: string }>
  onRefresh: () => Promise<void>
  refreshing: boolean
}

export function VirtualQueueManager({
  queues,
  userTickets,
  loading,
  onJoinQueue,
  onLeaveQueue,
  onRefresh,
  refreshing,
}: VirtualQueueManagerProps) {
  const [selectedQueue, setSelectedQueue] = useState("")
  const [pilgrimName, setPilgrimName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [joiningQueue, setJoiningQueue] = useState(false)

  const getQueueStatusColor = (type: string) => {
    switch (type) {
      case "general": return "bg-blue-100 text-blue-800 border-blue-200"
      case "priority": return "bg-purple-100 text-purple-800 border-purple-200"
      case "special": return "bg-amber-100 text-amber-800 border-amber-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getLoadColor = (load: number) => {
    if (load >= 80) return "text-red-600"
    if (load >= 60) return "text-amber-600"
    return "text-green-600"
  }

  const handleJoinQueue = async () => {
    if (!selectedQueue || !pilgrimName) return

    setJoiningQueue(true)
    try {
      const result = await onJoinQueue(selectedQueue, {
        name: pilgrimName,
        phoneNumber: phoneNumber || undefined,
      })
      
      if (result.success) {
        setSelectedQueue("")
        setPilgrimName("")
        setPhoneNumber("")
      }
    } finally {
      setJoiningQueue(false)
    }
  }

  const calculateQueueLoad = (queue: QueueInfo) => {
    return Math.round((queue.totalInQueue / queue.capacity) * 100)
  }

  const getWaitTimeColor = (minutes: number) => {
    if (minutes <= 15) return "text-green-600"
    if (minutes <= 30) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Queue Status Cards */}
      <div className="lg:col-span-2">
        <Card className="shadow-sm border border-indigo-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1"></div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-800">
                <Activity className="h-5 w-5 text-indigo-600" />
                Live Queue Status
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No active queues available</p>
                </div>
              ) : (
                queues.map((queue) => {
                  const queueLoad = calculateQueueLoad(queue)
                  const userInThisQueue = userTickets.find(t => t.queueId === queue.id && (t.status === 'waiting' || t.status === 'ready'))
                  
                  return (
                    <motion.div
                      key={queue.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                            {queue.name}
                            {userInThisQueue && (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Joined
                              </Badge>
                            )}
                          </h4>
                          <p className="text-sm text-slate-600">
                            Serving: #{queue.currentServing} | Avg: {queue.avgProcessingTime} min per person
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getQueueStatusColor(queue.type)}>
                            {queue.type.charAt(0).toUpperCase() + queue.type.slice(1)}
                          </Badge>
                          {queue.pricePerEntry && queue.pricePerEntry > 0 && (
                            <p className="text-sm font-medium text-slate-800 mt-1">
                              ₹{queue.pricePerEntry}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-slate-500">In Queue:</span>
                          <p className="font-medium text-slate-800">{queue.totalInQueue}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Wait Time:</span>
                          <p className={`font-medium ${getWaitTimeColor(queue.estimatedWaitTime)}`}>
                            {queue.estimatedWaitTime} min
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Capacity:</span>
                          <p className="font-medium text-slate-800">{queue.capacity}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Queue Load:</span>
                          <span className={`font-medium ${getLoadColor(queueLoad)}`}>
                            {queueLoad}%
                          </span>
                        </div>
                        <Progress 
                          value={queueLoad} 
                          className="h-2"
                        />
                      </div>

                      {queue.description && (
                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                          <p className="text-xs text-gray-600">{queue.description}</p>
                        </div>
                      )}

                      {userInThisQueue && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-800">
                                Your Position: #{userInThisQueue.position}
                              </p>
                              <p className="text-xs text-green-700">
                                Estimated wait: {userInThisQueue.estimatedTime} minutes
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onLeaveQueue(userInThisQueue.id)}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Leave Queue
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Join Queue Form */}
      <div>
        <Card className="shadow-sm border border-green-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 h-1"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800">
              <Smartphone className="h-5 w-5 text-green-600" />
              Join Virtual Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Pilgrim Name *</label>
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
                placeholder="For SMS notifications"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional but recommended for queue updates
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Select Queue *</label>
              <select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">Choose a queue</option>
                {queues
                  .filter(q => q.status === 'active')
                  .filter(q => !userTickets.find(t => t.queueId === q.id && (t.status === 'waiting' || t.status === 'ready')))
                  .map((queue) => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name} - {queue.estimatedWaitTime} min wait
                    {queue.pricePerEntry && queue.pricePerEntry > 0 && ` (₹${queue.pricePerEntry})`}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleJoinQueue}
              disabled={joiningQueue || loading || !selectedQueue || !pilgrimName}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {joiningQueue ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Joining Queue...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Join Virtual Queue
                </>
              )}
            </Button>

            {selectedQueue && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Smart Queue Benefits</p>
                    <ul className="text-xs text-blue-700 mt-1 space-y-1">
                      <li>• Real-time position updates</li>
                      <li>• SMS & push notifications</li>
                      <li>• No physical waiting required</li>
                      <li>• Offline ticket access</li>
                      <li>• Join from anywhere on premises</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Active Tickets Summary */}
            {userTickets.filter(t => t.type === 'queue' && (t.status === 'waiting' || t.status === 'ready')).length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Your Active Queue Tickets</h4>
                <div className="space-y-2">
                  {userTickets
                    .filter(t => t.type === 'queue' && (t.status === 'waiting' || t.status === 'ready'))
                    .map((ticket) => (
                    <div key={ticket.id} className="p-2 bg-amber-50 rounded border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-800">{ticket.queueName}</p>
                          <p className="text-xs text-amber-700">
                            Position: #{ticket.position} | {ticket.estimatedTime} min
                          </p>
                        </div>
                        {ticket.status === 'ready' && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <Bell className="h-3 w-3 mr-1" />
                            Ready!
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Important Notes</p>
                  <ul className="text-xs text-amber-700 mt-1 space-y-1">
                    <li>• Arrive at the gate when your turn is ready</li>
                    <li>• Keep your digital pass ready for scanning</li>
                    <li>• You can join only one queue at a time</li>
                    <li>• Queue positions update every 30 seconds</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default VirtualQueueManager
