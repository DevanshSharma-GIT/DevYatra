"use client"

import { motion } from "framer-motion"
import { Camera, Wifi } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const focusAreas = [
  {
    title: "Smart CCTV",
    description: "Stream video feeds with AI-assisted alerts for unattended baggage and restricted zones.",
  },
  {
    title: "Environmental Sensors",
    description: "Monitor air quality, noise, and temperature across the heritage corridor in real time.",
  },
  {
    title: "Edge Analytics",
    description: "Deploy anomaly detection at key choke points to reduce response times during peak hours.",
  },
]

export default function IotSurveillancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-slate-100 py-12">
      <div className="container mx-auto px-4 space-y-10">
        <motion.div
          className="flex flex-col gap-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-200/80">
            <Camera className="h-8 w-8 text-cyan-900" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900">IoT & Surveillance Command Hub</h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Connect sensor grids, vision systems, and alert pipelines to keep pilgrims secure while preserving the heritage
            experience.
          </p>
        </motion.div>

        <motion.div
          className="grid gap-6 md:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } } }}
        >
          {focusAreas.map((item) => (
            <motion.div key={item.title} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <Card className="h-full border-cyan-200 bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-800">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-slate-600">{item.description}</CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="rounded-2xl border border-cyan-200 bg-white/80 p-8 backdrop-blur"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 text-left">
              <div className="rounded-full bg-cyan-100 p-3">
                <Wifi className="h-6 w-6 text-cyan-700" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-800">Integrate with city command center</h2>
                <p className="text-slate-600">
                  Push alerts to local law enforcement, synchronize with traffic command feeds, and share incident timelines
                  for coordinated responses.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-cyan-300 text-cyan-800 hover:bg-cyan-100">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
              <Button className="bg-cyan-700 text-white hover:bg-cyan-800">View device registry</Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
