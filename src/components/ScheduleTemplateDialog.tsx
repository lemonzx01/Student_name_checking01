'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X, Check, AlertTriangle, Minus, Plus, Users } from 'lucide-react'
import {
  TEMPLATE_SUBJECT_NAMES,
  generateScheduleFromHours,
  TOTAL_AVAILABLE_SLOTS,
} from '@/lib/schedule-templates'
import type { Classroom } from '@/types/index'

const SUBJECT_COLORS: Record<string, string> = {
  TH: '#3B82F6', MA: '#EF4444', EN: '#8B5CF6', SC: '#10B981',
  SO: '#F59E0B', HI: '#D97706', HE: '#EC4899', AR: '#06B6D4', WO: '#84CC16',
}

const ALL_SUBJECTS = ['TH', 'MA', 'EN', 'SC', 'SO', 'HI', 'HE', 'AR', 'WO']

interface ScheduleTemplateDialogProps {
  open: boolean
  onClose: () => void
  // คืน slots + รายห้อง + flag สลับให้ไม่ชน
  onApply: (
    slots: Record<string, string>,
    targetClassroomIds: number[],
    targetHours: Record<string, number>,
    avoidClashes: boolean
  ) => void
  hasExisting: boolean
  classrooms?: Classroom[]
  currentClassroomId?: number | null
}

export default function ScheduleTemplateDialog({
  open,
  onClose,
  onApply,
  hasExisting,
  classrooms = [],
  currentClassroomId = null,
}: ScheduleTemplateDialogProps) {
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({
    TH: 4, MA: 4, EN: 3, SC: 3, SO: 2, HI: 1, HE: 2, AR: 2, WO: 2,
  })
  const [pickedClassroomIds, setPickedClassroomIds] = useState<Set<number>>(new Set())
  const [avoidClashes, setAvoidClashes] = useState(true)

  useEffect(() => {
    if (open) {
      setAvoidClashes(true)
      setPickedClassroomIds(currentClassroomId ? new Set([currentClassroomId]) : new Set())
    }
  }, [open, currentClassroomId])

  if (!open) return null

  const customTotal = Object.values(customCounts).reduce((a, b) => a + b, 0)
  const overLimit = customTotal > TOTAL_AVAILABLE_SLOTS

  const bumpCount = (code: string, delta: number) => {
    setCustomCounts((prev) => ({
      ...prev,
      [code]: Math.max(0, Math.min(10, (prev[code] || 0) + delta)),
    }))
  }

  const toggleClassroom = (id: number) => {
    setPickedClassroomIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllClassrooms = () => {
    setPickedClassroomIds(new Set(classrooms.map((c) => c.id)))
  }

  const clearAllClassrooms = () => {
    setPickedClassroomIds(new Set())
  }

  const targetIds = Array.from(pickedClassroomIds)

  const handleApply = () => {
    if (targetIds.length === 0 || overLimit || customTotal === 0) return
    const slots = generateScheduleFromHours(customCounts)
    onApply(slots, targetIds, customCounts, avoidClashes)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="animate-slide-up max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text)]">สร้างตารางสอน</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                ปรับจำนวนคาบของแต่ละวิชา แล้วระบบจะวางลงในช่องว่างให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {hasExisting && (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning-strong)]">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">มีตารางอยู่แล้ว</p>
                <p className="mt-0.5 text-xs">
                  การสร้างใหม่จะ<span className="font-bold">เขียนทับ</span>คาบเดิมของห้องที่ติ๊กไว้ทั้งหมด
                </p>
              </div>
            </div>
          )}

          {/* Tip */}
          <div className="mb-3 rounded-[var(--radius)] border border-[var(--info-soft)] bg-[var(--info-soft)] px-4 py-2.5 text-xs text-[var(--info)]">
            <span className="font-bold">เคล็ดลับ:</span> ระบบจะวางวิชาหลัก (TH, MA, EN, SC) ไว้ช่วงเช้า
            และกระจายข้ามวันจันทร์-ศุกร์ให้อัตโนมัติ
          </div>

          {/* Subject counters */}
          <div className="space-y-2">
            {ALL_SUBJECTS.map((code) => {
              const count = customCounts[code] || 0
              const color = SUBJECT_COLORS[code]
              return (
                <div
                  key={code}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                >
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text)]">
                      {code}
                      <span className="ml-2 text-[13px] font-normal text-[var(--muted)]">
                        {TEMPLATE_SUBJECT_NAMES[code]}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bumpCount(code, -1)}
                      disabled={count === 0}
                      className="btn-press flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-[var(--text)] tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={() => bumpCount(code, 1)}
                      disabled={customTotal >= TOTAL_AVAILABLE_SLOTS}
                      className="btn-press flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div
            className={`mt-3 flex items-center justify-between rounded-[var(--radius)] border px-4 py-2.5 text-sm ${
              overLimit
                ? 'border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]'
                : customTotal === TOTAL_AVAILABLE_SLOTS
                ? 'border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]'
                : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-soft)]'
            }`}
          >
            <span className="font-semibold">
              รวมคาบ/สัปดาห์
              {overLimit && ' — เกินจำนวนคาบที่มี!'}
            </span>
            <span className="font-bold tabular-nums">
              {customTotal}
              <span className="font-normal opacity-60">/{TOTAL_AVAILABLE_SLOTS}</span>
            </span>
          </div>

          {/* ── เลือกห้องที่จะใช้ ── */}
          {classrooms.length > 0 && (
            <div className="mt-5 rounded-[var(--radius)] border border-[var(--primary-soft)] bg-[var(--primary-ghost)] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-soft)]">
                  <Users size={13} className="text-[var(--primary)]" />
                  ใช้กับห้อง
                  <span className="text-[var(--muted)]">
                    ({pickedClassroomIds.size}/{classrooms.length})
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllClassrooms}
                    className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                  >
                    ทุกห้อง
                  </button>
                  <button
                    type="button"
                    onClick={clearAllClassrooms}
                    className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
                  >
                    ล้าง
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {classrooms.map((c) => {
                  const checked = pickedClassroomIds.has(c.id)
                  const isCurrent = c.id === currentClassroomId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClassroom(c.id)}
                      className={`btn-press inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        checked
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--line-strong)]'
                      }`}
                      title={isCurrent ? 'ห้องที่กำลังแก้อยู่' : c.level}
                    >
                      {checked && <Check size={11} strokeWidth={3} />}
                      {c.name}
                      {isCurrent && (
                        <span
                          className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${
                            checked ? 'bg-white/20' : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          }`}
                        >
                          ปัจจุบัน
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {pickedClassroomIds.size > 1 && hasExisting && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--warning-strong)]">
                  <AlertTriangle size={11} />
                  ตารางเดิมของทุกห้องที่ติ๊กไว้จะถูกเขียนทับ
                </p>
              )}

              {/* สลับคาบให้ไม่ชน — โชว์เมื่อหลายห้อง */}
              {pickedClassroomIds.size > 1 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={avoidClashes}
                    onChange={(e) => setAvoidClashes(e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--success)]"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-[var(--success-strong)]">
                      สลับคาบให้แต่ละห้องไม่ซ้ำกัน (ลดคาบซ้ำ)
                    </span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--success-strong)]">
                      จำนวนคาบของแต่ละวิชาเท่าเดิม แต่ระบบจะจัด
                      <span className="font-semibold">วันและเวลา</span>ของแต่ละห้องต่างกัน
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={targetIds.length === 0 || overLimit || customTotal === 0}
              className="btn btn-primary"
              title={targetIds.length === 0 ? 'เลือกห้องอย่างน้อย 1 ห้อง' : undefined}
            >
              <Sparkles size={16} />
              สร้างตาราง
              {targetIds.length > 1 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {targetIds.length} ห้อง
                </span>
              )}
            </button>
          </div>

          <div className="mt-4 border-t border-[var(--line-soft)] pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">รหัสวิชา</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
              {Object.entries(TEMPLATE_SUBJECT_NAMES).map(([code, name]) => (
                <span key={code}>
                  <span className="font-bold text-[var(--text-soft)]">{code}</span> = {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
