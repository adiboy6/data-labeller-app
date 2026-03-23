import { getServerSession } from "next-auth/next"
import { z } from "zod"

import { authOptions, authorizeAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const questions = await db.question.findMany({
      include: { citation: true },
      orderBy: { createdAt: "asc" },
    })

    return new Response(JSON.stringify(questions), {
      headers: { "Content-Type": "application/json" },
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

    const question = await db.question.create({ data })

    return new Response(JSON.stringify(question), {
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
