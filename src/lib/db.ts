import {
  AttendanceRecord,
  AttendanceRow,
  AttendanceStatus,
  Classroom,
  GradeEntry,
  HealthEntry,
  ImportedStudentInput,
  ImportStudentsResult,
  ScheduleItem,
  Student,
  StudentFormInput,
} from '@/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3')
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (db) return db

  const dbPath = path.join(process.cwd(), 'school.db')
  console.log('[DB] Opening SQLite:', dbPath)
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      national_id TEXT,
      student_number TEXT,
      title TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      classroom_id INTEGER NOT NULL,
      classroom_label TEXT,
      gender TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      age_years TEXT,
      weight_kg REAL,
      height_cm REAL,
      house_no TEXT,
      village_no TEXT,
      guardian_title TEXT,
      guardian_first_name TEXT,
      guardian_last_name TEXT,
      guardian_occupation TEXT,
      guardian_relation TEXT,
      father_title TEXT,
      father_first_name TEXT,
      father_last_name TEXT,
      father_occupation TEXT,
      mother_title TEXT,
      mother_first_name TEXT,
      mother_last_name TEXT,
      mother_occupation TEXT,
      disadvantage TEXT,
      source_payload TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      classroom_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'มา',
      note TEXT DEFAULT '',
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period INTEGER NOT NULL,
      subject_code TEXT NOT NULL DEFAULT '',
      subject_name TEXT NOT NULL DEFAULT '',
      class_level TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      classroom_id INTEGER NOT NULL,
      subject_code TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS health_check (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      classroom_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      brushed_teeth INTEGER DEFAULT 0,
      drank_milk INTEGER DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON attendance(classroom_id, date);
    CREATE INDEX IF NOT EXISTS idx_health_classroom_date ON health_check(classroom_id, date);
    CREATE INDEX IF NOT EXISTS idx_grades_classroom ON grades(classroom_id, semester, academic_year);
    CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON schedules(classroom_id);
  `)

  console.log('[DB] Initialized successfully')
  return db
}

function getCurrentAcademicYear(): string {
  return String(new Date().getFullYear() + 543)
}

function inferLevel(name: string): string {
  if (name.startsWith('ป.')) return 'ประถมศึกษา'
  if (name.startsWith('ม.')) return 'มัธยมศึกษา'
  if (name.includes('อนุบาล')) return 'อนุบาล'
  return 'ห้องเรียน'
}

function sortStudents(a: Student, b: Student): number {
  const left = Number(a.student_number || a.student_id)
  const right = Number(b.student_number || b.student_id)
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right
  return (a.student_number || a.student_id).localeCompare(b.student_number || b.student_id, 'th')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStudent(row: any): Student {
  return {
    ...row,
    source_payload: row.source_payload ? JSON.parse(row.source_payload) : null,
    classroom_name: row.classroom_name ?? '',
  }
}

// ─── Classrooms ──────────────────────────────────────────────

export function getAllClassrooms(): Classroom[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, COUNT(s.id) as student_count
       FROM classrooms c
       LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    )
    .all()
  return rows
}

export function createClassroom(name: string, level: string, academicYear: string): Classroom {
  const d = getDb()
  const trimmedName = name.trim()
  const existing = d.prepare('SELECT * FROM classrooms WHERE name = ?').get(trimmedName)
  if (existing) return existing

  const result = d
    .prepare('INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)')
    .run(trimmedName, level.trim(), academicYear.trim())

  return d.prepare('SELECT * FROM classrooms WHERE id = ?').get(result.lastInsertRowid)
}

export function updateClassroom(
  id: number,
  data: { name?: string; level?: string; academic_year?: string }
): void {
  const d = getDb()
  const current = d.prepare('SELECT * FROM classrooms WHERE id = ?').get(id)
  if (!current) return

  d.prepare('UPDATE classrooms SET name = ?, level = ?, academic_year = ? WHERE id = ?').run(
    data.name ?? current.name,
    data.level ?? current.level,
    data.academic_year ?? current.academic_year,
    id
  )
}

export function deleteClassroom(id: number): void {
  const d = getDb()
  const studentIds = d
    .prepare('SELECT id FROM students WHERE classroom_id = ?')
    .all(id)
    .map((r: { id: number }) => r.id)

  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => '?').join(',')
    d.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...studentIds)
    d.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...studentIds)
    d.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...studentIds)
  }
  d.prepare('DELETE FROM students WHERE classroom_id = ?').run(id)
  d.prepare('DELETE FROM schedules WHERE classroom_id = ?').run(id)
  d.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
}

// ─── Students ────────────────────────────────────────────────

export function getStudentsByClassroom(classroomId: number): Student[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, c.name as classroom_name
       FROM students s
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE s.classroom_id = ? AND s.is_active = 1`
    )
    .all(classroomId)
  return rows.map(rowToStudent).sort(sortStudents)
}

export function getAllStudents(): Student[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, c.name as classroom_name
       FROM students s
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE s.is_active = 1
       ORDER BY c.name, s.student_id`
    )
    .all()
  return rows.map(rowToStudent)
}

export function createStudent(data: StudentFormInput): Student {
  const d = getDb()
  const classroom = d.prepare('SELECT name FROM classrooms WHERE id = ?').get(data.classroom_id) as { name: string } | undefined

  const result = d
    .prepare(
      `INSERT INTO students (
        student_id, national_id, student_number, title,
        first_name, last_name, classroom_id, classroom_label,
        gender, birth_date, age_years, weight_kg, height_cm,
        house_no, village_no,
        guardian_title, guardian_first_name, guardian_last_name,
        guardian_occupation, guardian_relation,
        father_title, father_first_name, father_last_name, father_occupation,
        mother_title, mother_first_name, mother_last_name, mother_occupation,
        disadvantage, source_payload
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )`
    )
    .run(
      data.student_id,
      data.national_id ?? null,
      data.student_number ?? data.student_id,
      data.title ?? null,
      data.first_name,
      data.last_name,
      data.classroom_id,
      data.classroom_label ?? classroom?.name ?? '',
      data.gender || '',
      data.birth_date ?? null,
      data.age_years ?? null,
      data.weight_kg ?? null,
      data.height_cm ?? null,
      data.house_no ?? null,
      data.village_no ?? null,
      data.guardian_title ?? null,
      data.guardian_first_name ?? null,
      data.guardian_last_name ?? null,
      data.guardian_occupation ?? null,
      data.guardian_relation ?? null,
      data.father_title ?? null,
      data.father_first_name ?? null,
      data.father_last_name ?? null,
      data.father_occupation ?? null,
      data.mother_title ?? null,
      data.mother_first_name ?? null,
      data.mother_last_name ?? null,
      data.mother_occupation ?? null,
      data.disadvantage ?? null,
      data.source_payload ? JSON.stringify(data.source_payload) : null
    )

  const row = d.prepare(
    `SELECT s.*, c.name as classroom_name
     FROM students s
     LEFT JOIN classrooms c ON c.id = s.classroom_id
     WHERE s.id = ?`
  ).get(result.lastInsertRowid)
  return rowToStudent(row)
}

export function updateStudent(id: number, data: Partial<StudentFormInput>): void {
  const d = getDb()
  const current = d.prepare('SELECT * FROM students WHERE id = ?').get(id)
  if (!current) return

  d.prepare(
    `UPDATE students SET
      student_id = ?, national_id = ?, student_number = ?, title = ?,
      first_name = ?, last_name = ?, classroom_id = ?, classroom_label = ?,
      gender = ?, birth_date = ?, age_years = ?, weight_kg = ?, height_cm = ?,
      house_no = ?, village_no = ?,
      guardian_title = ?, guardian_first_name = ?, guardian_last_name = ?,
      guardian_occupation = ?, guardian_relation = ?,
      father_title = ?, father_first_name = ?, father_last_name = ?, father_occupation = ?,
      mother_title = ?, mother_first_name = ?, mother_last_name = ?, mother_occupation = ?,
      disadvantage = ?, source_payload = ?
    WHERE id = ?`
  ).run(
    data.student_id ?? current.student_id,
    data.national_id ?? current.national_id,
    data.student_number ?? current.student_number,
    data.title ?? current.title,
    data.first_name ?? current.first_name,
    data.last_name ?? current.last_name,
    data.classroom_id ?? current.classroom_id,
    data.classroom_label ?? current.classroom_label,
    data.gender ?? current.gender,
    data.birth_date ?? current.birth_date,
    data.age_years ?? current.age_years,
    data.weight_kg ?? current.weight_kg,
    data.height_cm ?? current.height_cm,
    data.house_no ?? current.house_no,
    data.village_no ?? current.village_no,
    data.guardian_title ?? current.guardian_title,
    data.guardian_first_name ?? current.guardian_first_name,
    data.guardian_last_name ?? current.guardian_last_name,
    data.guardian_occupation ?? current.guardian_occupation,
    data.guardian_relation ?? current.guardian_relation,
    data.father_title ?? current.father_title,
    data.father_first_name ?? current.father_first_name,
    data.father_last_name ?? current.father_last_name,
    data.father_occupation ?? current.father_occupation,
    data.mother_title ?? current.mother_title,
    data.mother_first_name ?? current.mother_first_name,
    data.mother_last_name ?? current.mother_last_name,
    data.mother_occupation ?? current.mother_occupation,
    data.disadvantage ?? current.disadvantage,
    data.source_payload ? JSON.stringify(data.source_payload) : current.source_payload,
    id
  )
}

export function deleteStudent(id: number): void {
  getDb().prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id)
}

// ─── Attendance ──────────────────────────────────────────────

export function getAttendanceByClassroom(classroomId: number, date: string): AttendanceRecord[] {
  const students = getStudentsByClassroom(classroomId)
  const d = getDb()
  const attendanceRows = d
    .prepare('SELECT * FROM attendance WHERE classroom_id = ? AND date = ?')
    .all(classroomId, date)
  const attendanceMap = new Map<number, { status: string; note: string }>()
  attendanceRows.forEach((row: { student_id: number; status: string; note: string }) => {
    attendanceMap.set(row.student_id, row)
  })

  return students.map((student) => {
    const att = attendanceMap.get(student.id)
    return {
      id: student.id,
      student_id: student.student_id,
      student_number: student.student_number,
      title: student.title,
      first_name: student.first_name,
      last_name: student.last_name,
      status: (att?.status as AttendanceStatus) ?? 'มา',
      note: att?.note ?? '',
    }
  })
}

export function saveAttendance(
  classroomId: number,
  date: string,
  rows: Array<{ student_id: number; status: AttendanceStatus; note?: string }>
): void {
  const d = getDb()
  const deleteStmt = d.prepare('DELETE FROM attendance WHERE classroom_id = ? AND date = ?')
  const insertStmt = d.prepare(
    'INSERT INTO attendance (student_id, classroom_id, date, status, note) VALUES (?, ?, ?, ?, ?)'
  )

  const transaction = d.transaction(() => {
    deleteStmt.run(classroomId, date)
    for (const row of rows) {
      insertStmt.run(row.student_id, classroomId, date, row.status, row.note ?? '')
    }
  })
  transaction()
}

// ─── Import ──────────────────────────────────────────────────

function ensureClassroomByLabel(
  label: string,
  academicYear?: string
): { classroom: Classroom; created: boolean } {
  const d = getDb()
  const existing = d.prepare('SELECT * FROM classrooms WHERE name = ?').get(label)
  if (existing) return { classroom: existing, created: false }

  const classroom = createClassroom(label, inferLevel(label), academicYear ?? getCurrentAcademicYear())
  return { classroom, created: true }
}

export function importStudents(students: ImportedStudentInput[], academicYear?: string): ImportStudentsResult {
  const d = getDb()
  let imported = 0
  let updated = 0
  let skipped = 0
  let classroomsCreated = 0

  const transaction = d.transaction(() => {
    for (const entry of students) {
      if (!entry.student_id || !entry.first_name || !entry.last_name || !entry.classroom_label) {
        skipped += 1
        continue
      }

      const { classroom, created } = ensureClassroomByLabel(entry.classroom_label, academicYear)
      if (created) classroomsCreated += 1

      const existing = d.prepare('SELECT * FROM students WHERE student_id = ?').get(entry.student_id)

      if (!existing) {
        createStudent({
          ...entry,
          classroom_id: classroom.id,
          classroom_label: classroom.name,
        })
        imported += 1
      } else {
        d.prepare(
          `UPDATE students SET
            national_id = ?, student_number = ?, title = ?,
            first_name = ?, last_name = ?, classroom_id = ?, classroom_label = ?,
            gender = ?, birth_date = ?, age_years = ?, weight_kg = ?, height_cm = ?,
            house_no = ?, village_no = ?,
            guardian_title = ?, guardian_first_name = ?, guardian_last_name = ?,
            guardian_occupation = ?, guardian_relation = ?,
            father_title = ?, father_first_name = ?, father_last_name = ?, father_occupation = ?,
            mother_title = ?, mother_first_name = ?, mother_last_name = ?, mother_occupation = ?,
            disadvantage = ?, source_payload = ?, is_active = 1
          WHERE id = ?`
        ).run(
          entry.national_id ?? null,
          entry.student_number ?? entry.student_id,
          entry.title ?? null,
          entry.first_name,
          entry.last_name,
          classroom.id,
          classroom.name,
          entry.gender || '',
          entry.birth_date ?? null,
          entry.age_years ?? null,
          entry.weight_kg ?? null,
          entry.height_cm ?? null,
          entry.house_no ?? null,
          entry.village_no ?? null,
          entry.guardian_title ?? null,
          entry.guardian_first_name ?? null,
          entry.guardian_last_name ?? null,
          entry.guardian_occupation ?? null,
          entry.guardian_relation ?? null,
          entry.father_title ?? null,
          entry.father_first_name ?? null,
          entry.father_last_name ?? null,
          entry.father_occupation ?? null,
          entry.mother_title ?? null,
          entry.mother_first_name ?? null,
          entry.mother_last_name ?? null,
          entry.mother_occupation ?? null,
          entry.disadvantage ?? null,
          entry.source_payload ? JSON.stringify(entry.source_payload) : null,
          existing.id
        )
        updated += 1
      }
    }
  })
  transaction()

  return { success: true, imported, updated, skipped, classroomsCreated }
}

// ─── Schedule ────────────────────────────────────────────────

export function getScheduleByClassroom(classroomId: number): ScheduleItem[] {
  return getDb()
    .prepare('SELECT classroom_id, day_of_week, period, subject_code, subject_name, class_level, room FROM schedules WHERE classroom_id = ?')
    .all(classroomId)
}

export function saveSchedule(classroomId: number, entries: Omit<ScheduleItem, 'classroom_id'>[]): void {
  const d = getDb()
  const transaction = d.transaction(() => {
    d.prepare('DELETE FROM schedules WHERE classroom_id = ?').run(classroomId)
    const insert = d.prepare(
      'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const entry of entries) {
      insert.run(
        classroomId,
        entry.day_of_week,
        entry.period,
        entry.subject_code,
        entry.subject_name,
        entry.class_level,
        entry.room
      )
    }
  })
  transaction()
}

// ─── Grades ──────────────────────────────────────────────────

export function getGradesByClassroom(
  classroomId: number,
  semester: number,
  academicYear: string
): GradeEntry[] {
  return getDb()
    .prepare(
      'SELECT student_id, subject_code, score, classroom_id, semester, academic_year FROM grades WHERE classroom_id = ? AND semester = ? AND academic_year = ?'
    )
    .all(classroomId, semester, academicYear)
}

export function saveGrades(
  classroomId: number,
  semester: number,
  academicYear: string,
  entries: Array<{ student_id: number; subject_code: string; score: number }>
): void {
  const d = getDb()
  const transaction = d.transaction(() => {
    d.prepare(
      'DELETE FROM grades WHERE classroom_id = ? AND semester = ? AND academic_year = ?'
    ).run(classroomId, semester, academicYear)
    const insert = d.prepare(
      'INSERT INTO grades (student_id, classroom_id, subject_code, score, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const entry of entries) {
      insert.run(entry.student_id, classroomId, entry.subject_code, entry.score, semester, academicYear)
    }
  })
  transaction()
}

// ─── Health ──────────────────────────────────────────────────

export function getHealthByClassroom(classroomId: number, date: string): HealthEntry[] {
  return getDb()
    .prepare('SELECT student_id, classroom_id, date, brushed_teeth, drank_milk FROM health_check WHERE classroom_id = ? AND date = ?')
    .all(classroomId, date)
    .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number }) => ({
      student_id: row.student_id,
      classroom_id: row.classroom_id,
      date: row.date,
      brushed_teeth: !!row.brushed_teeth,
      drank_milk: !!row.drank_milk,
    }))
}

export function saveHealth(
  classroomId: number,
  date: string,
  entries: Omit<HealthEntry, 'classroom_id' | 'date'>[]
): void {
  const d = getDb()
  const transaction = d.transaction(() => {
    d.prepare('DELETE FROM health_check WHERE classroom_id = ? AND date = ?').run(classroomId, date)
    const insert = d.prepare(
      'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk) VALUES (?, ?, ?, ?, ?)'
    )
    for (const entry of entries) {
      insert.run(entry.student_id, classroomId, date, entry.brushed_teeth ? 1 : 0, entry.drank_milk ? 1 : 0)
    }
  })
  transaction()
}

export function getAllHealthByClassroom(classroomId: number): HealthEntry[] {
  return getDb()
    .prepare(
      `SELECT h.student_id, h.classroom_id, h.date, h.brushed_teeth, h.drank_milk
       FROM health_check h
       INNER JOIN students s ON s.id = h.student_id
       WHERE s.classroom_id = ? AND s.is_active = 1`
    )
    .all(classroomId)
    .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number }) => ({
      student_id: row.student_id,
      classroom_id: row.classroom_id,
      date: row.date,
      brushed_teeth: !!row.brushed_teeth,
      drank_milk: !!row.drank_milk,
    }))
}

// ─── Export for attendance report / export-excel ─────────────

export function getAllAttendanceByClassroom(classroomId: number): AttendanceRow[] {
  return getDb()
    .prepare('SELECT * FROM attendance WHERE classroom_id = ?')
    .all(classroomId)
}

// ─── Backup / Restore ────────────────────────────────────────

export function exportAllData() {
  return {
    classrooms: getAllClassrooms(),
    students: getAllStudents(),
    schedule: getDb().prepare('SELECT classroom_id, day_of_week, period, subject_code, subject_name, class_level, room FROM schedules').all(),
    grades: getDb().prepare('SELECT student_id, subject_code, score, classroom_id, semester, academic_year FROM grades').all(),
    attendance: getDb().prepare('SELECT id, student_id, classroom_id, date, status, note FROM attendance').all(),
    health_check: getDb()
      .prepare('SELECT student_id, classroom_id, date, brushed_teeth, drank_milk FROM health_check')
      .all()
      .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number }) => ({
        student_id: row.student_id,
        classroom_id: row.classroom_id,
        date: row.date,
        brushed_teeth: !!row.brushed_teeth,
        drank_milk: !!row.drank_milk,
      })),
    exported_at: new Date().toISOString(),
    version: '1.0',
  }
}

export function importData(data: {
  classrooms?: Classroom[]
  students?: Student[]
  schedule?: ScheduleItem[]
  grades?: GradeEntry[]
  attendance?: AttendanceRow[]
  health_check?: HealthEntry[]
}): { success: boolean; error?: string } {
  try {
    const d = getDb()
    const transaction = d.transaction(() => {
      if (data.classrooms) {
        d.prepare('DELETE FROM classrooms').run()
        const insert = d.prepare(
          'INSERT INTO classrooms (id, name, level, academic_year, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        for (const c of data.classrooms) {
          insert.run(c.id, c.name, c.level, c.academic_year, c.created_at)
        }
      }
      if (data.students) {
        d.prepare('DELETE FROM students').run()
        const insert = d.prepare(
          `INSERT INTO students (
            id, student_id, national_id, student_number, title,
            first_name, last_name, classroom_id, classroom_label,
            gender, birth_date, age_years, weight_kg, height_cm,
            house_no, village_no,
            guardian_title, guardian_first_name, guardian_last_name,
            guardian_occupation, guardian_relation,
            father_title, father_first_name, father_last_name, father_occupation,
            mother_title, mother_first_name, mother_last_name, mother_occupation,
            disadvantage, source_payload, is_active, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )`
        )
        for (const s of data.students) {
          insert.run(
            s.id, s.student_id, s.national_id ?? null, s.student_number ?? null, s.title ?? null,
            s.first_name, s.last_name, s.classroom_id, s.classroom_label ?? null,
            s.gender, s.birth_date ?? null, s.age_years ?? null, s.weight_kg ?? null, s.height_cm ?? null,
            s.house_no ?? null, s.village_no ?? null,
            s.guardian_title ?? null, s.guardian_first_name ?? null, s.guardian_last_name ?? null,
            s.guardian_occupation ?? null, s.guardian_relation ?? null,
            s.father_title ?? null, s.father_first_name ?? null, s.father_last_name ?? null, s.father_occupation ?? null,
            s.mother_title ?? null, s.mother_first_name ?? null, s.mother_last_name ?? null, s.mother_occupation ?? null,
            s.disadvantage ?? null,
            s.source_payload ? JSON.stringify(s.source_payload) : null,
            s.is_active ?? 1,
            s.created_at
          )
        }
      }
      if (data.schedule) {
        d.prepare('DELETE FROM schedules').run()
        const insert = d.prepare(
          'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        for (const s of data.schedule) {
          insert.run(s.classroom_id, s.day_of_week, s.period, s.subject_code, s.subject_name, s.class_level, s.room)
        }
      }
      if (data.grades) {
        d.prepare('DELETE FROM grades').run()
        const insert = d.prepare(
          'INSERT INTO grades (student_id, classroom_id, subject_code, score, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?)'
        )
        for (const g of data.grades) {
          insert.run(g.student_id, g.classroom_id, g.subject_code, g.score, g.semester, g.academic_year)
        }
      }
      if (data.attendance) {
        d.prepare('DELETE FROM attendance').run()
        const insert = d.prepare(
          'INSERT INTO attendance (student_id, classroom_id, date, status, note) VALUES (?, ?, ?, ?, ?)'
        )
        for (const a of data.attendance) {
          insert.run(a.student_id, a.classroom_id, a.date, a.status, a.note)
        }
      }
      if (data.health_check) {
        d.prepare('DELETE FROM health_check').run()
        const insert = d.prepare(
          'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk) VALUES (?, ?, ?, ?, ?)'
        )
        for (const h of data.health_check) {
          insert.run(h.student_id, h.classroom_id, h.date, h.brushed_teeth ? 1 : 0, h.drank_milk ? 1 : 0)
        }
      }
    })
    transaction()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export function clearAllData(): { success: boolean } {
  const d = getDb()
  const transaction = d.transaction(() => {
    d.prepare('DELETE FROM health_check').run()
    d.prepare('DELETE FROM grades').run()
    d.prepare('DELETE FROM attendance').run()
    d.prepare('DELETE FROM schedules').run()
    d.prepare('DELETE FROM students').run()
    d.prepare('DELETE FROM classrooms').run()
  })
  transaction()
  return { success: true }
}
