"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAccessibility } from "@/components/accessibility/accessibility-provider"

const ROUTE_DESCRIPTIONS: Record<string, string> = {
  "/": "Home dashboard showing featured journeys, live alerts, and quick actions.",
  "/dashboard": "Analytics dashboard with crowd insights, resource usage, and sentiment trends.",
  "/travel-services": "Travel services hub with itinerary planning, bookings, and concierge support.",
  "/travel-services/shuttle": "Shuttle tracker displaying live locations, occupancy, and arrival estimates.",
  "/travel-services/hotels": "Accommodation planner with curated hotels and pricing information.",
  "/travel-services/flights": "Flight planner offering route comparisons and booking shortcuts.",
  "/travel-services/rail": "Rail planner summarising train schedules, platform info, and crowd levels.",
  "/travel-services/local": "Local transport guide for taxis, buses, and assisted mobility options.",
  "/travel-services/emergency": "Emergency travel assistance centre with priority contact options.",
  "/voice": "Voice concierge for conversational assistance and smart commands.",
  "/split": "Travel cost split planner to manage shared expenses and settlement suggestions.",
  "/groups": "Group orchestration space with shared itineraries, chat, and live coordination.",
  "/carbon-offset": "Carbon offset marketplace displaying greener alternatives and contribution history.",
  "/carbon-offset/history": "Carbon offset history with transaction summaries and impact stats.",
  "/carbon-offset/certificates": "Digital certificates showcasing verified sustainability actions.",
  "/memory": "Memory lane showcasing captured media, highlights, and story narration.",
  "/safety": "Safety centre featuring advisories, SOS actions, and local support contact details.",
  "/safety/analysis": "Safety analysis tools with location heatmaps and risk mitigation tips.",
  "/tickets": "Smart ticketing planner managing queue slots, pass activation, and check-in alerts.",
  "/smart-queue": "Smart queue management overview with real-time wait times and slot booking.",
  "/traffic-mobility": "Traffic and mobility dashboard combining maps, congestion layers, and routing assistance.",
  "/api-test": "API integration test bed for validating service connectivity and payloads.",
  "/chatbot": "Conversational chatbot for quick answers, itinerary tweaks, and support links.",
  "/native": "Native device capabilities preview demonstrating offline and AR handoffs.",
  "/ar": "Augmented reality exploration launching immersive heritage overlays.",
  "/ar-guide": "Immersive AR guide with smart narration, navigation cues, and contextual info.",
  "/crowd-analyzer": "Crowd analyzer with density heatmaps, risk scores, and recommended interventions.",
  "/dashboard/insights": "Detailed analytics with KPI breakdowns, anomaly alerts, and forecasts.",
  "/preferences": "Personalisation preferences including travel style, accessibility, and notification settings.",
  "/preferences/notifications": "Notification preferences for alerts, reminders, and escalation contacts.",
  "/preferences/accessibility": "Accessibility preferences for contrast, narration, text size, and haptic guidance.",
}

const INTERACTION_ROLES: Record<string, string> = {
  button: "button",
  a: "link",
  input: "input",
  select: "select",
  textarea: "text area",
  summary: "toggle summary",
}

const ROLE_FALLBACKS: Record<string, string> = {
  tab: "tab",
  menuitem: "menu item",
  option: "list option",
  switch: "switch",
  dialog: "dialog",
  slider: "slider",
  checkbox: "checkbox",
  radio: "radio button",
  combobox: "combo box",
}

function normalisePath(pathname: string | null): string {
  if (!pathname) return "/"
  if (pathname === "") return "/"
  return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname
}

function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return null
  return text.length > 240 ? `${text.slice(0, 237)}…` : text
}

function formatSegment(segment: string): string {
  if (!segment) return ""
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\d+/g, (match) => match)
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildFallbackRouteDescription(pathname: string): string {
  if (pathname === "/") return "Home"
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map(formatSegment)
  return segments.length ? `Section ${segments.join(" › ")}` : "Current section"
}

function resolveRouteDescription(pathname: string): string {
  const direct = ROUTE_DESCRIPTIONS[pathname]
  if (direct) return direct
  return buildFallbackRouteDescription(pathname)
}

function discoverPrimaryHeading(): string | null {
  const main = document.getElementById("main-content") ?? document.querySelector("main")
  if (!main) return null
  const markedHeading = main.querySelector<HTMLElement>('[data-voice-heading]')
  if (markedHeading) {
    return cleanText(markedHeading.dataset.voiceHeading ?? markedHeading.textContent)
  }
  const semanticHeading = main.querySelector<HTMLElement>(
    'h1, h2, [role="heading"], [aria-level]'
  )
  if (semanticHeading) {
    const labelledBy = semanticHeading.getAttribute("aria-labelledby")
    if (labelledBy) {
      const labelledElement = document.getElementById(labelledBy)
      if (labelledElement) {
        const labelText = cleanText(labelledElement.textContent)
        if (labelText) return labelText
      }
    }
    const label = cleanText(
      semanticHeading.getAttribute("aria-label") ?? semanticHeading.textContent,
    )
    if (label) return label
  }
  return null
}

function getElementRole(element: HTMLElement): string | null {
  const explicitRole = element.getAttribute("role")
  if (explicitRole) {
    return ROLE_FALLBACKS[explicitRole] ?? explicitRole.replace(/[-_]/g, " ")
  }
  const tagRole = INTERACTION_ROLES[element.tagName.toLowerCase()]
  if (tagRole) return tagRole
  if (element instanceof HTMLButtonElement) return "button"
  if (element instanceof HTMLAnchorElement) return "link"
  if (element instanceof HTMLInputElement) return element.type === "range" ? "slider" : "input"
  if (element instanceof HTMLSelectElement) return "select"
  if (element instanceof HTMLTextAreaElement) return "text area"
  return null
}

function readAriaReference(element: HTMLElement, attr: "aria-labelledby" | "aria-describedby"): string | null {
  const ref = element.getAttribute(attr)
  if (!ref) return null
  const ids = ref.split(/\s+/).filter(Boolean)
  if (!ids.length) return null
  const text = ids
    .map((id) => document.getElementById(id))
    .filter((node): node is HTMLElement => Boolean(node))
    .map((node) => cleanText(node.textContent))
    .filter((value): value is string => Boolean(value))
    .join(" ")
  return text || null
}

function deriveElementLabel(element: HTMLElement): string | null {
  const dataLabel = element.dataset.voiceLabel ?? element.dataset.voiceHint
  if (dataLabel) {
    const cleaned = cleanText(dataLabel)
    if (cleaned) return cleaned
  }

  const ariaLabel = cleanText(element.getAttribute("aria-label"))
  if (ariaLabel) return ariaLabel

  const ariaLabelledBy = readAriaReference(element, "aria-labelledby")
  if (ariaLabelledBy) return ariaLabelledBy

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = cleanText(element.placeholder)
    if (placeholder) return placeholder
  }

  const alt = cleanText((element as HTMLImageElement).alt)
  if (alt) return alt

  const text = cleanText(element.textContent)
  if (text) return text

  const title = cleanText(element.getAttribute("title"))
  return title
}

function describeInputValue(element: HTMLElement): string | null {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") {
      return element.checked ? "checked" : "not checked"
    }
    if (element.type === "radio") {
      return element.checked ? "selected" : "not selected"
    }
    if (element.type === "range") {
      return `current value ${element.value}`
    }
    if (element.type === "number" || element.type === "text" || element.type === "search") {
      if (element.value) return `value ${element.value}`
    }
  }
  if (element instanceof HTMLSelectElement) {
    const option = element.selectedOptions?.[0]
    if (option) return `selected ${cleanText(option.textContent) ?? option.value}`
  }
  if (element instanceof HTMLTextAreaElement && element.value) {
    return element.value.length > 60
      ? `text area with ${element.value.length} characters`
      : `value ${element.value}`
  }
  return null
}

type InteractionDetails = {
  role: string | null
  label: string | null
  value: string | null
}

function getInteractionDetails(element: HTMLElement): InteractionDetails {
  return {
    role: getElementRole(element),
    label: deriveElementLabel(element),
    value: describeInputValue(element),
  }
}

function readAriaState(element: HTMLElement): string | null {
  const expanded = element.getAttribute("aria-expanded")
  if (expanded === "true") return "expanded"
  if (expanded === "false") return "collapsed"

  const pressed = element.getAttribute("aria-pressed")
  if (pressed === "true") return "pressed"
  if (pressed === "false") return "not pressed"

  const checked = element.getAttribute("aria-checked")
  if (checked === "true") return "checked"
  if (checked === "false") return "not checked"

  return null
}

function formatActivationAnnouncement(element: HTMLElement, details: InteractionDetails): string | null {
  const actionHint = cleanText(element.dataset.voiceActivation ?? element.dataset.voiceAction)
  if (actionHint) {
    return actionHint
  }

  const ariaState = readAriaState(element)
  if (ariaState) {
    if (!details.role && !details.label) {
      return `Activated. ${ariaState}`
    }
    const rolePart = details.role ? details.role : "element"
    const labelPart = details.label ? ` ${details.label}` : ""
    return `Activated ${rolePart}${labelPart}. ${ariaState}`.trim()
  }

  if (!details.role && !details.label && !details.value) {
    return "Activated"
  }

  const rolePart = details.role ? details.role : "element"
  const labelPart = details.label ? ` ${details.label}` : ""
  const valuePart = details.value ? `. ${details.value}` : ""
  return `Activated ${rolePart}${labelPart}${valuePart}`.trim()
}

export function AccessibilityObserver() {
  const pathname = usePathname()
  const query = useSearchParams()
  const normalisedPath = useMemo(() => normalisePath(pathname), [pathname])
  const queryDescription = useMemo(() => {
    if (!query?.toString()) return ""
    return query
      .toString()
      .split("&")
      .map((pair) => {
        const [key, value] = pair.split("=")
        return `${formatSegment(key)} ${decodeURIComponent(value ?? "")}`
      })
      .join(", ")
  }, [query])

  const { voiceFeedback, announce, speak } = useAccessibility()

  const lastRouteAnnouncementRef = useRef<{ path: string; timestamp: number }>({
    path: "",
    timestamp: 0,
  })
  const lastInteractionRef = useRef<{ message: string; timestamp: number }>({
    message: "",
    timestamp: 0,
  })
  const skipActivationRef = useRef(false)

  useEffect(() => {
    if (!voiceFeedback) return
    const currentPath = normalisePath(pathname)
    const message = resolveRouteDescription(currentPath)
    const heading = discoverPrimaryHeading()

    const extras: string[] = []
    if (heading && !message.toLowerCase().includes(heading.toLowerCase())) {
      extras.push(heading)
    }
    if (queryDescription) {
      extras.push(`Filters ${queryDescription}`)
    }

    const fullMessage = [message, ...extras].join(". ")
    const timestamp = Date.now()
    const previous = lastRouteAnnouncementRef.current
    if (previous.path === currentPath && timestamp - previous.timestamp < 600) {
      return
    }

    const timeout = window.setTimeout(() => {
      announce(fullMessage, { politeness: "assertive", interrupt: true })
      lastRouteAnnouncementRef.current = { path: currentPath, timestamp: Date.now() }
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [announce, normalisedPath, pathname, queryDescription, voiceFeedback])

  useEffect(() => {
    if (!voiceFeedback) return

    const handleClick = (event: MouseEvent) => {
      if (skipActivationRef.current) {
        skipActivationRef.current = false
        return
      }
      const target = event.target as HTMLElement | null
      if (!target) return
      const details = getInteractionDetails(target)
      const message = formatActivationAnnouncement(target, details)
      if (!message) return
      const now = Date.now()
      const last = lastInteractionRef.current
      if (last.message === message && now - last.timestamp < 600) return
      lastInteractionRef.current = { message, timestamp: now }
      speak(message, { interrupt: false, rate: 1 })
    }

    const handleKeyActivation = (event: KeyboardEvent) => {
      if (skipActivationRef.current) {
        skipActivationRef.current = false
        return
      }
      if (event.key !== "Enter" && event.key !== " ") return
      const target = event.target as HTMLElement | null
      if (!target) return
      const details = getInteractionDetails(target)
      const message = formatActivationAnnouncement(target, details)
      if (!message) return
      const now = Date.now()
      const last = lastInteractionRef.current
      if (last.message === message && now - last.timestamp < 600) return
      lastInteractionRef.current = { message, timestamp: now }
      speak(message, { interrupt: false, rate: 1 })
    }

    const handleCustomAnnouncement = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>
      const detailMessage = cleanText(custom.detail?.message ?? "")
      if (!detailMessage) return
      speak(detailMessage, { interrupt: false })
    }

    window.addEventListener("click", handleClick, true)
    window.addEventListener("keydown", handleKeyActivation, true)
    window.addEventListener("heritedge:announce", handleCustomAnnouncement as EventListener)

    return () => {
      window.removeEventListener("click", handleClick, true)
      window.removeEventListener("keydown", handleKeyActivation, true)
      window.removeEventListener("heritedge:announce", handleCustomAnnouncement as EventListener)
    }
  }, [speak, voiceFeedback])

  useEffect(() => {
    if (!voiceFeedback) return

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-voice-announcement") {
          const target = mutation.target as HTMLElement
          const announcement = cleanText(target.dataset.voiceAnnouncement)
          if (!announcement) continue
          const now = Date.now()
          const last = lastInteractionRef.current
          if (last.message === announcement && now - last.timestamp < 500) continue
          lastInteractionRef.current = { message: announcement, timestamp: now }
          speak(announcement, { interrupt: false })
        }
      }
    })

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-voice-announcement"],
    })

    return () => observer.disconnect()
  }, [speak, voiceFeedback])

  useEffect(() => {
    const handleSkip = () => {
      skipActivationRef.current = true
      window.setTimeout(() => {
        skipActivationRef.current = false
      }, 120)
    }

    window.addEventListener("heritedge:skip-activation", handleSkip)
    return () => window.removeEventListener("heritedge:skip-activation", handleSkip)
  }, [])

  return null
}
