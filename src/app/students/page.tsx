'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Eye, Pencil, Plus, Search, Trash2, UserSquare2, Users, X } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import ExcelImportButton from '@/components/ExcelImportButton'
import StudentModal from '@/components/StudentModal'
import { Classroom, Student } from '@/types'
import {
  deleteStudentRecord,
  getClassrooms,
  getStudents,
} from '@/lib/client-data'

function displayName(student: Student) {
  return [student.title, student.first_name, student.last_name].filter(Boolean).join(' ')
}

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function StudentsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const activeClassroomId = classroomFromUrl ? Number(classroomFromUrl) : null
  const activeClassroom = classrooms.find((item) => item.id === activeClassroomId) ?? null

  async function refreshData() {
    setLoading(true)
    try {
      const [classroomRows, studentRows] = await Promise.all([
        getClassrooms(),
        getStudents(activeClassroomId),
      ])
      setClassrooms(classroomRows)
      setStudents(studentRows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [classroomFromUrl])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return students
    }

    return students.filter((student) => {
      const fullName = displayName(student).toLowerCase()
      return (
        fullName.includes(query) ||
        student.student_id.toLowerCase().includes(query) ||
        (student.student_number || '').toLowerCase().includes(query) ||
        (student.national_id || '').toLowerCase().includes(query)
      )
    })
  }, [search, students])

  const maleCount = students.filter((student) => student.gender === 'ชาย').length
  const femaleCount = students.filter((student) => student.gender === 'หญิง').length

  async function handleDelete(student: Student) {
    const confirmed = window.confirm(`ลบนักเรียน ${displayName(student)} หรือไม่?`)
    if (!confirmed) {
      return
    }

    await deleteStudentRecord(student.id)
    await refreshData()
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/" className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50">
          <ChevronLeft size={16} />
          กลับไปหน้าห้องเรียน
        </Link>
      </div>

      {/* Header */}
      <section className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <Users size={13} />
              Student Directory
            </div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {activeClassroom ? `นักเรียนห้อง ${activeClassroom.name}` : 'นักเรียนทั้งหมด'}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              แสดงข้อมูลนักเรียนพร้อมรายละเอียดที่ import จาก Excel
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <CustomSelect
              value={activeClassroomId ?? ''}
              onChange={(value) => {
                if (!value) {
                  router.replace('/students')
                  return
                }
                localStorage.setItem('selectedClassroom', String(value))
                router.replace(`/students?classroom=${value}`)
              }}
              options={[
                { value: '', label: 'ทุกห้องเรียน' },
                ...classrooms.map((classroom) => ({ value: classroom.id, label: classroom.name })),
              ]}
              placeholder="ทุกห้องเรียน"
              className="min-w-[180px]"
            />

            <ExcelImportButton onImported={refreshData} />

            <button
              type="button"
              onClick={() => {
                setEditingStudent(null)
                setModalOpen(true)
              }}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
            >
              <Plus size={16} />
              เพิ่มนักเรียน
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid gap-3 stagger-children md:grid-cols-3">
          <div className="animate-slide-up flex items-center gap-3 rounded-2xl bg-slate-50 p-4 stat-blue">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">นักเรียนทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">{students.length}</p>
            </div>
          </div>
          <div className="animate-slide-up flex items-center gap-3 rounded-2xl bg-slate-50 p-4 stat-sky">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <UserSquare2 size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">นักเรียนชาย</p>
              <p className="text-2xl font-bold text-slate-900">{maleCount}</p>
            </div>
          </div>
          <div className="animate-slide-up flex items-center gap-3 rounded-2xl bg-slate-50 p-4 stat-pink">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
              <UserSquare2 size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">นักเรียนหญิง</p>
              <p className="text-2xl font-bold text-slate-900">{femaleCount}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 shadow-[var(--shadow-sm)] transition-all focus-within:border-[var(--primary)]">
        <Search size={18} className="flex-shrink-0 text-[var(--muted)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาจากชื่อ, รหัส, เลขที่ หรือเลข 13 หลัก..."
          className="w-full border-0 bg-transparent text-sm outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="flex-shrink-0 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">เลขที่</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">ชื่อ-นามสกุล</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">ห้อง</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">เพศ</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">วันเกิด</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">อายุ</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">น้ำหนัก</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 backdrop-blur">ส่วนสูง</th>
                <th className="sticky top-0 bg-slate-50/90 px-4 py-3.5 text-center backdrop-blur">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-10" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-32" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-16" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-10" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-8" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-10" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton h-4 w-10" /></td>
                    <td className="px-4 py-3.5"><div className="skeleton mx-auto h-4 w-20" /></td>
                  </tr>
                ))
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      <Search size={20} />
                    </div>
                    <p className="font-medium text-slate-500">ไม่พบข้อมูลนักเรียน</p>
                    {search && <p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนคำค้นหาใหม่</p>}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="table-row-hover border-b border-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">{student.student_number || student.student_id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{displayName(student)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {student.classroom_name || student.classroom_label || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        student.gender === 'ชาย' ? 'bg-sky-50 text-sky-700' : student.gender === 'หญิง' ? 'bg-pink-50 text-pink-700' : 'text-slate-500'
                      }`}>
                        {formatNullable(student.gender)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatNullable(student.birth_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatNullable(student.age_years)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatNullable(student.weight_kg)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatNullable(student.height_cm)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(student)}
                          className="btn-press rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="ดูรายละเอียด"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudent(student)
                            setModalOpen(true)
                          }}
                          className="btn-press rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                          title="แก้ไข"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(student)}
                          className="btn-press rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="ลบ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredStudents.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-[var(--muted)]">
            แสดง {filteredStudents.length} จาก {students.length} รายการ
          </div>
        )}
      </section>

      {/* Student Detail Modal */}
      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="modal-content relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  Imported Profile
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{displayName(selectedStudent)}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">ข้อมูลรายละเอียดจากไฟล์ Excel</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="btn-press flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-slate-500 transition hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* ID Cards */}
            <div className="grid gap-3 stagger-children md:grid-cols-3">
              <div className="animate-slide-up rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 stat-blue">
                <p className="text-xs font-medium text-blue-600">รหัสหลัก</p>
                <p className="mt-1 text-base font-bold text-slate-900">{selectedStudent.student_id}</p>
              </div>
              <div className="animate-slide-up rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100/50 p-4 stat-purple">
                <p className="text-xs font-medium text-violet-600">เลข 13 หลัก</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatNullable(selectedStudent.national_id)}</p>
              </div>
              <div className="animate-slide-up rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 stat-green">
                <p className="text-xs font-medium text-emerald-600">ห้องเรียน</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatNullable(selectedStudent.classroom_name || selectedStudent.classroom_label)}</p>
              </div>
            </div>

            {/* Detail Sections */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  ข้อมูลส่วนตัว
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['วันเกิด', selectedStudent.birth_date],
                    ['อายุ', selectedStudent.age_years],
                    ['น้ำหนัก', selectedStudent.weight_kg],
                    ['ส่วนสูง', selectedStudent.height_cm],
                    ['บ้านเลขที่', selectedStudent.house_no],
                    ['หมู่', selectedStudent.village_no],
                    ['ความด้อยโอกาส', selectedStudent.disadvantage],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-[var(--muted)]">{label as string}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ผู้ปกครอง
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['ชื่อผู้ปกครอง', [selectedStudent.guardian_title, selectedStudent.guardian_first_name, selectedStudent.guardian_last_name].filter(Boolean).join(' ')],
                    ['ความเกี่ยวข้อง', selectedStudent.guardian_relation],
                    ['อาชีพผู้ปกครอง', selectedStudent.guardian_occupation],
                    ['ชื่อบิดา', [selectedStudent.father_title, selectedStudent.father_first_name, selectedStudent.father_last_name].filter(Boolean).join(' ')],
                    ['อาชีพบิดา', selectedStudent.father_occupation],
                    ['ชื่อมารดา', [selectedStudent.mother_title, selectedStudent.mother_first_name, selectedStudent.mother_last_name].filter(Boolean).join(' ')],
                    ['อาชีพมารดา', selectedStudent.mother_occupation],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-[var(--muted)]">{label as string}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedStudent.source_payload ? (
              <div className="mt-5 rounded-2xl border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  ข้อมูลดิบจากไฟล์
                </h3>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(selectedStudent.source_payload).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <StudentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingStudent(null)
        }}
        onSuccess={refreshData}
        student={editingStudent}
        classroomId={activeClassroomId}
      />

      {!loading && students.length === 0 && (
        <div className="mt-6 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
            <UserSquare2 size={30} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">ยังไม่มีนักเรียนในห้องนี้</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">เพิ่มทีละคน หรือ import จาก Excel เพื่อดึงรายชื่อเข้ามา</p>
        </div>
      )}
    </div>
  )
}

export default function StudentsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl">
        <div className="skeleton mb-4 h-6 w-40" />
        <div className="skeleton mb-6 h-48 w-full rounded-[var(--radius-lg)]" />
        <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    }>
      <StudentsPageContent />
    </Suspense>
  )
}
