"use client"

import { useState } from "react"
import { POSHeader } from "@/components/pos/pos-header"
import { FuelBar } from "@/components/pos/fuel-bar"
import { RegisterPad } from "@/components/pos/register-pad"
import { ProductGrid } from "@/components/pos/product-grid"
import { CartPanel } from "@/components/pos/cart-panel"
import { ActionBar } from "@/components/pos/action-bar"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { CustomerDialog } from "@/components/pos/customer-dialog"
import { ReceiptModal } from "@/components/pos/receipt"
import { AddProductDialog } from "@/components/pos/add-product-dialog"
import { usePOS } from "@/lib/pos/store"
import type { Sale } from "@/lib/pos/types"

export default function POSPage() {
  const { ready } = usePOS()
  
  const [payOpen, setPayOpen] = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null)
  const [lastReceipt, setLastReceipt] = useState<Sale | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <POSHeader />
      <FuelBar />

      <main className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[20rem_1fr_24rem]">
        {/* Left: scan + custom keypad */}
        <div className="order-2 min-h-0 overflow-y-auto lg:order-1">
          <RegisterPad onUnknownBarcode={(code) => setUnknownBarcode(code)} />
        </div>

        {/* Center: products + actions */}
        <div className="order-1 flex min-h-0 flex-col gap-3 lg:order-2">
          <div className="min-h-0 flex-1">
            <ProductGrid onSearch={() => setSearchOpen(true)}  />
          </div>
          <ActionBar />
        </div>

        {/* Right: cart */}
        <div className="order-3 min-h-0">
          <CartPanel onPay={() => setPayOpen(true)} onSelectCustomer={() => setCustOpen(true)} />
        </div>
      </main>

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onCompleted={(sale) => {
          setPayOpen(false)
          setLastReceipt(sale)
          setReceiptOpen(true)
        }}
      />
      <CustomerDialog open={custOpen} onClose={() => setCustOpen(false)} />
      <AddProductDialog
        open={searchOpen}
        initialBarcode=""
        onClose={() => setSearchOpen(false)}
      />
      <AddProductDialog
        open={unknownBarcode !== null}
        initialBarcode={unknownBarcode ?? ""}
        onClose={() => setUnknownBarcode(null)}
      />
      <ReceiptModal
        sale={lastReceipt}
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
      />

      {!ready && (
        <div className="pointer-events-none fixed bottom-3 left-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          Loading saved session…
        </div>
      )}
    </div>
  )
}
