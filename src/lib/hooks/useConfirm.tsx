'use client'

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import AlertDialog, { AlertVariant } from '@/components/AlertDialog'

// ─── Confirm ─────────────────────────────────────────────────
export interface ConfirmOptions {
  title: string
  message: string | ReactNode
  details?: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default'
  requireTypeToConfirm?: string
  typeToConfirmPlaceholder?: string
}

interface InternalConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((ok: boolean) => void) | null
}

// ─── Alert ───────────────────────────────────────────────────
export interface AlertOptions {
  title?: string
  message: string | ReactNode
  variant?: AlertVariant
  buttonText?: string
}

interface InternalAlertState extends AlertOptions {
  open: boolean
  resolve: (() => void) | null
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions | string) => Promise<void>
}

const DialogContext = createContext<DialogContextValue | null>(null)

/**
 * Provider สำหรับ promise-based confirm/alert dialog ทั้งระบบ
 *
 * วาง <DialogProvider> ใน ClientLayout — แล้วใช้ใน component ใดก็ได้:
 *   const { confirm, alert } = useDialog()
 *   const ok = await confirm({ title: '...', message: '...' })
 *   if (ok) { ... }
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<InternalConfirmState>({
    open: false,
    title: '',
    message: '',
    resolve: null,
  })
  const [alertState, setAlertState] = useState<InternalAlertState>({
    open: false,
    message: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        ...options,
        open: true,
        resolve,
      })
    })
  }, [])

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts: AlertOptions = typeof options === 'string' ? { message: options } : options
    return new Promise((resolve) => {
      setAlertState({
        ...opts,
        open: true,
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    confirmState.resolve?.(true)
    setConfirmState((s) => ({ ...s, open: false, resolve: null }))
  }

  const handleCancel = () => {
    confirmState.resolve?.(false)
    setConfirmState((s) => ({ ...s, open: false, resolve: null }))
  }

  const handleAlertClose = () => {
    alertState.resolve?.()
    setAlertState((s) => ({ ...s, open: false, resolve: null }))
  }

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert])

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        details={confirmState.details}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        requireTypeToConfirm={confirmState.requireTypeToConfirm}
        typeToConfirmPlaceholder={confirmState.typeToConfirmPlaceholder}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <AlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        buttonText={alertState.buttonText}
        onClose={handleAlertClose}
      />
    </DialogContext.Provider>
  )
}

/** ใช้สำหรับเรียก confirm/alert แบบ promise-based */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    // fallback: ใช้ native dialogs (กัน component พังเมื่อ provider ไม่ได้ถูก mount)
    // ใน practice ควร mount provider ใน ClientLayout
    if (typeof window !== 'undefined') {
      console.warn('[useDialog] DialogProvider not mounted — falling back to window.confirm/alert')
    }
    return {
      confirm: async (options: ConfirmOptions) => {
        const text =
          typeof options.message === 'string'
            ? `${options.title}\n\n${options.message}`
            : options.title
        return typeof window !== 'undefined' ? window.confirm(text) : false
      },
      alert: async (options: AlertOptions | string) => {
        const text = typeof options === 'string' ? options : (typeof options.message === 'string' ? options.message : (options.title || ''))
        if (typeof window !== 'undefined') window.alert(text)
      },
    }
  }
  return ctx
}

/** Alias สำหรับใช้แบบ `const confirm = useConfirm()` (สั้นกว่า) */
export function useConfirm() {
  return useDialog().confirm
}

export function useAlert() {
  return useDialog().alert
}
