"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DEMO_USERS, type AuthRole } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Loader2, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<AuthRole>("user")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignupDialog, setShowSignupDialog] = useState(false)

  const roleUsers = useMemo(() => DEMO_USERS.filter((user) => user.role === role), [role])

  useEffect(() => {
    if (roleUsers.length > 0) {
      setEmail(roleUsers[0].email)
      setPassword(roleUsers[0].password)
    } else {
      setEmail("")
      setPassword("")
    }
  }, [roleUsers])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, role }),
      })

      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message ?? "Unable to sign in with those details.")
      }

      router.push(data.redirectTo)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-x-20 top-0 mx-auto hidden h-[420px] max-w-5xl rounded-[56px] bg-gradient-to-r from-amber-200/40 via-white to-amber-100/60 blur-3xl md:block"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 md:px-8">
        <div className="w-full max-w-3xl rounded-3xl border border-amber-100/60 bg-white/70 p-6 shadow-xl backdrop-blur-lg md:p-10">
          <div className="flex flex-col gap-10">
            <div>
              <Badge className="mb-4 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Demo access • DevYatra Platform
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
                Welcome back to <span className="text-amber-700">DevYatra</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm text-stone-600 md:text-base">
                Sign in with one of the curated demo accounts to explore the personalized travel experiences we&apos;ve
                crafted for both explorers and administrators.
              </p>
            </div>

            <div className="mt-4 md:mt-8">
              <Tabs value={role} onValueChange={(value) => setRole(value as AuthRole)} className="flex flex-col items-center">
                <TabsList className="bg-amber-100 text-amber-700">
                  <TabsTrigger
                    value="user"
                    className={cn("data-[state=active]:bg-white data-[state=active]:text-amber-800")}
                  >
                    I&apos;m a Traveller
                  </TabsTrigger>
                  <TabsTrigger
                    value="admin"
                    className={cn("data-[state=active]:bg-white data-[state=active]:text-amber-800")}
                  >
                    I&apos;m an Admin
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Card className="mx-auto mt-6 w-full max-w-xl border-amber-100/60 bg-white/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-stone-900">Sign in</CardTitle>
                  <CardDescription className="text-stone-600">
                    Use the {role === "admin" ? "administrator" : "traveller"} credentials supplied below. You can
                    customise access later.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Login failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="border-amber-200/70 focus-visible:ring-amber-500/60"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="border-amber-200/70 focus-visible:ring-amber-500/60"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-stone-500">
                        <ShieldCheck className="h-4 w-4 text-amber-600" />
                        Secure demo session • expires after 4 hours
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-amber-700 px-6 font-semibold text-white hover:bg-amber-800"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing you in…
                          </span>
                        ) : (
                          "Enter experience"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-dashed border-amber-100/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-stone-500">
                    {role === "admin" ? (
                      <>
                        Need a fresh account?{" "}
                        <button
                          type="button"
                          onClick={() => setShowSignupDialog(true)}
                          className="font-medium text-amber-700 hover:text-amber-800"
                        >
                          Request demo signup
                        </button>
                      </>
                    ) : (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setShowSignupDialog(true)}
                          className="font-medium text-amber-700 hover:text-amber-800"
                        >
                          Sign up
                        </button>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSignupDialog(true)}
                    className="border-amber-200/70 text-amber-700 hover:bg-amber-100"
                  >
                    What roles can do
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="border-amber-200/70 bg-white/90">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-stone-900">Signup coming soon</DialogTitle>
            <DialogDescription className="text-sm text-stone-600">
              This demo uses predefined accounts so you can jump straight into the experience. We&apos;ll wire the signup
              flow to the backend once the authentication service is connected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-stone-600">
            <p>
              For now, pick any of the demo personas listed on the right to explore the traveller or admin journey. You
              can customise the dataset and permissions later—everything else in the platform stays untouched.
            </p>
          </div>
          <Button onClick={() => setShowSignupDialog(false)} className="bg-amber-700 text-white hover:bg-amber-800">
            Understood
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}