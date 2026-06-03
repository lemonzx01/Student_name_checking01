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

  const okStyle = {
    backgroundColor: 'var(--success-soft)',
    color: 'var(--success-strong)',
    borderColor: 'var(--success-soft)',
  }
  const warnStyle = {
    backgroundColor: 'var(--warning-soft)',
    color: 'var(--warning-strong)',
    borderColor: 'var(--warning-soft)',
  }
  const mutedStyle = {
    backgroundColor: 'var(--surface-muted)',
    color: 'var(--muted)',
    borderColor: 'var(--line-soft, var(--line))',
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
      {/* Header + สถานะวันนี้ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--primary-ghost)', color: 'var(--primary)' }}
          >
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text)] md:text-lg">ปฏิทินเช็คชื่อ</p>
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
              className="btn-press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
              style={okStyle}
            >
              <Check size={14} />
              วันนี้เช็คชื่อแล้ว
            </Link>
          ) : (
            <Link
              href={`/attendance?classroom=${classroomId}&date=${todayISO}`}
              className="btn-press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
              style={warnStyle}
            >
              <AlertCircle size={14} />
              ยังไม่เช็คชื่อ — เช็คเลย
            </Link>
          )
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            style={mutedStyle}
          >
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
          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          title="เดือนก่อน"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[var(--text)]">
            {THAI_MONTHS[month0]} {thaiYear}
          </p>
          {!isThisMonth && (
            <button
              type="button"
              onClick={goToToday}
              className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              กลับมาวันนี้
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={goToNext}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
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
            className="py-1 text-center text-xs font-bold"
            style={{ color: i === 0 || i === 6 ? 'var(--muted-soft)' : 'var(--muted)' }}
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

          let cellStyle: React.CSSProperties = {
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
            borderColor: 'var(--line)',
          }
          let badge: React.ReactNode = null
          let title = `${cell.date.getDate()} ${THAI_MONTHS[month0]}`

          if (weekend) {
            cellStyle = { ...mutedStyle }
          }

          if (isSchoolDay && isPast) {
            if (checked) {
              cellStyle = { ...okStyle }
              badge = <Check size={11} style={{ color: 'var(--success)' }} strokeWidth={3} />
              title += ' ✓ เช็คแล้ว'
            } else {
              cellStyle = { ...warnStyle }
              badge = <X size={11} style={{ color: 'var(--warning)' }} strokeWidth={3} />
              title += ' ! ยังไม่เช็ค'
            }
          } else if (isSchoolDay && isToday && checked) {
            cellStyle = { ...okStyle }
            badge = <Check size={11} style={{ color: 'var(--success)' }} strokeWidth={3} />
            title += ' ✓ เช็คแล้ว'
          } else if (isSchoolDay && checked) {
            badge = <Check size={11} style={{ color: 'var(--success)' }} strokeWidth={3} />
          }

          if (isToday) {
            cellStyle.borderColor = 'var(--primary)'
            cellStyle.boxShadow = '0 0 0 2px var(--primary-soft, var(--primary-ghost))'
          }

          const clickable = isSchoolDay && !isFuture

          const content = (
            <div
              className={`relative flex h-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition ${
                clickable ? 'hover:brightness-110 dark:hover:brightness-125' : ''
              }`}
              style={cellStyle}
              title={title + (clickable ? ' — คลิกเพื่อเช็คชื่อ' : '')}
            >
              <span className={isToday ? 'font-bold' : ''}>{cell.date.getDate()}</span>
              {badge && <span className="absolute right-1 top-1">{badge}</span>}
            </div>
          )

          if (clickable) {
            return (
              <Link
                key={iso}
                href={`/attendance?classroom=${classroomId}&date=${iso}`}
                className="btn-press block cursor-pointer"
              >
                {content}
              </Link>
            )
          }
          return <div key={iso}>{content}</div>
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--line-soft)] pt-3 text-[11px] text-[var(--muted)]">
        <LegendSwatch style={okStyle} label="เช็คแล้ว" />
        <LegendSwatch style={warnStyle} label="ยังไม่เช็ค" />
        <LegendSwatch style={mutedStyle} label="เสาร์/อาทิตย์" />
      </div>

      {loading && <div className="mt-2 text-center text-[11px] text-[var(--muted)]">กำลังโหลด...</div>}
    </section>
  )
}

function LegendSwatch({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded border" style={style} />
      {label}
    </span>
  )
}
