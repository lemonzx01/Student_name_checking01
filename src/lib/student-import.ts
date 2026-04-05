import { ImportedStudentInput, StudentSourcePayload } from '@/types'

const COLUMN_INDEX = {
  national_id: 0,
  classroom_label: 1,
  student_number: 2,
  title: 3,
  first_name: 4,
  last_name: 5,
  birth_date: 6,
  age_years: 7,
  weight_kg: 8,
  height_cm: 9,
  house_no: 10,
  village_no: 11,
  guardian_title: 12,
  guardian_first_name: 13,
  guardian_last_name: 14,
  guardian_occupation: 15,
  guardian_relation: 16,
  father_title: 17,
  father_first_name: 18,
  father_last_name: 19,
  father_occupation: 20,
  mother_title: 21,
  mother_first_name: 22,
  mother_last_name: 23,
  mother_occupation: 24,
  disadvantage: 25,
} as const

const SOURCE_LABELS = [
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

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseOptionalNumber(value: unknown): number | null {
  const normalized = normalizeText(value).replace(/,/g, '')
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function inferGender(title: string): string {
  if (title.includes('หญิง')) {
    return 'หญิง'
  }
  if (title.includes('ชาย')) {
    return 'ชาย'
  }
  return ''
}

function findHeaderRowIndex(rows: unknown[][]): number {
  return rows.findIndex((row) => {
    const title = normalizeText(row[COLUMN_INDEX.title])
    const firstName = normalizeText(row[COLUMN_INDEX.first_name])
    const lastName = normalizeText(row[COLUMN_INDEX.last_name])
    const classroom = normalizeText(row[COLUMN_INDEX.classroom_label])

    return title === 'คำนำหน้าชื่อ' && firstName === 'ชื่อ' && lastName === 'นามสกุล' && classroom === 'ชั้น'
  })
}

function buildSourcePayload(row: unknown[]): StudentSourcePayload {
  return SOURCE_LABELS.reduce<StudentSourcePayload>((acc, label, index) => {
    acc[label] = normalizeText(row[index])
    return acc
  }, {})
}

export function extractImportedStudents(rows: unknown[][]): ImportedStudentInput[] {
  const headerRowIndex = findHeaderRowIndex(rows)

  if (headerRowIndex === -1) {
    throw new Error('ไม่พบหัวตารางนักเรียนในไฟล์ Excel')
  }

  const records = rows.slice(headerRowIndex + 1)
  const students: ImportedStudentInput[] = []

  records.forEach((row) => {
    const classroomLabel = normalizeText(row[COLUMN_INDEX.classroom_label])
    const firstName = normalizeText(row[COLUMN_INDEX.first_name])
    const lastName = normalizeText(row[COLUMN_INDEX.last_name])
    const title = normalizeText(row[COLUMN_INDEX.title])
    const studentNumber = normalizeText(row[COLUMN_INDEX.student_number])
    const nationalId = normalizeText(row[COLUMN_INDEX.national_id])
    const studentId = studentNumber || nationalId

    const isBlankRow = !classroomLabel && !firstName && !lastName && !studentId
    if (isBlankRow) {
      return
    }

    if (!studentId || !classroomLabel || !firstName || !lastName) {
      return
    }

    students.push({
      student_id: studentId,
      national_id: nationalId || null,
      student_number: studentNumber || null,
      title: title || null,
      first_name: firstName,
      last_name: lastName,
      classroom_id: 0,
      classroom_label: classroomLabel,
      gender: inferGender(title),
      birth_date: normalizeText(row[COLUMN_INDEX.birth_date]) || null,
      age_years: normalizeText(row[COLUMN_INDEX.age_years]) || null,
      weight_kg: parseOptionalNumber(row[COLUMN_INDEX.weight_kg]),
      height_cm: parseOptionalNumber(row[COLUMN_INDEX.height_cm]),
      house_no: normalizeText(row[COLUMN_INDEX.house_no]) || null,
      village_no: normalizeText(row[COLUMN_INDEX.village_no]) || null,
      guardian_title: normalizeText(row[COLUMN_INDEX.guardian_title]) || null,
      guardian_first_name: normalizeText(row[COLUMN_INDEX.guardian_first_name]) || null,
      guardian_last_name: normalizeText(row[COLUMN_INDEX.guardian_last_name]) || null,
      guardian_occupation: normalizeText(row[COLUMN_INDEX.guardian_occupation]) || null,
      guardian_relation: normalizeText(row[COLUMN_INDEX.guardian_relation]) || null,
      father_title: normalizeText(row[COLUMN_INDEX.father_title]) || null,
      father_first_name: normalizeText(row[COLUMN_INDEX.father_first_name]) || null,
      father_last_name: normalizeText(row[COLUMN_INDEX.father_last_name]) || null,
      father_occupation: normalizeText(row[COLUMN_INDEX.father_occupation]) || null,
      mother_title: normalizeText(row[COLUMN_INDEX.mother_title]) || null,
      mother_first_name: normalizeText(row[COLUMN_INDEX.mother_first_name]) || null,
      mother_last_name: normalizeText(row[COLUMN_INDEX.mother_last_name]) || null,
      mother_occupation: normalizeText(row[COLUMN_INDEX.mother_occupation]) || null,
      disadvantage: normalizeText(row[COLUMN_INDEX.disadvantage]) || null,
      source_payload: buildSourcePayload(row),
    })
  })

  if (students.length === 0) {
    throw new Error('ไม่พบข้อมูลนักเรียนที่พร้อมนำเข้าในไฟล์นี้')
  }

  return students
}
