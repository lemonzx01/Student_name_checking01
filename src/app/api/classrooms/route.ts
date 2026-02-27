import { NextResponse } from 'next/server'
import { getAllClassrooms, createClassroom, deleteClassroom, updateClassroom } from '@/lib/db'
import { isElectron, getElectronAPI } from '@/lib/electron'

export async function GET(request: Request) {
  try {
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const classrooms = await electronAPI.getClassrooms()
      return NextResponse.json(classrooms)
    }
    
    // Fallback to in-memory data
    return NextResponse.json(getAllClassrooms())
  } catch (error) {
    console.error('[API] GET /classrooms error:', error)
    return NextResponse.json({ error: 'Failed to fetch classrooms' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, level, academic_year } = body
    
    if (!name || !level || !academic_year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const classroom = await electronAPI.createClassroom({ name, level, academic_year })
      return NextResponse.json(classroom, { status: 201 })
    }
    
    // Fallback
    const classroom = createClassroom(name, level, academic_year)
    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    console.error('[API] POST /classrooms error:', error)
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      await electronAPI.deleteClassroom(Number(id))
      return NextResponse.json({ success: true })
    }
    
    // Fallback
    deleteClassroom(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /classrooms error:', error)
    return NextResponse.json({ error: 'Failed to delete classroom' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, level, academic_year } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      await electronAPI.updateClassroom({ id, name, level, academic_year })
      return NextResponse.json({ success: true })
    }
    
    // Fallback
    updateClassroom(Number(id), { name, level, academic_year })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /classrooms error:', error)
    return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
  }
}
