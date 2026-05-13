/**
 * Single source of truth สำหรับชื่อเดือน/วันภาษาไทย
 *
 * ใช้ในที่เดียวกัน:
 * - /app/page.tsx (formatThaiDate ที่ dashboard)
 * - /app/settings/page.tsx (formatBackupDate)
 * - /app/students/page.tsx (formatThaiShortDate)
 * - /components/AttendanceCalendar.tsx (header เดือน)
 * - /components/BackupStatusCard.tsx (formatBackupTime)
 * - /components/DashboardStats.tsx (formatThaiShortDate)
 *
 * แก้รายการนี้ที่เดียวพอ — ห้าม hardcode array ซ้ำในไฟล์อื่น
 */

/** 12 เดือนภาษาไทยแบบเต็ม — index 0 = มกราคม */
export const THAI_MONTHS: readonly string[] = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const

/** 12 เดือนภาษาไทยแบบย่อ — index 0 = ม.ค. */
export const THAI_MONTHS_SHORT: readonly string[] = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const

/** 7 วันภาษาไทยแบบเต็ม — index 0 = วันอาทิตย์ (ตาม Date.getDay()) */
export const THAI_DAYS: readonly string[] = [
  'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์',
] as const

/** 7 วันภาษาไทยแบบย่อ — index 0 = อา. (ตาม Date.getDay()) */
export const THAI_DAYS_SHORT: readonly string[] = [
  'อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.',
] as const

/**
 * Format Date → "วันXที่ D MMMM YYYY" (พ.ศ.)
 * ตัวอย่าง: "วันจันทร์ที่ 13 พฤษภาคม 2569"
 */
export function formatThaiDate(d: Date): string {
  return `${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/**
 * Format ISO date string 'YYYY-MM-DD' → "D MMM YYYY" (พ.ศ.)
 * ตัวอย่าง: "13 พ.ค. 2569"
 * ใช้ string parsing แทน new Date() เพื่อกัน timezone bug
 */
export function formatThaiShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`
}
