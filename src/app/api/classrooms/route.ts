import { NextResponse } from 'next/server'
import { createClassroom, deleteClassroom, getAllClassrooms, updateClassroom } from '@/lib/db'

export async function GET() {
  return NextResponse.json(getAllClassrooms())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const classroom = createClassroom(body.name, body.level, body.academic_year)
    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/classrooms', error)
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    updateClassroom(Number(body.id), {
      name: body.name,
      level: body.level,
      academic_year: body.academic_year,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /api/classrooms', error)
    return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    deleteClassroom(Number(searchParams.get('id')))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /api/classrooms', error)
    return NextResponse.json({ error: 'Failed to delete classroom' }, { status: 500 })
  }
}
