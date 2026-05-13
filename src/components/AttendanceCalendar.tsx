'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarCheck, Check, X, AlertCircle, Info } from 'lucide-react'
import { getAttendanceDates } from '@/lib/client-data'
import { formatDateISO, isWeekend } from '@/lib/thai-holidays'
import { THAI_MONTHS } from '@/lib/constants/thai-date'

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

interface AttendanceCalendarProps {
  classroomId: number
  classroomName: string
}

export default function AttendanceCalendar({ classroomId, classroomName }: AttendanceCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(0)

  const year = viewDate.getFullYear()
  const month0 = viewDate.getMonth()
  const yearMonth = `${year}-${String(month0 + 1).padStart(2, '0')}`

  // Keep `today` fresh — re-tick every 60s + when tab regains focus,
  // so the highlight doesn't get stuck on yesterday past midnight.
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick((n) => n + 1)
    }, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNowTick((n) => n + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [nowTick])
  const todayISO = formatDateISO(today)

  // โหลดวันที่เช็คไปแล้ว
  useEffect(() => {
    if (!classroomId) return
    setLoading(true)
    getAttendanceDates(classroomId, yearMonth)
      .then((dates) => setCheckedDates(new Set(dates)))
      .catch(() => setCheckedDates(new Set()))
      .finally(() => setLoading(false))
  }, [classroomId, yearMonth])

  // สร้าง grid ของวัน
  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month0, 1)
    const startDow = firstOfMonth.getDay()
    const daysInMonth = new Date(year, month0 + 1, 0).getDate()
    const grid: { date: Date | null }[] = []
    for (let i = 0; i < startDow; i++) grid.push({ date: null })
    for (let d = 1; d <= daysInMonth; d++) grid.push({ date: new Date(year, month0, d) })
    while (grid.length % 7 !== 0) grid.push({ date: null })
    return grid
  }, [year, month0])

  const thaiYear = year + 543

  // สถานะวันนี้
  const todayIsWeekend = isWeekend(today)
  const todayChecked = checkedDates.has(todayISO)

  const goToPrev = () => setViewDate(new Date(year, month0 - 1, 1))
  const goToNext = () => setViewDate(new Date(year, month0 + 1, 1))
  const goToToday = () => setViewDate(new Date())
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month0

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] md:p-6">
      {/* Header + สถานะวันนี้ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 md:text-lg">ปฏิทินเช็คชื่อ</p>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              ห้อง <span className="font-semibold">{classroomName}</span>
            </p>
          </div>
        </div>

        {/* สถานะวันนี้ */}
        {!todayIsWeekend ? (
          todayChecked ? (
            <Link
              href={`/attendance?classroom=${classroomId}&date=${todayISO}`}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Check size={14} />
              วันนี้เช็คชื่อแล้ว
            </Link>
          ) : (
            <Link
              href={`/attendance?classroom=${classroomId}&date=${todayISO}`}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              <AlertCircle size={14} />
              ยังไม่เช็คชื่อ — เช็คเลย
            </Link>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            <Info size={14} />
            วันนี้เสาร์/อาทิตย์
          </span>
        )}
      </div>

      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrev}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
          title="เดือนก่อน"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900">
            {THAI_MONTHS[month0]} {thaiYear}
          </p>
          {!isThisMonth && (
            <button
              type="button"
              onClick={goToToday}
              className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:border-blue-300 hover:text-blue-600"
            >
              กลับมาวันนี้
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={goToNext}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
          title="เดือนถัดไป"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-1 text-center text-xs font-bold ${
              i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {label}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={`pad-${idx}`} className="h-12 rounded-lg" />
          }
          const iso = formatDateISO(cell.date)
          const weekend = isWeekend(cell.date)
          const isToday = iso === todayISO
          const isPast = cell.date < today
          const isFuture = cell.date > today
          const checked = checkedDates.has(iso)
          const isSchoolDay = !weekend

          let bg = 'bg-white hover:bg-blue-50/50'
          let text = 'text-slate-800'
          let ring = 'border-transparent'
          let badge: React.ReactNode = null
          let title = `${cell.date.getDate()} ${THAI_MONTHS[month0]}`

          if (weekend) {
            bg = 'bg-slate-50'
            text = 'text-slate-400'
          }

          if (isSchoolDay && isPast) {
            if (checked) {
              bg = 'bg-emerald-50 hover:bg-emerald-100'
              text = 'text-emerald-800'
              badge = <Check size={11} className="text-emerald-600" strokeWidth={3} />
              title += ' ✓ เช็คแล้ว'
            } else {
              bg = 'bg-amber-50 hover:bg-amber-100'
              text = 'text-amber-800'
              badge = <X size={11} className="text-amber-600" strokeWidth={3} />
              title += ' ! ยังไม่เช็ค'
            }
          } else if (isSchoolDay && isToday && checked) {
            bg = 'bg-emerald-100'
            text = 'text-emerald-800'
            badge = <Check size={11} className="text-emerald-700" strokeWidth={3} />
            title += ' ✓ เช็คแล้ว'
          } else if (isSchoolDay && checked) {
            badge = <Check size={11} className="text-emerald-600" strokeWidth={3} />
          }

          if (isToday) {
            ring = 'border-[var(--primary)] ring-2 ring-blue-200'
          }

          const content = (
            <div
              className={`relative flex h-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition ${bg} ${text} ${ring}`}
              title={title}
            >
              <span className={isToday ? 'font-bold' : ''}>{cell.date.getDate()}</span>
              {badge && <span className="absolute right-1 top-1">{badge}</span>}
            </div>
          )

          if (isSchoolDay && !isFuture) {
            return (
              <Link
                key={iso}
                href={`/attendance?classroom=${classroomId}&date=${iso}`}
                className="btn-press block"
              >
                {content}
              </Link>
            )
          }
          return <div key={iso}>{content}</div>
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-[var(--muted)]">
        <LegendSwatch color="bg-emerald-50 border-emerald-200" label="เช็คแล้ว" />
        <LegendSwatch color="bg-amber-50 border-amber-200" label="ยังไม่เช็ค" />
        <LegendSwatch color="bg-slate-50 border-slate-200" label="เสาร์/อาทิตย์" />
      </div>

      {loading && <div className="mt-2 text-center text-[11px] text-[var(--muted)]">กำลังโหลด...</div>}
    </section>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${color}`} />
      {label}
    </span>
  )
}
