'use client'

import {
  AttendanceRecord,
  AttendanceStatus,
  Classroom,
  ImportedStudentInput,
  ImportStudentsResult,
  Student,
  StudentFormInput,
  StudentNote,
} from '@/types'

function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'
}

function isInsideElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('Electron')
  )
}

async function waitForElectronAPI(timeout = 10000): Promise<boolean> {
  if (isElectronRuntime()) return true
  if (!isInsideElectron()) return false

  // อยู่ใน Electron แต่ preload ยังไม่ inject — รอจนพร้อม
  // ถ้า timeout แล้วยังไม่พร้อมให้ throw แทน fallback ไป /api/* ที่ไม่มีใน production
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (isElectronRuntime()) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeout) {
        reject(new Error('Electron preload API ยังไม่พร้อมใช้งาน'))
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed')
  }

  return payload as T
}

function hydrateStudent(student: any): Student {
  return {
    ...student,
    source_payload:
      typeof student.source_payload === 'string' && student.source_payload
        ? JSON.parse(student.source_payload)
        : student.source_payload ?? null,
  }
}

export async function getClassrooms(): Promise<Classroom[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getClassrooms()
  }

  return fetchJson<Classroom[]>('/api/classrooms')
}

export async function createClassroomRecord(input: {
  name: string
  level: string
  academic_year: string
  color?: string | null
}): Promise<Classroom> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.createClassroom(input)
  }

  return fetchJson<Classroom>('/api/classrooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateClassroomRecord(
  id: number,
  input: {
    name: string
    level: string
    academic_year: string
    color?: string | null
  }
): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.updateClassroom({ id, ...input })
    return
  }

  await fetchJson('/api/classrooms', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...input }),
  })
}

export async function deleteClassroomRecord(id: number): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.deleteClassroom(id)
    return
  }

  await fetchJson(`/api/classrooms?id=${id}`, {
    method: 'DELETE',
  })
}

export async function getStudents(classroomId?: number | null): Promise<Student[]> {
  if (await waitForElectronAPI()) {
    const rows = await window.electronAPI!.getStudents(classroomId ?? null)
    return rows.map(hydrateStudent)
  }

  const query = classroomId ? `?classroom=${classroomId}` : ''
  const rows = await fetchJson<Student[]>(`/api/students${query}`)
  return rows.map(hydrateStudent)
}

export async function createStudentRecord(input: StudentFormInput): Promise<Student> {
  if (await waitForElectronAPI()) {
    const result = await window.electronAPI!.createStudent(input)
    return hydrateStudent(result)
  }

  const result = await fetchJson<Student>('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return hydrateStudent(result)
}

export async function updateStudentRecord(id: number, input: StudentFormInput): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.updateStudent({ id, ...input })
    return
  }

  await fetchJson(`/api/students?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteStudentRecord(id: number): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.deleteStudent(id)
    return
  }

  await fetchJson(`/api/students?id=${id}`, {
    method: 'DELETE',
  })
}

export async function getAttendance(date: string, classroomId: number): Promise<AttendanceRecord[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getAttendance({ date, classroom: classroomId })
  }

  return fetchJson<AttendanceRecord[]>(`/api/attendance?date=${date}&classroom=${classroomId}`)
}

export async function saveAttendanceRecord(
  date: string,
  classroomId: number,
  attendance: Record<number, { status: AttendanceStatus; note?: string }>
): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.saveAttendance({
      date,
      classroom: classroomId,
      attendance,
      health: {},
    })
    return
  }

  await fetchJson('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      classroom: classroomId,
      attendance,
    }),
  })
}

export async function getAttendanceDates(classroomId: number, yearMonth: string): Promise<string[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getAttendanceDates({ classroom: classroomId, yearMonth })
  }

  return fetchJson<string[]>(`/api/attendance/dates?classroom=${classroomId}&yearMonth=${yearMonth}`)
}

export async function importStudentsFromExcel(
  students: ImportedStudentInput[]
): Promise<ImportStudentsResult> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.importStudentsExcel(students)
  }

  return fetchJson<ImportStudentsResult>('/api/students/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  })
}

export interface ScheduleRow {
  classroom_id: number
  day_of_week: number
  period: number
  subject_code: string | null
  subject_name: string | null
  class_level: string | null
  room: string | null
}

export async function getScheduleByClassroom(classroomId: number): Promise<ScheduleRow[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getSchedule(classroomId) as Promise<ScheduleRow[]>
  }

  return fetchJson<ScheduleRow[]>(`/api/schedule?classroom=${classroomId}`)
}

/**
 * โหลดตารางสอนของทุกห้องพร้อมกัน — ใช้ใน /app/schedule (โหลด overview ครั้งเดียว)
 * คืน Record<classroomId, rows[]>
 */
export async function getAllSchedules(
  classroomIds: number[],
): Promise<Record<number, ScheduleRow[]>> {
  const result: Record<number, ScheduleRow[]> = {}
  const entries = await Promise.all(
    classroomIds.map(async (id) => {
      const rows = await getScheduleByClassroom(id)
      return [id, rows] as const
    }),
  )
  for (const [id, rows] of entries) result[id] = rows
  return result
}

/**
 * บันทึกตารางสอนของห้องเดียว
 * - Electron: เรียก IPC `save-schedule` ตรง ๆ
 * - Web: POST /api/schedule
 *
 * schedule = map ของ `${day}-${period}` → slot
 * ตัว main process / API route จะลบของเดิมแล้ว insert ใหม่ทั้งห้อง (transactional)
 */
export async function saveScheduleForClassroom(
  classroomId: number,
  schedule: Record<
    string,
    {
      subject_code?: string
      subject_name?: string
      class_level?: string
      room?: string
    }
  >,
): Promise<void> {
  if (await waitForElectronAPI()) {
    const result = await window.electronAPI!.saveSchedule({
      classroom: classroomId,
      schedule,
    })
    if (result && (result as any).success === false) {
      throw new Error('บันทึกตารางสอนไม่สำเร็จ')
    }
    return
  }

  await fetchJson('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroom: classroomId, schedule }),
  })
}

export async function getGradesData(
  classroomId: number,
  semester: number,
  year: string
): Promise<any[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getGrades({ classroom: classroomId, semester, year })
  }

  return fetchJson<any[]>(`/api/grades?classroom=${classroomId}&semester=${semester}&year=${year}`)
}

export async function getStudentNotes(studentId: number): Promise<StudentNote[]> {
  if (await waitForElectronAPI()) {
    const rows = await window.electronAPI!.getStudentNotes(studentId)
    return rows as StudentNote[]
  }

  return fetchJson<StudentNote[]>(`/api/notes?student=${studentId}`)
}

export async function addStudentNoteRecord(input: {
  student_id: number
  date: string
  note: string
}): Promise<StudentNote> {
  if (await waitForElectronAPI()) {
    const row = await window.electronAPI!.addStudentNote(input)
    return row as StudentNote
  }

  return fetchJson<StudentNote>('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteStudentNoteRecord(id: number): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.deleteStudentNote(id)
    return
  }

  await fetchJson(`/api/notes?id=${id}`, { method: 'DELETE' })
}

// ─── Auto-backup ────────────────────────────────────────────
export interface BackupInfo {
  lastBackup: string | null // ISO datetime ของไฟล์สำรองล่าสุด
  count: number // จำนวนไฟล์สำรองทั้งหมดที่มี
  folder: string | null // path ของโฟลเดอร์สำรอง (ใช้โชว์ให้ครูเห็น)
  available: boolean // ระบบสำรองใช้ได้ไหม (false เมื่อเปิดในเว็บ ไม่ใช่ Electron)
}

export async function getBackupInfo(): Promise<BackupInfo> {
  if (await waitForElectronAPI()) {
    const result = await window.electronAPI!.getBackupInfo()
    return {
      lastBackup: result.lastBackup,
      count: result.count,
      folder: result.folder,
      available: true,
    }
  }

  // โหมดเว็บ (dev): แสดงข้อมูลจาก API เฉยๆ ยังเปิดโฟลเดอร์ไม่ได้
  try {
    const res = await fetch('/api/backup/info')
    const data = await res.json()
    return {
      lastBackup: data.lastBackup ?? null,
      count: data.count ?? 0,
      folder: data.folder ?? null,
      available: false,
    }
  } catch {
    return { lastBackup: null, count: 0, folder: null, available: false }
  }
}

export async function openBackupFolder(): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    const result = await window.electronAPI!.openBackupFolder()
    return { success: result.success, error: result.error }
  }
  return {
    success: false,
    error: 'เปิดโฟลเดอร์ได้เฉพาะเวอร์ชัน Desktop เท่านั้น',
  }
}

// ─── Restore-backup ──────────────────────────────────────────
export interface BackupFile {
  fileName: string
  date: string // ISO datetime
  sizeBytes: number
}

export async function listBackups(): Promise<BackupFile[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.listBackups()
  }
  try {
    const res = await fetch('/api/backup/list')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function restoreBackup(
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.restoreBackup(fileName)
  }
  try {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'กู้คืนไม่สำเร็จ' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'กู้คืนไม่สำเร็จ' }
  }
}

// ─── Stats สำหรับแสดงผลกระทบก่อน destructive op ──────────────
export interface ClassroomStats {
  studentCount: number
  attendanceCount: number
  gradeCount: number
  healthCount: number
  scheduleCount: number
}

export interface AllStats extends ClassroomStats {
  classroomCount: number
}

export async function getClassroomStats(id: number): Promise<ClassroomStats | null> {
  if (await waitForElectronAPI()) {
    try {
      return await window.electronAPI!.getClassroomStats(id)
    } catch {
      return null
    }
  }
  // Web mode: ไม่มี API ตรงๆ — return null ให้ caller fallback ใช้ข้อมูล UI
  return null
}

export async function getAllStats(): Promise<AllStats | null> {
  if (await waitForElectronAPI()) {
    try {
      return await window.electronAPI!.getAllStats()
    } catch {
      return null
    }
  }
  return null
}

export async function searchStudentsGlobal(query: string): Promise<Student[]> {
  const q = query.trim()
  if (q.length < 2) return []

  if (await waitForElectronAPI()) {
    // Electron: ใช้ IPC `search-students` (ทำ LIKE ใน SQL — เร็วกว่า filter ใน JS)
    if (typeof window.electronAPI!.searchStudents === 'function') {
      try {
        const rows = await window.electronAPI!.searchStudents(q)
        return rows.slice(0, 15).map(hydrateStudent)
      } catch (err) {
        // ถ้า main process ยังไม่มี handler (เก่า) → fall back filter ใน JS
        console.warn('[searchStudentsGlobal] searchStudents IPC failed, falling back:', err)
      }
    }
    const all = await window.electronAPI!.getStudents(null)
    return all
      .filter(
        (s: any) =>
          s.first_name?.includes(q) ||
          s.last_name?.includes(q) ||
          s.student_id?.includes(q) ||
          s.student_number?.includes(q)
      )
      .slice(0, 15)
      .map(hydrateStudent)
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  const data = await res.json()
  return (data.students || []).slice(0, 15).map(hydrateStudent)
}

// ─── Health / attendance (Electron-aware) ─────────────────────
export async function getHealthByClassroomClient(
  classroomId: number,
  date: string
): Promise<any[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getHealth({ classroom: classroomId, date })
  }
  const res = await fetch(`/api/health?classroom=${classroomId}&date=${date}`)
  if (!res.ok) return []
  return res.json()
}

export async function saveHealthClient(
  classroomId: number,
  date: string,
  entries: Array<{
    student_id: number
    brushed_teeth: boolean
    drank_milk: boolean
    weight_kg?: number | null
    height_cm?: number | null
  }>
): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.saveHealth({ classroom: classroomId, date, entries })
    return
  }
  await fetchJson('/api/health', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroom: classroomId, date, entries }),
  })
}

export async function getAllHealthByClassroomClient(classroomId: number): Promise<any[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getAllHealth(classroomId)
  }
  const res = await fetch(`/api/health/all?classroom=${classroomId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getAllAttendanceByClassroomClient(classroomId: number): Promise<any[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getAllAttendance(classroomId)
  }
  const res = await fetch(`/api/attendance/all?classroom=${classroomId}`)
  if (!res.ok) return []
  return res.json()
}

export async function clearAllDataClient(): Promise<void> {
  if (await waitForElectronAPI()) {
    await window.electronAPI!.clearAllData()
    return
  }
  const res = await fetch('/api/settings', { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

// ─── Sprint 2: Photos ──────────────────────────────────────
export async function saveStudentPhoto(
  studentId: number,
  fileBlob: Blob,
  ext: string
): Promise<{ success: boolean; photo_path?: string; error?: string }> {
  if (await waitForElectronAPI()) {
    const buf = new Uint8Array(await fileBlob.arrayBuffer())
    return window.electronAPI!.saveStudentPhoto({ studentId, fileBuffer: buf, ext })
  }
  const fd = new FormData()
  fd.append('studentId', String(studentId))
  fd.append('file', fileBlob, `student.${ext}`)
  const res = await fetch('/api/students/photo', { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error || 'อัปโหลดไม่สำเร็จ' }
  }
  return res.json()
}

export async function deleteStudentPhoto(
  studentId: number
): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.deleteStudentPhoto(studentId)
  }
  const res = await fetch(`/api/students/photo?studentId=${studentId}`, { method: 'DELETE' })
  if (!res.ok) return { success: false, error: 'ลบไม่สำเร็จ' }
  return { success: true }
}

export async function getPhotoDataUrl(
  photoPath: string | null | undefined
): Promise<string | null> {
  if (!photoPath) return null
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getPhotoDataUrl(photoPath)
  }
  try {
    const res = await fetch(`/api/students/photo?path=${encodeURIComponent(photoPath)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.dataUrl || null
  } catch {
    return null
  }
}

// ─── Sprint 2: Trash (Recycle Bin) ─────────────────────────
export async function getTrashedStudents(): Promise<Student[]> {
  if (await waitForElectronAPI()) {
    const rows = await window.electronAPI!.getTrashedStudents()
    return rows.map(hydrateStudent)
  }
  const res = await fetch('/api/students/trash')
  if (!res.ok) return []
  const data = await res.json()
  return (data || []).map(hydrateStudent)
}

export async function restoreStudent(
  id: number,
  newClassroomId?: number | null
): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.restoreStudent({ id, newClassroomId: newClassroomId ?? null })
  }
  const res = await fetch('/api/students/trash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', id, newClassroomId: newClassroomId ?? null }),
  })
  if (!res.ok) return { success: false, error: 'กู้คืนไม่สำเร็จ' }
  return { success: true }
}

export async function purgeStudent(id: number): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.purgeStudent(id)
  }
  const res = await fetch(`/api/students/trash?id=${id}`, { method: 'DELETE' })
  if (!res.ok) return { success: false, error: 'ลบไม่สำเร็จ' }
  return { success: true }
}

export async function emptyTrash(): Promise<{ success: boolean; purged: number; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.emptyTrash()
  }
  const res = await fetch('/api/students/trash?empty=true', { method: 'DELETE' })
  if (!res.ok) return { success: false, purged: 0, error: 'ล้างไม่สำเร็จ' }
  const data = await res.json()
  return { success: true, purged: data.purged || 0 }
}

// ─── Sprint 2: Duplicate Classroom (+ Sprint 3 options) ───
export async function duplicateClassroomRecord(
  sourceId: number,
  newName: string,
  newAcademicYear: string,
  options?: { promoteStudents?: boolean; archiveSource?: boolean }
): Promise<{
  success: boolean
  id?: number
  name?: string
  movedStudents?: number
  error?: string
}> {
  const payload = {
    sourceId,
    newName,
    newAcademicYear,
    promoteStudents: !!options?.promoteStudents,
    archiveSource: !!options?.archiveSource,
  }
  if (await waitForElectronAPI()) {
    return window.electronAPI!.duplicateClassroom(payload)
  }
  const res = await fetch('/api/classrooms/duplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error || 'ทำสำเนาไม่สำเร็จ' }
  }
  return res.json()
}

// ─── Sprint 2: Dashboard Stats ─────────────────────────────
export interface DashboardStats {
  scope: 'classroom' | 'all'
  classroomId: number | null
  classroomCount: number
  studentCount: number
  topAbsent: Array<{
    id: number
    first_name: string
    last_name: string
    title: string | null
    classroom_name: string | null
    photo_path: string | null
    absent_count: number
  }>
  bmiAbnormal: Array<{
    id: number
    title: string | null
    first_name: string
    last_name: string
    classroom_name: string | null
    photo_path: string | null
    bmi: number
    status: string
  }>
  recentStudents: Array<{
    id: number
    first_name: string
    last_name: string
    title: string | null
    classroom_name: string | null
    photo_path: string | null
    created_at: string
  }>
  recentAttendance: Array<{
    date: string
    classroom_id: number
    classroom_name: string | null
    count: number
  }>
  latestClassroom: {
    id: number
    name: string
    avg_score: number | null
  } | null
}

export async function getDashboardStats(classroomId?: number | null): Promise<DashboardStats | null> {
  if (await waitForElectronAPI()) {
    try {
      return await window.electronAPI!.getDashboardStats(classroomId ?? null)
    } catch {
      return null
    }
  }
  try {
    const query = typeof classroomId === 'number' && classroomId > 0 ? `?classroom=${classroomId}` : ''
    const res = await fetch(`/api/stats/dashboard${query}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Sprint 3: Archive Classrooms ──────────────────────────
export async function getArchivedClassrooms(): Promise<Classroom[]> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.getArchivedClassrooms()
  }
  try {
    const res = await fetch('/api/classrooms?archived=true')
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function archiveClassroomRecord(
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.archiveClassroom(id)
  }
  const res = await fetch('/api/classrooms', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'archive' }),
  })
  if (!res.ok) return { success: false, error: 'เก็บถาวรไม่สำเร็จ' }
  return { success: true }
}

export async function unarchiveClassroomRecord(
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.unarchiveClassroom(id)
  }
  const res = await fetch('/api/classrooms', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'unarchive' }),
  })
  if (!res.ok) return { success: false, error: 'นำกลับมาใช้ไม่สำเร็จ' }
  return { success: true }
}

export async function promoteStudentsBetweenClassrooms(
  fromClassroomId: number,
  toClassroomId: number
): Promise<{ success: boolean; moved: number; error?: string }> {
  if (await waitForElectronAPI()) {
    return window.electronAPI!.promoteStudents({ fromClassroomId, toClassroomId })
  }
  try {
    const res = await fetch('/api/classrooms/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromClassroomId, toClassroomId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, moved: 0, error: data?.error || 'เลื่อนชั้นไม่สำเร็จ' }
    }
    return {
      success: !!data?.success,
      moved: Number(data?.moved) || 0,
      error: data?.error,
    }
  } catch (err) {
    return {
      success: false,
      moved: 0,
      error: err instanceof Error ? err.message : 'เลื่อนชั้นไม่สำเร็จ',
    }
  }
}

