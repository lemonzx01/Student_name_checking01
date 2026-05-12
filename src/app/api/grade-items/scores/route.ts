import { NextResponse } from 'next/server'
import {
  getAllGradeItemScoresForClassroom,
  getGradeItemScores,
  saveGradeItemScores,
} from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    if (itemId) {
      return NextResponse.json(getGradeItemScores(Number(itemId)))
    }
    const classroom = searchParams.get('classroom')
    const subjectCode = searchParams.get('subject')
    const semester = searchParams.get('semester')
    const year = searchParams.get('year')
    if (!classroom || !subjectCode || !semester || !year) {
      return NextResponse.json([])
    }
    return NextResponse.json(
      getAllGradeItemScoresForClassroom(
        Number(classroom),
        String(subjectCode),
        Number(semester),
        String(year)
      )
    )
  } catch (error) {
    console.error('[API] GET /grade-items/scores', error)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { itemId, scores } = body
    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }
    saveGradeItemScores(Number(itemId), scores || [])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /grade-items/scores', error)
    return NextResponse.json({ error: 'Failed to save scores' }, { status: 500 })
  }
}
