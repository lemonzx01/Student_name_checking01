'use client'

import { useEffect, useState } from 'react'
import { School, X } from 'lucide-react'
import CustomSelect from './CustomSelect'
import { Classroom } from '@/types'
import { createClassroomRecord, updateClassroomRecord } from '@/lib/client-data'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingClassroom?: Classroom | null
}

export default function CreateClassroomModal({
  isOpen,
  onClose,
  onSuccess,
  editingClassroom,
}: Props) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('ประถมศึกษา')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [saving, setSaving] = useState(false)

  const levelOptions = [
    { value: 'อนุบาล', label: 'อนุบาล' },
    { value: 'ประถมศึกษา', label: 'ประถมศึกษา' },
    { value: 'มัธยมศึกษา', label: 'มัธยมศึกษา' },
    { value: 'ห้องเรียน', label: 'ห้องเรียน' },
  ]

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (editingClassroom) {
      setName(editingClassroom.name)
      setLevel(editingClassroom.level)
      setAcademicYear(editingClassroom.academic_year)
      return
    }

    setName('')
    setLevel('ประถมศึกษา')
    setAcademicYear(String(new Date().getFullYear() + 543))
  }, [editingClassroom, isOpen])

  if (!isOpen) {
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      return
    }

    setSaving(true)

    try {
      if (editingClassroom) {
        await updateClassroomRecord(editingClassroom.id, {
          name: name.trim(),
          level,
          academic_year: academicYear.trim(),
        })
      } else {
        await createClassroomRecord({
          name: name.trim(),
          level,
          academic_year: academicYear.trim(),
        })
      }

      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <School size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingClassroom ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียน'}
              </h2>
              <p className="text-xs text-[var(--muted)]">ตั้งชื่อห้องและปีการศึกษา</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ชื่อห้อง</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น ป.4 หรือ ม.1/1"
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-0"
              autoFocus
            />
          </label>

          <div className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ระดับชั้น</span>
            <CustomSelect
              value={level}
              onChange={(v) => setLevel(String(v))}
              options={levelOptions}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ปีการศึกษา</span>
            <input
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-0"
            />
          </label>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex-1 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-press flex-1 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : editingClassroom ? 'บันทึก' : 'สร้างห้อง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
