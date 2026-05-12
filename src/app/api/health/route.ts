import { NextResponse } from 'next/server'
import { getStudentsByClassroom, getHealthByClassroom, saveHealth, getAllHealthByClassroom } from '@/lib/db'
import { calculateBmi } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const classroom = searchParams.get('classroom')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const mode = searchParams.get('mode')

  try {
    if (!classroom) {
      return NextResponse.json([])
    }

    const classroomId = Number(classroom)
    const students = getStudentsByClassroom(classroomId)

    if (mode === 'export') {
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

      const records = allHealth.flatMap(h => {
        const student = students.find(s => s.id === h.student_id)
        if (!student) return []
        const weight = h.weight_kg ?? null
        const height = h.height_cm ?? null
        const bmiInfo = weight && height ? calculateBmi(weight, height) : { bmi: 0, status: '' }
        return [{
          student_id: h.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          student_code: student.student_id,
          brushed_teeth: h.brushed_teeth,
          drank_milk: h.drank_milk,
          weight_kg: weight,
          height_cm: height,
          bmi: bmiInfo.bmi,
          bmi_status: bmiInfo.status,
          date: h.date,
        }]
      })

      return NextResponse.json({
        students,
        records,
        dates,
      })
    }

    const healthEntries = getHealthByClassroom(classroomId, date)

    const records = students.map(student => {
      const entry = healthEntries.find(h => h.student_id === student.id)
      const weight = entry?.weight_kg ?? student.weight_kg ?? null
      const height = entry?.height_cm ?? student.height_cm ?? null
      const bmiInfo = weight && height ? calculateBmi(weight, height) : { bmi: 0, status: '' }
      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_code: student.student_id,
        title: student.title ?? '',
        brushed_teeth: entry?.brushed_teeth ?? false,
        drank_milk: entry?.drank_milk ?? false,
        weight_kg: weight,
        height_cm: height,
        bmi: bmiInfo.bmi,
        bmi_status: bmiInfo.status,
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
    const { classroom, date } = body
    // รับทั้ง entries (key ใหม่ ตรงกับ Electron IPC) และ records (backward compat)
    const records = Array.isArray(body.entries) ? body.entries : body.records

    if (!classroom || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const classroomId = Number(classroom)

    if (Array.isArray(records)) {
      const entries = records.map((r: {
        student_id: number
        brushed_teeth?: boolean
        drank_milk?: boolean
        weight_kg?: number | null
        height_cm?: number | null
      }) => ({
        student_id: r.student_id,
        brushed_teeth: r.brushed_teeth ?? false,
        drank_milk: r.drank_milk ?? false,
        weight_kg: r.weight_kg ?? null,
        height_cm: r.height_cm ?? null,
      }))
      saveHealth(classroomId, date, entries)
    } else {
      const { student_id, brushed_teeth, drank_milk, weight_kg, height_cm } = body
      if (!student_id) {
        return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })
      }

      const existing = getHealthByClassroom(classroomId, date)
      const otherEntries = existing
        .filter(h => h.student_id !== student_id)
        .map(h => ({
          student_id: h.student_id,
          brushed_teeth: h.brushed_teeth,
          drank_milk: h.drank_milk,
          weight_kg: h.weight_kg ?? null,
          height_cm: h.height_cm ?? null,
        }))

      otherEntries.push({
        student_id,
        brushed_teeth: brushed_teeth ?? false,
        drank_milk: drank_milk ?? false,
        weight_kg: weight_kg ?? null,
        height_cm: height_cm ?? null,
      })

      saveHealth(classroomId, date, otherEntries)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /health error:', error)
    return NextResponse.json({ error: 'Failed to save health data' }, { status: 500 })
  }
}
