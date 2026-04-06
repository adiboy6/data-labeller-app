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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
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
  category: string | null
  answer: string
  reasoning: string
  evidence: string
  citationId: string | null
  citation?: {
    id: string
    url: string
    label: string
    sourceMetadata: unknown | null
  } | null
}

const CATEGORY_BADGE_PALETTE = [
  "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-indigo-500/15 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
]

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0 // force 32-bit
  }
  return Math.abs(hash)
}

function getCategoryBadgeClassName(category: string | null | undefined) {
  const normalized = (category || "Uncategorized").trim()

  // Keep explicit mappings for the known set, then fall back to palette hashing.
  const explicit: Record<string, string> = {
    Mechanism:
      "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    DFT: "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    "Screening ML":
      "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    Interpretability:
      "bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    Experiment:
      "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  }

  const explicitMatch = explicit[normalized]
  if (explicitMatch) return explicitMatch

  const idx = hashString(normalized) % CATEGORY_BADGE_PALETTE.length
  return CATEGORY_BADGE_PALETTE[idx]
}

function formatSourceMetadata(metadata: unknown): string {
  if (metadata == null) return ""
  if (typeof metadata === "string") return metadata
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}

function humanizeMetadataKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

function extractBibliographic(
  metadata: unknown
): Record<string, unknown> | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const m = metadata as Record<string, unknown>
  const bib = m.bibliographic
  if (bib != null && typeof bib === "object" && !Array.isArray(bib)) {
    return bib as Record<string, unknown>
  }
  return null
}

const BIBLIOGRAPHIC_FIELD_ORDER = [
  "title",
  "authors",
  "published_date",
]

function sortBibliographicEntries(
  entries: [string, unknown][]
): [string, unknown][] {
  return [...entries].sort((a, b) => {
    const ia = BIBLIOGRAPHIC_FIELD_ORDER.indexOf(a[0])
    const ib = BIBLIOGRAPHIC_FIELD_ORDER.indexOf(b[0])
    const ra = ia === -1 ? 1000 : ia
    const rb = ib === -1 ? 1000 : ib
    if (ra !== rb) return ra - rb
    return a[0].localeCompare(b[0])
  })
}

function hasBibliographicRows(metadata: unknown): boolean {
  const bib = extractBibliographic(metadata)
  if (!bib) return false
  return Object.entries(bib).some(
    ([, v]) =>
      v != null && v !== "" && !(Array.isArray(v) && v.length === 0)
  )
}

function formatBibliographicValue(value: unknown): React.ReactNode {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    if (value.every((v) => typeof v === "string")) {
      return value.join(", ")
    }
    return value.map((item, i) => (
      <span key={i}>
        {i > 0 ? "; " : null}
        {typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item)}
      </span>
    ))
  }
  if (typeof value === "object") {
    return (
      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }
  return String(value)
}

function BibliographicMetadataView({ metadata }: { metadata: unknown }) {
  const bib = extractBibliographic(metadata)
  const entries =
    bib != null
      ? sortBibliographicEntries(
          Object.entries(bib).filter(
            ([k, v]) =>
              BIBLIOGRAPHIC_FIELD_ORDER.includes(k) &&
              v != null && v !== "" && !(Array.isArray(v) && v.length === 0)
          )
        )
      : []

  if (entries.length > 0) {
    return (
      <dl className="space-y-2.5">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="grid gap-0.5 text-[11px] leading-snug sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:gap-x-3 sm:gap-y-0"
          >
            <dt className="font-medium text-foreground">
              {humanizeMetadataKey(key)}
            </dt>
            <dd className="min-w-0 break-words text-muted-foreground">
              {formatBibliographicValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <pre className="max-h-64 max-w-[min(100vw-2rem,28rem)] overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
      {formatSourceMetadata(metadata)}
    </pre>
  )
}

function CategoryBadge({ category }: { category: string | null | undefined }) {
  const normalized = (category || "Uncategorized").trim()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        getCategoryBadgeClassName(normalized)
      )}
      title={normalized}
    >
      {normalized}
    </span>
  )
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
          fetch("/api/questions", {
            credentials: "same-origin",
            cache: "no-store",
          }),
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
        savePromises.push(saveReviewToDb(q.id, state.status, state.comment))
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
  const activeDialButtonRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    activeDialButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedIndex])

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
                    This will clear all your approvals, rejections, and
                    comments. You will start the review from the beginning.
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

      <div className="grid min-w-0 gap-8">
        <Card className="w-full min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle>Question</CardTitle>
                {currentQuestion.citation && (
                  <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Citation source metadata"
                      >
                        <Icons.alertCircle className="size-4" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      className="w-auto max-w-md border bg-popover p-0"
                    >
                      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                        Source metadata
                      </div>
                      <div className="space-y-2 p-3 text-xs text-muted-foreground">
                        <p className="break-all leading-relaxed">
                          <span className="font-medium text-foreground">
                            Source:
                          </span>{" "}
                          {currentQuestion.citation.label ||
                            currentQuestion.citation.url}
                        </p>
                        {currentQuestion.citation.sourceMetadata != null ? (
                          <div className="space-y-2 border-t border-border/60 pt-2">
                            <p className="text-[11px] font-semibold text-foreground">
                              {hasBibliographicRows(
                                currentQuestion.citation.sourceMetadata
                              )
                                ? "Bibliographic"
                                : "Metadata"}
                            </p>
                            <BibliographicMetadataView
                              metadata={
                                currentQuestion.citation.sourceMetadata
                              }
                            />
                          </div>
                        ) : (
                          <p className="italic leading-relaxed">
                            No bibliographic metadata is stored for this
                            citation yet.
                          </p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
              <CategoryBadge category={currentQuestion?.category} />
            </div>
            <div className="min-w-0 max-w-full break-words text-justify text-lg text-muted-foreground">
              <LatexRenderer latexText={currentQuestion.question} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-medium">Answer</p>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-full px-3",
                          reasoningOpen
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300"
                            : "text-muted-foreground"
                        )}
                        onClick={() => setReasoningOpen((o) => !o)}
                      >
                        <Icons.lightbulb className="size-4" />
                        <span className="sr-only">Show Explanation</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show Explanation</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-[200px] min-w-0 overflow-y-auto overflow-x-hidden break-words rounded-lg border bg-muted/50 p-4 text-justify text-sm leading-relaxed [overflow-wrap:anywhere] [scrollbar-width:none] hover:[scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-0 hover:[&::-webkit-scrollbar]:w-1.5">
                {currentQuestion.answer}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant={
                  currentState.status === "approved" ? "default" : "outline"
                }
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
                variant={
                  currentState.status === "rejected" ? "default" : "outline"
                }
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
                onChange={(e) =>
                  setComment(currentQuestion.id, e.target.value)
                }
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="flex min-w-0 items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="shrink-0"
                onClick={goPrev}
                disabled={selectedIndex === 0}
              >
                <Icons.chevronLeft className="mr-2 size-4" />
                Previous
              </Button>

              <div
                ref={dialRef}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden px-1 py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
              >
                {Array.from({ length: total }, (_, i) => {
                  const distance = Math.abs(i - selectedIndex)
                  const isActive = i === selectedIndex
                  return (
                    <button
                      key={i}
                      ref={isActive ? activeDialButtonRef : undefined}
                      type="button"
                      onClick={() => goTo(i)}
                      className={cn(
                        "flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                      style={{
                        opacity: isActive
                          ? 1
                          : Math.max(0.15, 1 - distance * 0.3),
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
                className="shrink-0"
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
                <h4 className="mb-2 text-sm font-semibold">Answer Reasoning</h4>
                <p className="whitespace-pre-line text-justify text-sm leading-relaxed text-muted-foreground">
                  {currentQuestion.reasoning}
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Evidence of Answer Generation
                </h4>
                <p className="whitespace-pre-line text-justify text-sm leading-relaxed text-muted-foreground">
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
