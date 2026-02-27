'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface CalendarPickerProps {
  value: string
  onChange: (date: string) => void
  label?: string
  placeholder?: string
  compact?: boolean
  dropdownAlign?: 'left' | 'right'
}

export default function CalendarPicker({ value, onChange, label, placeholder, compact = false, dropdownAlign = 'left' }: CalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const initDate = value ? new Date(value) : new Date()
  const [viewDate, setViewDate] = useState(initDate)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const monthNamesShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
  const dayNamesFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(new Date(value))
    }
  }, [value])

  const selectDate = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    onChange(newDate.toISOString().split('T')[0])
    setIsOpen(false)
  }

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const prevYear = () => {
    setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))
  }

  const nextYear = () => {
    setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))
  }

  const hasValue = !!value
  const currentDate = hasValue ? new Date(value) : null
  const selectedDay = currentDate?.getDate() ?? -1
  const selectedMonth = currentDate?.getMonth() ?? -1
  const selectedYear = currentDate?.getFullYear() ?? -1

  const formatDisplay = () => {
    if (!currentDate) return placeholder || 'เลือกวันที่'
    if (compact) {
      return `${currentDate.getDate()} ${monthNamesShort[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`
    }
    return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`
  }

  const formatSubtext = () => {
    if (!currentDate) return ''
    return `วัน${dayNamesFull[currentDate.getDay()]}`
  }

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
      )}
      {/* Trigger */}
      <div 
        className={`flex items-center gap-3 bg-white border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all hover:shadow-sm ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5 shadow-sm'
        } ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}`}
        onClick={() => {
          if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            setOpenUpward(spaceBelow < 420)
          }
          setIsOpen(!isOpen)
        }}
        ref={triggerRef}
      >
        <div className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Calendar size={compact ? 16 : 18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-text-primary truncate`}>
            {formatDisplay()}
          </p>
          {!compact && formatSubtext() && (
            <p className="text-xs text-text-secondary">
              {formatSubtext()}
            </p>
          )}
        </div>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div 
            ref={dropdownRef}
            className={`absolute ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'} bg-white rounded-2xl shadow-2xl border border-border z-20 p-4 w-[300px] animate-in fade-in duration-200 ${
              dropdownAlign === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {/* Year Navigation */}
            <div className="flex items-center justify-between mb-1">
              <button 
                type="button"
                onClick={prevYear}
                className="px-2 py-0.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
              >
                « {viewDate.getFullYear() + 542}
              </button>
              <span className="text-xs font-medium text-text-secondary">
                พ.ศ. {viewDate.getFullYear() + 543}
              </span>
              <button 
                type="button"
                onClick={nextYear}
                className="px-2 py-0.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
              >
                {viewDate.getFullYear() + 544} »
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button 
                type="button"
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronLeft size={18} className="text-text-secondary" />
              </button>
              <span className="text-sm font-semibold text-text-primary">
                {monthNames[viewDate.getMonth()]}
              </span>
              <button 
                type="button"
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronRight size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day, i) => (
                <div key={i} className={`text-center text-xs font-semibold py-1.5 ${
                  i === 0 || i === 6 ? 'text-red-400' : 'text-text-secondary'
                }`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const isSelected = day === selectedDay && viewDate.getMonth() === selectedMonth && viewDate.getFullYear() === selectedYear
                const isToday = day === new Date().getDate() && viewDate.getMonth() === new Date().getMonth() && viewDate.getFullYear() === new Date().getFullYear()
                const dayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => selectDate(day)}
                    className={`
                      w-9 h-9 rounded-xl text-sm transition-all font-medium
                      ${isSelected 
                        ? 'bg-primary text-white shadow-md shadow-primary/30 scale-110' 
                        : isToday 
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : isWeekend
                            ? 'text-red-400 hover:bg-red-50'
                            : 'hover:bg-gray-100 text-text-primary'
                      }
                    `}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const today = new Date()
                  setViewDate(today)
                  onChange(today.toISOString().split('T')[0])
                  setIsOpen(false)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors font-medium"
              >
                <Calendar size={14} />
                วันนี้
              </button>
              {hasValue && (
                <span className="text-xs text-text-secondary">
                  {currentDate!.getDate()} {monthNamesShort[currentDate!.getMonth()]} {currentDate!.getFullYear() + 543}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
