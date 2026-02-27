import { NextResponse } from 'next/server'
import { importData, exportAllData, clearAllData } from '@/lib/db'
import { isElectron, getElectronAPI } from '@/lib/electron'

export async function GET(request: Request) {
  try {
    // Check for Electron API
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const data = await electronAPI.exportData()
      return NextResponse.json(data)
    }
    
    // Fallback to in-memory data for web mode
    const data = exportAllData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] GET /settings error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Check for Electron API
    const electronMode = isElectron(request)
    const electronAPI = getElectronAPI()
    
    if (electronMode && electronAPI) {
      const result = await electronAPI.importData(body)
      if (result.success) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json({ error: result.error || 'Import failed' }, { status: 500 })
      }
    }
    
    // Use in-memory store for web mode
    const result = importData(body)
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error || 'Import failed' }, { status: 500 })
    }
  } catch (error) {
    console.error('[API] POST /settings error:', error)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const result = clearAllData()
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
    }
  } catch (error) {
    console.error('[API] DELETE /settings error:', error)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}
