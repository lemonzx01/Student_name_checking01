export interface Classroom {
  id: number
  name: string
  level: string
  academic_year: string
  color?: string | null
  created_at: string
  archived_at?: string | null
  student_count?: number
}

export const CLASSROOM_COLORS = [
  { value: 'blue', label: 'น้ำเงิน', bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
  { value: 'violet', label: 'ม่วง', bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600' },
  { value: 'emerald', label: 'เขียว', bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { value: 'orange', label: 'ส้ม', bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600' },
  { value: 'pink', label: 'ชมพู', bg: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-600' },
  { value: 'indigo', label: 'คราม', bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
  { value: 'red', label: 'แดง', bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-600' },
  { value: 'amber', label: 'เหลือง', bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
  { value: 'teal', label: 'เขียวน้ำทะเล', bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-600' },
  { value: 'cyan', label: 'ฟ้า', bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-600' },
] as const

export function getClassroomColor(classroom: Classroom) {
  const found = CLASSROOM_COLORS.find((c) => c.value === classroom.color)
  if (found) return found
  // fallback: auto by id
  return CLASSROOM_COLORS[classroom.id % CLASSROOM_COLORS.length]
}

export interface StudentSourcePayload {
  [key: string]: string
}

export interface Student {
  id: number
  student_id: string
  national_id?: string | null
  student_number?: string | null
  title?: string | null
  first_name: string
  last_name: string
  classroom_id: number
  classroom_name?: string
  classroom_label?: string | null
  gender: string
  birth_date?: string | null
  age_years?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  house_no?: string | null
  village_no?: string | null
  guardian_title?: string | null
  guardian_first_name?: string | null
  guardian_last_name?: string | null
  guardian_occupation?: string | null
  guardian_relation?: string | null
  guardian_phone?: string | null
  father_title?: string | null
  father_first_name?: string | null
  father_last_name?: string | null
  father_occupation?: string | null
  mother_title?: string | null
  mother_first_name?: string | null
  mother_last_name?: string | null
  mother_occupation?: string | null
  disadvantage?: string | null
  source_payload?: StudentSourcePayload | null
  photo_path?: string | null
  deleted_at?: string | null
  is_active: number
  created_at: string
}

export type AttendanceStatus = 'มา' | 'ขาด' | 'ลาป่วย' | 'ลากิจ'

export interface AttendanceRow {
  id: number
  student_id: number
  classroom_id: number
  date: string
  status: AttendanceStatus
  note: string
}

export interface AttendanceRecord {
  id: number
  student_id: string
  first_name: string
  last_name: string
  student_number?: string | null
  title?: string | null
  photo_path?: string | null
  guardian_phone?: string | null
  status: AttendanceStatus
  note: string
}

export interface StudentFormInput {
  student_id: string
  national_id?: string | null
  student_number?: string | null
  title?: string | null
  first_name: string
  last_name: string
  classroom_id: number
  classroom_label?: string | null
  gender: string
  birth_date?: string | null
  age_years?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  house_no?: string | null
  village_no?: string | null
  guardian_title?: string | null
  guardian_first_name?: string | null
  guardian_last_name?: string | null
  guardian_occupation?: string | null
  guardian_relation?: string | null
  guardian_phone?: string | null
  father_title?: string | null
  father_first_name?: string | null
  father_last_name?: string | null
  father_occupation?: string | null
  mother_title?: string | null
  mother_first_name?: string | null
  mother_last_name?: string | null
  mother_occupation?: string | null
  disadvantage?: string | null
  source_payload?: StudentSourcePayload | null
  photo_path?: string | null
}

export interface ImportedStudentInput extends StudentFormInput {}

export interface ImportStudentsResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  classroomsCreated: number
  error?: string
}

export interface ScheduleItem {
  classroom_id: number
  day_of_week: number
  period: number
  subject_code: string
  subject_name: string
  class_level: string
  room: string
}

export interface GradeEntry {
  student_id: number
  subject_code: string
  score: number
  midterm_score: number
  final_score: number
  classroom_id: number
  semester: number
  academic_year: string
}

export interface StudentNote {
  id: number
  student_id: number
  date: string
  note: string
  created_at?: string
}

export interface HealthEntry {
  student_id: number
  classroom_id: number
  date: string
  brushed_teeth: boolean
  drank_milk: boolean
  weight_kg?: number | null
  height_cm?: number | null
}

export function calculateBmi(weight: number, height: number): { bmi: number; status: string } {
  if (!weight || !height || height <= 0) return { bmi: 0, status: '' }
  const heightInMeters = height / 100
  const bmi = Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10
  if (bmi < 18.5) return { bmi, status: 'ผอม' }
  if (bmi < 23) return { bmi, status: 'ปกติ' }
  if (bmi < 25) return { bmi, status: 'น้ำหนักเกิน' }
  if (bmi < 30) return { bmi, status: 'อ้วน' }
  return { bmi, status: 'อ้วนมาก' }
}

export interface SubjectDef {
  code: string
  name: string
  color: string
}

export const DEFAULT_SUBJECTS: SubjectDef[] = [
  { code: 'TH', name: 'ภาษาไทย', color: '#3B82F6' },
  { code: 'MA', name: 'คณิตศาสตร์', color: '#EF4444' },
  { code: 'SC', name: 'วิทยาศาสตร์', color: '#10B981' },
  { code: 'SO', name: 'สังคมศึกษา', color: '#F59E0B' },
  { code: 'EN', name: 'ภาษาอังกฤษ', color: '#8B5CF6' },
  { code: 'HE', name: 'สุขศึกษา', color: '#EC4899' },
  { code: 'AR', name: 'ศิลปะ', color: '#06B6D4' },
  { code: 'WO', name: 'การงานอาชีพ', color: '#84CC16' },
  { code: 'PE', name: 'พลศึกษา', color: '#F97316' },
]

export function calculateGrade(score: number): string {
  if (score >= 80) return '4'
  if (score >= 75) return '3.5'
  if (score >= 70) return '3'
  if (score >= 65) return '2.5'
  if (score >= 60) return '2'
  if (score >= 55) return '1.5'
  if (score >= 50) return '1'
  return '0'
}

// ─── Sprint 3: Grade Items (คะแนนเก็บระหว่างภาค) ─────────────
export type GradeItemCategory = 'formative' | 'midterm' | 'final' | 'observation'

export interface GradeItem {
  id: number
  classroom_id: number
  subject_code: string
  semester: number
  academic_year: string
  item_name: string
  full_score: number
  weight: number
  category: GradeItemCategory
  display_order: number
  created_at?: string
}

export interface GradeItemScore {
  id?: number
  grade_item_id: number
  student_id: number
  score: number | null
  note?: string
}

export const GRADE_ITEM_CATEGORIES: { value: GradeItemCategory; label: string; color: string }[] = [
  { value: 'formative', label: 'คะแนนเก็บ', color: '#3B82F6' },
  { value: 'midterm', label: 'กลางภาค', color: '#F59E0B' },
  { value: 'final', label: 'ปลายภาค', color: '#EF4444' },
  { value: 'observation', label: 'พฤติกรรม', color: '#10B981' },
]

// ─── Sprint 3: Student Evaluations (คุณลักษณะ + อ่าน/คิด/เขียน) ─────────────
export type EvaluationCategory = 'character' | 'literacy'

export interface StudentEvaluation {
  id?: number
  student_id: number
  classroom_id: number
  semester: number
  academic_year: string
  category: EvaluationCategory
  item_code: string
  level: number // 0=ปรับปรุง, 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม
  note?: string
}

export const CHARACTER_ITEMS = [
  { code: 'love_nation', name: 'รักชาติ ศาสน์ กษัตริย์' },
  { code: 'honest', name: 'ซื่อสัตย์สุจริต' },
  { code: 'discipline', name: 'มีวินัย' },
  { code: 'studious', name: 'ใฝ่เรียนรู้' },
  { code: 'frugal', name: 'อยู่อย่างพอเพียง' },
  { code: 'dedicated', name: 'มุ่งมั่นในการทำงาน' },
  { code: 'thai_nationalism', name: 'รักความเป็นไทย' },
  { code: 'sufficiency', name: 'มีจิตสาธารณะ' },
] as const

export const LITERACY_ITEMS = [
  { code: 'reading', name: 'อ่าน' },
  { code: 'thinking', name: 'คิดวิเคราะห์' },
  { code: 'writing', name: 'เขียน' },
] as const

export const EVAL_LEVELS = [
  { value: 0, label: 'ปรับปรุง', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  { value: 1, label: 'ผ่าน', color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  { value: 2, label: 'ดี', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  { value: 3, label: 'ดีเยี่ยม', color: 'green', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
] as const

export function evalLevelLabel(level: number): string {
  return EVAL_LEVELS.find((l) => l.value === level)?.label ?? '-'
}
