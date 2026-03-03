"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { TrendingUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const supabase = createClient()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(redirect)
      router.refresh()
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setMessage("Account created! Check your email to confirm, then sign in.")
      setMode("signin")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">BrokerAI</h1>
          <p className="text-sm text-muted-foreground">
            AI-Powered Equity Management
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {mode === "signin" ? "Welcome back" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to your portfolio"
                : "Start managing your equity portfolio"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
              className="space-y-4"
            >
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Rudranil Das"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {message && (
                <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
                  {message}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    className="underline text-primary"
                    onClick={() => {
                      setMode("signup")
                      setError("")
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="underline text-primary"
                    onClick={() => {
                      setMode("signin")
                      setError("")
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
