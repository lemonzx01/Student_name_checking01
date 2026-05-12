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
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Copy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">ขึ้นปีใหม่</h2>
              <p className="text-xs text-[var(--muted)]">สำเนาจาก {source.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-relaxed text-slate-700">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-700">จะคัดลอกเฉพาะตารางสอน</p>
            <p className="mt-0.5">คะแนน / เช็คชื่อ / สุขภาพ จะไม่ถูก copy — เริ่มกรอกใหม่</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ชื่อห้องใหม่</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ปีการศึกษา</span>
            <input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]"
            />
          </label>

          {/* Sprint 3: เลื่อนชั้น + เก็บถาวรห้องเดิม */}
          <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={promoteStudents}
                onChange={(e) => setPromoteStudents(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-indigo-600"
              />
              <div>
                <span className="font-semibold text-slate-800">ย้ายนักเรียนทั้งหมดจากห้องเดิมเข้าห้องใหม่</span>
                <p className="text-xs text-slate-500">เลื่อนชั้นแบบครบทั้งห้อง — คะแนน/เช็คชื่อเก่ายังคงอยู่ในห้องเดิม</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={archiveSource}
                onChange={(e) => setArchiveSource(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-indigo-600"
              />
              <div>
                <span className="font-semibold text-slate-800">เก็บห้องเดิมเป็นถาวร (archive)</span>
                <p className="text-xs text-slate-500">ไม่แสดงในหน้าหลัก แต่ข้อมูลยังอยู่ — เปิดดูได้ที่เมนู &quot;ห้องเก็บถาวร&quot;</p>
              </div>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-press flex-1 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
            >
              {saving ? 'กำลังสร้าง...' : 'สร้างห้องใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
