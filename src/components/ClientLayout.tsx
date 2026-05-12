'use client'

import { ReactNode, Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Menu } from 'lucide-react'
import PinGate from '@/components/PinGate'
import Sidebar from '@/components/Sidebar'
import WelcomeModal from '@/components/WelcomeModal'
import { DialogProvider } from '@/lib/hooks/useConfirm'
import { initThemeFromStorage } from '@/lib/hooks/useTheme'

function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [storedClassroomId, setStoredClassroomId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const classroomIdFromUrl = searchParams.get('classroom')
  const classroomId = classroomIdFromUrl || storedClassroomId
  const showSidebar = pathname !== '/' && !!classroomId

  useEffect(() => {
    const saved = localStorage.getItem('selectedClassroom')
    if (saved) {
      setStoredClassroomId(saved)
    }
  }, [])

  useEffect(() => {
    if (classroomIdFromUrl) {
      localStorage.setItem('selectedClassroom', classroomIdFromUrl)
      setStoredClassroomId(classroomIdFromUrl)
    }
  }, [classroomIdFromUrl])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen">
      {showSidebar && (
        <>
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="เปิดเมนู"
            className="btn-press fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md md:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu size={20} className="text-slate-700" />
          </button>

          <Sidebar
            classroomId={classroomId!}
            mobileOpen={sidebarOpen}
            onMobileClose={() => setSidebarOpen(false)}
          />
        </>
      )}
      <main className={`min-h-screen p-5 md:p-7 ${showSidebar ? 'md:ml-[280px]' : ''} ${showSidebar ? 'pt-16 md:pt-7' : ''}`}>
        {children}
      </main>
      {/* First-run onboarding — แสดงครั้งเดียวต่อเครื่อง */}
      <WelcomeModal />
    </div>
  )
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  // เรียกครั้งเดียวตอน mount เพื่อตั้ง theme/font-size attribute บน <html> ก่อน paint
  useEffect(() => {
    initThemeFromStorage()
  }, [])

  return (
    <DialogProvider>
      <PinGate>
        <Suspense fallback={<main className="min-h-screen p-5 md:p-7">{children}</main>}>
          <LayoutContent>{children}</LayoutContent>
        </Suspense>
      </PinGate>
    </DialogProvider>
  )
}
