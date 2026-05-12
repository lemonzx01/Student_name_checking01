import { NextResponse } from 'next/server'
import { addStudentNote, deleteStudentNote, getNotesByStudent } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const student = searchParams.get('student')

    if (!student) {
      return NextResponse.json([])
    }

    const notes = getNotesByStudent(Number(student))
    return NextResponse.json(notes)
  } catch (error) {
    console.error('[API] GET /notes error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { student_id, date, note } = body

    if (!student_id || !date || !note) {
      return NextResponse.json({ error: 'Missing student_id / date / note' }, { status: 400 })
    }

    const row = addStudentNote(Number(student_id), String(date), String(note))
    return NextResponse.json(row)
  } catch (error) {
    console.error('[API] POST /notes error:', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    deleteStudentNote(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /notes error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
