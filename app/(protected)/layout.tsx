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
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto mesh-bg pt-[52px] lg:pt-0">
          <div className="p-4 lg:p-8 pb-20 lg:pb-8 min-h-full">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        <Toaster />
      </div>
    </OnboardingProvider>
  )
}
