"use client"

import { useEffect, useState } from "react"
import {
  Fuel,
  Plus,
  Play,
  Pause,
  Square,
  Lock,
  Unlock,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Undo2,
  History,
  Settings,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/modal"
import { usePOS } from "@/lib/pos/store"
import { money } from "@/lib/pos/format"
import { keypadToCents } from "@/lib/pos/format"
import { NumPad } from "@/components/pos/numpad"

import { cn } from "@/lib/utils"
import { useToast } from "@/components/notify"

// ---------------------------------------------------------------------------
// Corrected types (include missing transactions property)
// ---------------------------------------------------------------------------
export type FuelPumpTransaction = {
  timestamp: number
  type: "stop" | "rest_in_gas" | "transfer_in" | "transfer_out" | "refund" | "manual_adjust" | "drive_off"
  gallons: number
  amount: number // cents, signed where relevant
  note?: string
}

export type FuelGrade = {
  name: string
  pricePerGallon: number // cents per gallon
}

export type FuelPumpStatus =
  | "idle"
  | "authorized"
  | "pumping"
  | "paused"
  | "completed"
  | "locked"

export type FuelPump = {
  id: string
  label: string
  status: FuelPumpStatus
  grades: FuelGrade[]
  selectedGrade: number
  mode: "prepay" | "postpay"
  prepayAmount?: number
  gallons: number
  amount: number
  saleId?: string
  claimed: boolean
  authorizedAt?: number
  completedAt?: number
  transactions: FuelPumpTransaction[] // <-- FIXED: added missing property
}
// ---------------------------------------------------------------------------

// Map status to Badge variant and extra colour class
const STATUS_STYLE: Record<
  FuelPumpStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  idle: { variant: "secondary", className: "" },
  authorized: { variant: "outline", className: "border-blue-500 text-blue-500" },
  pumping: { variant: "outline", className: "border-emerald-500 text-emerald-500" },
  paused: { variant: "outline", className: "border-amber-500 text-amber-500" },
  completed: { variant: "outline", className: "border-sky-500 text-sky-500" },
  locked: { variant: "destructive", className: "" },
}

export function FuelBar() {
  const { state, actions } = usePOS()
  const [openPumpId, setOpenPumpId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const pump = state.pumps.find((p) => p.id === openPumpId) || null

  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Fuel className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Fuel</span>
        <Badge variant="secondary">{state.pumps.length} pumps</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="xs" onClick={() => actions.addPump()}>
            <Plus /> Add Pump
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? "Show" : "Hide"}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {state.pumps.map((p) => {
            const grade = p.grades[p.selectedGrade]
            const style = STATUS_STYLE[p.status]
            return (
              <button
                key={p.id}
                onClick={() => setOpenPumpId(p.id)}
                className={cn(
                  "flex min-w-35 shrink-0 flex-col gap-1 rounded-xl border bg-background p-2.5 text-left transition-all hover:border-primary/50",
                  p.status === "pumping" && "border-emerald-500/60",
                  p.status === "locked" && "border-destructive/60",
                  p.status === "completed" && "border-sky-500/60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.label}</span>
                  <Badge variant={style.variant} className={cn("px-1.5 py-0 capitalize", style.className)}>
                    {p.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {grade?.name} · {money(grade?.pricePerGallon ?? 0)}/gal
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="tabular-nums">{p.gallons.toFixed(2)} gal</span>
                  <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                </div>
                {p.status === "completed" && !p.saleId && (
                  <span className="text-[10px] font-medium text-sky-600">Tap to claim</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <FuelPumpModal pump={pump} onClose={() => setOpenPumpId(null)} />
    </div>
  )
}

// ---------- Extended Pump Modal ----------
function FuelPumpModal({ pump, onClose }: { pump: FuelPump | null; onClose: () => void }) {
  const { state, actions } = usePOS()
  const { notify } = useToast()
  const [mode, setMode] = useState<"prepay" | "postpay">("prepay")
  const [grade, setGrade] = useState(0)
  const [prepayDigits, setPrepayDigits] = useState("")
  const [gallonInput, setGallonInput] = useState("")
  const [activeTab, setActiveTab] = useState<"control" | "adjustments" | "history">("control")

  // Rest in Gas
  const [restAmount, setRestAmount] = useState("")

  // Transfer
  const [targetPumpId, setTargetPumpId] = useState<string | null>("")

  // Refund
  const [refundReason, setRefundReason] = useState("")

  // Manual adjust
  const [manualGallons, setManualGallons] = useState("")
  const [manualAmount, setManualAmount] = useState("")

  // Sync local controls when a pump is opened.
  useEffect(() => {
    if (pump) {
      setMode(pump.mode)
      setGrade(pump.selectedGrade)
      setPrepayDigits(pump.prepayAmount ? String(pump.prepayAmount) : "")
      setGallonInput(pump.gallons ? String(pump.gallons) : "")
      setRestAmount("")
      setTargetPumpId("")
      setRefundReason("")
      setManualGallons("")
      setManualAmount("")
    }
  }, [pump?.id])

  if (!pump) return null
  const price = pump.grades[grade]?.pricePerGallon ?? 0
  const prepay = keypadToCents(prepayDigits)
  const currentGallons = pump.gallons
  const currentAmount = pump.amount
  const targetPump = state.pumps.find((p) => p.id === targetPumpId)
  const otherPumps = state.pumps.filter((p) => p.id !== pump.id)

  // Helpers
  const finalize = () => {
    let gallons: number
    let amount: number
    if (mode === "prepay" && prepay > 0) {
      amount = prepay
      gallons = price > 0 ? amount / price : 0
    } else {
      gallons = Number.parseFloat(gallonInput) || 0
      amount = Math.round(gallons * price)
    }
    if (gallons <= 0) {
      notify("Enter gallons or a prepay amount", "warn")
      return
    }
    actions.fuelStop(pump.id, gallons, amount)
    notify(`${pump.label} totaled ${money(amount)}`, "success")
  }

  const handleRestInGas = () => {
    const cents = keypadToCents(restAmount)
    if (cents <= 0) {
      notify("Enter a valid amount", "warn")
      return
    }
    actions.fuelAddRest(pump.id, cents)
    setRestAmount("")
    notify(`Added ${money(cents)} as rest in gas`, "success")
  }

  const handleTransfer = () => {
    if (!targetPump) {
      notify("Select a target pump", "warn")
      return
    }
    if (currentAmount <= 0) {
      notify("No balance to transfer", "warn")
      return
    }
    actions.fuelTransfer(pump.id, targetPumpId as string)
    notify(`Transferred ${money(currentAmount)} to ${targetPump.label}`, "success")
    setTargetPumpId("")
  }

  const handleRefund = () => {
    if (currentAmount <= 0) {
      notify("No amount to refund", "warn")
      return
    }
    if (!refundReason.trim()) {
      notify("Please enter a reason for refund", "warn")
      return
    }
    actions.fuelRefund(pump.id, currentAmount, refundReason)
    notify(`Refunded ${money(currentAmount)} - ${refundReason}`, "info")
    setRefundReason("")
  }

  const handleManualAdjust = () => {
    const gallons = Number.parseFloat(manualGallons)
    const amount = Number.parseFloat(manualAmount)
    if (!isNaN(gallons) && !isNaN(amount)) {
      actions.fuelAdjust(pump.id, gallons, Math.round(amount * 100))
      notify(`Manual adjust: ${gallons} gal, ${money(Math.round(amount * 100))}`, "info")
      setManualGallons("")
      setManualAmount("")
    } else {
      notify("Enter valid numbers", "warn")
    }
  }

  const statusStyle = STATUS_STYLE[pump.status]

  return (
    <Modal
      open={!!pump}
      onClose={onClose}
      title={`${pump.label} Control`}
      description="Full pump management: authorize, dispense, and handle exceptions."
      size="xl"
      className="max-w-6xl"
      footer={
        <div className="flex w-full justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {pump.status !== "locked" ? (
              <Button variant="destructive" onClick={() => actions.fuelLock(pump.id, true)}>
                <Lock /> Lock Pump
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => actions.fuelLock(pump.id, false)}>
                <Unlock /> Unlock
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab("control")}>
              <Fuel className="mr-1 size-4" /> Control
            </Button>
            <Button variant="outline" onClick={() => setActiveTab("adjustments")}>
              <Settings className="mr-1 size-4" /> Adjust
            </Button>
            <Button variant="outline" onClick={() => setActiveTab("history")}>
              <History className="mr-1 size-4" /> History
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tab content */}
        {activeTab === "control" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left column: Status, Mode, Grade, Prices */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={statusStyle.variant} className={cn("capitalize", statusStyle.className)}>
                  {pump.status}
                </Badge>
              </div>

              <Field>
                <FieldLabel>Mode</FieldLabel>
                <div className="flex gap-2">
                  <Button
                    variant={mode === "prepay" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setMode("prepay")}
                  >
                    Prepay
                  </Button>
                  <Button
                    variant={mode === "postpay" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setMode("postpay")}
                  >
                    Postpay
                  </Button>
                </div>
              </Field>

              <Field>
                <FieldLabel>Grade</FieldLabel>
                <Select value={String(grade)} onValueChange={(val) => setGrade(Number(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {pump.grades.map((g, i) => (
                      <SelectItem key={g.name} value={String(i)}>
                        {g.name} — {money(g.pricePerGallon)}/gal
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Grade Prices ($/gal)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pump.grades.map((g, i) => (
                    <Field key={g.name} className="flex items-center gap-1.5">
                      <span className="w-14 shrink-0 text-xs">{g.name}</span>
                      <Input
                        inputMode="decimal"
                        defaultValue={(g.pricePerGallon / 100).toFixed(2)}
                        onBlur={(e) => {
                          const c = Math.round((Number.parseFloat(e.target.value) || 0) * 100)
                          if (c > 0) actions.fuelSetPrice(pump.id, i, c)
                        }}
                        className="h-8"
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Current readings, controls, and special actions */}
            <div className="space-y-4">
              {mode === "prepay" ? (
                <Field>
                  <FieldLabel>Prepay Amount</FieldLabel>
                  <div className="rounded-lg border border-border bg-muted/40 p-2 text-center text-2xl font-bold tabular-nums">
                    {money(prepay)}
                  </div>
                  <NumPad value={prepayDigits} onChange={setPrepayDigits} className="mt-2" />
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Gallons Dispensed</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={gallonInput}
                    onChange={(e) => setGallonInput(e.target.value)}
                    placeholder="0.000"
                    className="text-center text-xl font-bold"
                  />
                  <FieldDescription>
                    Total: {money(Math.round((Number.parseFloat(gallonInput) || 0) * price))}
                  </FieldDescription>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    actions.fuelAuthorize(pump.id, mode, grade, mode === "prepay" ? prepay : undefined)
                    notify(`${pump.label} authorized`, "success")
                  }}
                  disabled={pump.status === "pumping" || pump.status === "locked"}
                >
                  Authorize
                </Button>
                <Button
                  onClick={() => actions.fuelStart(pump.id)}
                  disabled={pump.status !== "authorized" && pump.status !== "paused"}
                >
                  <Play /> Start
                </Button>
                {pump.status === "pumping" ? (
                  <Button variant="outline" onClick={() => actions.fuelPause(pump.id)}>
                    <Pause /> Pause
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => actions.fuelResume(pump.id)}
                    disabled={pump.status !== "paused"}
                  >
                    <Play /> Resume
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={finalize}
                  disabled={pump.status === "idle" || pump.status === "locked"}
                >
                  <Square /> Stop & Total
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gallons</span>
                  <span className="font-semibold tabular-nums">{pump.gallons.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="font-semibold tabular-nums">{money(pump.amount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    actions.fuelClaim(pump.id)
                    notify(`Fuel added to sale`, "success")
                    onClose()
                  }}
                  disabled={pump.amount <= 0 || pump.status === "pumping"}
                >
                  <ShoppingCart /> Claim to Sale
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    actions.fuelDriveOff(pump.id)
                    notify(`Drive-off recorded on ${pump.label}`, "warn")
                    onClose()
                  }}
                  disabled={pump.amount <= 0}
                >
                  <AlertTriangle /> Drive-Off
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "adjustments" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Rest in Gas */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <RefreshCw className="size-4" /> Rest in Gas
              </h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Apply grocery change to this pump as prepay.
              </p>
              <Field>
                <Input
                  inputMode="decimal"
                  value={restAmount}
                  onChange={(e) => setRestAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </Field>
              <Button onClick={handleRestInGas} disabled={!restAmount} className="mt-2 w-full">
                Apply
              </Button>
            </div>

            {/* Transfer Payment */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <ArrowRight className="size-4" /> Move Payment
              </h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Transfer current balance to another pump.
              </p>
              <Field>
                <Select value={targetPumpId || ""} onValueChange={(val) => setTargetPumpId(val || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pump" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherPumps.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} ({money(p.amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                onClick={handleTransfer}
                disabled={!targetPumpId || currentAmount <= 0}
                className="mt-2 w-full"
              >
                Transfer
              </Button>
            </div>

            {/* Refund Money */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <Undo2 className="size-4" /> Refund
              </h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Process a refund for the current amount.
              </p>
              <Field>
                <Input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason"
                  className="flex-1"
                />
              </Field>
              <Button
                variant="destructive"
                onClick={handleRefund}
                disabled={currentAmount <= 0}
                className="mt-2 w-full"
              >
                Refund
              </Button>
            </div>

            {/* Manual Adjust */}
            <div className="col-span-full rounded-lg border border-border p-4">
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <Settings className="size-4" /> Manual Adjust
              </h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Override gallons and amount directly (use with caution).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field className="flex-1">
                  <FieldLabel>Gallons</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={manualGallons}
                    onChange={(e) => setManualGallons(e.target.value)}
                    placeholder="0.000"
                  />
                </Field>
                <Field className="flex-1">
                  <FieldLabel>Amount ($)</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Button onClick={handleManualAdjust} variant="outline">
                  Set
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <History className="size-4" /> Transaction History
            </h4>
            {pump.transactions && pump.transactions.length > 0 ? (
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1">Time</th>
                      <th className="text-left py-1">Type</th>
                      <th className="text-right py-1">Gallons</th>
                      <th className="text-right py-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pump.transactions.map((tx, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-1">{new Date(tx.timestamp).toLocaleTimeString()}</td>
                        <td className="py-1">{tx.type}</td>
                        <td className="text-right py-1">{tx.gallons.toFixed(2)}</td>
                        <td className="text-right py-1">{money(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}