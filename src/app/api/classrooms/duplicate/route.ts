import { NextResponse } from 'next/server'
import { duplicateClassroom } from '@/lib/db'

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
      String(newAcademicYear || ''),
      { promoteStudents: !!doPromote, archiveSource: !!archiveSource }
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[API] POST /api/classrooms/duplicate', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Duplicate failed' },
      { status: 500 }
    )
  }
}
