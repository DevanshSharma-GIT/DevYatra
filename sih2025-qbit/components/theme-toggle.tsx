"use client"

import { useEffect, useId, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const switchId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = (resolvedTheme ?? theme) === "dark"

  const handleToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light")
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Sun className={cn("h-4 w-4 text-amber-500 transition", isDark && "opacity-40")}
        aria-hidden
      />
      <Switch id={switchId} aria-label="Toggle dark mode" checked={mounted ? isDark : false} onCheckedChange={handleToggle} />
      <Moon className={cn("h-4 w-4 text-slate-400 transition", isDark ? "opacity-100" : "opacity-40")}
        aria-hidden
      />
    </div>
  )
}
