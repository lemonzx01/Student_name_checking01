'use client'

import Link from 'next/link'
import { Archive, Calendar, ClipboardCheck, Copy, MoreVertical, Pencil, School, Trash2, Users } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Classroom, getClassroomColor } from '@/types'
import { markClassroomVisited } from '@/lib/recent-classrooms'

interface ClassroomCardProps {
  classroom: Classroom
  onEdit: (classroom: Classroom) => void
  onDelete: (classroom: Classroom) => void
  onDuplicate?: (classroom: Classroom) => void
  onArchive?: (classroom: Classroom) => void
}

export default function ClassroomCard({
  classroom,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
}: ClassroomCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const colorDef = getClassroomColor(classroom)
  const color = colorDef.bg

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
    <div className="card card-interactive animate-slide-up group relative overflow-hidden">
      {/* Top color bar */}
      <div className={`h-1 ${color}`} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <Link
            href={`/students?classroom=${classroom.id}`}
            className="flex-1"
            onClick={() => markClassroomVisited(classroom.id)}
          >
            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white shadow-[var(--shadow-sm)]`}>
              <School size={22} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text)] transition-colors group-hover:text-[var(--primary)]">
              {classroom.name}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{classroom.level}</p>
          </Link>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              title="ตัวเลือก: แก้ไข / ลบ"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-soft)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="animate-scale-in absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
                <button
                  type="button"
                  onClick={() => { onEdit(classroom); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-soft)] transition hover:bg-[var(--surface-muted)]"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => { onDuplicate(classroom); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--primary-strong)] transition hover:bg-[var(--primary-ghost)]"
                  >
                    <Copy size={14} />
                    ขึ้นปีใหม่
                  </button>
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => { onArchive(classroom); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
                  >
                    <Archive size={14} />
                    เก็บถาวร
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { onDelete(classroom); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
                >
                  <Trash2 size={14} />
                  ลบถาวร
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              <Calendar size={11} />
              ปีการศึกษา
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--text)]">{classroom.academic_year}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              <Users size={11} />
              นักเรียน
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--text)]">{classroom.student_count || 0} คน</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={`/students?classroom=${classroom.id}`}
            className="btn btn-secondary btn-sm"
            onClick={() => markClassroomVisited(classroom.id)}
          >
            <Users size={13} />
            รายชื่อ
          </Link>
          <Link
            href={`/attendance?classroom=${classroom.id}`}
            className="btn btn-secondary btn-sm"
            onClick={() => markClassroomVisited(classroom.id)}
          >
            <ClipboardCheck size={13} />
            เช็คชื่อ
          </Link>
        </div>
      </div>
    </div>
  )
}
