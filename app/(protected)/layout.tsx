import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { OnboardingProvider } from "@/components/onboarding-provider"
import { PageTransition } from "@/components/page-transition"

export const dynamic = "force-dynamic"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OnboardingProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto mesh-bg">
          <div className="p-4 lg:p-8 pt-4 min-h-full">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        <Toaster />
      </div>
    </OnboardingProvider>
  )
}
