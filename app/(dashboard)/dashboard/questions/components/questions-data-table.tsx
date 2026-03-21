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
import {
  mockReviewQuestions,
  type ReviewQuestion,
} from "@/components/review/mock-data"
import { Icons } from "@/components/icons"
import Link from "next/link"

type ReviewStatus = "approved" | "rejected" | "pending"

const REVIEW_STORAGE_KEY = "review-states"

function loadReviewStates(): Record<string, { status: ReviewStatus; comment: string }> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

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
          {row.original.id}
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
        const reviewState = reviewStates[String(row.original.id)]
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
                      Comment — Question {row.original.id}
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
  const [reviewStates, setReviewStates] = useState<
    Record<string, { status: ReviewStatus; comment: string }>
  >({})

  useEffect(() => {
    setReviewStates(loadReviewStates())
  }, [])

  const allQuestions = mockReviewQuestions
  const total = allQuestions.length

  const getStatus = (id: number): ReviewStatus =>
    reviewStates[String(id)]?.status ?? "pending"

  const pending = useMemo(
    () => allQuestions.filter((q) => getStatus(q.id) === "pending"),
    [reviewStates]
  )
  const reviewed = useMemo(
    () => allQuestions.filter((q) => getStatus(q.id) !== "pending"),
    [reviewStates]
  )

  const reviewedCount = reviewed.length
  const progress = total > 0 ? (100 * reviewedCount) / total : 0

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
          <QuestionsTable data={allQuestions} reviewStates={reviewStates} />
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
