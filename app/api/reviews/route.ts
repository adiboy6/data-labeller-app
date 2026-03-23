import { getServerSession } from "next-auth/next"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error("[reviews/GET] No session found — returning 401")
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId") || session.user.id

    if (userId !== session.user.id) {
      return new Response(JSON.stringify([]), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    const reviews = await db.userResponse.findMany({
      where: { userId },
    })

    return new Response(JSON.stringify(reviews), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[reviews/GET] Error:", error)
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

const upsertReviewSchema = z.object({
  questionId: z.string().min(1),
  response: z.enum(["approved", "rejected", "pending"]),
  comments: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error("[reviews/POST] No session found — returning 401")
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const userExists = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (!userExists) {
      console.error("[reviews/POST] User not found in DB — stale session. User should re-sign-in.")
      return new Response(
        JSON.stringify({ error: "User not found. Please sign out and sign back in." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const data = upsertReviewSchema.parse(body)

    const review = await db.userResponse.upsert({
      where: {
        userId_questionId: {
          userId: session.user.id,
          questionId: data.questionId,
        },
      },
      update: {
        response: data.response,
        comments: data.comments ?? null,
      },
      create: {
        userId: session.user.id,
        questionId: data.questionId,
        response: data.response,
        comments: data.comments ?? null,
      },
    })

    return new Response(JSON.stringify(review), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[reviews/POST] Error:", error)
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), { status: 422 })
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
