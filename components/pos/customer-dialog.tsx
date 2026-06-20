"use client"

import { useState } from "react"
import { UserPlus, UserRound, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/modal"
import { usePOS } from "@/lib/pos/store"
import { money } from "@/lib/pos/format"
import { useToast } from "@/components/notify"

export function CustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = usePOS()
  const { notify } = useToast()
  const sale = state.sale
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [taxExempt, setTaxExempt] = useState(false)

  const matches = state.customers.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    )
  })

  const selected = sale?.customerId
    ? state.customers.find((c) => c.id === sale.customerId)
    : undefined

  const create = () => {
    if (!name.trim()) {
      notify("Enter a customer name", "warn")
      return
    }
    const c = actions.createCustomer({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      loyaltyPoints: 0,
      storeCredit: 0,
      chargeBalance: 0,
      taxExempt,
    })
    actions.setCustomer(c.id)
    notify(`${c.name} added to sale`, "success")
    setCreating(false)
    setName("")
    setPhone("")
    setEmail("")
    setTaxExempt(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customer"
      description="Attach a customer for loyalty, store credit, or tax exemption."
      size="md"
      footer={
        <>
          {selected && (
            <Button
              variant="ghost"
              onClick={() => {
                actions.setCustomer(undefined)
                notify("Customer removed", "default")
                onClose()
              }}
            >
              <X /> Remove from Sale
            </Button>
          )}
          <Button variant={creating ? "ghost" : "secondary"} onClick={() => setCreating((v) => !v)}>
            <UserPlus /> {creating ? "Cancel" : "New Customer"}
          </Button>
        </>
      }
    >
      {creating ? (
        <div className="space-y-3">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555-0100"
              />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@x.com"
              />
            </Field>
          </div>
          <Field orientation="horizontal" className="items-center gap-2">
            <Checkbox
              id="taxExempt"
              checked={taxExempt}
              onCheckedChange={(checked) => setTaxExempt(!!checked)}
            />
            <FieldLabel htmlFor="taxExempt" className="font-normal text-sm">
              Tax exempt account
            </FieldLabel>
          </Field>
          <Button className="w-full" onClick={create}>
            Create &amp; Attach
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, or email"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </Field>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {matches.map((c) => {
              const isSel = c.id === sale?.customerId
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    actions.setCustomer(c.id)
                    notify(`${c.name} attached`, "success")
                    onClose()
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                      <UserRound className="size-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.taxExempt && (
                      <Badge variant="outline" className="border-amber-500 text-amber-500">
                        Tax Exempt
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {c.loyaltyPoints} pts · {money(c.storeCredit)} credit
                    </span>
                  </div>
                </button>
              )
            })}
            {matches.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching customers. Create a new one.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}