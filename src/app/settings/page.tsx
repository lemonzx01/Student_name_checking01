'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  GraduationCap,
  Calendar,
  Eye,
  EyeOff,
  Laptop,
  Lock,
  Moon,
  Palette,
  Pencil,
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
import { useSubjects } from '@/lib/hooks/useSubjects'
import { useTheme, type FontSize, type ThemeMode } from '@/lib/hooks/useTheme'
import { disablePin, hashPin, isPinEnabled, getStoredPinHash, setStoredPin } from '@/components/PinGate'
import PageHeader from '@/components/PageHeader'
import SubjectEditModal from '@/components/SubjectEditModal'
import { todayISO } from '@/lib/local-date'
import { THAI_MONTHS_SHORT } from '@/lib/constants/thai-date'

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
  const {
    subjects: liveSubjects,
    updateSubject,
    renameCode,
    addSubject,
    removeSubject,
    resetToDefaults,
  } = useSubjects()
  const [editingSubjects, setEditingSubjects] = useState(false)

  // PIN state
  const [pinEnabled, setPinEnabled] = useState(false)
  const [pinForm, setPinForm] = useState<'idle' | 'enable' | 'change' | 'disable'>('idle')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinCurrent, setPinCurrent] = useState('')
  const [showPins, setShowPins] = useState(false)
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
    setShowPins(false)
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
      let data: any
      if (isElectron) {
        data = await window.electronAPI!.exportData()
      } else {
        const res = await fetch('/api/settings/export')
        if (!res.ok) throw new Error('Export failed')
        data = await res.json()
        if (data.error) throw new Error(data.error)
      }

      // Override subjects with the live (teacher-edited) list from localStorage —
      // ทั้ง Electron exportData() และ /api/settings/export ต่างก็ส่ง DEFAULT_SUBJECTS
      // กลับมา จึงต้องเขียนทับด้วยรายการที่ครูแก้ไขจริงในแอปหน้าเว็บ
      data = {
        ...data,
        subjects: liveSubjects.map((s) => ({ code: s.code, name: s.name, color: s.color })),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `school_backup_${todayISO()}.json`
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

      if (isElectron) {
        const result = await window.electronAPI!.importData(data)
        if (!result.success) throw new Error(result.error || 'Import failed')
      } else {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any))
          throw new Error(body?.error || `Import failed (${res.status})`)
        }
      }

      // คืน subjects จากไฟล์สำรองลง localStorage (subjects เก็บฝั่ง client, ไม่ผ่าน server)
      if (Array.isArray(data.subjects) && data.subjects.length > 0) {
        try {
          localStorage.setItem('customSubjects', JSON.stringify({ subjects: data.subjects }))
        } catch (err) {
          console.warn('[import] restore subjects to localStorage failed:', err)
        }
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
        <p className="font-semibold text-[var(--text)]">ข้อมูลทั้งหมดที่จะถูกลบ:</p>
        <ul className="ml-4 list-disc space-y-0.5 text-[var(--text-soft)]">
          <li>ห้องเรียน {stats.classroomCount} ห้อง</li>
          <li>นักเรียน {stats.studentCount} คน</li>
          <li>รายการเช็คชื่อ {stats.attendanceCount} รายการ</li>
          <li>รายการคะแนน {stats.gradeCount} รายการ</li>
          <li>รายการสุขภาพ {stats.healthCount} รายการ</li>
          <li>ช่องตารางสอน {stats.scheduleCount} ช่อง</li>
        </ul>
        <p className="mt-2 text-xs text-[var(--danger-strong)]">
          ระบบจะสร้างไฟล์สำรองโดยอัตโนมัติก่อนลบ — กู้คืนได้จากส่วน
          &quot;กู้คืนจากการสำรองอัตโนมัติ&quot; ด้านล่าง
        </p>
      </div>
    ) : (
      <p className="text-xs text-[var(--danger-strong)]">
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
          <span className="font-mono font-semibold text-[var(--text)]">
            {file.fileName}
          </span>{' '}
          ({formatBackupDate(file.date)})
        </>
      ),
      details: (
        <div className="space-y-1.5">
          <p className="font-semibold text-[var(--text)]">สิ่งที่จะเกิดขึ้น:</p>
          <ul className="ml-4 list-disc space-y-0.5 text-[var(--text-soft)]">
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
      <PageHeader
        icon={SettingsIcon}
        badge="System Settings"
        title="ตั้งค่า"
        subtitle="จัดการข้อมูลและการสำรองข้อมูลของระบบ"
      />

      {/* Message */}
      {message && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3.5 text-sm font-medium ${
            message.type === 'success'
              ? 'border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]'
              : 'border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Backup / Restore */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <div className="card card-hover p-6 stat-blue">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <Download size={22} />
            </div>
            <div>
              <h2 className="section-title text-lg">สำรองข้อมูล</h2>
              <p className="section-subtitle">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            สำรองข้อมูลห้องเรียน นักเรียน การเช็คชื่อ คะแนน และสุขภาพทั้งหมด
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-primary w-full"
          >
            <Database size={18} />
            {exporting ? 'กำลังสำรอง...' : 'ดาวน์โหลดไฟล์สำรอง'}
          </button>
        </div>

        {/* Import */}
        <div className="card card-hover p-6 stat-green">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
              <Upload size={22} />
            </div>
            <div>
              <h2 className="section-title text-lg">นำเข้าข้อมูล</h2>
              <p className="section-subtitle">อัปโหลดไฟล์ JSON เพื่อกู้คืนข้อมูล</p>
            </div>
          </div>
          <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium text-[var(--warning-strong)]">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>การนำเข้าจะแทนที่ข้อมูลเดิมทั้งหมด</span>
          </div>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] px-4 py-6 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-ghost)] hover:text-[var(--primary)]">
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
      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <History size={18} />
            </div>
            <div>
              <h2 className="section-title text-lg">กู้คืนจากการสำรองอัตโนมัติ</h2>
              <p className="section-subtitle">
                ระบบสำรองข้อมูลทุกครั้งที่เปิดแอป + ก่อนลบหรือกู้คืน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadBackups}
            disabled={backupsLoading}
            title="รีเฟรชรายการไฟล์สำรอง"
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={backupsLoading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>

        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--info-soft)] bg-[var(--info-soft)] px-3 py-2 text-xs font-medium text-[var(--info)]">
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
          <div className="rounded-[var(--radius)] border-2 border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            ยังไม่มีไฟล์สำรอง — ระบบจะสร้างไฟล์แรกตอนเปิดแอปครั้งต่อไป
          </div>
        ) : (
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {backups.map((file) => (
              <li
                key={file.fileName}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-semibold text-[var(--text-soft)]">
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
                  className="btn btn-secondary btn-sm"
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

      {/* Subjects management */}
      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="section-title text-lg">จัดการรายวิชา</h2>
              <p className="section-subtitle">
                แก้ชื่อ/รหัส/สี เพิ่ม-ลบวิชา — มีผลกับหน้ากรอกคะแนนและตารางสอน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingSubjects(true)}
            className="btn btn-secondary"
          >
            <Pencil size={14} />
            แก้ไขรายวิชา
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {liveSubjects.map((s) => (
            <span
              key={s.code}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: s.color }}
              title={`รหัส: ${s.code}`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-white/60" />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Appearance (theme + font size) */}
      <div className="card mt-6 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
            <Palette size={18} />
          </div>
          <div>
            <h2 className="section-title text-lg">หน้าตา</h2>
            <p className="section-subtitle">ธีมและขนาดตัวอักษร</p>
          </div>
        </div>

        {themeReady && (
          <>
            {/* Theme mode */}
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-[var(--text-soft)]">ธีม</p>
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
                      className={`btn-press flex items-center gap-2.5 rounded-[var(--radius)] border-2 px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--line-strong)]'
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
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-soft)]">
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
                      className={`btn-press flex flex-col items-start gap-1 rounded-[var(--radius)] border-2 px-4 py-3 transition ${
                        isActive
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--line-strong)]'
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
      <div className="card mt-6 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="section-title text-lg">ความปลอดภัย</h2>
              <p className="section-subtitle">PIN ล็อกเปิดแอป (4-6 หลัก)</p>
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
            <div className="h-6 w-11 rounded-full bg-[var(--line-strong)] transition peer-checked:bg-[var(--success)] peer-focus:ring-2 peer-focus:ring-[var(--success-soft)]" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </label>
        </div>

        {pinForm !== 'idle' && (
          <div className="space-y-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            {pinForm === 'change' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">PIN ปัจจุบัน</span>
                <div className="relative">
                  <input
                    type={showPins ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pinCurrent}
                    onChange={(e) =>
                      setPinCurrent(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    className="input pr-10 text-lg tracking-[0.3em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPins((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPins ? 'ซ่อน PIN' : 'แสดง PIN'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-soft)]"
                  >
                    {showPins ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {pinForm === 'disable' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">PIN ปัจจุบัน (เพื่อยืนยันปิด)</span>
                <div className="relative">
                  <input
                    type={showPins ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pinCurrent}
                    onChange={(e) =>
                      setPinCurrent(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    className="input pr-10 text-lg tracking-[0.3em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPins((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPins ? 'ซ่อน PIN' : 'แสดง PIN'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-soft)]"
                  >
                    {showPins ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {(pinForm === 'enable' || pinForm === 'change') && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">PIN ใหม่ (4-6 หลัก)</span>
                  <div className="relative">
                    <input
                      type={showPins ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={pinNew}
                      onChange={(e) =>
                        setPinNew(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                      }
                      className="input pr-10 text-lg tracking-[0.3em]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPins((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPins ? 'ซ่อน PIN' : 'แสดง PIN'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-soft)]"
                    >
                      {showPins ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">ยืนยัน PIN ใหม่อีกครั้ง</span>
                  <div className="relative">
                    <input
                      type={showPins ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={pinConfirm}
                      onChange={(e) =>
                        setPinConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                      }
                      className="input pr-10 text-lg tracking-[0.3em]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPins((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPins ? 'ซ่อน PIN' : 'แสดง PIN'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-soft)]"
                    >
                      {showPins ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </>
            )}

            {pinError && (
              <p className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger-strong)]">
                <AlertTriangle size={14} />
                {pinError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetPinForm}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={pinSaving}
                className="btn btn-primary flex-1"
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
            <span className="pill pill-ok">
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
              className="btn btn-secondary btn-sm"
            >
              เปลี่ยน PIN
            </button>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="card mt-6 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-soft)]">
            <Info size={18} />
          </div>
          <h2 className="section-title text-lg">ข้อมูลโปรแกรม</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<GraduationCap size={16} />} label="ระบบจัดการโรงเรียน" value="v1.0" />
          <InfoRow icon={<Calendar size={16} />} label="ปีการศึกษา" value={`${new Date().getFullYear() + 543}`} />
          <InfoRow icon={<Laptop size={16} />} label="รูปแบบการใช้งาน" value="Desktop (Offline)" />
          <InfoRow icon={<SettingsIcon size={16} />} label="เทคโนโลยี" value="Next.js + Electron + SQLite" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card mt-6 border-[var(--danger-soft)] bg-[var(--danger-soft)] p-6 stat-red">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--danger-strong)]">พื้นที่เสี่ยง</h2>
            <p className="text-sm text-[var(--danger)]">การลบข้อมูลจะไม่สามารถกู้คืนได้</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-[var(--danger)]">
          กรุณาสำรองข้อมูลก่อนดำเนินการ เพื่อป้องกันการสูญหายของข้อมูล
        </p>
        <button
          onClick={handleDeleteAll}
          className="btn btn-danger"
        >
          <Trash2 size={16} />
          ลบข้อมูลทั้งหมด
        </button>
      </div>

      {/* Subject edit modal */}
      <SubjectEditModal
        open={editingSubjects}
        subjects={liveSubjects}
        onClose={() => setEditingSubjects(false)}
        onUpdate={updateSubject}
        onRenameCode={renameCode}
        onAdd={addSubject}
        onRemove={removeSubject}
        onReset={resetToDefaults}
      />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] bg-[var(--surface-muted)] px-3 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}
