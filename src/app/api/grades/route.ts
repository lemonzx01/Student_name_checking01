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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { classroom, semester, year, grades } = body

    if (!classroom) {
      return NextResponse.json({ error: 'Missing classroom' }, { status: 400 })
    }

    const entries = Object.entries(grades || {}).flatMap(([studentId, subjects]: [string, any]) =>
      Object.entries(subjects).map(([subjectCode, score]: [string, any]) => ({
        student_id: Number(studentId),
        subject_code: subjectCode,
        score: Number(score),
        classroom_id: Number(classroom),
        semester: Number(semester),
        academic_year: year
      }))
    ).filter(e => e.score !== null && e.score !== undefined && !isNaN(e.score))

    saveGrades(Number(classroom), Number(semester), year, entries)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /grades error:', error)
    return NextResponse.json({ error: 'Failed to save grades' }, { status: 500 })
  }
}
