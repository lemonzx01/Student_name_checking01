import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// API list backup (Web mode เท่านั้น — Electron ใช้ IPC โดยตรง)
const DAILY_PATTERN = /^school_\d{4}-\d{2}-\d{2}\.db$/
const SNAPSHOT_PATTERN = /^school_before_[a-z_]+_\d{8}_\d{6}\.db$/

export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) {
      return NextResponse.json([])
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => DAILY_PATTERN.test(f) || SNAPSHOT_PATTERN.test(f))

    const items = files.map((fileName) => {
      const full = path.join(backupDir, fileName)
      const stats = fs.statSync(full)
      return {
        fileName,
        date: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      }
    })
    items.sort((a, b) => (a.date < b.date ? 1 : -1))
    return NextResponse.json(items)
  } catch (error: any) {
    console.error('[API] GET /backup/list error:', error)
    return NextResponse.json([], { status: 500 })
  }
}
