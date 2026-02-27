import { NextResponse } from 'next/server'
import { createStudent } from '@/lib/db'
import { isElectron, getElectronAPI } from '@/lib/electron'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { students, classroom_id } = body
    
    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }
    
    // Check for Electron API
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const result = await electronAPI.importStudentsExcel(students)
      return NextResponse.json(result)
    }
    
    // Validate classroom_id
    if (!classroom_id) {
      return NextResponse.json({ error: 'Missing classroom_id' }, { status: 400 })
    }

    // Fallback to in-memory db for web mode
    let imported = 0
    for (const s of students) {
      try {
        const cid = s.classroom_id || classroom_id
        if (!cid) continue // skip if still no classroom
        createStudent({
          student_id: s.student_id || String(imported + 1),
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          classroom_id: Number(cid),
          gender: s.gender || '',
          birth_date: s.birth_date || undefined,
        })
        imported++
      } catch (e) {
        console.error('Failed to import student:', e)
      }
    }

    return NextResponse.json({ success: true, imported })
  } catch (error) {
    console.error('[API] POST /api/students/import error:', error)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
