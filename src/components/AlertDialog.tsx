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
  { icon: typeof Info; iconBg: string; btnClass: string }
> = {
  info: {
    icon: Info,
    iconBg: 'bg-[var(--primary-ghost)] text-[var(--primary)]',
    btnClass: 'btn-primary',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-[var(--success-soft)] text-[var(--success)]',
    btnClass: 'btn-primary',
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    btnClass: 'btn-danger',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    btnClass: 'btn-primary',
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

  // For success variant, override button color
  const successOverride =
    variant === 'success'
      ? { background: 'var(--success)', color: '#fff' }
      : variant === 'warning'
        ? { background: 'var(--warning)', color: '#fff' }
        : undefined

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-icon absolute right-3 top-3"
          aria-label="ปิด"
        >
          <X size={16} />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            {title && <h3 className="text-lg font-bold text-[var(--text)]">{title}</h3>}
            <div className={`${title ? 'mt-1' : ''} text-sm text-[var(--text-soft)]`}>
              {typeof message === 'string' ? <p>{message}</p> : message}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`btn ${style.btnClass}`}
            style={successOverride}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
