import { NextResponse } from 'next/server'
import { importStudents } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const students = Array.isArray(body.students) ? body.students : []

    if (students.length === 0) {
      return NextResponse.json({ error: 'Missing students payload' }, { status: 400 })
    }

    const result = importStudents(students, body.academic_year)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] POST /api/students/import', error)
    return NextResponse.json({ error: 'Failed to import students' }, { status: 500 })
  }
}
