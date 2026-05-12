'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle,
  GraduationCap,
  Calendar,
  Laptop,
  Lock,
  Moon,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  Type,
  Info,
  History,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { getAllStats, listBackups, restoreBackup, type BackupFile } from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'
import { useTheme, type FontSize, type ThemeMode } from '@/lib/hooks/useTheme'
import { disablePin, hashPin, isPinEnabled, getStoredPinHash, setStoredPin } from '@/components/PinGate'

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function formatBackupDate(iso: string): string {
  try {
    const d = new Date(iso)
    const day = d.getDate()
    const month = THAI_MONTHS_SHORT[d.getMonth()]
    const year = d.getFullYear() + 543
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month} ${year} · ${hh}:${mm} น.`
  } catch {
    return iso
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function describeBackupFile(fileName: string): string {
  if (fileName.includes('before_clear')) return 'สำรองก่อนลบทั้งหมด'
  if (fileName.includes('before_restore')) return 'สำรองก่อนกู้คืน'
  if (fileName.includes('before_delete_classroom')) return 'สำรองก่อนลบห้อง'
  if (/^school_\d{4}-\d{2}-\d{2}\.db$/.test(fileName)) return 'สำรองอัตโนมัติประจำวัน'
  return 'ไฟล์สำรอง'
}

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [backupsLoading, setBackupsLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const isElectron =
    typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'
  const { confirm, alert } = useDialog()
  const { mode: themeMode, fontSize, setMode: setThemeMode, setFontSize, ready: themeReady } = useTheme()

  // PIN state
  const [pinEnabled, setPinEnabled] = useState(false)
  const [pinForm, setPinForm] = useState<'idle' | 'enable' | 'change' | 'disable'>('idle')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  useEffect(() => {
    setPinEnabled(isPinEnabled())
  }, [])

  async function verifyCurrentPin(pin: string): Promise<boolean> {
    const stored = getStoredPinHash()
    if (!stored) return false
    const hash = await hashPin(pin)
    return hash === stored
  }

  function resetPinForm() {
    setPinForm('idle')
    setPinNew('')
    setPinConfirm('')
    setPinCurrent('')
    setPinError('')
  }

  async function handlePinSubmit() {
    setPinError('')
    setPinSaving(true)
    try {
      if (pinForm === 'enable') {
        if (pinNew.length < 4 || pinNew.length > 6 || !/^\d+$/.test(pinNew)) {
          setPinError('PIN ต้องเป็นตัวเลข 4-6 หลัก')
          return
        }
        if (pinNew !== pinConfirm) {
          setPinError('PIN สองช่องไม่ตรงกัน')
          return
        }
        await setStoredPin(pinNew, true)
        setPinEnabled(true)
        resetPinForm()
        setMessage({ type: 'success', text: 'เปิดใช้ PIN ล็อกเรียบร้อยแล้ว' })
      } else if (pinForm === 'change') {
        const ok = await verifyCurrentPin(pinCurrent)
        if (!ok) {
          setPinError('PIN ปัจจุบันไม่ถูกต้อง')
          return
        }
        if (pinNew.length < 4 || pinNew.length > 6 || !/^\d+$/.test(pinNew)) {
          setPinError('PIN ใหม่ต้องเป็นตัวเลข 4-6 หลัก')
          return
        }
        if (pinNew !== pinConfirm) {
          setPinError('PIN ใหม่สองช่องไม่ตรงกัน')
          return
        }
        await setStoredPin(pinNew, true)
        resetPinForm()
        setMessage({ type: 'success', text: 'เปลี่ยน PIN เรียบร้อยแล้ว' })
      } else if (pinForm === 'disable') {
        const ok = await verifyCurrentPin(pinCurrent)
        if (!ok) {
          setPinError('PIN ปัจจุบันไม่ถูกต้อง')
          return
        }
        disablePin()
        setPinEnabled(false)
        resetPinForm()
        setMessage({ type: 'success', text: 'ปิดใช้ PIN เรียบร้อยแล้ว' })
      }
    } finally {
      setPinSaving(false)
    }
  }

  const loadBackups = async () => {
    setBackupsLoading(true)
    try {
      const list = await listBackups()
      setBackups(list)
    } finally {
      setBackupsLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)

    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI

      let data: any
      if (isElectron) {
        data = await window.electronAPI!.exportData()
      } else {
        const res = await fetch('/api/settings/export')
        if (!res.ok) throw new Error('Export failed')
        data = await res.json()
        if (data.error) throw new Error(data.error)
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: 'สำรองข้อมูลสำเร็จ!' })
    } catch (error) {
      console.error('Export error:', error)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการสำรองข้อมูล' })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.version || !data.classrooms || !data.students) {
        throw new Error('Invalid backup file format')
      }

      const isElectron = typeof window !== 'undefined' && window.electronAPI

      if (isElectron) {
        const result = await window.electronAPI!.importData(data)
        if (!result.success) throw new Error(result.error || 'Import failed')
      } else {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Import failed')
      }

      setMessage({ type: 'success', text: 'นำเข้าข้อมูลสำเร็จ! กำลังรีเฟรช...' })
      setTimeout(() => (window.location.href = '/'), 1500)
    } catch (error) {
      console.error('Import error:', error)
      setMessage({ type: 'error', text: 'ไฟล์ไม่ถูกต้องหรือเกิดข้อผิดพลาด' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleDeleteAll = async () => {
    // โหลดสถิติเพื่อแสดงผลกระทบ
    const stats = await getAllStats()

    const details = stats ? (
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">ข้อมูลทั้งหมดที่จะถูกลบ:</p>
        <ul className="ml-4 list-disc space-y-0.5 text-slate-600">
          <li>ห้องเรียน {stats.classroomCount} ห้อง</li>
          <li>นักเรียน {stats.studentCount} คน</li>
          <li>รายการเช็คชื่อ {stats.attendanceCount} รายการ</li>
          <li>รายการคะแนน {stats.gradeCount} รายการ</li>
          <li>รายการสุขภาพ {stats.healthCount} รายการ</li>
          <li>ช่องตารางสอน {stats.scheduleCount} ช่อง</li>
        </ul>
        <p className="mt-2 text-xs text-red-700">
          ระบบจะสร้างไฟล์สำรองโดยอัตโนมัติก่อนลบ — กู้คืนได้จากส่วน
          &quot;กู้คืนจากการสำรองอัตโนมัติ&quot; ด้านล่าง
        </p>
      </div>
    ) : (
      <p className="text-xs text-red-700">
        ระบบจะสร้างไฟล์สำรองโดยอัตโนมัติก่อนลบ — กู้คืนได้ภายหลัง
      </p>
    )

    const ok = await confirm({
      title: 'ลบข้อมูลทั้งหมด?',
      message: 'การกระทำนี้จะลบทุกอย่างในระบบ — ห้อง นักเรียน คะแนน เช็คชื่อ ฯลฯ',
      details,
      variant: 'danger',
      confirmText: 'ลบทั้งหมด',
      requireTypeToConfirm: 'ลบทั้งหมด',
    })
    if (!ok) return

    try {
      if (isElectron) {
        const result = await window.electronAPI!.clearAllData()
        if (!result.success) throw new Error('Delete failed')
      } else {
        const res = await fetch('/api/settings', { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
      }
      setMessage({ type: 'success', text: 'ลบข้อมูลทั้งหมดสำเร็จ! กำลังรีเฟรช...' })
      setTimeout(() => (window.location.href = '/'), 1500)
    } catch (error) {
      console.error('Delete error:', error)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการลบข้อมูล' })
    }
  }

  const handleRestore = async (file: BackupFile) => {
    const ok = await confirm({
      title: 'กู้คืนข้อมูลจากไฟล์สำรอง?',
      message: (
        <>
          จะกู้คืนข้อมูลทั้งหมดจากไฟล์{' '}
          <span className="font-mono font-semibold text-slate-900">
            {file.fileName}
          </span>{' '}
          ({formatBackupDate(file.date)})
        </>
      ),
      details: (
        <div className="space-y-1.5">
          <p className="font-semibold text-slate-800">สิ่งที่จะเกิดขึ้น:</p>
          <ul className="ml-4 list-disc space-y-0.5 text-slate-600">
            <li>ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์สำรอง</li>
            <li>ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อน (เผื่อกู้คืนผิด)</li>
            <li>แอปจะรีสตาร์ทอัตโนมัติหลังกู้คืนเสร็จ</li>
          </ul>
        </div>
      ),
      variant: 'danger',
      confirmText: 'กู้คืน',
      requireTypeToConfirm: 'กู้คืน',
    })
    if (!ok) return

    setRestoring(file.fileName)
    setMessage(null)
    try {
      const result = await restoreBackup(file.fileName)
      if (!result.success) {
        throw new Error(result.error || 'กู้คืนไม่สำเร็จ')
      }
      if (isElectron) {
        // Electron จะ relaunch อัตโนมัติใน main process
        setMessage({
          type: 'success',
          text: 'กำลังกู้คืน... แอปจะรีสตาร์ทอัตโนมัติ',
        })
      } else {
        setMessage({
          type: 'success',
          text: 'กู้คืนสำเร็จ! กำลังโหลดหน้าใหม่...',
        })
        setTimeout(() => (window.location.href = '/'), 1500)
      }
    } catch (error) {
      console.error('[settings] restore failed:', error)
      await alert({
        title: 'กู้คืนไม่สำเร็จ',
        message: error instanceof Error ? error.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
      setRestoring(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          <SettingsIcon size={13} />
          System Settings
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ตั้งค่า</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">จัดการข้อมูลและการสำรองข้อมูลของระบบ</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Backup / Restore */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <div className="animate-slide-up card-hover rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)] stat-blue">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">สำรองข้อมูล</h2>
              <p className="text-sm text-[var(--muted)]">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            สำรองข้อมูลห้องเรียน นักเรียน การเช็คชื่อ คะแนน และสุขภาพทั้งหมด
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <Database size={18} />
            {exporting ? 'กำลังสำรอง...' : 'ดาวน์โหลดไฟล์สำรอง'}
          </button>
        </div>

        {/* Import */}
        <div className="animate-slide-up card-hover rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)] stat-green">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Upload size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">นำเข้าข้อมูล</h2>
              <p className="text-sm text-[var(--muted)]">อัปโหลดไฟล์ JSON เพื่อกู้คืนข้อมูล</p>
            </div>
          </div>
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>การนำเข้าจะแทนที่ข้อมูลเดิมทั้งหมด</span>
          </div>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line)] px-4 py-6 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--primary)] hover:bg-blue-50/50 hover:text-[var(--primary)]">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
            <Upload size={18} />
            <span>{importing ? 'กำลังนำเข้า...' : 'เลือกไฟล์ JSON'}</span>
          </label>
        </div>
      </div>

      {/* Restore from auto-backup */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">กู้คืนจากการสำรองอัตโนมัติ</h2>
              <p className="text-sm text-[var(--muted)]">
                ระบบสำรองข้อมูลทุกครั้งที่เปิดแอป + ก่อนลบหรือกู้คืน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadBackups}
            disabled={backupsLoading}
            title="รีเฟรชรายการไฟล์สำรอง"
            className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={14} className={backupsLoading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>

        <div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            ก่อนกู้คืน ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อนเสมอ —
            ถ้ากู้คืนผิดไฟล์สามารถย้อนกลับได้
            {!isElectron && (
              <>
                {' '}
                <span className="font-semibold">
                  (ฟีเจอร์นี้ใช้ได้เฉพาะเวอร์ชัน Desktop —
                  เว็บโหมดจำกัดความสามารถ)
                </span>
              </>
            )}
          </span>
        </div>

        {backupsLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--line)] bg-slate-50 px-4 py-8 text-center text-sm text-[var(--muted)]">
            ยังไม่มีไฟล์สำรอง — ระบบจะสร้างไฟล์แรกตอนเปิดแอปครั้งต่อไป
          </div>
        ) : (
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {backups.map((file) => (
              <li
                key={file.fileName}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 transition hover:border-violet-200 hover:bg-violet-50/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-semibold text-slate-700">
                    {file.fileName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {formatBackupDate(file.date)} · {formatBytes(file.sizeBytes)} ·{' '}
                    <span className="font-semibold">{describeBackupFile(file.fileName)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(file)}
                  disabled={restoring !== null}
                  title="กู้คืนข้อมูลจากไฟล์นี้"
                  className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {restoring === file.fileName ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      กำลังกู้คืน...
                    </>
                  ) : (
                    <>
                      <History size={12} />
                      กู้คืน
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Appearance (theme + font size) */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Palette size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">หน้าตา</h2>
            <p className="text-sm text-[var(--muted)]">ธีมและขนาดตัวอักษร</p>
          </div>
        </div>

        {themeReady && (
          <>
            {/* Theme mode */}
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-slate-700">ธีม</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { v: 'light', label: 'สว่าง', icon: Sun },
                  { v: 'dark', label: 'มืด', icon: Moon },
                  { v: 'system', label: 'ตามระบบ', icon: Laptop },
                ] as { v: ThemeMode; label: string; icon: typeof Sun }[]).map((opt) => {
                  const Icon = opt.icon
                  const isActive = themeMode === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setThemeMode(opt.v)}
                      className={`btn-press flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[var(--line)] bg-white text-slate-600 hover:border-blue-200'
                      }`}
                    >
                      <Icon size={18} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font size */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Type size={14} />
                ขนาดตัวอักษร
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { v: 'normal', label: 'ปกติ', sample: '17px' },
                  { v: 'large', label: 'ใหญ่', sample: '19px' },
                  { v: 'extra-large', label: 'ใหญ่มาก', sample: '21px' },
                ] as { v: FontSize; label: string; sample: string }[]).map((opt) => {
                  const isActive = fontSize === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setFontSize(opt.v)}
                      className={`btn-press flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 transition ${
                        isActive
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[var(--line)] bg-white text-slate-600 hover:border-blue-200'
                      }`}
                    >
                      <span
                        className="font-bold"
                        style={{
                          fontSize: opt.v === 'normal' ? 17 : opt.v === 'large' ? 19 : 21,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">ตัวอย่าง {opt.sample}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Security: PIN lock */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">ความปลอดภัย</h2>
              <p className="text-sm text-[var(--muted)]">PIN ล็อกเปิดแอป (4-6 หลัก)</p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={pinEnabled}
              onChange={() => {
                if (pinEnabled) {
                  setPinForm('disable')
                } else {
                  setPinForm('enable')
                }
                setPinNew('')
                setPinConfirm('')
                setPinCurrent('')
                setPinError('')
              }}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-200" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </label>
        </div>

        {pinForm !== 'idle' && (
          <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
            {pinForm === 'change' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">PIN ปัจจุบัน</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinCurrent}
                  onChange={(e) =>
                    setPinCurrent(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-lg tracking-[0.3em] outline-none focus:border-[var(--primary)]"
                />
              </label>
            )}

            {pinForm === 'disable' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">PIN ปัจจุบัน (เพื่อยืนยันปิด)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinCurrent}
                  onChange={(e) =>
                    setPinCurrent(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-lg tracking-[0.3em] outline-none focus:border-[var(--primary)]"
                />
              </label>
            )}

            {(pinForm === 'enable' || pinForm === 'change') && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">PIN ใหม่ (4-6 หลัก)</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinNew}
                    onChange={(e) =>
                      setPinNew(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-lg tracking-[0.3em] outline-none focus:border-[var(--primary)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">ยืนยัน PIN ใหม่อีกครั้ง</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={(e) =>
                      setPinConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-lg tracking-[0.3em] outline-none focus:border-[var(--primary)]"
                  />
                </label>
              </>
            )}

            {pinError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {pinError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetPinForm}
                className="btn-press flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={pinSaving}
                className="btn-press flex-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
              >
                {pinSaving
                  ? 'กำลังบันทึก...'
                  : pinForm === 'enable'
                    ? 'เปิดใช้ PIN'
                    : pinForm === 'change'
                      ? 'บันทึก PIN ใหม่'
                      : 'ปิด PIN'}
              </button>
            </div>
          </div>
        )}

        {pinEnabled && pinForm === 'idle' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Lock size={12} />
              เปิดใช้งานอยู่
            </span>
            <button
              type="button"
              onClick={() => {
                setPinForm('change')
                setPinNew('')
                setPinConfirm('')
                setPinCurrent('')
                setPinError('')
              }}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              เปลี่ยน PIN
            </button>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Info size={18} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">ข้อมูลโปรแกรม</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<GraduationCap size={16} />} label="ระบบจัดการโรงเรียน" value="v1.0" />
          <InfoRow icon={<Calendar size={16} />} label="ปีการศึกษา" value={`${new Date().getFullYear() + 543}`} />
          <InfoRow icon={<Laptop size={16} />} label="รูปแบบการใช้งาน" value="Desktop (Offline)" />
          <InfoRow icon={<SettingsIcon size={16} />} label="เทคโนโลยี" value="Next.js + Electron + SQLite" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-red-200 bg-red-50/50 p-6 stat-red">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-700">พื้นที่เสี่ยง</h2>
            <p className="text-sm text-red-600">การลบข้อมูลจะไม่สามารถกู้คืนได้</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-red-600">
          กรุณาสำรองข้อมูลก่อนดำเนินการ เพื่อป้องกันการสูญหายของข้อมูล
        </p>
        <button
          onClick={handleDeleteAll}
          className="btn-press inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-red-700"
        >
          <Trash2 size={16} />
          ลบข้อมูลทั้งหมด
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[var(--muted)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
