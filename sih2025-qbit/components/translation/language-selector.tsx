"use client"

import type { ChangeEvent } from "react"
import { useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "@/components/translation/translation-provider"
import { cn } from "@/lib/utils"

interface LanguageSelectorProps {
  className?: string
  size?: "default" | "sm"
  ariaLabel?: string
  onSyncLanguage?: (languageCode: string) => void
  onAfterSelect?: (languageCode: string) => void
}

export function LanguageSelector({
  className,
  size = "default",
  ariaLabel = "Interface language",
  onSyncLanguage,
  onAfterSelect,
}: LanguageSelectorProps) {
  const { currentLanguage, translateTo, isTranslating, languages } = useTranslation()

  const groupedLanguages = useMemo(() => languages, [languages])

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value
    onSyncLanguage?.(nextLanguage)
    onAfterSelect?.(nextLanguage)
    await translateTo(nextLanguage)
  }

  return (
    <div className={cn("relative inline-flex items-center", className)} data-translate-exclude>
      <select
        value={currentLanguage}
        onChange={handleChange}
        disabled={isTranslating}
        aria-label={ariaLabel}
        className={cn(
          "appearance-none rounded-full border bg-white/70 pr-9 font-medium text-amber-800 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
          size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-1.5 text-sm",
          "border-amber-200 hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-amber-50/70",
        )}
      >
        {groupedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-amber-700" aria-hidden />
    </div>
  )
}
