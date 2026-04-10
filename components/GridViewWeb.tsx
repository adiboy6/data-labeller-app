"use client"

import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion"
import {
  Check,
  ClipboardList,
  Home,
  Info,
  Lightbulb,
  Menu,
  MessageSquare,
  RotateCcw,
  Send,
  Upload,
  User,
  X,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReviewStatus = "approved" | "rejected" | "pending"

export interface ReviewQuestion {
  id: string
  question: string
  answer: string
  evidence: string
  reasoning: string
  category: string | null
  citationId: string | null
  citation: {
    id: string
    url: string
    label: string
    sourceMetadata: unknown | null
  } | null
}

interface ReviewState {
  status: ReviewStatus
  comment: string
}

// "explanation" is a 3rd right-side overlay for reasoning + evidence
type ActiveDrawer = "status" | "comments" | "explanation" | null

interface GridViewUser {
  name?: string | null
  image?: string | null
  email?: string | null
}

type CommentItem = {
  id: string
  text: string
}

const COMMENT_DELIMITER = "\n"

function parseCommentString(raw: string): CommentItem[] {
  return raw
    .split(COMMENT_DELIMITER)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, idx) => ({
      id: `${idx}-${text.slice(0, 12)}`,
      text,
    }))
}

function joinComments(items: CommentItem[]): string {
  return items
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join(COMMENT_DELIMITER)
}

function formatSourceMetadata(metadata: unknown): string {
  if (metadata == null) return "No metadata available."
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

function extractBibliographic(metadata: unknown): Record<string, unknown> | null {
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

const BIBLIOGRAPHIC_FIELD_ORDER = ["title", "authors", "published_date"]

function formatBibliographicValue(value: unknown): React.ReactNode {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    if (value.every((v) => typeof v === "string")) return value.join(", ")
    return JSON.stringify(value)
  }
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function BibliographicMetadataView({ metadata }: { metadata: unknown }) {
  const bib = extractBibliographic(metadata)
  const entries =
    bib != null
      ? Object.entries(bib)
          .filter(
            ([k, v]) =>
              BIBLIOGRAPHIC_FIELD_ORDER.includes(k) &&
              v != null &&
              v !== "" &&
              !(Array.isArray(v) && v.length === 0)
          )
          .sort(
            (a, b) =>
              BIBLIOGRAPHIC_FIELD_ORDER.indexOf(a[0]) -
              BIBLIOGRAPHIC_FIELD_ORDER.indexOf(b[0])
          )
      : []

  if (entries.length === 0) {
    return (
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {formatSourceMetadata(metadata)}
      </pre>
    )
  }

  return (
    <dl className="space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid gap-0.5 text-[11px] leading-snug sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:gap-x-3"
        >
          <dt className="font-medium text-foreground">{humanizeMetadataKey(key)}</dt>
          <dd className="min-w-0 break-words text-muted-foreground">
            {formatBibliographicValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function saveReviewToDb(
  questionId: string,
  response: ReviewStatus,
  comments: string,
  suppressErrorToast = false
): Promise<boolean> {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ questionId, response, comments }),
    })
    if (!res.ok) {
      // Show the specific API error; fall back to a generic message.
      let message = "Failed to save review"
      try {
        const parsed = await res.json()
        if (parsed?.error) message = parsed.error
      } catch {}
      if (!suppressErrorToast) {
        toast({ title: message, variant: "destructive" })
      }
      return false
    }
    return true
  } catch (err) {
    console.error("Failed to save review:", err)
    if (!suppressErrorToast) {
      toast({ title: "Network error — review not saved", variant: "destructive" })
    }
    return false
  }
}

// ─── Drawer (shared primitive) ────────────────────────────────────────────────
// Fixed overlay — never pushes layout. Backdrop uses backdrop-blur-sm + bg-black/50.

interface DrawerProps {
  open: boolean
  onClose: () => void
  side: "left" | "right"
  widthClass?: string
  children: React.ReactNode
}

function Drawer({
  open,
  onClose,
  side,
  widthClass = "w-full md:w-[35%]",
  children,
}: DrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          <motion.div
            className={cn(
              "absolute bottom-0 top-0 z-10 flex flex-col border-border bg-background shadow-2xl",
              widthClass,
              side === "left" ? "left-0 border-r" : "right-0 border-l"
            )}
            initial={{ x: side === "left" ? "-100%" : "100%", opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: side === "left" ? "-100%" : "100%", opacity: 0.95 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

// ─── SideNav ──────────────────────────────────────────────────────────────────

interface SideNavProps {
  onOpenStatus: () => void
  onReset: () => void
  canReset: boolean
  canSubmit: boolean
  onSubmit: () => void
}

function SideNav({
  onOpenStatus,
  onReset,
  canReset,
  canSubmit,
  onSubmit,
}: SideNavProps) {
  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-full w-14 flex-col items-center justify-between border-r border-border bg-background py-4 md:flex">
      <div className="flex flex-col items-center gap-2">
        <a
          href="/dashboard"
          className="rounded-md p-2 text-foreground transition-colors hover:bg-accent"
          aria-label="Dashboard"
        >
          <Home className="h-5 w-5" />
        </a>
        <button
          onClick={onReset}
          disabled={!canReset}
          className="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Reset all reviews and go to first question"
          title="Reset all and return to first question"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-green-500 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Submit all reviews"
          title={canSubmit ? "Submit all reviews" : "Review all questions to submit"}
        >
          <Upload className="h-5 w-5" />
        </button>
      </div>
      <button
        onClick={onOpenStatus}
        className="rounded-md p-2 text-foreground transition-colors hover:bg-accent"
        aria-label="Question status"
      >
        <Menu className="h-5 w-5" />
      </button>
    </aside>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  reviewedCount: number
  total: number
  user?: GridViewUser
}

function ProgressBar({ reviewedCount, total, user }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((reviewedCount / total) * 100) : 0
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background px-4 md:pl-16">
      <div className="flex-1">
        <Progress value={percent} className="h-1.5 rounded-full" />
      </div>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {reviewedCount}/{total}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none" aria-label="User menu">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={user?.image ?? ""} alt={user?.name ?? "User"} />
              <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem asChild>
            <a href="/dashboard/settings">Profile</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/api/auth/signout">Logout</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

// ─── QACard (static inner content) ────────────────────────────────────────────

interface QACardContentProps {
  question: ReviewQuestion
  questionNumber: number
  totalQuestions: number
  onShowExplanation: () => void
}

function QACardContent({
  question,
  questionNumber,
  totalQuestions,
  onShowExplanation,
}: QACardContentProps) {
  return (
    <>
      <div className="max-h-[210px] overflow-y-auto border-b border-border p-5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="font-semibold">Question</span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {`${questionNumber} of ${totalQuestions}`}
          </span>
          {question.citation ? (
            <HoverCard openDelay={150} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex cursor-help rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Citation metadata"
                >
                  <Info className="h-4 w-4" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                align="start"
                className="w-[min(90vw,28rem)] border bg-popover p-3 text-xs"
              >
                <p className="mb-2 font-semibold text-foreground">Source metadata</p>
                <p className="mb-2 break-all text-muted-foreground">
                  <span className="font-medium text-foreground">Source:</span>{" "}
                  {question.citation.label || question.citation.url}
                </p>
                <BibliographicMetadataView
                  metadata={question.citation.sourceMetadata}
                />
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span
              title="No source metadata available"
              className="inline-flex cursor-help text-muted-foreground"
            >
              <Info className="h-4 w-4" />
            </span>
          )}
          {question.category && (
            <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {question.category}
            </span>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-foreground md:text-sm">
          {question.question}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold">Answer</span>
          <button
            type="button"
            title="Show Explanation"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onShowExplanation()
            }}
            className="inline-flex items-center rounded-sm text-muted-foreground transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Show Explanation"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="text-[13px] leading-relaxed text-foreground md:text-sm">
            {question.answer}
          </p>
        </div>
      </div>
    </>
  )
}

const SWIPE_THRESHOLD = 150
const EXIT_DISTANCE = 520
const EXIT_DURATION = 0.3

// ─── QACardStack: Tinder-style stack + swipe ─────────────────────────────────

interface QACardStackProps {
  questions: ReviewQuestion[]
  selectedIndex: number
  onAdvance: () => void
  onCommit: (questionId: string, status: ReviewStatus) => void
  onShowExplanation: () => void
  /** Unique key per button press so each trigger runs exactly one exit animation */
  exitRequest: { key: number; direction: "approve" | "deny" } | null
  onExitRequestHandled: () => void
}

function QACardStack({
  questions,
  selectedIndex,
  onAdvance,
  onCommit,
  onShowExplanation,
  exitRequest,
  onExitRequestHandled,
}: QACardStackProps) {
  const top = questions[selectedIndex]
  const x = useMotionValue(0)
  // Map drag position to rotation (-20deg … +20deg); aligns with exit distance
  const rotate = useTransform(x, [-EXIT_DISTANCE, EXIT_DISTANCE], [-20, 20])
  // Stamp opacity: 0 at center → 1 at threshold (clamped)
  const approveStampOpacity = useTransform(x, (v) =>
    v <= 0 ? 0 : Math.min(1, v / SWIPE_THRESHOLD)
  )
  const denyStampOpacity = useTransform(x, (v) =>
    v >= 0 ? 0 : Math.min(1, Math.abs(v) / SWIPE_THRESHOLD)
  )
  const flyingRef = useRef(false)

  // Reset drag when the active card changes
  useEffect(() => {
    x.set(0)
    flyingRef.current = false
  }, [top?.id, x])

  useEffect(() => {
    if (!exitRequest) return
    const q = questions[selectedIndex]
    if (!q) return
    const questionId = q.id
    const direction = exitRequest.direction
    const targetX = direction === "approve" ? EXIT_DISTANCE : -EXIT_DISTANCE
    flyingRef.current = true
    void animate(x, targetX, { duration: EXIT_DURATION, ease: "easeInOut" }).then(
      () => {
        onCommit(questionId, direction === "approve" ? "approved" : "rejected")
        onAdvance()
        x.set(0)
        flyingRef.current = false
        onExitRequestHandled()
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tied to exitRequest.key only
  }, [exitRequest?.key])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (flyingRef.current) return
    const q = questions[selectedIndex]
    if (!q) return
    const ox = info.offset.x
    if (ox > SWIPE_THRESHOLD) {
      flyingRef.current = true
      void animate(x, EXIT_DISTANCE, {
        duration: EXIT_DURATION,
        ease: "easeInOut",
      }).then(() => {
        onCommit(q.id, "approved")
        onAdvance()
        x.set(0)
        flyingRef.current = false
      })
      return
    }
    if (ox < -SWIPE_THRESHOLD) {
      flyingRef.current = true
      void animate(x, -EXIT_DISTANCE, {
        duration: EXIT_DURATION,
        ease: "easeInOut",
      }).then(() => {
        onCommit(q.id, "rejected")
        onAdvance()
        x.set(0)
        flyingRef.current = false
      })
      return
    }
    void animate(x, 0, { type: "spring", stiffness: 380, damping: 28 })
  }

  const stackSlots = [2, 1, 0] as const

  return (
    <div className="relative mx-auto h-[560px] w-full md:w-3/4">
      {stackSlots.map((depth) => {
        const idx = selectedIndex + depth
        const q = questions[idx]
        if (!q) return null

        const isTop = depth === 0
        const z = 30 - depth * 10

        if (isTop) {
          return (
            <motion.div
              key={q.id}
              className="absolute inset-x-0 top-0 touch-pan-y"
              style={{ zIndex: z, perspective: 1000 }}
            >
              <motion.div
                style={{ x, rotate }}
                drag="x"
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="relative flex h-[540px] cursor-grab flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-md active:cursor-grabbing"
              >
                <motion.span
                  className="pointer-events-none absolute left-6 top-6 z-10 rounded-md border-4 border-green-500 px-3 py-1 text-xl font-black uppercase tracking-widest text-green-500"
                  style={{
                    opacity: approveStampOpacity,
                    rotate: -15,
                  }}
                >
                  APPROVE
                </motion.span>
                <motion.span
                  className="pointer-events-none absolute right-6 top-6 z-10 rounded-md border-4 border-red-500 px-3 py-1 text-xl font-black uppercase tracking-widest text-red-500"
                  style={{
                    opacity: denyStampOpacity,
                    rotate: 15,
                  }}
                >
                  DENY
                </motion.span>
                <QACardContent
                  question={q}
                  questionNumber={idx + 1}
                  totalQuestions={questions.length}
                  onShowExplanation={onShowExplanation}
                />
              </motion.div>
            </motion.div>
          )
        }

        return (
          <motion.div
            key={q.id}
            className="pointer-events-none absolute inset-x-0 top-0 flex h-[540px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-md"
            style={{ zIndex: z }}
            initial={false}
            animate={{
              scale: 1 - depth * 0.05,
              y: depth * 10,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <QACardContent
              question={q}
              questionNumber={idx + 1}
              totalQuestions={questions.length}
              onShowExplanation={() => {}}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── ActionButtons ────────────────────────────────────────────────────────────

interface ActionButtonsProps {
  status: ReviewStatus
  onApprove: () => void
  onDeny: () => void
}

function ActionButtons({ status, onApprove, onDeny }: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-8 py-4">
      <button
        onClick={onApprove}
        className="group flex flex-col items-center gap-1.5"
        aria-label="Approve"
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-lg transition-colors",
            status === "approved"
              ? "border-green-500 bg-green-500 text-white ring-2 ring-green-300"
              : "border-green-500 bg-green-500/10 text-green-500 group-hover:bg-green-500/20"
          )}
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
        <span className="text-xs text-muted-foreground">
          {status === "approved" ? "Approved" : "Approve"}
        </span>
      </button>
      <button
        onClick={onDeny}
        className="group flex flex-col items-center gap-1.5"
        aria-label="Deny"
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-lg transition-colors",
            status === "rejected"
              ? "border-red-500 bg-red-500 text-white ring-2 ring-red-300"
              : "border-red-500 bg-red-500/10 text-red-500 group-hover:bg-red-500/20"
          )}
        >
          <X className="h-7 w-7" strokeWidth={3} />
        </span>
        <span className="text-xs text-muted-foreground">
          {status === "rejected" ? "Denied" : "Deny"}
        </span>
      </button>
    </div>
  )
}

// ─── QuestionStatusDrawer ─────────────────────────────────────────────────────

interface QuestionStatusDrawerProps {
  open: boolean
  onClose: () => void
  questions: ReviewQuestion[]
  reviewStates: Record<string, ReviewState>
  selectedIndex: number
  onSelect: (index: number) => void
}

function statusTextColor(status: ReviewStatus): string {
  if (status === "approved") return "text-green-500"
  if (status === "rejected") return "text-red-500"
  return "text-muted-foreground"
}

function QuestionStatusDrawer({
  open,
  onClose,
  questions,
  reviewStates,
  selectedIndex,
  onSelect,
}: QuestionStatusDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} side="left" widthClass="w-full md:w-[35%]">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">Question Status</h2>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <ul className="space-y-3">
          {questions.map((q, idx) => {
            const status = reviewStates[q.id]?.status ?? "pending"
            const isActive = idx === selectedIndex
            const label =
              q.question.length > 60 ? q.question.slice(0, 60) + "…" : q.question
            return (
              <li key={q.id}>
                <button
                  onClick={() => {
                    onSelect(idx)
                    onClose()
                  }}
                  className={cn(
                    "w-full text-left text-sm leading-snug transition-colors hover:opacity-80",
                    statusTextColor(status),
                    isActive && "font-semibold"
                  )}
                >
                  <span className="font-medium">{idx + 1}. </span>
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </Drawer>
  )
}

// ─── CommentsTray ─────────────────────────────────────────────────────────────
// Floating bottom-right tray with upward-growing feed and bottom input.

interface CommentsTrayProps {
  open: boolean
  comments: CommentItem[]
  draft: string
  onDraftChange: (val: string) => void
  onSend: () => void
  onClose: () => void
}

function CommentsTray({
  open,
  comments,
  draft,
  onDraftChange,
  onSend,
  onClose,
}: CommentsTrayProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="comments-tray"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="fixed bottom-0 right-0 z-50 w-full max-h-[60vh] border border-white/10 bg-black/70 backdrop-blur-md shadow-2xl sm:bottom-4 sm:right-4 sm:w-[380px] sm:rounded-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-white/90">Comments</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-full max-h-[calc(60vh-52px)] flex-col">
            <ScrollArea className="flex-1 px-3 py-3">
              <motion.ul layout className="space-y-2">
                <AnimatePresence initial={false}>
                  {comments.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/90"
                    >
                      {item.text}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </ScrollArea>

            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      onSend()
                    }
                  }}
                  placeholder="Add a comment..."
                  className="h-10 flex-1 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35"
                />
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!draft.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

// ─── ExplanationDrawer ────────────────────────────────────────────────────────
// Shows reasoning + evidence from the DB for the current question.

interface ExplanationDrawerProps {
  open: boolean
  onClose: () => void
  reasoning: string
  evidence: string
}

function ExplanationDrawer({
  open,
  onClose,
  reasoning,
  evidence,
}: ExplanationDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} side="right" widthClass="w-full md:w-[40%]">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">Explanation</h2>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-5">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Answer Reasoning</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {reasoning || "No reasoning provided."}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Evidence</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {evidence || "No evidence provided."}
            </p>
          </div>
        </div>
      </ScrollArea>
    </Drawer>
  )
}

// ─── BottomTabBar ─────────────────────────────────────────────────────────────

interface BottomTabBarProps {
  onOpenStatus: () => void
  onOpenComments: () => void
}

function BottomTabBar({ onOpenStatus, onOpenComments }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-14 items-center justify-around border-t border-border bg-background md:hidden">
      <a
        href="/dashboard"
        className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="h-5 w-5" />
        Home
      </a>
      <button
        onClick={onOpenStatus}
        className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ClipboardList className="h-5 w-5" />
        Questions
      </button>
      <button
        onClick={onOpenComments}
        className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquare className="h-5 w-5" />
        Reviews
      </button>
      <button className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <User className="h-5 w-5" />
        Profile
      </button>
    </nav>
  )
}

// ─── GridView (default export) ────────────────────────────────────────────────

interface GridViewProps {
  user?: GridViewUser
}

export default function GridView({ user }: GridViewProps) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({})
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [pendingDecision, setPendingDecision] = useState<ReviewStatus | null>(null)
  const [exitRequest, setExitRequest] = useState<{
    key: number
    direction: "approve" | "deny"
  } | null>(null)
  const decisionDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref so debounced timers always see latest state without stale closure
  const reviewStatesRef = useRef(reviewStates)
  useEffect(() => {
    reviewStatesRef.current = reviewStates
  }, [reviewStates])


  // ── Load questions + existing reviews on mount ──────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [questionsRes, reviewsRes] = await Promise.all([
          fetch("/api/questions", { credentials: "same-origin", cache: "no-store" }),
          fetch("/api/reviews", { credentials: "same-origin" }),
        ])

        const questionsData: ReviewQuestion[] = await questionsRes.json()
        const reviewsData: Array<{
          questionId: string
          response: string
          comments: string | null
        }> = reviewsRes.ok ? await reviewsRes.json() : []

        setQuestions(questionsData)

        const states: Record<string, ReviewState> = {}
        for (const q of questionsData) {
          const existing = reviewsData.find((r) => r.questionId === q.id)
          states[q.id] = {
            status: (existing?.response as ReviewStatus) ?? "pending",
            comment: existing?.comments ?? "",
          }
        }
        setReviewStates(states)
      } catch {
        toast({ title: "Failed to load questions", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived values ──────────────────────────────────────────────────────────
  const total = questions.length
  const currentQuestion = questions[selectedIndex]
  const currentState = currentQuestion ? reviewStates[currentQuestion.id] : undefined
  const reviewedCount = Object.values(reviewStates).filter(
    (s) => s.status !== "pending"
  ).length
  const allReviewed = total > 0 && reviewedCount === total
  const queueAtEnd = total > 0 && selectedIndex >= total

  useEffect(() => {
    if (queueAtEnd) setActiveDrawer(null)
  }, [queueAtEnd])

  // ── Actions ─────────────────────────────────────────────────────────────────

  function setStatus(id: string, next: ReviewStatus) {
    setReviewStates((prev) => ({ ...prev, [id]: { ...prev[id], status: next } }))
    const comment = reviewStatesRef.current[id]?.comment ?? ""
    saveReviewToDb(id, next, comment)
  }

  async function saveReviewWithRetry(
    questionId: string,
    response: ReviewStatus,
    comments: string
  ) {
    const first = await saveReviewToDb(questionId, response, comments, true)
    if (first) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
    return saveReviewToDb(questionId, response, comments, true)
  }

  function appendComment(questionId: string, text: string) {
    const clean = text.trim()
    if (!clean) return

    const prevItems = parseCommentString(
      reviewStatesRef.current[questionId]?.comment ?? ""
    )
    const nextItems: CommentItem[] = [
      ...prevItems,
      { id: `${Date.now()}`, text: clean },
    ]
    const joined = joinComments(nextItems)
    const status = reviewStatesRef.current[questionId]?.status ?? "pending"

    setReviewStates((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], comment: joined },
    }))
    saveReviewToDb(questionId, status, joined)
  }

  function handleApprove() {
    if (!currentQuestion || queueAtEnd || exitRequest || pendingDecision) return
    setPendingDecision("approved")
    decisionDelayRef.current = setTimeout(() => {
      setExitRequest({ key: Date.now(), direction: "approve" })
    }, 140)
  }

  function handleDeny() {
    if (!currentQuestion || queueAtEnd || exitRequest || pendingDecision) return
    setPendingDecision("rejected")
    decisionDelayRef.current = setTimeout(() => {
      setExitRequest({ key: Date.now(), direction: "deny" })
    }, 140)
  }

  async function handleReset() {
    const resetStates: Record<string, ReviewState> = {}
    const savePromises: Promise<boolean>[] = []

    for (const q of questions) {
      resetStates[q.id] = { status: "pending", comment: "" }
      savePromises.push(saveReviewWithRetry(q.id, "pending", ""))
    }

    setReviewStates(resetStates)
    setSelectedIndex(0)
    setActiveDrawer(null)
    setCommentDraft("")
    setPendingDecision(null)
    setExitRequest(null)
    if (decisionDelayRef.current) {
      clearTimeout(decisionDelayRef.current)
      decisionDelayRef.current = null
    }

    const results = await Promise.all(savePromises)
    const failedCount = results.filter((ok) => !ok).length
    if (failedCount === 0) {
      toast({ description: "All reviews reset. Back to question 1." })
    } else {
      toast({
        title: "Some resets failed",
        description: `${failedCount} item(s) could not be reset. Please retry once.`,
        variant: "destructive",
      })
    }
  }

  async function handleSubmit() {
    const latest = reviewStatesRef.current
    const results = await Promise.all(
      questions.map((q) => {
        const s = latest[q.id]
        return saveReviewWithRetry(
          q.id,
          s?.status ?? "pending",
          s?.comment ?? ""
        )
      })
    )
    const failedCount = results.filter((ok) => !ok).length
    if (failedCount === 0) {
      toast({ description: "All reviews submitted!" })
    } else {
      toast({
        title: "Some reviews failed to save",
        description: `${failedCount} item(s) did not save. Please submit again.`,
        variant: "destructive",
      })
    }
  }

  const openStatus = () => setActiveDrawer("status")
  const openComments = () => {
    if (queueAtEnd || !questions[selectedIndex]) return
    setActiveDrawer((prev) => (prev === "comments" ? null : "comments"))
  }
  const closeDrawer = () => setActiveDrawer(null)

  const currentComments = currentState
    ? parseCommentString(currentState.comment)
    : []

  useEffect(() => {
    setCommentDraft("")
  }, [currentQuestion?.id, activeDrawer])

  useEffect(() => {
    setPendingDecision(null)
  }, [currentQuestion?.id])

  useEffect(() => {
    return () => {
      if (decisionDelayRef.current) {
        clearTimeout(decisionDelayRef.current)
      }
    }
  }, [])

  // ── Loading / empty states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-muted-foreground">No questions available.</p>
        <a href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </a>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SideNav
        onOpenStatus={openStatus}
        onReset={handleReset}
        canReset={questions.length > 0}
        canSubmit={allReviewed}
        onSubmit={handleSubmit}
      />

      <ProgressBar reviewedCount={reviewedCount} total={total} user={user} />

      {/* Main — offset for fixed top bar (pt-12) + side nav (md:pl-14) + mobile tab bar (pb-14) */}
      <main className="flex min-h-screen flex-col items-center justify-start px-4 pb-14 pt-20 md:pl-14 md:pb-8">
        <div className="flex w-full flex-col items-center gap-2">
          {queueAtEnd ? (
            <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <p className="text-foreground">
                You&apos;ve reached the end of the queue.
              </p>
              <p>
                Use the back control or the question list to return to earlier
                items.
              </p>
            </div>
          ) : (
            <>
              <QACardStack
                questions={questions}
                selectedIndex={selectedIndex}
                onAdvance={() =>
                  setSelectedIndex((i) => Math.min(i + 1, questions.length))
                }
                onCommit={(id, status) => setStatus(id, status)}
                onShowExplanation={() => setActiveDrawer("explanation")}
                exitRequest={exitRequest}
                onExitRequestHandled={() => {
                  setExitRequest(null)
                  setPendingDecision(null)
                  if (decisionDelayRef.current) {
                    clearTimeout(decisionDelayRef.current)
                    decisionDelayRef.current = null
                  }
                }}
              />
              {currentQuestion && currentState ? (
                <ActionButtons
                  status={pendingDecision ?? currentState.status}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                />
              ) : null}
            </>
          )}
        </div>
      </main>

      <BottomTabBar onOpenStatus={openStatus} onOpenComments={openComments} />

      {/* Chat bubble — fixed bottom-right, above BottomTabBar on mobile */}
      <button
        type="button"
        onClick={openComments}
        disabled={queueAtEnd || !currentQuestion}
        className="fixed bottom-16 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-secondary shadow-lg transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40 md:bottom-6"
        aria-label="Open review note"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <QuestionStatusDrawer
        open={activeDrawer === "status"}
        onClose={closeDrawer}
        questions={questions}
        reviewStates={reviewStates}
        selectedIndex={Math.min(selectedIndex, total - 1)}
        onSelect={setSelectedIndex}
      />
      {currentQuestion && currentState ? (
        <>
          <CommentsTray
            open={activeDrawer === "comments"}
            onClose={closeDrawer}
            comments={currentComments}
            draft={commentDraft}
            onDraftChange={setCommentDraft}
            onSend={() => {
              appendComment(currentQuestion.id, commentDraft)
              setCommentDraft("")
            }}
          />
          <ExplanationDrawer
            open={activeDrawer === "explanation"}
            onClose={closeDrawer}
            reasoning={currentQuestion.reasoning}
            evidence={currentQuestion.evidence}
          />
        </>
      ) : null}
    </div>
  )
}
