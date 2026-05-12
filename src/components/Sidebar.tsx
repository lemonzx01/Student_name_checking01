'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Activity,
  Archive,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  ListChecks,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { getClassrooms } from '@/lib/client-data'
import GlobalSearch from '@/components/GlobalSearch'

interface MenuItem {
  href: string
  label: string
  icon: typeof Home
  desc: string
}

const MAIN_MENU: MenuItem[] = [
  { href: '/', label: 'ห้องเรียน', icon: Home, desc: 'จัดการห้องเรียน' },
  { href: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard, desc: 'สรุปสถิติทั้งระบบ' },
  { href: '/students', label: 'นักเรียน', icon: Users, desc: 'รายชื่อนักเรียน' },
  { href: '/attendance', label: 'เช็คชื่อ', icon: ClipboardCheck, desc: 'เช็คชื่อรายวัน' },
  { href: '/schedule', label: 'ตารางสอน', icon: CalendarDays, desc: 'จัดตารางเรียน' },
]

const DATA_MENU: MenuItem[] = [
  { href: '/grades', label: 'คะแนน/เกรด', icon: FileBarChart, desc: 'กรอกคะแนนรายวิชา' },
  { href: '/health', label: 'สุขภาพ', icon: Activity, desc: 'น้ำหนัก ส่วนสูง BMI' },
  { href: '/report-card', label: 'ใบรายงานคะแนน', icon: FileText, desc: 'PDF เฉพาะวิชาที่สอน' },
  { href: '/export-excel', label: 'ส่งออกข้อมูล', icon: Download, desc: 'Excel / PDF' },
  { href: '/archive', label: 'ห้องเก็บถาวร', icon: Archive, desc: 'ห้องเรียนที่ archive แล้ว' },
  { href: '/trash', label: 'ถังขยะ', icon: Trash2, desc: 'นักเรียนที่ลบ (30 วัน)' },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings, desc: 'สำรอง/กู้คืนข้อมูล' },
]

interface SidebarProps {
  classroomId: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ classroomId, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeClassroom = searchParams.get('classroom') || classroomId
  const [classroomName, setClassroomName] = useState('')

  // หา href ที่ตรงกับ pathname แบบ "longest prefix" — กันกรณี nested route ติด parent active พร้อมกัน
  // เช่น /attendance/report ต้องติดที่ /attendance แต่ถ้ามี /attendance/report ใน menu จะติดที่อันที่ยาวกว่า
  const activeHref = (() => {
    if (pathname === '/') return '/'
    const all = [...MAIN_MENU, ...DATA_MENU].map((m) => m.href).filter((h) => h !== '/')
    return (
      all
        .filter((h) => pathname === h || pathname.startsWith(h + '/'))
        .sort((a, b) => b.length - a.length)[0] ?? ''
    )
  })()

  useEffect(() => {
    if (!activeClassroom) return
    getClassrooms().then((list) => {
      const found = list.find((c: { id: number }) => String(c.id) === String(activeClassroom))
      setClassroomName(found?.name || '')
    })
  }, [activeClassroom])

  const buildHref = (href: string) => {
    if (href === '/') {
      return href
    }

    return `${href}?classroom=${activeClassroom}`
  }

  function renderMenuItems(items: MenuItem[]) {
    return items.map((item) => {
      const Icon = item.icon
      const isActive = item.href === activeHref

      return (
        <Link
          key={item.href}
          href={buildHref(item.href)}
          className={clsx(
            'group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
            isActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          )}
        >
          <div
            className={clsx(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
              isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
            )}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
            <span
              className={clsx(
                'block text-[12px] leading-tight',
                isActive ? 'text-blue-200' : 'text-slate-500'
              )}
            >
              {item.desc}
            </span>
          </div>
        </Link>
      )
    })
  }

  const sidebarContent = (
    <aside className="flex h-full w-[280px] flex-col bg-[var(--nav)] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
              <GraduationCap size={24} className="text-blue-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-wide">ระบบนักเรียน</p>
              <p className="truncate text-[12px] text-slate-400">{classroomName || 'เลือกห้องเรียน'}</p>
            </div>
          </div>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              title="ปิดเมนู"
              className="btn-compact flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white md:hidden"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Global search — ค้นหานักเรียนข้ามห้อง */}
        <div className="mt-4">
          <GlobalSearch theme="dark" placeholder="ค้นหานักเรียน..." />
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          เมนูหลัก
        </p>
        {renderMenuItems(MAIN_MENU)}

        <div className="my-3 border-t border-white/5" />

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          ข้อมูลและรายงาน
        </p>
        {renderMenuItems(DATA_MENU)}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] text-slate-500">
          กด <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">Ctrl+P</kbd> เพื่อพิมพ์หน้านี้
        </p>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">{sidebarContent}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="sidebar-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="sidebar-drawer absolute inset-y-0 left-0 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  )
}
