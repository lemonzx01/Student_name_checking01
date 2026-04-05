import { NextResponse } from 'next/server'
import { getAttendanceByClassroom, saveAttendance } from '@/lib/db'
import { AttendanceStatus } from '@/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = Number(searchParams.get('classroom'))
    const date = searchParams.get('date') || ''

    if (!classroom || !date) {
      return NextResponse.json([])
    }

    return NextResponse.json(getAttendanceByClassroom(classroom, date))
  } catch (error) {
    console.error('[API] GET /api/attendance', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const classroom = Number(body.classroom)
    const date = body.date
    const attendance = body.attendance || {}

    const rows = Object.entries(attendance).map(([studentId, value]: [string, any]) => ({
      student_id: Number(studentId),
      status: (value.status || 'มา') as AttendanceStatus,
      note: value.note || '',
    }))

    saveAttendance(classroom, date, rows)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /api/attendance', error)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}
