import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// API restore backup (Web mode เท่านั้น — Electron ใช้ IPC โดยตรง)
// ใน Web mode ระบบไม่มี desktop runtime — ทำการ copy ไฟล์ทับเฉยๆ
// (ในโหมด Next.js dev ระบบจะ reload module ตอน restart server)
const DAILY_PATTERN = /^school_\d{4}-\d{2}-\d{2}\.db$/
const SNAPSHOT_PATTERN = /^school_before_[a-z_]+_\d{8}_\d{6}\.db$/

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function snapshotTimestamp(): string {
  const now = new Date()
  return (
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  )
}

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json()
    if (typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 })
    }
    if (!DAILY_PATTERN.test(fileName) && !SNAPSHOT_PATTERN.test(fileName)) {
      return NextResponse.json({ error: 'ชื่อไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    const backupDir = path.join(process.cwd(), 'backups')
    const source = path.join(backupDir, fileName)
    if (!fs.existsSync(source)) {
      return NextResponse.json({ error: 'ไฟล์สำรองไม่มีอยู่' }, { status: 404 })
    }

    const dbPath = path.join(process.cwd(), 'school.db')

    // snapshot ปัจจุบันก่อน restore
    if (fs.existsSync(dbPath)) {
      const snapPath = path.join(backupDir, `school_before_restore_${snapshotTimestamp()}.db`)
      try {
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
        fs.copyFileSync(dbPath, snapPath)
      } catch (err) {
        console.warn('[API] snapshot before restore failed:', err)
      }
    }

    fs.copyFileSync(source, dbPath)

    // ลบ WAL/SHM (อาจ stale)
    try {
      const wal = `${dbPath}-wal`
      const shm = `${dbPath}-shm`
      if (fs.existsSync(wal)) fs.unlinkSync(wal)
      if (fs.existsSync(shm)) fs.unlinkSync(shm)
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] POST /backup/restore error:', error)
    return NextResponse.json(
      { error: error?.message || 'restore failed' },
      { status: 500 }
    )
  }
}
