"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ImportWizard from "@/app/(protected)/portfolio/import/import-wizard"

export function ImportHoldingsDialog({
  portfolioId,
  label,
  variant = "outline",
}: {
  portfolioId?: string
  label?: string
  variant?: "default" | "outline" | "ghost"
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {label ?? (portfolioId ? "Import / Update" : "Import Holdings")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {portfolioId ? "Update Portfolio Holdings" : "Import Holdings Report"}
            </DialogTitle>
          </DialogHeader>
          {/* Re-mount the wizard fresh on each open */}
          {open && (
            <ImportWizard portfolioId={portfolioId} onSuccess={handleSuccess} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
