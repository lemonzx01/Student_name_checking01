'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  Archive,
  ClipboardCheck,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Classroom, getClassroomColor } from '@/types'
import { markClassroomVisited } from '@/lib/recent-classrooms'

interface ClassroomRowProps {
  classroom: Classroom
  onEdit: (classroom: Classroom) => void
  onDelete: (classroom: Classroom) => void
  onDuplicate?: (classroom: Classroom) => void
  onArchive?: (classroom: Classroom) => void
}

const MENU_WIDTH = 144 // w-36 = 9rem = 144px

export default function ClassroomRow({
  classroom,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
}: ClassroomRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const colorDef = getClassroomColor(classroom)

  // เปิด menu → คำนวณ position จากปุ่ม (fixed positioning อิง viewport)
  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right - MENU_WIDTH,
    })
    setMenuOpen(true)
  }

  // ปิดเมื่อคลิกนอก menu/ปุ่ม + ปิดเมื่อ scroll (UX มาตรฐาน — กัน position ค้าง)
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    function handleScroll() {
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [menuOpen])

  return (
    <div className="card card-interactive group flex items-center gap-3 px-4 py-3">
      {/* Color stripe — identifier เร็ว ๆ */}
      <div className={`h-9 w-1.5 flex-shrink-0 rounded-full ${colorDef.bg}`} />

      {/* ชื่อ + ระดับ — คลิกเข้ารายชื่อ */}
      <Link
        href={`/students?classroom=${classroom.id}`}
        className="flex min-w-0 flex-1 items-baseline gap-2"
        onClick={() => markClassroomVisited(classroom.id)}
      >
        <span className="truncate text-base font-bold text-[var(--text)] transition-colors group-hover:text-[var(--primary)]">
          {classroom.name}
        </span>
        <span className="truncate text-xs text-[var(--muted)]">{classroom.level}</span>
      </Link>

      {/* Stats — ซ่อนใน mobile เพื่อไม่ให้แน่น */}
      <div className="hidden flex-shrink-0 items-center gap-4 text-xs sm:flex">
        <span className="text-[var(--muted)]">ปี {classroom.academic_year}</span>
        <span className="inline-flex items-center gap-1 text-[var(--text-soft)]">
          <Users size={12} />
          {classroom.student_count || 0} คน
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <Link
          href={`/students?classroom=${classroom.id}`}
          className="btn btn-secondary btn-sm"
          title="รายชื่อนักเรียน"
          onClick={() => markClassroomVisited(classroom.id)}
        >
          <Users size={13} />
          <span className="hidden md:inline">รายชื่อ</span>
        </Link>
        <Link
          href={`/attendance?classroom=${classroom.id}`}
          className="btn btn-secondary btn-sm"
          title="เช็คชื่อ"
          onClick={() => markClassroomVisited(classroom.id)}
        >
          <ClipboardCheck size={13} />
          <span className="hidden md:inline">เช็คชื่อ</span>
        </Link>

        {/* 3-dot — menu render ผ่าน portal เพื่อหลุด stacking context */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          title="ตัวเลือก: แก้ไข / ลบ"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-soft)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {menuOpen && menuPos && typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="animate-scale-in fixed z-[100] w-36 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
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
          </div>,
          document.body,
        )}
    </div>
  )
}
