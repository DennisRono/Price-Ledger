'use client'

import { useEffect, useRef, useState } from 'react'
import { keypadToCents, money } from '@/lib/pos/format'
import { NumPad } from '@/components/pos/numpad'

export function RegisterPad({
  onUnknownBarcode,
}: {
  onUnknownBarcode: (code: string) => void
}) {
  const [priceDigits, setPriceDigits] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="rounded-xl border border-border bg-muted/40 p-2 text-center">
        <div className="text-3xl font-bold tabular-nums">
          {money(keypadToCents(priceDigits))}
        </div>
      </div>

      <NumPad value={priceDigits} onChange={setPriceDigits} />
    </div>
  )
}
