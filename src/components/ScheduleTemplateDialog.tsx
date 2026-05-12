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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="animate-slide-up max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">สร้างตารางสอน</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                ปรับจำนวนคาบของแต่ละวิชา แล้วระบบจะวางลงในช่องว่างให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-compact flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {hasExisting && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-xs text-blue-800">
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
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              >
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">
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
                    className="btn-press flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-slate-900 tabular-nums">{count}</span>
                  <button
                    type="button"
                    onClick={() => bumpCount(code, 1)}
                    disabled={customTotal >= TOTAL_AVAILABLE_SLOTS}
                    className="btn-press flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40"
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
          className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
            overLimit
              ? 'border-red-200 bg-red-50 text-red-700'
              : customTotal === TOTAL_AVAILABLE_SLOTS
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-700'
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
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Users size={13} className="text-blue-600" />
                ใช้กับห้อง
                <span className="text-[var(--muted)]">
                  ({pickedClassroomIds.size}/{classrooms.length})
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={selectAllClassrooms}
                  className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-100"
                >
                  ทุกห้อง
                </button>
                <button
                  type="button"
                  onClick={clearAllClassrooms}
                  className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
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
                        ? 'border-blue-400 bg-blue-600 text-white shadow-sm'
                        : 'border-[var(--line)] bg-white text-slate-600 hover:border-blue-300'
                    }`}
                    title={isCurrent ? 'ห้องที่กำลังแก้อยู่' : c.level}
                  >
                    {checked && <Check size={11} strokeWidth={3} />}
                    {c.name}
                    {isCurrent && (
                      <span
                        className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${
                          checked ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
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
              <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-700">
                <AlertTriangle size={11} />
                ตารางเดิมของทุกห้องที่ติ๊กไว้จะถูกเขียนทับ
              </p>
            )}

            {/* สลับคาบให้ไม่ชน — โชว์เมื่อหลายห้อง */}
            {pickedClassroomIds.size > 1 && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={avoidClashes}
                  onChange={(e) => setAvoidClashes(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-bold text-emerald-800">
                    🎲 สลับคาบให้แต่ละห้องไม่ซ้ำกัน (ลดคาบซ้ำ)
                  </span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-700">
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
            className="btn-press rounded-xl border border-[var(--line)] bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={targetIds.length === 0 || overLimit || customTotal === 0}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">รหัสวิชา</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
            {Object.entries(TEMPLATE_SUBJECT_NAMES).map(([code, name]) => (
              <span key={code}>
                <span className="font-bold text-slate-700">{code}</span> = {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
