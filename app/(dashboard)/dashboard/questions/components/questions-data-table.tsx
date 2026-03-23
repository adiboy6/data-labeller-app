"use client"

import { useState, useEffect, useMemo } from "react"
import { DataTable } from "./data-table"
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Icons } from "@/components/icons"
import Link from "next/link"

import type { ReviewQuestion, ReviewStatus } from "@/components/review/review-page"

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        status === "approved" && "bg-emerald-600 text-white",
        status === "rejected" && "bg-red-600 text-white",
        status === "pending" && "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  )
}

function buildColumns(
  reviewStates: Record<string, { status: ReviewStatus; comment: string }>
): ColumnDef<ReviewQuestion>[] {
  return [
    {
      accessorKey: "id",
      header: "#",
      enableHiding: false,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/review?q=${row.original.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.index + 1}
        </Link>
      ),
    },
    {
      accessorKey: "question",
      header: "Question",
      cell: ({ row }) => (
        <div className="text-sm leading-relaxed">{row.original.question}</div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const reviewState = reviewStates[row.original.id]
        const status: ReviewStatus = reviewState?.status ?? "pending"
        const comment = reviewState?.comment ?? ""
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {comment && (
              <Dialog>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Icons.messageSquare className="size-3.5" />
                        </button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>View comment</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      Comment — Question {row.index + 1}
                    </DialogTitle>
                  </DialogHeader>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {comment}
                  </p>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )
      },
    },
  ]
}

function QuestionsTable({
  data,
  reviewStates,
}: {
  data: ReviewQuestion[]
  reviewStates: Record<string, { status: ReviewStatus; comment: string }>
}) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const columns = useMemo(() => buildColumns(reviewStates), [reviewStates])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters },
    initialState: { pagination: { pageSize: 5 } },
  })

  return (
    <div>
      <div className="py-4">
        <h2 className="text-2xl font-bold tracking-tight">Questions</h2>
      </div>
      <DataTable table={table} />
    </div>
  )
}

export function QuestionsDataTable() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [reviewStates, setReviewStates] = useState<
    Record<string, { status: ReviewStatus; comment: string }>
  >({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

        const states: Record<string, { status: ReviewStatus; comment: string }> = {}
        for (const q of questionsData) {
          const existing = reviewsData.find((r) => r.questionId === q.id)
          states[q.id] = {
            status: (existing?.response as ReviewStatus) || "pending",
            comment: existing?.comments || "",
          }
        }
        setReviewStates(states)
      } catch {
        // fail silently
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const total = questions.length

  const getStatus = (id: string): ReviewStatus =>
    reviewStates[id]?.status ?? "pending"

  const pending = useMemo(
    () => questions.filter((q) => getStatus(q.id) === "pending"),
    [questions, reviewStates]
  )
  const reviewed = useMemo(
    () => questions.filter((q) => getStatus(q.id) !== "pending"),
    [questions, reviewStates]
  )

  const reviewedCount = reviewed.length
  const progress = total > 0 ? (100 * reviewedCount) / total : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icons.spinner className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Progress className="h-1 w-full" value={progress} />
      <Tabs defaultValue="all" className="py-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <QuestionsTable data={questions} reviewStates={reviewStates} />
        </TabsContent>
        <TabsContent value="pending">
          <QuestionsTable data={pending} reviewStates={reviewStates} />
        </TabsContent>
        <TabsContent value="reviewed">
          <QuestionsTable data={reviewed} reviewStates={reviewStates} />
        </TabsContent>
      </Tabs>
    </>
  )
}
