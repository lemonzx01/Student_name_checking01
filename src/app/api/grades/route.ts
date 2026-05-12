import { NextResponse } from 'next/server'
import { getGradesByClassroom, saveGrades } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const semester = searchParams.get('semester')
    const year = searchParams.get('year')

    if (!classroom || !semester || !year) {
      return NextResponse.json([])
    }

    const data = getGradesByClassroom(Number(classroom), Number(semester), year)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] GET /grades error:', error)
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { classroom, semester, year, grades } = body

    const classroomId = Number(classroom)
    if (!classroom || !Number.isFinite(classroomId)) {
      return NextResponse.json({ error: 'Missing or invalid classroom' }, { status: 400 })
    }

    const semesterNum = Number(semester)
    if (semester === undefined || semester === null || !Number.isFinite(semesterNum)) {
      return NextResponse.json({ error: 'Missing or invalid semester' }, { status: 400 })
    }

    if (typeof year !== 'string' || year.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid year' }, { status: 400 })
    }

    if (!isPlainObject(grades)) {
      return NextResponse.json({ error: 'Invalid grades payload' }, { status: 400 })
    }

    // grades format: { [studentId]: { [subjectCode]: { midterm: number, final: number } } }
    const entries = Object.entries(grades).flatMap(([studentId, subjects]) => {
      if (!isPlainObject(subjects)) return []
      const sid = Number(studentId)
      if (!Number.isFinite(sid)) return []
      return Object.entries(subjects).map(([subjectCode, val]) => {
        const v = isPlainObject(val) ? val : {}
        const midterm = Number((v as any).midterm ?? (v as any).midterm_score ?? 0) || 0
        const final_ = Number((v as any).final ?? (v as any).final_score ?? 0) || 0
        return {
          student_id: sid,
          subject_code: subjectCode,
          score: midterm + final_,
          midterm_score: midterm,
          final_score: final_,
          classroom_id: classroomId,
          semester: semesterNum,
          academic_year: year,
        }
      })
    })

    saveGrades(classroomId, semesterNum, year, entries)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /grades error:', error)
    return NextResponse.json({ error: 'Failed to save grades' }, { status: 500 })
  }
}
