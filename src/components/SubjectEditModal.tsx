'use client'

import { useEffect, useState } from 'react'
import { Pencil, RotateCcw, X, Save, Plus, Trash2, Loader2 } from 'lucide-react'
import type { SubjectWithMeta } from '@/lib/hooks/useSubjects'
import type { SubjectDef } from '@/types/index'

interface SubjectEditModalProps {
  open: boolean
  subjects: SubjectWithMeta[]
  onClose: () => void
  onUpdate: (code: string, patch: Partial<Pick<SubjectDef, 'name' | 'color'>>) => void
  onRenameCode: (oldCode: string, newCode: string) => Promise<{ ok: boolean; error?: string }>
  onAdd: (subject: SubjectDef) => boolean
  onRemove: (code: string) => boolean
  onReset: () => void
}

const COLOR_PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#DC2626', '#D97706', '#64748B',
]

/**
 * แก้ไขรายวิชา + เพิ่มวิชาใหม่
 * - แก้ทุกอย่างได้รวมถึงรหัส (เช่น TH → ท11101)
 * - ตอนแก้รหัส: ระบบจะ migrate รหัสในฐานข้อมูลให้ (grades + schedules) → คะแนนเก่าไม่หาย
 */
export default function SubjectEditModal({
  open,
  subjects,
  onClose,
  onUpdate,
  onRenameCode,
  onAdd,
  onRemove,
  onReset,
}: SubjectEditModalProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirmReset(false)
      setShowAddForm(false)
      setAddError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-slide-up max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <Pencil size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">จัดการรายวิชา</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                แก้รหัส (เช่น <span className="font-mono">TH</span> → <span className="font-mono">ท11101</span>) ได้ — ระบบจะอัปเดตคะแนนและตารางสอนให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            title="ปิด (Esc)"
            aria-label="ปิด"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {/* Subject list */}
          <div className="space-y-3">
            {subjects.map((subject) => (
              <SubjectRow
                key={subject.code}
                subject={subject}
                onUpdateName={(name) => onUpdate(subject.code, { name })}
                onUpdateColor={(color) => onUpdate(subject.code, { color })}
                onRenameCode={(newCode) => onRenameCode(subject.code, newCode)}
                onRemove={() => onRemove(subject.code)}
              />
            ))}
          </div>

          {/* Add new subject */}
          <div className="mt-4">
            {showAddForm ? (
              <AddSubjectForm
                onCancel={() => {
                  setShowAddForm(false)
                  setAddError(null)
                }}
                onAdd={(subj) => {
                  const ok = onAdd(subj)
                  if (!ok) {
                    setAddError(`รหัส "${subj.code}" มีอยู่แล้ว — กรุณาใช้รหัสอื่น`)
                    return
                  }
                  setShowAddForm(false)
                  setAddError(null)
                }}
                error={addError}
                existingCodes={new Set(subjects.map((s) => s.code))}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-ghost)] hover:text-[var(--primary-strong)]"
              >
                <Plus size={16} />
                เพิ่มวิชาใหม่
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-4">
            {confirmReset ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs text-[var(--text-soft)]">
                  รีเซ็ตทั้งหมด? <span className="text-[var(--warning-strong)]">(คะแนนใน DB ที่ใช้รหัสปัจจุบันอยู่จะยังคงอยู่ภายใต้รหัสเดิม)</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onReset()
                      setConfirmReset(false)
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    ยืนยันรีเซ็ต
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={13} />
                รีเซ็ตเป็นค่าเริ่มต้น
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary"
            >
              <Save size={15} />
              เสร็จแล้ว
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubjectRow({
  subject,
  onUpdateName,
  onUpdateColor,
  onRenameCode,
  onRemove,
}: {
  subject: SubjectWithMeta
  onUpdateName: (name: string) => void
  onUpdateColor: (color: string) => void
  onRenameCode: (newCode: string) => Promise<{ ok: boolean; error?: string }>
  onRemove: () => void
}) {
  const [name, setName] = useState(subject.name)
  const [code, setCode] = useState(subject.code)
  const [showPalette, setShowPalette] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    setName(subject.name)
  }, [subject.name])

  useEffect(() => {
    setCode(subject.code)
  }, [subject.code])

  function commitName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== subject.name) {
      onUpdateName(trimmed)
    } else if (!trimmed) {
      setName(subject.name)
    }
  }

  async function commitCode() {
    const trimmed = code.trim()
    if (!trimmed) {
      setCode(subject.code)
      setCodeError(null)
      return
    }
    if (trimmed === subject.code) {
      setCodeError(null)
      return
    }
    setRenaming(true)
    setCodeError(null)
    const result = await onRenameCode(trimmed)
    setRenaming(false)
    if (!result.ok) {
      setCodeError(result.error || 'แก้ไขไม่สำเร็จ')
      setCode(subject.code) // revert UI
    }
  }

  return (
    <div className={`rounded-[var(--radius)] border p-3 transition ${
      subject.isDefault
        ? 'border-[var(--line)] bg-[var(--surface-soft)]'
        : 'border-[var(--primary-soft)] bg-[var(--primary-ghost)]'
    }`}>
      <div className="flex items-start gap-3">
        {/* Code input — แก้ได้ทุกวิชา */}
        <div className="relative flex-shrink-0">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={commitCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setCode(subject.code)
                setCodeError(null)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={renaming}
            maxLength={10}
            placeholder="รหัส"
            className="h-10 w-20 rounded-lg border-2 px-1.5 text-center text-sm font-bold text-white shadow-sm outline-none transition focus:ring-2 focus:ring-white/40 disabled:opacity-60"
            style={{
              backgroundColor: subject.color,
              borderColor: subject.color,
            }}
            title="กดเพื่อแก้รหัสวิชา — ระบบจะอัปเดตคะแนนและตารางสอนให้"
          />
          {renaming && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
              <Loader2 size={14} className="animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Name input */}
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="ชื่อวิชา"
            className="input h-10 py-0"
          />
          {codeError && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--danger)]">
              <Trash2 size={10} />
              {codeError}
            </p>
          )}
        </div>

        {/* Color picker */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowPalette((v) => !v)}
            className="btn-press flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white shadow-sm ring-1 ring-[var(--line)] transition hover:scale-105"
            style={{ backgroundColor: subject.color }}
            title="เลือกสี"
          />
          {showPalette && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPalette(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 grid grid-cols-5 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-lg)]">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onUpdateColor(color)
                      setShowPalette(false)
                    }}
                    className="h-7 w-7 rounded-md transition hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Delete */}
        <div className="flex-shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onRemove}
                className="btn btn-danger btn-sm"
                title="ยืนยันลบ"
              >
                ยืนยัน
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn btn-secondary btn-sm"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn btn-ghost btn-icon"
              title="ลบวิชานี้ (คะแนนเก่าไม่ถูกลบ จะแสดงเป็น orphan)"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddSubjectForm({
  onCancel,
  onAdd,
  error,
  existingCodes,
}: {
  onCancel: () => void
  onAdd: (subject: SubjectDef) => void
  error: string | null
  existingCodes: Set<string>
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366F1')

  const trimmedCode = code.trim()
  const trimmedName = name.trim()
  const isDuplicate = existingCodes.has(trimmedCode)
  const canSubmit = trimmedCode.length > 0 && trimmedName.length > 0 && !isDuplicate

  return (
    <div className="rounded-[var(--radius)] border-2 border-[var(--primary-soft)] bg-[var(--primary-ghost)] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--primary-strong)]">
        <Plus size={14} />
        เพิ่มวิชาใหม่
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={10}
          placeholder="รหัส (เช่น CN, ท11101)"
          className="input h-10 w-32 text-center font-bold"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อวิชา (เช่น ภาษาจีน)"
          className="input h-10 min-w-[180px] flex-1"
        />
        <div className="flex items-center gap-1.5">
          {COLOR_PALETTE.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-md transition ${
                c === color ? 'ring-2 ring-offset-2 ring-[var(--primary)] scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {(isDuplicate || error) && (
        <p className="mt-2 text-[11px] text-[var(--danger)]">
          {isDuplicate ? `รหัส "${trimmedCode}" มีอยู่แล้ว` : error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary btn-sm"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => canSubmit && onAdd({ code: trimmedCode, name: trimmedName, color })}
          disabled={!canSubmit}
          className="btn btn-primary btn-sm"
        >
          <Plus size={12} />
          เพิ่ม
        </button>
      </div>
    </div>
  )
}
