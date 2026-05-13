'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ปิดเมื่อคลิกนอก button + menu (menu อยู่ใน portal คนละ tree เลยต้องเช็คทั้งคู่)
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ปิดด้วย Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // คำนวณตำแหน่งเมนูจาก rect ของ button — รี-คำนวณตอน open/resize/scroll
  useLayoutEffect(() => {
    if (!open) return
    function updatePosition() {
      const el = buttonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setMenuRect({ left: r.left, top: r.bottom + 6, width: r.width })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true) // true = capture, จับ scroll ของ ancestor ทุกตัว
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label ?? placeholder ?? ''

  const isPlaceholder = value === '' || value === 0

  const sizeButton =
    size === 'sm'
      ? 'rounded-md px-2 py-1 text-[11px] font-semibold'
      : 'rounded-xl px-4 py-2.5 text-sm'

  const defaultButton =
    'border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--line-strong)] focus:border-[var(--primary)]'

  const sizeMenuItem = size === 'sm' ? 'px-2 py-1.5 text-[11px]' : 'px-4 py-2.5 text-sm'

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between text-left outline-none transition focus:ring-0 ${sizeButton} ${
          buttonClassName ?? defaultButton
        }`}
      >
        <span className={isPlaceholder && !buttonClassName ? 'text-[var(--muted)]' : ''}>
          {selectedLabel || '-'}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 16}
          className={`ml-2 flex-shrink-0 opacity-70 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {mounted && open && menuRect &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1000] max-h-60 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
            style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width }}
          >
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
                      ? 'bg-[var(--primary-ghost)] font-medium text-[var(--primary-strong)]'
                      : 'text-[var(--text-soft)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <Check size={size === 'sm' ? 12 : 16} className="flex-shrink-0 text-[var(--primary)]" />
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
