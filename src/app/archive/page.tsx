'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Archive,
  ChevronLeft,
  RotateCcw,
  School,
  Trash2,
  Users,
} from 'lucide-react'
import { Classroom, getClassroomColor } from '@/types'
import {
  deleteClassroomRecord,
  getArchivedClassrooms,
  unarchiveClassroomRecord,
} from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'

function formatDate(iso?: string | null) {
  if (!iso) return '-'
  try {
    const d = new Date(iso.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return iso
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
  } catch {
    return iso
  }
}

export default function ArchivePage() {
  const { confirm, alert } = useDialog()
  const [rooms, setRooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const list = await getArchivedClassrooms()
      setRooms(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRestore(c: Classroom) {
    const ok = await confirm({
      title: `นำห้อง ${c.name} กลับมาใช้?`,
      message: 'ห้องนี้จะปรากฏในหน้าหลักอีกครั้ง — ครูใช้งานปกติได้',
      confirmText: 'นำกลับมา',
    })
    if (!ok) return
    const result = await unarchiveClassroomRecord(c.id)
    if (!result.success) {
      await alert({
        title: 'นำกลับมาไม่สำเร็จ',
        message: result.error || 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
      return
    }
    await load()
  }

  async function handlePurge(c: Classroom) {
    const ok = await confirm({
      title: `ลบห้อง ${c.name} ถาวร?`,
      message: 'จะลบห้องและข้อมูลทั้งหมด — นักเรียน คะแนน เช็คชื่อ สุขภาพ ตารางสอน',
      details: (
        <p className="text-xs text-red-700">
          ระบบจะสร้างไฟล์สำรองโดยอัตโนมัติก่อนลบ — กู้คืนได้จากหน้า &quot;ตั้งค่า&quot;
        </p>
      ),
      variant: 'danger',
      confirmText: 'ลบถาวร',
      requireTypeToConfirm: c.name,
      typeToConfirmPlaceholder: `พิมพ์ ${c.name}`,
    })
    if (!ok) return
    try {
      await deleteClassroomRecord(c.id)
      await load()
    } catch (err) {
      await alert({
        title: 'ลบไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-4">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      <div className="animate-slide-up mb-5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <Archive size={13} />
          Archived Classrooms
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ห้องเรียนที่เก็บถาวร</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ห้องที่ครูเก็บไว้ตอนสิ้นปี — ข้อมูลเดิมยังครบ นำกลับมาใช้ได้เสมอ
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Archive size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">ยังไม่มีห้องที่เก็บถาวร</h3>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-[var(--muted)]">
            ห้องที่ครูกดเก็บถาวร (ตอนสิ้นปีการศึกษา) จะมาอยู่ที่นี่
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((c) => {
            const colorDef = getClassroomColor(c)
            return (
              <div
                key={c.id}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]"
              >
                <div className={`h-1 ${colorDef.bg}`} />
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorDef.bg} text-white opacity-80`}>
                      <School size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-slate-900">{c.name}</h3>
                      <p className="text-sm text-[var(--muted)]">{c.level}</p>
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">ปีการศึกษา</p>
                      <p className="font-semibold text-slate-900">{c.academic_year}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                        <Users size={9} />
                        นักเรียน
                      </p>
                      <p className="font-semibold text-slate-900">{c.student_count || 0} คน</p>
                    </div>
                  </div>

                  <p className="mb-3 text-xs text-[var(--muted)]">
                    เก็บถาวรเมื่อ <span className="font-semibold text-slate-700">{formatDate(c.archived_at)}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(c)}
                      className="btn-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <RotateCcw size={13} />
                      นำกลับมาใช้
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(c)}
                      className="btn-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 size={13} />
                      ลบถาวร
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
