const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

async function main() {
  const datasetPath = path.join(__dirname, "..", "Dataset_QA.jsonl")

  if (!fs.existsSync(datasetPath)) {
    console.error("Dataset_QA.jsonl not found at:", datasetPath)
    process.exit(1)
  }

  const raw = fs.readFileSync(datasetPath, "utf-8")
  const records = JSON.parse(raw)

  console.log(`Loaded ${records.length} records from Dataset_QA.jsonl`)

  // Cache citations keyed by pdf_file so we only create each one once
  const citationCache = new Map()

  let created = 0
  let updated = 0
  let skipped = 0

  for (const record of records) {
    const {
      pdf_file,
      question,
      answer,
      answer_reasoning,
      evidence_answer_gen,
      evidence_question_gen,
      question_category,
    } = record

    // Skip records missing required fields
    if (!question || !answer) {
      skipped++
      continue
    }

    const reasoning = answer_reasoning || ""
    const evidence = evidence_answer_gen || evidence_question_gen || ""
    const category = question_category || null

    // Upsert Citation by pdf_file URL (one per unique pdf)
    let citationId = null
    if (pdf_file) {
      if (!citationCache.has(pdf_file)) {
        const citation = await prisma.citation.upsert({
          where: { url: pdf_file },
          update: {},
          create: {
            url: pdf_file,
            label: pdf_file,
          },
        })
        citationCache.set(pdf_file, citation.id)
      }
      citationId = citationCache.get(pdf_file)
    }

    // Upsert Question by unique question text
    const existing = await prisma.question.findUnique({
      where: { question },
      select: { id: true },
    })

    if (existing) {
      await prisma.question.update({
        where: { question },
        data: { answer, reasoning, evidence, category, citationId },
      })
      updated++
    } else {
      await prisma.question.create({
        data: { question, answer, reasoning, evidence, category, citationId },
      })
      created++
    }
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
