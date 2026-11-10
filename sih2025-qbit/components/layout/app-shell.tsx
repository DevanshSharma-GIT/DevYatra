import React from "react";
import { motion, AnimatePresence } from "framer-motion"; // Added AnimatePresence import
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import {
  Globe,
  MapPin,
  Camera,
  Shield,
  MessageSquare,
  Ticket,
  Home,
  Settings,
  Menu,
  X,
} from "lucide-react";
import Navbar from "@/components/navbar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  showMenu?: boolean;
  points?: number;
}

export function AppShell({ children, showMenu = true, points }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { path: "/chatbot", label: "AI Assistant", icon: <MessageSquare className="h-5 w-5" /> },
    { path: "/ar-guide", label: "AR Guide", icon: <Globe className="h-5 w-5" /> },
    { path: "/safety", label: "Safety Map", icon: <Shield className="h-5 w-5" /> },
    { path: "/tickets", label: "Tickets", icon: <Ticket className="h-5 w-5" /> },
    { path: "/memory", label: "Memories", icon: <Camera className="h-5 w-5" /> },
    { path: "/travel-services", label: "Travel Services", icon: <MapPin className="h-5 w-5" /> },
    { path: "/preferences", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50 to-teal-100">
      <Navbar points={points} />

      <div className="flex flex-1">
        {/* Desktop sidebar navigation */}
        {showMenu && (
          <div className="hidden md:block w-64 pt-8 bg-white shadow-sm border-r border-gray-200">
            <div className="space-y-1 px-3">
              {navItems.map((item) => (
                <Link href={item.path} key={item.path}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === item.path
                        ? "bg-teal-100 text-teal-900"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <div className={pathname === item.path ? "text-teal-700" : "text-gray-500"}>{item.icon}</div>
                    <span>{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Mobile menu button */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg bg-teal-600 hover:bg-teal-700"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile navigation overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute right-0 top-0 bottom-0 w-64 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1 pt-12">
                  {navItems.map((item) => (
                    <Link
                      href={item.path}
                      key={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors",
                        pathname === item.path
                          ? "bg-teal-100 text-teal-900"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <div className={pathname === item.path ? "text-teal-700" : "text-gray-500"}>{item.icon}</div>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 px-4 py-8 md:px-6 md:py-8 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

