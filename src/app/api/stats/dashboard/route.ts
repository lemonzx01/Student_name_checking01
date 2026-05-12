import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/db'

export async function GET() {
  try {
    return NextResponse.json(getDashboardStats())
  } catch (error) {
    console.error('[API] GET /api/stats/dashboard', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
