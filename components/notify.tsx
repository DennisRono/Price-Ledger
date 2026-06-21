"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------- Types ----------
type ToastTone = "success" | "warn" | "error" | "info" | "default"

export interface Toast {
  id: string
  message: string
  tone: ToastTone
  duration?: number // milliseconds, defaults to 4000
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, tone?: ToastTone, duration?: number) => void
  removeToast: (id: string) => void
}

// ---------- Context ----------
const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, tone: ToastTone = "info", duration = 4000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, tone, duration }])
    // Auto‑remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

// ---------- Hook ----------
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  // Expose a convenient 'notify' function
  const notify = (message: string, tone: ToastTone = "info") => {
    context.addToast(message, tone)
  }
  return { ...context, notify }
}

// ---------- Toast Container ----------
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

// ---------- Individual Toast ----------
const TONE_ICON: Record<ToastTone, React.ElementType> = {
  success: CheckCircle,
  warn: AlertTriangle,
  error: AlertCircle,
  info: Info,
  default: Info
}

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  warn: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  error: "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  info: "border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  default: "border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = TONE_ICON[toast.tone]

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2 rounded-lg border-l-4 p-3 shadow-md transition-all",
        TONE_CLASSES[toast.tone]
      )}
      role="alert"
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={onClose}
        className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close notification"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}