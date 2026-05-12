'use client'

import { ReactNode, useEffect } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

export type AlertVariant = 'info' | 'success' | 'error' | 'warning'

export interface AlertDialogProps {
  open: boolean
  title?: string
  message: string | ReactNode
  buttonText?: string
  variant?: AlertVariant
  onClose: () => void
}

const VARIANT_STYLE: Record<
  AlertVariant,
  { icon: typeof Info; bg: string; text: string; btn: string }
> = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 text-blue-600',
    text: 'text-slate-900',
    btn: 'bg-[var(--primary)] hover:bg-[var(--primary-strong)]',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-50 text-emerald-600',
    text: 'text-slate-900',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 text-red-600',
    text: 'text-slate-900',
    btn: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50 text-amber-600',
    text: 'text-slate-900',
    btn: 'bg-amber-600 hover:bg-amber-700',
  },
}

/** Modal in-app สำหรับแสดงข้อความ — แทน `window.alert()` */
export default function AlertDialog({
  open,
  title,
  message,
  buttonText = 'ตกลง',
  variant = 'info',
  onClose,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const style = VARIANT_STYLE[variant]
  const Icon = style.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="btn-press absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="ปิด"
        >
          <X size={16} />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${style.bg}`}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            {title && <h3 className="text-lg font-bold text-slate-900">{title}</h3>}
            <div className={`${title ? 'mt-1' : ''} text-sm ${style.text}`}>
              {typeof message === 'string' ? <p>{message}</p> : message}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`btn-press inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition ${style.btn}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
