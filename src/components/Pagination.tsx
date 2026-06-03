'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  current: number
  total: number
  onChange: (page: number) => void
  /** จำนวนเลขหน้าที่โชว์ตรงกลาง (default 5 = current ± 2) */
  windowSize?: number
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

function buildPages(current: number, total: number, windowSize: number): PageItem[] {
  if (total <= 1) return [1]
  // ถ้าหน้ารวมพอใส่ window + 2 (สำหรับ ellipsis 2 ฝั่ง) — แสดงทุกหน้าเลย
  if (total <= windowSize + 2) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, current - half)
  let end = Math.min(total, start + windowSize - 1)
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1)
  }

  const items: PageItem[] = []
  if (start > 1) items.push('ellipsis-left')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total) items.push('ellipsis-right')
  return items
}

export default function Pagination({ current, total, onChange, windowSize = 5 }: PaginationProps) {
  if (total <= 1) return null

  const pages = buildPages(current, total, windowSize)
  const canPrev = current > 1
  const canNext = current < total

  function jump(item: PageItem) {
    if (item === 'ellipsis-left') {
      onChange(Math.max(1, current - windowSize))
    } else if (item === 'ellipsis-right') {
      onChange(Math.min(total, current + windowSize))
    } else {
      onChange(item)
    }
  }

  const baseBtn =
    'flex h-9 min-w-[36px] items-center justify-center rounded-lg border text-sm font-medium transition btn-press'
  const inactive =
    'border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary-strong)]'
  const active =
    'border-[var(--primary)] bg-[var(--primary)] text-white shadow-[var(--shadow-xs)]'
  const disabled = 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted-soft)] cursor-not-allowed'

  return (
    <nav
      role="navigation"
      aria-label="แบ่งหน้า"
      className="mt-5 flex flex-wrap items-center justify-center gap-1.5"
    >
      <button
        type="button"
        onClick={() => canPrev && onChange(current - 1)}
        disabled={!canPrev}
        className={`${baseBtn} ${canPrev ? inactive : disabled}`}
        aria-label="หน้าก่อน"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((item, idx) => {
        if (item === 'ellipsis-left' || item === 'ellipsis-right') {
          return (
            <button
              key={`${item}-${idx}`}
              type="button"
              onClick={() => jump(item)}
              className={`${baseBtn} ${inactive} px-2`}
              aria-label={item === 'ellipsis-left' ? `ย้อนกลับ ${windowSize} หน้า` : `ข้ามไป ${windowSize} หน้า`}
              title="คลิกเพื่อข้ามไปเร็ว ๆ"
            >
              …
            </button>
          )
        }
        const isActive = item === current
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`${baseBtn} px-2 ${isActive ? active : inactive}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`หน้า ${item}`}
          >
            {item}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => canNext && onChange(current + 1)}
        disabled={!canNext}
        className={`${baseBtn} ${canNext ? inactive : disabled}`}
        aria-label="หน้าถัดไป"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
