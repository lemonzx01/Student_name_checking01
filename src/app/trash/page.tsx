'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react'
import StudentAvatar from '@/components/StudentAvatar'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/PageHeader'
import { useDialog } from '@/lib/hooks/useConfirm'
import {
  emptyTrash,
  getClassrooms,
  getTrashedStudents,
  purgeStudent,
  restoreStudent,
} from '@/lib/client-data'
import type { Classroom, Student } from '@/types'

function displayName(student: Student) {
  return [student.title, student.first_name, student.last_name].filter(Boolean).join(' ')
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(diffMs / day)
  if (days < 1) return 'วันนี้'
  if (days < 30) return `${days} วันที่แล้ว`
  return d.toISOString().slice(0, 10)
}

function daysUntilPurge(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const day = 24 * 60 * 60 * 1000
  const elapsed = Math.floor(diffMs / day)
  return Math.max(0, 30 - elapsed)
}

export default function TrashPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreTarget, setRestoreTarget] = useState<Student | null>(null)
  const [restoreClassroom, setRestoreClassroom] = useState<number | ''>('')
  const [busy, setBusy] = useState<number | null>(null)
  const { confirm, alert } = useDialog()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [trash, cls] = await Promise.all([getTrashedStudents(), getClassrooms()])
      setStudents(trash)
      setClassrooms(cls)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const classroomExists = (id: number) => classrooms.some((c) => c.id === id)

  async function handleRestore(student: Student) {
    if (!classroomExists(student.classroom_id)) {
      setRestoreTarget(student)
      setRestoreClassroom('')
      return
    }
    setBusy(student.id)
    try {
      const result = await restoreStudent(student.id)
      if (!result.success) throw new Error(result.error || 'กู้คืนไม่สำเร็จ')
      await refresh()
    } catch (err) {
      await alert({
        title: 'กู้คืนไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  async function confirmRestoreNewClassroom() {
    if (!restoreTarget || !restoreClassroom) return
    setBusy(restoreTarget.id)
    try {
      const result = await restoreStudent(restoreTarget.id, Number(restoreClassroom))
      if (!result.success) throw new Error(result.error || 'กู้คืนไม่สำเร็จ')
      setRestoreTarget(null)
      setRestoreClassroom('')
      await refresh()
    } catch (err) {
      await alert({
        title: 'กู้คืนไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handlePurge(student: Student) {
    const ok = await confirm({
      title: `ลบ ${displayName(student)} ถาวร?`,
      message: 'การลบนี้จะไม่สามารถกู้คืนได้ — ข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบด้วย',
      details: (
        <div className="space-y-1">
          <p className="font-semibold text-[var(--text)]">ข้อมูลที่จะถูกลบพร้อมกัน:</p>
          <ul className="ml-4 list-disc space-y-0.5 text-[var(--text-soft)]">
            <li>บันทึกการเช็คชื่อทั้งหมดของนักเรียนคนนี้</li>
            <li>คะแนนทั้งหมด</li>
            <li>บันทึกสุขภาพ</li>
            <li>บันทึกประจำตัวนักเรียน</li>
          </ul>
        </div>
      ),
      variant: 'danger',
      confirmText: 'ลบถาวร',
      requireTypeToConfirm: 'ลบถาวร',
    })
    if (!ok) return

    setBusy(student.id)
    try {
      const result = await purgeStudent(student.id)
      if (!result.success) throw new Error(result.error || 'ลบไม่สำเร็จ')
      await refresh()
    } catch (err) {
      await alert({
        title: 'ลบไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handleEmptyTrash() {
    if (students.length === 0) return
    const ok = await confirm({
      title: 'ล้างถังขยะทั้งหมด?',
      message: `จะลบนักเรียนทั้งหมด ${students.length} คน พร้อมข้อมูลที่เกี่ยวข้องถาวร`,
      details: (
        <p className="text-xs text-[var(--danger-strong)]">
          การลบนี้จะไม่สามารถกู้คืนได้ — ระบบมีไฟล์สำรองรายวัน หากต้องการกู้คืน
          สามารถไปที่หน้า &quot;ตั้งค่า&quot; เพื่อใช้ backup ก่อนกดล้าง
        </p>
      ),
      variant: 'danger',
      confirmText: 'ล้างถังขยะ',
      requireTypeToConfirm: 'ล้างถังขยะ',
    })
    if (!ok) return

    try {
      const result = await emptyTrash()
      if (!result.success) throw new Error(result.error || 'ล้างไม่สำเร็จ')
      await refresh()
    } catch (err) {
      await alert({
        title: 'ล้างไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="mb-4">
        <Link
          href="/"
          className="btn btn-ghost btn-sm"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      <PageHeader
        icon={Trash2}
        badge="Recycle Bin"
        title="ถังขยะ"
        subtitle="นักเรียนที่ถูกลบจะอยู่ที่นี่ 30 วัน ก่อนถูกลบถาวรอัตโนมัติ"
        tone="warn"
        actions={
          students.length > 0 ? (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="btn btn-danger btn-sm"
            >
              <Trash2 size={14} />
              ล้างถังขยะ
            </button>
          ) : null
        }
      />

      {/* List */}
      <section className="card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            <div className="skeleton h-16 w-full rounded-xl" />
            <div className="skeleton h-16 w-full rounded-xl" />
            <div className="skeleton h-16 w-full rounded-xl" />
          </div>
        ) : students.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
              <Users size={26} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text)]">ถังขยะว่าง</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
              นักเรียนที่ลบจะมาอยู่ที่นี่ก่อนถูกลบถาวร
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {students.map((student) => {
              const remaining = daysUntilPurge(student.deleted_at)
              const oldClassExists = classroomExists(student.classroom_id)
              return (
                <li
                  key={student.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-muted)]"
                >
                  <StudentAvatar
                    photoPath={student.photo_path}
                    name={`${student.first_name} ${student.last_name}`}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">{displayName(student)}</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      ห้องเดิม:{' '}
                      <span className={oldClassExists ? '' : 'text-[var(--warning-strong)] line-through'}>
                        {student.classroom_name || student.classroom_label || '-'}
                      </span>
                      {!oldClassExists && (
                        <span className="pill pill-warn ml-1">ห้องถูกลบ</span>
                      )}
                      {' · '}ลบเมื่อ {formatRelative(student.deleted_at)}
                      {remaining !== null && (
                        <>
                          {' · '}เหลือ <span className="font-semibold">{remaining}</span> วันก่อนลบถาวร
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(student)}
                      disabled={busy === student.id}
                      className="btn btn-secondary btn-sm"
                    >
                      <RotateCcw size={13} />
                      กู้คืน
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(student)}
                      disabled={busy === student.id}
                      className="btn btn-danger-ghost btn-sm"
                    >
                      <Trash2 size={13} />
                      ลบถาวร
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Restore-to-new-classroom modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setRestoreTarget(null)}
          />
          <div className="modal-content relative w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
            <h3 className="text-lg font-bold text-[var(--text)]">เลือกห้องใหม่</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ห้องเดิมของ {displayName(restoreTarget)} ถูกลบไปแล้ว — กรุณาเลือกห้องใหม่
            </p>

            <div className="my-4">
              <CustomSelect
                value={restoreClassroom}
                onChange={(v) => setRestoreClassroom(v ? Number(v) : '')}
                options={[
                  { value: '', label: 'เลือกห้องเรียน' },
                  ...classrooms.map((c) => ({ value: c.id, label: c.name })),
                ]}
                placeholder="เลือกห้องเรียน"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmRestoreNewClassroom}
                disabled={!restoreClassroom}
                className="btn btn-primary flex-1"
              >
                กู้คืน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
