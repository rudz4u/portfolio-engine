"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  CheckCircle2,
  Upload,
  User,
  Phone,
  Lock,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import ImportWizard from "@/app/(protected)/portfolio/import/import-wizard"

/* ── Types ─────────────────────────────────────────────────────────────────── */

type AuthMode = "password" | "otp"
type SignUpStep =
  | "credentials"
  | "otp-verify"
  | "email-confirm"
  | "profile"
  | "portfolio"

interface Props {
  onBackToSignIn: () => void
}

/* ── Animation variants ─────────────────────────────────────────────────────── */

const fadeSlide = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -18 },
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export function SignUpWizard({ onBackToSignIn }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]             = useState<SignUpStep>("credentials")
  const [authMode, setAuthMode]     = useState<AuthMode>("password")

  // Credential fields
  const [email, setEmail]                   = useState("")
  const [password, setPassword]             = useState("")
  const [confirmPw, setConfirmPw]           = useState("")
  const [showPw, setShowPw]                 = useState(false)
  const [otpCode, setOtpCode]               = useState("")

  // Profile fields
  const [firstName, setFirstName]   = useState("")
  const [lastName, setLastName]     = useState("")
  const [phone, setPhone]           = useState("")

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState("")

  /* ── Step numbering for progress bar ──────────────────────────────────────── */
  const passwordSteps: SignUpStep[] = ["credentials", "profile", "portfolio"]
  const otpSteps: SignUpStep[]      = ["credentials", "otp-verify", "profile", "portfolio"]
  const orderedSteps = authMode === "otp" ? otpSteps : passwordSteps
  const visibleStep  = orderedSteps.indexOf(step) + 1        // 1-based (email-confirm hidden)
  const totalSteps   = orderedSteps.length

  /* ── Handlers ───────────────────────────────────────────────────────────────  */

  // Step 1: credentials
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (authMode === "password") {
      if (password.length < 8) { setError("Password must be at least 8 characters."); return }
      if (password !== confirmPw) { setError("Passwords do not match."); return }
      setStep("profile")
    } else {
      setLoading(true)
      try {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        })
        if (err) { setError(err.message); return }
        setStep("otp-verify")
      } finally {
        setLoading(false)
      }
    }
  }

  // Step OTP: verify code
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otpCode.replace(/\s/g, "").length !== 6) { setError("Enter the 6-digit code from your email."); return }
    setError("")
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.replace(/\s/g, ""),
        type: "email",
      })
      if (err) { setError(err.message); return }
      setStep("profile")
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    setError("")
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (err) setError(err.message)
    setLoading(false)
  }

  // Step profile: for password mode this also calls signUp; for OTP mode saves to API
  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) { setError("First name is required."); return }
    setError("")
    setLoading(true)

    try {
      if (authMode === "password") {
        // Call signUp here (now that we have all data)
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name:  firstName.trim(),
              last_name:   lastName.trim(),
              full_name:   `${firstName.trim()} ${lastName.trim()}`.trim(),
              phone:       phone.trim() || null,
            },
          },
        })
        if (err) { setError(err.message); return }
        if (data.session) {
          setStep("portfolio")
        } else {
          // Email confirmation required
          setStep("email-confirm")
        }
      } else {
        // OTP mode: user is already authenticated — save profile
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name:       `${firstName.trim()} ${lastName.trim()}`.trim(),
            phone:           phone.trim() || null,
            privacy_consent: true,
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || "Failed to save profile. Please try again.")
          return
        }
        setStep("portfolio")
      }
    } finally {
      setLoading(false)
    }
  }

  // Portfolio step done → to dashboard (OnboardingWizard fires automatically)
  function handlePortfolioDone() {
    router.push("/dashboard")
    router.refresh()
  }

  /* ── Render ─────────────────────────────────────────────────────────────────  */

  const isPortfolioStep = step === "portfolio"

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-[hsl(222,47%,4%)] mesh-bg">

      {/* Glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 15% 50%, hsl(263 70% 60% / 0.10) 0%, transparent 70%), " +
            "radial-gradient(ellipse 50% 40% at 85% 20%, hsl(220 80% 55% / 0.08) 0%, transparent 65%), " +
            "radial-gradient(ellipse 40% 35% at 70% 90%, hsl(142 69% 44% / 0.06) 0%, transparent 60%)",
        }}
      />

      <div className={`relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 ${isPortfolioStep ? "lg:px-12" : "lg:px-16"}`}>

        {/* Mobile logo (hidden on portfolio step to save space) */}
        {!isPortfolioStep && (
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
            <img
              src="/Logos/investbuddyai_app_icon.svg"
              alt="InvestBuddy AI"
              className="h-12 w-12 rounded-2xl shadow-lg"
            />
            <span className="text-xl font-bold gradient-text">InvestBuddy AI</span>
          </div>
        )}

        {/* Portfolio step: wider full-width content */}
        {isPortfolioStep ? (
          <motion.div
            key="portfolio"
            className="w-full max-w-4xl"
            {...fadeSlide}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="mb-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 mb-3">
                <Upload className="h-3 w-3" />
                Step {visibleStep} of {totalSteps} — Upload Your Holdings
              </div>
              <h1 className="text-2xl font-bold text-white">Import Your Portfolio</h1>
              <p className="mt-1 text-sm text-white/50 max-w-lg">
                Upload your broker&apos;s holdings report to unlock AI analytics, risk scoring, and sector analysis for your portfolio.
              </p>
            </div>

            {/* Skip link */}
            <p className="mb-4 text-xs text-white/35 text-right">
              <button
                type="button"
                onClick={handlePortfolioDone}
                className="hover:text-white/60 transition-colors underline underline-offset-2"
              >
                Skip for now — I&apos;ll do this later
              </button>
            </p>

            {/* Import wizard embedded */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 shadow-2xl shadow-black/40">
              <ImportWizard onSuccess={handlePortfolioDone} />
            </div>
          </motion.div>
        ) : (
          /* Narrow card for all other steps */
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="w-full max-w-sm"
              {...fadeSlide}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40 p-8">

                {/* Progress dots */}
                {step !== "email-confirm" && (
                  <div className="flex items-center gap-1.5 mb-6">
                    {orderedSteps.map((s, i) => (
                      <motion.div
                        key={s}
                        animate={{
                          width: i === orderedSteps.indexOf(step) ? 20 : 6,
                          opacity: i <= orderedSteps.indexOf(step) ? 1 : 0.2,
                        }}
                        transition={{ duration: 0.3 }}
                        className="h-1.5 rounded-full bg-violet-500"
                      />
                    ))}
                    <span className="ml-auto text-[10px] text-white/30 font-medium">
                      {visibleStep}/{totalSteps}
                    </span>
                  </div>
                )}

                {/* ── STEP: credentials ── */}
                {step === "credentials" && (
                  <form onSubmit={handleCredentials} className="space-y-5">
                    <div>
                      <h1 className="text-xl font-bold text-white">Create your account</h1>
                      <p className="mt-1 text-sm text-white/45">
                        Start your portfolio intelligence journey.
                      </p>
                    </div>

                    {/* Auth mode toggle */}
                    <div className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                      {(["password", "otp"] as AuthMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => { setAuthMode(mode); setError("") }}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            authMode === mode
                              ? "bg-violet-600 text-white shadow shadow-violet-500/30"
                              : "text-white/40 hover:text-white/70"
                          }`}
                        >
                          {mode === "password" ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Lock className="h-3 w-3" />Email &amp; Password
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5">
                              <Mail className="h-3 w-3" />Email OTP
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="text-xs text-white/60 uppercase tracking-wide">
                        Email
                      </Label>
                      <Input
                        id="su-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                      />
                    </div>

                    {authMode === "password" && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="su-password" className="text-xs text-white/60 uppercase tracking-wide">
                            Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="su-password"
                              type={showPw ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Min. 8 characters"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              minLength={8}
                              className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                              tabIndex={-1}
                              aria-label={showPw ? "Hide password" : "Show password"}
                            >
                              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="su-confirm" className="text-xs text-white/60 uppercase tracking-wide">
                            Confirm Password
                          </Label>
                          <Input
                            id="su-confirm"
                            type={showPw ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Repeat your password"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            required
                            className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                          />
                        </div>
                      </>
                    )}

                    {authMode === "otp" && (
                      <p className="text-xs text-white/40 leading-relaxed">
                        We&apos;ll email you a one-time code. No password needed — just verify and you&apos;re in.
                      </p>
                    )}

                    {error && <ErrorBox message={error} />}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-gradient mt-1 gap-2 font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {authMode === "otp" ? "Send Verification Code" : "Continue"}
                    </Button>

                    <p className="text-center text-xs text-white/35 pt-1">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={onBackToSignIn}
                        className="text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
                      >
                        Sign in
                      </button>
                    </p>
                  </form>
                )}

                {/* ── STEP: otp-verify ── */}
                {step === "otp-verify" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div>
                      <h1 className="text-xl font-bold text-white">Check your email</h1>
                      <p className="mt-1 text-sm text-white/45">
                        We sent a 6-digit code to{" "}
                        <span className="text-white/70 font-medium">{email}</span>
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="otp" className="text-xs text-white/60 uppercase tracking-wide">
                        Verification Code
                      </Label>
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        required
                        className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20 text-center text-xl tracking-[0.35em] font-mono"
                      />
                    </div>

                    {error && <ErrorBox message={error} />}

                    <Button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full btn-gradient gap-2 font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Verify &amp; Continue
                    </Button>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => { setStep("credentials"); setOtpCode(""); setError("") }}
                        className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40"
                      >
                        Resend code
                      </button>
                    </div>
                  </form>
                )}

                {/* ── STEP: profile ── */}
                {step === "profile" && (
                  <form onSubmit={handleProfile} className="space-y-5">
                    <div>
                      <h1 className="text-xl font-bold text-white">Tell us about yourself</h1>
                      <p className="mt-1 text-sm text-white/45">
                        Help us personalise your experience.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="first-name" className="text-xs text-white/60 uppercase tracking-wide">
                          First Name <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                          <Input
                            id="first-name"
                            type="text"
                            autoComplete="given-name"
                            placeholder="Rahul"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20 pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="last-name" className="text-xs text-white/60 uppercase tracking-wide">
                          Last Name
                        </Label>
                        <Input
                          id="last-name"
                          type="text"
                          autoComplete="family-name"
                          placeholder="Sharma"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs text-white/60 uppercase tracking-wide">
                        Phone Number{" "}
                        <span className="normal-case text-white/30">(optional)</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                        <Input
                          id="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20 pl-9"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                      <p className="text-[11px] text-white/35 leading-relaxed">
                        By continuing, you agree to our{" "}
                        <Link href="/legal/terms" target="_blank" className="text-violet-400/70 hover:text-violet-300 transition-colors underline underline-offset-2">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/legal/privacy" target="_blank" className="text-violet-400/70 hover:text-violet-300 transition-colors underline underline-offset-2">
                          Privacy Policy
                        </Link>
                        . InvestBuddy AI provides informational analytics only and is not a SEBI-registered investment adviser.
                      </p>
                    </div>

                    {error && <ErrorBox message={error} />}

                    <Button
                      type="submit"
                      disabled={loading || !firstName.trim()}
                      className="w-full btn-gradient gap-2 font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {authMode === "password" ? "Create Account" : "Save & Continue"}
                    </Button>

                    {authMode === "password" && (
                      <button
                        type="button"
                        onClick={() => { setStep("credentials"); setError("") }}
                        className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors mx-auto"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Back
                      </button>
                    )}
                  </form>
                )}

                {/* ── STEP: email-confirm ── */}
                {step === "email-confirm" && (
                  <div className="flex flex-col items-center text-center gap-5 py-4">
                    <motion.div
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <div className="h-16 w-16 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mx-auto">
                        <Mail className="h-8 w-8 text-violet-400" />
                      </div>
                    </motion.div>

                    <div>
                      <h1 className="text-xl font-bold text-white">Confirm your email</h1>
                      <p className="mt-2 text-sm text-white/45 leading-relaxed max-w-xs">
                        We sent a confirmation link to{" "}
                        <span className="text-white/70 font-medium">{email}</span>.
                        Click it to activate your account.
                      </p>
                    </div>

                    <div className="w-full rounded-xl border border-amber-500/15 bg-amber-500/8 px-4 py-3">
                      <p className="text-[11px] text-amber-300/70 leading-relaxed">
                        After confirming, return here and sign in with your email and password. Your portfolio upload step will be waiting for you.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={onBackToSignIn}
                      variant="outline"
                      className="w-full border-white/10 text-white/70 hover:text-white hover:border-white/20 gap-2"
                    >
                      Go to Sign In
                    </Button>

                    <p className="text-[11px] text-white/25">
                      Didn&apos;t receive it?{" "}
                      <button
                        type="button"
                        onClick={async () => {
                          const { error: err } = await supabase.auth.resend({ type: "signup", email })
                          if (!err) alert("Confirmation email resent!")
                        }}
                        className="text-violet-400/70 hover:text-violet-300 underline underline-offset-2 transition-colors"
                      >
                        Resend confirmation
                      </button>
                    </p>
                  </div>
                )}

              </div>

              {/* Back to sign in (for credential and otp-verify steps) */}
              {(step === "credentials") && (
                <p className="mt-4 text-center text-xs text-white/30">
                  <button
                    type="button"
                    onClick={onBackToSignIn}
                    className="hover:text-white/60 transition-colors"
                  >
                    ← Back to sign in
                  </button>
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

/* ── Helper ─────────────────────────────────────────────────────────────────── */

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  )
}
