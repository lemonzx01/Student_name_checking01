import { NextResponse } from 'next/server'
import {
  archiveClassroom,
  createClassroom,
  deleteClassroom,
  getAllClassrooms,
  getArchivedClassrooms,
  unarchiveClassroom,
  updateClassroom,
} from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('archived') === 'true') {
    return NextResponse.json(getArchivedClassrooms())
  }
  return NextResponse.json(getAllClassrooms())
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!isNonEmptyString(body.name) || !isNonEmptyString(body.level) || !isNonEmptyString(body.academic_year)) {
      return NextResponse.json(
        { error: 'name, level, academic_year ต้องไม่ว่าง' },
        { status: 400 }
      )
    }
    const classroom = createClassroom(body.name, body.level, body.academic_year, body.color)
    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/classrooms', error)
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (body.action === 'archive') {
      archiveClassroom(Number(body.id))
      return NextResponse.json({ success: true })
    }
    if (body.action === 'unarchive') {
      unarchiveClassroom(Number(body.id))
      return NextResponse.json({ success: true })
    }
    updateClassroom(Number(body.id), {
      name: body.name,
      level: body.level,
      academic_year: body.academic_year,
      color: body.color,
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
