"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { motion } from "framer-motion"
import { Palmtree, Compass, Map, Sun, Cloud, Mountain, Sparkles } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-terracotta-500/30 to-moss-500/20 z-10" />

      {/* Animated background elements */}
      <motion.div
        className="absolute top-20 left-10 text-terracotta-300 opacity-20 z-0"
        animate={{
          y: [0, -15, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 5,
          ease: "easeInOut",
        }}
      >
        <Palmtree size={120} />
      </motion.div>

      <motion.div
        className="absolute bottom-20 right-10 text-moss-400 opacity-20 z-0"
        animate={{
          y: [0, 15, 0],
          rotate: [0, -5, 0],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 7,
          ease: "easeInOut",
        }}
      >
        <Map size={100} />
      </motion.div>

      <motion.div
        className="absolute top-1/2 right-1/4 text-earth-400 opacity-10 z-0"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 20,
          ease: "linear",
        }}
      >
        <Compass size={80} />
      </motion.div>

      {/* Floating clouds */}
      <motion.div
        className="absolute top-1/4 left-1/3 text-white opacity-20 z-0"
        animate={{
          x: [0, 30, 0],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 15,
          ease: "easeInOut",
        }}
      >
        <Cloud size={60} />
      </motion.div>

      <motion.div
        className="absolute bottom-1/3 left-1/5 text-white opacity-15 z-0"
        animate={{
          x: [0, -20, 0],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 12,
          ease: "easeInOut",
        }}
      >
        <Cloud size={40} />
      </motion.div>

      {/* Sun */}
      <motion.div
        className="absolute top-20 right-20 text-spice-300 opacity-30 z-0"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.4, 0.3],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 8,
          ease: "easeInOut",
        }}
      >
        <Sun size={100} />
      </motion.div>

      {/* Mountains */}
      <motion.div
        className="absolute bottom-10 left-1/4 text-earth-600 opacity-20 z-0"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{
          duration: 1,
        }}
      >
        <Mountain size={120} />
      </motion.div>

      {/* Sparkles */}
      <motion.div
        className="absolute top-1/3 right-1/3 text-spice-200 opacity-40 z-0"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 3,
          ease: "easeInOut",
        }}
      >
        <Sparkles size={30} />
      </motion.div>

      <motion.div
        className="absolute bottom-1/4 right-1/5 text-spice-200 opacity-30 z-0"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 4,
          delay: 1,
          ease: "easeInOut",
        }}
      >
        <Sparkles size={20} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="h-[80vh] bg-cover bg-center safari-pattern relative"
        style={{ backgroundImage: "url('/placeholder.svg?height=1080&width=1920')" }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-terracotta-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-20 -right-10 w-80 h-80 bg-moss-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container h-full flex flex-col justify-center items-start relative z-20">
          <div className="max-w-2xl space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block bg-gradient-diagonal from-terracotta-500 to-spice-500 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg"
            >
              ✨ Explore the Unexplored ✨
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-earth-800 dark:text-earth-100 drop-shadow-text-light"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Discover India's Rich
              <span className="gradient-text block">Cultural Heritage</span>
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl text-earth-600 dark:text-earth-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Explore historical sites, monuments, and attractions with our immersive travel platform.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-5 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Button
                asChild
                size="lg"
                className="funky-button bg-gradient-diagonal from-terracotta-500 to-spice-500 hover:from-terracotta-600 hover:to-spice-600 text-white rounded-full group shadow-glow"
              >
                <Link href="/search" className="flex items-center justify-center py-6 px-8">
                  <Compass className="mr-2 h-5 w-5 group-hover:animate-spin-slow" />
                  <span className="text-lg">Start Exploring</span>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-2 border-moss-500 text-moss-700 dark:text-moss-400 hover:bg-moss-100 dark:hover:bg-moss-900/30 rounded-full py-6 px-8"
              >
                <Link href="/assistant" className="flex items-center justify-center">
                  <span className="text-lg">Get Recommendations</span>
                </Link>
              </Button>
            </motion.div>

            {/* Decorative element */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="absolute bottom-10 right-10 hidden lg:block"
            >
              <div className="relative w-40 h-40">
                <div className="absolute inset-0 bg-gradient-radial from-terracotta-500/20 to-transparent rounded-full animate-pulse"></div>
                <div
                  className="absolute inset-4 bg-gradient-radial from-moss-500/20 to-transparent rounded-full animate-pulse"
                  style={{ animationDelay: "1s" }}
                ></div>
                <div
                  className="absolute inset-8 bg-gradient-radial from-spice-500/20 to-transparent rounded-full animate-pulse"
                  style={{ animationDelay: "2s" }}
                ></div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Wavy divider */}
      <div className="wavy-divider w-full"></div>
    </section>
  )
}
