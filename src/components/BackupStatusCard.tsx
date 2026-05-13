'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, FolderOpen, AlertCircle } from 'lucide-react'
import { getBackupInfo, openBackupFolder, type BackupInfo } from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'
import { THAI_MONTHS_SHORT } from '@/lib/constants/thai-date'

function formatBackupTime(iso: string | null): string {
  if (!iso) return 'ยังไม่มีไฟล์สำรอง'

  const backup = new Date(iso)
  const now = new Date()

  // ตั้ง 00:00:00 เพื่อเทียบ "วันไหน"
  const backupDay = new Date(backup)
  backupDay.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - backupDay.getTime()) / (1000 * 60 * 60 * 24))

  const hh = String(backup.getHours()).padStart(2, '0')
  const mm = String(backup.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm} น.`

  if (diffDays === 0) return `วันนี้ ${timeStr}`
  if (diffDays === 1) return `เมื่อวาน ${timeStr}`
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`

  // เกิน 7 วัน แสดงวันที่จริง
  const d = backup.getDate()
  const month = THAI_MONTHS_SHORT[backup.getMonth()]
  const year = backup.getFullYear() + 543
  return `${d} ${month} ${year}`
}

export default function BackupStatusCard() {
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const { alert } = useDialog()

  useEffect(() => {
    let mounted = true
    getBackupInfo()
      .then((data) => {
        if (mounted) setInfo(data)
      })
      .catch(() => {
        if (mounted) setInfo({ lastBackup: null, count: 0, folder: null, available: false })
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function handleOpenFolder() {
    setOpening(true)
    try {
      const result = await openBackupFolder()
      if (!result.success && result.error) {
        await alert({
          title: 'เปิดโฟลเดอร์ไม่สำเร็จ',
          message: result.error,
          variant: 'error',
        })
      }
    } finally {
      setOpening(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-56" />
          </div>
        </div>
      </div>
    )
  }

  // กรณีเปิดในโหมดเว็บ dev (ไม่ใช่ Electron) — ไม่มีระบบสำรองจริงทำงาน
  if (info && !info.available) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50 p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">ระบบสำรองอัตโนมัติ</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              ใช้ได้เมื่อเปิดผ่านโปรแกรมหลัก (Desktop)
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hasBackup = !!info?.lastBackup

  return (
    <div
      className={`rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-sm)] ${
        hasBackup ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              hasBackup ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {hasBackup ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="min-w-0">
            <p
              className={`text-sm font-bold ${
                hasBackup ? 'text-emerald-800' : 'text-amber-800'
              }`}
            >
              {hasBackup ? 'ข้อมูลของคุณปลอดภัย' : 'ยังไม่มีไฟล์สำรอง'}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                hasBackup ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {hasBackup ? (
                <>
                  สำรองอัตโนมัติล่าสุด:{' '}
                  <span className="font-semibold">{formatBackupTime(info!.lastBackup)}</span>
                  {info!.count > 1 && (
                    <span className="ml-1 text-[var(--muted)]">(เก็บย้อนหลัง {info!.count} วัน)</span>
                  )}
                </>
              ) : (
                'ระบบจะสำรองข้อมูลครั้งแรกเมื่อเปิดแอปครั้งต่อไป'
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenFolder}
          disabled={opening}
          className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[var(--shadow-sm)] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
          title="เปิดโฟลเดอร์ที่เก็บไฟล์สำรอง (ก๊อปไป USB / Google Drive ได้)"
        >
          <FolderOpen size={14} />
          เปิดโฟลเดอร์สำรอง
        </button>
      </div>
    </div>
  )
}
