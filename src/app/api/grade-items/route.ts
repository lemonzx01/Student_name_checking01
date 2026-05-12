import { NextResponse } from 'next/server'
import {
  createGradeItem,
  deleteGradeItem,
  getGradeItems,
  updateGradeItem,
} from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const subjectCode = searchParams.get('subject')
    const semester = searchParams.get('semester')
    const year = searchParams.get('year')
    if (!classroom || !subjectCode || !semester || !year) {
      return NextResponse.json([])
    }
    const items = getGradeItems(
      Number(classroom),
      String(subjectCode),
      Number(semester),
      String(year)
    )
    return NextResponse.json(items)
  } catch (error) {
    console.error('[API] GET /grade-items', error)
    return NextResponse.json({ error: 'Failed to fetch grade items' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const item = createGradeItem({
      classroom_id: Number(body.classroom_id),
      subject_code: String(body.subject_code),
      semester: Number(body.semester),
      academic_year: String(body.academic_year),
      item_name: String(body.item_name),
      full_score: Number(body.full_score) || 10,
      weight: Number(body.weight) || 1,
      category: body.category || 'formative',
      display_order: Number(body.display_order) || 0,
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('[API] POST /grade-items', error)
    return NextResponse.json({ error: 'Failed to create grade item' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    updateGradeItem(Number(body.id), {
      item_name: body.item_name,
      full_score: body.full_score,
      weight: body.weight,
      category: body.category,
      display_order: body.display_order,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /grade-items', error)
    return NextResponse.json({ error: 'Failed to update grade item' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    deleteGradeItem(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /grade-items', error)
    return NextResponse.json({ error: 'Failed to delete grade item' }, { status: 500 })
  }
}
