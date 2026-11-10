"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, Award, Star, Users, Target, Zap } from "lucide-react"
import { UserProgress, LeaderboardEntry, GamificationBadge } from "@/services/pilgrimEngagementService"

interface GamificationPanelProps {
  userId?: string;
  onBadgeEarned?: (badge: GamificationBadge) => void;
}

export default function GamificationPanel({ userId = "user123", onBadgeEarned }: GamificationPanelProps) {
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      const mockProgress: UserProgress = {
        userId,
        totalPoints: 1250,
        currentLevel: "Devoted Pilgrim",
        levelProgress: 75,
        badges: [
          { id: "queue-champion", name: "Queue Champion", description: "Waited patiently for 3+ hours", icon: "⏰", earned: true, earnedDate: "2024-01-15", points: 100, category: "queue" },
          { id: "eco-warrior", name: "Eco Warrior", description: "Used eco-friendly practices 5 times", icon: "🌱", earned: true, earnedDate: "2024-01-20", points: 150, category: "eco" },
          { id: "temple-explorer", name: "Temple Explorer", description: "Visited all major areas", icon: "🗺️", earned: false, points: 200, category: "exploration" },
          { id: "community-helper", name: "Community Helper", description: "Helped 3+ fellow pilgrims", icon: "🤝", earned: false, points: 300, category: "community" },
          { id: "safety-guardian", name: "Safety Guardian", description: "Reported safety concerns", icon: "🛡️", earned: false, points: 250, category: "safety" }
        ],
        achievements: ["First Visit", "Queue Patience", "Eco-Friendly"],
        lastActivity: new Date().toISOString()
      }

      const mockLeaderboard: LeaderboardEntry[] = [
        { userId: "user1", name: "Priya Sharma", group: "Mumbai Group", points: 2100, rank: 1 },
        { userId: "user2", name: "Rajesh Kumar", group: "Delhi Group", points: 1950, rank: 2 },
        { userId: "user3", name: "Anita Patel", group: "Gujarat Group", points: 1800, rank: 3 },
        { userId: "user4", name: "Suresh Singh", group: "Punjab Group", points: 1650, rank: 4 },
        { userId: "user5", name: "Meera Reddy", group: "Andhra Group", points: 1500, rank: 5 }
      ]

      setUserProgress(mockProgress)
      setLeaderboard(mockLeaderboard)
      setLoading(false)
    }, 1000)
  }, [userId])

  const getLevelColor = (level: string) => {
    if (level.includes("Novice")) return "text-green-600"
    if (level.includes("Devoted")) return "text-amber-600"
    if (level.includes("Master")) return "text-purple-600"
    return "text-stone-600"
  }

  const getBadgeIcon = (icon: string) => {
    return <span className="text-lg">{icon}</span>
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'queue': return 'bg-blue-100 text-blue-800'
      case 'eco': return 'bg-green-100 text-green-800'
      case 'community': return 'bg-purple-100 text-purple-800'
      case 'exploration': return 'bg-orange-100 text-orange-800'
      case 'safety': return 'bg-red-100 text-red-800'
      default: return 'bg-stone-100 text-stone-800'
    }
  }

  if (loading) {
    return (
      <Card className="shadow-sm border border-amber-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
            <span className="ml-2 text-amber-600">Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!userProgress) return null

  return (
    <div className="space-y-6">
      {/* User Progress Card */}
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
            {/* Points and Level */}
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center">
              <div className="text-3xl font-bold text-amber-800 mb-1">
                {userProgress.totalPoints.toLocaleString()}
              </div>
              <div className="text-sm text-amber-600 mb-2">Total Points</div>
              <Badge className={`bg-amber-200 text-amber-800 ${getLevelColor(userProgress.currentLevel)}`}>
                {userProgress.currentLevel}
              </Badge>
            </div>

            {/* Level Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Level Progress</span>
                <span className="text-stone-800 font-medium">{userProgress.levelProgress}%</span>
              </div>
              <Progress value={userProgress.levelProgress} className="h-2" />
              <div className="text-xs text-stone-500 text-center">
                {100 - userProgress.levelProgress}% to next level
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-stone-700">Recent Achievements</div>
              <div className="flex flex-wrap gap-2">
                {userProgress.achievements.map((achievement, index) => (
                  <Badge key={index} className="bg-green-100 text-green-800">
                    <Star className="h-3 w-3 mr-1" />
                    {achievement}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges Card */}
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
            {userProgress.badges.map((badge) => (
              <motion.div
                key={badge.id}
                whileHover={{ scale: 1.02 }}
                className={`p-3 rounded-lg border transition-all ${
                  badge.earned
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    badge.earned ? 'bg-purple-500' : 'bg-stone-300'
                  }`}>
                    {getBadgeIcon(badge.icon)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${
                        badge.earned ? 'text-purple-800' : 'text-stone-500'
                      }`}>
                        {badge.name}
                      </span>
                      <Badge className={getCategoryColor(badge.category)}>
                        {badge.category}
                      </Badge>
                    </div>
                    <div className={`text-xs ${
                      badge.earned ? 'text-purple-600' : 'text-stone-400'
                    }`}>
                      {badge.description}
                    </div>
                    {badge.earned && badge.earnedDate && (
                      <div className="text-xs text-purple-500 mt-1">
                        Earned: {new Date(badge.earnedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      badge.earned ? 'text-purple-800' : 'text-stone-400'
                    }`}>
                      +{badge.points}
                    </div>
                    <div className="text-xs text-stone-500">points</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Card */}
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
            {leaderboard.map((person, index) => (
              <motion.div
                key={person.userId}
                whileHover={{ x: 4 }}
                className="flex items-center justify-between p-3 bg-emerald-50 rounded-md border border-emerald-100"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-stone-400' : 
                    index === 2 ? 'bg-amber-600' :
                    'bg-emerald-500'
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
                  <div className="font-bold text-emerald-800">{person.points.toLocaleString()}</div>
                  <div className="text-xs text-emerald-600">points</div>
                </div>
              </motion.div>
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
    </div>
  )
}
