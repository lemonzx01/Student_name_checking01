'use client'

import { ReactNode, useEffect } from 'react'
import { CheckCircle, AlertTriangle, X, Undo2, Info } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastProps {
  open: boolean
  message: string | ReactNode
  variant?: ToastVariant
  /** ปุ่ม action (เช่น "กู้คืน") ติดข้างขวา */
  action?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
  /** ระยะเวลาก่อนปิดอัตโนมัติ (ms) — default 4000, 0 = ไม่ปิดเอง */
  durationMs?: number
  onClose: () => void
}

const VARIANT_STYLE: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-800',
}

export default function Toast({
  open,
  message,
  variant = 'info',
  action,
  durationMs = 4000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open || durationMs <= 0) return
    const t = setTimeout(onClose, durationMs)
    return () => clearTimeout(t)
  }, [open, durationMs, onClose])

  if (!open) return null

  const Icon = variant === 'success' ? CheckCircle : variant === 'error' ? AlertTriangle : Info

  return (
    <div className="fixed bottom-6 right-6 z-[95] pointer-events-none">
      <div
        className={`toast-enter pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${VARIANT_STYLE[variant]}`}
        role="status"
      >
        <Icon size={18} className="flex-shrink-0" />
        <span className="flex-1">{message}</span>
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick()
              onClose()
            }}
            className="btn-press inline-flex items-center gap-1 rounded-lg border border-current/20 bg-white/60 px-2.5 py-1 text-xs font-semibold transition hover:bg-white"
          >
            {action.icon ?? <Undo2 size={12} />}
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-0.5 text-current/60 transition hover:bg-white/40 hover:text-current"
          aria-label="ปิด"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
