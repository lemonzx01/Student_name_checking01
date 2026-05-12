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

function resolveDbPath(): string {
  // อนุญาตให้ override path ผ่าน env var (สำหรับ packaged Electron ที่ใช้ userData)
  if (process.env.SCHOOL_DB_PATH) return process.env.SCHOOL_DB_PATH
  return path.join(process.cwd(), 'school.db')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (db) return db

  const dbPath = resolveDbPath()
  try {
    db = new Database(dbPath)
  } catch (err) {
    console.error('[DB] เปิดฐานข้อมูลไม่สำเร็จ:', dbPath, err)
    throw new Error(
      `ไม่สามารถเปิดฐานข้อมูล (${dbPath}) ได้: ${(err as Error).message}`
    )
  }
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      color TEXT,
      archived_at DATETIME,
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
      guardian_phone TEXT,
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
      photo_path TEXT,
      deleted_at DATETIME,
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
      midterm_score REAL DEFAULT 0,
      final_score REAL DEFAULT 0,
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
      weight_kg REAL,
      height_cm REAL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS student_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON attendance(classroom_id, date);
    CREATE INDEX IF NOT EXISTS idx_health_classroom_date ON health_check(classroom_id, date);
    CREATE INDEX IF NOT EXISTS idx_grades_classroom ON grades(classroom_id, semester, academic_year);
    CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON schedules(classroom_id);
  `)

  // Sprint 3: archived_at column for classrooms (soft archive)
  const classroomCols2 = new Set(
    db.prepare('PRAGMA table_info(classrooms)').all().map((c: any) => c.name)
  )
  if (!classroomCols2.has('archived_at')) {
    try {
      db.exec('ALTER TABLE classrooms ADD COLUMN archived_at DATETIME')
    } catch (err) {
      console.warn('[db] migrate classrooms.archived_at skipped:', err)
    }
  }

  // Migrate: add color column if missing
  const classroomCols = new Set(
    db.prepare('PRAGMA table_info(classrooms)').all().map((c: any) => c.name)
  )
  if (!classroomCols.has('color')) {
    db.exec('ALTER TABLE classrooms ADD COLUMN color TEXT')
  }

  // Migrate: add classroom_id + subject_code + midterm/final to grades
  // (สำหรับ DB เก่าที่เคยใช้ schema Electron version เก่า)
  const gradeCols = new Set(
    db.prepare('PRAGMA table_info(grades)').all().map((c: any) => c.name)
  )
  if (!gradeCols.has('classroom_id')) {
    try {
      db.exec('ALTER TABLE grades ADD COLUMN classroom_id INTEGER')
      db.exec(
        `UPDATE grades
         SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = grades.student_id)
         WHERE classroom_id IS NULL`
      )
    } catch (err) {
      console.warn('[db] migrate grades.classroom_id skipped:', err)
    }
  }
  if (!gradeCols.has('subject_code')) {
    try {
      db.exec('ALTER TABLE grades ADD COLUMN subject_code TEXT')
      if (gradeCols.has('subject')) {
        db.exec('UPDATE grades SET subject_code = subject WHERE subject_code IS NULL')
      }
    } catch (err) {
      console.warn('[db] migrate grades.subject_code skipped:', err)
    }
  }
  if (!gradeCols.has('midterm_score')) {
    db.exec('ALTER TABLE grades ADD COLUMN midterm_score REAL DEFAULT 0')
  }
  if (!gradeCols.has('final_score')) {
    db.exec('ALTER TABLE grades ADD COLUMN final_score REAL DEFAULT 0')
  }

  // Migrate: add classroom_id + weight_kg/height_cm to health_check
  const healthCols = new Set(
    db.prepare('PRAGMA table_info(health_check)').all().map((c: any) => c.name)
  )
  if (!healthCols.has('classroom_id')) {
    try {
      db.exec('ALTER TABLE health_check ADD COLUMN classroom_id INTEGER')
      db.exec(
        `UPDATE health_check
         SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = health_check.student_id)
         WHERE classroom_id IS NULL`
      )
    } catch (err) {
      console.warn('[db] migrate health_check.classroom_id skipped:', err)
    }
  }
  if (!healthCols.has('weight_kg')) {
    db.exec('ALTER TABLE health_check ADD COLUMN weight_kg REAL')
  }
  if (!healthCols.has('height_cm')) {
    db.exec('ALTER TABLE health_check ADD COLUMN height_cm REAL')
  }

  // Migrate: add classroom_id to attendance (สำหรับ DB เก่า)
  const attendanceCols = new Set(
    db.prepare('PRAGMA table_info(attendance)').all().map((c: any) => c.name)
  )
  if (!attendanceCols.has('classroom_id')) {
    try {
      db.exec('ALTER TABLE attendance ADD COLUMN classroom_id INTEGER')
      db.exec(
        `UPDATE attendance
         SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = attendance.student_id)
         WHERE classroom_id IS NULL`
      )
    } catch (err) {
      console.warn('[db] migrate attendance.classroom_id skipped:', err)
    }
  }

  // Migrate: schedule (เก่า) → schedules (ใหม่)
  try {
    const oldTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schedule'")
      .get()
    const newTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'")
      .get()
    if (oldTable && newTable) {
      const newCount = db.prepare('SELECT COUNT(*) AS c FROM schedules').get() as { c: number }
      // ถ้า schedules ว่างอยู่ ให้ย้ายข้อมูลจาก schedule เก่ามา (ป้องกัน double-migrate)
      if (newCount.c === 0) {
        const oldRows = db
          .prepare(
            `SELECT s.classroom_id, s.day_of_week, s.period,
                    COALESCE(sub.code, '') AS subject_code,
                    COALESCE(sub.name, '') AS subject_name,
                    '' AS class_level,
                    COALESCE(s.teacher_name, '') AS room
             FROM schedule s
             LEFT JOIN subjects sub ON sub.id = s.subject_id`
          )
          .all()
        const insert = db.prepare(
          'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        const tx = db.transaction(() => {
          for (const r of oldRows as any[]) {
            insert.run(
              r.classroom_id,
              r.day_of_week,
              r.period,
              r.subject_code,
              r.subject_name,
              r.class_level,
              r.room
            )
          }
        })
        tx()
      }
      db.exec('DROP TABLE schedule')
    }
  } catch (err) {
    console.warn('[db] migrate schedule → schedules skipped:', err)
  }

  // Migrate: add guardian_phone column to students (สำหรับติดต่อผู้ปกครอง)
  const studentCols = new Set(
    db.prepare('PRAGMA table_info(students)').all().map((c: any) => c.name)
  )
  if (!studentCols.has('guardian_phone')) {
    db.exec('ALTER TABLE students ADD COLUMN guardian_phone TEXT')
  }
  // Sprint 2: add photo_path column to students (รูปประจำตัวนักเรียน)
  if (!studentCols.has('photo_path')) {
    try {
      db.exec('ALTER TABLE students ADD COLUMN photo_path TEXT')
    } catch (err) {
      console.warn('[db] migrate students.photo_path skipped:', err)
    }
  }
  // Sprint 2: add deleted_at column to students (สำหรับ trash + auto-purge)
  if (!studentCols.has('deleted_at')) {
    try {
      db.exec('ALTER TABLE students ADD COLUMN deleted_at DATETIME')
    } catch (err) {
      console.warn('[db] migrate students.deleted_at skipped:', err)
    }
  }

  // Seed default subjects (ตรงกับ electron/main.js)
  try {
    const subjectCount = db.prepare('SELECT COUNT(*) AS count FROM subjects').get() as {
      count: number
    }
    if (subjectCount.count === 0) {
      const insertSubject = db.prepare(
        'INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)'
      )
      const defaultSubjects: Array<[string, string, string]> = [
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
      const seed = db.transaction(() => {
        for (const [name, code, color] of defaultSubjects) {
          insertSubject.run(name, code, color)
        }
      })
      seed()
    }
  } catch (err) {
    console.warn('[db] seed subjects skipped:', err)
  }

  // ── Data healing: ลบ orphan rows ที่อาจหลงเหลือจากรุ่นก่อนหน้า ──
  // (เช่น ห้องที่เคยถูกลบไปแต่มีตารางเรียน/คะแนน/สุขภาพค้างอยู่)
  // ทำใน transaction เดียว — atomic
  try {
    const cleanup = db.transaction(() => {
      // schedules ที่อ้างถึง classroom ที่ไม่มีอยู่จริง
      db.exec(`
        DELETE FROM schedules
        WHERE classroom_id NOT IN (SELECT id FROM classrooms);

        DELETE FROM students
        WHERE classroom_id NOT IN (SELECT id FROM classrooms);

        DELETE FROM attendance
        WHERE student_id NOT IN (SELECT id FROM students);

        DELETE FROM grades
        WHERE student_id NOT IN (SELECT id FROM students);

        DELETE FROM health_check
        WHERE student_id NOT IN (SELECT id FROM students);

        DELETE FROM student_notes
        WHERE student_id NOT IN (SELECT id FROM students);
      `)
    })
    cleanup()
  } catch (err) {
    console.warn('[db] orphan cleanup skipped:', err)
  }

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
  const aKey = a.student_number || a.student_id || ''
  const bKey = b.student_number || b.student_id || ''
  const left = Number(aKey)
  const right = Number(bKey)
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right
  return aKey.localeCompare(bKey, 'th')
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
       WHERE c.archived_at IS NULL
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    )
    .all()
  return rows
}

export function getArchivedClassrooms(): Classroom[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, COUNT(s.id) as student_count
       FROM classrooms c
       LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1
       WHERE c.archived_at IS NOT NULL
       GROUP BY c.id
       ORDER BY c.archived_at DESC`
    )
    .all()
  return rows
}

export function archiveClassroom(id: number): void {
  getDb()
    .prepare('UPDATE classrooms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(id)
}

export function unarchiveClassroom(id: number): void {
  getDb()
    .prepare('UPDATE classrooms SET archived_at = NULL WHERE id = ?')
    .run(id)
}

export function createClassroom(name: string, level: string, academicYear: string, color?: string | null): Classroom {
  const d = getDb()
  const trimmedName = name.trim()
  const existing = d.prepare('SELECT * FROM classrooms WHERE name = ?').get(trimmedName)
  if (existing) return existing

  const result = d
    .prepare('INSERT INTO classrooms (name, level, academic_year, color) VALUES (?, ?, ?, ?)')
    .run(trimmedName, level.trim(), academicYear.trim(), color ?? null)

  return d.prepare('SELECT * FROM classrooms WHERE id = ?').get(result.lastInsertRowid)
}

export function updateClassroom(
  id: number,
  data: { name?: string; level?: string; academic_year?: string; color?: string | null }
): void {
  const d = getDb()
  const current = d.prepare('SELECT * FROM classrooms WHERE id = ?').get(id)
  if (!current) return

  d.prepare('UPDATE classrooms SET name = ?, level = ?, academic_year = ?, color = ? WHERE id = ?').run(
    data.name ?? current.name,
    data.level ?? current.level,
    data.academic_year ?? current.academic_year,
    data.color !== undefined ? data.color : current.color,
    id
  )
}

export function deleteClassroom(id: number): void {
  const d = getDb()
  // ทำเป็น transaction เพื่อให้ atomic — ถ้าขั้นตอนใดล้มเหลว rollback ทั้งหมด
  // กันกรณีมีข้อมูลเศษค้างใน DB (orphan rows) ทำให้ FK violation ครั้งหน้า
  // นอกจากนี้ทำในลำดับที่ปลอดภัยตาม FK: child rows → parent rows
  const transaction = d.transaction(() => {
    const studentIds = d
      .prepare('SELECT id FROM students WHERE classroom_id = ?')
      .all(id)
      .map((r: { id: number }) => r.id)

    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',')
      d.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...studentIds)
      d.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...studentIds)
      d.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...studentIds)
      d.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...studentIds)
    }
    d.prepare('DELETE FROM students WHERE classroom_id = ?').run(id)
    d.prepare('DELETE FROM schedules WHERE classroom_id = ?').run(id)
    d.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
  })
  transaction()
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
        guardian_occupation, guardian_relation, guardian_phone,
        father_title, father_first_name, father_last_name, father_occupation,
        mother_title, mother_first_name, mother_last_name, mother_occupation,
        disadvantage, source_payload, photo_path
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
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
      data.guardian_phone ?? null,
      data.father_title ?? null,
      data.father_first_name ?? null,
      data.father_last_name ?? null,
      data.father_occupation ?? null,
      data.mother_title ?? null,
      data.mother_first_name ?? null,
      data.mother_last_name ?? null,
      data.mother_occupation ?? null,
      data.disadvantage ?? null,
      data.source_payload ? JSON.stringify(data.source_payload) : null,
      data.photo_path ?? null
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
      guardian_occupation = ?, guardian_relation = ?, guardian_phone = ?,
      father_title = ?, father_first_name = ?, father_last_name = ?, father_occupation = ?,
      mother_title = ?, mother_first_name = ?, mother_last_name = ?, mother_occupation = ?,
      disadvantage = ?, source_payload = ?, photo_path = ?
    WHERE id = ?`
  ).run(
    data.student_id ?? current.student_id,
    data.national_id !== undefined ? data.national_id : current.national_id,
    data.student_number !== undefined ? data.student_number : current.student_number,
    data.title !== undefined ? data.title : current.title,
    data.first_name ?? current.first_name,
    data.last_name ?? current.last_name,
    data.classroom_id ?? current.classroom_id,
    data.classroom_label !== undefined ? data.classroom_label : current.classroom_label,
    data.gender ?? current.gender,
    data.birth_date !== undefined ? data.birth_date : current.birth_date,
    data.age_years !== undefined ? data.age_years : current.age_years,
    data.weight_kg !== undefined ? data.weight_kg : current.weight_kg,
    data.height_cm !== undefined ? data.height_cm : current.height_cm,
    data.house_no !== undefined ? data.house_no : current.house_no,
    data.village_no !== undefined ? data.village_no : current.village_no,
    data.guardian_title !== undefined ? data.guardian_title : current.guardian_title,
    data.guardian_first_name !== undefined ? data.guardian_first_name : current.guardian_first_name,
    data.guardian_last_name !== undefined ? data.guardian_last_name : current.guardian_last_name,
    data.guardian_occupation !== undefined ? data.guardian_occupation : current.guardian_occupation,
    data.guardian_relation !== undefined ? data.guardian_relation : current.guardian_relation,
    data.guardian_phone !== undefined ? data.guardian_phone : current.guardian_phone,
    data.father_title !== undefined ? data.father_title : current.father_title,
    data.father_first_name !== undefined ? data.father_first_name : current.father_first_name,
    data.father_last_name !== undefined ? data.father_last_name : current.father_last_name,
    data.father_occupation !== undefined ? data.father_occupation : current.father_occupation,
    data.mother_title !== undefined ? data.mother_title : current.mother_title,
    data.mother_first_name !== undefined ? data.mother_first_name : current.mother_first_name,
    data.mother_last_name !== undefined ? data.mother_last_name : current.mother_last_name,
    data.mother_occupation !== undefined ? data.mother_occupation : current.mother_occupation,
    data.disadvantage !== undefined ? data.disadvantage : current.disadvantage,
    data.source_payload !== undefined
      ? (typeof data.source_payload === 'string'
          ? data.source_payload
          : JSON.stringify(data.source_payload))
      : current.source_payload,
    data.photo_path !== undefined ? data.photo_path : current.photo_path,
    id
  )
}

export function deleteStudent(id: number): void {
  getDb()
    .prepare('UPDATE students SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(id)
}

// ─── Recycle Bin (Trash) ─────────────────────────────────────

/** ดึงนักเรียนที่อยู่ในถังขยะ (is_active = 0) */
export function getTrashedStudents(): Student[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, c.name as classroom_name
       FROM students s
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE s.is_active = 0
       ORDER BY s.deleted_at DESC`
    )
    .all()
  return rows.map(rowToStudent)
}

/** กู้คืนนักเรียนจากถังขยะ (อาจตั้ง classroom_id ใหม่ ถ้าห้องเดิมถูกลบไปแล้ว) */
export function restoreStudent(id: number, newClassroomId?: number | null): void {
  const d = getDb()
  if (newClassroomId) {
    const classroom = d.prepare('SELECT name FROM classrooms WHERE id = ?').get(newClassroomId) as
      | { name: string }
      | undefined
    d.prepare(
      'UPDATE students SET is_active = 1, deleted_at = NULL, classroom_id = ?, classroom_label = ? WHERE id = ?'
    ).run(newClassroomId, classroom?.name || '', id)
  } else {
    d.prepare('UPDATE students SET is_active = 1, deleted_at = NULL WHERE id = ?').run(id)
  }
}

/** ลบนักเรียนถาวร (พร้อมข้อมูลที่เกี่ยวข้องทั้งหมด) */
export function purgeStudent(id: number): void {
  const d = getDb()
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM student_notes WHERE student_id = ?').run(id)
    d.prepare('DELETE FROM attendance WHERE student_id = ?').run(id)
    d.prepare('DELETE FROM grades WHERE student_id = ?').run(id)
    d.prepare('DELETE FROM health_check WHERE student_id = ?').run(id)
    d.prepare('DELETE FROM students WHERE id = ?').run(id)
  })
  tx()
}

/** ล้างถังขยะทั้งหมด (ลบนักเรียน is_active=0 ถาวร) */
export function emptyTrash(): { purged: number } {
  const d = getDb()
  let purged = 0
  const tx = d.transaction(() => {
    const ids = d
      .prepare('SELECT id FROM students WHERE is_active = 0')
      .all()
      .map((r: { id: number }) => r.id)
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    d.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...ids)
    purged = ids.length
  })
  tx()
  return { purged }
}

/** Auto-purge: ลบนักเรียนใน trash ที่เก่ากว่า N วันถาวร */
export function autoPurgeOldTrash(retentionDays = 30): { purged: number } {
  const d = getDb()
  let purged = 0
  const tx = d.transaction(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ')
    const ids = d
      .prepare(
        "SELECT id FROM students WHERE is_active = 0 AND deleted_at IS NOT NULL AND deleted_at < ?"
      )
      .all(cutoffStr)
      .map((r: { id: number }) => r.id)
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    d.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...ids)
    d.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...ids)
    purged = ids.length
  })
  tx()
  return { purged }
}

// ─── Photos ──────────────────────────────────────────────────

/** อัปเดต photo_path ของนักเรียน */
export function updateStudentPhotoPath(studentId: number, photoPath: string | null): void {
  getDb().prepare('UPDATE students SET photo_path = ? WHERE id = ?').run(photoPath, studentId)
}

// ─── Duplicate Classroom ─────────────────────────────────────

/**
 * Duplicate classroom สำหรับขึ้นปีใหม่ — copy schedules แต่ไม่ copy นักเรียน/คะแนน/เช็คชื่อ
 */
export function duplicateClassroom(
  sourceId: number,
  newName: string,
  newAcademicYear: string,
  options: { promoteStudents?: boolean; archiveSource?: boolean } = {}
): { id: number; name: string; movedStudents: number } {
  const d = getDb()
  const source = d.prepare('SELECT * FROM classrooms WHERE id = ?').get(sourceId) as
    | Classroom
    | undefined
  if (!source) throw new Error('Source classroom not found')

  const trimmedName = newName.trim()
  const existing = d.prepare('SELECT id FROM classrooms WHERE name = ?').get(trimmedName)
  if (existing) throw new Error('Classroom name already exists')

  let newId = 0
  let movedStudents = 0
  const tx = d.transaction(() => {
    const result = d
      .prepare('INSERT INTO classrooms (name, level, academic_year, color) VALUES (?, ?, ?, ?)')
      .run(trimmedName, source.level, newAcademicYear.trim(), source.color ?? null)
    newId = Number(result.lastInsertRowid)

    // copy schedules
    const schedules = d
      .prepare(
        'SELECT day_of_week, period, subject_code, subject_name, class_level, room FROM schedules WHERE classroom_id = ?'
      )
      .all(sourceId)
    const insert = d.prepare(
      'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of schedules as any[]) {
      insert.run(newId, s.day_of_week, s.period, s.subject_code, s.subject_name, s.class_level, s.room)
    }

    if (options.promoteStudents) {
      const moved = d
        .prepare(
          `UPDATE students
           SET classroom_id = ?, classroom_label = ?
           WHERE classroom_id = ? AND is_active = 1`
        )
        .run(newId, trimmedName, sourceId)
      movedStudents = Number(moved.changes) || 0
    }

    if (options.archiveSource) {
      d.prepare('UPDATE classrooms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(sourceId)
    }
  })
  tx()

  return { id: newId, name: trimmedName, movedStudents }
}

// ─── Dashboard Stats ─────────────────────────────────────────

export function getDashboardStats(classroomId?: number | null) {
  const d = getDb()
  const scoped = typeof classroomId === 'number' && classroomId > 0
  const cId = scoped ? classroomId : null

  const classroomCount = (d.prepare('SELECT COUNT(*) AS c FROM classrooms').get() as { c: number }).c

  const studentCount = (d
    .prepare(
      scoped
        ? 'SELECT COUNT(*) AS c FROM students WHERE is_active = 1 AND classroom_id = ?'
        : 'SELECT COUNT(*) AS c FROM students WHERE is_active = 1'
    )
    .get(...(scoped ? [cId] : [])) as { c: number }).c

  // Top 5 absent students (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

  const topAbsent = d
    .prepare(
      `SELECT s.id, s.first_name, s.last_name, s.title, s.photo_path, s.classroom_id, c.name as classroom_name,
              COUNT(a.id) as absent_count
       FROM attendance a
       INNER JOIN students s ON s.id = a.student_id AND s.is_active = 1
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE a.status IN ('ขาด', 'ลาป่วย', 'ลากิจ') AND a.date >= ?
         ${scoped ? 'AND s.classroom_id = ?' : ''}
       GROUP BY s.id
       ORDER BY absent_count DESC
       LIMIT 5`
    )
    .all(...(scoped ? [cutoff, cId] : [cutoff]))

  // BMI abnormal (latest weight/height per student)
  const studentsWithBmi = d
    .prepare(
      `SELECT s.id, s.title, s.first_name, s.last_name, s.photo_path, s.weight_kg, s.height_cm, c.name as classroom_name
       FROM students s
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE s.is_active = 1
         AND s.weight_kg IS NOT NULL AND s.weight_kg > 0
         AND s.height_cm IS NOT NULL AND s.height_cm > 0
         ${scoped ? 'AND s.classroom_id = ?' : ''}`
    )
    .all(...(scoped ? [cId] : []))

  const bmiAbnormal: any[] = []
  for (const s of studentsWithBmi as any[]) {
    const hm = s.height_cm / 100
    const bmi = s.weight_kg / (hm * hm)
    if (bmi < 18.5 || bmi >= 25) {
      bmiAbnormal.push({
        id: s.id,
        title: s.title,
        first_name: s.first_name,
        last_name: s.last_name,
        photo_path: s.photo_path,
        classroom_name: s.classroom_name,
        bmi: Math.round(bmi * 10) / 10,
        status: bmi < 18.5 ? 'ผอม' : bmi < 30 ? 'อ้วน' : 'อ้วนมาก',
      })
    }
  }

  // Recent students (last 10 added)
  const recentStudents = d
    .prepare(
      `SELECT s.id, s.first_name, s.last_name, s.title, s.photo_path, c.name as classroom_name, s.created_at
       FROM students s
       LEFT JOIN classrooms c ON c.id = s.classroom_id
       WHERE s.is_active = 1
         ${scoped ? 'AND s.classroom_id = ?' : ''}
       ORDER BY s.id DESC
       LIMIT 10`
    )
    .all(...(scoped ? [cId] : []))

  // Recent attendance dates
  const recentAttendance = d
    .prepare(
      `SELECT DISTINCT a.date, c.id as classroom_id, c.name as classroom_name, COUNT(a.id) as count
       FROM attendance a
       LEFT JOIN classrooms c ON c.id = a.classroom_id
       ${scoped ? 'WHERE a.classroom_id = ?' : ''}
       GROUP BY a.date, c.id
       ORDER BY a.date DESC
       LIMIT 5`
    )
    .all(...(scoped ? [cId] : []))

  // Latest classroom (scope-aware: ห้องที่เลือกอยู่ ถ้ามี, ไม่งั้นห้องล่าสุด)
  const latestClassroom = d
    .prepare(
      scoped
        ? `SELECT c.id, c.name,
                  (SELECT AVG(g.score) FROM grades g WHERE g.classroom_id = c.id AND g.score > 0) as avg_score
           FROM classrooms c
           WHERE c.id = ?
           LIMIT 1`
        : `SELECT c.id, c.name,
                  (SELECT AVG(g.score) FROM grades g WHERE g.classroom_id = c.id AND g.score > 0) as avg_score
           FROM classrooms c
           ORDER BY c.id DESC
           LIMIT 1`
    )
    .get(...(scoped ? [cId] : []))

  return {
    scope: scoped ? 'classroom' : 'all',
    classroomId: cId,
    classroomCount,
    studentCount,
    topAbsent,
    bmiAbnormal: bmiAbnormal.slice(0, 10),
    recentStudents,
    recentAttendance,
    latestClassroom,
  }
}

// ─── Student Notes (บันทึกประจำตัวนักเรียน) ─────────────────

export function getNotesByStudent(studentId: number): any[] {
  return getDb()
    .prepare(
      'SELECT id, student_id, date, note, created_at FROM student_notes WHERE student_id = ? ORDER BY date DESC, id DESC'
    )
    .all(studentId)
}

export function addStudentNote(studentId: number, date: string, note: string): any {
  const d = getDb()
  const result = d
    .prepare('INSERT INTO student_notes (student_id, date, note) VALUES (?, ?, ?)')
    .run(studentId, date, note.trim())
  return d.prepare('SELECT * FROM student_notes WHERE id = ?').get(result.lastInsertRowid)
}

export function deleteStudentNote(noteId: number): void {
  getDb().prepare('DELETE FROM student_notes WHERE id = ?').run(noteId)
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
      photo_path: student.photo_path ?? null,
      guardian_phone: student.guardian_phone ?? null,
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

export function getAttendanceDates(classroomId: number, yearMonth: string): string[] {
  const d = getDb()
  const rows = d
    .prepare('SELECT DISTINCT date FROM attendance WHERE classroom_id = ? AND date LIKE ?')
    .all(classroomId, `${yearMonth}%`)
  return rows.map((r: { date: string }) => r.date)
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
            guardian_occupation = ?, guardian_relation = ?, guardian_phone = ?,
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
          entry.guardian_phone ?? null,
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

/**
 * เปลี่ยนรหัสวิชา (subject_code) ในข้อมูลที่อ้างถึง — ใช้ตอนครูแก้รหัสวิชา
 * อัปเดตทั้ง grades และ schedules ใน transaction เดียว เพื่อ atomic
 *
 * คืน: จำนวน row ที่ถูกอัปเดตในแต่ละตาราง
 */
export function renameSubjectCode(
  from: string,
  to: string
): { gradesUpdated: number; schedulesUpdated: number } {
  if (!from || !to || from === to) {
    return { gradesUpdated: 0, schedulesUpdated: 0 }
  }
  const d = getDb()
  const transaction = d.transaction(() => {
    const g = d.prepare('UPDATE grades SET subject_code = ? WHERE subject_code = ?').run(to, from)
    const s = d
      .prepare('UPDATE schedules SET subject_code = ? WHERE subject_code = ?')
      .run(to, from)
    return {
      gradesUpdated: Number(g.changes) || 0,
      schedulesUpdated: Number(s.changes) || 0,
    }
  })
  return transaction()
}

/** อัปเดตชื่อวิชาใน schedules (เพื่อให้ตารางสอนแสดงชื่อใหม่) */
export function renameSubjectName(code: string, newName: string): number {
  if (!code || !newName) return 0
  const d = getDb()
  const result = d
    .prepare('UPDATE schedules SET subject_name = ? WHERE subject_code = ?')
    .run(newName, code)
  return Number(result.changes) || 0
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
      'SELECT student_id, subject_code, score, midterm_score, final_score, classroom_id, semester, academic_year FROM grades WHERE classroom_id = ? AND semester = ? AND academic_year = ?'
    )
    .all(classroomId, semester, academicYear)
}

export function saveGrades(
  classroomId: number,
  semester: number,
  academicYear: string,
  entries: Array<{ student_id: number; subject_code: string; score: number; midterm_score: number; final_score: number }>
): void {
  const d = getDb()
  const transaction = d.transaction(() => {
    const deleteByStudent = d.prepare(
      'DELETE FROM grades WHERE student_id = ? AND semester = ? AND academic_year = ?'
    )
    const insert = d.prepare(
      'INSERT INTO grades (student_id, classroom_id, subject_code, score, midterm_score, final_score, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const deletedStudents = new Set<number>()
    for (const entry of entries) {
      if (!deletedStudents.has(entry.student_id)) {
        deleteByStudent.run(entry.student_id, semester, academicYear)
        deletedStudents.add(entry.student_id)
      }
      const score = (entry.midterm_score || 0) + (entry.final_score || 0)
      insert.run(entry.student_id, classroomId, entry.subject_code, score, entry.midterm_score || 0, entry.final_score || 0, semester, academicYear)
    }
  })
  transaction()
}

// ─── Health ──────────────────────────────────────────────────

export function getHealthByClassroom(classroomId: number, date: string): HealthEntry[] {
  return getDb()
    .prepare('SELECT student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm FROM health_check WHERE classroom_id = ? AND date = ?')
    .all(classroomId, date)
    .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number; weight_kg: number | null; height_cm: number | null }) => ({
      student_id: row.student_id,
      classroom_id: row.classroom_id,
      date: row.date,
      brushed_teeth: !!row.brushed_teeth,
      drank_milk: !!row.drank_milk,
      weight_kg: row.weight_kg,
      height_cm: row.height_cm,
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
      'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const entry of entries) {
      insert.run(
        entry.student_id,
        classroomId,
        date,
        entry.brushed_teeth ? 1 : 0,
        entry.drank_milk ? 1 : 0,
        entry.weight_kg ?? null,
        entry.height_cm ?? null
      )
    }
  })
  transaction()
}

// Atomic upsert ของ health record ตัวเดียว — ใช้แทน read-modify-write ใน API
// กัน race condition เมื่อมี 2 request พร้อมกันบนวันเดียวกัน
export function upsertHealthEntry(
  classroomId: number,
  date: string,
  entry: Omit<HealthEntry, 'classroom_id' | 'date'>
): void {
  const d = getDb()
  const tx = d.transaction(() => {
    d.prepare(
      'DELETE FROM health_check WHERE classroom_id = ? AND date = ? AND student_id = ?'
    ).run(classroomId, date, entry.student_id)
    d.prepare(
      'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      entry.student_id,
      classroomId,
      date,
      entry.brushed_teeth ? 1 : 0,
      entry.drank_milk ? 1 : 0,
      entry.weight_kg ?? null,
      entry.height_cm ?? null
    )
  })
  tx()
}

export function getAllHealthByClassroom(classroomId: number): HealthEntry[] {
  return getDb()
    .prepare(
      `SELECT h.student_id, h.classroom_id, h.date, h.brushed_teeth, h.drank_milk, h.weight_kg, h.height_cm
       FROM health_check h
       INNER JOIN students s ON s.id = h.student_id
       WHERE s.classroom_id = ? AND s.is_active = 1`
    )
    .all(classroomId)
    .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number; weight_kg: number | null; height_cm: number | null }) => ({
      student_id: row.student_id,
      classroom_id: row.classroom_id,
      date: row.date,
      brushed_teeth: !!row.brushed_teeth,
      drank_milk: !!row.drank_milk,
      weight_kg: row.weight_kg,
      height_cm: row.height_cm,
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
    grades: getDb().prepare('SELECT student_id, subject_code, score, midterm_score, final_score, classroom_id, semester, academic_year FROM grades').all(),
    attendance: getDb().prepare('SELECT id, student_id, classroom_id, date, status, note FROM attendance').all(),
    health_check: getDb()
      .prepare('SELECT student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm FROM health_check')
      .all()
      .map((row: { student_id: number; classroom_id: number; date: string; brushed_teeth: number; drank_milk: number; weight_kg: number | null; height_cm: number | null }) => ({
        student_id: row.student_id,
        classroom_id: row.classroom_id,
        date: row.date,
        brushed_teeth: !!row.brushed_teeth,
        drank_milk: !!row.drank_milk,
        weight_kg: row.weight_kg,
        height_cm: row.height_cm,
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
          'INSERT INTO classrooms (id, name, level, academic_year, color, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        for (const c of data.classrooms) {
          insert.run(
            c.id,
            c.name,
            c.level,
            c.academic_year,
            c.color ?? null,
            c.archived_at ?? null,
            c.created_at
          )
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
            guardian_occupation, guardian_relation, guardian_phone,
            father_title, father_first_name, father_last_name, father_occupation,
            mother_title, mother_first_name, mother_last_name, mother_occupation,
            disadvantage, source_payload, is_active, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
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
            s.guardian_occupation ?? null, s.guardian_relation ?? null, s.guardian_phone ?? null,
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
          'INSERT INTO grades (student_id, classroom_id, subject_code, score, midterm_score, final_score, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        for (const g of data.grades) {
          insert.run(g.student_id, g.classroom_id, g.subject_code, g.score, g.midterm_score || 0, g.final_score || 0, g.semester, g.academic_year)
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
          'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        for (const h of data.health_check) {
          insert.run(
            h.student_id,
            h.classroom_id,
            h.date,
            h.brushed_teeth ? 1 : 0,
            h.drank_milk ? 1 : 0,
            h.weight_kg ?? null,
            h.height_cm ?? null
          )
        }
      }
    })
    transaction()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// ─── Sprint 3: Promote students between classrooms ───────────

export function promoteStudents(fromClassroomId: number, toClassroomId: number): number {
  const d = getDb()
  const classroom = d.prepare('SELECT name FROM classrooms WHERE id = ?').get(toClassroomId) as
    | { name: string }
    | undefined
  if (!classroom) return 0
  const result = d
    .prepare(
      `UPDATE students
       SET classroom_id = ?, classroom_label = ?
       WHERE classroom_id = ? AND is_active = 1`
    )
    .run(toClassroomId, classroom.name, fromClassroomId)
  return Number(result.changes) || 0
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
