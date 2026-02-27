import { NextResponse } from 'next/server'
import { getScheduleByClassroom, saveSchedule } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')

    if (!classroom) {
      return NextResponse.json([])
    }

    const data = getScheduleByClassroom(Number(classroom))
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] GET /schedule error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { classroom, schedule } = body

    if (!classroom) {
      return NextResponse.json({ error: 'Missing classroom' }, { status: 400 })
    }

    const entries = Object.entries(schedule).map(([key, value]: [string, any]) => {
      const [day, period] = key.split('-').map(Number)
      return {
        classroom_id: Number(classroom),
        day_of_week: day,
        period,
        subject_code: value.subject_code || '',
        subject_name: value.subject_name || '',
        class_level: value.class_level || '',
        room: value.room || ''
      }
    }).filter(e => e.subject_code || e.subject_name)

    saveSchedule(Number(classroom), entries)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /schedule error:', error)
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }
}
