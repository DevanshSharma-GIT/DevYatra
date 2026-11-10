"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Navbar from "@/components/navbar"
import { getCookie } from "cookies-next"
import { motion } from "framer-motion"

interface SharedLayoutProps {
  children: React.ReactNode
  showNavbar?: boolean
}

export default function SharedLayout({ children, showNavbar = true }: SharedLayoutProps) {
  const pathname = usePathname()
  const [points, setPoints] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Load user points if available
    const preferencesFromCookie = getCookie("travelPreferences")
    if (preferencesFromCookie) {
      try {
        const preferences = JSON.parse(preferencesFromCookie as string)
        if (preferences?.username) {
          fetchUserPoints(preferences.username)
        }
      } catch (e) {
        console.error("Error parsing preferences from cookie:", e)
      }
    } else {
      // Fall back to localStorage
      const storedPreferences = localStorage.getItem("travelPreferences")
      if (storedPreferences) {
        try {
          const preferences = JSON.parse(storedPreferences)
          if (preferences?.username) {
            fetchUserPoints(preferences.username)
          }
        } catch (e) {
          console.error("Error parsing preferences from localStorage:", e)
        }
      }
    }
  }, [])

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

  // Don't render anything on the server side
  if (!mounted) return null

  // Check if current page is the home page
  const isHomePage = pathname === "/"
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500">
      {showNavbar && !isHomePage && <Navbar points={points} />}
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
      
      {/* Footer could be added here if needed */}
    </div>
  )
}