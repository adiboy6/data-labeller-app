import * as React from "react"

import { cn } from "@/lib/utils"

interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DashboardShell({
  children,
  className,
  ...props
}: DashboardShellProps) {
  return (
    <div className={cn("grid w-full min-w-0 items-start gap-8", className)} {...props}>
      {children}
    </div>
  )
}
