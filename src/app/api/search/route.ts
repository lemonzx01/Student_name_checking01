import { NextResponse } from 'next/server'
import { getAllStudents } from '@/lib/db'
import { isElectron, getElectronAPI } from '@/lib/electron'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ students: [], grades: [] })
  }

  try {
    let students: any[] = []
    const grades: any[] = []

    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const allStudents = await electronAPI.getStudents()
      students = allStudents.filter((s: any) => 
        s.first_name.includes(query) || 
        s.last_name.includes(query) || 
        s.student_id.includes(query)
      )
    } else {
      // Use in-memory db directly
      const allStudents = getAllStudents()
      students = allStudents.filter((s: any) => 
        s.first_name?.includes(query) || 
        s.last_name?.includes(query) || 
        s.student_id?.includes(query)
      )
    }

    return NextResponse.json({ students, grades })
  } catch (error) {
    console.error('[API] GET /api/search error:', error)
    return NextResponse.json({ students: [], grades: [], error: 'Search failed' }, { status: 500 })
  }
}
