'use client'

import {
  AttendanceRecord,
  AttendanceStatus,
  Classroom,
  ImportedStudentInput,
  ImportStudentsResult,
  Student,
  StudentFormInput,
} from '@/types'

function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'
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
  if (isElectronRuntime()) {
    return window.electronAPI!.getClassrooms()
  }

  return fetchJson<Classroom[]>('/api/classrooms')
}

export async function createClassroomRecord(input: {
  name: string
  level: string
  academic_year: string
}): Promise<Classroom> {
  if (isElectronRuntime()) {
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
  }
): Promise<void> {
  if (isElectronRuntime()) {
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
  if (isElectronRuntime()) {
    await window.electronAPI!.deleteClassroom(id)
    return
  }

  await fetchJson(`/api/classrooms?id=${id}`, {
    method: 'DELETE',
  })
}

export async function getStudents(classroomId?: number | null): Promise<Student[]> {
  if (isElectronRuntime()) {
    const rows = await window.electronAPI!.getStudents(classroomId ?? null)
    return rows.map(hydrateStudent)
  }

  const query = classroomId ? `?classroom=${classroomId}` : ''
  const rows = await fetchJson<Student[]>(`/api/students${query}`)
  return rows.map(hydrateStudent)
}

export async function createStudentRecord(input: StudentFormInput): Promise<Student> {
  if (isElectronRuntime()) {
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
  if (isElectronRuntime()) {
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
  if (isElectronRuntime()) {
    await window.electronAPI!.deleteStudent(id)
    return
  }

  await fetchJson(`/api/students?id=${id}`, {
    method: 'DELETE',
  })
}

export async function getAttendance(date: string, classroomId: number): Promise<AttendanceRecord[]> {
  if (isElectronRuntime()) {
    return window.electronAPI!.getAttendance({ date, classroom: classroomId })
  }

  return fetchJson<AttendanceRecord[]>(`/api/attendance?date=${date}&classroom=${classroomId}`)
}

export async function saveAttendanceRecord(
  date: string,
  classroomId: number,
  attendance: Record<number, { status: AttendanceStatus; note?: string }>
): Promise<void> {
  if (isElectronRuntime()) {
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

export async function importStudentsFromExcel(
  students: ImportedStudentInput[]
): Promise<ImportStudentsResult> {
  if (isElectronRuntime()) {
    return window.electronAPI!.importStudentsExcel(students)
  }

  return fetchJson<ImportStudentsResult>('/api/students/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  })
}
