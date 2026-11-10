"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { AuthRole } from "@/lib/auth"
import {
  MapPin,
  Star,
  Upload,
  User as UserIcon,
  MessageSquare,
  Image as ImageIcon,
  Send,
} from "lucide-react"
import somnathImage from "@/somnath temple.jpg"
import ambajiImage from "@/ambaji-temple.jpg"
import dwarkaImage from "@/Dwarka-Temple.jpg"
import pavagadhImage from "@/pavagadh temple.jpg"

const STORAGE_KEY = "heritedge_gj_reviews_v1"
const MAX_MEDIA_PER_ENTRY = 4

const TEMPLES = [
  {
    id: "somnath",
    name: "Somnath Temple",
    location: "Prabhas Patan, Gir Somnath",
    coordinates: "20.8880° N, 70.4017° E",
    image: somnathImage,
  },
  {
    id: "ambaji",
    name: "Ambaji Temple",
    location: "Danta, Banaskantha",
    coordinates: "24.5024° N, 72.8471° E",
    image: ambajiImage,
  },
  {
    id: "dwarka",
    name: "Dwarkadhish Temple",
    location: "Dwarka, Devbhoomi Dwarka",
    coordinates: "22.2380° N, 68.9670° E",
    image: dwarkaImage,
  },
  {
    id: "pavagadh",
    name: "Pavagadh Temple",
    location: "Pavagadh Hill, Panchmahal",
    coordinates: "22.4908° N, 73.5217° E",
    image: pavagadhImage,
  },
] as const

type TempleId = (typeof TEMPLES)[number]["id"]

type ReviewRole = "user" | "admin"

interface ReplyEntry {
  id: string
  message: string
  photos: string[]
  authorName: string
  role: ReviewRole
  createdAt: string
}

interface ReviewEntry {
  id: string
  templeId: TempleId
  templeName: string
  templeImage: string
  rating: number
  message: string
  photos: string[]
  authorName: string
  role: ReviewRole
  createdAt: string
  replies: ReplyEntry[]
}

interface ReviewsRatingsCardProps {
  userRole: AuthRole
  username: string
}

const defaultAvatarFor = (name: string) => name?.slice(0, 2).toUpperCase() || "GU"

const readFilesAsDataUrl = async (files: File[]): Promise<string[]> => {
  const converters = files.map(
    (file) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (error) => reject(error)
        reader.readAsDataURL(file)
      }),
  )

  return Promise.all(converters)
}

const getRoleBadgeStyle = (role: ReviewRole) =>
  role === "admin"
    ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
    : "bg-emerald-100 text-emerald-700 border border-emerald-200"

export function ReviewsRatingsCard({ userRole, username }: ReviewsRatingsCardProps) {
  const [selectedTemple, setSelectedTemple] = useState<TempleId>(TEMPLES[0].id)
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState("")
  const [media, setMedia] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewEntry[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? (parsed as ReviewEntry[]) : []
    } catch (error) {
      console.warn("Unable to load stored reviews", error)
      return []
    }
  })
  const [replyDrafts, setReplyDrafts] = useState<Record<string, { message: string; photos: string[] }>>({})

  const displayName = useMemo(() => username || (userRole === "admin" ? "Temple Admin" : "Guest Traveller"), [userRole, username])
  const isAdmin = userRole === "admin"

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  }, [reviews])

  const selectedTempleInfo = useMemo(() => TEMPLES.find((temple) => temple.id === selectedTemple) ?? TEMPLES[0], [selectedTemple])

  const resetTravellerForm = () => {
    setRating(0)
    setMessage("")
    setMedia([])
    setFormError(null)
  }

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const roomLeft = MAX_MEDIA_PER_ENTRY - media.length
    const truncatedFiles = files.slice(0, roomLeft)

    try {
      const encoded = await readFilesAsDataUrl(truncatedFiles)
      setMedia((prev) => [...prev, ...encoded].slice(0, MAX_MEDIA_PER_ENTRY))
    } catch (error) {
      console.error("Failed to read media", error)
    } finally {
      event.target.value = ""
    }
  }

  const handleReplyMediaUpload = async (reviewId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const currentDraft = replyDrafts[reviewId] ?? { message: "", photos: [] }
    const roomLeft = MAX_MEDIA_PER_ENTRY - currentDraft.photos.length
    const truncatedFiles = files.slice(0, roomLeft)

    try {
      const encoded = await readFilesAsDataUrl(truncatedFiles)
      setReplyDrafts((prev) => ({
        ...prev,
        [reviewId]: {
          message: currentDraft.message,
          photos: [...currentDraft.photos, ...encoded].slice(0, MAX_MEDIA_PER_ENTRY),
        },
      }))
    } catch (error) {
      console.error("Failed to read reply media", error)
    } finally {
      event.target.value = ""
    }
  }

  const handleTravellerSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isAdmin) return

    if (!rating) {
      setFormError("Please add a rating before submitting your review.")
      return
    }

    if (!message.trim()) {
      setFormError("Share a few words about your experience before submitting.")
      return
    }

    const timestamp = new Date().toISOString()
    const newReview: ReviewEntry = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      templeId: selectedTempleInfo.id,
      templeName: selectedTempleInfo.name,
  templeImage: selectedTempleInfo.image.src,
      rating,
      message: message.trim(),
      photos: media,
      authorName: displayName,
      role: "user",
      createdAt: timestamp,
      replies: [],
    }

    setReviews((prev) => [newReview, ...prev])
    resetTravellerForm()
  }

  const handleRemoveMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveReplyMedia = (reviewId: string, index: number) => {
    setReplyDrafts((prev) => {
      const current = prev[reviewId]
      if (!current) return prev
      return {
        ...prev,
        [reviewId]: {
          ...current,
          photos: current.photos.filter((_, i) => i !== index),
        },
      }
    })
  }

  const handleReplyMessageChange = (reviewId: string, value: string) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [reviewId]: {
        message: value,
        photos: prev[reviewId]?.photos ?? [],
      },
    }))
  }

  const handleReplySubmit = (reviewId: string) => {
    const draft = replyDrafts[reviewId]
    if (!draft || (!draft.message.trim() && draft.photos.length === 0)) {
      return
    }

    const timestamp = new Date().toISOString()
    const reply: ReplyEntry = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      message: draft.message.trim(),
      photos: draft.photos,
      authorName: displayName,
      role: "admin",
      createdAt: timestamp,
    }

    setReviews((prev) =>
      prev.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              replies: [...review.replies, reply],
            }
          : review,
      ),
    )

    setReplyDrafts((prev) => ({
      ...prev,
      [reviewId]: { message: "", photos: [] },
    }))
  }

  const renderStars = (value: number, size: "sm" | "md" = "md") => {
    const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5"
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(iconSize, star <= value ? "fill-amber-400 text-amber-500" : "text-slate-300")}
          />
        ))}
      </div>
    )
  }

  const experienceCountByTemple = useMemo(() => {
    return reviews.reduce<Record<TempleId, number>>((acc, review) => {
      acc[review.templeId] = (acc[review.templeId] ?? 0) + 1
      return acc
    }, {} as Record<TempleId, number>)
  }, [reviews])

  const travellerForm = !isAdmin && (
    <form className="space-y-5" onSubmit={handleTravellerSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLES.map((temple) => (
          <button
            key={temple.id}
            type="button"
            onClick={() => setSelectedTemple(temple.id)}
            className={cn(
              "relative overflow-hidden rounded-2xl text-left transition ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
              selectedTemple === temple.id ? "ring-2 ring-amber-500" : "ring-1 ring-transparent",
            )}
          >
            <div className="relative h-36 w-full">
              <Image
                src={temple.image}
                alt={`${temple.name} backdrop`}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
                priority={temple.id === "somnath"}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/70" />
              <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
                <div className="text-lg font-semibold leading-tight drop-shadow-md">{temple.name}</div>
                <div className="flex items-center text-xs text-white/80 gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  <span>{temple.location}</span>
                </div>
                <div className="text-[10px] text-white/70 mt-1">{temple.coordinates}</div>
                {experienceCountByTemple[temple.id] && (
                  <Badge className="mt-2 w-fit bg-white/90 text-slate-800">{experienceCountByTemple[temple.id]} shared stories</Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-700">How was your darshan experience at {selectedTempleInfo.name}?</div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="p-1"
              aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
            >
              <Star className={cn("h-6 w-6 transition", value <= rating ? "fill-amber-400 text-amber-500" : "text-slate-300" )} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 500))}
          placeholder={`Share how ${selectedTempleInfo.name} made you feel, tips for other pilgrims, or special rituals you enjoyed...`}
          className="min-h-[120px] resize-y border-amber-200/60 focus-visible:ring-amber-500/70"
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Ratings are public and help other travellers plan meaningful visits.</span>
          <span>{message.trim().length} / 500</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={handleMediaUpload}
          className="max-w-xs cursor-pointer border-dashed border-amber-300 bg-amber-50/40 text-slate-700"
        />
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Upload className="h-3.5 w-3.5" /> Add up to {MAX_MEDIA_PER_ENTRY} photos
        </span>
      </div>

      {media.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {media.map((src, index) => (
            <div key={`${src}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-lg border border-amber-100">
              <Image src={src} alt={`${selectedTempleInfo.name} memory`} fill className="object-cover" sizes="96px" unoptimized />
              <button
                type="button"
                onClick={() => handleRemoveMedia(index)}
                className="absolute top-1 right-1 rounded-full bg-black/60 px-1 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MessageSquare className="h-3.5 w-3.5" /> Feedback helps temple boards to improve every darshan queue.
        </div>
        <Button type="submit" className="bg-amber-700 text-white hover:bg-amber-800">
          Share your blessings
        </Button>
      </div>
    </form>
  )

  return (
    <Card className="shadow-lg border border-amber-200 overflow-hidden bg-white/95 dark:bg-slate-900/70 dark:border-amber-500/30">
      <CardHeader className="bg-gradient-to-r from-amber-100 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-stone-900 dark:text-amber-100">
          <span className="text-xl font-semibold">Reviews & Ratings • Gujarat Temples</span>
          <Badge variant="secondary" className="bg-amber-200 text-amber-800 border border-amber-300">
            Shared across travellers & admins
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        {!isAdmin ? (
          travellerForm
        ) : (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-5 text-sm text-indigo-800">
            As an admin you can view every pilgrim story and reply with guidance or gratitude. Ratings are locked to
            travellers to keep the sentiment authentic.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-600" />
            <h3 className="text-lg font-semibold text-stone-900 dark:text-amber-100">Pilgrim Stories</h3>
            <span className="text-xs text-slate-500">({reviews.length || "No"} entries yet)</span>
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-6 text-center text-sm text-amber-700">
              Be the first to share your darshan experience across Somnath, Ambaji, Dwarka or Pavagadh.
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-amber-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:bg-slate-900/60 dark:border-amber-500/20"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 border border-amber-200 bg-amber-50">
                        <AvatarImage src="" alt={review.authorName} />
                        <AvatarFallback>
                          <UserIcon className="h-6 w-6 text-amber-600" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-semibold text-stone-900 dark:text-amber-100">{review.authorName}</div>
                        <div className="mt-1">
                          <Badge className={cn("text-[10px]", getRoleBadgeStyle(review.role))}>
                            {review.role === "admin" ? "Admin" : "Traveller"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{new Date(review.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">{review.templeName}</div>
                      {renderStars(review.rating, "sm")}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm text-stone-700 dark:bg-slate-800/60 dark:border-amber-500/20 dark:text-slate-200">
                    {review.message}
                  </div>

                  {review.photos.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {review.photos.map((photo, index) => (
                        <div key={`${photo}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-lg border border-amber-100">
                          <Image src={photo} alt={`${review.templeName} submission`} fill className="object-cover" sizes="96px" unoptimized />
                        </div>
                      ))}
                    </div>
                  )}

                  {review.replies.length > 0 && (
                    <div className="mt-5 space-y-4">
                      {review.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="ml-0 sm:ml-14 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:border-amber-500/30"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 border border-indigo-200 bg-indigo-50">
                              <AvatarImage src="" alt={reply.authorName} />
                              <AvatarFallback>
                                <UserIcon className="h-5 w-5 text-indigo-600" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                <div className="font-semibold text-slate-800 dark:text-amber-100">{reply.authorName}</div>
                                <Badge className={cn("mt-1 w-fit text-[10px]", getRoleBadgeStyle(reply.role))}>Admin</Badge>
                              </div>
                              <div className="mt-2 text-slate-700 dark:text-slate-200">{reply.message}</div>
                              {reply.photos.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {reply.photos.map((photo, index) => (
                                    <div key={`${photo}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-md border border-indigo-100">
                                      <Image src={photo} alt="Admin follow-up" fill className="object-cover" sizes="80px" unoptimized />
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 text-xs text-indigo-500/80">{new Date(reply.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-6 space-y-3 rounded-xl border border-indigo-200/60 bg-white/70 p-4 dark:bg-slate-900/40">
                      <div className="text-xs font-medium text-indigo-600 uppercase tracking-[0.2em]">Reply as admin</div>
                      <Textarea
                        value={replyDrafts[review.id]?.message ?? ""}
                        onChange={(event) => handleReplyMessageChange(review.id, event.target.value.slice(0, 500))}
                        placeholder="Share an acknowledgement, offer help or plan a follow-up..."
                        className="min-h-[90px] resize-y border-indigo-200 focus-visible:ring-indigo-500/70"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => handleReplyMediaUpload(review.id, event)}
                          className="max-w-xs cursor-pointer border-dashed border-indigo-300 bg-indigo-50/40 text-slate-700"
                        />
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5" /> Optional temple desk photos ({replyDrafts[review.id]?.photos.length ?? 0}/{MAX_MEDIA_PER_ENTRY})
                        </span>
                      </div>
                      {replyDrafts[review.id]?.photos?.length ? (
                        <div className="flex flex-wrap gap-3">
                          {replyDrafts[review.id].photos.map((photo, index) => (
                            <div key={`${photo}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-md border border-indigo-100">
                              <Image src={photo} alt="Reply attachment" fill className="object-cover" sizes="80px" unoptimized />
                              <button
                                type="button"
                                onClick={() => handleRemoveReplyMedia(review.id, index)}
                                className="absolute top-1 right-1 rounded-full bg-black/60 px-1 text-[10px] text-white"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleReplySubmit(review.id)}
                          className="bg-indigo-600 text-white hover:bg-indigo-700"
                          disabled={
                            !((replyDrafts[review.id]?.message ?? "").trim().length > 0 ||
                              (replyDrafts[review.id]?.photos.length ?? 0) > 0)
                          }
                        >
                          <Send className="h-4 w-4 mr-2" /> Reply to traveller
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
