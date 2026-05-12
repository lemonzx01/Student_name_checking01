'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string | number
  label: string
}

interface Props {
  value: string | number
  onChange: (value: string | number) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  /** ขนาด: 'md' (default) สำหรับ form ปกติ, 'sm' สำหรับ table cell */
  size?: 'sm' | 'md'
  /** override styling ของปุ่ม — ใช้เมื่อต้องการ dynamic colors (เช่น level badge) */
  buttonClassName?: string
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  size = 'md',
  buttonClassName,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label ?? placeholder ?? ''

  const isPlaceholder = value === '' || value === 0

  const sizeButton =
    size === 'sm'
      ? 'rounded-md px-2 py-1 text-[11px] font-semibold'
      : 'rounded-xl px-4 py-2.5 text-sm'

  const defaultButton =
    'border border-[var(--line)] bg-white text-slate-900 hover:border-slate-300 focus:border-[var(--primary)]'

  const sizeMenuItem = size === 'sm' ? 'px-2 py-1.5 text-[11px]' : 'px-4 py-2.5 text-sm'

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between text-left outline-none transition focus:ring-0 ${sizeButton} ${
          buttonClassName ?? defaultButton
        }`}
      >
        <span className={isPlaceholder && !buttonClassName ? 'text-slate-400' : ''}>
          {selectedLabel || '-'}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 16}
          className={`ml-2 flex-shrink-0 opacity-70 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-auto rounded-xl border border-[var(--line)] bg-white py-1 shadow-lg">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between text-left transition-colors ${sizeMenuItem} ${
                  isSelected
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <Check size={size === 'sm' ? 12 : 16} className="flex-shrink-0 text-blue-600" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
