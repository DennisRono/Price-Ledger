"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Undo2,
  Redo2,
  Sun,
  Moon,
  Store,
  Clock,
  Power,
  CalendarClock,
  History,
  Boxes,
  BarChart3,
  Monitor,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { NumPad } from "@/components/pos/numpad"
import { Modal } from "../modal"
import { usePOS } from "@/lib/pos/store"
import { money, timeOnly } from "@/lib/pos/format"
import { keypadToCents } from "@/lib/pos/format"
import { cn } from "@/lib/utils"
import { useToast } from "../notify"

const NAV = [
  { href: "/pos", label: "Register", icon: Monitor },
  { href: "/pos/history", label: "History", icon: History },
  { href: "/pos/inventory", label: "Inventory", icon: Boxes },
  { href: "/pos/reports", label: "Reports", icon: BarChart3 },
]

export function POSHeader() {
  const { state, actions, canUndo, canRedo, lastLabel } = usePOS()
  const { notify } = useToast()
  const pathname = usePathname()
  const [openShift, setOpenShift] = useState(false)
  const [closeShift, setCloseShift] = useState(false)
  const [floatDigits, setFloatDigits] = useState("")
  const [countDigits, setCountDigits] = useState("")

  const cashier = state.employees.find((e) => e.id === state.currentCashierId)
  const drawerCash = state.shift
    ? state.shift.drawer.reduce((s, t) => s + t.amount, 0)
    : 0

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{state.settings.storeName}</div>
            <div className="text-xs text-muted-foreground">
              {state.settings.registerId} · {cashier?.name ?? "No cashier"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {state.dayOpen ? (
            <Badge variant="outline" className="border-emerald-500 text-emerald-500">
              <CalendarClock className="size-3" /> Day Open
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              Day Closed
            </Badge>
          )}
          {state.shift ? (
            <Badge variant="outline" className="border-blue-500 text-blue-500">
              <Clock className="size-3" /> Shift {timeOnly(state.shift.openedAt)} · {money(drawerCash)}
            </Badge>
          ) : (
            <Badge variant="secondary">No Shift</Badge>
          )}
        </div>

        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5 border-l border-border pl-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => actions.undo()}
            disabled={!canUndo}
            aria-label="Undo"
            title={canUndo ? `Undo: ${lastLabel}` : "Nothing to undo"}
          >
            <Undo2 />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => actions.redo()}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              actions.updateSettings({
                theme: state.settings.theme === "dark" ? "light" : "dark",
              })
            }
            aria-label="Toggle theme"
          >
            {state.settings.theme === "dark" ? <Sun /> : <Moon />}
          </Button>

          {!state.dayOpen ? (
            <Button variant="secondary" size="sm" onClick={() => actions.openDay()}>
              Open Day
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                actions.closeDay()
                notify("Day closed", "success")
              }}
            >
              Close Day
            </Button>
          )}

          {!state.shift ? (
            <Button size="sm" onClick={() => setOpenShift(true)}>
              <Power /> Open Shift
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setCloseShift(true)}>
              <Power /> Close Shift
            </Button>
          )}
        </div>
      </div>

      {/* Open shift modal */}
      <Modal
        open={openShift}
        onClose={() => setOpenShift(false)}
        title="Open Shift"
        description="Count the opening cash float in the drawer."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenShift(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                actions.openShift(keypadToCents(floatDigits))
                setOpenShift(false)
                setFloatDigits("")
                notify("Shift opened", "success")
              }}
            >
              Open Shift
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field>
            <FieldLabel>Cashier</FieldLabel>
            <Select
              value={state.currentCashierId || ""}
              onValueChange={(val) => val && actions.setCashier(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cashier" />
              </SelectTrigger>
              <SelectContent>
                {state.employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center text-2xl font-bold tabular-nums">
            {money(keypadToCents(floatDigits))}
          </div>
          <NumPad value={floatDigits} onChange={setFloatDigits} />
        </div>
      </Modal>

      {/* Close shift modal */}
      <Modal
        open={closeShift}
        onClose={() => setCloseShift(false)}
        title="Close Shift"
        description="Count the cash drawer to reconcile."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseShift(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.closeShift(keypadToCents(countDigits))
                setCloseShift(false)
                setCountDigits("")
                notify("Shift closed", "success")
              }}
            >
              Close Shift
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Expected drawer</span>
            <span className="font-semibold tabular-nums">{money(drawerCash)}</span>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center text-2xl font-bold tabular-nums">
            {money(keypadToCents(countDigits))}
          </div>
          <div className="flex justify-between px-1 text-sm">
            <span className="text-muted-foreground">Over / Short</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                keypadToCents(countDigits) - drawerCash < 0 ? "text-destructive" : "text-emerald-600",
              )}
            >
              {money(keypadToCents(countDigits) - drawerCash)}
            </span>
          </div>
          <NumPad value={countDigits} onChange={setCountDigits} />
        </div>
      </Modal>
    </header>
  )
}