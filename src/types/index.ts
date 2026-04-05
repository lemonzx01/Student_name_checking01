export interface Classroom {
  id: number
  name: string
  level: string
  academic_year: string
  created_at: string
  student_count?: number
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
  is_active: number
  created_at: string
}

export type AttendanceStatus = 'มา' | 'ขาด' | 'ลา' | 'สาย'

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
  classroom_id: number
  semester: number
  academic_year: string
}

export interface HealthEntry {
  student_id: number
  classroom_id: number
  date: string
  brushed_teeth: boolean
  drank_milk: boolean
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
