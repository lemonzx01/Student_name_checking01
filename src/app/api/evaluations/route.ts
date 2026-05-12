import { NextResponse } from 'next/server'
import { getEvaluations, saveEvaluations } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const semester = searchParams.get('semester')
    const year = searchParams.get('year')
    if (!classroom || !semester || !year) {
      return NextResponse.json([])
    }
    const list = getEvaluations(Number(classroom), Number(semester), String(year))
    return NextResponse.json(list)
  } catch (error) {
    console.error('[API] GET /evaluations', error)
    return NextResponse.json({ error: 'Failed to fetch evaluations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { classroom, semester, year, evaluations } = body
    if (!classroom || !semester || !year) {
      return NextResponse.json({ error: 'Missing classroom/semester/year' }, { status: 400 })
    }
    saveEvaluations(Number(classroom), Number(semester), String(year), evaluations || [])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] POST /evaluations', error)
    return NextResponse.json({ error: 'Failed to save evaluations' }, { status: 500 })
  }
}
