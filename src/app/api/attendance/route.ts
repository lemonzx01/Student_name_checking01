import { NextResponse } from 'next/server'
import { getAttendanceByClassroom, saveAttendance, getHealthByClassroom, saveHealth, getStudentsByClassroom } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const classroom = searchParams.get('classroom')

    if (!date || !classroom) {
      return NextResponse.json([])
    }

    const classroomId = Number(classroom)
    const students = getStudentsByClassroom(classroomId)
    const attendanceData = getAttendanceByClassroom(classroomId, date)
    const healthData = getHealthByClassroom(classroomId, date)

    // Merge attendance + health per student
    const result = students.map(s => {
      const att = attendanceData.find(a => a.student_id === s.id)
      const hl = healthData.find(h => h.student_id === s.id)
      return {
        id: s.id,
        student_id: s.student_id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: att?.status || 'มา',
        note: att?.note || '',
        brushed_teeth: hl?.brushed_teeth ? 1 : 0,
        drank_milk: hl?.drank_milk ? 1 : 0,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] GET /attendance error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, classroom, attendance, health } = body

    if (!date || !classroom) {
      return NextResponse.json({ error: 'Missing date or classroom' }, { status: 400 })
    }

    const classroomId = Number(classroom)

    // Save attendance
    if (attendance) {
      const attEntries = Object.entries(attendance).map(([studentId, data]: [string, any]) => ({
        student_id: Number(studentId),
        classroom_id: classroomId,
        date,
        status: data.status || 'มา',
        note: data.note || ''
      }))
      saveAttendance(classroomId, date, attEntries)
    }

    // Save health
    if (health) {
      const healthEntries = Object.entries(health).map(([studentId, data]: [string, any]) => ({
        student_id: Number(studentId),
        classroom_id: classroomId,
        date,
        brushed_teeth: Boolean(data.brushed_teeth),
        drank_milk: Boolean(data.drank_milk)
      }))
      saveHealth(classroomId, date, healthEntries)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /attendance error:', error)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}
