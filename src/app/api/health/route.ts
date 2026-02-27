import { NextResponse } from 'next/server'
import { getAllClassrooms, getStudentsByClassroom } from '@/lib/db'

// In-memory health data store (weight/height)
declare global {
  var healthRecords: Record<string, { weight: number; height: number; date: string }> | undefined
}

if (!global.healthRecords) {
  global.healthRecords = {}
}
const healthRecords = global.healthRecords

function calculateBMI(weight: number, height: number): { bmi: number; bmiStatus: string } {
  if (weight <= 0 || height <= 0) return { bmi: 0, bmiStatus: '' }
  const heightInMeters = height / 100
  const bmi = weight / (heightInMeters * heightInMeters)
  let bmiStatus = ''
  if (bmi < 18.5) bmiStatus = 'ผอม'
  else if (bmi < 23) bmiStatus = 'ปกติ'
  else if (bmi < 25) bmiStatus = 'น้ำหนักเกิน'
  else if (bmi < 30) bmiStatus = 'อ้วน'
  else bmiStatus = 'อ้วนมาก'
  return { bmi: Math.round(bmi * 10) / 10, bmiStatus }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const classroom = searchParams.get('classroom')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const mode = searchParams.get('mode') // 'export' for bulk export

  try {
    const students = classroom ? getStudentsByClassroom(Number(classroom)) : []

    if (mode === 'export') {
      // Export mode: return all records for the classroom within date range
      const startDate = searchParams.get('startDate') || ''
      const endDate = searchParams.get('endDate') || ''
      const studentIds = new Set(students.map(s => s.id))

      // Collect all records for these students
      const allRecords: {
        student_id: number
        student_name: string
        student_code: string
        weight: number
        height: number
        bmi: number
        bmi_status: string
        date: string
      }[] = []

      const dates = new Set<string>()

      for (const [key, record] of Object.entries(healthRecords)) {
        const [sidStr] = key.split('-')
        const sid = Number(sidStr)
        if (!studentIds.has(sid)) continue
        if (record.weight <= 0 && record.height <= 0) continue
        if (startDate && record.date < startDate) continue
        if (endDate && record.date > endDate) continue

        const student = students.find(s => s.id === sid)
        if (!student) continue

        const { bmi, bmiStatus } = calculateBMI(record.weight, record.height)
        dates.add(record.date)
        allRecords.push({
          student_id: sid,
          student_name: `${student.first_name} ${student.last_name}`,
          student_code: student.student_id,
          weight: record.weight,
          height: record.height,
          bmi,
          bmi_status: bmiStatus,
          date: record.date,
        })
      }

      return NextResponse.json({
        students,
        records: allRecords,
        dates: [...dates].sort(),
      })
    }

    // Normal mode: single date
    const records = students.map(student => {
      const key = `${student.id}-${date}`
      const record = healthRecords[key]
      const { bmi, bmiStatus } = calculateBMI(record?.weight || 0, record?.height || 0)

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        weight: record?.weight || 0,
        height: record?.height || 0,
        bmi,
        bmi_status: bmiStatus,
        date
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
    const { student_id, weight, height, date } = body

    if (!student_id || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const key = `${student_id}-${date}`
    healthRecords[key] = {
      weight: weight || 0,
      height: height || 0,
      date
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /health error:', error)
    return NextResponse.json({ error: 'Failed to save health data' }, { status: 500 })
  }
}
