'use client'

import Link from 'next/link'
import { Calendar, ClipboardCheck, MoreVertical, Pencil, School, Trash2, Users } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Classroom } from '@/types'

interface ClassroomCardProps {
  classroom: Classroom
  onEdit: (classroom: Classroom) => void
  onDelete: (classroom: Classroom) => void
}

const COLOR_SETS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-indigo-500',
]

export default function ClassroomCard({
  classroom,
  onEdit,
  onDelete,
}: ClassroomCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const color = COLOR_SETS[classroom.id % COLOR_SETS.length]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="card-hover animate-slide-up group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
      {/* Top gradient bar */}
      <div className={`h-1 ${color}`} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <Link href={`/students?classroom=${classroom.id}`} className="flex-1">
            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white shadow-md`}>
              <School size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-[var(--primary)]">
              {classroom.name}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{classroom.level}</p>
          </Link>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="animate-scale-in absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-xl border border-[var(--line)] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { onEdit(classroom); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete(classroom); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  ลบห้อง
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              <Calendar size={11} />
              ปีการศึกษา
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">{classroom.academic_year}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              <Users size={11} />
              นักเรียน
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">{classroom.student_count || 0} คน</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={`/students?classroom=${classroom.id}`}
            className="btn-press flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Users size={13} />
            รายชื่อ
          </Link>
          <Link
            href={`/attendance?classroom=${classroom.id}`}
            className="btn-press flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ClipboardCheck size={13} />
            เช็คชื่อ
          </Link>
        </div>
      </div>
    </div>
  )
}
