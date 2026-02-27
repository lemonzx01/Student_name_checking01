'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { 
  Home, 
  Users, 
  ClipboardCheck, 
  GraduationCap,
  CalendarDays,
  Settings,
  FileDown,
  Activity
} from 'lucide-react'
import { clsx } from 'clsx'

const menuItems = [
  { href: '/', icon: Home, label: 'หน้าแรก' },
  { href: '/students', icon: Users, label: 'จัดการนักเรียน' },
  { href: '/attendance', icon: ClipboardCheck, label: 'เช็คชื่อ' },
  { href: '/schedule', icon: CalendarDays, label: 'ตารางสอน' },
  { href: '/export-excel', icon: FileDown, label: 'ส่งออกเอกสาร' },
  { href: '/health', icon: Activity, label: 'น้ำหนัก/ส่วนสูง' },
  { href: '/settings', icon: Settings, label: 'ตั้งค่า' },
]

export default function Sidebar({ classroomId }: { classroomId?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlClassroomId = searchParams.get('classroom')
  const activeClassroomId = urlClassroomId || classroomId

  // Build href with classroom parameter
  const buildHref = (href: string) => {
    if (activeClassroomId && href !== '/') {
      return `${href}?classroom=${activeClassroomId}`
    }
    return href
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[#0F172A] text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-blue-400" size={28} />
          <div>
            <h1 className="text-lg font-bold">ระบบโรงเรียน</h1>
            <p className="text-xs text-slate-400">School Management v1.0</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className={clsx(
                'flex items-center gap-3 px-6 py-3 text-sm transition-colors',
                isActive 
                  ? 'bg-blue-500 text-white border-r-4 border-blue-300' 
                  : 'text-slate-300 hover:bg-slate-800'
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Offline Mode ✓
        </p>
      </div>
    </aside>
  )
}
