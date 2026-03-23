import React from "react"
import { Table, flexRender } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const

interface DataTableProps<TData> {
  table: Table<TData>
}

export function DataTable<TData>({ table }: DataTableProps<TData>) {
  const dialRef = React.useRef<HTMLDivElement>(null)
  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex

  React.useEffect(() => {
    const el = dialRef.current
    if (!el) return

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.deltaY > 0 || e.deltaX > 0) {
        table.nextPage()
      } else {
        table.previousPage()
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [table])

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[60vh] overflow-y-auto rounded-md border">
        <table className="w-full">
          <thead className="sticky top-0 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left font-medium"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <select
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronLeft className="size-4" />
          </Button>

          <div ref={dialRef} className="flex items-center gap-1 px-1">
            {pageCount > 1 ? (
              Array.from({ length: pageCount }, (_, i) => {
                const distance = Math.abs(i - currentPage)
                const isActive = i === currentPage
                return (
                  <button
                    key={i}
                    onClick={() => table.setPageIndex(i)}
                    className={cn(
                      "flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    style={{
                      opacity: isActive
                        ? 1
                        : Math.max(0.15, 1 - distance * 0.3),
                      transform: isActive ? "scale(1.2)" : "scale(1)",
                    }}
                  >
                    {i + 1}
                  </button>
                )
              })
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                1
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
