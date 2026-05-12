import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * API สำหรับดูสถานะไฟล์สำรอง (ใช้เฉพาะโหมดเว็บ dev)
 * ในโหมด Electron การ backup จริงทำใน electron/main.js (runDailyBackup)
 * route นี้แค่สแกนโฟลเดอร์เพื่อแสดงข้อมูลเท่านั้น (ไม่สร้างไฟล์สำรอง)
 */

const BACKUP_FILE_PATTERN = /^school_\d{4}-\d{2}-\d{2}\.db$/

export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), 'backups')

    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({
        lastBackup: null,
        count: 0,
        folder: backupDir,
      })
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => BACKUP_FILE_PATTERN.test(f))
      .sort()
      .reverse()

    if (files.length === 0) {
      return NextResponse.json({
        lastBackup: null,
        count: 0,
        folder: backupDir,
      })
    }

    const latest = files[0]
    const stats = fs.statSync(path.join(backupDir, latest))

    return NextResponse.json({
      lastBackup: stats.mtime.toISOString(),
      count: files.length,
      folder: backupDir,
    })
  } catch (error: any) {
    console.error('[API] GET /backup/info error:', error)
    return NextResponse.json(
      { lastBackup: null, count: 0, folder: null, error: error.message },
      { status: 500 }
    )
  }
}
