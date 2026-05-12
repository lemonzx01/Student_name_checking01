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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-slide-up max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Pencil size={18} className="text-violet-600" />
              จัดการรายวิชา
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              แก้รหัส (เช่น <span className="font-mono">TH</span> → <span className="font-mono">ท11101</span>) ได้ — ระบบจะอัปเดตคะแนนและตารางสอนให้อัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-slate-500 transition hover:bg-slate-50"
            title="ปิด (Esc)"
          >
            <X size={16} />
          </button>
        </div>

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
              className="btn-press flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line)] bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700"
            >
              <Plus size={16} />
              เพิ่มวิชาใหม่
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {confirmReset ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs text-slate-700">
                รีเซ็ตทั้งหมด? <span className="text-amber-700">(คะแนนใน DB ที่ใช้รหัสปัจจุบันอยู่จะยังคงอยู่ภายใต้รหัสเดิม)</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onReset()
                    setConfirmReset(false)
                  }}
                  className="btn-press rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  ยืนยันรีเซ็ต
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
            >
              <RotateCcw size={13} />
              รีเซ็ตเป็นค่าเริ่มต้น
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-strong)]"
          >
            <Save size={15} />
            เสร็จแล้ว
          </button>
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
    <div className={`rounded-xl border p-3 transition ${
      subject.isDefault
        ? 'border-[var(--line)] bg-slate-50/60'
        : 'border-violet-200 bg-violet-50/40'
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
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100"
          />
          {codeError && <p className="mt-1 text-[11px] text-red-600">{codeError}</p>}
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
              <div className="absolute right-0 top-full z-20 mt-2 grid grid-cols-5 gap-1.5 rounded-xl border border-[var(--line)] bg-white p-2 shadow-xl">
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
                className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                title="ยืนยันลบ"
              >
                ยืนยัน
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-press flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-slate-400 transition hover:border-red-300 hover:text-red-600"
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
    <div className="rounded-xl border-2 border-violet-200 bg-violet-50/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
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
          className="h-10 w-32 rounded-lg border border-[var(--line)] bg-white px-2 text-center text-sm font-bold outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อวิชา (เช่น ภาษาจีน)"
          className="h-10 min-w-[180px] flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        />
        <div className="flex items-center gap-1.5">
          {COLOR_PALETTE.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-md transition ${
                c === color ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {(isDuplicate || error) && (
        <p className="mt-2 text-[11px] text-red-600">
          {isDuplicate ? `รหัส "${trimmedCode}" มีอยู่แล้ว` : error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => canSubmit && onAdd({ code: trimmedCode, name: trimmedName, color })}
          disabled={!canSubmit}
          className="btn-press inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={12} />
          เพิ่ม
        </button>
      </div>
    </div>
  )
}
