const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const log = require('electron-log')

log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024
log.info('[Main] Starting application...')

let mainWindow = null
const isDev = !app.isPackaged
let db = null

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

function initDatabase() {
  try {
    const Database = require('better-sqlite3')
    const dbPath = isDev
      ? path.join(process.cwd(), 'school.db')
      : path.join(app.getPath('userData'), 'school.db')

    log.info('[DB] Opening:', dbPath)
    db = new Database(dbPath)

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

      CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
      CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
      CREATE INDEX IF NOT EXISTS idx_health_student_date ON health_check(student_id, date);
      CREATE INDEX IF NOT EXISTS idx_grades_student_semester_year ON grades(student_id, semester, academic_year);
      CREATE INDEX IF NOT EXISTS idx_schedule_classroom_dow_period ON schedule(classroom_id, day_of_week, period);
    `)

    ensureColumns('students', STUDENT_EXTRA_COLUMNS)
    db.exec('CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number)')

    const subjectCount = db.prepare('SELECT COUNT(*) AS count FROM subjects').get()
    if (subjectCount.count === 0) {
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
      defaultSubjects.forEach((subject) => insertSubject.run(subject[0], subject[1], subject[2]))
    }

    log.info('[DB] Initialized successfully')
    return true
  } catch (error) {
    log.error('[DB] Init error:', error)
    return false
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
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: true,
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    log.info('[Main] Window shown')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../.next/server/pages/index.html'))
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
        GROUP BY c.id
        ORDER BY c.name
      `)
      .all()
  })

  ipcMain.handle('create-classroom', (event, { name, level, academic_year }) => {
    const normalizedName = textOrNull(name)
    if (!normalizedName) {
      throw new Error('Missing classroom name')
    }

    const existing = db.prepare('SELECT * FROM classrooms WHERE name = ?').get(normalizedName)
    if (existing) {
      return existing
    }

    const result = db
      .prepare('INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)')
      .run(normalizedName, textOrNull(level) || 'ห้องเรียน', textOrNull(academic_year) || currentAcademicYear())

    return {
      id: Number(result.lastInsertRowid),
      name: normalizedName,
      level: textOrNull(level) || 'ห้องเรียน',
      academic_year: textOrNull(academic_year) || currentAcademicYear(),
    }
  })

  ipcMain.handle('update-classroom', (event, { id, name, level, academic_year }) => {
    const normalizedName = textOrNull(name)
    if (!id || !normalizedName) {
      throw new Error('Missing classroom data')
    }

    db.prepare('UPDATE classrooms SET name = ?, level = ?, academic_year = ? WHERE id = ?').run(
      normalizedName,
      textOrNull(level) || 'ห้องเรียน',
      textOrNull(academic_year) || currentAcademicYear(),
      id
    )
    db.prepare('UPDATE students SET classroom_label = ? WHERE classroom_id = ?').run(normalizedName, id)

    return { success: true }
  })

  ipcMain.handle('delete-classroom', (event, id) => {
    db.prepare('DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE classroom_id = ?)').run(id)
    db.prepare('DELETE FROM health_check WHERE student_id IN (SELECT id FROM students WHERE classroom_id = ?)').run(id)
    db.prepare('DELETE FROM grades WHERE student_id IN (SELECT id FROM students WHERE classroom_id = ?)').run(id)
    db.prepare('DELETE FROM students WHERE classroom_id = ?').run(id)
    db.prepare('DELETE FROM schedule WHERE classroom_id = ?').run(id)
    db.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
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
    db.prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('get-attendance', (event, { date, classroom }) => {
    return db
      .prepare(`
        SELECT s.id, s.student_id, s.student_number, s.title, s.first_name, s.last_name, a.status, a.note
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

  ipcMain.handle('save-attendance', (event, { date, classroom, attendance = {}, health = {} }) => {
    db.prepare(
      'DELETE FROM attendance WHERE date = ? AND student_id IN (SELECT id FROM students WHERE classroom_id = ?)'
    ).run(date, classroom)
    db.prepare(
      'DELETE FROM health_check WHERE date = ? AND student_id IN (SELECT id FROM students WHERE classroom_id = ?)'
    ).run(date, classroom)

    const insertAttendance = db.prepare(
      'INSERT INTO attendance (student_id, date, status, note) VALUES (?, ?, ?, ?)'
    )
    const insertHealth = db.prepare(
      'INSERT INTO health_check (student_id, date, brushed_teeth, drank_milk, note) VALUES (?, ?, ?, ?, ?)'
    )

    Object.entries(attendance).forEach(([studentId, entry]) => {
      insertAttendance.run(Number(studentId), date, entry.status || 'มา', entry.note || '')
    })

    Object.entries(health).forEach(([studentId, entry]) => {
      insertHealth.run(
        Number(studentId),
        date,
        entry.brushed_teeth ? 1 : 0,
        entry.drank_milk ? 1 : 0,
        entry.note || ''
      )
    })

    return { success: true }
  })

  ipcMain.handle('get-grades', (event, { classroom, semester, year }) => {
    return db
      .prepare(`
        SELECT s.id, s.student_id, s.first_name, s.last_name, g.subject, g.score
        FROM students s
        LEFT JOIN grades g ON g.student_id = s.id AND g.semester = ? AND g.academic_year = ?
        WHERE s.classroom_id = ? AND s.is_active = 1
        ORDER BY COALESCE(NULLIF(s.student_number, ''), s.student_id)
      `)
      .all(semester, year, classroom)
  })

  ipcMain.handle('save-grades', (event, { semester, year, grades }) => {
    const deleteByStudent = db.prepare('DELETE FROM grades WHERE student_id = ? AND semester = ? AND academic_year = ?')
    const insertGrade = db.prepare(
      'INSERT INTO grades (student_id, subject, semester, academic_year, score) VALUES (?, ?, ?, ?, ?)'
    )

    Object.entries(grades).forEach(([studentId, subjectMap]) => {
      deleteByStudent.run(Number(studentId), semester, year)
      Object.entries(subjectMap).forEach(([subject, score]) => {
        if (score !== null && score !== undefined && score !== '') {
          insertGrade.run(Number(studentId), subject, semester, year, score)
        }
      })
    })

    return { success: true }
  })

  ipcMain.handle('get-schedule', (event, classroom) => {
    return db
      .prepare(`
        SELECT s.*, sub.name AS subject_name, sub.color AS subject_color
        FROM schedule s
        LEFT JOIN subjects sub ON sub.id = s.subject_id
        WHERE s.classroom_id = ?
        ORDER BY s.day_of_week, s.period
      `)
      .all(classroom)
  })

  ipcMain.handle('save-schedule', (event, { classroom, schedule }) => {
    db.prepare('DELETE FROM schedule WHERE classroom_id = ?').run(classroom)
    const insertSchedule = db.prepare(
      'INSERT INTO schedule (classroom_id, day_of_week, period, subject_id, teacher_name) VALUES (?, ?, ?, ?, ?)'
    )

    Object.entries(schedule).forEach(([key, entry]) => {
      const [day, period] = key.split('-').map(Number)
      insertSchedule.run(classroom, day, period, entry.subject_id || null, entry.teacher_name || '')
    })

    return { success: true }
  })

  ipcMain.handle('export-data', () => {
    return {
      classrooms: db.prepare('SELECT * FROM classrooms').all(),
      students: db.prepare('SELECT * FROM students').all(),
      subjects: db.prepare('SELECT * FROM subjects').all(),
      grades: db.prepare('SELECT * FROM grades').all(),
      schedule: db.prepare('SELECT * FROM schedule').all(),
      attendance: db.prepare('SELECT * FROM attendance').all(),
      health_check: db.prepare('SELECT * FROM health_check').all(),
      exported_at: new Date().toISOString(),
      version: '1.1',
    }
  })

  ipcMain.handle('import-data', (event, data) => {
    try {
      const { classrooms, students, subjects, grades, schedule, attendance, health_check } = data

      db.prepare('DELETE FROM attendance').run()
      db.prepare('DELETE FROM health_check').run()
      db.prepare('DELETE FROM grades').run()
      db.prepare('DELETE FROM schedule').run()
      db.prepare('DELETE FROM students').run()
      db.prepare('DELETE FROM subjects').run()
      db.prepare('DELETE FROM classrooms').run()

      if (classrooms) {
        const insertClassroom = db.prepare(
          'INSERT INTO classrooms (id, name, level, academic_year, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        classrooms.forEach((classroom) =>
          insertClassroom.run(
            classroom.id,
            classroom.name,
            classroom.level,
            classroom.academic_year,
            classroom.created_at || new Date().toISOString()
          )
        )
      }

      if (subjects) {
        const insertSubject = db.prepare(
          'INSERT INTO subjects (id, name, code, color) VALUES (?, ?, ?, ?)'
        )
        subjects.forEach((subject) => insertSubject.run(subject.id, subject.name, subject.code, subject.color))
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
          'INSERT INTO grades (id, student_id, subject, semester, academic_year, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        grades.forEach((grade) =>
          insertGrade.run(
            grade.id,
            grade.student_id,
            grade.subject,
            grade.semester,
            grade.academic_year,
            grade.score,
            grade.created_at || new Date().toISOString()
          )
        )
      }

      if (schedule) {
        const insertSchedule = db.prepare(
          'INSERT INTO schedule (id, classroom_id, day_of_week, period, subject_id, teacher_name) VALUES (?, ?, ?, ?, ?, ?)'
        )
        schedule.forEach((entry) =>
          insertSchedule.run(
            entry.id,
            entry.classroom_id,
            entry.day_of_week,
            entry.period,
            entry.subject_id,
            entry.teacher_name
          )
        )
      }

      if (attendance) {
        const insertAttendance = db.prepare(
          'INSERT INTO attendance (id, student_id, date, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        attendance.forEach((entry) =>
          insertAttendance.run(
            entry.id,
            entry.student_id,
            entry.date,
            entry.status,
            entry.note,
            entry.created_at || new Date().toISOString()
          )
        )
      }

      if (health_check) {
        const insertHealth = db.prepare(
          'INSERT INTO health_check (id, student_id, date, brushed_teeth, drank_milk, note) VALUES (?, ?, ?, ?, ?, ?)'
        )
        health_check.forEach((entry) =>
          insertHealth.run(
            entry.id,
            entry.student_id,
            entry.date,
            entry.brushed_teeth,
            entry.drank_milk,
            entry.note
          )
        )
      }

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

  log.info('[IPC] Handlers registered')
}

app.whenReady().then(() => {
  log.info('[App] Ready')

  if (!initDatabase()) {
    log.error('[App] Database init failed')
    app.quit()
    return
  }

  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

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
