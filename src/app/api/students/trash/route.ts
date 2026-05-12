import { NextResponse } from 'next/server'
import {
  emptyTrash,
  getTrashedStudents,
  purgeStudent,
  restoreStudent,
} from '@/lib/db'

export async function GET() {
  try {
    return NextResponse.json(getTrashedStudents())
  } catch (error) {
    console.error('[API] GET /api/students/trash', error)
    return NextResponse.json({ error: 'Failed to fetch trash' }, { status: 500 })
  }
}

// POST: restore student (action: 'restore')
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.action === 'restore') {
      restoreStudent(Number(body.id), body.newClassroomId ?? null)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[API] POST /api/students/trash', error)
    return NextResponse.json({ error: 'Failed to restore' }, { status: 500 })
  }
}

// DELETE: purge single (?id=) or empty all (?empty=true)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('empty') === 'true') {
      const { purged } = emptyTrash()
      return NextResponse.json({ success: true, purged })
    }
    const id = Number(searchParams.get('id'))
    if (id) {
      purgeStudent(id)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  } catch (error) {
    console.error('[API] DELETE /api/students/trash', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
