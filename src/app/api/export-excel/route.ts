import { NextResponse } from 'next/server'
import {
  getAllClassrooms,
  getStudentsByClassroom,
  getAllAttendanceByClassroom,
  getAllHealthByClassroom,
} from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!classroom) {
      return NextResponse.json({ error: 'Missing classroom' }, { status: 400 })
    }

    const classroomId = Number(classroom)
    const classrooms = getAllClassrooms()
    const classroomInfo = classrooms.find(c => c.id === classroomId)
    const students = getStudentsByClassroom(classroomId)

    // Get all attendance & health for the classroom
    let attendanceData = getAllAttendanceByClassroom(classroomId)
    let healthData = getAllHealthByClassroom(classroomId)

    // Filter by date range if provided
    if (startDate && endDate) {
      attendanceData = attendanceData.filter(a => a.date >= startDate && a.date <= endDate)
      healthData = healthData.filter(h => h.date >= startDate && h.date <= endDate)
    }

    // Get unique dates sorted
    const attendanceDates = [...new Set(attendanceData.map(a => a.date))].sort()
    const healthDates = [...new Set(healthData.map(h => h.date))].sort()

    return NextResponse.json({
      classroom: classroomInfo,
      students,
      attendance: attendanceData,
      health: healthData,
      attendanceDates,
      healthDates,
    })
  } catch (error) {
    console.error('[API] GET /export-excel error:', error)
    return NextResponse.json({ error: 'Failed to fetch export data' }, { status: 500 })
  }
}
