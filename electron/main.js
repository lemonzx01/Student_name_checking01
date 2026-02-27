const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const log = require('electron-log')

// Configure logging
log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.info('[Main] Starting application...')

let mainWindow = null
const isDev = !app.isPackaged

// Database
let db = null
function initDatabase() {
  try {
    const Database = require('better-sqlite3')
    const dbPath = isDev 
      ? path.join(process.cwd(), 'school.db')
      : path.join(app.getPath('userData'), 'school.db')
    
    log.info('[DB] Opening:', dbPath)
    db = new Database(dbPath)
    
    // Create tables
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
    `)

    // Insert default subjects if not exists
    const subjectCount = db.prepare('SELECT COUNT(*) as count FROM subjects').get()
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
      defaultSubjects.forEach(s => insertSubject.run(s[0], s[1], s[2]))
    }

    // Database starts empty — user creates classrooms and students via UI

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
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    show: false
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

// IPC Handlers for Database
function setupIpcHandlers() {
  // Classrooms
  ipcMain.handle('get-classrooms', () => {
    return db.prepare(`
      SELECT c.*, COUNT(s.id) as student_count 
      FROM classrooms c 
      LEFT JOIN students s ON s.classroom_id = c.id AND s.is_active = 1 
      GROUP BY c.id 
      ORDER BY c.created_at DESC
    `).all()
  })

  ipcMain.handle('create-classroom', (event, { name, level, academic_year }) => {
    const result = db.prepare('INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)').run(name, level, academic_year)
    return { id: result.lastInsertRowid, name, level, academic_year }
  })

  ipcMain.handle('delete-classroom', (event, id) => {
    db.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
    return { success: true }
  })

  // Students
  ipcMain.handle('get-students', (event, classroomId) => {
    if (classroomId) {
      return db.prepare(`
        SELECT s.*, c.name as classroom_name 
        FROM students s 
        LEFT JOIN classrooms c ON c.id = s.classroom_id 
        WHERE s.classroom_id = ? AND s.is_active = 1 
        ORDER BY s.student_id
      `).all(classroomId)
    }
    return db.prepare(`
      SELECT s.*, c.name as classroom_name 
      FROM students s 
      LEFT JOIN classrooms c ON c.id = s.classroom_id 
      WHERE s.is_active = 1 
      ORDER BY c.name, s.student_id
    `).all()
  })

  ipcMain.handle('create-student', (event, data) => {
    const result = db.prepare(`
      INSERT INTO students (student_id, first_name, last_name, classroom_id, gender, birth_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.student_id, data.first_name, data.last_name, data.classroom_id, data.gender, data.birth_date || null)
    return { ...data, id: result.lastInsertRowid }
  })

  ipcMain.handle('update-student', (event, { id, ...data }) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    db.prepare(`UPDATE students SET ${fields} WHERE id = ?`).run(...values, id)
    return { success: true }
  })

  ipcMain.handle('delete-student', (event, id) => {
    db.prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id)
    return { success: true }
  })

  // Attendance
  ipcMain.handle('get-attendance', (event, { date, classroom }) => {
    return db.prepare(`
      SELECT s.id, s.student_id, s.first_name, s.last_name, a.status, a.note, h.brushed_teeth, h.drank_milk
      FROM students s
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
      LEFT JOIN health_check h ON h.student_id = s.id AND h.date = ?
      WHERE s.classroom_id = ? AND s.is_active = 1
      ORDER BY s.student_id
    `).all(date, date, classroom)
  })

  ipcMain.handle('save-attendance', (event, { date, classroom, attendance, health }) => {
    const saveAtt = db.prepare(`
      INSERT OR REPLACE INTO attendance (student_id, date, status, note)
      VALUES (?, ?, ?, ?)
    `)
    const saveHealth = db.prepare(`
      INSERT OR REPLACE INTO health_check (student_id, date, brushed_teeth, drank_milk, note)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    Object.entries(attendance).forEach(([studentId, data]) => {
      saveAtt.run(studentId, date, data.status, data.note || '')
    })
    
    Object.entries(health).forEach(([studentId, data]) => {
      saveHealth.run(studentId, date, data.brushed_teeth ? 1 : 0, data.drank_milk ? 1 : 0, '')
    })
    
    return { success: true }
  })

  // Grades
  ipcMain.handle('get-grades', (event, { classroom, semester, year }) => {
    return db.prepare(`
      SELECT s.id, s.student_id, s.first_name, s.last_name, g.subject, g.score
      FROM students s
      LEFT JOIN grades g ON g.student_id = s.id AND g.semester = ? AND g.academic_year = ?
      WHERE s.classroom_id = ? AND s.is_active = 1
      ORDER BY s.student_id
    `).all(semester, year, classroom)
  })

  ipcMain.handle('save-grades', (event, { semester, year, grades }) => {
    const saveGrade = db.prepare(`
      INSERT OR REPLACE INTO grades (student_id, subject, semester, academic_year, score)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    Object.entries(grades).forEach(([studentId, studentGrades]) => {
      Object.entries(studentGrades).forEach(([subject, score]) => {
        if (score !== null && score !== undefined) {
          saveGrade.run(studentId, subject, semester, year, score)
        }
      })
    })
    
    return { success: true }
  })

  // Schedule
  ipcMain.handle('get-schedule', (event, classroom) => {
    return db.prepare(`
      SELECT s.*, sub.name as subject_name, sub.color as subject_color
      FROM schedule s
      LEFT JOIN subjects sub ON sub.id = s.subject_id
      WHERE s.classroom_id = ?
      ORDER BY s.day_of_week, s.period
    `).all(classroom)
  })

  ipcMain.handle('save-schedule', (event, { classroom, schedule }) => {
    const saveSchedule = db.prepare(`
      INSERT OR REPLACE INTO schedule (classroom_id, day_of_week, period, subject_id, teacher_name)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    Object.entries(schedule).forEach(([key, data]) => {
      const [day, period] = key.split('-').map(Number)
      saveSchedule.run(classroom, day, period, data.subject_id || null, data.teacher_name || '')
    })
    
    return { success: true }
  })

  // Backup/Export
  ipcMain.handle('export-data', () => {
    return {
      classrooms: db.prepare('SELECT * FROM classrooms').all(),
      students: db.prepare('SELECT * FROM students WHERE is_active = 1').all(),
      subjects: db.prepare('SELECT * FROM subjects').all(),
      grades: db.prepare('SELECT * FROM grades').all(),
      schedule: db.prepare('SELECT * FROM schedule').all(),
      attendance: db.prepare('SELECT * FROM attendance').all(),
      health_check: db.prepare('SELECT * FROM health_check').all(),
      exported_at: new Date().toISOString(),
      version: '1.0'
    }
  })

  // Import
  ipcMain.handle('import-data', (event, data) => {
    try {
      const { classrooms, students, subjects, grades, schedule, attendance, health_check } = data
      
      // Import classrooms
      if (classrooms) {
        db.prepare('DELETE FROM classrooms').run()
        const insertClassroom = db.prepare('INSERT INTO classrooms (name, level, academic_year) VALUES (?, ?, ?)')
        classrooms.forEach(c => insertClassroom.run(c.name, c.level, c.academic_year))
      }
      
      // Import subjects
      if (subjects) {
        db.prepare('DELETE FROM subjects').run()
        const insertSubject = db.prepare('INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)')
        subjects.forEach(s => insertSubject.run(s.name, s.code, s.color))
      }
      
      // Import students
      if (students) {
        db.prepare('DELETE FROM students').run()
        const insertStudent = db.prepare('INSERT INTO students (student_id, first_name, last_name, classroom_id, gender, birth_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
        students.forEach(s => insertStudent.run(s.student_id, s.first_name, s.last_name, s.classroom_id, s.gender, s.birth_date, s.is_active))
      }
      
      // Import grades
      if (grades) {
        db.prepare('DELETE FROM grades').run()
        const insertGrade = db.prepare('INSERT INTO grades (student_id, subject, semester, academic_year, score) VALUES (?, ?, ?, ?, ?)')
        grades.forEach(g => insertGrade.run(g.student_id, g.subject, g.semester, g.academic_year, g.score))
      }
      
      // Import schedule
      if (schedule) {
        db.prepare('DELETE FROM schedule').run()
        const insertSchedule = db.prepare('INSERT INTO schedule (classroom_id, day_of_week, period, subject_id, teacher_name) VALUES (?, ?, ?, ?, ?)')
        schedule.forEach(s => insertSchedule.run(s.classroom_id, s.day_of_week, s.period, s.subject_id, s.teacher_name))
      }
      
      // Import attendance
      if (attendance) {
        db.prepare('DELETE FROM attendance').run()
        const insertAttendance = db.prepare('INSERT INTO attendance (student_id, date, status, note) VALUES (?, ?, ?, ?)')
        attendance.forEach(a => insertAttendance.run(a.student_id, a.date, a.status, a.note))
      }
      
      // Import health_check
      if (health_check) {
        db.prepare('DELETE FROM health_check').run()
        const insertHealth = db.prepare('INSERT INTO health_check (student_id, date, brushed_teeth, drank_milk, note) VALUES (?, ?, ?, ?, ?)')
        health_check.forEach(h => insertHealth.run(h.student_id, h.date, h.brushed_teeth, h.drank_milk, h.note))
      }
      
      return { success: true }
    } catch (error) {
      log.error('[Import] Error:', error)
      return { success: false, error: error.message }
    }
  })

  // Import Students from Excel
  ipcMain.handle('import-students-excel', (event, students) => {
    try {
      let importedCount = 0
      let skippedCount = 0
      
      const insertStudent = db.prepare(`
        INSERT OR IGNORE INTO students (student_id, first_name, last_name, classroom_id, gender, birth_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      
      const getClassroomId = db.prepare('SELECT id FROM classrooms WHERE name = ?')
      
      for (const student of students) {
        // Find classroom by name
        let classroomId = null
        if (student.classroom) {
          const classroom = getClassroomId.get(student.classroom)
          classroomId = classroom ? classroom.id : null
        }
        
        if (classroomId) {
          const result = insertStudent.run(
            student.student_id || student.studentId || '',
            student.first_name || student.firstName || student['ชื่อ'] || '',
            student.last_name || student.lastName || student['นามสกุล'] || '',
            classroomId,
            student.gender || student['เพศ'] || '',
            student.birth_date || student.birthDate || student['วันเกิด'] || null
          )
          if (result.changes > 0) {
            importedCount++
          } else {
            skippedCount++
          }
        } else {
          skippedCount++
        }
      }
      
      return { success: true, imported: importedCount, skipped: skippedCount }
    } catch (error) {
      log.error('[Import Students Excel] Error:', error)
      return { success: false, error: error.message }
    }
  })

  log.info('[IPC] Handlers registered')
}

// App lifecycle
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('[Error] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('[Error] Unhandled rejection:', reason)
})
