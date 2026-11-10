import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-amber-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto mb-4" />
        <p className="text-amber-800 font-medium">Loading Pilgrim Engagement Platform...</p>
        <p className="text-amber-600 text-sm mt-2">Preparing your sacred journey companion</p>
      </div>
    </div>
  )
}
