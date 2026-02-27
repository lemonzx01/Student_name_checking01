'use client'

import { useSearchParams, usePathname } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { ReactNode } from 'react'

function LayoutContent({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const classroomIdFromUrl = searchParams.get('classroom')
  const [mounted, setMounted] = useState(false)
  const [storedClassroomId, setStoredClassroomId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    // Read from localStorage on mount
    const saved = localStorage.getItem('selectedClassroom')
    if (saved) setStoredClassroomId(saved)
  }, [])

  useEffect(() => {
    // Persist classroom ID to localStorage whenever it changes in URL
    if (classroomIdFromUrl) {
      localStorage.setItem('selectedClassroom', classroomIdFromUrl)
      setStoredClassroomId(classroomIdFromUrl)
    }
  }, [classroomIdFromUrl])

  const classroomId = classroomIdFromUrl || storedClassroomId
  const isHomePage = pathname === '/'

  // Show sidebar when classroom is selected AND not on home page
  const showSidebar = mounted && !!classroomId && !isHomePage

  return (
    <div className="flex min-h-screen">
      {showSidebar && <Sidebar classroomId={classroomId!} />}
      <main className={`flex-1 p-6 ${showSidebar ? 'ml-[220px]' : ''}`}>
        {children}
      </main>
    </div>
  )
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen"><main className="flex-1 p-6">{children}</main></div>}>
      <LayoutContent>{children}</LayoutContent>
    </Suspense>
  )
}
