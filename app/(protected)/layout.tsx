import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"

export const dynamic = "force-dynamic"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8 pt-4">{children}</div>
      </main>
      <Toaster />
    </div>
  )
}
