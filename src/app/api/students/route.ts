import { NextResponse } from 'next/server'
import { createStudent, deleteStudent, getAllStudents, getStudentsByClassroom, updateStudent } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const rows = classroom ? getStudentsByClassroom(Number(classroom)) : getAllStudents()
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[API] GET /api/students', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const student = createStudent(body)
    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/students', error)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    const body = await request.json()
    updateStudent(id, body)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /api/students', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    deleteStudent(Number(searchParams.get('id')))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /api/students', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
