"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { ChevronDown } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function CategoryBadge({
  category,
  className,
}: {
  category: string | null | undefined
  className?: string
}) {
  const normalized = (category || "Uncategorized").trim()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        getCategoryBadgeClassName(normalized),
        className
      )}
      title={normalized}
    >
      {normalized}
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
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <CategoryBadge category={row.original.category} />
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
  categories,
  selectedCategories,
  allSelected,
  onAllCheckedChange,
  onCategoryCheckedChange,
}: {
  data: ReviewQuestion[]
  reviewStates: Record<string, { status: ReviewStatus; comment: string }>
  categories: string[]
  selectedCategories: string[]
  allSelected: boolean
  onAllCheckedChange: (checked: boolean) => void
  onCategoryCheckedChange: (category: string, checked: boolean) => void
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Questions</h2>
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Category
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 w-[220px] items-center justify-between rounded-md border bg-background px-3 text-left text-sm font-medium transition-colors hover:bg-accent"
                    title="Filter by category"
                  >
                    <span>Categories</span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px]">
                  <DropdownMenuLabel>Categories</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={allSelected}
                    onCheckedChange={onAllCheckedChange}
                    onSelect={(e) => e.preventDefault()}
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {categories.map((cat) => (
                    <DropdownMenuCheckboxItem
                      key={cat}
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={(checked) =>
                        onCategoryCheckedChange(cat, checked)
                      }
                      onSelect={(e) => e.preventDefault()}
                      className="justify-start"
                    >
                      <CategoryBadge category={cat} />
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const didInitCategoriesRef = useRef(false)

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

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const q of questions) {
      set.add((q.category || "Uncategorized").trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [questions])

  const allSelected =
    categories.length > 0 && selectedCategories.length === categories.length

  useEffect(() => {
    if (categories.length === 0) return
    // Initialize once: default to "All" on first load.
    if (!didInitCategoriesRef.current) {
      setSelectedCategories(categories)
      didInitCategoriesRef.current = true
    }
  }, [categories])

  const onAllCheckedChange = (checked: boolean | "indeterminate") => {
    const isChecked = checked === true
    if (isChecked) {
      setSelectedCategories(categories)
    } else {
      // Unchecking "All" clears the category selection.
      setSelectedCategories([])
    }
  }

  const onCategoryCheckedChange = (
    category: string,
    checked: boolean | "indeterminate"
  ) => {
    const isChecked = checked === true
    setSelectedCategories((prev) => {
      if (isChecked) return Array.from(new Set([...prev, category]))
      return prev.filter((c) => c !== category)
    })
  }

  const filterByCategory = (qs: ReviewQuestion[]) => {
    if (categories.length === 0) return qs
    if (allSelected) return qs
    if (selectedCategories.length === 0) return []

    const allowed = new Set(selectedCategories)
    return qs.filter((q) =>
      allowed.has((q.category || "Uncategorized").trim())
    )
  }

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
          <QuestionsTable
            data={filterByCategory(questions)}
            reviewStates={reviewStates}
            categories={categories}
            selectedCategories={selectedCategories}
            allSelected={allSelected}
            onAllCheckedChange={onAllCheckedChange}
            onCategoryCheckedChange={onCategoryCheckedChange}
          />
        </TabsContent>
        <TabsContent value="pending">
          <QuestionsTable
            data={filterByCategory(pending)}
            reviewStates={reviewStates}
            categories={categories}
            selectedCategories={selectedCategories}
            allSelected={allSelected}
            onAllCheckedChange={onAllCheckedChange}
            onCategoryCheckedChange={onCategoryCheckedChange}
          />
        </TabsContent>
        <TabsContent value="reviewed">
          <QuestionsTable
            data={filterByCategory(reviewed)}
            reviewStates={reviewStates}
            categories={categories}
            selectedCategories={selectedCategories}
            allSelected={allSelected}
            onAllCheckedChange={onAllCheckedChange}
            onCategoryCheckedChange={onCategoryCheckedChange}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
