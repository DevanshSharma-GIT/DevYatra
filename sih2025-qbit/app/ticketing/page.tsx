"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import axios from "axios"
import { io, Socket } from "socket.io-client"
import { motion } from "framer-motion"
import {
  Clock,
  Ticket,
  Users,
  Zap,
  QrCode,
  Globe,
  UserCircle,
  Menu
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

// --- INTERFACES ---
interface TicketInfo {
  id: string
  user_name: string
  status: "waiting" | "ready" | "serviced"
  queue_id: string
  queue_number: number
  estimated_wait_minutes: number
  created_at: string
}

interface QueueInfo {
  id: string
  name: string
  type: "General" | "Priority"
  current_serving_number: number
}

// --- CONSTANTS ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const API_TICKETS = `${API_BASE}/api/tickets`
const API_QUEUES = `${API_BASE}/api/queues`
const SOCKET_URL = API_BASE
const POLLING_INTERVAL = 10000 // fallback poll every 10s

export default function TicketingPage() {
  const [tickets, setTickets] = useState<TicketInfo[]>([])
  const [queues, setQueues] = useState<QueueInfo[]>([])
  const [selectedQueueId, setSelectedQueueId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [newVisitorName, setNewVisitorName] = useState("")
  const [points, setPoints] = useState(1200)
  const [socket, setSocket] = useState<Socket | null>(null)

  // --- FETCH DATA ---
  const fetchQueues = async () => {
    try {
      const res = await axios.get(API_QUEUES)
      setQueues(res.data)
      if (!selectedQueueId && res.data.length > 0) {
        setSelectedQueueId(res.data[0].id)
      }
    } catch (err) {
      console.error("Failed to fetch queues", err)
    }
  }

  const fetchTickets = async () => {
    try {
      const res = await axios.get(API_TICKETS)
      setTickets(res.data)
    } catch (err) {
      console.error("Failed to fetch tickets", err)
    } finally {
      setLoading(false)
    }
  }

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetchQueues()
    fetchTickets()

    // Fallback polling
    const interval = setInterval(fetchTickets, POLLING_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // --- SOCKET.IO SETUP ---
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket"] })
    setSocket(s)

    s.on("connect", () => console.log("✅ Connected to socket"))
    s.on("disconnect", () => console.log("❌ Disconnected from socket"))

    s.on("ticket_created", (ticket: TicketInfo) => {
      setTickets((prev) => [...prev, ticket])
    })

    s.on("ticket_ready", (ticket: TicketInfo) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t))
      )
    })

    s.on("ticket_serviced", (ticket: TicketInfo) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t))
      )
    })

    s.on("ticket_deleted", (data: { id: string }) => {
      setTickets((prev) => prev.filter((t) => t.id !== data.id))
    })

    s.on("queue_update", ({ queue_id, serving_number }) => {
      setQueues((prev) =>
        prev.map((q) =>
          q.id === queue_id ? { ...q, current_serving_number: serving_number } : q
        )
      )
    })

    return () => {
      s.disconnect()
    }
  }, [])

  // --- LOGIC ---
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      if (a.status === "ready" && b.status !== "ready") return -1
      if (a.status !== "ready" && b.status === "ready") return 1
      return a.queue_number - b.queue_number
    })
  }, [tickets])

  const selectedQueue = queues.find((q) => q.id === selectedQueueId)

  const addTicket = async () => {
    if (!newVisitorName || !selectedQueueId) {
      alert("Please enter pilgrim name and select a queue.")
      return
    }
    try {
      const res = await axios.post(API_TICKETS, {
        queue_id: selectedQueueId,
        user_name: newVisitorName
      })
      // socket will also push this, but we optimistically update
      setTickets((prev) => [...prev, res.data])
      setNewVisitorName("")
    } catch (err) {
      console.error("Failed to add ticket", err)
    }
  }

  const removeTicket = async (ticketId: string) => {
    try {
      await axios.delete(`${API_TICKETS}/${ticketId}`)
      setTickets((prev) => prev.filter((t) => t.id !== ticketId))
      // socket event will also sync across clients
    } catch (err) {
      console.error("Failed to remove ticket", err)
    }
  }

  // --- HELPERS ---
  const getStatusColors = (status: TicketInfo["status"]) => {
    switch (status) {
      case "ready":
        return "bg-teal-600 text-white border-teal-600"
      case "waiting":
        return "bg-amber-500 text-white border-amber-500"
      case "serviced":
        return "bg-gray-400 text-white border-gray-400"
      default:
        return "text-teal-700 border-teal-200"
    }
  }

  const renderQueueLabel = (queueId: string) => {
    const queue = queues.find((q) => q.id === queueId)
    if (!queue) return "Unknown Queue"
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
        {queue.type === "Priority" && <Zap className="h-3 w-3 text-red-500" />}
        {queue.name}
      </span>
    )
  }

  const calculateQueuePosition = (ticket: TicketInfo) => {
    return tickets.filter(
      (t) =>
        t.queue_id === ticket.queue_id &&
        t.status === "waiting" &&
        t.queue_number < ticket.queue_number
    ).length
  }

  // --- RENDER ---
  return (
    <>
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <Link href="/">
              <span className="font-semibold text-amber-900">HeritEdge</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden sm:inline-block text-amber-800 hover:text-amber-600 text-sm font-medium"
            >
              Dashboard
            </Link>
            <div className="flex items-center gap-1 bg-amber-100 px-3 py-1 rounded-full">
              <UserCircle className="h-4 w-4 text-amber-700" />
              <span className="text-xs font-medium text-amber-800">
                {points} pts
              </span>
            </div>
            <button className="sm:hidden text-amber-800">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-teal-100 p-6 sm:p-10">
        <h1 className="text-4xl font-extrabold text-teal-900 mb-8 flex items-center gap-3">
          <Ticket className="h-9 w-9 text-teal-700" /> Virtual Queue & Darshan
          Passes
        </h1>

        {/* Add Visitor */}
        <Card className="mb-8 border-teal-300 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-teal-800">
              Generate Digital Darshan Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Pilgrim Name"
              value={newVisitorName}
              onChange={(e) => setNewVisitorName(e.target.value)}
              className="flex-1 border-teal-300"
            />
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="border border-teal-300 rounded-lg px-4 py-2 text-base text-teal-900 bg-white shadow-inner sm:w-1/4"
              disabled={queues.length === 0}
            >
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.type})
                </option>
              ))}
            </select>
            <Button
              onClick={addTicket}
              disabled={!newVisitorName || !selectedQueueId || loading}
              className="bg-teal-700 text-white font-semibold hover:bg-teal-800"
            >
              Issue Pass
            </Button>
          </CardContent>
        </Card>

        {/* Queue Status */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-teal-800 flex items-center gap-2">
            <Users className="h-6 w-6" /> Live Queue Status
          </h2>
          <Button
            onClick={fetchTickets}
            variant="outline"
            className="border-teal-400 text-teal-700 hover:bg-teal-50"
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-lg text-teal-600">
            Loading...
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="text-center py-10 text-xl text-teal-700 border border-dashed border-teal-300 rounded-lg bg-teal-50">
            🙏 All queues are empty. Welcome!
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {sortedTickets.map((ticket) => {
              const queuePosition = calculateQueuePosition(ticket)
              return (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card
                    className={`border-l-4 ${
                      ticket.status === "ready"
                        ? "border-teal-600 shadow-lg"
                        : "border-teal-200"
                    } shadow-sm hover:shadow-md h-full`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle
                          className={`text-xl font-bold ${
                            ticket.status === "ready"
                              ? "text-teal-800"
                              : "text-teal-700"
                          }`}
                        >
                          {ticket.user_name}
                        </CardTitle>
                        <Badge
                          variant="default"
                          className={getStatusColors(ticket.status)}
                        >
                          {ticket.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-md bg-teal-50 border border-teal-200">
                        <span className="text-sm text-teal-700 font-medium">
                          {renderQueueLabel(ticket.queue_id)}
                        </span>
                        <span className="text-2xl font-extrabold text-teal-900 flex items-center gap-2">
                          <QrCode className="h-6 w-6" /> {ticket.queue_number}
                        </span>
                      </div>
                      {ticket.status === "waiting" && (
                        <>
                          <p className="text-sm text-amber-700 flex items-center gap-1 font-semibold">
                            <Users className="h-4 w-4" /> Position:{" "}
                            {queuePosition}
                          </p>
                          <p className="text-sm text-teal-700 flex items-center gap-1">
                            <Clock className="h-4 w-4" /> EWT:{" "}
                            {ticket.estimated_wait_minutes > 0
                              ? `${ticket.estimated_wait_minutes} min`
                              : "Calculating..."}
                          </p>
                        </>
                      )}
                      {ticket.status === "ready" && (
                        <div className="mt-3 p-3 bg-teal-100 border-l-4 border-teal-500 font-bold text-teal-800">
                          📣 Please proceed to Darshan Gate!
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end p-4 pt-2 border-t border-gray-100">
                      <Button
                        onClick={() => removeTicket(ticket.id)}
                        className="bg-red-600 text-white hover:bg-red-700 text-sm"
                        size="sm"
                        disabled={ticket.status === "serviced"}
                      >
                        Cancel / No-Show
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </>
  )
}
