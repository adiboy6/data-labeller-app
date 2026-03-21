"use client"

import React from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { mockReviewQuestions } from "@/components/review/mock-data"

const STORAGE_KEY = "review-states"

export function ReviewProgressCard({ username }: { username: string }) {
  const total = mockReviewQuestions.length
  const [reviewedCount, setReviewedCount] = React.useState(0)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const states = JSON.parse(raw) as Record<
          string,
          { status: string; comment: string }
        >
        const count = Object.values(states).filter(
          (s) => s.status !== "pending"
        ).length
        setReviewedCount(count)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const progress = total > 0 ? (100 * reviewedCount) / total : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
        <div className="text-sm text-muted-foreground">
          {reviewedCount === total ? (
            <span>
              Congratulations on completing the review, {username}! 🚀
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
