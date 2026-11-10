"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"
import { cn } from "@/lib/utils"

const SIZE_CLASSES: Record<string, string> = {
  normal: "text-base md:text-lg",
  large: "text-lg md:text-xl",
  xlarge: "text-xl md:text-2xl",
}

export function AccessibilityCaptions() {
  const { captionsEnabled, activeCaption, clearCaption, textScale } = useAccessibility()

  const sizeClass = useMemo(() => {
    return SIZE_CLASSES[textScale] ?? SIZE_CLASSES.normal
  }, [textScale])

  return (
    <AnimatePresence>
      {captionsEnabled && activeCaption ? (
        <motion.div
          key={activeCaption.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", damping: 20, stiffness: 180 }}
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-[1200] flex justify-center px-4"
        >
          <div
            className={cn(
              "w-full max-w-3xl rounded-2xl border border-border/80 bg-background/90 px-6 py-5 shadow-2xl backdrop-blur",
              "ring-1 ring-primary/20",
              "transition-[transform,box-shadow]",
              sizeClass,
            )}
            role="status"
          >
            <p className="font-semibold leading-relaxed text-center text-foreground/95">
              {activeCaption.message}
            </p>
            <button
              type="button"
              onClick={clearCaption}
              className="pointer-events-auto mt-3 block w-full text-center text-sm font-medium text-primary underline"
            >
              Dismiss captions
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
