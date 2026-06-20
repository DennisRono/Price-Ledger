'use client'

import { useState } from 'react'
import {
  Tag,
  PauseCircle,
  PlayCircle,
  Ban,
  DoorOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  ScanSearch,
  FilePlus2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePOS } from '@/lib/pos/store'
import { money, keypadToCents } from '@/lib/pos/format'
import { useToast } from '@/components/notify'
import { itemCount } from '@/lib/pos/calc'
import { NumPad } from '@/components/pos/numpad'
import type { DrawerTxnType } from '@/lib/pos/types'
import { Modal } from '../modal'
import { Field, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'

type DrawerKind = { type: DrawerTxnType; title: string }

export function ActionBar() {
  const { state, actions } = usePOS()
  const sale = state.sale
  const { notify } = useToast()

  const [discountOpen, setDiscountOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [priceCheckOpen, setPriceCheckOpen] = useState(false)
  const [drawer, setDrawer] = useState<DrawerKind | null>(null)

  const [discMode, setDiscMode] = useState<'percent' | 'amount'>('percent')
  const [discValue, setDiscValue] = useState('')
  const [drawerDigits, setDrawerDigits] = useState('')
  const [drawerNote, setDrawerNote] = useState('')
  const [pcQuery, setPcQuery] = useState('')

  const hasItems = !!sale && itemCount(sale) > 0

  const buttons = [
    {
      label: 'Discount',
      icon: Tag,
      onClick: () => setDiscountOpen(true),
      disabled: !hasItems,
    },
    {
      label: 'Suspend',
      icon: PauseCircle,
      onClick: () => {
        actions.suspendSale()
        notify('Sale suspended', 'success')
      },
      disabled: !hasItems,
    },
    {
      label: `Recall${state.suspended.length ? ` (${state.suspended.length})` : ''}`,
      icon: PlayCircle,
      onClick: () => setRecallOpen(true),
      disabled: state.suspended.length === 0,
    },
    {
      label: 'Price Check',
      icon: ScanSearch,
      onClick: () => setPriceCheckOpen(true),
      disabled: false,
    },
    {
      label: 'No Sale',
      icon: DoorOpen,
      onClick: () => {
        if (!state.shift) {
          notify('Open a shift first', 'warn')
          return
        }
        actions.drawerTxn('no_sale', 0, 'Drawer opened')
        notify('Drawer opened (No Sale)', 'default')
      },
      disabled: false,
    },
    {
      label: 'Paid In',
      icon: ArrowDownToLine,
      onClick: () => setDrawer({ type: 'paid_in', title: 'Paid In' }),
      disabled: !state.shift,
    },
    {
      label: 'Paid Out',
      icon: ArrowUpFromLine,
      onClick: () => setDrawer({ type: 'paid_out', title: 'Paid Out' }),
      disabled: !state.shift,
    },
    {
      label: 'Safe Drop',
      icon: Lock,
      onClick: () => setDrawer({ type: 'safe_drop', title: 'Safe Drop' }),
      disabled: !state.shift,
    },
    {
      label: 'Verify Age',
      icon: ShieldCheck,
      onClick: () => {
        if (!sale) return
        let n = 0
        sale.items.forEach((i) => {
          if (!i.voided && i.ageRestriction > 0 && !i.ageVerified) {
            actions.verifyAge(i.lineId)
            n++
          }
        })
        notify(
          n ? `Verified ${n} item(s)` : 'No items need verification',
          n ? 'success' : 'default',
        )
      },
      disabled: !hasItems,
    },
    {
      label: 'New Sale',
      icon: FilePlus2,
      onClick: () => actions.newSale(),
      disabled: false,
    },
    {
      label: 'Void Sale',
      icon: Ban,
      onClick: () => {
        actions.voidSale()
        notify('Sale voided', 'warn')
      },
      disabled: !hasItems,
      danger: true,
    },
    {
      label: 'Next $',
      icon: Ban,
      onClick: () => {
        actions.nextDollar()
      },
      disabled: !hasItems,
      danger: false,
    },
  ]

  const pcResults = state.products.filter((p) => {
    const q = pcQuery.trim().toLowerCase()
    if (!q) return false
    return p.name.toLowerCase().includes(q) || p?.barcode?.includes(q)
  })

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-card p-2 sm:grid-cols-4 lg:grid-cols-6">
        {buttons.map((b) => {
          const Icon = b.icon
          return (
            <button
              key={b.label}
              onClick={b.onClick}
              disabled={b.disabled}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                b.danger
                  ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="size-4" />
              <span className="text-center leading-tight">{b.label}</span>
            </button>
          )
        })}
      </div>

      {/* Order discount modal */}
      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Order Discount"
        description="Apply a discount to the entire sale. Distributes proportionally for accurate tax."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                actions.orderDiscount(undefined)
                setDiscountOpen(false)
                notify('Order discount cleared', 'default')
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                const v = Number.parseFloat(discValue)
                if (!Number.isFinite(v) || v <= 0) {
                  notify('Enter a value', 'warn')
                  return
                }
                actions.orderDiscount({
                  type: discMode,
                  value: discMode === 'percent' ? v : Math.round(v * 100),
                })
                setDiscountOpen(false)
                setDiscValue('')
                notify('Order discount applied', 'success')
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={discMode === 'percent' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setDiscMode('percent')}
            >
              Percent %
            </Button>
            <Button
              variant={discMode === 'amount' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setDiscMode('amount')}
            >
              Amount $
            </Button>
          </div>
          <Field>
            <FieldLabel>
              {discMode === 'percent' ? 'Percent off' : 'Dollar amount off'}
            </FieldLabel>
            <Input
              autoFocus
              inputMode="decimal"
              value={discValue}
              onChange={(e) => setDiscValue(e.target.value)}
              placeholder={discMode === 'percent' ? '10' : '5.00'}
            />
          </Field>
        </div>
      </Modal>

      {/* Recall modal */}
      <Modal
        open={recallOpen}
        onClose={() => setRecallOpen(false)}
        title="Recall Suspended Sale"
        description="Resume a parked sale. Any active sale will be suspended automatically."
        size="md"
      >
        <div className="space-y-2">
          {state.suspended.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No suspended sales.
            </p>
          )}
          {state.suspended.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                actions.resumeSale(s.id)
                setRecallOpen(false)
                notify(`Recalled sale #${s.number}`, 'success')
              }}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
            >
              <div>
                <div className="text-sm font-medium">Sale #{s.number}</div>
                <div className="text-xs text-muted-foreground">
                  {itemCount(s)} items ·{' '}
                  {s.items.filter((i) => !i.voided).length} lines
                </div>
              </div>
              <span className="font-semibold tabular-nums">
                {money(s.total)}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Price check modal */}
      <Modal
        open={priceCheckOpen}
        onClose={() => {
          setPriceCheckOpen(false)
          setPcQuery('')
        }}
        title="Price Check"
        description="Look up a price without adding to the sale."
        size="md"
      >
        <div className="space-y-3">
          <Input
            autoFocus
            value={pcQuery}
            onChange={(e) => setPcQuery(e.target.value)}
            placeholder="Search name or scan barcode"
          />
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {pcResults.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                     {p.barcode} 
                  </div>
                </div>
                <div className="flex items-center gap-2">
               
                  <span className="font-semibold tabular-nums">
                    {money(p.pricing.unit_price_cents)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      actions.addProduct(p.id)
                      notify(`Added ${p.name}`, 'success')
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ))}
            {pcQuery && pcResults.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matches.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!drawer}
        onClose={() => {
          setDrawer(null)
          setDrawerDigits('')
          setDrawerNote('')
        }}
        title={drawer?.title}
        description="Record a cash movement in/out of the drawer."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDrawer(null)
                setDrawerDigits('')
                setDrawerNote('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!drawer) return
                const amt = keypadToCents(drawerDigits)
                if (amt <= 0) {
                  notify('Enter an amount', 'warn')
                  return
                }
                actions.drawerTxn(
                  drawer.type,
                  amt,
                  drawerNote.trim() || undefined,
                )
                notify(`${drawer.title}: ${money(amt)}`, 'success')
                setDrawer(null)
                setDrawerDigits('')
                setDrawerNote('')
              }}
            >
              Record
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center text-2xl font-bold tabular-nums">
            {money(keypadToCents(drawerDigits))}
          </div>
          <Field>
            <FieldLabel>Note (optional)</FieldLabel>
            <Input
              value={drawerNote}
              onChange={(e) => setDrawerNote(e.target.value)}
              placeholder="Reason / reference"
            />
          </Field>
          <NumPad value={drawerDigits} onChange={setDrawerDigits} />
        </div>
      </Modal>
    </>
  )
}
