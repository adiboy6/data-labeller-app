import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import { DashboardShell } from "@/components/shell"
import { ReviewPage } from "@/components/review/review-page"

export const metadata = {
  title: "Review",
  description: "Review and approve submitted answers.",
}

export default async function ReviewDashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <DashboardShell>
      <ReviewPage />
    </DashboardShell>
  )
}
