"use client"

import { Delete } from "lucide-react"
import { cn } from "@/lib/utils"

// A numeric keypad that edits a string of digits (interpreted as cents elsewhere).
export function NumPad({
  value,
  onChange,
  onEnter,
  className,
}: {
  value: string
  onChange: (next: string) => void
  onEnter?: () => void
  className?: string
}) {
  const press = (key: string) => {
    if (key === "back") {
      onChange(value.slice(0, -1))
    } else if (key === "clear") {
      onChange("")
    } else if (key === "00") {
      onChange((value + "00").replace(/^0+(?=\d)/, ""))
    } else {
      onChange((value + key).replace(/^0+(?=\d)/, ""))
    }
  }

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "back"]

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="flex h-14 items-center justify-center rounded-xl border border-border bg-background text-xl font-semibold transition-colors hover:bg-muted active:translate-y-px"
        >
          {k === "back" ? <Delete className="size-5" /> : k}
        </button>
      ))}
      {onEnter && (
        <button
          type="button"
          onClick={onEnter}
          className="col-span-3 flex h-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px"
        >
          Enter
        </button>
      )}
    </div>
  )
}
