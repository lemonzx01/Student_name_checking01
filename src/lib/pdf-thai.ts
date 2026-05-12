// Helper สำหรับ jsPDF ที่รองรับฟอนต์ไทย (Noto Sans Thai)
// ใช้ใน /report-card, /report/por5, /report/por6
import { NotoSansThai } from './thai-font'

export type Orientation = 'portrait' | 'landscape'

/**
 * สร้าง jsPDF instance พร้อมฟอนต์ไทย — โหลด jsPDF / autotable แบบ dynamic
 * (lazy loading — กัน bundle ใหญ่ทุกหน้า)
 */
export async function createThaiDoc(orientation: Orientation = 'portrait') {
  const jspdfModule = await import('jspdf')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPDF: any = (jspdfModule as any).default || (jspdfModule as any).jsPDF
  const autoTableModule = await import('jspdf-autotable')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable: any = (autoTableModule as any).default || autoTableModule

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
  doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
  doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
  doc.setFont('NotoSansThai')
  return { doc, autoTable }
}

/** ภาษาไทย: แปลงวันที่ ISO → "d MMM YYYY" (ปี พ.ศ.) */
export function formatThaiShortDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]
  return `${d} ${months[m - 1]} ${y + 543}`
}

/** ภาษาไทย: รวมชื่อ-สกุล พร้อมคำนำหน้า */
export function thaiFullName(s: {
  title?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  return [s.title, s.first_name, s.last_name].filter(Boolean).join(' ')
}
