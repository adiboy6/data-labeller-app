"use client"

import { useEffect, useState } from "react"

import GridViewMobile from "@/components/GridViewMobile"
import GridViewWeb from "@/components/GridViewWeb"

interface GridViewUser {
  name?: string | null
  image?: string | null
  email?: string | null
}

interface GridViewProps {
  user?: GridViewUser
}

export default function GridView({ user }: GridViewProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return isMobile ? <GridViewMobile user={user} /> : <GridViewWeb user={user} />
}
