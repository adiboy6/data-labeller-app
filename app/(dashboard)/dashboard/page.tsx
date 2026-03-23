import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCurrentUser } from "@/lib/session"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { ReviewProgressCard } from "@/components/review/review-progress-card"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect(authOptions?.pages?.signIn || "/login")
  }

  const username = user.name || "Scientist"

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Welcome to openmosaics, ${username} 🙌`}
        text="Let's explore some chemistry questions together!"
      ></DashboardHeader>
      <div className="mx-auto p-6">
        <h2 className="mb-4 text-2xl font-bold">
          &quot;Rules&quot; for answering questions
        </h2>
        <p className="mb-4">
          To ensure that we can compare the answers from different people, we
          request you to follow a few simple rules when answering questions:
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">
            <strong>
              Do not use any external resources unless the app explicitly allows
              doing so.
            </strong>{" "}
            This includes books, websites, and other people. It is okay to use a
            calculator, though. Some questions may allow you to use external
            tools. These are indicated by statement above the question.
          </li>
          <li className="mb-2">
            <strong>Make a serious attempt to answer the question.</strong> If
            you do not know the answer, make an educated guess.
          </li>
          <li className="mb-2">
            <strong>Provide us with feedback</strong> if you think that the
            question is unclear or if you think that none of the answers is
            correct. You can do this by clicking on the &quot;bug&quot; icon
            next to the question title. (Note that this functionality might be disturbed by certain browser extensions).
          </li>
          <li className="mb-2">
            <strong>Multiple choice questions</strong> may have more than one
            correct answer.
          </li>
        </ul>
      </div>
      <ReviewProgressCard username={username} />
      <Link
        href="/dashboard/review"
        className={buttonVariants({ size: "sm", className: "flex w-[200px]" })}
      >
        Start Reviewing
        <Icons.chevronRight className="ml-2 size-4" />
      </Link>
    </DashboardShell>
  )
}