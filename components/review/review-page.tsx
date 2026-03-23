"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Icons } from "@/components/icons"
import { DashboardHeader } from "@/components/header"
import { LatexRenderer } from "@/components/markdown-renderer"
import { toast } from "@/components/ui/use-toast"

export type ReviewStatus = "pending" | "approved" | "rejected"

export interface ReviewQuestion {
  id: string
  question: string
  answer: string
  reasoning: string
  evidence: string
  citationId: string | null
}

interface QuestionReviewState {
  status: ReviewStatus
  comment: string
}

async function saveReviewToDb(
  questionId: string,
  response: ReviewStatus,
  comments?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ questionId, response, comments: comments || "" }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error("Failed to save review:", res.status, body)
      try {
        const parsed = JSON.parse(body)
        if (parsed?.error) {
          toast({ title: parsed.error, variant: "destructive" })
        }
      } catch {}
      return false
    }
    return true
  } catch (err) {
    console.error("Failed to save review:", err)
    return false
  }
}

export function ReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [questions, setQuestions] = React.useState<ReviewQuestion[]>([])
  const [loading, setLoading] = React.useState(true)

  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [reasoningOpen, setReasoningOpen] = React.useState(false)
  const [reviewStates, setReviewStates] = React.useState<
    Record<string, QuestionReviewState>
  >({})

  React.useEffect(() => {
    async function load() {
      try {
        const [questionsRes, reviewsRes] = await Promise.all([
          fetch("/api/questions", { credentials: "same-origin" }),
          fetch("/api/reviews", { credentials: "same-origin" }),
        ])

        const questionsData: ReviewQuestion[] = await questionsRes.json()
        const reviewsData: Array<{
          questionId: string
          response: string
          comments: string | null
        }> = reviewsRes.ok ? await reviewsRes.json() : []

        setQuestions(questionsData)

        const states: Record<string, QuestionReviewState> = {}
        for (const q of questionsData) {
          const existing = reviewsData.find((r) => r.questionId === q.id)
          states[q.id] = {
            status: (existing?.response as ReviewStatus) || "pending",
            comment: existing?.comments || "",
          }
        }
        setReviewStates(states)

        const qParam = searchParams?.get("q")
        if (qParam) {
          const idx = questionsData.findIndex((q) => q.id === qParam)
          if (idx >= 0) setSelectedIndex(idx)
        }
      } catch (err) {
        toast({
          title: "Failed to load questions",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [searchParams])

  const total = questions.length
  const currentQuestion = questions[selectedIndex]
  const currentState = currentQuestion
    ? reviewStates[currentQuestion.id]
    : undefined

  const reviewStatesRef = React.useRef(reviewStates)
  React.useEffect(() => {
    reviewStatesRef.current = reviewStates
  }, [reviewStates])

  const reviewedCount = Object.values(reviewStates).filter(
    (s) => s.status !== "pending"
  ).length
  const allReviewed = total > 0 && reviewedCount === total
  const progress = total > 0 ? (100 * reviewedCount) / total : 0

  function setStatus(id: string, status: ReviewStatus) {
    setReviewStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status },
    }))
    const comment = reviewStatesRef.current[id]?.comment || ""
    saveReviewToDb(id, status, comment).then((ok) => {
      if (!ok) {
        toast({ title: "Failed to save review", variant: "destructive" })
      }
    })
  }

  const commentTimerRef = React.useRef<ReturnType<typeof setTimeout>>()

  function setComment(id: string, comment: string) {
    setReviewStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], comment },
    }))

    if (commentTimerRef.current) clearTimeout(commentTimerRef.current)
    commentTimerRef.current = setTimeout(() => {
      const latestState = reviewStatesRef.current[id]
      saveReviewToDb(id, latestState?.status || "pending", comment)
    }, 800)
  }

  function handleReset() {
    const fresh: Record<string, QuestionReviewState> = {}
    const savePromises: Promise<boolean>[] = []
    for (const q of questions) {
      fresh[q.id] = { status: "pending", comment: "" }
      savePromises.push(saveReviewToDb(q.id, "pending", ""))
    }
    setReviewStates(fresh)
    setSelectedIndex(0)
    setReasoningOpen(false)
    Promise.all(savePromises).then((results) => {
      if (results.every(Boolean)) {
        toast({ description: "All reviews have been reset." })
      } else {
        toast({ title: "Some resets failed", variant: "destructive" })
      }
    })
  }

  async function handleSubmit() {
    const savePromises: Promise<boolean>[] = []
    const latestStates = reviewStatesRef.current
    for (const q of questions) {
      const state = latestStates[q.id]
      if (state) {
        savePromises.push(
          saveReviewToDb(q.id, state.status, state.comment)
        )
      }
    }

    const results = await Promise.all(savePromises)
    if (results.every(Boolean)) {
      toast({ description: "Reviews submitted successfully!" })
      router.push("/dashboard")
    } else {
      toast({
        title: "Some reviews failed to save",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  function goTo(index: number) {
    if (index >= 0 && index < total) {
      setSelectedIndex(index)
      setReasoningOpen(false)
    }
  }

  function goNext() {
    goTo(selectedIndex + 1)
  }

  function goPrev() {
    goTo(selectedIndex - 1)
  }

  const dialRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = dialRef.current
    if (!el) return

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.deltaY > 0 || e.deltaX > 0) {
        setSelectedIndex((i) => Math.min(i + 1, total - 1))
      } else {
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      setReasoningOpen(false)
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [total])

  if (loading) {
    return (
      <>
        <DashboardHeader heading="Review" />
        <div className="flex items-center justify-center py-20">
          <Icons.spinner className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  if (!currentQuestion || !currentState) {
    return (
      <>
        <DashboardHeader heading="Review" />
        <p className="py-10 text-center text-muted-foreground">
          No questions available.
        </p>
      </>
    )
  }

  return (
    <>
      <DashboardHeader heading="Review">
        <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">
          {allReviewed && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="size-9 p-0">
                      <Icons.checkCircle className="size-5 text-emerald-500" />
                      <span className="sr-only">Submit reviews</span>
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Submit all reviews</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit all reviews?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have reviewed all {total} questions. This will submit
                    your approvals, rejections, and comments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmit}>
                    Submit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="size-9 p-0">
                    <Icons.reset className="size-5 text-muted-foreground" />
                    <span className="sr-only">Reset reviews</span>
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Reset all reviews</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all reviews?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your approvals, rejections, and comments.
                  You will start the review from the beginning.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </TooltipProvider>
      </DashboardHeader>

      <div className="flex items-center gap-3">
        <Progress className="h-1 w-full" value={progress} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {reviewedCount}/{total}
        </span>
      </div>

      <div className="grid gap-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Question</CardTitle>
            <div className="text-lg text-muted-foreground text-justify">
              <LatexRenderer latexText={currentQuestion.question} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Answer</p>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "size-8 shrink-0 rounded-full p-0",
                          reasoningOpen
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300"
                            : "text-muted-foreground"
                        )}
                        onClick={() => setReasoningOpen((o) => !o)}
                      >
                        <Icons.lightbulb className="size-4" />
                        <span className="sr-only">Toggle explanation</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show explanation</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-[200px] overflow-y-auto rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed text-justify [scrollbar-width:none] hover:[scrollbar-width:thin] [&::-webkit-scrollbar]:w-0 hover:[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
                  {currentQuestion.answer}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant={currentState.status === "approved" ? "default" : "outline"}
                className={cn(
                  currentState.status === "approved"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border-emerald-600 text-emerald-500 hover:bg-emerald-600/10 hover:text-emerald-400"
                )}
                onClick={() =>
                  setStatus(
                    currentQuestion.id,
                    currentState.status === "approved" ? "pending" : "approved"
                  )
                }
              >
                <Icons.check className="mr-2 size-4" />
                {currentState.status === "approved" ? "Approved" : "Approve"}
              </Button>
              <Button
                variant={currentState.status === "rejected" ? "default" : "outline"}
                className={cn(
                  currentState.status === "rejected"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "border-red-600 text-red-500 hover:bg-red-600/10 hover:text-red-400"
                )}
                onClick={() =>
                  setStatus(
                    currentQuestion.id,
                    currentState.status === "rejected" ? "pending" : "rejected"
                  )
                }
              >
                <Icons.close className="mr-2 size-4" />
                {currentState.status === "rejected" ? "Rejected" : "Reject"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Icons.messageSquare className="size-3.5" />
                Comments
              </div>
            <Textarea
              placeholder="Additional comments..."
              value={currentState.comment}
              onChange={(e) => setComment(currentQuestion.id, e.target.value)}
              className="min-h-[80px] resize-none"
            />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={selectedIndex === 0}
              >
                <Icons.chevronLeft className="mr-2 size-4" />
                Previous
              </Button>

              <div
                ref={dialRef}
                className="flex items-center gap-1 px-2"
              >
                {Array.from({ length: total }, (_, i) => {
                  const distance = Math.abs(i - selectedIndex)
                  const isActive = i === selectedIndex
                  return (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 cursor-pointer select-none",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                      style={{
                        opacity: isActive ? 1 : Math.max(0.15, 1 - distance * 0.3),
                        transform: isActive ? "scale(1.2)" : "scale(1)",
                      }}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                onClick={goNext}
                disabled={selectedIndex === total - 1}
              >
                Next
                <Icons.chevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={reasoningOpen} onOpenChange={setReasoningOpen}>
        <SheetContent position="right" size="lg">
          <SheetHeader>
            <SheetTitle>Explanation</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-6 h-[calc(100vh-8rem)]">
            <div className="flex flex-col gap-6 pr-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Answer Reasoning
                </h4>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-justify">
                  {currentQuestion.reasoning}
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Evidence of Answer Generation
                </h4>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-justify">
                  {currentQuestion.evidence}
                </p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
