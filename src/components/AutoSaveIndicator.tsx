'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { AutoSaveStatus } from '@/lib/hooks/useAutoSave'

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  /** ข้อความที่จะแสดงเพิ่มเมื่อเกิด error — ปกติใช้ตัว default */
  errorText?: string
  /** ตำแหน่งบนหน้าจอ — default bottom-right */
  position?: 'bottom-right' | 'bottom-left' | 'top-right'
  /** ปิด indicator (เช่น ถ้ายังไม่ได้เลือกห้องเรียน) */
  hidden?: boolean
}

/**
 * แสดงสถานะการบันทึกอัตโนมัติ (มุมล่างขวา) ให้ครูมั่นใจว่าข้อมูลบันทึกแล้วจริง ๆ
 *
 * - กำลังบันทึก: วงกลมหมุนสีฟ้า "กำลังบันทึก..." (เด่นเต็มที่)
 * - บันทึกแล้ว: เครื่องหมายถูกสีเขียว "บันทึกแล้ว HH:MM" (opacity ลดลงเมื่อ idle)
 * - error:      รูปเตือนสีแดง "บันทึกไม่สำเร็จ" (เด่นเต็มที่)
 * - idle:       ไม่แสดง (ยังไม่มีการแก้ไขเลย)
 *
 * หลัง saved indicator จะคงอยู่ตลอดเวลา (opacity ลดเมื่อนานเข้า)
 * — ให้ครูมั่นใจตลอดเวลาว่าข้อมูลปลอดภัย
 */
export default function AutoSaveIndicator({
  status,
  lastSavedAt,
  errorText = 'บันทึกไม่สำเร็จ — จะลองใหม่อัตโนมัติเมื่อแก้ไขครั้งถัดไป',
  position = 'bottom-right',
  hidden = false,
}: AutoSaveIndicatorProps) {
  const [now, setNow] = useState(() => Date.now())

  // อัปเดตเวลา "x วินาทีที่แล้ว" ทุก 30 วินาที
  useEffect(() => {
    if (status !== 'saved') return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [status])

  if (hidden) return null
  // idle = ยังไม่เคยบันทึกเลย ไม่ต้องแสดง
  if (status === 'idle' && !lastSavedAt) return null

  const positionClass =
    position === 'bottom-right'
      ? 'bottom-6 right-6'
      : position === 'bottom-left'
        ? 'bottom-6 left-6'
        : 'top-6 right-6'

  // เด่นเฉพาะตอน saving/error — saved คงอยู่แต่ opacity ต่ำลง
  const isHighlighted = status === 'saving' || status === 'error'

  return (
    <div className={`fixed z-40 ${positionClass} pointer-events-none`} aria-live="polite">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-md backdrop-blur-sm transition-opacity ${
          isHighlighted ? 'opacity-100' : 'opacity-60 hover:opacity-100'
        } ${
          status === 'saving'
            ? 'border-blue-200 bg-blue-50/95 text-blue-700 text-sm py-2 px-4'
            : status === 'saved'
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
              : status === 'error'
                ? 'border-red-200 bg-red-50/95 text-red-700 text-sm py-2 px-4'
                : 'border-slate-200 bg-white/95 text-slate-600'
        }`}
      >
        {status === 'saving' && (
          <>
            <Loader2 size={15} className="animate-spin" />
            <span>กำลังบันทึก...</span>
          </>
        )}

        {(status === 'saved' || (status === 'idle' && lastSavedAt)) && (
          <>
            <Check size={13} />
            <span>
              บันทึกแล้ว
              {lastSavedAt && (
                <span className="ml-1 font-normal text-emerald-600/80">
                  {formatRelativeTime(lastSavedAt, now)}
                </span>
              )}
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={15} />
            <span className="max-w-[260px] text-xs sm:text-sm">{errorText}</span>
          </>
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(then: Date, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - then.getTime()) / 1000))
  if (diffSec < 5) return 'เมื่อสักครู่'
  if (diffSec < 60) {
    // ไม่ต้องเสียพื้นที่ตรงนี้มาก — แสดงเวลาจริงเลย
    const hh = String(then.getHours()).padStart(2, '0')
    const mm = String(then.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 5) return `${diffMin} นาทีที่แล้ว`
  // หลัง 5 นาที แสดงเวลาจริง (กระชับกว่า)
  const hh = String(then.getHours()).padStart(2, '0')
  const mm = String(then.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
