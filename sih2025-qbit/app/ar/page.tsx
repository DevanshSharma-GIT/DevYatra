"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Landmark, ArrowLeft, Loader2, Languages } from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/navbar"
import { useToast } from "@/hooks/use-toast"

export default function ARGuidePage() {
  const [cameraActive, setCameraActive] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [language, setLanguage] = useState("en-IN")
  const [result, setResult] = useState<{
    object_name: string
    info: string
    audio_url?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()
  
  // Helper function to get API URL
  const getApiUrl = (path: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    // Remove any trailing slashes from baseUrl
    const cleanBase = baseUrl.replace(/\/+$/, '')
    // Ensure path doesn't start with slash
    const cleanPath = path.startsWith('/') ? path.substring(1) : path
    return `${cleanBase}/api/${cleanPath}`
  }
  
  // Start camera
  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Could not access camera. Please ensure you have granted camera permissions.')
      toast({
        title: "Camera Error",
        description: "Could not access your camera. Please check permissions.",
        variant: "destructive"
      })
    }
  }
  
  // Capture image
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return
    
    try {
      setAnalyzing(true)
      setError(null)
      setResult(null)
      
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert canvas to data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        // Send to backend
        const response = await fetch(getApiUrl('process_tap'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: imageDataUrl,
            language: language
          })
        })
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }
        
        const data = await response.json()
        setResult(data)
      }
    } catch (err) {
      console.error('Error capturing or analyzing image:', err)
      setError('Error analyzing image. Please try again.')
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the image. Please try again.",
        variant: "destructive"
      })
    } finally {
      setAnalyzing(false)
    }
  }
  
  // Clean up camera on unmount
  useEffect(() => {
    const videoElement = videoRef.current
    return () => {
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-2xl text-primary">
                  <Landmark className="mr-2 h-6 w-6" />
                  AR Monument Guide
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center mb-4">
                    <Languages className="mr-2 h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium mr-3">Language:</span>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-IN">English (India)</SelectItem>
                        <SelectItem value="hi-IN">Hindi</SelectItem>
                        <SelectItem value="ta-IN">Tamil</SelectItem>
                        <SelectItem value="te-IN">Telugu</SelectItem>
                        <SelectItem value="kn-IN">Kannada</SelectItem>
                        <SelectItem value="ml-IN">Malayalam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: "60vh" }}>
                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <Camera className="h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg opacity-70 mb-4">Camera preview will appear here</p>
                        <Button onClick={startCamera} className="bg-primary hover:bg-primary/90">
                          <Camera className="mr-2 h-4 w-4" /> Start Camera
                        </Button>
                      </div>
                    )}
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
                      {error}
                    </div>
                  )}
                  
                  {cameraActive && (
                    <div className="mt-4 flex justify-center">
                      <Button 
                        onClick={captureImage} 
                        disabled={analyzing}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
                          </>
                        ) : (
                          <>
                            <Camera className="mr-2 h-4 w-4" /> Identify Monument
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-white border rounded-lg shadow-sm"
                  >
                    <h2 className="text-xl font-semibold text-primary mb-2">{result.object_name}</h2>
                    <p className="text-gray-700 mb-4">{result.info}</p>
                    
                    {result.audio_url && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Listen to audio description:</p>
                        <audio controls className="w-full" src={result.audio_url} />
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
              
              <CardFooter className="flex flex-col items-start">
                <p className="text-sm text-muted-foreground">
                  Point your camera at historical monuments and landmarks to get information about them.
                </p>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}