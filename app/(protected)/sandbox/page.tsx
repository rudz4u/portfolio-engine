// The Sandbox has been replaced by the production Trade page.
// Redirect any old /sandbox links to /trade.
import { redirect } from "next/navigation"

export default function SandboxRedirect() {
  redirect("/trade")
}
