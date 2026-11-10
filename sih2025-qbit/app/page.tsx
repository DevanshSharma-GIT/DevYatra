"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSelector } from "@/components/translation/language-selector"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"
import {
	MessageSquare,
	MapPin,
	Shield,
	Ticket,
	Users,
	ArrowRight,
	Camera,
	Star,
	Compass,
	Menu,
	Globe,
	Heart,
	Car,
	QrCode,
} from "lucide-react"

type FeatureCard = {
	title: string
	description: string
	icon: JSX.Element
	color: string
	textColor: string
	darkTextColor: string
	descriptionColor: string
	darkDescriptionColor: string
	link: string
	badge?: string
}

export default function HomePage() {
	const router = useRouter()
	const [mounted, setMounted] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const { setLanguage } = useAccessibility()

	useEffect(() => {
		setMounted(true)
	}, [])

	const handleLanguageSync = (value: string) => {
		const languageCode = value.split("-")[0] || value
		setLanguage(languageCode)
	}

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.05,
			},
		},
	} as const

	const itemVariants = {
		hidden: { y: 15, opacity: 0 },
		visible: {
			y: 0,
			opacity: 1,
			transition: {
				type: "spring" as const,
				stiffness: 120,
				damping: 15,
			},
		},
	} as const

	const chatMessages = [
		{
			sender: "assistant",
			message: "Hi there! I'm your travel assistant. Where would you like to explore today?",
		},
		{
			sender: "user",
			message: "I want to visit Bali next month. What should I know?",
		},
		{
			sender: "assistant",
			message:
				"Great choice! Bali is beautiful in all seasons. For next month, expect warm weather and occasional afternoon showers. I recommend visiting Ubud, Seminyak, and the Nusa islands. Would you like specific hotel recommendations?",
		},
	]

	const featureCards: FeatureCard[] = [
		{
			title: "AI Travel Assistant",
			description: "Get personalized recommendations and instant answers",
			icon: <MessageSquare className="h-8 w-8 text-amber-700 dark:text-amber-200" />,
			color:
				"bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 dark:from-amber-900/60 dark:via-amber-900/40 dark:to-amber-800/30 dark:border-amber-700/60",
			textColor: "text-amber-800",
			darkTextColor: "dark:text-amber-200",
			descriptionColor: "text-amber-800/80",
			darkDescriptionColor: "dark:text-amber-200/80",
			link: "/chatbot",
			badge: "AI Powered",
		},
		{
			title: "Destination Explorer",
			description: "Discover new places with cultural insights",
			icon: <Compass className="h-8 w-8 text-emerald-700 dark:text-emerald-200" />,
			color:
				"bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 dark:from-emerald-900/60 dark:via-emerald-900/40 dark:to-emerald-800/30 dark:border-emerald-700/60",
			textColor: "text-emerald-800",
			darkTextColor: "dark:text-emerald-200",
			descriptionColor: "text-emerald-800/80",
			darkDescriptionColor: "dark:text-emerald-200/80",
			link: "/explorer",
			badge: "New",
		},
		{
			title: "Safety Map",
			description: "Check real-time crowd density and safety alerts",
			icon: <Shield className="h-8 w-8 text-sky-700 dark:text-sky-200" />,
			color:
				"bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200 dark:from-slate-900/70 dark:via-slate-900/50 dark:to-slate-800/40 dark:border-slate-700/70",
			textColor: "text-sky-900",
			darkTextColor: "dark:text-sky-100",
			descriptionColor: "text-sky-900/80",
			darkDescriptionColor: "dark:text-sky-100/80",
			link: "/safety",
		},
		{
			title: "Seamless Tickets",
			description: "Book darshan slots, events, and transport in seconds",
			icon: <Ticket className="h-8 w-8 text-orange-700 dark:text-orange-200" />,
			color:
				"bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 dark:from-orange-900/60 dark:via-orange-900/40 dark:to-orange-800/30 dark:border-orange-800/60",
			textColor: "text-orange-800",
			darkTextColor: "dark:text-orange-200",
			descriptionColor: "text-orange-800/80",
			darkDescriptionColor: "dark:text-orange-200/80",
			link: "/tickets",
			badge: "Express",
		},
		{
			title: "Cultural Memories",
			description: "Upload photos, earn points, and track sacred visits",
			icon: <Camera className="h-8 w-8 text-lime-700 dark:text-lime-200" />,
			color:
				"bg-gradient-to-br from-lime-50 to-lime-100 border border-lime-200 dark:from-lime-900/60 dark:via-lime-900/40 dark:to-lime-800/30 dark:border-lime-800/60",
			textColor: "text-lime-800",
			darkTextColor: "dark:text-lime-200",
			descriptionColor: "text-lime-800/80",
			darkDescriptionColor: "dark:text-lime-200/80",
			link: "/memory",
			badge: "Community",
		},
		{
			title: "Crowd Analyzer",
			description: "Monitor live crowd trends and plan stress-free visits",
			icon: <Users className="h-8 w-8 text-teal-700 dark:text-teal-200" />,
			color:
				"bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 dark:from-teal-900/60 dark:via-teal-900/40 dark:to-teal-800/30 dark:border-teal-700/60",
			textColor: "text-teal-800",
			darkTextColor: "dark:text-teal-200",
			descriptionColor: "text-teal-800/80",
			darkDescriptionColor: "dark:text-teal-200/80",
			link: "/crowd-analyzer",
			badge: "Live Data",
		},
		{
			title: "Pilgrim Engagement",
			description: "Create connected pilgrim journeys with gamification",
			icon: <Heart className="h-8 w-8 text-pink-700 dark:text-pink-200" />,
			color:
				"bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 dark:from-pink-900/55 dark:via-pink-900/35 dark:to-pink-800/25 dark:border-pink-800/60",
			textColor: "text-pink-800",
			darkTextColor: "dark:text-pink-200",
			descriptionColor: "text-pink-800/80",
			darkDescriptionColor: "dark:text-pink-200/80",
			link: "/pilgrim-engagement",
			badge: "New",
		},
		{
			title: "Smart Queue",
			description: "Virtual queueing, slot booking, and digital passes",
			icon: <QrCode className="h-8 w-8 text-purple-700 dark:text-purple-200" />,
			color:
				"bg-gradient-to-br from-purple-50 to-indigo-100 border border-purple-200 dark:from-purple-900/60 dark:via-indigo-950/40 dark:to-purple-800/30 dark:border-purple-800/60",
			textColor: "text-purple-900",
			darkTextColor: "dark:text-purple-200",
			descriptionColor: "text-purple-900/80",
			darkDescriptionColor: "dark:text-purple-200/80",
			link: "/smart-queue",
			badge: "Smart System",
		},
		{
			title: "Traffic & Mobility",
			description: "Track shuttles, traffic, and multimodal connections",
			icon: <Car className="h-8 w-8 text-blue-700 dark:text-indigo-200" />,
			color:
				"bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 dark:from-blue-900/60 dark:via-indigo-950/40 dark:to-blue-800/30 dark:border-blue-800/60",
			textColor: "text-blue-900",
			darkTextColor: "dark:text-indigo-200",
			descriptionColor: "text-blue-900/80",
			darkDescriptionColor: "dark:text-indigo-200/80",
			link: "/traffic-mobility",
			badge: "Live Data",
		},
	]

	const popularDestinations = [
		{
			name: "Bali, Indonesia",
			image: "/globe.svg",
			description: "Tropical paradise with lush rice terraces and vibrant culture",
			rating: 4.8,
			category: "Beach & Culture",
		},
		{
			name: "Kyoto, Japan",
			image: "/window.svg",
			description: "Ancient temples and gardens steeped in tradition",
			rating: 4.9,
			category: "Historical",
		},
		{
			name: "Marrakech, Morocco",
			image: "/file.svg",
			description: "Colorful markets and stunning architecture in the desert",
			rating: 4.7,
			category: "Cultural",
		},
	]

	const testimonials = [
		{
			name: "Sarah Johnson",
			location: "Paris, France",
			quote: "The AI recommendations were spot on! Found amazing local restaurants I would have missed otherwise.",
			avatar: "SJ",
		},
		{
			name: "Michael Chen",
			location: "Tokyo, Japan",
			quote: "Helped me navigate language barriers and find hidden gems. A must-have for international travel.",
			avatar: "MC",
		},
		{
			name: "Elena Rodriguez",
			location: "Barcelona, Spain",
			quote: "The cultural insights made my trip so much more meaningful. I learned so much about local history.",
			avatar: "ER",
		},
	]

	if (!mounted) return null

	return (
		<div className="min-h-screen bg-gradient-to-b from-stone-50 via-amber-50 to-amber-100 text-stone-900 transition-colors duration-300 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
			<header className="sticky top-0 z-20 border-b border-amber-100 bg-white/80 backdrop-blur-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/85">
				<div className="container mx-auto flex items-center justify-between px-4 py-3">
					<div className="flex items-center gap-2">
						<Globe className="h-6 w-6 text-amber-700 dark:text-amber-300" />
						<span className="font-semibold text-amber-900 dark:text-amber-100">DevYatra</span>
					</div>
					<button
						className="md:hidden text-amber-800 transition-colors dark:text-amber-200"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						aria-label="Toggle navigation menu"
					>
						<Menu className="h-6 w-6" />
					</button>
					<div className="hidden items-center gap-6 md:flex">
						<Link
							href="/destinations"
							className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
						>
							Destinations
						</Link>
						<Link
							href="/experiences"
							className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
						>
							Experiences
						</Link>
						<Link
							href="/about"
							className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
						>
							About
						</Link>
						<LanguageSelector size="sm" onSyncLanguage={handleLanguageSync} ariaLabel="Interface language" />
						<ThemeToggle />
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push("/preferences")}
							className="border-amber-200 text-amber-700 transition-colors hover:bg-amber-50 dark:border-slate-700 dark:text-amber-200 dark:hover:bg-slate-900"
						>
							Preferences
						</Button>
						<Button
							size="sm"
							onClick={() => router.push("/dashboard")}
							className="bg-amber-700 text-white transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
						>
							Dashboard
						</Button>
					</div>
				</div>
				{mobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="md:hidden border-b border-amber-100 bg-white py-3 transition-colors dark:border-slate-800 dark:bg-slate-950"
					>
						<div className="container mx-auto flex flex-col space-y-3 px-4">
							<Link
								href="/destinations"
								className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
								onClick={() => setMobileMenuOpen(false)}
							>
								Destinations
							</Link>
							<Link
								href="/experiences"
								className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
								onClick={() => setMobileMenuOpen(false)}
							>
								Experiences
							</Link>
							<Link
								href="/about"
								className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-600 dark:text-slate-100 dark:hover:text-amber-200"
								onClick={() => setMobileMenuOpen(false)}
							>
								About
							</Link>
							<LanguageSelector
								className="w-full"
								size="sm"
								ariaLabel="Interface language"
								onSyncLanguage={handleLanguageSync}
								onAfterSelect={() => setMobileMenuOpen(false)}
							/>
							<ThemeToggle className="self-start" />
							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										router.push("/preferences")
										setMobileMenuOpen(false)
									}}
									className="flex-1 border-amber-200 text-amber-700 transition-colors hover:bg-amber-50 dark:border-slate-700 dark:text-amber-200 dark:hover:bg-slate-900"
								>
									Preferences
								</Button>
								<Button
									size="sm"
									onClick={() => {
										router.push("/dashboard")
										setMobileMenuOpen(false)
									}}
									className="flex-1 bg-amber-700 text-white transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
								>
									Dashboard
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</header>

			<main className="container mx-auto px-4 py-8">
				<section className="mb-16 pt-4">
					<div className="grid items-center gap-8 md:grid-cols-2">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6 }}
							className="order-2 md:order-1"
						>
							<Badge className="mb-4 border-none bg-amber-100 text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-900/40">
								Explore with AI
							</Badge>
							<h1 className="mb-4 text-4xl font-bold leading-tight text-stone-800 transition-colors md:text-5xl dark:text-slate-100">
								Your Journey, <span className="text-amber-700 dark:text-amber-300">Reimagined</span>
							</h1>
							<p className="mb-6 max-w-xl text-lg text-stone-600 transition-colors dark:text-slate-300">
								Discover hidden gems, local secrets, and personalized adventures with our AI travel companion that knows what makes your journey special.
							</p>
							<div className="flex flex-wrap gap-4">
								<Button
									size="lg"
									onClick={() => router.push("/dashboard")}
									className="rounded-full bg-amber-700 px-8 text-white transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
								>
									Start Exploring
								</Button>
								<Button
									size="lg"
									variant="outline"
									onClick={() => router.push("/preferences")}
									className="rounded-full border-amber-300 px-8 text-amber-700 transition-colors hover:bg-amber-100 dark:border-slate-700 dark:text-amber-200 dark:hover:bg-slate-900"
								>
									How It Works
								</Button>
							</div>
							<div className="mt-8 flex items-center">
								<div className="flex -space-x-2">
									{[...Array(4)].map((_, i) => (
										<Avatar key={i} className="border-2 border-white dark:border-slate-900">
											<AvatarImage src={`https://api.dicebear.com/8.x/adventurer/svg?seed=User${i}`} />
											<AvatarFallback>U{i}</AvatarFallback>
										</Avatar>
									))}
								</div>
								<div className="ml-4">
									<div className="font-medium text-stone-800 dark:text-slate-100">10k+ Happy Travelers</div>
									<div className="mt-1 flex text-amber-500">
										{[...Array(5)].map((_, i) => (
											<Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
										))}
									</div>
								</div>
							</div>
						</motion.div>
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.6, delay: 0.2 }}
							className="order-1 rounded-2xl border border-amber-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/80 md:order-2"
						>
							<div className="flex items-center border-b border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 p-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
								<div className="ml-1 flex space-x-1.5">
									<div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
									<div className="h-2.5 w-2.5 rounded-full bg-lime-400" />
									<div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
								</div>
								<div className="mx-auto pr-6 text-sm font-medium text-amber-800 dark:text-amber-200">Travel Companion</div>
							</div>
							<div className="space-y-4 p-4">
								{chatMessages.map((msg, index) => (
									<div
										key={index}
										className={`max-w-[80%] rounded-2xl p-3 ${
											msg.sender === "assistant"
												? "mr-auto bg-amber-50 text-stone-800 dark:bg-slate-900/70 dark:text-slate-100"
												: "ml-auto bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950"
										}`}
									>
										{msg.message}
									</div>
								))}
							</div>
							<div className="flex gap-2 border-t border-amber-100 p-4 dark:border-slate-800">
								<Button className="h-auto rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-slate-900/60 dark:text-amber-200 dark:hover:bg-slate-900">
									Hotel recommendations
								</Button>
								<Button className="h-auto rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-slate-900/60 dark:text-amber-200 dark:hover:bg-slate-900">
									Things to do
								</Button>
							</div>
						</motion.div>
					</div>
				</section>

				<section className="mb-16">
					<div className="mb-10 text-center">
						<Badge className="mb-2 border-none bg-emerald-100 text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
							Features
						</Badge>
						<h2 className="mb-3 text-3xl font-bold text-stone-800 dark:text-slate-100">Discover Your Perfect Adventure</h2>
						<p className="mx-auto max-w-2xl text-stone-600 dark:text-slate-300">
							Our intelligent travel companion helps you create unforgettable journeys with these thoughtfully designed features.
						</p>
					</div>
					<motion.div
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
					>
									{featureCards.map((feature, index) => (
										<motion.div key={feature.title} variants={itemVariants} transition={{ delay: index * 0.05 }}>
											<Link href={feature.link} className="block h-full">
												<Card className={`flex h-full flex-col rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md ${feature.color}`}>
											<CardHeader className="flex-shrink-0 pb-2">
												<div className="flex items-start justify-between">
													{feature.icon}
													{feature.badge && (
														<Badge className="rounded-full bg-white/70 text-xs text-stone-700 dark:bg-slate-900/60 dark:text-slate-100">
															{feature.badge}
														</Badge>
													)}
												</div>
											</CardHeader>
											<CardContent className="flex-grow pt-2">
												<CardTitle className={`mb-1 text-lg font-semibold ${feature.textColor} ${feature.darkTextColor}`}>
													{feature.title}
												</CardTitle>
												<p className={`text-sm ${feature.descriptionColor} ${feature.darkDescriptionColor}`}>
													{feature.description}
												</p>
											</CardContent>
											<CardFooter className="pt-0">
												<Button
													variant="ghost"
													size="sm"
													className={`h-auto p-0 text-xs ${feature.textColor} ${feature.darkTextColor} hover:bg-black/5 dark:hover:bg-white/10`}
												>
													Explore <ArrowRight className="ml-1 h-3 w-3" />
												</Button>
											</CardFooter>
														</Card>
													</Link>
							</motion.div>
						))}
					</motion.div>
				</section>

				<section className="mb-16">
					<div className="mb-10 text-center">
						<Badge className="mb-2 border-none bg-lime-100 text-lime-800 transition-colors hover:bg-lime-200 dark:bg-lime-900/50 dark:text-lime-200 dark:hover:bg-lime-900/40">
							Popular Destinations
						</Badge>
						<h2 className="mb-3 text-3xl font-bold text-stone-800 dark:text-slate-100">Where Will You Go Next?</h2>
						<p className="mx-auto max-w-2xl text-stone-600 dark:text-slate-300">
							Discover trending destinations loved by our community of travelers.
						</p>
					</div>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{popularDestinations.map((destination, index) => (
							<motion.div
								key={destination.name}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: index * 0.1 }}
							>
								<Card className="group overflow-hidden border border-amber-200 transition-colors dark:border-slate-800 dark:bg-slate-950/70">
									<div className="relative h-48 overflow-hidden">
										<Image
											src={destination.image || "/globe.svg"}
											alt={destination.name}
											fill
											sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
											className="object-cover transition-transform duration-500 group-hover:scale-110"
											priority={index === 0}
										/>
										<div className="absolute top-3 right-3 flex items-center rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-amber-800 backdrop-blur-sm dark:bg-slate-900/70 dark:text-amber-200">
											<Star className="mr-1 h-3 w-3 fill-amber-500 text-amber-500" />
											{destination.rating}
										</div>
										<div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-stone-700 backdrop-blur-sm dark:bg-slate-900/70 dark:text-slate-200">
											{destination.category}
										</div>
									</div>
									<CardContent className="p-4">
										<h3 className="mb-1 text-lg font-semibold text-stone-800 dark:text-slate-100">{destination.name}</h3>
										<p className="mb-3 text-sm text-stone-600 dark:text-slate-300">{destination.description}</p>
										<Button
											variant="outline"
											size="sm"
											className="w-full border-amber-200 text-amber-700 transition-colors hover:bg-amber-50 dark:border-slate-700 dark:text-amber-200 dark:hover:bg-slate-900"
										>
											Explore Destination
										</Button>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</section>

				<section className="mb-16">
					<Card className="overflow-hidden rounded-2xl border-none bg-gradient-to-r from-amber-600 to-amber-700 shadow-lg dark:from-slate-900 dark:to-slate-800">
						<CardContent className="p-8 md:p-12">
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5 }}
								className="text-center"
							>
								<h2 className="mb-4 text-3xl font-bold text-white">Ready for your next adventure?</h2>
								<p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
									Our AI travel companion is available 24/7 to help you discover new destinations, find hidden gems, and create unforgettable memories.
								</p>
								<Button
									size="lg"
									onClick={() => router.push("/dashboard")}
									className="rounded-full bg-white px-8 text-amber-700 transition-colors hover:bg-white/90 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
								>
									Start Your Journey
								</Button>
							</motion.div>
						</CardContent>
					</Card>
				</section>

				<section className="mb-16">
					<div className="mb-10 text-center">
						<Badge className="mb-2 border-none bg-stone-100 text-stone-800 transition-colors hover:bg-stone-200 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900/40">
							Traveler Stories
						</Badge>
						<h2 className="mb-3 text-3xl font-bold text-stone-800 dark:text-slate-100">Adventures Shared</h2>
						<p className="mx-auto max-w-2xl text-stone-600 dark:text-slate-300">
							Hear from fellow explorers who discovered something special with our help.
						</p>
					</div>
					<div className="grid gap-6 md:grid-cols-3">
						{testimonials.map((testimonial, index) => (
							<motion.div
								key={testimonial.name}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: index * 0.1 }}
							>
								<Card className="h-full rounded-xl border border-amber-200 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950/70">
									<CardContent className="flex h-full flex-col pt-6">
										<div className="flex h-full flex-col items-center text-center">
											<Avatar className="mb-4 h-16 w-16 border-2 border-amber-200 dark:border-amber-500/60">
												<AvatarImage src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${testimonial.avatar}`} />
												<AvatarFallback>{testimonial.avatar}</AvatarFallback>
											</Avatar>
											<p className="mb-4 italic text-stone-600 dark:text-slate-300">&ldquo;{testimonial.quote}&rdquo;</p>
											<div className="mt-auto">
												<p className="font-medium text-stone-800 dark:text-slate-100">{testimonial.name}</p>
												<p className="mt-1 flex items-center justify-center gap-1 text-sm text-stone-500 dark:text-slate-400">
													<MapPin className="h-3 w-3" /> {testimonial.location}
												</p>
												<div className="mt-2 flex justify-center text-amber-500">
													{[...Array(5)].map((_, i) => (
														<Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
													))}
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</section>

				<section className="mb-16">
					<Card className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 transition-colors dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
						<CardContent className="p-8">
							<div className="grid items-center gap-8 md:grid-cols-2">
								<div>
									<Badge className="mb-2 border-none bg-white text-amber-800 transition-colors hover:bg-white/90 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800">
										Stay Inspired
									</Badge>
									<h2 className="mb-3 text-2xl font-bold text-stone-800 dark:text-slate-100">Get Travel Inspiration Delivered</h2>
									<p className="mb-6 text-stone-600 dark:text-slate-300">
										Join our newsletter for personalized destination recommendations, travel tips, and exclusive deals.
									</p>
									<div className="flex flex-col gap-3 sm:flex-row">
										<input
											type="email"
											placeholder="Your email address"
											className="flex h-10 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-stone-700 transition-colors placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-amber-400 dark:focus-visible:ring-offset-slate-900"
										/>
										<Button className="bg-amber-700 text-white transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400">
											Subscribe
										</Button>
									</div>
									<p className="mt-3 text-xs text-stone-500 dark:text-slate-400">We respect your privacy. Unsubscribe at any time.</p>
								</div>
								<div className="hidden md:block">
									<Image
										src="/window.svg"
										alt="Travel inspiration"
										width={400}
										height={300}
										className="h-auto w-full rounded-lg object-cover"
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</section>
			</main>

			<footer className="border-t border-amber-200 bg-white py-12 transition-colors dark:border-slate-800 dark:bg-slate-950">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 gap-8 md:grid-cols-4">
						<div>
							<div className="mb-4 flex items-center">
								<Globe className="mr-2 h-6 w-6 text-amber-700 dark:text-amber-300" />
								<span className="text-xl font-bold text-stone-800 dark:text-slate-100">DevYatra</span>
							</div>
							<p className="mb-4 text-sm text-stone-600 dark:text-slate-400">
								Discover the world with our AI-powered travel companion that makes every journey unforgettable.
							</p>
							<div className="flex space-x-4 text-amber-700 dark:text-amber-300">
								<a href="#" className="transition-colors hover:text-amber-500" aria-label="DevYatra on Facebook">
									<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path
											fillRule="evenodd"
											d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
											clipRule="evenodd"
										/>
									</svg>
								</a>
								<a href="#" className="transition-colors hover:text-amber-500" aria-label="DevYatra on Twitter">
									<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
									</svg>
								</a>
								<a href="#" className="transition-colors hover:text-amber-500" aria-label="DevYatra on Instagram">
									<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path
											fillRule="evenodd"
											d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 016.07 2.525c.636-.247 1.363-.416 2.427-.465C9.521 2.013 9.876 2 12.315 2zm0 1.44c-2.403 0-2.69.01-3.637.052-.877.04-1.354.184-1.67.307-.42.163-.72.358-1.036.673-.315.316-.51.616-.673 1.037-.123.315-.266.792-.306 1.669-.043.947-.053 1.234-.053 3.637 0 2.403.01 2.69.053 3.637.04.877.183 1.354.306 1.67.163.42.358.72.673 1.036.316.315.616.51 1.037.673.315.123.792.266 1.669.306.947.043 1.234.053 3.637.053 2.403 0 2.69-.01 3.637-.053.877-.04 1.354-.183 1.67-.306.42-.163.72-.358 1.036-.673.315-.316.51-.616.673-1.037.123-.315.266-.792.306-1.669.043-.947.053-1.234.053-3.637 0-2.403-.01-2.69-.053-3.637-.04-.877-.183-1.354-.306-1.67a3.462 3.462 0 00-.673-1.036 3.462 3.462 0 00-1.036-.673c-.315-.123-.792-.266-1.669-.306-.947-.043-1.234-.053-3.637-.053zm0 3.182a4.373 4.373 0 110 8.746 4.373 4.373 0 010-8.746zm0 1.44a2.933 2.933 0 100 5.866 2.933 2.933 0 000-5.866zm4.602-2.897a1.02 1.02 0 110 2.04 1.02 1.02 0 010-2.04z"
											clipRule="evenodd"
										/>
									</svg>
								</a>
							</div>
						</div>
						<div>
							<h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-800 dark:text-slate-200">Explore</h3>
							<ul className="space-y-2">
								<li>
									<Link href="/destinations" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Destinations
									</Link>
								</li>
								<li>
									<Link href="/experiences" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Experiences
									</Link>
								</li>
								<li>
									<Link href="/tickets" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Tickets
									</Link>
								</li>
								<li>
									<Link href="/safety" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Safety Maps
									</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-800 dark:text-slate-200">Company</h3>
							<ul className="space-y-2">
								<li>
									<Link href="/about" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										About Us
									</Link>
								</li>
								<li>
									<Link href="/careers" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Careers
									</Link>
								</li>
								<li>
									<Link href="/blog" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Blog
									</Link>
								</li>
								<li>
									<Link href="/contact" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Contact
									</Link>
								</li>
							</ul>
						</div>
						<div>
							<h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-800 dark:text-slate-200">Legal</h3>
							<ul className="space-y-2">
								<li>
									<Link href="/privacy" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Privacy Policy
									</Link>
								</li>
								<li>
									<Link href="/terms" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Terms of Service
									</Link>
								</li>
								<li>
									<Link href="/cookies" className="text-stone-600 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-200">
										Cookie Policy
									</Link>
								</li>
							</ul>
						</div>
					</div>
					<div className="mt-8 border-t border-amber-100 pt-8 text-center text-sm text-stone-600 dark:border-slate-800 dark:text-slate-400">
						© {new Date().getFullYear()} DevYatra. All rights reserved.
					</div>
				</div>
			</footer>
		</div>
	)
}

