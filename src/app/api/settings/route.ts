import { NextResponse } from 'next/server'
import { importData, exportAllData, clearAllData } from '@/lib/db'

// หมายเหตุ: route นี้รันบน Next.js server side เท่านั้น
// ในโหมด Electron, client จะเรียก IPC (window.electronAPI) ตรงๆ — ไม่ผ่าน /api
// ดังนั้นที่นี่ใช้ Web data layer (src/lib/db.ts) ตรงๆ ไม่ต้องมี Electron branch

export async function GET() {
  try {
    const data = exportAllData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] GET /settings error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}

const MAX_IMPORT_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกินกำหนด (50 MB)' }, { status: 413 })
    }
    const body = await request.json()
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }
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
