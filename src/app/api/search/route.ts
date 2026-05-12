import { NextResponse } from 'next/server'
import { getAllStudents } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ students: [], grades: [] })
  }

  try {
    const allStudents = getAllStudents()
    const students = allStudents.filter((s: any) =>
      s.first_name?.includes(query) ||
      s.last_name?.includes(query) ||
      s.student_id?.includes(query)
    )
    return NextResponse.json({ students, grades: [] })
  } catch (error) {
    console.error('[API] GET /api/search error:', error)
    return NextResponse.json({ students: [], grades: [], error: 'Search failed' }, { status: 500 })
  }
}
