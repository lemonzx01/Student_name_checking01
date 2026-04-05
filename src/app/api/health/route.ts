import { NextResponse } from 'next/server'
import { getStudentsByClassroom, getHealthByClassroom, saveHealth, getAllHealthByClassroom } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const classroom = searchParams.get('classroom')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const mode = searchParams.get('mode') // 'export' for bulk export

  try {
    if (!classroom) {
      return NextResponse.json([])
    }

    const classroomId = Number(classroom)
    const students = getStudentsByClassroom(classroomId)

    if (mode === 'export') {
      // Export mode: return all records for the classroom within date range
      const startDate = searchParams.get('startDate') || ''
      const endDate = searchParams.get('endDate') || ''

      let allHealth = getAllHealthByClassroom(classroomId)

      if (startDate) {
        allHealth = allHealth.filter(h => h.date >= startDate)
      }
      if (endDate) {
        allHealth = allHealth.filter(h => h.date <= endDate)
      }

      const dates = [...new Set(allHealth.map(h => h.date))].sort()

      const records = allHealth.map(h => {
        const student = students.find(s => s.id === h.student_id)
        return {
          student_id: h.student_id,
          student_name: student ? `${student.first_name} ${student.last_name}` : '',
          student_code: student?.student_id ?? '',
          brushed_teeth: h.brushed_teeth,
          drank_milk: h.drank_milk,
          date: h.date,
        }
      })

      return NextResponse.json({
        students,
        records,
        dates,
      })
    }

    // Normal mode: single date
    const healthEntries = getHealthByClassroom(classroomId, date)

    const records = students.map(student => {
      const entry = healthEntries.find(h => h.student_id === student.id)
      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        brushed_teeth: entry?.brushed_teeth ?? false,
        drank_milk: entry?.drank_milk ?? false,
        date,
      }
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('[API] GET /health error:', error)
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { classroom, date, records } = body

    if (!classroom || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const classroomId = Number(classroom)

    // Accept either a single record or an array of records
    if (Array.isArray(records)) {
      const entries = records.map((r: { student_id: number; brushed_teeth?: boolean; drank_milk?: boolean }) => ({
        student_id: r.student_id,
        brushed_teeth: r.brushed_teeth ?? false,
        drank_milk: r.drank_milk ?? false,
      }))
      saveHealth(classroomId, date, entries)
    } else {
      // Legacy single-record support
      const { student_id, brushed_teeth, drank_milk } = body
      if (!student_id) {
        return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })
      }

      // Get existing entries for this date, update the one student, then save all
      const existing = getHealthByClassroom(classroomId, date)
      const otherEntries = existing
        .filter(h => h.student_id !== student_id)
        .map(h => ({
          student_id: h.student_id,
          brushed_teeth: h.brushed_teeth,
          drank_milk: h.drank_milk,
        }))

      otherEntries.push({
        student_id,
        brushed_teeth: brushed_teeth ?? false,
        drank_milk: drank_milk ?? false,
      })

      saveHealth(classroomId, date, otherEntries)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /health error:', error)
    return NextResponse.json({ error: 'Failed to save health data' }, { status: 500 })
  }
}
