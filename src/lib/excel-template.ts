'use client'

/**
 * Generate ไฟล์ Excel template ว่างที่ตรงกับ src/lib/student-import.ts
 * — ครูดาวน์โหลดไปกรอกแล้ว import กลับเข้ามาได้เลย
 */

import { DISADVANTAGE_OPTIONS } from './disadvantage'

const TEMPLATE_HEADERS = [
  'เลขประจำตัวนักเรียน(13 หลัก)',
  'ชั้น',
  'เลขที่/รหัสนักเรียน',
  'คำนำหน้าชื่อ',
  'ชื่อ',
  'นามสกุล',
  'วันเกิด',
  'อายุ(ปี)',
  'น้ำหนัก',
  'ส่วนสูง',
  'บ้านเลขที่',
  'หมู่',
  'คำนำหน้าชื่อผู้ปกครอง',
  'ชื่อผู้ปกครอง',
  'นามสกุลผู้ปกครอง',
  'อาชีพของผู้ปกครอง',
  'ความเกี่ยวข้องของผู้ปกครองกับนักเรียน',
  'คำนำหน้าชื่อบิดา',
  'ชื่อบิดา',
  'นามสกุลบิดา',
  'อาชีพของบิดา',
  'คำนำหน้าชื่อมารดา',
  'ชื่อมารดา',
  'นามสกุลมารดา',
  'อาชีพของมารดา',
  'ความด้อยโอกาส',
]

const SAMPLE_ROW = [
  '1234567890123', // เลข 13 หลัก
  'ป.1', // ชั้น
  '1', // เลขที่
  'เด็กชาย',
  'ตัวอย่าง',
  'นามสมมติ',
  '01/01/2560', // วันเกิด
  '7',
  '25.5',
  '120',
  '99/9',
  '5',
  'นาง',
  'แม่',
  'นามสมมติ',
  'รับจ้าง',
  'มารดา',
  'นาย',
  'พ่อ',
  'นามสมมติ',
  'รับจ้าง',
  'นาง',
  'แม่',
  'นามสมมติ',
  'รับจ้าง',
  'เด็กยากจน', // ตัวอย่างค่า "ความด้อยโอกาส" — เว้นว่างได้ถ้าไม่มี
]

/** สร้างและดาวน์โหลด Excel template (รวมหัวตารางและตัวอย่าง 1 แถว) */
export async function downloadStudentTemplate(): Promise<void> {
  const xlsx = await import('xlsx')

  // หัวตาราง: row 0 = title, row 1 = comment, row 2 = headers (ให้ตรงกับที่ student-import.ts ตรวจ)
  // ตาม student-import.ts: findHeaderRowIndex ค้นหา row ที่ title col3='คำนำหน้าชื่อ', col1='ชั้น' ฯลฯ
  // ดังนั้นเราต้องให้หัวตารางตรงกับ index ที่กำหนด — ใส่ในแถวเดียว ส่วนแถวก่อนหน้าเป็น instructions ก็ได้
  const disadvantageNote = `"ความด้อยโอกาส" ใช้ค่ามาตรฐาน: ${DISADVANTAGE_OPTIONS.join(' / ')} — ถ้ากรอกค่าอื่น ระบบจะจัดเป็น "อื่นๆ" ให้อัตโนมัติ`

  const data: (string | number)[][] = [
    ['ตัวอย่างไฟล์นำเข้านักเรียน — กรอกข้อมูลด้านล่างแล้ว import ในแอป'],
    [
      'แต่ละแถวคือนักเรียน 1 คน · ลบแถวตัวอย่างก่อน import · "ชั้น" จะถูกใช้สร้างห้องอัตโนมัติ',
    ],
    [disadvantageNote],
    [],
    TEMPLATE_HEADERS,
    SAMPLE_ROW,
  ]

  const ws = xlsx.utils.aoa_to_sheet(data)

  // ตั้งความกว้างคอลัมน์ให้พออ่านได้
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }))

  // Merge title row + note rows ให้พาด column เต็มไปจนหมด headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: TEMPLATE_HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: TEMPLATE_HEADERS.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: TEMPLATE_HEADERS.length - 1 } },
  ]

  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, 'นักเรียน')
  xlsx.writeFile(wb, 'template_นำเข้านักเรียน.xlsx')
}
