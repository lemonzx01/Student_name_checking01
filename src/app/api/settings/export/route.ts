import { NextResponse } from 'next/server'
import { exportAllData } from '@/lib/db'
import { DEFAULT_SUBJECTS } from '@/types'

export async function GET() {
  try {
    const data = exportAllData()
    
    return NextResponse.json({
      ...data,
      subjects: DEFAULT_SUBJECTS
    })
  } catch (error) {
    console.error('[API] GET /settings/export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
