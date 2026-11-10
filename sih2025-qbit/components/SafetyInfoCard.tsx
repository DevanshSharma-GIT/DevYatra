"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, AlertTriangle, Info, MapPin, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface SafetyInfoCardProps {
  location: string
  safetyScore?: number
  safetyInfo?: string
  incidentCount?: number
}

export default function SafetyInfoCard({
  location,
  safetyScore = 3,
  safetyInfo = "",
  incidentCount = 0,
}: SafetyInfoCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)

  // Determine safety level based on score
  const getSafetyLevel = () => {
    if (safetyScore >= 4) return { level: "High", color: "bg-green-100 text-green-800 border-green-200" }
    if (safetyScore >= 3) return { level: "Medium", color: "bg-amber-100 text-amber-800 border-amber-200" }
    return { level: "Low", color: "bg-red-100 text-red-800 border-red-200" }
  }

  const safetyLevel = getSafetyLevel()

  return (
    <Card className="bg-gradient-to-r from-amber-600 to-amber-700 border-0 text-white mt-4 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Safety Information
        </CardTitle>
        <CardDescription className="text-white/70 flex items-center">
          <MapPin className="h-3 w-3 mr-1" />
          {location}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={safetyLevel.color}>Safety Level: {safetyLevel.level}</Badge>
              <span className="text-sm">Score: {safetyScore}/5</span>
            </div>
            {incidentCount > 0 && (
              <Badge variant="outline" className="border-white/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {incidentCount} recent {incidentCount === 1 ? "incident" : "incidents"}
              </Badge>
            )}
          </div>

          {expanded && safetyInfo && (
            <div className="text-sm bg-white/10 p-3 rounded-md mt-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>{safetyInfo}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            {safetyInfo && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white p-0 h-auto"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show less" : "Show more"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/20"
              onClick={() => router.push("/safety")}
            >
              View Safety Map
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
