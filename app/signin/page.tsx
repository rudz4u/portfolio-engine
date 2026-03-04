import { Suspense } from "react"
import SignInForm from "./SignInForm"
import { Loader2 } from "lucide-react"

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  )
}
