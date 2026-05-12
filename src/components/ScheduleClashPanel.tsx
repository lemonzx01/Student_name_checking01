'use client'

import { AlertTriangle, CheckCircle2, ArrowRight, Filter } from 'lucide-react'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']
const PERIOD_TIMES = [
  '08.30-09.30',
  '09.30-10.30',
  '10.30-11.10',
  '12.20-13.20',
  '13.20-14.20',
  '14.20-15.20',
]

export interface Clash {
  day: number
  period: number
  /** วิชาที่ซ้ำกัน (จาก same-subject detection) */
  subjectCode?: string
  classroomIds: number[]
  classroomNames: string[]
}

interface ClashPanelProps {
  clashes: Clash[]
  currentClassroomId: number | null
  onJumpTo: (classroomId: number, day: number, period: number) => void
  /** ถ้ามี แสดงว่ากำลังตรวจเฉพาะบางชั้น (scope filter active) */
  scopeLabel?: string
}

export default function ScheduleClashPanel({
  clashes,
  currentClassroomId,
  onJumpTo,
  scopeLabel,
}: ClashPanelProps) {
  const currentClashes = clashes.filter((c) =>
    currentClassroomId ? c.classroomIds.includes(currentClassroomId) : false
  )

  const otherClashes = clashes.filter(
    (c) => !currentClassroomId || !c.classroomIds.includes(currentClassroomId)
  )

  if (clashes.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">ไม่มีคาบซ้ำ</p>
            <p className="text-[11px] text-emerald-700">
              {scopeLabel ? `ใน ${scopeLabel} ไม่ชนกัน` : 'ตารางสอนทุกห้องไม่ชนกัน'}
            </p>
          </div>
        </div>
        {scopeLabel && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Filter size={10} />
            ขอบเขต: {scopeLabel}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-red-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <AlertTriangle size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-red-700">พบคาบซ้ำ {clashes.length} จุด</p>
          <p className="text-[11px] text-[var(--muted)]">
            วิชาเดียวกันถูกจัดเวลาเดียวกันในหลายห้อง — ครูประจำวิชาอาจสอนซ้ำ
          </p>
        </div>
      </div>
      {scopeLabel && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          <Filter size={10} />
          ขอบเขต: {scopeLabel}
        </div>
      )}

      {currentClashes.length > 0 && (
        <>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
            ในห้องนี้
          </p>
          <div className="mb-3 space-y-1.5">
            {currentClashes.map((c, i) => (
              <ClashItem
                key={`c-${i}`}
                clash={c}
                currentClassroomId={currentClassroomId}
                onJumpTo={onJumpTo}
              />
            ))}
          </div>
        </>
      )}

      {otherClashes.length > 0 && (
        <>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            ห้องอื่น
          </p>
          <div className="space-y-1.5">
            {otherClashes.map((c, i) => (
              <ClashItem
                key={`o-${i}`}
                clash={c}
                currentClassroomId={currentClassroomId}
                onJumpTo={onJumpTo}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ClashItem({
  clash,
  currentClassroomId,
  onJumpTo,
}: {
  clash: Clash
  currentClassroomId: number | null
  onJumpTo: (classroomId: number, day: number, period: number) => void
}) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-red-800">
        <span>
          {DAYS[clash.day - 1]} · คาบ {clash.period}
          {clash.subjectCode && (
            <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold">
              {clash.subjectCode}
            </span>
          )}
        </span>
        <span className="font-normal text-red-600">{PERIOD_TIMES[clash.period - 1]}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {clash.classroomIds.map((id, idx) => {
          const name = clash.classroomNames[idx]
          const isCurrent = id === currentClassroomId
          return (
            <button
              key={id}
              type="button"
              onClick={() => onJumpTo(id, clash.day, clash.period)}
              className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition ${
                isCurrent
                  ? 'border-red-300 bg-white text-red-700'
                  : 'border-red-200 bg-white text-slate-600 hover:bg-red-100'
              }`}
            >
              {name}
              {!isCurrent && <ArrowRight size={9} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
