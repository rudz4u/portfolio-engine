"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, User, Shield, Download, Trash2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  created_at: string
}

export default function ProfileSettingsPage() {
  const { toast } = useToast()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Form fields
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [privacyConsent, setPrivacyConsent] = useState(true)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [dataRetention, setDataRetention] = useState<"12months" | "indefinite">("indefinite")

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const res = await fetch("/api/profile")
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setFullName(data.full_name || "")
        setPhone(data.phone || "")
        // Load privacy preferences
        const prefsRes = await fetch("/api/settings")
        if (prefsRes.ok) {
          const prefs = await prefsRes.json()
          setPrivacyConsent(prefs.privacy_consent !== false)
          setMarketingConsent(prefs.marketing_consent === true)
          setDataRetention(prefs.data_retention || "indefinite")
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error)
      toast({ title: "Failed to load profile", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone: phone || null,
          privacy_consent: privacyConsent,
          marketing_consent: marketingConsent,
          data_retention: dataRetention,
        }),
      })
      setSaving(false)
      if (res.ok) {
        toast({ title: "Profile updated successfully!" })
        loadProfile()
      } else {
        const error = await res.json()
        toast({ title: error.error || "Failed to save profile", variant: "destructive" })
      }
    } catch (error) {
      setSaving(false)
      toast({ title: "Failed to save profile", variant: "destructive" })
    }
  }

  async function handleExportData() {
    setExporting(true)
    try {
      const res = await fetch("/api/profile/export-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      setExporting(false)
      if (res.ok) {
        // Download the file
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `investbuddy-data-export-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({ title: "Data exported successfully! Check your downloads folder." })
      } else {
        const error = await res.json()
        toast({ title: error.error || "Failed to export data", variant: "destructive" })
      }
    } catch (error) {
      setExporting(false)
      toast({ title: "Failed to export data", variant: "destructive" })
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE MY ACCOUNT") {
      toast({ title: "Please type the confirmation text exactly", variant: "destructive" })
      return
    }

    setDeleting(true)
    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      setDeleting(false)
      if (res.ok) {
        toast({ title: "Account deletion initiated. You will receive a confirmation email." })
        // Redirect to home page after a moment
        setTimeout(() => {
          window.location.href = "/signin"
        }, 2000)
      } else {
        const error = await res.json()
        toast({ title: error.error || "Failed to delete account", variant: "destructive" })
      }
    } catch (error) {
      setDeleting(false)
      toast({ title: "Failed to delete account", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile & Privacy
        </h2>
        <p className="text-muted-foreground text-sm">
          Manage your account information and privacy preferences in compliance with DPDPA
        </p>
      </div>

      {/* Basic Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <div className="mt-1 p-3 rounded-lg border bg-muted">
              <p className="text-sm">{profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Cannot be changed. Contact support to update.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Phone Number (Optional)</label>
            <Input
              type="tel"
              placeholder="+91 XXXXX XXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="text-xs text-muted-foreground pt-2">
            Account created: {profile && new Date(profile.created_at).toLocaleDateString("en-IN")}
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy & Consent
          </CardTitle>
          <CardDescription>DPDPA-compliant privacy preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 mt-1"
              />
              <div>
                <p className="text-sm font-medium">Privacy Policy Consent</p>
                <p className="text-xs text-muted-foreground">
                  I have read and agree to the Privacy Policy and understand how my data is processed.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 mt-1"
              />
              <div>
                <p className="text-sm font-medium">Marketing Communications</p>
                <p className="text-xs text-muted-foreground">
                  I want to receive updates, tips, and promotional content from InvestBuddy AI.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t">
            <label className="text-sm font-medium">Data Retention Policy</label>
            <p className="text-xs text-muted-foreground mb-3">
              Choose how long your data is retained after account closure
            </p>
            <div className="space-y-2">
              {[
                {
                  id: "12months",
                  label: "12 Months (Recommended)",
                  desc: "Data deleted 12 months after account closure (complies with DPDPA guidelines)",
                },
                {
                  id: "indefinite",
                  label: "Indefinite",
                  desc: "Data retained indefinitely for historical records and compliance",
                },
              ].map((option) => (
                <label key={option.id} className="flex items-start gap-3 cursor-pointer p-3 rounded border hover:bg-muted">
                  <input
                    type="radio"
                    name="dataRetention"
                    value={option.id}
                    checked={dataRetention === option.id}
                    onChange={(e) => setDataRetention(e.target.value as typeof dataRetention)}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Profile & Privacy Settings
      </Button>

      {/* Data Management */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Download className="h-4 w-4" />
            Data Management
          </CardTitle>
          <CardDescription className="text-blue-800">
            Exercise your DPDPA rights: export or delete your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-white border border-blue-200">
            <p className="text-sm text-blue-900 mb-3">
              <strong>Right to Data Portability:</strong> Download all your data in a portable JSON format for backup or transfer.
            </p>
            <Button onClick={handleExportData} disabled={exporting} variant="outline" className="w-full">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export My Data
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-white border border-blue-200">
            <p className="text-sm text-blue-900 mb-3">
              <strong>Right to be Forgotten:</strong> Permanently delete your account and associated personal data.
            </p>
            <p className="text-xs text-blue-700 mb-3">
              ⚠️ This action is irreversible. You will lose access to all your portfolios and trading history.
            </p>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder='Type "DELETE MY ACCOUNT" to confirm'
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="text-sm"
              />
              <Button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== "DELETE MY ACCOUNT"}
                variant="destructive"
                className="w-full"
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleting ? "Deleting Account..." : "Delete Account & All Data"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DPDPA Info */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            DPDPA Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-900">
          <p>
            <strong>Digital Personal Data Protection Act (DPDPA), 2023:</strong> InvestBuddy AI is committed to protecting your personal data in accordance with the DPDPA.
          </p>
          <ul className="ml-4 space-y-2 list-disc">
            <li><strong>Right to Consent:</strong> We collect data only with your explicit consent.</li>
            <li><strong>Right to Access:</strong> You can access all your personal data anytime via the export function.</li>
            <li><strong>Right to Correction:</strong> Update your profile information at any time.</li>
            <li><strong>Right to Erasure:</strong> Request complete deletion of your account and data.</li>
            <li><strong>Right to Data Portability:</strong> Download your data in portable formats.</li>
          </ul>
          <p className="pt-2">
            For more details, see our <a href="/legal/privacy" className="underline font-semibold hover:text-amber-800">Privacy Policy</a> and{" "}
            <a href="/legal/disclaimer" className="underline font-semibold hover:text-amber-800">Legal Disclaimer</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
