'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Info, X } from 'lucide-react'
import type { Classroom } from '@/types'
import { duplicateClassroomRecord } from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  source: Classroom | null
}

/**
 * เดาชื่อห้องใหม่จากชื่อเก่า:
 *   "ป.4" → "ป.5", "ม.1/1" → "ม.2/1", etc.
 * ถ้าไม่เจอเลขใน prefix → return ""
 */
function nextLevelName(name: string): string {
  // pattern: prefix (ไม่ใช่เลข) + เลขชั้น + suffix (อาจมี / และอื่นๆ)
  const m = name.match(/^([^\d]*?)(\d+)(.*)$/)
  if (!m) return ''
  const [, prefix, levelStr, suffix] = m
  const level = Number(levelStr)
  if (!Number.isFinite(level)) return ''
  return `${prefix}${level + 1}${suffix}`
}

export default function DuplicateClassroomModal({ isOpen, onClose, onSuccess, source }: Props) {
  const router = useRouter()
  const { alert } = useDialog()
  const [name, setName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [promoteStudents, setPromoteStudents] = useState(false)
  const [archiveSource, setArchiveSource] = useState(false)

  useEffect(() => {
    if (!isOpen || !source) return
    setName(nextLevelName(source.name) || `${source.name} (ใหม่)`)
    const currentBe = new Date().getFullYear() + 543
    const sourceYear = Number(source.academic_year) || currentBe
    setAcademicYear(String(sourceYear + 1))
    setPromoteStudents(false)
    setArchiveSource(false)
  }, [isOpen, source])

  if (!isOpen || !source) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!source || !name.trim()) return
    setSaving(true)
    try {
      const result = await duplicateClassroomRecord(source.id, name.trim(), academicYear.trim(), {
        promoteStudents,
        archiveSource,
      })
      if (!result.success || !result.id) {
        throw new Error(result.error || 'สร้างห้องไม่สำเร็จ')
      }
      onSuccess()
      onClose()
      localStorage.setItem('selectedClassroom', String(result.id))
      const moved = result.movedStudents ?? 0
      if (moved > 0) {
        await alert({
          title: 'สร้างห้องสำเร็จ',
          message: `ย้ายนักเรียน ${moved} คนเข้าห้องใหม่แล้ว${archiveSource ? ' • เก็บห้องเดิมเป็นถาวรแล้ว' : ''}`,
          variant: 'success',
        })
      }
      router.push(`/students?classroom=${result.id}`)
    } catch (err) {
      await alert({
        title: 'สร้างห้องไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <Copy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">ขึ้นปีใหม่</h2>
              <p className="text-xs text-[var(--muted)]">สำเนาจาก {source.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="ปิด"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--info-soft)] bg-[var(--info-soft)] px-3 py-3 text-xs leading-relaxed text-[var(--text-soft)]">
            <Info size={14} className="mt-0.5 flex-shrink-0 text-[var(--info)]" />
            <div>
              <p className="font-semibold text-[var(--info)]">จะคัดลอกเฉพาะตารางสอน</p>
              <p className="mt-0.5">คะแนน / เช็คชื่อ / สุขภาพ จะไม่ถูก copy — เริ่มกรอกใหม่</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ชื่อห้องใหม่</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ปีการศึกษา</span>
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="input"
              />
            </label>

            {/* Sprint 3: เลื่อนชั้น + เก็บถาวรห้องเดิม */}
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--primary-soft)] bg-[var(--primary-ghost)] p-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--text-soft)]">
                <input
                  type="checkbox"
                  checked={promoteStudents}
                  onChange={(e) => setPromoteStudents(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
                />
                <div>
                  <span className="font-semibold text-[var(--text)]">ย้ายนักเรียนทั้งหมดจากห้องเดิมเข้าห้องใหม่</span>
                  <p className="text-xs text-[var(--muted)]">เลื่อนชั้นแบบครบทั้งห้อง — คะแนน/เช็คชื่อเก่ายังคงอยู่ในห้องเดิม</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--text-soft)]">
                <input
                  type="checkbox"
                  checked={archiveSource}
                  onChange={(e) => setArchiveSource(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
                />
                <div>
                  <span className="font-semibold text-[var(--text)]">เก็บห้องเดิมเป็นถาวร (archive)</span>
                  <p className="text-xs text-[var(--muted)]">ไม่แสดงในหน้าหลัก แต่ข้อมูลยังอยู่ — เปิดดูได้ที่เมนู &quot;ห้องเก็บถาวร&quot;</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="btn btn-primary"
              >
                {saving ? 'กำลังสร้าง...' : 'สร้างห้องใหม่'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
