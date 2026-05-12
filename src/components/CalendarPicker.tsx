'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarPickerProps {
  value: string
  onChange: (date: string) => void
  label?: string
  compact?: boolean
  /** Allow picking years far in the past (e.g. for birth dates). Default range: 100 years back */
  yearRange?: number
  /** Set of date strings (YYYY-MM-DD) that should show a dot indicator */
  markedDates?: Set<string>
  /** Callback when the visible month changes — receives "YYYY-MM" */
  onMonthChange?: (yearMonth: string) => void
}

const DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDisplay(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]?.slice(0, 3) ?? ''} ${y + 543}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export default function CalendarPicker({
  value,
  onChange,
  label,
  compact = false,
  yearRange = 100,
  markedDates,
  onMonthChange,
}: CalendarPickerProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const initial = value ? new Date(value) : today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'calendar' | 'month' | 'year'>('calendar')
  const [yearPageStart, setYearPageStart] = useState(Math.floor(initial.getFullYear() / 12) * 12)
  // ตำแหน่ง dropdown — ปรับอัตโนมัติเมื่อพื้นที่ขวา/ล่างไม่พอ ป้องกันโผล่นอกขอบจอ
  const [alignRight, setAlignRight] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    if (open) {
      setMode('calendar')
    }
  }, [open])

  // วัดพื้นที่รอบ ๆ ปุ่ม trigger ก่อน dropdown โผล่ — ป้องกันโผล่นอกขอบจอ
  // และ re-measure ตอน resize/scroll ขณะ dropdown เปิดอยู่
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    function measure() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownWidth = 280
      const dropdownHeight = 360 // ค่าประมาณรวม footer
      const margin = 8

      // ขอบขวา: ถ้ากว้างขวาไม่พอ → flip ไปจัดชิดขวา (right-0)
      const spaceRight = window.innerWidth - rect.left
      setAlignRight(spaceRight < dropdownWidth + margin)

      // ขอบล่าง: ถ้าใต้ปุ่มไม่พอแต่ข้างบนมีที่ → เปิดขึ้นบน
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setOpenUpward(spaceBelow < dropdownHeight + margin && spaceAbove > spaceBelow)
    }

    measure()

    // ฟัง resize/scroll ตอนเปิดอยู่ — กันกรณี viewport เปลี่ยนระหว่างเปิด popup
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true) // capture เพื่อจับ scroll ของ parent ทุกตัว
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  function prevMonth() {
    let newMonth = viewMonth
    let newYear = viewYear
    if (viewMonth === 0) {
      newMonth = 11
      newYear = viewYear - 1
    } else {
      newMonth = viewMonth - 1
    }
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(`${newYear}-${pad(newMonth + 1)}`)
  }

  function nextMonth() {
    let newMonth = viewMonth
    let newYear = viewYear
    if (viewMonth === 11) {
      newMonth = 0
      newYear = viewYear + 1
    } else {
      newMonth = viewMonth + 1
    }
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(`${newYear}-${pad(newMonth + 1)}`)
  }

  function selectDate(day: number) {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    onChange(dateStr)
    setOpen(false)
  }

  function selectToday() {
    onChange(todayStr)
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1)

  const cells: { day: number; current: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true })
  }
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false })
    }
  }

  return (
    <div className="relative" ref={ref}>
      {label && (
        <span className={`mb-1.5 block font-semibold text-slate-600 ${compact ? 'text-xs' : 'text-xs'}`}>
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-left text-sm outline-none transition hover:border-slate-300 focus:border-[var(--primary)]"
      >
        <CalendarDays size={15} className="flex-shrink-0 text-slate-400" />
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {value ? formatDisplay(value) : 'เลือกวันที่'}
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-50 w-[280px] rounded-xl border border-[var(--line)] bg-white p-4 shadow-xl ${
            alignRight ? 'right-0' : 'left-0'
          } ${openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >

          {/* ── Year picker mode ── */}
          {mode === 'year' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setYearPageStart(yearPageStart - 12)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-slate-800">
                  {yearPageStart + 543} – {yearPageStart + 11 + 543}
                </span>
                <button
                  type="button"
                  onClick={() => setYearPageStart(yearPageStart + 12)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((yr) => {
                  const isCurrent = yr === viewYear
                  const isThisYear = yr === today.getFullYear()
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => { setViewYear(yr); setMode('month') }}
                      className={`rounded-lg py-2 text-xs font-medium transition
                        ${isCurrent ? 'bg-blue-600 text-white shadow-sm' : ''}
                        ${isThisYear && !isCurrent ? 'font-bold text-blue-600 ring-1 ring-blue-200' : ''}
                        ${!isCurrent && !isThisYear ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-600' : ''}
                      `}
                    >
                      {yr + 543}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Month picker mode ── */}
          {mode === 'month' && (
            <>
              <div className="mb-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => { setYearPageStart(Math.floor(viewYear / 12) * 12); setMode('year') }}
                  className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                >
                  {viewYear + 543}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS_SHORT.map((m, i) => {
                  const isCurrent = i === viewMonth && viewYear === viewYear
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setViewMonth(i); setMode('calendar') }}
                      className={`rounded-lg py-2.5 text-xs font-medium transition
                        ${isCurrent ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'}
                      `}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Calendar (day) mode ── */}
          {mode === 'calendar' && (
            <>
              {/* Month/Year header — clickable to switch modes */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setYearPageStart(Math.floor(viewYear / 12) * 12); setMode('year') }}
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                >
                  {MONTHS[viewMonth]} {viewYear + 543}
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAYS.map((d) => (
              <div key={d} className="py-1 text-[11px] font-medium text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 text-center">
            {cells.map((cell, i) => {
              const dateStr = cell.current
                ? `${viewYear}-${pad(viewMonth + 1)}-${pad(cell.day)}`
                : ''
              const isSelected = cell.current && dateStr === value
              const isToday = cell.current && dateStr === todayStr
              const isMarked = cell.current && markedDates?.has(dateStr)

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!cell.current}
                  onClick={() => cell.current && selectDate(cell.day)}
                  className={`relative m-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-xs transition
                    ${!cell.current ? 'text-slate-200' : ''}
                    ${cell.current && !isSelected && !isToday ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-600' : ''}
                    ${isToday && !isSelected ? 'font-bold text-blue-600 ring-1 ring-blue-200' : ''}
                    ${isSelected ? 'bg-blue-600 font-bold text-white shadow-sm' : ''}
                  `}
                >
                  {cell.day}
                  {isMarked && (
                    <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                  )}
                </button>
              )
            })}
          </div>

            </>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
