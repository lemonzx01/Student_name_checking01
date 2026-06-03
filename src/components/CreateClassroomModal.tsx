'use client'

import { useEffect, useState } from 'react'
import { School, X } from 'lucide-react'
import CustomSelect from './CustomSelect'
import { Classroom, CLASSROOM_COLORS } from '@/types'
import {
  createClassroomRecord,
  getArchivedClassrooms,
  getClassrooms,
  updateClassroomRecord,
} from '@/lib/client-data'

const LEVEL_PREFIX: Record<string, string> = {
  'อนุบาล': 'อ.',
  'ประถมศึกษา': 'ป.',
  'มัธยมศึกษา': 'ม.',
  'ห้องเรียน': '',
}

// strip leading "อ./ป./ม." (มี/ไม่มีจุดก็ได้ แต่ต้องตามด้วยตัวเลขหรือ /)
// — ป้องกันครูพิมพ์ prefix ซ้ำกับ chip โดยไม่กระทบคำที่ขึ้นต้นด้วยตัวอักษรไทยอื่น
const ANY_PREFIX = /^[อปม](\.|(?=[\d/]))/

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingClassroom?: Classroom | null
}

/**
 * แยก name เดิมที่บันทึกใน DB ออกเป็น prefix + suffix
 * - ถ้า name ขึ้นต้นด้วย prefix ของ level → strip ออก
 * - ถ้า name ขึ้นต้นด้วย prefix ของ level อื่น (ข้อมูลเก่าไม่ตรงกัน) → reset level เป็น "ห้องเรียน"
 *   เพื่อไม่ให้ตอน save บันทึก prefix ซ้อนทับ
 */
function splitNameForLevel(name: string, level: string): { input: string; level: string } {
  const prefix = LEVEL_PREFIX[level] ?? ''
  if (prefix && name.startsWith(prefix)) {
    return { input: name.slice(prefix.length), level }
  }
  // ชื่อกับ level ไม่ตรง → ปล่อยชื่อเต็มไว้, ตัด level เป็น "ห้องเรียน" (ไม่มี prefix)
  if (prefix && ANY_PREFIX.test(name)) {
    return { input: name, level: 'ห้องเรียน' }
  }
  return { input: name, level }
}

export default function CreateClassroomModal({
  isOpen,
  onClose,
  onSuccess,
  editingClassroom,
}: Props) {
  const [nameInput, setNameInput] = useState('')
  const [level, setLevel] = useState('ห้องเรียน')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [color, setColor] = useState<string>('blue')
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<Classroom[]>([])

  const prefix = LEVEL_PREFIX[level] ?? ''
  // ทำความสะอาด: ถ้ามี chip prefix แล้วครูเผลอพิมพ์ prefix ซ้ำ → strip ตอน save
  const cleanedInput = prefix ? nameInput.replace(ANY_PREFIX, '') : nameInput
  const effectiveName = (prefix + cleanedInput).trim()
  const trimmedYear = academicYear.trim()

  const isDuplicate =
    effectiveName !== '' &&
    existing.some(
      (c) =>
        c.id !== editingClassroom?.id &&
        c.name.trim().toLowerCase() === effectiveName.toLowerCase() &&
        c.academic_year.trim() === trimmedYear,
    )

  const levelOptions = [
    { value: 'อนุบาล', label: 'อนุบาล' },
    { value: 'ประถมศึกษา', label: 'ประถมศึกษา' },
    { value: 'มัธยมศึกษา', label: 'มัธยมศึกษา' },
    { value: 'ห้องเรียน', label: 'ห้องเรียน (ไม่มีคำนำหน้า)' },
  ]

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    Promise.all([getClassrooms(), getArchivedClassrooms()])
      .then(([active, archived]) => {
        if (cancelled) return
        setExisting([...active, ...archived])
      })
      .catch(() => {
        if (!cancelled) setExisting([])
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (editingClassroom) {
      const split = splitNameForLevel(editingClassroom.name, editingClassroom.level)
      setNameInput(split.input)
      setLevel(split.level)
      setAcademicYear(editingClassroom.academic_year)
      setColor(editingClassroom.color || 'blue')
      return
    }

    setNameInput('')
    setLevel('ห้องเรียน')
    setAcademicYear(String(new Date().getFullYear() + 543))
    setColor('blue')
  }, [editingClassroom, isOpen])

  if (!isOpen) {
    return null
  }

  // ตอนเปลี่ยน level — เก็บส่วนที่ครูพิมพ์ไว้ ไม่ต้องยุ่งกับ input (chip ปรับเอง)
  // ยกเว้นกรณีพิเศษ: ถ้าครูพิมพ์เต็มชื่อตอนเป็น "ห้องเรียน" แล้วเปลี่ยนเป็นระดับอื่น
  // → ถ้าชื่อเริ่มต้นด้วย prefix อยู่แล้ว ระบบ clean ตอน save ให้
  function handleLevelChange(newLevel: string) {
    setLevel(newLevel)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!effectiveName || isDuplicate) {
      return
    }

    setSaving(true)

    try {
      if (editingClassroom) {
        await updateClassroomRecord(editingClassroom.id, {
          name: effectiveName,
          level,
          academic_year: trimmedYear,
          color,
        })
      } else {
        await createClassroomRecord({
          name: effectiveName,
          level,
          academic_year: trimmedYear,
          color,
        })
      }

      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // เตือนเมื่อครูพิมพ์ prefix ซ้ำกับ chip — แจ้งว่าจะถูกตัดออก
  const userTypedExtraPrefix = prefix !== '' && cleanedInput !== nameInput

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
          {/* ระดับชั้น — ขึ้นก่อนชื่อห้อง เพราะมันกำหนด prefix ใน input */}
          <div className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ระดับชั้น</span>
            <CustomSelect
              value={level}
              onChange={(v) => handleLevelChange(String(v))}
              options={levelOptions}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">ชื่อห้อง</span>
            <div
              className={`input flex items-center gap-0 p-0 overflow-hidden ${
                isDuplicate ? 'border-red-500 focus-within:border-red-500' : ''
              }`}
            >
              {prefix && (
                <span
                  className="flex-shrink-0 select-none border-r border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-soft)]"
                  title="คำนำหน้ามาจากระดับชั้น เปลี่ยนได้ที่ด้านบน"
                >
                  {prefix}
                </span>
              )}
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder={prefix ? 'เช่น 4/1' : 'เช่น ห้องพิเศษ หรือ Lab1'}
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-soft)]"
                autoFocus
              />
            </div>
            {isDuplicate ? (
              <span className="mt-1 block text-xs text-red-600">
                มีห้อง &quot;{effectiveName}&quot; ปีการศึกษา {trimmedYear} อยู่แล้ว
              </span>
            ) : userTypedExtraPrefix ? (
              <span className="mt-1 block text-xs text-amber-600">
                คำนำหน้า &quot;{prefix}&quot; จะถูกเติมให้อัตโนมัติ — ระบบจะบันทึกเป็น &quot;{effectiveName}&quot;
              </span>
            ) : effectiveName && prefix ? (
              <span className="mt-1 block text-xs text-[var(--muted)]">
                จะบันทึกเป็น <span className="font-semibold text-[var(--text-soft)]">{effectiveName}</span>
              </span>
            ) : null}
          </label>

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
              disabled={saving || !effectiveName || isDuplicate}
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
