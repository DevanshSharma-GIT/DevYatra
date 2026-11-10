"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { Menu, Search, MapPin, Compass, Palmtree, Globe, User, Leaf, Heart, Car, Users } from "lucide-react"
import { motion } from "framer-motion"

const routes = [
  { name: "Home", path: "/", icon: <Palmtree className="h-4 w-4" /> },
  { name: "Destinations", path: "/destinations", icon: <Globe className="h-4 w-4" /> },
  { name: "Explore", path: "/explore", icon: <Compass className="h-4 w-4" /> },
  { name: "Map", path: "/map", icon: <MapPin className="h-4 w-4" /> },
  { name: "Pilgrim Engagement", path: "/pilgrim-engagement", icon: <Heart className="h-4 w-4" /> },
  { name: "Smart Queue", path: "/smart-queue", icon: <Users className="h-4 w-4" /> },
  { name: "Traffic & Mobility", path: "/traffic-mobility", icon: <Car className="h-4 w-4" /> },
]

export default function Navbar({ points }: { points?: number }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled ? "bg-background/80 backdrop-blur-md shadow-md" : "bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px]">
              <div className="flex flex-col gap-6 mt-8">
                {routes.map((route) => (
                  <Link
                    key={route.path}
                    href={route.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-base font-medium transition-colors",
                      pathname === route.path ? "text-primary" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    {route.icon}
                    {route.name}
                  </Link>
                ))}
                <Link
                  href="/carbon-offset"
                  className={cn(
                    "flex items-center text-sm font-medium transition-colors hover:text-primary",
                    pathname === "/carbon-offset"
                      ? "text-black dark:text-white"
                      : "text-muted-foreground"
                  )}
                >
                  <Leaf className="mr-2 h-4 w-4" />
                  <span>Carbon Offset</span>
                </Link>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold">Wanderlust</span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {routes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className={cn(
                "animated-underline flex items-center gap-1.5 text-sm font-medium transition-colors",
                pathname === route.path ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              {route.icon}
              {route.name}
            </Link>
          ))}
          <Link
            href="/carbon-offset"
            className={cn(
              "flex items-center text-sm font-medium transition-colors hover:text-primary",
              pathname === "/carbon-offset"
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            <Leaf className="mr-2 h-4 w-4" />
            <span>Carbon Offset</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {showSearch ? (
            <div className="relative">
              <Input placeholder="Search destinations..." className="w-[200px] pr-8 rounded-full" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowSearch(false)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
              <Search className="h-5 w-5" />
            </Button>
          )}

          <ModeToggle />

          <Button className="rounded-full btn-hover">
            <User className="h-4 w-4 mr-2" />
            Login
          </Button>
        </div>
      </div>
    </motion.header>
  )
}
