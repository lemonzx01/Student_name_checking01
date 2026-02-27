// In-memory database for web mode
// Uses globalThis to persist data across Next.js HMR (hot module replacement)
// Actual production data is managed by Electron's SQLite via electron/main.js

interface Classroom {
  id: number
  name: string
  level: string
  academic_year: string
  created_at: string
  student_count?: number
}

interface Student {
  id: number
  student_id: string
  first_name: string
  last_name: string
  classroom_id: number
  gender: string
  birth_date?: string
  is_active: number
  created_at: string
  classroom_name?: string
}

// Schedule storage
interface ScheduleItem {
  classroom_id: number
  day_of_week: number
  period: number
  subject_code: string
  subject_name: string
  class_level: string
  room: string
}

// Attendance storage
interface AttendanceEntry {
  student_id: number
  classroom_id: number
  date: string
  status: string
  note: string
}

// Health storage
interface HealthEntry {
  student_id: number
  classroom_id: number
  date: string
  brushed_teeth: boolean
  drank_milk: boolean
}

// Grade storage
interface GradeEntry {
  student_id: number
  subject_code: string
  score: number
  classroom_id: number
  semester: number
  academic_year: string
}

// ─── Persist all stores on globalThis so HMR doesn't wipe data ───
interface DbStore {
  classrooms: Classroom[]
  students: Student[]
  schedules: ScheduleItem[]
  attendanceStore: AttendanceEntry[]
  healthStore: HealthEntry[]
  gradesStore: GradeEntry[]
  nextClassroomId: number
  nextStudentId: number
}

const g = globalThis as unknown as { __db?: DbStore }
if (!g.__db) {
  g.__db = {
    classrooms: [],
    students: [],
    schedules: [],
    attendanceStore: [],
    healthStore: [],
    gradesStore: [],
    nextClassroomId: 1,
    nextStudentId: 1,
  }
}
const db = g.__db

export function getAllClassrooms(): Classroom[] {
  return db.classrooms.map(c => ({
    ...c,
    student_count: db.students.filter(s => s.classroom_id === c.id && s.is_active === 1).length
  }))
}

export function createClassroom(name: string, level: string, academicYear: string): Classroom {
  const classroom: Classroom = {
    id: db.nextClassroomId++,
    name,
    level,
    academic_year: academicYear,
    created_at: new Date().toISOString(),
    student_count: 0
  }
  db.classrooms.push(classroom)
  return classroom
}

export function deleteClassroom(id: number): void {
  db.classrooms = db.classrooms.filter(c => c.id !== id)
  // Cascade delete associated data
  db.students = db.students.filter(s => s.classroom_id !== id)
  db.schedules = db.schedules.filter(s => s.classroom_id !== id)
  db.gradesStore = db.gradesStore.filter(g => g.classroom_id !== id)
  db.attendanceStore = db.attendanceStore.filter(a => a.classroom_id !== id)
  db.healthStore = db.healthStore.filter(h => h.classroom_id !== id)
}

export function updateClassroom(id: number, data: { name?: string; level?: string; academic_year?: string }): void {
  const index = db.classrooms.findIndex(c => c.id === id)
  if (index !== -1) {
    db.classrooms[index] = { ...db.classrooms[index], ...data }
  }
}

export function getStudentsByClassroom(classroomId: number): Student[] {
  return db.students
    .filter(s => s.classroom_id === classroomId && s.is_active === 1)
    .map(s => ({
      ...s,
      classroom_name: db.classrooms.find(c => c.id === s.classroom_id)?.name || ''
    }))
}

export function getAllStudents(): Student[] {
  return db.students
    .filter(s => s.is_active === 1)
    .map(s => ({
      ...s,
      classroom_name: db.classrooms.find(c => c.id === s.classroom_id)?.name || ''
    }))
}

export function createStudent(data: {
  student_id: string
  first_name: string
  last_name: string
  classroom_id: number
  gender: string
  birth_date?: string
}): Student {
  const student: Student = {
    id: db.nextStudentId++,
    ...data,
    is_active: 1,
    created_at: new Date().toISOString()
  }
  db.students.push(student)
  return student
}

export function updateStudent(id: number, data: Partial<Student>): void {
  const index = db.students.findIndex(s => s.id === id)
  if (index !== -1) {
    db.students[index] = { ...db.students[index], ...data }
  }
}

export function deleteStudent(id: number): void {
  const index = db.students.findIndex(s => s.id === id)
  if (index !== -1) {
    db.students[index].is_active = 0
  }
}

export function getScheduleByClassroom(classroomId: number): ScheduleItem[] {
  return db.schedules.filter(s => s.classroom_id === classroomId)
}

export function saveSchedule(classroomId: number, items: ScheduleItem[]): void {
  db.schedules = db.schedules.filter(s => s.classroom_id !== classroomId)
  db.schedules.push(...items)
}

export function getGradesByClassroom(classroomId: number, semester: number, year: string): GradeEntry[] {
  return db.gradesStore.filter(
    g => g.classroom_id === classroomId && g.semester === semester && g.academic_year === year
  )
}

export function saveGrades(classroomId: number, semester: number, year: string, entries: GradeEntry[]): void {
  db.gradesStore = db.gradesStore.filter(
    g => !(g.classroom_id === classroomId && g.semester === semester && g.academic_year === year)
  )
  db.gradesStore.push(...entries)
}

// Attendance functions
export function getAttendanceByClassroom(classroomId: number, date: string): AttendanceEntry[] {
  return db.attendanceStore.filter(a => a.classroom_id === classroomId && a.date === date)
}

export function getAttendanceByClassroomRange(classroomId: number, startDate: string, endDate: string): AttendanceEntry[] {
  return db.attendanceStore.filter(a => a.classroom_id === classroomId && a.date >= startDate && a.date <= endDate)
}

export function getAllAttendanceByClassroom(classroomId: number): AttendanceEntry[] {
  return db.attendanceStore.filter(a => a.classroom_id === classroomId)
}

export function saveAttendance(classroomId: number, date: string, entries: AttendanceEntry[]): void {
  db.attendanceStore = db.attendanceStore.filter(a => !(a.classroom_id === classroomId && a.date === date))
  db.attendanceStore.push(...entries)
}

// Health functions
export function getHealthByClassroom(classroomId: number, date: string): HealthEntry[] {
  return db.healthStore.filter(h => h.classroom_id === classroomId && h.date === date)
}

export function getHealthByClassroomRange(classroomId: number, startDate: string, endDate: string): HealthEntry[] {
  return db.healthStore.filter(h => h.classroom_id === classroomId && h.date >= startDate && h.date <= endDate)
}

export function getAllHealthByClassroom(classroomId: number): HealthEntry[] {
  return db.healthStore.filter(h => h.classroom_id === classroomId)
}

export function saveHealth(classroomId: number, date: string, entries: HealthEntry[]): void {
  db.healthStore = db.healthStore.filter(h => !(h.classroom_id === classroomId && h.date === date))
  db.healthStore.push(...entries)
}

// Clear all data
export function clearAllData(): { success: boolean } {
  db.classrooms = []
  db.students = []
  db.schedules = []
  db.attendanceStore = []
  db.healthStore = []
  db.gradesStore = []
  db.nextClassroomId = 1
  db.nextStudentId = 1
  return { success: true }
}

// Export all data
export function exportAllData() {
  return {
    classrooms: getAllClassrooms(),
    students: getAllStudents(),
    schedule: db.schedules,
    grades: db.gradesStore,
    attendance: db.attendanceStore,
    health_check: db.healthStore,
    exported_at: new Date().toISOString(),
    version: '1.0'
  }
}

// Import data
export function importData(data: {
  classrooms?: Classroom[]
  students?: Student[]
  schedule?: ScheduleItem[]
  grades?: any[]
  attendance?: any[]
  health_check?: any[]
}): { success: boolean; error?: string } {
  try {
    if (data.classrooms) {
      db.classrooms = data.classrooms
      db.nextClassroomId = Math.max(...db.classrooms.map(c => c.id), 0) + 1
    }
    if (data.students) {
      db.students = data.students.map(s => ({ ...s, is_active: s.is_active ?? 1 }))
      db.nextStudentId = Math.max(...db.students.map(s => s.id), 0) + 1
    }
    if (data.schedule) {
      db.schedules = data.schedule
    }
    if (data.grades) {
      db.gradesStore = data.grades
    }
    if (data.attendance) {
      db.attendanceStore = data.attendance
    }
    if (data.health_check) {
      db.healthStore = data.health_check
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
