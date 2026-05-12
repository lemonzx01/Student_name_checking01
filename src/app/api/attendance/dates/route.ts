import { NextResponse } from 'next/server'
import { getAttendanceDates } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = Number(searchParams.get('classroom'))
    const yearMonth = searchParams.get('yearMonth') || ''

    if (!classroom || !yearMonth) {
      return NextResponse.json([])
    }

    return NextResponse.json(getAttendanceDates(classroom, yearMonth))
  } catch (error) {
    console.error('[API] GET /api/attendance/dates', error)
    return NextResponse.json({ error: 'Failed to fetch attendance dates' }, { status: 500 })
  }
}
