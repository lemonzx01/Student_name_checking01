import { NextResponse } from 'next/server'
import { getAllHealthByClassroom } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = Number(searchParams.get('classroom'))

    if (!classroom) {
      return NextResponse.json([])
    }

    return NextResponse.json(getAllHealthByClassroom(classroom))
  } catch (error) {
    console.error('[API] GET /api/health/all', error)
    return NextResponse.json([])
  }
}
