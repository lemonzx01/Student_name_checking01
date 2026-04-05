'use client'

import { useEffect, useState } from 'react'
import { BookOpen, FileSpreadsheet, Plus, School, TrendingUp, Users } from 'lucide-react'
import ClassroomCard from '@/components/ClassroomCard'
import CreateClassroomModal from '@/components/CreateClassroomModal'
import ExcelImportButton from '@/components/ExcelImportButton'
import { Classroom } from '@/types'
import { deleteClassroomRecord, getClassrooms } from '@/lib/client-data'

export default function HomePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)

  async function loadClassrooms() {
    setLoading(true)
    try {
      const result = await getClassrooms()
      setClassrooms(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClassrooms()
  }, [])

  async function handleDelete(classroom: Classroom) {
    const confirmed = window.confirm(`ลบห้อง ${classroom.name} และข้อมูลนักเรียนทั้งหมดหรือไม่?`)
    if (!confirmed) {
      return
    }

    await deleteClassroomRecord(classroom.id)
    await loadClassrooms()
  }

  const totalStudents = classrooms.reduce((sum, c) => sum + (c.student_count || 0), 0)

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Hero Section */}
      <section className="animate-slide-up mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-blue-100/60 bg-gradient-to-br from-white via-white to-blue-50/50 p-6 shadow-[var(--shadow-md)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <FileSpreadsheet size={13} />
              Student Import Ready
            </div>
            <h1 className="max-w-2xl text-2xl font-bold leading-tight text-slate-900 md:text-3xl lg:text-4xl">
              จัดการนักเรียนรายห้อง
              <span className="mt-1 block text-lg font-normal text-[var(--muted)] md:text-xl">
                import ข้อมูลจาก Excel ให้ตรงกับต้นฉบับ
              </span>
            </h1>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingClassroom(null)
                  setModalOpen(true)
                }}
                className="btn-press inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-[var(--primary-strong)] hover:shadow-blue-500/30"
              >
                <Plus size={18} />
                สร้างห้องเรียน
              </button>
              <ExcelImportButton onImported={loadClassrooms} />
            </div>
          </div>

          {/* Stats Panel */}
          <div className="grid gap-3 stagger-children">
            <div className="animate-slide-up flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-sm)] stat-blue">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <School size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">จำนวนห้องทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-900">{classrooms.length}</p>
              </div>
            </div>
            <div className="animate-slide-up flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-sm)] stat-green">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">นักเรียนทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
              </div>
            </div>
            <div className="animate-slide-up rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-[13px] leading-6 text-blue-700">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <TrendingUp size={14} />
                คำแนะนำ
              </div>
              ระบบรองรับ import จาก Excel โดยอัตโนมัติ — จะ map คอลัมน์หลักอย่าง ห้อง, ชื่อ, นามสกุล, วันเกิด และข้อมูลผู้ปกครองให้
            </div>
          </div>
        </div>
      </section>

      {/* Classroom Grid */}
      <section className="animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl">ห้องเรียนทั้งหมด</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">กดที่การ์ดเพื่อเปิดรายชื่อนักเรียน</p>
          </div>
          {classrooms.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {classrooms.length} ห้อง
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                <div className="skeleton mb-4 h-12 w-12 rounded-xl" />
                <div className="skeleton mb-2 h-5 w-2/3" />
                <div className="skeleton mb-4 h-4 w-1/3" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : classrooms.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <BookOpen size={30} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">ยังไม่มีห้องเรียน</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
              เริ่มจากสร้างห้องเรียนเอง หรือ import ข้อมูลจาก Excel เพื่อให้ระบบสร้างห้องให้อัตโนมัติ
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingClassroom(null)
                  setModalOpen(true)
                }}
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
              >
                <Plus size={16} />
                สร้างห้องเรียน
              </button>
              <ExcelImportButton onImported={loadClassrooms} />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 stagger-children md:grid-cols-2 xl:grid-cols-3">
            {classrooms.map((classroom) => (
              <ClassroomCard
                key={classroom.id}
                classroom={classroom}
                onEdit={(item) => {
                  setEditingClassroom(item)
                  setModalOpen(true)
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <CreateClassroomModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadClassrooms}
        editingClassroom={editingClassroom}
      />
    </div>
  )
}
