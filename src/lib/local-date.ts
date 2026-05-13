/**
 * Local-date helpers — กัน UTC date bug ที่เกิดเมื่อใช้
 * `new Date().toISOString().split('T')[0]` ตอนตี 1-7 โมงเช้า
 * (ISO ใช้ UTC, ทำให้ได้วันก่อนหน้าใน timezone +07:00 ของไทย)
 *
 * แอปนี้ใช้ในไทยและเก็บ local DB → date string ต้องเป็น Bangkok local time เสมอ
 *
 * Note: ฟังก์ชัน `formatDateISO` ใน `thai-holidays.ts` ก็ทำ local date เหมือนกัน —
 * แต่ไว้ในไฟล์ thai-holidays เพราะใช้คู่กันที่นั่น file นี้คือ source of truth
 * สำหรับการแปลง local date ทั่วๆ ไป
 */

/** Convert any Date object → 'YYYY-MM-DD' (local timezone) */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today's date as 'YYYY-MM-DD' (local timezone) */
export const todayISO = (): string => toLocalISO(new Date())

/** Convert any Date object → 'YYYY-MM-DD HH:mm:ss' (local timezone) */
export function formatLocalDateTime(d: Date): string {
  const date = toLocalISO(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${date} ${hh}:${mm}:${ss}`
}
