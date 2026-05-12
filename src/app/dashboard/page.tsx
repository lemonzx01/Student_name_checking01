'use client'

import Link from 'next/link'
import { ChevronLeft, LayoutDashboard } from 'lucide-react'
import DashboardStats from '@/components/DashboardStats'

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      {/* Header */}
      <section className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          <LayoutDashboard size={13} />
          Dashboard
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ภาพรวม</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          สรุปข้อมูลสำคัญในระบบ — ขาดบ่อย, BMI, นักเรียนใหม่, การเช็คชื่อล่าสุด
        </p>
      </section>

      <DashboardStats />
    </div>
  )
}
