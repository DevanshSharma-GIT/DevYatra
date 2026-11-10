"use client"
import React, { useState, useEffect } from "react"
import { Camera, Map, Award, ImageIcon, Clipboard, Check, Loader2, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Memory {
  id: number
  lat: number | null
  lon: number | null
  location_name: string
  ipfs_cid: string
  points_earned: number
  distance_km?: number // Added this field
}

const MemoriesPage: React.FC = () => {
  const [username] = useState<string>("testuser") // Static for demo; replace with auth logic
  const [memories, setMemories] = useState<Memory[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<string>("Checking...")
  const [uploadMessage, setUploadMessage] = useState<string>("")
  const [ipfsHash, setIpfsHash] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Check Pinata connection health on mount
  useEffect(() => {
    fetch("http://localhost:5000/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data.pinata === "connected" ? "Connected" : "Disconnected")
      })
      .catch(() => setHealthStatus("Error"))
  }, [])

  // Fetch memories on mount or username change
  useEffect(() => {
    fetch(`http://localhost:5000/api/memories/${username}`)
      .then((res) => res.json())
      .then((data) => setMemories(data))
      .catch((err) => console.error("Error fetching memories:", err))
  }, [username])

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  // Handle image upload
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setUploadMessage("")
    const formData = new FormData()
    formData.append("image", file)
    formData.append("username", username)

    fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setUploadMessage(`Error: ${data.error}`)
        } else {
          // Enhanced feedback message with distance information
          let message = `Uploaded! ${data.points_earned > 0 ? `+${data.points_earned} points` : 'No points earned'}`
          if (data.distance_km) {
            message += ` • ${data.distance_km} km from home`
          }
          setUploadMessage(message)
          setIpfsHash(data.ipfs_cid)
          // Refresh memories
          fetch(`http://localhost:5000/api/memories/${username}`)
            .then((res) => res.json())
            .then((data) => setMemories(data))
        }
      })
      .catch((err) => {
        console.error("Upload error:", err)
        setUploadMessage("Upload failed")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  // Handle image viewing
  const viewImage = (memoryId: number) => {
    setIsLoading(true)
    setSelectedMemoryId(memoryId)
    console.log(`Fetching image for memory ID: ${memoryId}`)

    fetch(`http://localhost:5000/api/memories/${username}/${memoryId}/image`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        console.log("Image data received:", data)
        if (data.access_link) {
          setImageUrl(data.access_link)
        } else {
          console.error("No access link in response:", data)
          setUploadMessage("Error: Could not retrieve image link")
        }
      })
      .catch((err) => {
        console.error("Error fetching image:", err)
        setUploadMessage(`Error fetching image: ${err.message}`)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl shadow-xl p-6 mb-8 text-white"
        >
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Travel Memories</h1>
              <p className="text-orange-100 mt-1">Capturing moments from {username}'s journey</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center bg-white/20 px-4 py-2 rounded-full">
              <div
                className={`w-3 h-3 rounded-full mr-2 ${healthStatus === "Connected" ? "bg-green-400" : "bg-red-400"}`}
              ></div>
              <span className="text-sm">Pinata: {healthStatus}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="md:col-span-1"
          >
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-orange-100 p-4">
                <h2 className="text-xl font-semibold text-orange-800 flex items-center">
                  <Camera className="mr-2 h-5 w-5" />
                  Add New Memory
                </h2>
              </div>

              <div className="p-6">
                <div
                  onClick={triggerFileInput}
                  className="border-2 border-dashed border-orange-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                    <ImageIcon className="h-8 w-8 text-orange-500" />
                  </div>
                  <p className="text-center text-gray-600">{isLoading ? "Uploading..." : "Click to upload an image"}</p>
                  <p className="text-xs text-center text-gray-500 mt-2">Capture a memory and earn points</p>
                </div>

                {uploadMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 p-3 rounded-lg text-center ${
                      uploadMessage.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {uploadMessage}
                  </motion.div>
                )}

                {/* IPFS Hash Display */}
                {ipfsHash && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <p className="text-sm text-gray-600 mb-2 font-medium">IPFS Hash (CID):</p>
                    <div className="flex items-center">
                      <div className="bg-white p-2 rounded border border-gray-200 text-xs text-gray-700 flex-1 overflow-x-auto whitespace-nowrap">
                        {ipfsHash}
                      </div>
                      <button
                        onClick={() => copyToClipboard(ipfsHash)}
                        className="ml-2 p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Memories List and Image Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="md:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-orange-100 p-4">
                <h2 className="text-xl font-semibold text-orange-800 flex items-center">
                  <Map className="mr-2 h-5 w-5" />
                  Your Travel Memories
                </h2>
              </div>

              <div className="p-6">
                {isLoading && (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                  </div>
                )}

                {!isLoading && memories.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                      <Map className="h-8 w-8 text-orange-400" />
                    </div>
                    <p>No memories yet. Start capturing your journey!</p>
                  </div>
                )}

                {!isLoading && memories.length > 0 && (
                  <div className="space-y-4 mb-6">
                    <AnimatePresence>
                      {memories.map((memory, index) => (
                        <motion.div
                          key={memory.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className={`rounded-xl border overflow-hidden transition-all ${
                            selectedMemoryId === memory.id
                              ? "border-orange-500 shadow-md"
                              : "border-gray-200 hover:border-orange-300"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row">
                            <div className="p-4 flex-1">
                              <div className="flex items-start justify-between">
                                <h3 className="font-medium text-gray-900">{memory.location_name}</h3>
                                <div className={`flex items-center px-2 py-1 rounded-full text-xs ${
                                  memory.points_earned > 0 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  <Award className="h-3 w-3 mr-1" />
                                  {memory.points_earned > 0 ? `+${memory.points_earned} pts` : '0 pts'}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-2 break-all">
                                {memory.ipfs_cid.substring(0, 20)}...
                              </p>
                              {memory.lat && memory.lon && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {memory.location_name.includes("km from Home") ? (
                                    <span className="flex items-center">
                                      <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-1"></span>
                                      {memory.location_name}
                                    </span>
                                  ) : (
                                    <span>📍 {memory.lat.toFixed(4)}, {memory.lon.toFixed(4)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="sm:border-l border-gray-100 p-2 sm:p-4 flex items-center">
                              <button
                                onClick={() => viewImage(memory.id)}
                                className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center"
                              >
                                <ImageIcon className="h-4 w-4 mr-2" />
                                View
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Image Preview */}
                {imageUrl && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 border-t border-gray-200 pt-6"
                  >
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Memory Preview</h3>
                    <div className="rounded-xl overflow-hidden bg-gray-100 relative">
                      <img
                        src={imageUrl || "/placeholder.svg"}
                        alt="Memory"
                        className="w-full object-cover max-h-[400px]"
                        onError={(e) => {
                          console.error("Image failed to load")
                          setUploadMessage("Error: Image failed to load")
                          e.currentTarget.style.display = "none"
                        }}
                      />
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg text-sm flex items-center transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open Original
                      </a>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default MemoriesPage