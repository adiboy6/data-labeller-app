const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

/** Large / transient keys we do not persist on citations (keeps DB smaller). */
const OMIT_KEYS = new Set(["chunk"])

/**
 * Deep-clone incoming source_metadata and drop keys we do not store.
 * @param {unknown} raw
 */
function cloneSourceMetadataForDb(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = JSON.parse(JSON.stringify(raw))
  for (const k of OMIT_KEYS) delete o[k]
  return o
}

/**
 * Merge source_metadata for the same PDF URL across dataset rows (later rows win on conflicts).
 * @param {import('@prisma/client').Prisma.JsonValue | null} prev
 * @param {unknown} incoming
 */
function mergeFullSourceMetadata(prev, incoming) {
  const inc = cloneSourceMetadataForDb(incoming)
  if (!inc) return prev ?? null
  if (!prev || typeof prev !== "object" || Array.isArray(prev)) return inc

  /** @type {Record<string, unknown>} */
  const out = { .../** @type {Record<string, unknown>} */ (prev) }

  if (inc.bibliographic && typeof inc.bibliographic === "object") {
    const pb =
      prev.bibliographic &&
      typeof prev.bibliographic === "object" &&
      !Array.isArray(prev.bibliographic)
        ? /** @type {Record<string, unknown>} */ (prev.bibliographic)
        : {}
    out.bibliographic = {
      ...pb,
      .../** @type {Record<string, unknown>} */ (inc.bibliographic),
    }
  }

  for (const k of Object.keys(inc)) {
    if (k === "bibliographic") continue
    const v = inc[k]
    if (v !== undefined) out[k] = v
  }

  return out
}

async function main() {
  const projectRoot = path.join(__dirname, "..")
  const fileName = process.env.DATASET_FILE || "Dataset_QA.jsonl"
  const datasetPath = path.isAbsolute(fileName)
    ? fileName
    : path.join(projectRoot, fileName)

  if (!fs.existsSync(datasetPath)) {
    console.error("Dataset file not found at:", datasetPath)
    process.exit(1)
  }

  const raw = fs.readFileSync(datasetPath, "utf-8")
  const records = JSON.parse(raw)

  console.log(`Loaded ${records.length} records from ${path.basename(datasetPath)}`)

  const citationMetaByUrl = new Map()

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
      source_metadata: sourceMetadata,
    } = record

    if (!question || !answer) {
      skipped++
      continue
    }

    const reasoning = answer_reasoning || ""
    const evidence = evidence_answer_gen || evidence_question_gen || ""
    const category = question_category || null

    let citationId = null
    if (pdf_file) {
      const prevMeta = citationMetaByUrl.get(pdf_file) ?? null
      const merged = mergeFullSourceMetadata(prevMeta, sourceMetadata)
      citationMetaByUrl.set(pdf_file, merged)

      const citation = await prisma.citation.upsert({
        where: { url: pdf_file },
        update: { sourceMetadata: merged },
        create: {
          url: pdf_file,
          label: pdf_file,
          sourceMetadata: merged,
        },
      })
      citationId = citation.id
    }

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
