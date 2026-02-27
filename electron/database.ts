// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3')

import path from 'path'
import { app } from 'electron'

// Use any for simplicity since better-sqlite3 types can be tricky
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (db) return db
  
  const dbPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'school.db')
    : path.join(process.cwd(), 'school.db')
  
  console.log('[DB] Opening:', dbPath)
  db = new Database(dbPath)
  
  // Initialize tables
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
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      classroom_id INTEGER NOT NULL,
      gender TEXT NOT NULL,
      birth_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'มา',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS health_check (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      brushed_teeth INTEGER DEFAULT 0,
      drank_milk INTEGER DEFAULT 0,
      note TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period INTEGER NOT NULL,
      subject_id INTEGER,
      teacher_name TEXT,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date_classroom ON attendance(date, classroom_id);
    CREATE INDEX IF NOT EXISTS idx_health_check_student_date ON health_check(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_health_check_date_classroom ON health_check(date, classroom_id);
    CREATE INDEX IF NOT EXISTS idx_grades_student_semester_year ON grades(student_id, semester, academic_year);
    CREATE INDEX IF NOT EXISTS idx_schedule_classroom_dow_period ON schedule(classroom_id, day_of_week, period);
  `)

  // Insert default subjects if not exists
  const subjects = db.prepare('SELECT COUNT(*) as count FROM subjects').get() as { count: number }
  if (subjects.count === 0) {
    const insertSubject = db.prepare('INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)')
    const defaultSubjects = [
      ['ภาษาไทย', 'TH', '#3B82F6'],
      ['คณิตศาสตร์', 'MATH', '#10B981'],
      ['วิทยาศาสตร์', 'SCI', '#F59E0B'],
      ['สังคมศึกษา', 'SOC', '#8B5CF6'],
      ['ประวัติศาสตร์', 'HIS', '#EC4899'],
      ['สุขศึกษา', 'PE', '#14B8A6'],
      ['ศิลปะ', 'ART', '#F97316'],
      ['การงานอาชีพ', 'WORK', '#6366F1'],
      ['ภาษาอังกฤษ', 'ENG', '#EF4444'],
    ]
    defaultSubjects.forEach(s => insertSubject.run(s[0], s[1], s[2]))
  }

  console.log('[DB] Initialized successfully')
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
    console.log('[DB] Closed')
  }
}

// Classroom operations
export function getAllClassrooms() {
  const db = getDb()
  return db.prepare(`
    SELECT c.*, COUNT(s.id) as student_count 
    FROM classrooms c 
    LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1 
    GROUP BY c.id 
    ORDER BY c.created_at DESC
  `).all()
}

export function createClassroom(name: string, level: string, academicYear: string) {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)'
  ).run(name, level, academicYear)
  return { id: result.lastInsertRowid, name, level, academic_year: academicYear }
}

export function deleteClassroom(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
}

// Student operations
export function getStudentsByClassroom(classroomId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM students 
    WHERE classroom_id = ? AND is_active = 1 
    ORDER BY student_id
  `).all(classroomId)
}

export function getAllStudents() {
  const db = getDb()
  return db.prepare(`
    SELECT s.*, c.name as classroom_name 
    FROM students s 
    LEFT JOIN classrooms c ON c.id = s.classroom_id 
    WHERE s.is_active = 1 
    ORDER BY c.name, s.student_id
  `).all()
}

export function createStudent(data: {
  student_id: string
  first_name: string
  last_name: string
  classroom_id: number
  gender: string
  birth_date?: string
}) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO students (student_id, first_name, last_name, classroom_id, gender, birth_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.student_id,
    data.first_name,
    data.last_name,
    data.classroom_id,
    data.gender,
    data.birth_date || null
  )
  return { ...data, id: result.lastInsertRowid }
}

export function updateStudent(id: number, data: Partial<{
  student_id: string
  first_name: string
  last_name: string
  classroom_id: number
  gender: string
  birth_date: string
}>) {
  const db = getDb()
  
  // Whitelist of allowed fields to update (prevents SQL injection)
  const allowedFields = ['student_id', 'first_name', 'last_name', 'classroom_id', 'gender', 'birth_date']
  const updateData: Record<string, any> = {}
  
  for (const key of allowedFields) {
    if ((data as any)[key] !== undefined) {
      updateData[key] = (data as any)[key]
    }
  }
  
  const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ')
  const values = Object.values(updateData)
  
  if (fields.length > 0) {
    db.prepare(`UPDATE students SET ${fields} WHERE id = ?`).run(...values, id)
  }
}

export function deleteStudent(id: number) {
  const db = getDb()
  db.prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id)
}

// Attendance operations
export function getAttendanceByDate(date: string, classroomId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT s.id, s.student_id, s.first_name, s.last_name, a.status, a.note
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
    WHERE s.classroom_id = ? AND s.is_active = 1
    ORDER BY s.student_id
  `).all(date, classroomId)
}

export function saveAttendance(data: {
  student_id: number
  date: string
  status: string
  note?: string
}) {
  const db = getDb()
  
  // Check if exists
  const existing = db.prepare(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ?'
  ).get(data.student_id, data.date)
  
  if (existing) {
    db.prepare(`
      UPDATE attendance SET status = ?, note = ? 
      WHERE student_id = ? AND date = ?
    `).run(data.status, data.note || '', data.student_id, data.date)
  } else {
    db.prepare(`
      INSERT INTO attendance (student_id, date, status, note)
      VALUES (?, ?, ?, ?)
    `).run(data.student_id, data.date, data.status, data.note || '')
  }
}

// Health check operations
export function getHealthCheckByDate(date: string, classroomId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT s.id, h.brushed_teeth, h.drank_milk, h.note
    FROM students s
    LEFT JOIN health_check h ON h.student_id = s.id AND h.date = ?
    WHERE s.classroom_id = ? AND s.is_active = 1
    ORDER BY s.student_id
  `).all(date, classroomId)
}

export function saveHealthCheck(data: {
  student_id: number
  date: string
  brushed_teeth: number
  drank_milk: number
  note?: string
}) {
  const db = getDb()
  
  const existing = db.prepare(
    'SELECT id FROM health_check WHERE student_id = ? AND date = ?'
  ).get(data.student_id, data.date)
  
  if (existing) {
    db.prepare(`
      UPDATE health_check SET brushed_teeth = ?, drank_milk = ?, note = ?
      WHERE student_id = ? AND date = ?
    `).run(data.brushed_teeth, data.drank_milk, data.note || '', data.student_id, data.date)
  } else {
    db.prepare(`
      INSERT INTO health_check (student_id, date, brushed_teeth, drank_milk, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.student_id, data.date, data.brushed_teeth, data.drank_milk, data.note || '')
  }
}

// Grade operations
export function getGradesByStudent(studentId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM grades 
    WHERE student_id = ? 
    ORDER BY academic_year, semester
  `).all(studentId)
}

export function getGradesByClassroom(classroomId: number, semester: number, academicYear: string) {
  const db = getDb()
  return db.prepare(`
    SELECT s.id, s.student_id, s.first_name, s.last_name, g.subject, g.score
    FROM students s
    LEFT JOIN grades g ON g.student_id = s.id AND g.semester = ? AND g.academic_year = ?
    WHERE s.classroom_id = ? AND s.is_active = 1
    ORDER BY s.student_id
  `).all(semester, academicYear, classroomId)
}

export function saveGrade(data: {
  student_id: number
  subject: string
  semester: number
  academic_year: string
  score: number
}) {
  const db = getDb()
  
  const existing = db.prepare(`
    SELECT id FROM grades 
    WHERE student_id = ? AND subject = ? AND semester = ? AND academic_year = ?
  `).get(data.student_id, data.subject, data.semester, data.academic_year)
  
  if (existing) {
    db.prepare(`
      UPDATE grades SET score = ? 
      WHERE student_id = ? AND subject = ? AND semester = ? AND academic_year = ?
    `).run(data.score, data.student_id, data.subject, data.semester, data.academic_year)
  } else {
    db.prepare(`
      INSERT INTO grades (student_id, subject, semester, academic_year, score)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.student_id, data.subject, data.semester, data.academic_year, data.score)
  }
}

// Schedule operations
export function getScheduleByClassroom(classroomId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT s.*, sub.name as subject_name, sub.color as subject_color
    FROM schedule s
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    WHERE s.classroom_id = ?
    ORDER BY s.day_of_week, s.period
  `).all(classroomId)
}

export function saveScheduleItem(data: {
  classroom_id: number
  day_of_week: number
  period: number
  subject_id: number
  teacher_name: string
}) {
  const db = getDb()
  
  const existing = db.prepare(`
    SELECT id FROM schedule 
    WHERE classroom_id = ? AND day_of_week = ? AND period = ?
  `).get(data.classroom_id, data.day_of_week, data.period)
  
  if (existing) {
    db.prepare(`
      UPDATE schedule SET subject_id = ?, teacher_name = ?
      WHERE classroom_id = ? AND day_of_week = ? AND period = ?
    `).run(data.subject_id, data.teacher_name, data.classroom_id, data.day_of_week, data.period)
  } else {
    db.prepare(`
      INSERT INTO schedule (classroom_id, day_of_week, period, subject_id, teacher_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.classroom_id, data.day_of_week, data.period, data.subject_id, data.teacher_name)
  }
}

// Subjects
export function getAllSubjects() {
  const db = getDb()
  return db.prepare('SELECT * FROM subjects ORDER BY name').all()
}

// Backup/Restore
export function exportDatabase(): string {
  const db = getDb()
  return db.backup(`school_backup_${Date.now()}.db`)
}

export function importDatabase(filePath: string) {
  const existingDb = getDb()
  if (existingDb) {
    existingDb.close()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = new (Database as any)(filePath)
  return db
}
