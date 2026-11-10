"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Landmark, ArrowLeft, Loader2, X, Volume2, AlertCircle, RefreshCw, FlipHorizontal } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function ARGuidePage() {
  const [cameraActive, setCameraActive] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [language, setLanguage] = useState("en-IN")
  const [result, setResult] = useState<{
    object_name: string
    info: string
    history?: string
    audio_base64?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment") // Default to back camera
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [isMounted, setIsMounted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentStreamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  // Set isMounted to true after component mounts to avoid SSR issues
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // Helper function to get API URL
  const getApiUrl = (path: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    const cleanBase = baseUrl.replace(/\/+$/, "")
    const cleanPath = path.startsWith("/") ? path.substring(1) : path
    return `${cleanBase}/${cleanPath}`
  }

  // Check for camera support and available devices
  const checkCameraSupport = useCallback(async () => {
    if (!isMounted) return

    try {
      // First check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("MediaDevices API not supported in this browser")
        setError("Camera API not supported in your browser. Please try a different browser.")
        return false
      }

      // Check for available video devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")
      setAvailableCameras(videoDevices)

      if (videoDevices.length === 0) {
        setError("No cameras detected on your device.")
        return false
      }

      console.log(`Found ${videoDevices.length} camera(s)`)
      return true
    } catch (err) {
      console.error("Error checking camera support:", err)
      setError("Could not check camera support. Please ensure you're using a modern browser.")
      return false
    }
  }, [isMounted])

  // Fallback camera mode with minimal constraints
  const tryFallbackCamera = useCallback(async () => {
    if (!isMounted) return

    try {
      console.log("Trying fallback camera mode with minimal constraints")

      // Stop any existing stream
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop())
        currentStreamRef.current = null
      }

      // Use minimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      currentStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch((e) => console.error("Error playing video:", e))
        setCameraActive(true)
        setHasCameraPermission(true)

        // Log which camera we got
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          console.log("Fallback camera activated:", videoTrack.label)
        }
      }
    } catch (err) {
      console.error("Fallback camera also failed:", err)
      setError("Could not access camera even in fallback mode. Please check your device permissions.")
    }
  }, [isMounted])

  // Start camera with improved mobile support
  const startCamera = useCallback(async () => {
    if (!isMounted) return

    try {
      setError(null)
      setAudioError(null)

      // Check camera support first
      const isSupported = await checkCameraSupport()
      if (!isSupported) return

      // Stop any existing stream
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop())
        currentStreamRef.current = null
      }

      // Set up constraints with current facing mode
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      console.log(`Requesting camera with facing mode: ${facingMode}`)

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Store the stream for later cleanup
      currentStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch((e) => console.error("Error playing video:", e))
        setCameraActive(true)
        setHasCameraPermission(true)

        // Log active track settings for debugging
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          console.log("Active video track:", videoTrack.label)
          console.log("Track settings:", videoTrack.getSettings())
        }
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err)

      let errorMessage = "Could not access camera. "

      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage += "No camera found on your device."
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setHasCameraPermission(false)
        errorMessage += "Permission denied. Please enable camera access in your browser settings."
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage += "Your camera is in use by another application."
      } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        errorMessage += "Camera constraints cannot be satisfied. Trying fallback mode..."
        // Try again with basic constraints
        tryFallbackCamera()
        return
      } else {
        errorMessage += err.message || "Please check your device settings."
      }

      setError(errorMessage)
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      })
    }
  }, [checkCameraSupport, facingMode, isMounted, toast, tryFallbackCamera])

  // Switch between front and back cameras
  const switchCamera = async () => {
    if (!isMounted) return

    // Toggle facing mode
    const newFacingMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newFacingMode)

    // Restart camera with new facing mode
    if (cameraActive) {
      // Stop current stream first
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      try {
        const constraints = {
          video: {
            facingMode: newFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

        console.log(`Switching to camera mode: ${newFacingMode}`)
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        currentStreamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch((e) => console.error("Error playing video:", e))

          // Log which camera we switched to
          const videoTrack = stream.getVideoTracks()[0]
          if (videoTrack) {
            console.log("Switched to camera:", videoTrack.label)
            toast({
              title: "Camera Switched",
              description: newFacingMode === "user" ? "Using front camera" : "Using back camera",
              duration: 2000,
            })
          }
        }
      } catch (err: any) {
        console.error("Error switching camera:", err)
        setError(`Could not switch camera. ${(err as Error).message || "Please try again."}`)

        // Try to restore previous camera
        setFacingMode(facingMode)
        startCamera()
      }
    }
  }

  // Capture image
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !isMounted) return

    try {
      setAnalyzing(true)
      setError(null)
      setAudioError(null)
      setResult(null)

      // Stop any currently playing audio before starting new analysis
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext("2d")
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8)

        // Send to backend with the selected language
        const response = await fetch(getApiUrl("api/process_tap"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: imageDataUrl,
            language: language,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }))
          throw new Error(
            `Server error: ${response.status} - ${errorData.detail || errorData.error || "Failed to get error details"}`,
          )
        }

        const data = await response.json()
        setResult(data)

        if (data.audio_base64) {
          playAudio(data.audio_base64)
        }
      }
    } catch (err: any) {
      console.error("Error capturing or analyzing image:", err)
      setError(`Error analyzing image: ${err.message || "Please try again."}`)
      toast({
        title: "Analysis Failed",
        description: `Could not analyze the image. ${err.message || "Please try again."}`,
        variant: "destructive",
      })
      setTimeout(() => setError(null), 5000)
    } finally {
      setAnalyzing(false)
    }
  }

  // Function to play base64 audio
  const playAudio = (base64Audio: string) => {
    if (!isMounted) return

    setAudioError(null)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }
    try {
      const audioDataUrl = `data:audio/wav;base64,${base64Audio}`
      const audio = new Audio(audioDataUrl)
      currentAudioRef.current = audio

      audio
        .play()
        .then(() => {
          setIsAudioPlaying(true)
        })
        .catch((err) => {
          console.error("Error playing audio:", err)
          setAudioError("Could not play audio automatically. Browser settings might prevent autoplay.")
          toast({
            title: "Audio Playback Issue",
            description: "Audio couldn't play automatically. Your browser might require interaction first.",
            variant: "destructive",
          })
        })

      audio.onended = () => {
        currentAudioRef.current = null
        setIsAudioPlaying(false)
      }
      audio.onerror = () => {
        setAudioError("Error occurred during audio playback.")
        currentAudioRef.current = null
        setIsAudioPlaying(false)
      }
    } catch (e) {
      console.error("Failed to initialize audio:", e)
      setAudioError("Failed to load audio.")
    }
  }

  // Toggle play/pause
  const toggleAudio = () => {
    if (!currentAudioRef.current || !result?.audio_base64 || !isMounted) return

    if (isAudioPlaying) {
      currentAudioRef.current.pause()
      setIsAudioPlaying(false)
    } else {
      currentAudioRef.current
        .play()
        .then(() => setIsAudioPlaying(true))
        .catch((err) => {
          console.error("Error playing audio:", err)
          setAudioError("Could not play audio. Please try again.")
        })
    }
  }

  // Replay audio from beginning
  const replayAudio = () => {
    if (!currentAudioRef.current || !result?.audio_base64 || !isMounted) return

    currentAudioRef.current.currentTime = 0
    currentAudioRef.current
      .play()
      .then(() => setIsAudioPlaying(true))
      .catch((err) => {
        console.error("Error replaying audio:", err)
        setAudioError("Could not replay audio. Please try again.")
      })
  }

  // Check camera support on mount
  useEffect(() => {
    if (isMounted) {
      checkCameraSupport()
    }
    }, [checkCameraSupport, isMounted])

  // Clean up camera and audio on unmount
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop())
        currentStreamRef.current = null
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  // Add visibility change handler for mobile
  useEffect(() => {
    if (!isMounted) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && cameraActive) {
        // Check if camera stream is still active
        const isStreamActive =
          currentStreamRef.current &&
          currentStreamRef.current.getVideoTracks().some((track) => track.readyState === "live")

        if (!isStreamActive) {
          console.log("Camera stream lost, attempting to restart")
            startCamera()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
    }, [cameraActive, isMounted, startCamera]) 

  const customScrollbarStyle = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`

  // If not mounted yet (during SSR), return a minimal placeholder
  if (!isMounted) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading camera interface...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <style jsx>{`${customScrollbarStyle}`}</style>
      {/* Full-screen camera */}
      <div className="absolute inset-0 z-10">
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black">
            <Camera className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg opacity-70 mb-4">Camera preview will appear here</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${!cameraActive ? "hidden" : ""}`}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Permission Request UI for Mobile */}
      {!cameraActive && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md bg-black/85 backdrop-blur-md rounded-xl p-5 text-white pointer-events-auto border border-gray-800 shadow-lg z-30">
          <div className="flex items-start mb-4">
            <Camera className="h-6 w-6 mr-3 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-lg mb-1">Camera Access Required</h3>
              <p className="text-white/80 text-sm">
                This AR guide needs camera access to identify monuments. When prompted, please tap “Allow” to grant
                camera permission.
              </p>
            </div>
          </div>
          <div className="mt-2 p-3 bg-gray-800/50 rounded-lg text-sm">
            <p className="mb-2 text-white/90 font-medium">If camera doesn’t start:</p>
            <ul className="list-disc pl-5 text-white/80 space-y-1">
              <li>Check that your device has a camera</li>
              <li>Make sure no other app is using your camera</li>
              <li>Try refreshing the page</li>
              <li>Check browser settings to allow camera access</li>
            </ul>
          </div>
          <Button onClick={startCamera} className="w-full mt-4 bg-primary/90 hover:bg-primary text-white">
            <Camera className="mr-2 h-4 w-4" /> Request Camera Access
          </Button>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Header */}
        <div className="absolute top-0 left-0 w-full bg-black/60 p-4 flex items-center justify-between">
          <Link href="/dashboard" className="pointer-events-auto">
            <Button variant="ghost" size="icon" className="text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center">
            <Landmark className="mr-2 h-5 w-5" />
            AR Monument Guide
          </h1>
          <div className="pointer-events-auto">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[160px] bg-black/50 border-gray-700 text-white">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-IN">English (India)</SelectItem>
                <SelectItem value="hi-IN">Hindi (हिन्दी)</SelectItem>
                <SelectItem value="bn-IN">Bengali (বাংলা)</SelectItem>
                <SelectItem value="gu-IN">Gujarati (ગુજરાતી)</SelectItem>
                <SelectItem value="kn-IN">Kannada (ಕನ್ನಡ)</SelectItem>
                <SelectItem value="ml-IN">Malayalam (മലയാളം)</SelectItem>
                <SelectItem value="mr-IN">Marathi (मराठी)</SelectItem>
                <SelectItem value="od-IN">Odia (ଓଡ଼ିଆ)</SelectItem>
                <SelectItem value="pa-IN">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
                <SelectItem value="ta-IN">Tamil (தமிழ்)</SelectItem>
                <SelectItem value="te-IN">Telugu (తెలుగు)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Camera Controls */}
        <div className="absolute bottom-8 left-0 w-full flex flex-col items-center gap-4 pointer-events-auto">
          {/* Camera Switch Button - Only show when camera is active */}
          {cameraActive && availableCameras.length > 1 && (
            <Button
              onClick={switchCamera}
              variant="outline"
              size="icon"
              className="bg-black/50 border-gray-700 text-white hover:bg-gray-800 hover:text-white"
            >
              <FlipHorizontal className="h-5 w-5" />
              <span className="sr-only">Switch Camera</span>
            </Button>
          )}

          {/* Main Camera Button */}
          {!cameraActive ? (
            <Button
              onClick={startCamera}
              className="bg-primary/90 hover:bg-primary text-white shadow-lg backdrop-blur-sm px-6 py-6 h-auto"
              size="lg"
            >
              <Camera className="mr-2 h-5 w-5" /> Enable Camera
            </Button>
          ) : (
            <div className="flex flex-col gap-3 items-center">
              <Button
                onClick={captureImage}
                disabled={analyzing}
                className="bg-primary/90 hover:bg-primary text-white shadow-lg backdrop-blur-sm px-6 py-6 h-auto"
                size="lg"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-5 w-5" /> Identify Monument
                  </>
                )}
              </Button>

              {/* Camera Controls Row */}
              <div className="flex gap-3">
                {/* Switch Camera Button */}
                <Button
                  onClick={switchCamera}
                  variant="outline"
                  className="bg-black/50 border-gray-700 text-white hover:bg-gray-800"
                >
                  <FlipHorizontal className="mr-2 h-4 w-4" />
                  {facingMode === "user" ? "Switch to Back Camera" : "Switch to Front Camera"}
                </Button>

                {/* Restart Camera Button */}
                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="bg-black/50 border-gray-700 text-white hover:bg-gray-800"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restart Camera
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Loading overlay */}
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <div className="bg-black/70 p-6 rounded-xl flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-white">Analyzing monument...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-destructive/90 text-white px-4 py-3 rounded-lg max-w-[90%] text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result overlay */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md bg-black/85 backdrop-blur-md rounded-xl p-5 text-white pointer-events-auto border border-gray-800 shadow-lg"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-bold text-primary">{result.object_name}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white hover:bg-gray-800/50 -mt-1 -mr-1"
                  onClick={() => setResult(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                <p className="text-white/90">{result.info}</p>

                {result.history && (
                  <div>
                    <h3 className="text-sm font-medium text-primary/80 mb-1">Historical Context</h3>
                    <p className="text-white/80">{result.history}</p>
                  </div>
                )}
              </div>

              {result.audio_base64 && (
                <div className="mt-4 flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center">
                    <Volume2 className="h-5 w-5 mr-2 text-primary" />
                    <span className="text-sm text-white/90">Audio Description</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-gray-700 hover:bg-gray-700"
                      onClick={toggleAudio}
                    >
                      {isAudioPlaying ? <span className="sr-only">Pause</span> : <span className="sr-only">Play</span>}
                      {isAudioPlaying ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-gray-700 hover:bg-gray-700"
                      onClick={replayAudio}
                    >
                      <span className="sr-only">Replay</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M1 4v6h6"></path>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                    </Button>
                  </div>
                </div>
              )}

              {audioError && (
                <div className="mt-3 p-2 bg-red-500/20 rounded-md text-red-300 text-xs flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>{audioError}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
