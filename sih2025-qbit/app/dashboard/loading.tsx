import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
        <h2 className="text-xl font-medium text-white">Loading your HeritEdge dashboard...</h2>
        <p className="text-white/80 mt-2">Preparing your personalized cultural experience</p>
      </div>
    </div>
  )
}