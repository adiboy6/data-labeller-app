"use client"

import React from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function ReviewProgressCard({ username }: { username: string }) {
  const [total, setTotal] = React.useState(0)
  const [reviewedCount, setReviewedCount] = React.useState(0)

  React.useEffect(() => {
    async function load() {
      try {
        const [questionsRes, reviewsRes] = await Promise.all([
          fetch("/api/questions", { credentials: "same-origin" }),
          fetch("/api/reviews", { credentials: "same-origin" }),
        ])

        const questions: Array<{ id: string }> = await questionsRes.json()
        const reviews: Array<{ response: string }> = reviewsRes.ok
          ? await reviewsRes.json()
          : []

        setTotal(questions.length)
        setReviewedCount(
          reviews.filter((r) => r.response !== "pending").length
        )
      } catch {
        // silently fail — card just shows 0/0
      }
    }

    load()
  }, [])

  const progress = total > 0 ? (100 * reviewedCount) / total : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
        <div className="text-sm text-muted-foreground">
          {reviewedCount === total && total > 0 ? (
            <span>
              Congratulations on completing the review, {username}!
            </span>
          ) : (
            <span>
              You have reviewed {reviewedCount} out of {total} questions!
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Progress className="h-1 w-full" value={progress} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
