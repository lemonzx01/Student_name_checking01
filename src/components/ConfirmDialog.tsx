'use client'

import { ReactNode, useEffect, useState } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string | ReactNode
  /** รายละเอียดเสริม (เช่น list ผลกระทบ) */
  details?: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default'
  /** ถ้าระบุ user ต้องพิมพ์ข้อความนี้ก่อนกดยืนยันได้ */
  requireTypeToConfirm?: string
  /** placeholder ของช่อง type-to-confirm */
  typeToConfirmPlaceholder?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal in-app สำหรับยืนยัน destructive action — แทน `window.confirm()`
 *
 * รองรับ:
 * - variant 'danger' (ปุ่มสีแดง) / 'default' (สีฟ้าหลัก)
 * - details: list/ผลกระทบที่จะเกิด
 * - requireTypeToConfirm: บังคับผู้ใช้พิมพ์ข้อความก่อนกดยืนยันได้
 *   (สำหรับ destructive action ใหญ่ เช่น ลบห้องเรียน, ลบทั้งหมด, กู้คืน)
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'default',
  requireTypeToConfirm,
  typeToConfirmPlaceholder,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('')

  // reset typed value ทุกครั้งที่เปิดใหม่
  useEffect(() => {
    if (open) setTypedValue('')
  }, [open])

  // ปิดด้วย Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'
  const typeOk = !requireTypeToConfirm || typedValue.trim() === requireTypeToConfirm.trim()
  const canConfirm = typeOk

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
        {/* Icon + Title */}
        <div className="mb-3 flex items-start gap-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
              isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {isDanger ? <AlertTriangle size={22} /> : <Info size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <div className="mt-1 text-sm text-slate-600">
              {typeof message === 'string' ? <p>{message}</p> : message}
            </div>
          </div>
        </div>

        {/* Details */}
        {details && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {details}
          </div>
        )}

        {/* Type-to-confirm */}
        {requireTypeToConfirm && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              พิมพ์{' '}
              <span className="font-mono font-bold text-red-600">
                &quot;{requireTypeToConfirm}&quot;
              </span>{' '}
              เพื่อยืนยัน
            </label>
            <input
              type="text"
              autoFocus
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={typeToConfirmPlaceholder || requireTypeToConfirm}
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) onConfirm()
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`btn-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--primary)] hover:bg-[var(--primary-strong)]'
            }`}
          >
            <Check size={16} />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
