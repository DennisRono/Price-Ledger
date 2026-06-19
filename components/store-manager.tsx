'use client'

import { useState } from 'react'
import type { StoreMeta } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createStoreReq } from '@/lib/api-client'
import { toast } from 'sonner'
import { Check, Plus, Store } from 'lucide-react'

type StoreManagerProps = {
  open: boolean
  stores: StoreMeta[]
  activeStoreId: string
  onClose: () => void
  onSelect: (id: string) => void
  onCreated: (store: StoreMeta) => void
}

export function StoreManager({
  open,
  stores,
  activeStoreId,
  onClose,
  onSelect,
  onCreated,
}: StoreManagerProps) {
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('none')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Enter a store name')
      return
    }
    setCreating(true)
    try {
      const store = await createStoreReq(
        name.trim(),
        copyFrom === 'none' ? undefined : copyFrom,
      )
      toast.success(`Store "${store.name}" created`)
      onCreated(store)
      setName('')
      setCopyFrom('none')
    } catch {
      toast.error('Could not create store')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none border-2 border-ink bg-paper p-0 sm:max-w-md">
        <DialogHeader className="border-b-2 border-ink bg-ink px-4 py-3 text-left">
          <DialogTitle className="font-heading text-paper">Stores</DialogTitle>
          <DialogDescription className="ed-kicker text-[10px] text-gold">
            Switch, create, or duplicate a store
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="ed-kicker text-[10px] text-muted-foreground">
              Your stores
            </Label>
            <ul className="flex flex-col gap-1">
              {stores.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s.id)
                      onClose()
                    }}
                    className={`flex w-full items-center justify-between border px-3 py-2 text-left ${
                      s.id === activeStoreId
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/20 bg-card hover:border-ink'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      <span className="text-sm font-semibold">{s.name}</span>
                    </span>
                    <span className="ed-kicker flex items-center gap-2 text-[9px] opacity-70">
                      {s.productCount} items
                      {s.id === activeStoreId ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="ed-double-rule flex flex-col gap-3 pt-3">
            <Label className="ed-kicker text-[10px] text-muted-foreground">
              Create a new store
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Store name"
              className="rounded-none border-ink bg-card"
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Start from (optional)
              </Label>
              <Select value={copyFrom} onValueChange={(v) => setCopyFrom(v ?? 'none')}>
                <SelectTrigger className="rounded-none border-ink bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Empty store</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Copy from: {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="rounded-none bg-red text-paper hover:bg-red/90"
              onClick={handleCreate}
              disabled={creating}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {creating ? 'Creating…' : 'Create store'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
