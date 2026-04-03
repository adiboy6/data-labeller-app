import { getServerSession } from "next-auth/next"
import { z } from "zod"

import { authOptions, authorizeAdmin } from "@/lib/auth"
import {
  decodeUnicodeEscapes,
  decodeUnicodeEscapesDeep,
} from "@/lib/decode-unicode-escapes"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

function decodeQuestionPayload<
  T extends {
    question: string
    answer: string
    evidence: string
    reasoning: string
    category: string | null
    citation: null | {
      url: string
      label: string
      sourceMetadata: unknown | null
    }
  },
>(row: T): T {
  return {
    ...row,
    question: decodeUnicodeEscapes(row.question),
    answer: decodeUnicodeEscapes(row.answer),
    evidence: decodeUnicodeEscapes(row.evidence),
    reasoning: decodeUnicodeEscapes(row.reasoning),
    category:
      row.category != null ? decodeUnicodeEscapes(row.category) : null,
    citation: row.citation
      ? {
          ...row.citation,
          url: decodeUnicodeEscapes(row.citation.url),
          label: decodeUnicodeEscapes(row.citation.label),
          sourceMetadata: decodeUnicodeEscapesDeep(row.citation.sourceMetadata),
        }
      : null,
  }
}

export async function GET() {
  try {
    const questions = await db.question.findMany({
      include: { citation: true },
      orderBy: { createdAt: "asc" },
    })

    const payload = questions.map((q) => decodeQuestionPayload(q))

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    return new Response(null, { status: 500 })
  }
}

const createQuestionSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  evidence: z.string().min(1),
  reasoning: z.string().min(1),
  citationId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    if (!(await authorizeAdmin(req))) {
      return new Response(null, { status: 403 })
    }

    const body = await req.json()
    const data = createQuestionSchema.parse(body)

    const question = await db.question.create({
      data,
      include: { citation: true },
    })

    return new Response(JSON.stringify(decodeQuestionPayload(question)), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), { status: 422 })
    }
    return new Response(null, { status: 500 })
  }
}
