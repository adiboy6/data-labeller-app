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

import {
  mockReviewQuestions,
  type ReviewQuestion,
} from "@/components/review/mock-data"

type ReviewStatus = ReviewQuestion["status"]

interface QuestionReviewState {
  status: ReviewStatus
  comment: string
}

function buildInitialStates(allPending = false) {
  const initial: Record<number, QuestionReviewState> = {}
  for (const q of mockReviewQuestions) {
    initial[q.id] = { status: allPending ? "pending" : q.status, comment: "" }
  }
  return initial
}

const STORAGE_KEY = "review-states"

function loadSavedStates(): Record<number, QuestionReviewState> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveStates(states: Record<number, QuestionReviewState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
  } catch {
    // storage full or unavailable
  }
}

export function ReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const total = mockReviewQuestions.length

  const initialIndex = React.useMemo(() => {
    const qParam = searchParams?.get("q")
    if (qParam) {
      const idx = mockReviewQuestions.findIndex((q) => String(q.id) === qParam)
      if (idx >= 0) return idx
    }
    return 0
  }, [searchParams])

  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex)
  const [reasoningOpen, setReasoningOpen] = React.useState(false)
  const [reviewStates, setReviewStates] = React.useState<
    Record<number, QuestionReviewState>
  >(buildInitialStates)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const saved = loadSavedStates()
    if (saved) setReviewStates(saved)
    setHydrated(true)
  }, [])

  const currentQuestion = mockReviewQuestions[selectedIndex]
  const currentState = reviewStates[currentQuestion.id]

  const reviewedCount = Object.values(reviewStates).filter(
    (s) => s.status !== "pending"
  ).length
  const allReviewed = reviewedCount === total
  const progress = total > 0 ? (100 * reviewedCount) / total : 0

  React.useEffect(() => {
    if (hydrated) saveStates(reviewStates)
  }, [reviewStates, hydrated])

  function setStatus(id: number, status: ReviewStatus) {
    setReviewStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status },
    }))
  }

  function setComment(id: number, comment: string) {
    setReviewStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], comment },
    }))
  }

  function handleReset() {
    const fresh = buildInitialStates(true)
    setReviewStates(fresh)
    saveStates(fresh)
    setSelectedIndex(0)
    setReasoningOpen(false)
    toast({ description: "All reviews have been reset." })
  }

  function handleSubmit() {
    toast({ description: "Reviews submitted successfully!" })
    router.push("/dashboard")
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
            {/* Answer display (read-only) */}
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

            {/* Approve / Reject */}
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

            {/* Additional comments */}
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

            {/* Navigation */}
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

      {/* Explanation Sheet (right overlay) */}
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
