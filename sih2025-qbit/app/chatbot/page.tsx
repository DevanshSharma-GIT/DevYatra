"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { io, type Socket } from "socket.io-client"
import {
  Loader2,
  MapPin,
  Landmark,
  Ticket,
  Camera,
  Shield,
  Send,
  User,
  Calendar,
  Clock,
  Briefcase,
  List,
  ArrowRight,
  Mic,
  Globe,
  Menu,
} from "lucide-react"
import { getCookie, setCookie } from "cookies-next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import VoiceModal from "@/components/VoiceModal"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  details?: {
    destination?: string
    price_range?: string
    travel_duration?: string
    local_time?: string
    cultural_highlights?: string
    packing_suggestions?: string
    travel_tips?: string
    itinerary?: string
  }
}

interface UserProfile {
  username?: string
  budget: string
  group_size: string
  group_type: string
  interests: string
  travel_dates: string
  default_location: string
  currency: string
  home_location: string
}

export default function ChatbotPage() {
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [points, setPoints] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [apiUrl, setApiUrl] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  }

  // Enhanced verification to ensure preferences are set
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL
    if (!url) {
      console.error(
        "FATAL: NEXT_PUBLIC_API_URL is not defined. WebSocket connection cannot be established. Please check your .env.local file and ensure it's correctly set and the Next.js server was restarted.",
      )
      setMessages((prev) => [
        ...prev,
        {
          id: "env-error",
          role: "assistant",
          content:
            "Configuration Error: The application is not configured to connect to the server. Please check the console for more details or contact an administrator.",
        },
      ])
      return
    }
    setApiUrl(url)

    let preferences = null
    let redirectNeeded = false

    // First check cookie data (for SSR compatibility)
    const preferencesFromCookie = getCookie("travelPreferences")
    if (preferencesFromCookie) {
      try {
        preferences = JSON.parse(preferencesFromCookie as string)
        if (!preferences || !preferences.username) {
          redirectNeeded = true
        }
      } catch (e) {
        console.error("Error parsing preferences from cookie:", e)
        redirectNeeded = true
      }
    } else {
      // Fall back to localStorage
      const storedPreferences = localStorage.getItem("travelPreferences")
      if (storedPreferences) {
        try {
          preferences = JSON.parse(storedPreferences)
          if (!preferences || !preferences.username) {
            redirectNeeded = true
          } else {
            // If we find valid preferences in localStorage but not cookie,
            // restore the cookie for middleware access
            setCookie("travelPreferences", storedPreferences, {
              maxAge: 30 * 24 * 60 * 60, // 30 days
              path: "/",
            })
          }
        } catch (e) {
          console.error("Error parsing preferences from localStorage:", e)
          redirectNeeded = true
        }
      } else {
        redirectNeeded = true
      }
    }

    // If preferences don't exist or are invalid, redirect to preference page
    if (redirectNeeded || !preferences) {
      console.log("Preferences not found, redirecting to preferences page")
      router.push("/preferences?from=/chatbot")
      return
    }

    // If we reach here, preferences are valid
    setUserProfile(preferences)
  }, [router])

  // Effect for Socket.IO connection, dependent on apiUrl and userProfile
  useEffect(() => {
    if (!apiUrl || !userProfile) {
      // Don't attempt to connect if API URL or userProfile is not ready
      return
    }

    // Connect to Socket.IO server and continue with socket setup
    const socketInstance = io(apiUrl, {
      transports: ["websocket", "polling"], // Explicitly define transports, WebSocket preferred
    })

    socketInstance.on("connect", () => {
      setConnected(true)
      // Add welcome message, ensuring it's not duplicated on reconnects
      // and clears any previous env-error message.
      setMessages((prevMessages) => {
        const hasWelcome = prevMessages.some((m) => m.id === "welcome")
        const filteredMessages = prevMessages.filter((m) => m.id !== "env-error")
        if (!hasWelcome) {
          return [
            {
              id: "welcome",
              role: "assistant",
              content:
                "Welcome to DevYatra Travel Assistant! I'm here to help you plan your perfect trip. How can I assist you today?",
            },
            ...filteredMessages,
          ]
        }
        return filteredMessages
      })

      // Send user profile to server
      // Ensure userProfile and username are valid before emitting and fetching
      if (userProfile && userProfile.username) {
        socketInstance.emit("update_profile", userProfile)
        fetchUserPoints(userProfile.username)
      }
    })

    socketInstance.on("profile_updated", (data) => {
      console.log("Profile updated:", data)
    })

    socketInstance.on("message_response", (data) => {
      setIsProcessing(false)

      if (data.status === "success") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: data.message,
            details: data.details,
          },
        ])
      } else {
        // Handle other statuses or if message is directly in data
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: data.message || "Received an update from the server.",
          },
        ])
      }
    })

    socketInstance.on("processing", () => {
      setIsProcessing(true)
    })

    socketInstance.on("error", (data) => {
      setIsProcessing(false)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${data.message}`,
        },
      ])
    })

    socketInstance.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${reason}`)
      setConnected(false)
      // Optionally, inform the user about the disconnection
      // setMessages((prev) => [
      //   ...prev,
      //   {
      //     id: `disconnect-${Date.now()}`,
      //     role: "assistant",
      //     content: `Connection lost: ${reason}. Attempting to reconnect...`,
      //   },
      // ]);
    })

    socketInstance.on("connect_error", (err) => {
      console.error(`Socket connection error: ${err.message}`, err)
      // Optionally, update UI to inform user about connection error
      // setMessages((prev) => [
      //   ...prev,
      //   {
      //     id: `connect-error-${Date.now()}`,
      //     role: "assistant",
      //     content: `Failed to connect: ${err.message}. Please check your connection.`,
      //   },
      // ]);
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [apiUrl, userProfile, router]) // router dependency kept if fetchUserPoints or other logic needs it

  const fetchUserPoints = async (username: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${username}`)
      if (response.ok) {
        const userData = await response.json()
        setPoints(userData.points || 0)
      }
    } catch (error) {
      console.error("Error fetching user points:", error)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || !socket || !connected) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])

    // Send message to server with profile attached to ensure context is maintained
    socket.emit("send_message", {
      message: input,
      profile: userProfile,
    })

    setInput("")
    setIsProcessing(true)
  }

  const handleQuickPrompt = (prompt: string) => {
    if (!socket || !connected) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: prompt,
    }

    setMessages((prev) => [...prev, userMessage])

    // Send message to server with profile attached
    socket.emit("send_message", {
      message: prompt,
      profile: userProfile,
    })

    setIsProcessing(true)
  }

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Add a function to add messages directly to the chat history
  const addMessageToHistory = (message: Message) => {
    setMessages((prev) => [...prev, message])
  }

  // Update the voice message handler to support structured responses
  const handleVoiceMessage = (message: string) => {
    if (!message.trim() || !socket || !connected) return

    // No need to add the message here as it will be added by the VoiceModal
    // through the addMessageToHistory function

    // Send message to server with profile attached
    socket.emit("send_message", {
      message: message,
      profile: userProfile,
      voice_mode: true, // Flag that this came from voice input
    })

    setIsProcessing(true)
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-amber-700" />
              <Link href="/" className="font-semibold text-amber-900">
                DevYatra
              </Link>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden text-amber-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="h-6 w-6" />
            </button>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/destinations" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
                Destinations
              </Link>
              <Link href="/experiences" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
                Experiences
              </Link>
              <Link href="/about" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
                About
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/preferences")}
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                Preferences
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="bg-amber-700 hover:bg-amber-800 text-white"
              >
                Dashboard
              </Button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden bg-white border-b border-amber-100 py-3"
            >
              <div className="container mx-auto px-4 flex flex-col space-y-3">
                <Link
                  href="/destinations"
                  className="text-amber-800 hover:text-amber-600 text-sm font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Destinations
                </Link>
                <Link
                  href="/experiences"
                  className="text-amber-800 hover:text-amber-600 text-sm font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Experiences
                </Link>
                <Link
                  href="/about"
                  className="text-amber-800 hover:text-amber-600 text-sm font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </Link>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push("/preferences")
                      setMobileMenuOpen(false)
                    }}
                    className="text-amber-700 border-amber-200 hover:bg-amber-50 flex-1"
                  >
                    Preferences
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      router.push("/dashboard")
                      setMobileMenuOpen(false)
                    }}
                    className="bg-amber-700 hover:bg-amber-800 text-white flex-1"
                  >
                    Dashboard
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </header>

        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <Card className="shadow-lg overflow-hidden border border-amber-200 bg-white">
              <CardHeader className="bg-amber-50 border-b border-amber-100">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Landmark className="h-5 w-5 text-amber-700" />
                  DevYatra Travel Assistant
                </CardTitle>
              </CardHeader>

              <Tabs defaultValue="chat">
                <div className="px-4 pt-4">
                  <TabsList className="grid w-full grid-cols-5 bg-amber-50/50 border border-amber-100">
                    <TabsTrigger
                      value="chat"
                      className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
                    >
                      Chat
                    </TabsTrigger>
                    <TabsTrigger
                      value="profile"
                      className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
                    >
                      Your Profile
                    </TabsTrigger>
                    <TabsTrigger
                      value="tickets"
                      className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      Tickets
                    </TabsTrigger>
                    <TabsTrigger
                      value="memories"
                      className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Memories
                    </TabsTrigger>
                    <TabsTrigger
                      value="safety"
                      className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Safety
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="chat" className="m-0">
                  <CardContent className="h-[60vh] overflow-y-auto p-6">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible">
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          variants={itemVariants}
                          className={`mb-4 ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              message.role === "user"
                                ? "bg-amber-600 text-white shadow-sm"
                                : "bg-amber-50 shadow-sm text-stone-800 border border-amber-200"
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{message.content}</div>

                            {message.details && Object.values(message.details).some(Boolean) && (
                              <div
                                className={`mt-4 pt-3 ${
                                  message.role === "user" ? "border-t border-white/20" : "border-t border-amber-200"
                                } space-y-3`}
                              >
                                {message.details.destination && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="h-4 w-4 flex-shrink-0" />
                                    <span>{message.details.destination}</span>
                                  </div>
                                )}

                                {message.details.local_time && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                    <span>{message.details.local_time}</span>
                                  </div>
                                )}

                                {message.details.price_range && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">Price Range:</span>
                                    <span>{message.details.price_range}</span>
                                  </div>
                                )}


                                {message.details.travel_duration && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 flex-shrink-0" />
                                    <span>{message.details.travel_duration}</span>
                                  </div>
                                )}

                                {message.details.packing_suggestions && (
                                  <div className="flex items-start gap-2 text-sm">
                                    <Briefcase className="h-4 w-4 flex-shrink-0 mt-1" />
                                    <span>{message.details.packing_suggestions}</span>
                                  </div>
                                )}

                                {message.details.cultural_highlights && (
                                  <div className="flex items-start gap-2 text-sm">
                                    <Landmark className="h-4 w-4 flex-shrink-0 mt-1" />
                                    <span>{message.details.cultural_highlights}</span>
                                  </div>
                                )}

                                {message.details.travel_tips && (
                                  <div className="flex items-start gap-2 text-sm">
                                    <List className="h-4 w-4 flex-shrink-0 mt-1" />
                                    <span>{message.details.travel_tips}</span>
                                  </div>
                                )}

                                {message.details.itinerary && (
                                  <div
                                    className={`mt-2 pt-2 ${
                                      message.role === "user" ? "border-t border-white/20" : "border-t border-amber-200"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                                      <Calendar className="h-4 w-4 flex-shrink-0" />
                                      <span>Suggested Itinerary</span>
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">{message.details.itinerary}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {isProcessing && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex justify-start mb-4"
                        >
                          <div className="bg-amber-50 rounded-lg p-4 shadow-sm border border-amber-200 flex items-center gap-2">
                            <div className="flex space-x-1">
                              <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.1 }}
                                className="h-2 w-2 bg-amber-500 rounded-full"
                              />
                              <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Number.POSITIVE_INFINITY,
                                  repeatDelay: 0.2,
                                  delay: 0.1,
                                }}
                                className="h-2 w-2 bg-amber-500 rounded-full"
                              />
                              <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Number.POSITIVE_INFINITY,
                                  repeatDelay: 0.3,
                                  delay: 0.2,
                                }}
                                className="h-2 w-2 bg-amber-500 rounded-full"
                              />
                            </div>
                            <span className="text-sm text-amber-700">Thinking...</span>
                          </div>
                        </motion.div>
                      )}

                      <div ref={messagesEndRef} />
                    </motion.div>
                  </CardContent>

                  <CardFooter className="border-t border-amber-100 p-4 bg-amber-50/50">
                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                      <div className="flex gap-2">
                        <Input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask about travel destinations, cultural sites, or plan your trip..."
                          disabled={!connected || isProcessing}
                          className="flex-1 bg-white border-amber-200 text-stone-800 placeholder:text-stone-400 focus-visible:ring-amber-500"
                        />
                        <Button
                          type="button"
                          onClick={() => setVoiceModalOpen(true)}
                          disabled={!connected || isProcessing}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                          title="Voice Input"
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                        <Button
                          type="submit"
                          disabled={!connected || isProcessing || !input.trim()}
                          className="bg-amber-700 text-white hover:bg-amber-800"
                        >
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleQuickPrompt(
                              "Tell me about cultural sites in " + (userProfile?.default_location || "India"),
                            )
                          }
                          disabled={!connected || isProcessing}
                          className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          Cultural sites
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleQuickPrompt(
                              "Suggest a 3-day itinerary for " + (userProfile?.default_location || "Paris"),
                            )
                          }
                          disabled={!connected || isProcessing}
                          className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          3-day itinerary
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleQuickPrompt(
                              "What's the best time to visit " + (userProfile?.default_location || "Japan"),
                            )
                          }
                          disabled={!connected || isProcessing}
                          className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          Best time to visit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleQuickPrompt(
                              "Local customs and etiquette in " + (userProfile?.default_location || "Thailand"),
                            )
                          }
                          disabled={!connected || isProcessing}
                          className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          Local customs
                        </Button>
                      </div>
                    </form>
                  </CardFooter>
                </TabsContent>

                <TabsContent value="profile" className="m-0">
                  <CardContent className="p-6">
                    {userProfile && (
                      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                        <motion.div variants={itemVariants} className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                            <User className="h-8 w-8 text-amber-700" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-stone-800">{userProfile.username}</h3>
                            <p className="text-stone-600">
                              {userProfile.group_type.charAt(0).toUpperCase() + userProfile.group_type.slice(1)}{" "}
                              Traveler
                            </p>
                          </div>
                          <div className="ml-auto">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              {points} points
                            </Badge>
                          </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Budget</p>
                            <p className="font-medium text-stone-800">
                              {userProfile.budget.charAt(0).toUpperCase() + userProfile.budget.slice(1)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Group Size</p>
                            <p className="font-medium text-stone-800">{userProfile.group_size} people</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Travel Dates</p>
                            <p className="font-medium text-stone-800">{userProfile.travel_dates}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Preferred Currency</p>
                            <p className="font-medium text-stone-800">{userProfile.currency}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Home Location</p>
                            <p className="font-medium text-stone-800">{userProfile.home_location}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-stone-500">Destination of Interest</p>
                            <p className="font-medium text-stone-800">{userProfile.default_location}</p>
                          </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="space-y-2">
                          <p className="text-sm text-stone-500">Interests</p>
                          <div className="flex flex-wrap gap-2">
                            {userProfile.interests.split(",").map((interest, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                {interest.trim()}
                              </Badge>
                            ))}
                          </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="pt-4">
                          <Button
                            onClick={() => router.push("/preferences")}
                            className="bg-amber-700 hover:bg-amber-800 text-white"
                          >
                            Edit Preferences
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </CardContent>
                </TabsContent>

                <TabsContent value="tickets" className="m-0">
                  <CardContent className="p-6 text-center">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                      <motion.div variants={itemVariants}>
                        <div className="inline-block p-3 bg-amber-100 rounded-full mb-4 border border-amber-200">
                          <Ticket className="h-8 w-8 text-amber-700" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-stone-800">Book Attraction Tickets</h3>
                        <p className="text-stone-600 mb-6">
                          Search and book tickets for cultural attractions with dynamic pricing based on crowd density
                        </p>
                        <Link href="/tickets">
                          <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                            Go to Ticket Booking
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="memories" className="m-0">
                  <CardContent className="p-6 text-center">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                      <motion.div variants={itemVariants}>
                        <div className="inline-block p-3 bg-lime-100 rounded-full mb-4 border border-lime-200">
                          <Camera className="h-8 w-8 text-lime-700" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-stone-800">Cultural Memories</h3>
                        <p className="text-stone-600 mb-6">
                          Capture and collect memories from heritage sites to earn points and unlock rewards
                        </p>
                        <Link href="/memory">
                          <Button className="bg-lime-700 hover:bg-lime-800 text-white">
                            Go to Memories
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="safety" className="m-0">
                  <CardContent className="p-6 text-center">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                      <motion.div variants={itemVariants}>
                        <div className="inline-block p-3 bg-stone-100 rounded-full mb-4 border border-stone-200">
                          <Shield className="h-8 w-8 text-stone-700" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-stone-800">Safety Map</h3>
                        <p className="text-stone-600 mb-6">
                          View crowdsourced safety information for destinations around the world
                        </p>
                        <Link href="/safety">
                          <Button className="bg-stone-700 hover:bg-stone-800 text-white">
                            Go to Safety Map
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-amber-200 py-8 mt-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <Globe className="h-5 w-5 text-amber-700 mr-2" />
                <span className="text-lg font-semibold text-stone-800">DevYatra</span>
              </div>
              <div className="text-stone-600 text-sm">© {new Date().getFullYear()} DevYatra. All rights reserved.</div>
            </div>
          </div>
        </footer>
      </div>
      <VoiceModal
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onMessageReceived={handleVoiceMessage}
        username={userProfile?.username || "guest"}
        socketInstance={socket} // Pass the socket instance for unified message handling
        addMessageToHistory={addMessageToHistory} // Pass function to add messages directly
        userProfile={userProfile} // Pass user profile for context
      />
    </>
  )
}
