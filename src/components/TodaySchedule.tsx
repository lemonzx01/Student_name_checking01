'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock, Coffee } from 'lucide-react'
import { getScheduleByClassroom } from '@/lib/client-data'

// ให้ตรงกับ /app/schedule/page.tsx
const PERIOD_RANGES: [number, number][] = [
  [8 * 60 + 30, 9 * 60 + 30],    // คาบ 1: 08:30–09:30
  [9 * 60 + 30, 10 * 60 + 30],   // คาบ 2: 09:30–10:30
  [10 * 60 + 30, 11 * 60 + 10],  // คาบ 3: 10:30–11:10
  [12 * 60 + 20, 13 * 60 + 20],  // คาบ 4: 12:20–13:20
  [13 * 60 + 20, 14 * 60 + 20],  // คาบ 5: 13:20–14:20
  [14 * 60 + 20, 15 * 60 + 20],  // คาบ 6: 14:20–15:20
]
const LUNCH_RANGE: [number, number] = [11 * 60 + 10, 12 * 60 + 20]
const PERIOD_LABELS = ['08.30-09.30', '09.30-10.30', '10.30-11.10', '12.20-13.20', '13.20-14.20', '14.20-15.20']

const FIXED_SLOTS: Record<string, string> = {
  '3-6': 'ลูกเสือ',
  '4-6': 'ชุมนุม',
  '5-6': 'สวดมนต์',
}

// subject code → ชื่อเต็ม (ซิงค์กับ SUBJECTS ใน /app/schedule/page.tsx)
const SUBJECT_MAP: Record<string, { name: string; color: string }> = {
  TH: { name: 'ภาษาไทย', color: '#3B82F6' },
  MA: { name: 'คณิตศาสตร์', color: '#EF4444' },
  EN: { name: 'ภาษาอังกฤษ', color: '#8B5CF6' },
  SC: { name: 'วิทยาศาสตร์', color: '#10B981' },
  SO: { name: 'สังคมศึกษา', color: '#F59E0B' },
  HI: { name: 'ประวัติศาสตร์', color: '#D97706' },
  HE: { name: 'สุขศึกษา/พละ', color: '#EC4899' },
  AR: { name: 'ศิลปะ', color: '#06B6D4' },
  WO: { name: 'การงานฯ', color: '#84CC16' },
}

interface TodayScheduleProps {
  classroomId: number
  classroomName: string
}

interface ScheduleRow {
  day_of_week: number
  period: number
  subject_code?: string | null
  subject_name?: string | null
}

export default function TodaySchedule({ classroomId, classroomName }: TodayScheduleProps) {
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  // อัพเดท now ทุก 1 นาที เพื่อ highlight คาบปัจจุบันได้ถูกต้อง
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!classroomId) return
    setLoading(true)
    getScheduleByClassroom(classroomId)
      .then((data) => setRows(data as ScheduleRow[]))
      .catch((err) => {
        console.error('[TodaySchedule] load error', err)
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [classroomId])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // JS getDay(): 0=อา 1=จ 2=อ 3=พ 4=พฤ 5=ศ 6=ส
  // ตารางเรียน: 1=จ 2=อ 3=พ 4=พฤ 5=ศ
  const jsDay = now.getDay()
  const todayDayNum = jsDay >= 1 && jsDay <= 5 ? jsDay : 0

  const todayLabel = useMemo(() => {
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
    return days[jsDay]
  }, [jsDay])

  // คาบปัจจุบัน (ถ้าอยู่ระหว่างเวลาเรียน)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentPeriod = useMemo(() => {
    if (todayDayNum === 0) return -1
    for (let i = 0; i < PERIOD_RANGES.length; i++) {
      const [start, end] = PERIOD_RANGES[i]
      if (currentMinutes >= start && currentMinutes < end) return i + 1
    }
    return -1
  }, [currentMinutes, todayDayNum])
  const inLunch = todayDayNum !== 0 && currentMinutes >= LUNCH_RANGE[0] && currentMinutes < LUNCH_RANGE[1]

  // เก็บคาบของวันนี้เท่านั้น
  const todayRows = useMemo(() => {
    if (todayDayNum === 0) return []
    const map: Record<number, ScheduleRow> = {}
    for (const r of rows) {
      if (r.day_of_week === todayDayNum) map[r.period] = r
    }
    return Array.from({ length: 6 }, (_, i) => {
      const p = i + 1
      return { period: p, row: map[p] || null }
    })
  }, [rows, todayDayNum])

  // ถ้าเป็น ส./อา.
  if (todayDayNum === 0) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <CalendarDays size={26} />
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">{todayLabel} — วันหยุด</p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">ไม่มีคาบเรียนตามตารางปกติ</p>
        </div>
      </div>
    )
  }

  const hasAnyLesson = todayRows.some((s) => s.row || FIXED_SLOTS[`${todayDayNum}-${s.period}`])

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays size={22} />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 md:text-lg">{todayLabel} — สอนอะไรบ้าง</p>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              ห้อง <span className="font-semibold">{classroomName}</span>
              {currentPeriod > 0 && <> · ตอนนี้คาบ <span className="font-semibold text-blue-600">{currentPeriod}</span></>}
              {inLunch && <> · <span className="font-semibold text-amber-600">พักกลางวัน</span></>}
            </p>
          </div>
        </div>
        <Link
          href={`/schedule?classroom=${classroomId}`}
          className="btn-press hidden items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-blue-300 hover:text-blue-600 sm:inline-flex"
        >
          ดูตารางทั้งสัปดาห์
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : !hasAnyLesson ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-slate-50 px-4 py-6 text-center text-sm text-[var(--muted)]">
          ยังไม่มีตารางสอนของวันนี้ —{' '}
          <Link href={`/schedule?classroom=${classroomId}`} className="font-semibold text-[var(--primary)] underline">
            ไปตั้งตารางสอน
          </Link>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {todayRows.map(({ period, row }) => {
            const fixed = FIXED_SLOTS[`${todayDayNum}-${period}`]
            const subject = row?.subject_code ? SUBJECT_MAP[row.subject_code] : null
            const isNow = currentPeriod === period
            const isPast = currentPeriod > 0 && period < currentPeriod
            const color = subject?.color || (fixed ? '#8b5cf6' : '#94a3b8')

            return (
              <div
                key={period}
                className={`relative flex flex-col rounded-xl border-2 p-3 transition ${
                  isNow
                    ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                    : isPast
                    ? 'border-[var(--line)] bg-slate-50 opacity-60'
                    : 'border-[var(--line)] bg-white'
                }`}
              >
                {isNow && (
                  <span className="absolute -top-2 left-3 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    ตอนนี้
                  </span>
                )}
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)]">คาบ {period}</span>
                  <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                    <Clock size={10} />
                    {PERIOD_LABELS[period - 1]}
                  </span>
                </div>
                {fixed ? (
                  <div className="flex flex-1 items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <p className="text-sm font-bold text-slate-800">{fixed}</p>
                  </div>
                ) : subject ? (
                  <div className="flex flex-1 items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <p className="text-sm font-bold text-slate-900">{subject.name}</p>
                  </div>
                ) : (
                  <p className="flex-1 text-sm italic text-slate-400">— ว่าง —</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {inLunch && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
          <Coffee size={16} />
          ตอนนี้ช่วงพักกลางวัน ({PERIOD_LABELS[2].split('-')[1]}–{PERIOD_LABELS[3].split('-')[0]})
        </div>
      )}

      <Link
        href={`/schedule?classroom=${classroomId}`}
        className="btn-press mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 sm:hidden"
      >
        ดูตารางทั้งสัปดาห์
      </Link>
    </section>
  )
}
