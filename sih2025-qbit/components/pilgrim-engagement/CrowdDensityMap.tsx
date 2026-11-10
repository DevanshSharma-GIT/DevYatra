"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, MapPin } from "lucide-react"
import { CrowdDensityData } from "@/services/pilgrimEngagementService"

interface CrowdDensityMapProps {
  data?: CrowdDensityData[];
  onAreaClick?: (area: string) => void;
}

export default function CrowdDensityMap({ data, onAreaClick }: CrowdDensityMapProps) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  // Mock data if none provided
  const crowdData: CrowdDensityData[] = data || [
    { area: "Main Shrine", density: "Medium", lastUpdated: new Date().toISOString(), estimatedWaitTime: "30 min" },
    { area: "Queue Area", density: "High", lastUpdated: new Date().toISOString(), estimatedWaitTime: "45 min" },
    { area: "Rest Area", density: "Low", lastUpdated: new Date().toISOString() },
    { area: "Parking", density: "Medium", lastUpdated: new Date().toISOString() },
    { area: "Food Court", density: "Low", lastUpdated: new Date().toISOString() }
  ]

  const getDensityColor = (density: string) => {
    switch (density.toLowerCase()) {
      case 'low': return 'bg-green-500'
      case 'medium': return 'bg-yellow-500'
      case 'high': return 'bg-red-500'
      default: return 'bg-stone-500'
    }
  }

  const getDensityBadgeColor = (density: string) => {
    switch (density.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-red-100 text-red-800'
      default: return 'bg-stone-100 text-stone-800'
    }
  }

  const handleAreaClick = (area: string) => {
    setSelectedArea(selectedArea === area ? null : area)
    onAreaClick?.(area)
  }

  return (
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
          {/* Legend */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-green-100 p-2 rounded text-green-800 text-center">Low</div>
              <div className="bg-yellow-100 p-2 rounded text-yellow-800 text-center">Medium</div>
              <div className="bg-red-100 p-2 rounded text-red-800 text-center">High</div>
            </div>
          </div>

          {/* Mock Heatmap Visualization */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-blue-800 mb-2">Live Heatmap</div>
              <div className="text-sm text-blue-600">
                Real-time crowd density visualization
              </div>
            </div>
            
            {/* Simple grid representation of temple areas */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {crowdData.slice(0, 6).map((area, index) => (
                <motion.div
                  key={area.area}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAreaClick(area.area)}
                  className={`h-12 rounded cursor-pointer flex items-center justify-center text-white text-xs font-medium ${
                    getDensityColor(area.density)
                  } ${selectedArea === area.area ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {index + 1}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Area Details */}
          <div className="space-y-2">
            {crowdData.map((area) => (
              <motion.div
                key={area.area}
                whileHover={{ x: 4 }}
                onClick={() => handleAreaClick(area.area)}
                className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedArea === area.area 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-stone-50 border-stone-100 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getDensityColor(area.density)}`}></div>
                  <div>
                    <div className="font-medium text-stone-800">{area.area}</div>
                    {area.estimatedWaitTime && (
                      <div className="text-xs text-stone-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {area.estimatedWaitTime}
                      </div>
                    )}
                  </div>
                </div>
                <Badge className={getDensityBadgeColor(area.density)}>
                  {area.density}
                </Badge>
              </motion.div>
            ))}
          </div>

          {/* Selected Area Details */}
          {selectedArea && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 p-4 rounded-lg border border-blue-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">{selectedArea}</span>
              </div>
              <div className="text-sm text-blue-600">
                {selectedArea === 'Main Shrine' && 'Primary deity shrine with moderate crowd. Best time to visit is early morning.'}
                {selectedArea === 'Queue Area' && 'Main darshan queue with high crowd density. Expected wait time is 45 minutes.'}
                {selectedArea === 'Rest Area' && 'Quiet area with low crowd density. Perfect for taking a break.'}
                {selectedArea === 'Parking' && 'Vehicle parking area with moderate occupancy. Spaces available.'}
                {selectedArea === 'Food Court' && 'Dining area with low crowd. Good time to have meals.'}
              </div>
            </motion.div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-stone-500 text-center">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
