"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, Mail, Trash2, Plus, Bell } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function NotificationsPage() {
  const { toast } = useToast()

  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [sendDigest, setSendDigest] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [portfolioAlert, setPortfolioAlert] = useState(false)
  const [priceAlert, setPriceAlert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const res = await fetch("/api/settings")
    if (!res.ok) return
    const data = await res.json()
    setEmailRecipients(data.email_recipients || [])
    setSendDigest(data.send_digest_email)
    setOrderPlaced(data.notify_order_placed)
    setPortfolioAlert(data.notify_portfolio_alert)
    setPriceAlert(data.notify_price_alert)
  }

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      toast({ title: "Email cannot be empty", variant: "destructive" })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: "Invalid email format", variant: "destructive" })
      return
    }
    if (emailRecipients.includes(newEmail)) {
      toast({ title: "Email already added", variant: "destructive" })
      return
    }
    if (emailRecipients.length >= 4) {
      toast({ title: "Maximum 4 recipients allowed", variant: "destructive" })
      return
    }
    setEmailRecipients([...emailRecipients, newEmail])
    setNewEmail("")
  }

  const handleRemoveEmail = (email: string) => {
    setEmailRecipients(emailRecipients.filter((e) => e !== email))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email_recipients: emailRecipients,
        send_digest_email: sendDigest,
        notify_order_placed: orderPlaced,
        notify_portfolio_alert: portfolioAlert,
        notify_price_alert: priceAlert,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: "Notification settings saved!" })
    } else {
      toast({ title: "Failed to save settings", variant: "destructive" })
    }
  }

  async function handleSendTestDigest() {
    if (emailRecipients.length === 0) {
      toast({ title: "Add at least one email recipient first", variant: "destructive" })
      return
    }
    setTestLoading(true)
    const res = await fetch("/api/notifications/send-test-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients: emailRecipients }),
    })
    setTestLoading(false)
    if (res.ok) {
      toast({ title: "Test digest sent! Check your inbox." })
    } else {
      toast({ title: "Failed to send test digest", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</h2>
        <p className="text-muted-foreground text-sm">Configure alerts, digests, and email notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>Choose what events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Daily Portfolio Digest", desc: "Receive daily summary of portfolio changes", state: sendDigest, setState: setSendDigest, id: "digest" },
            { label: "Order Placed", desc: "Notify when an order is placed", state: orderPlaced, setState: setOrderPlaced, id: "order" },
            { label: "Portfolio Alert", desc: "Alert when portfolio thresholds are breached", state: portfolioAlert, setState: setPortfolioAlert, id: "portfolio" },
            { label: "Price Alert", desc: "Notify on significant price movements", state: priceAlert, setState: setPriceAlert, id: "price" },
          ].map(({ label, desc, state, setState, id }) => (
            <label key={id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state}
                onChange={(e) => setState(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email Recipients</CardTitle>
          <CardDescription>Up to 4 recipients for notifications (currently {emailRecipients.length})</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {emailRecipients.map((email) => (
              <div key={email} className="flex items-center justify-between gap-2 p-2 rounded border">
                <span className="text-sm">{email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveEmail(email)}
                  className="h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {emailRecipients.length < 4 && (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Add email recipient..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
              />
              <Button onClick={handleAddEmail} variant="outline" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Notification Settings
        </Button>
        <Button onClick={handleSendTestDigest} disabled={testLoading || emailRecipients.length === 0} variant="outline">
          {testLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Send Test Digest
        </Button>
      </div>
    </div>
  )
}
