import { NextResponse } from 'next/server'
import { getStudentsByClassroom, getAllStudents, createStudent, updateStudent, deleteStudent } from '@/lib/db'
import { isElectron, getElectronAPI } from '@/lib/electron'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classroom = searchParams.get('classroom')
    const search = searchParams.get('q')
    
    // Check if running in Electron
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      let students = await electronAPI.getStudents(classroom ? Number(classroom) : null)
      
      // Filter by search query
      if (search && search.length >= 2) {
        students = students.filter((s: any) => 
          s.first_name.toLowerCase().includes(search.toLowerCase()) ||
          s.last_name.toLowerCase().includes(search.toLowerCase()) ||
          s.student_id.toLowerCase().includes(search.toLowerCase())
        )
      }
      
      return NextResponse.json(students)
    }
    
    // Fallback to in-memory data (dev mode)
    let result = classroom ? getStudentsByClassroom(Number(classroom)) : getAllStudents()
    
    // Filter by search query
    if (search && search.length >= 2) {
      result = result.filter((s: any) => 
        s.first_name.toLowerCase().includes(search.toLowerCase()) ||
        s.last_name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_id.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] GET /students error:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const student = await electronAPI.createStudent(body)
      return NextResponse.json(student, { status: 201 })
    }
    
    // Fallback
    const student = createStudent(body)
    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error('[API] POST /students error:', error)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      await electronAPI.updateStudent({ id: Number(id), ...body })
      return NextResponse.json({ success: true })
    }
    
    // Fallback
    updateStudent(Number(id), body)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /students error:', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      await electronAPI.deleteStudent(Number(id))
      return NextResponse.json({ success: true })
    }
    
    // Fallback
    deleteStudent(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /students error:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
