import type { ReactNode } from "react"
import { POSProvider } from "@/lib/pos/store"
import { ToastProvider } from "@/components/notify"


export default function POSLayout({ children }: { children: ReactNode }) {
  return (
    <POSProvider>
      <ToastProvider>{children}</ToastProvider>
    </POSProvider>
  )
}
