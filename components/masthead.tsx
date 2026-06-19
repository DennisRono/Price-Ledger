'use client'

type MastheadProps = {
  storeName: string
  productCount: number
  date?: string
}

export function Masthead({ storeName, productCount, date }: MastheadProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="bg-ink text-paper border-b-4 border-red">
      <div className="ed-kicker flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] text-white/50">
        <span>EST. 2026</span>
        <span className="hidden sm:inline">{(date ?? today).toUpperCase()}</span>
        <span>PRICE LOOKUP EDITION</span>
      </div>

      <div className="px-4 py-5 text-center sm:py-7">
        <p className="ed-kicker text-[10px] text-gold sm:text-[11px]">
          The Daily Inventory
        </p>
        <h1 className="font-heading mt-1 text-3xl font-black leading-none tracking-tight text-balance sm:text-5xl">
          The Price Ledger
        </h1>
        <div className="ed-rule mx-auto mt-3 max-w-md" />
      </div>

      <div className="ed-kicker flex items-center justify-center gap-4 border-t border-white/10 px-4 py-2 text-[9px] text-white/40 sm:gap-8 sm:text-[10px]">
        <span>
          STORE: <span className="text-gold">{storeName}</span>
        </span>
        <span className="hidden sm:inline">|</span>
        <span>
          CATALOG: <span className="text-gold">{productCount} ITEMS</span>
        </span>
      </div>
    </header>
  )
}
