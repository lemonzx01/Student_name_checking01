import { NextResponse } from 'next/server'
import {
  archiveClassroom,
  duplicateClassroom,
  promoteStudents,
} from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sourceId, newName, newAcademicYear, promoteStudents: doPromote, archiveSource } = body
    if (!sourceId || !newName) {
      return NextResponse.json({ error: 'Missing sourceId or newName' }, { status: 400 })
    }
    const result = duplicateClassroom(
      Number(sourceId),
      String(newName),
      String(newAcademicYear || '')
    )
    let movedStudents = 0
    if (doPromote && result.id) {
      movedStudents = promoteStudents(Number(sourceId), result.id)
    }
    if (archiveSource) {
      archiveClassroom(Number(sourceId))
    }
    return NextResponse.json({ success: true, ...result, movedStudents })
  } catch (error: any) {
    console.error('[API] POST /api/classrooms/duplicate', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Duplicate failed' },
      { status: 500 }
    )
  }
}
