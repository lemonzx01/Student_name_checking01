import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('classroom')
    const classroomId = raw ? Number(raw) : null
    const scope = Number.isFinite(classroomId) && (classroomId ?? 0) > 0 ? classroomId : null
    return NextResponse.json(getDashboardStats(scope))
  } catch (error) {
    console.error('[API] GET /api/stats/dashboard', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
