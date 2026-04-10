import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import GridView from "@/components/GridView"

export default async function GridPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?from=/grid")
  return <GridView user={user} />
}
