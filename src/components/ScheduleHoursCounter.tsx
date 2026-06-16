'use client'

import { useMemo } from 'react'
import { BarChart3, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSubjects } from '@/lib/hooks/useSubjects'
import { getClassroomGrade } from '@/lib/grade'

// ค่ามาตรฐานสพฐ. (คาบ/สัปดาห์) สำหรับอ้างอิง
const TARGET_P13: Record<string, number> = {
  TH: 5, MA: 5, EN: 2, SC: 2, SO: 2, HI: 1, HE: 2, AR: 2, WO: 1,
}
const TARGET_P46: Record<string, number> = {
  TH: 4, MA: 4, EN: 3, SC: 3, SO: 2, HI: 1, HE: 2, AR: 2, WO: 2,
}

interface ScheduleHoursCounterProps {
  schedule: Record<string, { subject_code: string }>
  level?: string // level จากข้อมูลห้อง เช่น "ประถมศึกษา"
  name?: string // ชื่อห้อง เช่น "ป.3/1" — ใช้อ่านชั้นเป็นหลัก (เจาะจงกว่า level)
}

export default function ScheduleHoursCounter({ schedule, level, name }: ScheduleHoursCounterProps) {
  // ดึงรายการวิชาจริงที่ครูตั้งไว้ — ให้ sync กับ Settings/useSubjects
  const { subjects: SUBJECTS } = useSubjects()

  // อ่านชั้นจากชื่อห้องก่อน แล้ว fallback ไป level — ข้อมูลจริง level มักไม่มีเลขชั้น
  const grade = useMemo(() => getClassroomGrade({ name, level }), [name, level])

  // เลือก target ตามระดับชั้น — ป.1-3 ใช้เกณฑ์เด็กเล็ก, ที่เหลือใช้เกณฑ์ ป.4-6
  const target = useMemo(() => {
    if (grade?.stage === 'ป' && grade.num <= 3) return TARGET_P13
    return TARGET_P46
  }, [grade])

  const levelLabel = useMemo(() => {
    if (grade?.stage === 'ป') return grade.num <= 3 ? 'ป.1 – ป.3' : 'ป.4 – ป.6'
    if (grade?.stage === 'ม') return 'ป.4 – ป.6 (อ้างอิง)'
    return 'ป.4 – ป.6'
  }, [grade])

  // นับคาบของแต่ละวิชา
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const slot of Object.values(schedule)) {
      if (slot?.subject_code) {
        c[slot.subject_code] = (c[slot.subject_code] || 0) + 1
      }
    }
    return c
  }, [schedule])

  const totalCurrent = Object.values(counts).reduce((a, b) => a + b, 0)
  const totalTarget = Object.values(target).reduce((a, b) => a + b, 0)

  // นับจำนวนวิชาที่ครบตามเป้า
  const onTargetCount = SUBJECTS.filter((s) => {
    const cur = counts[s.code] || 0
    const tgt = target[s.code] || 0
    return cur >= tgt && tgt > 0
  }).length

  const totalSubjects = SUBJECTS.filter((s) => (target[s.code] || 0) > 0).length

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-ghost)] text-[var(--primary-strong)]">
            <BarChart3 size={16} />
          </div>
          <div>
            <p className="section-title text-sm">จำนวนคาบ/สัปดาห์</p>
            <p className="text-[11px] text-[var(--muted)]">เทียบกับมาตรฐาน {levelLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[var(--text)]">
            {totalCurrent}
            <span className="text-[var(--muted)]">/{totalTarget}</span>
          </p>
          <p className="text-[10px] text-[var(--muted)]">คาบรวม</p>
        </div>
      </div>

      {/* Sticker สรุป — pill token */}
      <div
        className={`mb-3 inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
          onTargetCount === totalSubjects
            ? 'bg-[var(--success-soft)] text-[var(--success-strong)]'
            : 'bg-[var(--warning-soft)] text-[var(--warning-strong)]'
        }`}
      >
        {onTargetCount === totalSubjects ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        <span>
          ครบตามเป้า {onTargetCount}/{totalSubjects} วิชา
        </span>
      </div>

      <div className="space-y-2">
        {SUBJECTS.map((s) => {
          const cur = counts[s.code] || 0
          const tgt = target[s.code] || 0
          if (tgt === 0) return null
          const pct = tgt > 0 ? Math.min(100, (cur / tgt) * 100) : 0
          const over = cur > tgt
          const reached = cur >= tgt

          // map สถานะ → token color
          const barColor = over
            ? 'var(--warning)'
            : reached
              ? 'var(--success)'
              : s.color
          const numberClass = over
            ? 'text-[var(--warning-strong)]'
            : reached
              ? 'text-[var(--success-strong)]'
              : 'text-[var(--muted)]'

          return (
            <div key={s.code} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-bold text-[var(--text-soft)]">{s.code}</span>
                  <span className="text-[var(--muted)]">{s.name}</span>
                </div>
                <span className={`font-bold ${numberClass}`}>
                  {cur}/{tgt}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
