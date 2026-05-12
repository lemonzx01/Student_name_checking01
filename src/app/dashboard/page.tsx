'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, LayoutDashboard } from 'lucide-react'
import DashboardStats from '@/components/DashboardStats'
import PageHeader from '@/components/PageHeader'

function DashboardContent() {
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')
  const [storedClassroomId, setStoredClassroomId] = useState<string | null>(null)

  // fallback ไปอ่านจาก localStorage (sidebar ใช้ key เดียวกัน)
  useEffect(() => {
    if (classroomFromUrl) return
    const saved = localStorage.getItem('selectedClassroom')
    if (saved) setStoredClassroomId(saved)
  }, [classroomFromUrl])

  const activeClassroomRaw = classroomFromUrl || storedClassroomId
  const activeClassroomId = activeClassroomRaw ? Number(activeClassroomRaw) : null

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-ghost)]"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      <PageHeader
        icon={LayoutDashboard}
        badge="Dashboard"
        title="ภาพรวม"
        subtitle="สรุปข้อมูลสำคัญในระบบ — ขาดบ่อย, BMI, นักเรียนใหม่, การเช็คชื่อล่าสุด"
        tone="brand"
      />

      <DashboardStats classroomId={activeClassroomId} />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl animate-fade-in" />}>
      <DashboardContent />
    </Suspense>
  )
}
