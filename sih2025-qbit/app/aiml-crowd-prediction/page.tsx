"use client"

import { motion } from "framer-motion"
import { Cpu, Users } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AimlCrowdPredictionPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12">
			<div className="container mx-auto px-4 space-y-10">
				<div className="flex flex-col gap-4 text-center">
					<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
									<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
										<Cpu className="h-8 w-8 text-slate-700" />
						</div>
					</motion.div>
					<motion.h1
						className="text-4xl font-bold text-slate-900"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						AIML CrowdPrediction Control Center
					</motion.h1>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-slate-600"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
					>
						Analyze visitor inflow forecasts, proactively deploy resources, and keep the heritage corridor flowing smoothly.
					</motion.p>
				</div>

				<motion.div
					className="grid gap-6 lg:grid-cols-3"
					initial="hidden"
					animate="visible"
					variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } } }}
				>
					{[
						{
							title: "Real-time Forecast",
							description: "Blend live sensor inputs with historical patterns to anticipate crowd surges down to 15-minute windows.",
						},
						{
							title: "Operational Playbooks",
							description: "Trigger automated advisories for security, sanitation, and mobility units based on predicted congestion levels.",
						},
						{
							title: "Engagement Insights",
							description: "Correlate visitor sentiment from kiosks and chatbots with footfall hotspots to improve on-ground experience.",
						},
					].map((card, index) => (
						<motion.div key={card.title} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
							<Card className="border-slate-200 bg-white/90 backdrop-blur-sm">
								<CardHeader>
									<CardTitle className="text-xl text-slate-800">{card.title}</CardTitle>
								</CardHeader>
								<CardContent className="text-slate-600">{card.description}</CardContent>
							</Card>
						</motion.div>
					))}
				</motion.div>

				<motion.div
					className="rounded-2xl border border-slate-200 bg-white/80 p-8 backdrop-blur"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.3 }}
				>
					<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex items-start gap-4 text-left">
							<div className="rounded-full bg-slate-100 p-3">
								<Users className="h-6 w-6 text-slate-600" />
							</div>
							<div>
								<h2 className="text-2xl font-semibold text-slate-800">Need deeper analytics?</h2>
								<p className="text-slate-600">
									Integrate with the command center dashboard to unlock deployment-ready action sheets, live staffing suggestions,
									and anomaly alerts across the entire temple town.
								</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button asChild variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
								<Link href="/dashboard">Back to dashboard</Link>
							</Button>
							<Button className="bg-slate-800 text-white hover:bg-slate-900">Download report</Button>
						</div>
					</div>
				</motion.div>
			</div>
		</div>
	)
}
