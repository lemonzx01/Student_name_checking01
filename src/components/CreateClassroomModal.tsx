'use client'

import { useEffect, useState } from 'react'
import { School, X } from 'lucide-react'
import CustomSelect from './CustomSelect'
import { Classroom, CLASSROOM_COLORS } from '@/types'
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
  const [color, setColor] = useState<string>('blue')
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
      setColor(editingClassroom.color || 'blue')
      return
    }

    setName('')
    setLevel('ประถมศึกษา')
    setAcademicYear(String(new Date().getFullYear() + 543))
    setColor('blue')
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
          color,
        })
      } else {
        await createClassroomRecord({
          name: name.trim(),
          level,
          academic_year: academicYear.trim(),
          color,
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
      <div className="modal-content relative w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <School size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">
                {editingClassroom ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียน'}
              </h2>
              <p className="text-xs text-[var(--muted)]">ตั้งชื่อห้องและปีการศึกษา</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ชื่อห้อง</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น ป.4 หรือ ม.1/1"
              className="input"
              autoFocus
            />
          </label>

          <div className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ระดับชั้น</span>
            <CustomSelect
              value={level}
              onChange={(v) => setLevel(String(v))}
              options={levelOptions}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ปีการศึกษา</span>
            <input
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              className="input"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--text-soft)]">สีห้องเรียน</span>
            <div className="flex flex-wrap gap-2">
              {CLASSROOM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`group relative flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} transition-all hover:scale-110 ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-[var(--text)] ring-offset-[var(--surface)] scale-110' : ''
                  }`}
                  title={c.label}
                >
                  {color === c.value && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
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
              {saving ? 'กำลังบันทึก...' : editingClassroom ? 'บันทึก' : 'สร้างห้อง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
