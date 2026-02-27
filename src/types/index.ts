export interface Classroom {
  id: number
  name: string
  level: string
  academic_year: string
  created_at: string
  student_count?: number
}

export interface Student {
  id: number
  student_id: string
  first_name: string
  last_name: string
  classroom_id: number
  gender: 'ชาย' | 'หญิง'
  birth_date: string
  is_active: number
  created_at: string
  classroom_name?: string
}

export interface Attendance {
  id: number
  student_id: number
  date: string
  status: 'มา' | 'ขาด' | 'ลา' | 'สาย'
  note: string
  created_at: string
}

export interface HealthCheck {
  id: number
  student_id: number
  date: string
  brushed_teeth: number
  drank_milk: number
  note: string
}

export interface Grade {
  id: number
  student_id: number
  subject: string
  semester: number
  academic_year: string
  score: number
  created_at: string
}

export interface Subject {
  id: number
  name: string
  code: string
  color: string
}

export interface Schedule {
  id: number
  classroom_id: number
  day_of_week: number
  period: number
  subject_code: string
  subject_name: string
  class_level: string
  room: string
}

// Grade calculation
export function calculateGrade(score: number): number {
  if (score >= 80) return 4.0
  if (score >= 75) return 3.5
  if (score >= 70) return 3.0
  if (score >= 65) return 2.5
  if (score >= 60) return 2.0
  if (score >= 55) return 1.5
  if (score >= 50) return 1.0
  return 0.0
}

// Default subjects
export const DEFAULT_SUBJECTS = [
  { id: 1, name: 'ภาษาไทย', code: 'TH', color: '#3B82F6' },
  { id: 2, name: 'คณิตศาสตร์', code: 'MATH', color: '#10B981' },
  { id: 3, name: 'วิทยาศาสตร์', code: 'SCI', color: '#F59E0B' },
  { id: 4, name: 'สังคมศึกษา', code: 'SOC', color: '#8B5CF6' },
  { id: 5, name: 'ประวัติศาสตร์', code: 'HIS', color: '#EC4899' },
  { id: 6, name: 'สุขศึกษา', code: 'PE', color: '#14B8A6' },
  { id: 7, name: 'ศิลปะ', code: 'ART', color: '#F97316' },
  { id: 8, name: 'การงานอาชีพ', code: 'WORK', color: '#6366F1' },
  { id: 9, name: 'ภาษาอังกฤษ', code: 'ENG', color: '#EF4444' },
]
