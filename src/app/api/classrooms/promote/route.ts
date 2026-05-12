import { NextResponse } from 'next/server'
import { promoteStudents } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fromClassroomId, toClassroomId } = body

    if (!fromClassroomId || !toClassroomId) {
      return NextResponse.json(
        { success: false, moved: 0, error: 'Missing fromClassroomId or toClassroomId' },
        { status: 400 }
      )
    }

    const moved = promoteStudents(Number(fromClassroomId), Number(toClassroomId))

    if (!moved && moved !== 0) {
      return NextResponse.json({ success: false, moved: 0, error: 'ไม่พบห้องปลายทาง' })
    }

    return NextResponse.json({ success: true, moved })
  } catch (error: any) {
    console.error('[API] POST /api/classrooms/promote', error)
    return NextResponse.json(
      { success: false, moved: 0, error: error?.message || 'Promote failed' },
      { status: 500 }
    )
  }
}
