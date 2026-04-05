'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Activity,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  GraduationCap,
  Home,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { getClassrooms } from '@/lib/client-data'

interface MenuItem {
  href: string
  label: string
  icon: typeof Home
  desc: string
}

const MAIN_MENU: MenuItem[] = [
  { href: '/', label: 'ห้องเรียน', icon: Home, desc: 'จัดการห้องเรียน' },
  { href: '/students', label: 'นักเรียน', icon: Users, desc: 'รายชื่อนักเรียน' },
  { href: '/attendance', label: 'เช็คชื่อ', icon: ClipboardCheck, desc: 'เช็คชื่อรายวัน' },
  { href: '/schedule', label: 'ตารางสอน', icon: CalendarDays, desc: 'จัดตารางเรียน' },
]

const DATA_MENU: MenuItem[] = [
  { href: '/grades', label: 'คะแนน/เกรด', icon: FileBarChart, desc: 'กรอกคะแนนรายวิชา' },
  { href: '/health', label: 'สุขภาพ', icon: Activity, desc: 'น้ำหนัก ส่วนสูง BMI' },
  { href: '/export-excel', label: 'Export ข้อมูล', icon: Download, desc: 'ส่งออก Excel/PDF' },
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
      const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

      return (
        <Link
          key={item.href}
          href={buildHref(item.href)}
          className={clsx(
            'group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
            isActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          )}
        >
          <div className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
            isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
          )}>
            <Icon size={15} />
          </div>
          <div>
            <span className="block text-[13px] font-medium">{item.label}</span>
            <span className={clsx(
              'block text-[10px]',
              isActive ? 'text-blue-200' : 'text-slate-500'
            )}>{item.desc}</span>
          </div>
        </Link>
      )
    })
  }

  const sidebarContent = (
    <aside className="flex h-full w-[260px] flex-col bg-[var(--nav)] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <GraduationCap size={22} className="text-blue-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">ระบบนักเรียน</p>
              <p className="text-[11px] text-slate-400">{classroomName || 'เลือกห้องเรียน'}</p>
            </div>
          </div>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white md:hidden"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">เมนูหลัก</p>
        {renderMenuItems(MAIN_MENU)}

        <div className="my-2 border-t border-white/5" />

        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">ข้อมูลและรายงาน</p>
        {renderMenuItems(DATA_MENU)}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <BookOpenCheck size={13} />
          <span>รองรับ import จาก Excel</span>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">
        {sidebarContent}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="sidebar-overlay absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="sidebar-drawer absolute inset-y-0 left-0 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
