import { NextResponse } from 'next/server'
import { renameSubjectCode, renameSubjectName } from '@/lib/db'

/**
 * POST /api/subjects/rename
 * Body: { from: string, to: string, newName?: string }
 *
 * เปลี่ยนรหัสวิชาในตาราง grades + schedules (และอัปเดตชื่อใน schedules ถ้าส่งมา)
 * ใช้ตอนครูแก้รหัสวิชาในหน้า "จัดการรายวิชา"
 *
 * ตัวอย่าง body:
 *   { "from": "TH", "to": "ท11101", "newName": "ภาษาไทย ป.1" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { from, to, newName } = body as {
      from?: string
      to?: string
      newName?: string
    }

    if (!from || !to) {
      return NextResponse.json(
        { error: 'ต้องส่ง from และ to' },
        { status: 400 }
      )
    }

    const codeResult =
      from !== to
        ? renameSubjectCode(from, to)
        : { gradesUpdated: 0, schedulesUpdated: 0 }

    const nameUpdated = newName ? renameSubjectName(to, newName) : 0

    return NextResponse.json({
      success: true,
      ...codeResult,
      schedulesNameUpdated: nameUpdated,
    })
  } catch (error: any) {
    console.error('[API] POST /subjects/rename error:', error)
    return NextResponse.json(
      { error: error?.message || 'แก้ไขรหัสวิชาไม่สำเร็จ' },
      { status: 500 }
    )
  }
}
