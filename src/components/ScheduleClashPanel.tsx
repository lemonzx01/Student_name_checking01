'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ArrowRight, ChevronDown, Filter, Sparkles, Wand2 } from 'lucide-react'

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

export interface SuggestionTarget {
  day: number
  period: number
}

interface ClashPanelProps {
  clashes: Clash[]
  currentClassroomId: number | null
  onJumpTo: (classroomId: number, day: number, period: number) => void
  /** ถ้ามี แสดงว่ากำลังตรวจเฉพาะบางชั้น (scope filter active) */
  scopeLabel?: string
  /** คืน list slot ว่างที่ห้องนี้ย้ายไปได้โดยไม่ชนซ้ำ */
  getSuggestions?: (clash: Clash) => SuggestionTarget[]
  /** ย้ายคาบของห้องปัจจุบันจาก (day,period) ของ clash → target */
  onMoveSlot?: (clash: Clash, target: SuggestionTarget) => void
  /** auto-fix ทุก clash ของห้องปัจจุบัน (greedy: ใช้ slot แนะนำตัวแรก) */
  onAutoFixCurrent?: () => void
  /** auto-fix ทุก clash ของทุกห้องใน scope */
  onAutoFixAll?: () => void
}

export default function ScheduleClashPanel({
  clashes,
  currentClassroomId,
  onJumpTo,
  scopeLabel,
  getSuggestions,
  onMoveSlot,
  onAutoFixCurrent,
  onAutoFixAll,
}: ClashPanelProps) {
  const currentClashes = clashes.filter((c) =>
    currentClassroomId ? c.classroomIds.includes(currentClassroomId) : false
  )

  const otherClashes = clashes.filter(
    (c) => !currentClassroomId || !c.classroomIds.includes(currentClassroomId)
  )

  // "ห้องอื่น" ยุบ default — เป็นข้อมูล informational ไม่ใช่ actionable item
  const [showOthers, setShowOthers] = useState(false)
  // max-height ของแต่ละ list ก่อนเริ่ม scroll ภายใน — กัน panel สูงทะลุจอ
  const LIST_MAX_HEIGHT = 360

  if (clashes.length === 0) {
    return (
      <div className="card p-4" style={{ background: 'var(--success-soft)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--success-strong)]">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--success-strong)]">ไม่มีคาบซ้ำ</p>
            <p className="text-[11px] text-[var(--success-strong)] opacity-90">
              {scopeLabel ? `ใน ${scopeLabel} ไม่ชนกัน` : 'ตารางสอนทุกห้องไม่ชนกัน'}
            </p>
          </div>
        </div>
        {scopeLabel && (
          <div className="pill pill-ok mt-2">
            <Filter size={10} />
            ขอบเขต: {scopeLabel}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger-strong)]">
          <AlertTriangle size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--danger-strong)]">พบคาบซ้ำ {clashes.length} จุด</p>
          <p className="text-[11px] text-[var(--muted)]">
            วิชาเดียวกันถูกจัดเวลาเดียวกันในหลายห้อง — ครูประจำวิชาอาจสอนซ้ำ
          </p>
        </div>
      </div>
      {scopeLabel && (
        <div className="pill pill-brand mb-3">
          <Filter size={10} />
          ขอบเขต: {scopeLabel}
        </div>
      )}

      {/* Auto-fix actions — 1 คลิกแก้คาบซ้ำให้หมด (greedy: ใช้ slot แนะนำตัวแรก) */}
      {(onAutoFixCurrent || onAutoFixAll) && (() => {
        const showCurrent = !!onAutoFixCurrent && currentClashes.length > 0
        const showAll = !!onAutoFixAll
        if (!showCurrent && !showAll) return null
        return (
          <div className="mb-3 rounded-lg border border-[var(--primary)] bg-[var(--primary-ghost)] p-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary-strong)]">
              <Wand2 size={13} className="flex-shrink-0" />
              แก้คาบซ้ำอัตโนมัติ
            </div>
            <div className="flex flex-col gap-1.5">
              {showCurrent && (
                <button
                  type="button"
                  onClick={onAutoFixCurrent}
                  className="inline-flex items-center justify-between gap-2 rounded-md border border-[var(--primary)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary-strong)] transition hover:bg-[var(--primary)] hover:text-white"
                  title="ลูป suggest+move ของห้องนี้ทุกจุดที่ชน — ใช้ slot ที่แนะนำตัวแรกของแต่ละ clash"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={11} className="flex-shrink-0" />
                    แก้ในห้องนี้
                  </span>
                  <span className="rounded-full bg-[var(--primary-ghost)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-strong)]">
                    {currentClashes.length}
                  </span>
                </button>
              )}
              {showAll && (
                <button
                  type="button"
                  onClick={onAutoFixAll}
                  className="inline-flex items-center justify-between gap-2 rounded-md border border-[var(--primary)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary-strong)] transition hover:bg-[var(--primary)] hover:text-white"
                  title="ลูป suggest+move ทุก clash ในขอบเขต — กดทีเดียวจบ"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wand2 size={11} className="flex-shrink-0" />
                    แก้ทุกห้อง
                  </span>
                  <span className="rounded-full bg-[var(--primary-ghost)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-strong)]">
                    {clashes.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {currentClashes.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--danger-strong)]">
            <span>ในห้องนี้</span>
            <span className="rounded-full bg-[var(--danger-soft)] px-1.5 py-0.5 text-[9px]">
              {currentClashes.length}
            </span>
          </div>
          <div
            className="space-y-1.5 overflow-y-auto pr-1"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
          >
            {currentClashes.map((c, i) => (
              <ClashItem
                key={`c-${i}`}
                clash={c}
                currentClassroomId={currentClassroomId}
                onJumpTo={onJumpTo}
                getSuggestions={getSuggestions}
                onMoveSlot={onMoveSlot}
              />
            ))}
          </div>
        </div>
      )}

      {otherClashes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            className="mb-1.5 flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-soft)]"
            aria-expanded={showOthers}
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${showOthers ? '' : '-rotate-90'}`}
            />
            <span>ห้องอื่น</span>
            <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] normal-case">
              {otherClashes.length}
            </span>
            {!showOthers && (
              <span className="ml-auto text-[9px] font-normal normal-case opacity-75">
                คลิกเพื่อแสดง
              </span>
            )}
          </button>
          {showOthers && (
            <div
              className="space-y-1.5 overflow-y-auto pr-1"
              style={{ maxHeight: LIST_MAX_HEIGHT }}
            >
              {otherClashes.map((c, i) => (
                <ClashItem
                  key={`o-${i}`}
                  clash={c}
                  currentClassroomId={currentClassroomId}
                  onJumpTo={onJumpTo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClashItem({
  clash,
  currentClassroomId,
  onJumpTo,
  getSuggestions,
  onMoveSlot,
}: {
  clash: Clash
  currentClassroomId: number | null
  onJumpTo: (classroomId: number, day: number, period: number) => void
  getSuggestions?: (clash: Clash) => SuggestionTarget[]
  onMoveSlot?: (clash: Clash, target: SuggestionTarget) => void
}) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const isInCurrent =
    currentClassroomId != null && clash.classroomIds.includes(currentClassroomId)
  const canSuggest = isInCurrent && !!getSuggestions && !!onMoveSlot

  // Lazy compute — เรียก getSuggestions ตอน expand เท่านั้น เพื่อไม่คำนวณทุก render
  const suggestions = showSuggestions && getSuggestions ? getSuggestions(clash) : []

  return (
    <div className="rounded-lg bg-[var(--danger-soft)] p-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--danger-strong)]">
        <span>
          {DAYS[clash.day - 1]} · คาบ {clash.period}
          {clash.subjectCode && (
            <span className="ml-1.5 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger-strong)]">
              {clash.subjectCode}
            </span>
          )}
        </span>
        <span className="font-normal text-[var(--danger-strong)] opacity-80">{PERIOD_TIMES[clash.period - 1]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
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
                  ? 'border-[var(--danger)] bg-[var(--surface)] text-[var(--danger-strong)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--danger-soft)]'
              }`}
            >
              {name}
              {!isCurrent && <ArrowRight size={9} />}
            </button>
          )
        })}

        {canSuggest && (
          <button
            type="button"
            onClick={() => setShowSuggestions((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--primary)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-strong)] transition hover:bg-[var(--primary-ghost)]"
            title="แสดงคาบว่างที่ย้ายไปได้โดยไม่ชน"
          >
            <Sparkles size={10} />
            {showSuggestions ? 'ซ่อน' : 'แนะนำที่ย้าย'}
          </button>
        )}
      </div>

      {canSuggest && showSuggestions && (
        <div className="mt-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2">
          <p className="mb-1.5 text-[10px] font-medium text-[var(--muted)]">
            คลิกเพื่อย้ายคาบไปยังช่องที่ว่างและไม่ชนกับห้องอื่น:
          </p>
          {suggestions.length === 0 ? (
            <p className="text-[11px] italic text-[var(--muted)]">
              ไม่พบคาบว่างที่ใส่ได้ — ลองลบวิชาออกจากห้องอื่น หรือเพิ่ม slot
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={`${s.day}-${s.period}`}
                  type="button"
                  onClick={() => {
                    onMoveSlot?.(clash, s)
                    setShowSuggestions(false)
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--success)] bg-[var(--success-soft)] px-1.5 py-1 text-[10px] font-semibold text-[var(--success-strong)] transition hover:bg-[var(--success)] hover:text-white"
                  title={`ย้ายไป ${DAYS[s.day - 1]} คาบ ${s.period}`}
                >
                  {DAYS[s.day - 1]} · คาบ {s.period}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
