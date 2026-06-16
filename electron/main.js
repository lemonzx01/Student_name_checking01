const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const log = require('electron-log')

log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024
log.info('[Main] Starting application...')

// ─── Single-instance lock ────────────────────────────────────────────
// ป้องกันครูเปิดแอปซ้ำหลายตัว แล้วเปิด DB คนละ instance จนข้อมูลซ้อนทับ
// ถ้าได้ lock ไม่สำเร็จ (มี instance อื่นเปิดอยู่) → quit ทันที + ส่ง signal ให้
// instance เดิม focus หน้าต่าง
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  log.info('[Main] Another instance is already running, quitting...')
  app.quit()
}

let mainWindow = null
const isDev = !app.isPackaged
let db = null
let dbPath = null

// เมื่อมีคนพยายามเปิด instance ที่ 2 — focus หน้าต่างเดิม + restore ถ้า minimize
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  }
})

const STUDENT_EXTRA_COLUMNS = [
  { name: 'national_id', definition: 'TEXT' },
  { name: 'student_number', definition: 'TEXT' },
  { name: 'title', definition: 'TEXT' },
  { name: 'classroom_label', definition: 'TEXT' },
  { name: 'age_years', definition: 'TEXT' },
  { name: 'weight_kg', definition: 'REAL' },
  { name: 'height_cm', definition: 'REAL' },
  { name: 'house_no', definition: 'TEXT' },
  { name: 'village_no', definition: 'TEXT' },
  { name: 'guardian_title', definition: 'TEXT' },
  { name: 'guardian_first_name', definition: 'TEXT' },
  { name: 'guardian_last_name', definition: 'TEXT' },
  { name: 'guardian_occupation', definition: 'TEXT' },
  { name: 'guardian_relation', definition: 'TEXT' },
  { name: 'guardian_phone', definition: 'TEXT' },
  { name: 'father_title', definition: 'TEXT' },
  { name: 'father_first_name', definition: 'TEXT' },
  { name: 'father_last_name', definition: 'TEXT' },
  { name: 'father_occupation', definition: 'TEXT' },
  { name: 'mother_title', definition: 'TEXT' },
  { name: 'mother_first_name', definition: 'TEXT' },
  { name: 'mother_last_name', definition: 'TEXT' },
  { name: 'mother_occupation', definition: 'TEXT' },
  { name: 'disadvantage', definition: 'TEXT' },
  { name: 'source_payload', definition: 'TEXT' },
  { name: 'photo_path', definition: 'TEXT' },
  { name: 'deleted_at', definition: 'DATETIME' },
]

const STUDENT_COLUMNS = [
  'student_id',
  'national_id',
  'student_number',
  'title',
  'first_name',
  'last_name',
  'classroom_id',
  'classroom_label',
  'gender',
  'birth_date',
  'age_years',
  'weight_kg',
  'height_cm',
  'house_no',
  'village_no',
  'guardian_title',
  'guardian_first_name',
  'guardian_last_name',
  'guardian_occupation',
  'guardian_relation',
  'guardian_phone',
  'father_title',
  'father_first_name',
  'father_last_name',
  'father_occupation',
  'mother_title',
  'mother_first_name',
  'mother_last_name',
  'mother_occupation',
  'disadvantage',
  'source_payload',
  'photo_path',
]

function textOrNull(value) {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || null
}

function numberOrNull(value) {
  const normalized = textOrNull(value)
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function inferGender(value) {
  const normalized = textOrNull(value) || ''
  if (normalized.includes('หญิง')) {
    return 'หญิง'
  }
  if (normalized.includes('ชาย')) {
    return 'ชาย'
  }
  return ''
}

function inferLevelFromClassroom(label) {
  if (!label) {
    return 'ห้องเรียน'
  }
  if (label.startsWith('ป.')) {
    return 'ประถมศึกษา'
  }
  if (label.startsWith('ม.')) {
    return 'มัธยมศึกษา'
  }
  if (label.includes('อนุบาล')) {
    return 'อนุบาล'
  }
  return 'ห้องเรียน'
}

function currentAcademicYear() {
  return String(new Date().getFullYear() + 543)
}

function getStudentValues(payload) {
  return STUDENT_COLUMNS.map((column) => (payload[column] === undefined ? null : payload[column]))
}

function serializeSourcePayload(payload) {
  if (!payload) {
    return null
  }

  if (typeof payload === 'string') {
    return payload
  }

  try {
    return JSON.stringify(payload)
  } catch (error) {
    log.warn('[Students] Failed to serialize source payload', error)
    return null
  }
}

function getClassroomNameById(classroomId) {
  const classroom = db.prepare('SELECT name FROM classrooms WHERE id = ?').get(classroomId)
  return classroom ? classroom.name : ''
}

function normalizeStudentPayload(data, classroomName = '') {
  const studentId = textOrNull(data.student_id || data.studentId)
  const title = textOrNull(data.title)
  const gender = textOrNull(data.gender) || inferGender(title)

  return {
    student_id: studentId || '',
    national_id: textOrNull(data.national_id || data.nationalId),
    student_number: textOrNull(data.student_number || data.studentNumber) || studentId || '',
    title,
    first_name: textOrNull(data.first_name || data.firstName) || '',
    last_name: textOrNull(data.last_name || data.lastName) || '',
    classroom_id: Number(data.classroom_id),
    classroom_label: textOrNull(data.classroom_label || data.classroom || data['ชั้น']) || classroomName || null,
    gender,
    birth_date: textOrNull(data.birth_date || data.birthDate),
    age_years: textOrNull(data.age_years || data.age),
    weight_kg: numberOrNull(data.weight_kg || data.weight),
    height_cm: numberOrNull(data.height_cm || data.height),
    house_no: textOrNull(data.house_no),
    village_no: textOrNull(data.village_no),
    guardian_title: textOrNull(data.guardian_title),
    guardian_first_name: textOrNull(data.guardian_first_name),
    guardian_last_name: textOrNull(data.guardian_last_name),
    guardian_occupation: textOrNull(data.guardian_occupation),
    guardian_relation: textOrNull(data.guardian_relation),
    guardian_phone: textOrNull(data.guardian_phone),
    father_title: textOrNull(data.father_title),
    father_first_name: textOrNull(data.father_first_name),
    father_last_name: textOrNull(data.father_last_name),
    father_occupation: textOrNull(data.father_occupation),
    mother_title: textOrNull(data.mother_title),
    mother_first_name: textOrNull(data.mother_first_name),
    mother_last_name: textOrNull(data.mother_last_name),
    mother_occupation: textOrNull(data.mother_occupation),
    disadvantage: textOrNull(data.disadvantage),
    source_payload: serializeSourcePayload(data.source_payload),
    photo_path: textOrNull(data.photo_path),
  }
}

function ensureColumns(tableName, columns) {
  const existingColumns = new Set(
    db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name)
  )

  columns.forEach((column) => {
    if (!existingColumns.has(column.name)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.definition}`)
    }
  })
}

function findOrCreateClassroomByName(name) {
  const normalizedName = textOrNull(name)
  if (!normalizedName) {
    return null
  }

  const existing = db.prepare('SELECT id, name FROM classrooms WHERE name = ?').get(normalizedName)
  if (existing) {
    return existing
  }

  const insert = db
    .prepare('INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)')
    .run(normalizedName, inferLevelFromClassroom(normalizedName), currentAcademicYear())

  return {
    id: Number(insert.lastInsertRowid),
    name: normalizedName,
  }
}

function tableExists(name) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name)
  return !!row
}

function tableColumns(name) {
  return new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name))
}

// ─── Default subjects (canonical) ────────────────────────────
// **ต้อง sync กับ src/lib/constants/subjects.ts (DEFAULT_SUBJECTS) เสมอ**
// main.js เป็น CommonJS import TS ไม่ได้ จึง mirror ไว้ที่นี่ — ถ้าแก้ที่นั่นต้องแก้ที่นี่ด้วย
const CANONICAL_SUBJECTS = [
  ['ภาษาไทย', 'TH', '#3B82F6'],
  ['คณิตศาสตร์', 'MA', '#EF4444'],
  ['ภาษาอังกฤษ', 'EN', '#8B5CF6'],
  ['วิทยาศาสตร์', 'SC', '#10B981'],
  ['สังคมศึกษา', 'SO', '#F59E0B'],
  ['ประวัติศาสตร์', 'HI', '#D97706'],
  ['สุขศึกษา/พละ', 'HE', '#EC4899'],
  ['ศิลปะ', 'AR', '#06B6D4'],
  ['การงานฯ', 'WO', '#84CC16'],
]

// รหัสวิชาเก่า (seed รุ่นก่อน) → รหัส canonical — ต้อง sync กับ LEGACY_SUBJECT_CODE_MAP ใน src/lib/db.ts
const LEGACY_SUBJECT_CODE_MAP = {
  MATH: 'MA',
  SCI: 'SC',
  SOC: 'SO',
  HIS: 'HI',
  PE: 'HE',
  ART: 'AR',
  WORK: 'WO',
  ENG: 'EN',
}

// Heal ฐานข้อมูลที่เคย seed/migrate ด้วยรหัสวิชาเก่า (MATH/SCI/...) ให้ตรง canonical (MA/SC/...)
// กัน palette/ตัวนับคาบในหน้าตารางสอนจับคู่ไม่ได้ (ช่องคาบกลายเป็นเทา + โชว์รหัสดิบ + ตัวนับขึ้น 0)
// Idempotent: ถ้าไม่มีรหัสเก่าก็ไม่ทำอะไร — เรียกหลัง CREATE TABLE + seed + migrateLegacySchema
function healSubjectCodes() {
  try {
    const tx = db.transaction(() => {
      for (const [oldCode, newCode] of Object.entries(LEGACY_SUBJECT_CODE_MAP)) {
        // schedules + grades: remap ตรง ๆ (ไม่มี UNIQUE constraint)
        db.prepare('UPDATE schedules SET subject_code = ? WHERE subject_code = ?').run(newCode, oldCode)
        db.prepare('UPDATE grades SET subject_code = ? WHERE subject_code = ?').run(newCode, oldCode)
        // subjects: code เป็น UNIQUE — ถ้ารหัสใหม่มีแล้วให้ลบตัวเก่า ไม่งั้น rename
        const hasNew = db.prepare('SELECT 1 FROM subjects WHERE code = ?').get(newCode)
        if (hasNew) {
          db.prepare('DELETE FROM subjects WHERE code = ?').run(oldCode)
        } else {
          db.prepare('UPDATE subjects SET code = ? WHERE code = ?').run(newCode, oldCode)
        }
      }
      // sync name/color ให้ตรง canonical (DB subjects table ไม่ใช่ของที่ผู้ใช้แก้ — แก้ผ่าน localStorage)
      for (const [name, code, color] of CANONICAL_SUBJECTS) {
        db.prepare('UPDATE subjects SET name = ?, color = ? WHERE code = ?').run(name, color, code)
      }
    })
    tx()
  } catch (error) {
    log.warn('[Migration] heal subject codes failed:', error)
  }
}

// ─── Schema Migrations ───────────────────────────────────────
// อัปเดต DB เก่าให้ตรง schema ใหม่ (unify กับ src/lib/db.ts)
// ทำใน try/catch — ถ้า DB ใหม่ไม่มี table เก่า migration จะ skip
function migrateLegacySchema() {
  // attendance: เพิ่ม classroom_id ถ้ายังไม่มี + backfill จาก students
  try {
    if (tableExists('attendance')) {
      const cols = tableColumns('attendance')
      if (!cols.has('classroom_id')) {
        db.exec('ALTER TABLE attendance ADD COLUMN classroom_id INTEGER')
        db.exec(
          `UPDATE attendance
           SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = attendance.student_id)
           WHERE classroom_id IS NULL`
        )
        log.info('[Migration] attendance.classroom_id added + backfilled')
      }
    }
  } catch (error) {
    log.warn('[Migration] attendance migration failed:', error)
  }

  // health_check: เพิ่ม classroom_id, weight_kg, height_cm ถ้ายังไม่มี + backfill
  try {
    if (tableExists('health_check')) {
      const cols = tableColumns('health_check')
      if (!cols.has('classroom_id')) {
        db.exec('ALTER TABLE health_check ADD COLUMN classroom_id INTEGER')
        db.exec(
          `UPDATE health_check
           SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = health_check.student_id)
           WHERE classroom_id IS NULL`
        )
        log.info('[Migration] health_check.classroom_id added + backfilled')
      }
      if (!cols.has('weight_kg')) {
        db.exec('ALTER TABLE health_check ADD COLUMN weight_kg REAL')
        log.info('[Migration] health_check.weight_kg added')
      }
      if (!cols.has('height_cm')) {
        db.exec('ALTER TABLE health_check ADD COLUMN height_cm REAL')
        log.info('[Migration] health_check.height_cm added')
      }
    }
  } catch (error) {
    log.warn('[Migration] health_check migration failed:', error)
  }

  // grades: เพิ่ม classroom_id + subject_code (จาก subject) + midterm/final
  try {
    if (tableExists('grades')) {
      const cols = tableColumns('grades')
      if (!cols.has('classroom_id')) {
        db.exec('ALTER TABLE grades ADD COLUMN classroom_id INTEGER')
        db.exec(
          `UPDATE grades
           SET classroom_id = (SELECT classroom_id FROM students WHERE students.id = grades.student_id)
           WHERE classroom_id IS NULL`
        )
        log.info('[Migration] grades.classroom_id added + backfilled')
      }
      if (!cols.has('subject_code')) {
        db.exec('ALTER TABLE grades ADD COLUMN subject_code TEXT')
        if (cols.has('subject')) {
          db.exec('UPDATE grades SET subject_code = subject WHERE subject_code IS NULL')
        }
        log.info('[Migration] grades.subject_code added + backfilled')
      }
      if (!cols.has('midterm_score')) {
        db.exec('ALTER TABLE grades ADD COLUMN midterm_score REAL DEFAULT 0')
      }
      if (!cols.has('final_score')) {
        db.exec('ALTER TABLE grades ADD COLUMN final_score REAL DEFAULT 0')
      }
    }
  } catch (error) {
    log.warn('[Migration] grades migration failed:', error)
  }

  // schedule (เก่า) → schedules (ใหม่)
  try {
    if (tableExists('schedule') && !tableExists('schedules')) {
      log.info('[Migration] Migrating schedule → schedules ...')
      db.exec(`
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
        )
      `)
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
        oldRows.forEach((r) =>
          insert.run(
            r.classroom_id,
            r.day_of_week,
            r.period,
            r.subject_code,
            r.subject_name,
            r.class_level,
            r.room
          )
        )
      })
      tx()
      db.exec('DROP TABLE schedule')
      log.info(`[Migration] Migrated ${oldRows.length} schedule rows → schedules`)
    }
  } catch (error) {
    log.warn('[Migration] schedule → schedules failed:', error)
  }
}

function initDatabase() {
  try {
    const Database = require('better-sqlite3')
    dbPath = isDev
      ? path.join(process.cwd(), 'school.db')
      : path.join(app.getPath('userData'), 'school.db')

    log.info('[DB] Opening:', dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // CREATE TABLE schema — ตรงกับ src/lib/db.ts (unified schema)
    db.exec(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        level TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        color TEXT,
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

      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL
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

      CREATE TABLE IF NOT EXISTS student_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );

      CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
      CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
      CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON attendance(classroom_id, date);
      CREATE INDEX IF NOT EXISTS idx_health_classroom_date ON health_check(classroom_id, date);
      CREATE INDEX IF NOT EXISTS idx_grades_classroom ON grades(classroom_id, semester, academic_year);
      CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON schedules(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, date DESC);
    `)

    // legacy column migrations (สำหรับ schema เดิมของ Electron) — ทำหลัง CREATE TABLE IF NOT EXISTS
    ensureColumns('students', STUDENT_EXTRA_COLUMNS)
    ensureColumns('classrooms', [
      { name: 'color', definition: 'TEXT' },
      { name: 'archived_at', definition: 'DATETIME' },
    ])
    db.exec('CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number)')

    // Migration ของ schema เก่า (DB ที่ user เคยใช้ Electron version เก่า)
    migrateLegacySchema()

    const subjectCount = db.prepare('SELECT COUNT(*) AS count FROM subjects').get()
    if (subjectCount.count === 0) {
      const insertSubject = db.prepare('INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)')
      CANONICAL_SUBJECTS.forEach((subject) => insertSubject.run(subject[0], subject[1], subject[2]))
    }

    // Heal รหัสวิชาเก่า → canonical (ดู healSubjectCodes) — idempotent, ทำหลัง seed + legacy migration
    healSubjectCodes()

    log.info('[DB] Initialized successfully')
    return true
  } catch (error) {
    log.error('[DB] Init error:', error)
    return false
  }
}

// ─── Auto-backup System ──────────────────────────────────────────────
// ก๊อปปี้ไฟล์ school.db ไปเก็บเป็น backups/school_YYYY-MM-DD.db ทุกครั้งที่เปิดแอป
// เก็บย้อนหลัง 30 วันล่าสุด (ลบอันเก่ากว่านั้นอัตโนมัติ)

const BACKUP_RETENTION_DAYS = 30
// ไฟล์ daily backup รูปแบบ school_YYYY-MM-DD.db
const BACKUP_FILE_PATTERN = /^school_\d{4}-\d{2}-\d{2}\.db$/
// ไฟล์ snapshot ก่อน destructive op รูปแบบ school_before_<reason>_YYYYMMDD_HHMMSS.db
const SNAPSHOT_FILE_PATTERN = /^school_before_[a-z_]+_\d{8}_\d{6}\.db$/
// รวมทุก backup file ที่จะให้ผู้ใช้กู้คืนได้
const ALL_BACKUP_PATTERN = new RegExp(
  `${BACKUP_FILE_PATTERN.source.slice(1, -1)}|${SNAPSHOT_FILE_PATTERN.source.slice(1, -1)}`
)

function getBackupDir() {
  if (!dbPath) return null
  return path.join(path.dirname(dbPath), 'backups')
}

function getBackupFiles() {
  const dir = getBackupDir()
  if (!dir || !fs.existsSync(dir)) return []
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => BACKUP_FILE_PATTERN.test(f))
      .sort() // YYYY-MM-DD ทำให้เรียงจากเก่าไปใหม่ตาม string sort ได้เลย
      .reverse() // ใหม่สุดไว้หัว
  } catch (error) {
    log.error('[Backup] Failed to read backup dir:', error)
    return []
  }
}

function localDateString() {
  // ใช้เวลาท้องถิ่น (ไม่ใช่ UTC) เพื่อให้ "วันนี้" ของครูตรงกับเวลาไทย
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// สร้าง snapshot ของ DB ปัจจุบัน เก็บลง backups/<prefix>_<timestamp>.db
// ใช้ก่อนทำ destructive operation (restore / clear-all / delete-classroom)
// คืน path ของไฟล์ที่สร้าง หรือ null ถ้าสร้างไม่ได้
// ใช้ db.backup() ของ better-sqlite3 — รวม WAL pending writes (atomic)
function createSnapshot(prefix) {
  try {
    if (!dbPath || !fs.existsSync(dbPath)) {
      log.warn('[Backup] DB file not found, cannot snapshot')
      return null
    }
    const backupDir = getBackupDir()
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    // timestamp format: YYYYMMDD_HHMMSS (เรียง sort ได้)
    const now = new Date()
    const ts =
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}` +
      `_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const fileName = `${prefix}_${ts}.db`
    const fullPath = path.join(backupDir, fileName)
    if (db && typeof db.backup === 'function') {
      // backup() เป็น async — รอผลก่อนคืน path ไม่ได้ เพราะ caller ไม่ใช่ async
      // ใช้ checkpoint แล้ว copyFile ภายใต้ writer lock เพื่อให้ atomic แทน
      try {
        db.pragma('wal_checkpoint(FULL)')
      } catch (err) {
        log.warn('[Backup] wal_checkpoint failed:', err)
      }
    }
    fs.copyFileSync(dbPath, fullPath)
    log.info('[Backup] Snapshot created:', fileName)
    return fullPath
  } catch (error) {
    log.error('[Backup] createSnapshot failed:', error)
    return null
  }
}

// Auto-purge: ลบนักเรียนใน trash ที่เก่ากว่า 30 วันถาวร
function autoPurgeOldTrash() {
  try {
    if (!db) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ')
    const ids = db
      .prepare(
        "SELECT id FROM students WHERE is_active = 0 AND deleted_at IS NOT NULL AND deleted_at < ?"
      )
      .all(cutoffStr)
      .map((r) => r.id)
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...ids)
      db.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...ids)
      db.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...ids)
      db.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...ids)
      db.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...ids)
    })
    tx()
    log.info(`[Trash] Auto-purged ${ids.length} old students (>30 days)`)
  } catch (error) {
    log.error('[Trash] autoPurgeOldTrash failed:', error)
  }
}

function runDailyBackup() {
  try {
    if (!dbPath || !fs.existsSync(dbPath)) {
      log.warn('[Backup] DB file not found, skipping backup')
      return
    }

    const backupDir = getBackupDir()
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
      log.info('[Backup] Created backup directory:', backupDir)
    }

    const today = localDateString()
    const todayFile = path.join(backupDir, `school_${today}.db`)

    // ถ้ามีไฟล์ของวันนี้แล้ว แปลว่า backup ไปแล้ว (เปิดแอปรอบที่ 2 ในวันเดียวกัน) ข้าม
    if (!fs.existsSync(todayFile)) {
      // checkpoint WAL ก่อน copy เพื่อให้ backup เก็บข้อมูลล่าสุด (atomic)
      try {
        if (db) db.pragma('wal_checkpoint(FULL)')
      } catch (err) {
        log.warn('[Backup] daily wal_checkpoint failed:', err)
      }
      fs.copyFileSync(dbPath, todayFile)
      log.info('[Backup] Created daily backup:', todayFile)
    } else {
      log.info('[Backup] Today backup already exists, skipping')
    }

    // ลบไฟล์เก่ากว่า 30 วัน
    const files = getBackupFiles()
    const toDelete = files.slice(BACKUP_RETENTION_DAYS)
    toDelete.forEach((fileName) => {
      try {
        fs.unlinkSync(path.join(backupDir, fileName))
        log.info('[Backup] Deleted old backup:', fileName)
      } catch (error) {
        log.warn('[Backup] Failed to delete old backup:', fileName, error)
      }
    })
  } catch (error) {
    log.error('[Backup] runDailyBackup failed:', error)
  }
}

function createWindow() {
  log.info('[Main] Creating window...')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: true,
    show: false,
  })

  // กัน renderer เปิด external URL ผ่าน window.open / target=_blank
  // → ส่งให้ default browser แทน, กันโดน redirect ออกไปไซต์อันตราย
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('file://')) {
      return { action: 'allow' }
    }
    shell.openExternal(url).catch((err) => log.warn('[Main] openExternal failed:', err))
    return { action: 'deny' }
  })

  // กัน navigation ไปยัง URL ภายนอก (เช่น XSS ที่เปลี่ยน location.href)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url).catch((err) => log.warn('[Main] openExternal failed:', err))
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    log.info('[Main] Window shown')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // Packaging: ต้อง build ด้วย Next.js static export (`output: 'export'` ใน next.config.js)
    // ทำให้ Next.js สร้างไฟล์ลง /out/ — Electron โหลด index.html ตรงๆ
    // หลัง build แล้ว /api/* จะใช้งานไม่ได้ — ทุก data flow ต้องผ่าน IPC (electronAPI)
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupIpcHandlers() {
  ipcMain.handle('get-classrooms', () => {
    return db
      .prepare(`
        SELECT c.*, COUNT(s.id) AS student_count
        FROM classrooms c
        LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1
        WHERE c.archived_at IS NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC, c.id DESC
      `)
      .all()
  })

  ipcMain.handle('get-archived-classrooms', () => {
    return db
      .prepare(`
        SELECT c.*, COUNT(s.id) AS student_count
        FROM classrooms c
        LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1
        WHERE c.archived_at IS NOT NULL
        GROUP BY c.id
        ORDER BY c.archived_at DESC
      `)
      .all()
  })

  ipcMain.handle('archive-classroom', (event, id) => {
    try {
      db.prepare('UPDATE classrooms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(Number(id))
      return { success: true }
    } catch (error) {
      log.error('[archive-classroom] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unarchive-classroom', (event, id) => {
    try {
      db.prepare('UPDATE classrooms SET archived_at = NULL WHERE id = ?').run(Number(id))
      return { success: true }
    } catch (error) {
      log.error('[unarchive-classroom] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('promote-students', (event, { fromClassroomId, toClassroomId }) => {
    try {
      const classroom = db
        .prepare('SELECT name FROM classrooms WHERE id = ?')
        .get(Number(toClassroomId))
      if (!classroom) return { success: false, moved: 0, error: 'ไม่พบห้องปลายทาง' }
      const result = db
        .prepare(
          `UPDATE students
           SET classroom_id = ?, classroom_label = ?
           WHERE classroom_id = ? AND is_active = 1`
        )
        .run(Number(toClassroomId), classroom.name, Number(fromClassroomId))
      return { success: true, moved: Number(result.changes) || 0 }
    } catch (error) {
      log.error('[promote-students] failed:', error)
      return { success: false, moved: 0, error: error.message }
    }
  })

  ipcMain.handle('create-classroom', (event, { name, level, academic_year, color }) => {
    const normalizedName = textOrNull(name)
    if (!normalizedName) {
      throw new Error('Missing classroom name')
    }

    const existing = db.prepare('SELECT * FROM classrooms WHERE name = ?').get(normalizedName)
    if (existing) {
      return existing
    }

    const result = db
      .prepare('INSERT INTO classrooms (name, level, academic_year, color) VALUES (?, ?, ?, ?)')
      .run(normalizedName, textOrNull(level) || 'ห้องเรียน', textOrNull(academic_year) || currentAcademicYear(), textOrNull(color))

    return {
      id: Number(result.lastInsertRowid),
      name: normalizedName,
      level: textOrNull(level) || 'ห้องเรียน',
      academic_year: textOrNull(academic_year) || currentAcademicYear(),
      color: textOrNull(color),
    }
  })

  ipcMain.handle('update-classroom', (event, { id, name, level, academic_year, color }) => {
    const normalizedName = textOrNull(name)
    if (!id || !normalizedName) {
      throw new Error('Missing classroom data')
    }

    // preserve color เมื่อ color undefined (ไม่ได้ส่งมา) — ดึงจาก DB เดิม
    const current = db.prepare('SELECT color FROM classrooms WHERE id = ?').get(id)
    const newColor =
      color === undefined ? (current ? current.color : null) : (textOrNull(color) || null)

    db.prepare('UPDATE classrooms SET name = ?, level = ?, academic_year = ?, color = ? WHERE id = ?').run(
      normalizedName,
      textOrNull(level) || 'ห้องเรียน',
      textOrNull(academic_year) || currentAcademicYear(),
      newColor,
      id
    )
    db.prepare('UPDATE students SET classroom_label = ? WHERE classroom_id = ?').run(normalizedName, id)

    return { success: true }
  })

  ipcMain.handle('delete-classroom', (event, id) => {
    // สร้าง snapshot ก่อนลบ — ถ้าครูเผลอลบจะกู้คืนได้
    createSnapshot('school_before_delete_classroom')
    // ใช้ transaction — atomic, rollback ถ้าขั้นใดล้มเหลว
    const tx = db.transaction(() => {
      const studentIds = db
        .prepare('SELECT id FROM students WHERE classroom_id = ?')
        .all(id)
        .map((r) => r.id)

      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '?').join(',')
        db.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...studentIds)
        db.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...studentIds)
        db.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...studentIds)
        db.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...studentIds)
      }
      db.prepare('DELETE FROM students WHERE classroom_id = ?').run(id)
      db.prepare('DELETE FROM schedules WHERE classroom_id = ?').run(id)
      db.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
    })
    tx()
    return { success: true }
  })

  ipcMain.handle('get-students', (event, classroomId) => {
    if (classroomId) {
      return db
        .prepare(`
          SELECT s.*, c.name AS classroom_name
          FROM students s
          LEFT JOIN classrooms c ON c.id = s.classroom_id
          WHERE s.classroom_id = ? AND s.is_active = 1
          ORDER BY COALESCE(NULLIF(s.student_number, ''), s.student_id)
        `)
        .all(classroomId)
    }

    return db
      .prepare(`
        SELECT s.*, c.name AS classroom_name
        FROM students s
        LEFT JOIN classrooms c ON c.id = s.classroom_id
        WHERE s.is_active = 1
        ORDER BY c.name, COALESCE(NULLIF(s.student_number, ''), s.student_id)
      `)
      .all()
  })

  ipcMain.handle('create-student', (event, data) => {
    const classroomName = getClassroomNameById(Number(data.classroom_id))
    const payload = normalizeStudentPayload(data, classroomName)

    const existing = db.prepare('SELECT id FROM students WHERE student_id = ?').get(payload.student_id)

    if (existing) {
      db.prepare(`UPDATE students SET ${STUDENT_COLUMNS.map((column) => `${column} = ?`).join(', ')}, is_active = 1 WHERE id = ?`).run(
        ...getStudentValues(payload),
        existing.id
      )

      return {
        ...payload,
        id: existing.id,
        is_active: 1,
      }
    }

    const result = db
      .prepare(`
        INSERT INTO students (${STUDENT_COLUMNS.join(', ')}, is_active)
        VALUES (${STUDENT_COLUMNS.map(() => '?').join(', ')}, 1)
      `)
      .run(...getStudentValues(payload))

    return {
      ...payload,
      id: Number(result.lastInsertRowid),
      is_active: 1,
    }
  })

  ipcMain.handle('update-student', (event, { id, ...data }) => {
    if (!id) {
      throw new Error('Missing student id')
    }

    const classroomName = getClassroomNameById(Number(data.classroom_id))
    const payload = normalizeStudentPayload(data, classroomName)

    db.prepare(`UPDATE students SET ${STUDENT_COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(
      ...getStudentValues(payload),
      id
    )

    return { success: true }
  })

  ipcMain.handle('delete-student', (event, id) => {
    db.prepare(
      'UPDATE students SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id)
    return { success: true }
  })

  // Student Notes (บันทึกประจำตัวนักเรียน)
  ipcMain.handle('get-student-notes', (event, studentId) => {
    return db
      .prepare(
        'SELECT id, student_id, date, note, created_at FROM student_notes WHERE student_id = ? ORDER BY date DESC, id DESC'
      )
      .all(Number(studentId))
  })

  ipcMain.handle('add-student-note', (event, { student_id, date, note }) => {
    // ตรวจ input ให้ตรงกับ Web API (POST /notes) — reject empty หลัง trim
    const sid = Number(student_id)
    const dateStr = String(date || '').trim()
    const noteStr = String(note || '').trim()
    if (!Number.isInteger(sid) || sid <= 0 || !dateStr || !noteStr) {
      throw new Error('student_id, date และ note ต้องไม่ว่าง')
    }
    const result = db
      .prepare('INSERT INTO student_notes (student_id, date, note) VALUES (?, ?, ?)')
      .run(sid, dateStr, noteStr)
    return db.prepare('SELECT * FROM student_notes WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('delete-student-note', (event, id) => {
    db.prepare('DELETE FROM student_notes WHERE id = ?').run(Number(id))
    return { success: true }
  })

  ipcMain.handle('get-attendance', (event, { date, classroom }) => {
    return db
      .prepare(`
        SELECT s.id, s.student_id, s.student_number, s.title, s.first_name, s.last_name,
               s.photo_path, s.guardian_phone, a.status, a.note
        FROM students s
        LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
        WHERE s.classroom_id = ? AND s.is_active = 1
        ORDER BY COALESCE(NULLIF(s.student_number, ''), s.student_id)
      `)
      .all(date, classroom)
      .map((row) => ({
        ...row,
        status: row.status || 'มา',
        note: row.note || '',
      }))
  })

  ipcMain.handle('get-attendance-dates', (event, { classroom, yearMonth }) => {
    return db
      .prepare('SELECT DISTINCT date FROM attendance WHERE classroom_id = ? AND date LIKE ?')
      .all(classroom, `${yearMonth}%`)
      .map((row) => row.date)
  })

  ipcMain.handle('save-attendance', (event, { date, classroom, attendance = {}, health = {} }) => {
    const tx = db.transaction(() => {
      // Attendance — DELETE+INSERT ใช้ classroom_id ตรงๆ (เร็วและตรงกว่า)
      db.prepare('DELETE FROM attendance WHERE classroom_id = ? AND date = ?').run(classroom, date)

      const insertAttendance = db.prepare(
        'INSERT INTO attendance (student_id, classroom_id, date, status, note) VALUES (?, ?, ?, ?, ?)'
      )
      Object.entries(attendance).forEach(([studentId, entry]) => {
        insertAttendance.run(
          Number(studentId),
          classroom,
          date,
          entry.status || 'มา',
          entry.note || ''
        )
      })

      // Health — บันทึกเฉพาะกรณีที่ส่งมา (อย่าลบทิ้งถ้า empty object)
      if (Object.keys(health).length > 0) {
        db.prepare('DELETE FROM health_check WHERE classroom_id = ? AND date = ?').run(classroom, date)
        const insertHealth = db.prepare(
          'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        Object.entries(health).forEach(([studentId, entry]) => {
          insertHealth.run(
            Number(studentId),
            classroom,
            date,
            entry.brushed_teeth ? 1 : 0,
            entry.drank_milk ? 1 : 0,
            entry.weight_kg ?? null,
            entry.height_cm ?? null
          )
        })
      }
    })
    tx()

    return { success: true }
  })

  ipcMain.handle('get-grades', (event, { classroom, semester, year }) => {
    return db
      .prepare(`
        SELECT s.id, s.student_id, s.first_name, s.last_name,
               g.subject_code, g.score, g.midterm_score, g.final_score
        FROM students s
        LEFT JOIN grades g ON g.student_id = s.id AND g.semester = ? AND g.academic_year = ?
        WHERE s.classroom_id = ? AND s.is_active = 1
        ORDER BY COALESCE(NULLIF(s.student_number, ''), s.student_id)
      `)
      .all(semester, year, classroom)
  })

  ipcMain.handle('save-grades', (event, { classroom, semester, year, grades }) => {
    const tx = db.transaction(() => {
      const deleteByStudent = db.prepare(
        'DELETE FROM grades WHERE student_id = ? AND semester = ? AND academic_year = ?'
      )
      const insertGrade = db.prepare(
        'INSERT INTO grades (student_id, classroom_id, subject_code, semester, academic_year, score, midterm_score, final_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )

      Object.entries(grades).forEach(([studentId, subjectMap]) => {
        deleteByStudent.run(Number(studentId), semester, year)
        Object.entries(subjectMap).forEach(([subjectCode, entry]) => {
          const midterm =
            entry && typeof entry === 'object' ? entry.midterm || 0 : Number(entry) || 0
          const final_ = entry && typeof entry === 'object' ? entry.final || 0 : 0
          const score = midterm + final_
          if (score > 0 || midterm > 0 || final_ > 0) {
            insertGrade.run(
              Number(studentId),
              classroom,
              subjectCode,
              semester,
              year,
              score,
              midterm,
              final_
            )
          }
        })
      })
    })
    tx()

    return { success: true }
  })

  ipcMain.handle('get-schedule', (event, classroom) => {
    return db
      .prepare(
        `SELECT classroom_id, day_of_week, period, subject_code, subject_name, class_level, room
         FROM schedules
         WHERE classroom_id = ?
         ORDER BY day_of_week, period`
      )
      .all(classroom)
  })

  ipcMain.handle('save-schedule', (event, { classroom, schedule }) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM schedules WHERE classroom_id = ?').run(classroom)
      const insertSchedule = db.prepare(
        'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )

      Object.entries(schedule).forEach(([key, entry]) => {
        const [day, period] = key.split('-').map(Number)
        insertSchedule.run(
          classroom,
          day,
          period,
          entry.subject_code || '',
          entry.subject_name || '',
          entry.class_level || '',
          entry.room || ''
        )
      })
    })
    tx()

    return { success: true }
  })

  // ─── Health Check (สุขภาพประจำวัน) ───────────────────────
  ipcMain.handle('get-health', (event, { classroom, date }) => {
    return db
      .prepare(
        `SELECT student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm
         FROM health_check
         WHERE classroom_id = ? AND date = ?`
      )
      .all(classroom, date)
      .map((row) => ({
        student_id: row.student_id,
        classroom_id: row.classroom_id,
        date: row.date,
        brushed_teeth: !!row.brushed_teeth,
        drank_milk: !!row.drank_milk,
        weight_kg: row.weight_kg,
        height_cm: row.height_cm,
      }))
  })

  ipcMain.handle('save-health', (event, { classroom, date, entries }) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM health_check WHERE classroom_id = ? AND date = ?').run(classroom, date)
      const insert = db.prepare(
        'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      for (const entry of entries || []) {
        insert.run(
          Number(entry.student_id),
          classroom,
          date,
          entry.brushed_teeth ? 1 : 0,
          entry.drank_milk ? 1 : 0,
          entry.weight_kg ?? null,
          entry.height_cm ?? null
        )
      }
    })
    tx()
    return { success: true }
  })

  ipcMain.handle('get-all-health', (event, classroomId) => {
    return db
      .prepare(
        `SELECT h.student_id, h.classroom_id, h.date, h.brushed_teeth, h.drank_milk, h.weight_kg, h.height_cm
         FROM health_check h
         INNER JOIN students s ON s.id = h.student_id
         WHERE s.classroom_id = ? AND s.is_active = 1`
      )
      .all(classroomId)
      .map((row) => ({
        student_id: row.student_id,
        classroom_id: row.classroom_id,
        date: row.date,
        brushed_teeth: !!row.brushed_teeth,
        drank_milk: !!row.drank_milk,
        weight_kg: row.weight_kg,
        height_cm: row.height_cm,
      }))
  })

  ipcMain.handle('get-attendance-all', (event, classroomId) => {
    return db
      .prepare('SELECT * FROM attendance WHERE classroom_id = ?')
      .all(classroomId)
  })

  ipcMain.handle('search-students', (event, query) => {
    const q = String(query || '').trim()
    if (q.length < 2) return []
    const like = `%${q}%`
    return db
      .prepare(
        `SELECT s.*, c.name AS classroom_name
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.classroom_id
         WHERE s.is_active = 1
           AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ? OR s.student_number LIKE ?)
         ORDER BY c.name, COALESCE(NULLIF(s.student_number, ''), s.student_id)
         LIMIT 50`
      )
      .all(like, like, like, like)
  })

  ipcMain.handle('clear-all-data', () => {
    // สร้าง snapshot ก่อนลบทั้งหมด — กันครูเผลอกดผิดแล้วข้อมูลหายทั้งระบบ
    createSnapshot('school_before_clear')
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM student_notes').run()
      db.prepare('DELETE FROM health_check').run()
      db.prepare('DELETE FROM grades').run()
      db.prepare('DELETE FROM attendance').run()
      db.prepare('DELETE FROM schedules').run()
      db.prepare('DELETE FROM students').run()
      db.prepare('DELETE FROM classrooms').run()
    })
    tx()
    return { success: true }
  })

  ipcMain.handle('rename-subject-code', (event, { from, to }) => {
    if (!from || !to || from === to) {
      return { gradesUpdated: 0, schedulesUpdated: 0 }
    }
    const tx = db.transaction(() => {
      const g = db.prepare('UPDATE grades SET subject_code = ? WHERE subject_code = ?').run(to, from)
      const s = db
        .prepare('UPDATE schedules SET subject_code = ? WHERE subject_code = ?')
        .run(to, from)
      return {
        gradesUpdated: Number(g.changes) || 0,
        schedulesUpdated: Number(s.changes) || 0,
      }
    })
    return tx()
  })

  ipcMain.handle('rename-subject-name', (event, { code, newName }) => {
    if (!code || !newName) return { updated: 0 }
    const result = db
      .prepare('UPDATE schedules SET subject_name = ? WHERE subject_code = ?')
      .run(newName, code)
    return { updated: Number(result.changes) || 0 }
  })

  ipcMain.handle('export-data', () => {
    return {
      classrooms: db.prepare('SELECT * FROM classrooms').all(),
      students: db.prepare('SELECT * FROM students').all(),
      subjects: db.prepare('SELECT * FROM subjects').all(),
      grades: db
        .prepare(
          'SELECT id, student_id, classroom_id, subject_code, score, midterm_score, final_score, semester, academic_year FROM grades'
        )
        .all(),
      schedule: db
        .prepare(
          'SELECT classroom_id, day_of_week, period, subject_code, subject_name, class_level, room FROM schedules'
        )
        .all(),
      attendance: db
        .prepare('SELECT id, student_id, classroom_id, date, status, note FROM attendance')
        .all(),
      health_check: db
        .prepare(
          'SELECT student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm FROM health_check'
        )
        .all(),
      exported_at: new Date().toISOString(),
      version: '2.0',
    }
  })

  ipcMain.handle('import-data', (event, data) => {
    try {
      const { classrooms, students, subjects, grades, schedule, attendance, health_check } = data

      // snapshot ก่อน destructive import — กู้คืนได้ถ้าครู import ผิดไฟล์
      const snapshotPath = createSnapshot('before_import')
      if (snapshotPath) {
        log.info('[Import] Pre-import snapshot:', snapshotPath)
      }

      const tx = db.transaction(() => {
        db.prepare('DELETE FROM student_notes').run()
        db.prepare('DELETE FROM attendance').run()
        db.prepare('DELETE FROM health_check').run()
        db.prepare('DELETE FROM grades').run()
        db.prepare('DELETE FROM schedules').run()
        db.prepare('DELETE FROM students').run()
        db.prepare('DELETE FROM subjects').run()
        db.prepare('DELETE FROM classrooms').run()

        if (classrooms) {
          const insertClassroom = db.prepare(
            'INSERT INTO classrooms (id, name, level, academic_year, color, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          classrooms.forEach((classroom) =>
            insertClassroom.run(
              classroom.id,
              classroom.name,
              classroom.level,
              classroom.academic_year,
              classroom.color ?? null,
              classroom.created_at || new Date().toISOString()
            )
          )
        }

        if (subjects) {
          const insertSubject = db.prepare(
            'INSERT INTO subjects (id, name, code, color) VALUES (?, ?, ?, ?)'
          )
          subjects.forEach((subject) =>
            insertSubject.run(subject.id, subject.name, subject.code, subject.color)
          )
        }

        if (students) {
          const insertStudent = db.prepare(`
            INSERT INTO students (id, ${STUDENT_COLUMNS.join(', ')}, is_active, created_at)
            VALUES (?, ${STUDENT_COLUMNS.map(() => '?').join(', ')}, ?, ?)
          `)

          students.forEach((student) => {
            const payload = normalizeStudentPayload(student, student.classroom_label || '')
            insertStudent.run(
              student.id,
              ...getStudentValues({
                ...payload,
                classroom_id: Number(student.classroom_id),
              }),
              student.is_active ?? 1,
              student.created_at || new Date().toISOString()
            )
          })
        }

        if (grades) {
          const insertGrade = db.prepare(
            'INSERT INTO grades (student_id, classroom_id, subject_code, score, midterm_score, final_score, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          grades.forEach((grade) => {
            // รองรับ legacy field name (subject) จาก export เก่า
            const subjectCode = grade.subject_code || grade.subject || ''
            const midterm = grade.midterm_score ?? 0
            const final_ = grade.final_score ?? 0
            const score = grade.score ?? midterm + final_
            insertGrade.run(
              grade.student_id,
              grade.classroom_id ?? null,
              subjectCode,
              score,
              midterm,
              final_,
              grade.semester,
              grade.academic_year
            )
          })
        }

        if (schedule) {
          const insertSchedule = db.prepare(
            'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          schedule.forEach((entry) =>
            insertSchedule.run(
              entry.classroom_id,
              entry.day_of_week,
              entry.period,
              entry.subject_code || '',
              entry.subject_name || '',
              entry.class_level || '',
              entry.room || ''
            )
          )
        }

        if (attendance) {
          const insertAttendance = db.prepare(
            'INSERT INTO attendance (student_id, classroom_id, date, status, note) VALUES (?, ?, ?, ?, ?)'
          )
          attendance.forEach((entry) =>
            insertAttendance.run(
              entry.student_id,
              entry.classroom_id ?? null,
              entry.date,
              entry.status,
              entry.note ?? ''
            )
          )
        }

        if (health_check) {
          const insertHealth = db.prepare(
            'INSERT INTO health_check (student_id, classroom_id, date, brushed_teeth, drank_milk, weight_kg, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          health_check.forEach((entry) =>
            insertHealth.run(
              entry.student_id,
              entry.classroom_id ?? null,
              entry.date,
              entry.brushed_teeth ? 1 : 0,
              entry.drank_milk ? 1 : 0,
              entry.weight_kg ?? null,
              entry.height_cm ?? null
            )
          )
        }
      })
      tx()

      return { success: true }
    } catch (error) {
      log.error('[Import] Error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('import-students-excel', (event, students) => {
    try {
      let importedCount = 0
      let updatedCount = 0
      let skippedCount = 0
      let classroomsCreated = 0

      const findStudent = db.prepare('SELECT id FROM students WHERE student_id = ?')
      const findClassroom = db.prepare('SELECT id, name FROM classrooms WHERE name = ?')
      const createClassroom = db.prepare(
        'INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)'
      )
      const insertStudent = db.prepare(`
        INSERT INTO students (${STUDENT_COLUMNS.join(', ')}, is_active)
        VALUES (${STUDENT_COLUMNS.map(() => '?').join(', ')}, 1)
      `)
      const updateStudent = db.prepare(`
        UPDATE students
        SET ${STUDENT_COLUMNS.map((column) => `${column} = ?`).join(', ')}, is_active = 1
        WHERE id = ?
      `)

      students.forEach((student) => {
        const classroomLabel = textOrNull(student.classroom_label || student.classroom || student['ชั้น'])
        const studentId = textOrNull(student.student_id || student.studentId)
        const firstName = textOrNull(student.first_name || student.firstName)
        const lastName = textOrNull(student.last_name || student.lastName)

        if (!classroomLabel || !studentId || !firstName || !lastName) {
          skippedCount += 1
          return
        }

        let classroom = findClassroom.get(classroomLabel)
        if (!classroom) {
          const created = createClassroom.run(
            classroomLabel,
            inferLevelFromClassroom(classroomLabel),
            currentAcademicYear()
          )
          classroom = {
            id: Number(created.lastInsertRowid),
            name: classroomLabel,
          }
          classroomsCreated += 1
        }

        const payload = normalizeStudentPayload(
          {
            ...student,
            student_id: studentId,
            first_name: firstName,
            last_name: lastName,
            classroom_id: classroom.id,
            classroom_label: classroom.name,
          },
          classroom.name
        )

        const existing = findStudent.get(payload.student_id)
        if (existing) {
          updateStudent.run(...getStudentValues(payload), existing.id)
          updatedCount += 1
          return
        }

        insertStudent.run(...getStudentValues(payload))
        importedCount += 1
      })

      return {
        success: true,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        classroomsCreated,
      }
    } catch (error) {
      log.error('[Import Students Excel] Error:', error)
      return { success: false, error: error.message, imported: 0, updated: 0, skipped: 0, classroomsCreated: 0 }
    }
  })

  // ─── Backup IPC ─────────────────────────────────────────────
  ipcMain.handle('get-backup-info', () => {
    try {
      const dir = getBackupDir()
      const files = getBackupFiles()
      if (files.length === 0) {
        return { lastBackup: null, count: 0, folder: dir }
      }
      const latest = files[0]
      const stats = fs.statSync(path.join(dir, latest))
      return {
        lastBackup: stats.mtime.toISOString(),
        count: files.length,
        folder: dir,
      }
    } catch (error) {
      log.error('[Backup] get-backup-info failed:', error)
      return { lastBackup: null, count: 0, folder: null, error: error.message }
    }
  })

  ipcMain.handle('open-backup-folder', async () => {
    try {
      const dir = getBackupDir()
      if (!dir) {
        return { success: false, error: 'Backup directory not ready' }
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // shell.openPath returns '' on success, error string on failure
      const result = await shell.openPath(dir)
      if (result) {
        return { success: false, error: result }
      }
      return { success: true, folder: dir }
    } catch (error) {
      log.error('[Backup] open-backup-folder failed:', error)
      return { success: false, error: error.message }
    }
  })

  // ─── Restore-backup / List-backups ──────────────────────────
  // คืน list ของไฟล์ backup ทั้ง daily + snapshot ที่อยู่ใน backupDir
  ipcMain.handle('list-backups', () => {
    try {
      const dir = getBackupDir()
      if (!dir || !fs.existsSync(dir)) return []
      const files = fs
        .readdirSync(dir)
        .filter((f) => ALL_BACKUP_PATTERN.test(f))
      const items = files.map((fileName) => {
        const full = path.join(dir, fileName)
        const stats = fs.statSync(full)
        return {
          fileName,
          date: stats.mtime.toISOString(),
          sizeBytes: stats.size,
        }
      })
      // ใหม่สุดอยู่ก่อน
      items.sort((a, b) => (a.date < b.date ? 1 : -1))
      return items
    } catch (error) {
      log.error('[Backup] list-backups failed:', error)
      return []
    }
  })

  // กู้คืนไฟล์ backup: snapshot ปัจจุบัน → copy backup ทับ → relaunch
  ipcMain.handle('restore-backup', async (event, fileName) => {
    try {
      const dir = getBackupDir()
      if (!dir || !fs.existsSync(dir)) {
        return { success: false, error: 'ไม่พบโฟลเดอร์สำรอง' }
      }
      // ปลอดภัยจาก path traversal — รับเฉพาะชื่อไฟล์ที่ match pattern
      if (!ALL_BACKUP_PATTERN.test(fileName)) {
        return { success: false, error: 'ชื่อไฟล์ไม่ถูกต้อง' }
      }
      const source = path.join(dir, fileName)
      if (!fs.existsSync(source)) {
        return { success: false, error: 'ไฟล์สำรองที่เลือกไม่มีอยู่' }
      }

      // เก็บ snapshot ของข้อมูลปัจจุบันก่อนทับ — กันกรณีกู้คืนผิดไฟล์
      createSnapshot('school_before_restore')

      // ปิด DB ก่อน copy (Windows file lock)
      if (db) {
        try {
          db.close()
          log.info('[Restore] DB closed before copy')
        } catch (err) {
          log.warn('[Restore] DB close failed:', err)
        }
        db = null
      }

      // คัดลอกไฟล์ backup ทับ school.db
      fs.copyFileSync(source, dbPath)
      log.info('[Restore] Restored from:', fileName)

      // ลบไฟล์ WAL/SHM ถ้ามี (ของ DB เดิม) — หลัง restore จะถูกสร้างใหม่
      try {
        const wal = `${dbPath}-wal`
        const shm = `${dbPath}-shm`
        if (fs.existsSync(wal)) fs.unlinkSync(wal)
        if (fs.existsSync(shm)) fs.unlinkSync(shm)
      } catch (err) {
        log.warn('[Restore] Cleanup WAL/SHM failed:', err)
      }

      // Relaunch แอป — re-init ทุกอย่าง ปลอดภัยกว่า reopen DB ใน process เดิม
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 200)

      return { success: true }
    } catch (error) {
      log.error('[Backup] restore-backup failed:', error)
      return { success: false, error: error.message || 'กู้คืนไม่สำเร็จ' }
    }
  })

  // คืนสถิติของห้อง — ใช้แสดงผลกระทบก่อนลบใน confirm dialog
  ipcMain.handle('get-classroom-stats', (event, id) => {
    try {
      const cid = Number(id)
      const studentIds = db
        .prepare('SELECT id FROM students WHERE classroom_id = ?')
        .all(cid)
        .map((r) => r.id)
      const studentCount = studentIds.length
      let attendanceCount = 0
      let gradeCount = 0
      let healthCount = 0
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '?').join(',')
        attendanceCount = db
          .prepare(`SELECT COUNT(*) AS c FROM attendance WHERE student_id IN (${placeholders})`)
          .get(...studentIds).c
        gradeCount = db
          .prepare(`SELECT COUNT(*) AS c FROM grades WHERE student_id IN (${placeholders})`)
          .get(...studentIds).c
        healthCount = db
          .prepare(`SELECT COUNT(*) AS c FROM health_check WHERE student_id IN (${placeholders})`)
          .get(...studentIds).c
      }
      const scheduleCount = db
        .prepare('SELECT COUNT(*) AS c FROM schedules WHERE classroom_id = ?')
        .get(cid).c
      return {
        studentCount,
        attendanceCount,
        gradeCount,
        healthCount,
        scheduleCount,
      }
    } catch (error) {
      log.error('[get-classroom-stats] failed:', error)
      return { studentCount: 0, attendanceCount: 0, gradeCount: 0, healthCount: 0, scheduleCount: 0 }
    }
  })

  // สถิติทั้งระบบ — ใช้ก่อน clear-all-data
  ipcMain.handle('get-all-stats', () => {
    try {
      return {
        classroomCount: db.prepare('SELECT COUNT(*) AS c FROM classrooms').get().c,
        studentCount: db.prepare('SELECT COUNT(*) AS c FROM students').get().c,
        attendanceCount: db.prepare('SELECT COUNT(*) AS c FROM attendance').get().c,
        gradeCount: db.prepare('SELECT COUNT(*) AS c FROM grades').get().c,
        healthCount: db.prepare('SELECT COUNT(*) AS c FROM health_check').get().c,
        scheduleCount: db.prepare('SELECT COUNT(*) AS c FROM schedules').get().c,
      }
    } catch (error) {
      log.error('[get-all-stats] failed:', error)
      return {
        classroomCount: 0,
        studentCount: 0,
        attendanceCount: 0,
        gradeCount: 0,
        healthCount: 0,
        scheduleCount: 0,
      }
    }
  })

  // ─── Sprint 2: Photos ────────────────────────────────────────
  function getPhotosDir() {
    const base = isDev ? process.cwd() : app.getPath('userData')
    const dir = path.join(base, 'photos')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (err) {
        log.warn('[Photos] mkdir failed:', err)
      }
    }
    return dir
  }

  // จำกัดขนาดรูปนักเรียน 5MB — รูป profile ครูถ่ายมือถือทั่วไปไม่เกินนี้
  // กัน OOM และ asar bloat ถ้ามีรูปขนาด GB ส่งผ่าน IPC
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024
  // magic bytes สำหรับ JPEG / PNG / WebP / GIF เท่านั้น — ปฏิเสธไฟล์ exe ที่ rename เป็น .jpg
  function detectImageType(buf) {
    if (!buf || buf.length < 12) return null
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    )
      return 'png'
    if (
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38
    )
      return 'gif'
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    )
      return 'webp'
    return null
  }

  ipcMain.handle('save-student-photo', (event, { studentId, fileBuffer }) => {
    try {
      const sid = Number(studentId)
      if (!Number.isInteger(sid) || sid <= 0) {
        return { success: false, error: 'studentId ไม่ถูกต้อง' }
      }
      const buf = Buffer.from(fileBuffer || [])
      if (buf.length === 0) {
        return { success: false, error: 'ไฟล์ว่างเปล่า' }
      }
      if (buf.length > MAX_PHOTO_BYTES) {
        return { success: false, error: 'ไฟล์รูปใหญ่เกิน 5MB' }
      }
      const detected = detectImageType(buf)
      if (!detected) {
        return { success: false, error: 'ไฟล์ไม่ใช่รูปภาพ (รองรับ jpg/png/gif/webp)' }
      }

      const dir = getPhotosDir()
      const fileName = `${sid}.${detected}`
      const fullPath = path.join(dir, fileName)

      // ลบไฟล์เก่าทุก extension ที่อาจมีอยู่ก่อน (เพื่อกันค้าง)
      try {
        const old = db
          .prepare('SELECT photo_path FROM students WHERE id = ?')
          .get(sid)
        if (old && old.photo_path) {
          const oldPath = path.join(dir, old.photo_path)
          if (fs.existsSync(oldPath) && oldPath !== fullPath) {
            fs.unlinkSync(oldPath)
          }
        }
      } catch (err) {
        log.warn('[Photos] cleanup old failed:', err)
      }

      fs.writeFileSync(fullPath, buf)

      db.prepare('UPDATE students SET photo_path = ? WHERE id = ?').run(fileName, sid)

      return { success: true, photo_path: fileName }
    } catch (error) {
      log.error('[save-student-photo] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('delete-student-photo', (event, studentId) => {
    try {
      const dir = getPhotosDir()
      const row = db
        .prepare('SELECT photo_path FROM students WHERE id = ?')
        .get(Number(studentId))
      if (row && row.photo_path) {
        const fullPath = path.join(dir, row.photo_path)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      }
      db.prepare('UPDATE students SET photo_path = NULL WHERE id = ?').run(Number(studentId))
      return { success: true }
    } catch (error) {
      log.error('[delete-student-photo] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-photo-data-url', (event, photoPath) => {
    try {
      if (!photoPath) return null
      const dir = getPhotosDir()
      // ปลอดภัยจาก path traversal — รับเฉพาะ basename
      const safe = path.basename(String(photoPath))
      const fullPath = path.join(dir, safe)
      if (!fs.existsSync(fullPath)) return null
      const ext = path.extname(safe).slice(1).toLowerCase() || 'jpeg'
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      const buf = fs.readFileSync(fullPath)
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch (error) {
      log.error('[get-photo-data-url] failed:', error)
      return null
    }
  })

  // ─── Sprint 2: Trash (Recycle Bin) ───────────────────────────
  ipcMain.handle('get-trashed-students', () => {
    try {
      return db
        .prepare(
          `SELECT s.*, c.name AS classroom_name
           FROM students s
           LEFT JOIN classrooms c ON c.id = s.classroom_id
           WHERE s.is_active = 0
           ORDER BY s.deleted_at DESC`
        )
        .all()
    } catch (error) {
      log.error('[get-trashed-students] failed:', error)
      return []
    }
  })

  ipcMain.handle('restore-student', (event, { id, newClassroomId }) => {
    try {
      if (newClassroomId) {
        const classroom = db
          .prepare('SELECT name FROM classrooms WHERE id = ?')
          .get(Number(newClassroomId))
        db.prepare(
          'UPDATE students SET is_active = 1, deleted_at = NULL, classroom_id = ?, classroom_label = ? WHERE id = ?'
        ).run(Number(newClassroomId), classroom ? classroom.name : '', Number(id))
      } else {
        db.prepare(
          'UPDATE students SET is_active = 1, deleted_at = NULL WHERE id = ?'
        ).run(Number(id))
      }
      return { success: true }
    } catch (error) {
      log.error('[restore-student] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('purge-student', (event, id) => {
    try {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM student_notes WHERE student_id = ?').run(Number(id))
        db.prepare('DELETE FROM attendance WHERE student_id = ?').run(Number(id))
        db.prepare('DELETE FROM grades WHERE student_id = ?').run(Number(id))
        db.prepare('DELETE FROM health_check WHERE student_id = ?').run(Number(id))
        db.prepare('DELETE FROM students WHERE id = ?').run(Number(id))
      })
      tx()
      return { success: true }
    } catch (error) {
      log.error('[purge-student] failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('empty-trash', () => {
    try {
      let purged = 0
      const tx = db.transaction(() => {
        const ids = db
          .prepare('SELECT id FROM students WHERE is_active = 0')
          .all()
          .map((r) => r.id)
        if (ids.length === 0) return
        const placeholders = ids.map(() => '?').join(',')
        db.prepare(`DELETE FROM student_notes WHERE student_id IN (${placeholders})`).run(...ids)
        db.prepare(`DELETE FROM attendance WHERE student_id IN (${placeholders})`).run(...ids)
        db.prepare(`DELETE FROM grades WHERE student_id IN (${placeholders})`).run(...ids)
        db.prepare(`DELETE FROM health_check WHERE student_id IN (${placeholders})`).run(...ids)
        db.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...ids)
        purged = ids.length
      })
      tx()
      return { success: true, purged }
    } catch (error) {
      log.error('[empty-trash] failed:', error)
      return { success: false, purged: 0, error: error.message }
    }
  })

  // ─── Sprint 2: Duplicate classroom (+ Sprint 3: promote + archive) ──
  ipcMain.handle('duplicate-classroom', (event, payload) => {
    try {
      const { sourceId, newName, newAcademicYear } = payload || {}
      const promoteStudents = !!payload?.promoteStudents
      const archiveSource = !!payload?.archiveSource

      const trimmedName = String(newName || '').trim()
      if (!trimmedName) {
        return { success: false, error: 'กรุณาระบุชื่อห้องใหม่' }
      }

      const source = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(Number(sourceId))
      if (!source) return { success: false, error: 'ไม่พบห้องเรียนต้นทาง' }

      const existing = db.prepare('SELECT id FROM classrooms WHERE name = ?').get(trimmedName)
      if (existing) return { success: false, error: 'มีห้องชื่อนี้อยู่แล้ว' }

      let newId = 0
      let movedStudents = 0
      const tx = db.transaction(() => {
        const result = db
          .prepare(
            'INSERT INTO classrooms (name, level, academic_year, color) VALUES (?, ?, ?, ?)'
          )
          .run(
            trimmedName,
            source.level,
            String(newAcademicYear || currentAcademicYear()).trim(),
            source.color ?? null
          )
        newId = Number(result.lastInsertRowid)

        const schedules = db
          .prepare(
            'SELECT day_of_week, period, subject_code, subject_name, class_level, room FROM schedules WHERE classroom_id = ?'
          )
          .all(Number(sourceId))
        const insert = db.prepare(
          'INSERT INTO schedules (classroom_id, day_of_week, period, subject_code, subject_name, class_level, room) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        for (const s of schedules) {
          insert.run(
            newId,
            s.day_of_week,
            s.period,
            s.subject_code,
            s.subject_name,
            s.class_level,
            s.room
          )
        }

        // promote: ย้ายนักเรียนจากห้องเดิมไปห้องใหม่
        if (promoteStudents) {
          const moveResult = db
            .prepare(
              `UPDATE students
               SET classroom_id = ?, classroom_label = ?
               WHERE classroom_id = ? AND is_active = 1`
            )
            .run(newId, trimmedName, Number(sourceId))
          movedStudents = Number(moveResult.changes) || 0
        }

        // archive: ทำห้องเดิมเป็น archived
        if (archiveSource) {
          db.prepare('UPDATE classrooms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            Number(sourceId)
          )
        }
      })
      tx()

      return { success: true, id: newId, name: trimmedName, movedStudents }
    } catch (error) {
      log.error('[duplicate-classroom] failed:', error)
      return { success: false, error: error.message }
    }
  })

  // ─── Sprint 2: Dashboard stats ───────────────────────────────
  ipcMain.handle('get-dashboard-stats', (_event, classroomId) => {
    try {
      const scoped = typeof classroomId === 'number' && classroomId > 0
      const cId = scoped ? classroomId : null

      const classroomCount = db.prepare('SELECT COUNT(*) AS c FROM classrooms').get().c

      const studentCount = db
        .prepare(
          scoped
            ? 'SELECT COUNT(*) AS c FROM students WHERE is_active = 1 AND classroom_id = ?'
            : 'SELECT COUNT(*) AS c FROM students WHERE is_active = 1'
        )
        .get(...(scoped ? [cId] : [])).c

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

      const topAbsent = db
        .prepare(
          `SELECT s.id, s.first_name, s.last_name, s.title, s.classroom_id, s.photo_path,
                  c.name as classroom_name,
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

      const studentsWithBmi = db
        .prepare(
          `SELECT s.id, s.title, s.first_name, s.last_name, s.weight_kg, s.height_cm, s.photo_path,
                  c.name as classroom_name
           FROM students s
           LEFT JOIN classrooms c ON c.id = s.classroom_id
           WHERE s.is_active = 1
             AND s.weight_kg IS NOT NULL AND s.weight_kg > 0
             AND s.height_cm IS NOT NULL AND s.height_cm > 0
             ${scoped ? 'AND s.classroom_id = ?' : ''}`
        )
        .all(...(scoped ? [cId] : []))

      const bmiAbnormal = []
      for (const s of studentsWithBmi) {
        const hm = s.height_cm / 100
        const bmi = s.weight_kg / (hm * hm)
        if (bmi < 18.5 || bmi >= 25) {
          bmiAbnormal.push({
            id: s.id,
            title: s.title,
            first_name: s.first_name,
            last_name: s.last_name,
            classroom_name: s.classroom_name,
            photo_path: s.photo_path,
            bmi: Math.round(bmi * 10) / 10,
            status: bmi < 18.5 ? 'ผอม' : bmi < 30 ? 'อ้วน' : 'อ้วนมาก',
          })
        }
      }

      const recentStudents = db
        .prepare(
          `SELECT s.id, s.first_name, s.last_name, s.title, s.photo_path,
                  c.name as classroom_name, s.created_at
           FROM students s
           LEFT JOIN classrooms c ON c.id = s.classroom_id
           WHERE s.is_active = 1
             ${scoped ? 'AND s.classroom_id = ?' : ''}
           ORDER BY s.id DESC
           LIMIT 10`
        )
        .all(...(scoped ? [cId] : []))

      const recentAttendance = db
        .prepare(
          `SELECT a.date, c.id as classroom_id, c.name as classroom_name, COUNT(a.id) as count
           FROM attendance a
           LEFT JOIN classrooms c ON c.id = a.classroom_id
           ${scoped ? 'WHERE a.classroom_id = ?' : ''}
           GROUP BY a.date, c.id
           ORDER BY a.date DESC
           LIMIT 5`
        )
        .all(...(scoped ? [cId] : []))

      const latestClassroom = db
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
    } catch (error) {
      log.error('[get-dashboard-stats] failed:', error)
      return {
        scope: 'all',
        classroomId: null,
        classroomCount: 0,
        studentCount: 0,
        topAbsent: [],
        bmiAbnormal: [],
        recentStudents: [],
        recentAttendance: [],
        latestClassroom: null,
      }
    }
  })

  log.info('[IPC] Handlers registered')
}

// ถ้าเป็น instance ที่สอง — ข้าม initialization ทั้งหมด รอ quit
if (gotTheLock) {
  app.whenReady().then(() => {
    log.info('[App] Ready')

    if (!initDatabase()) {
      log.error('[App] Database init failed')
      app.quit()
      return
    }

    // สำรองข้อมูลอัตโนมัติเมื่อเปิดแอป (วันละครั้งต่อวัน)
    runDailyBackup()

    // Auto-purge trash > 30 วัน (ตอนเปิดแอป)
    autoPurgeOldTrash()

    setupIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  log.info('[App] All windows closed')
  if (db) {
    db.close()
    log.info('[DB] Closed')
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  log.error('[Error] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('[Error] Unhandled rejection:', reason)
})
