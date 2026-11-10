"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { MapPin, ArrowRight, Heart, Star, Clock } from "lucide-react"

const destinations = [
  {
    id: 1,
    name: "Taj Mahal",
    location: "Agra, Uttar Pradesh",
    image: "/placeholder.svg?height=400&width=600",
    description: "One of the seven wonders of the world, a symbol of eternal love.",
    emoji: "🏰",
    rating: 4.9,
    time: "3-4 hours",
  },
  {
    id: 2,
    name: "Jaipur City Palace",
    location: "Jaipur, Rajasthan",
    image: "/placeholder.svg?height=400&width=600",
    description: "A stunning blend of Rajasthani and Mughal architecture in the Pink City.",
    emoji: "🏯",
    rating: 4.7,
    time: "2-3 hours",
  },
  {
    id: 3,
    name: "Golden Temple",
    location: "Amritsar, Punjab",
    image: "/placeholder.svg?height=400&width=600",
    description: "The holiest gurdwara and an important pilgrimage site for Sikhs.",
    emoji: "✨",
    rating: 4.8,
    time: "2-3 hours",
  },
  {
    id: 4,
    name: "Mysore Palace",
    location: "Mysore, Karnataka",
    image: "/placeholder.svg?height=400&width=600",
    description: "A historical palace known for its Indo-Saracenic style of architecture.",
    emoji: "🏛️",
    rating: 4.6,
    time: "2-3 hours",
  },
]

export default function FeaturedDestinations() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 12,
      },
    },
  }

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
    >
      {destinations.map((destination) => (
        <motion.div key={destination.id} variants={itemVariants}>
          <Card className="travel-card overflow-hidden h-full group bg-white dark:bg-earth-900/80 border-earth-200 dark:border-earth-700 shadow-lg">
            <div className="relative h-56 overflow-hidden">
              <div className="absolute top-3 left-3 z-10 bg-gradient-diagonal from-terracotta-500 to-spice-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg transform transition-transform group-hover:scale-110">
                {destination.emoji}
              </div>

              <div className="absolute top-3 right-3 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-terracotta-500 hover:text-terracotta-600 shadow-md"
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </div>

              <Image
                src={destination.image || "/placeholder.svg"}
                alt={destination.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-earth-900/70 via-earth-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl text-earth-800 dark:text-earth-100 group-hover:text-terracotta-500 transition-colors duration-300 font-display">
                  {destination.name}
                </h3>
                <div className="flex items-center bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-400 px-2 py-1 rounded-full text-sm">
                  <Star className="h-3.5 w-3.5 mr-1 fill-current" />
                  <span>{destination.rating}</span>
                </div>
              </div>

              <p className="text-sm text-earth-600 dark:text-earth-400 mb-3 flex items-center">
                <MapPin className="h-3.5 w-3.5 mr-1.5 text-terracotta-500" />
                {destination.location}
              </p>

              <div className="flex items-center text-xs text-earth-500 dark:text-earth-500 mb-3">
                <Clock className="h-3.5 w-3.5 mr-1.5 text-earth-400" />
                <span>Recommended: {destination.time}</span>
              </div>

              <p className="text-sm text-earth-700 dark:text-earth-300">{destination.description}</p>
            </CardContent>

            <CardFooter className="p-5 pt-0">
              <Button
                asChild
                variant="outline"
                className="w-full group-hover:bg-gradient-diagonal group-hover:from-terracotta-500 group-hover:to-spice-500 group-hover:text-white transition-all duration-300 border-terracotta-300 text-terracotta-600 dark:text-terracotta-400 rounded-full"
              >
                <Link
                  href={`/search?place=${encodeURIComponent(destination.name)}`}
                  className="flex items-center justify-center"
                >
                  <span>Explore</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
