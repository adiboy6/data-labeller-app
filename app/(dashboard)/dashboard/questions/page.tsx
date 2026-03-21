import { Metadata } from "next"
import { QuestionsDataTable } from "./components/questions-data-table"

export const metadata: Metadata = {
  title: "Questions",
  description: "A Question answering app.",
}

export default function QuestionsPage() {
  return (
    <div className="flex h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back!</h2>
          <p className="text-muted-foreground">
            Here&apos;s a list of your questions!
          </p>
        </div>
      </div>
      <QuestionsDataTable />
    </div>
  )
}
