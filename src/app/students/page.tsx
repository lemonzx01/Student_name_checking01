'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Eye, Pencil, Phone, Plus, Search, Trash2, UserSquare2, Users, X } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import ExcelImportButton from '@/components/ExcelImportButton'
import PageHeader from '@/components/PageHeader'
import StudentAvatar from '@/components/StudentAvatar'
import StudentModal from '@/components/StudentModal'
import { Classroom, Student } from '@/types'
import {
  deleteStudentRecord,
  getClassrooms,
  getStudents,
} from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'

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
  const { confirm, alert } = useDialog()

  const activeClassroomId = classroomFromUrl ? Number(classroomFromUrl) : null
  const activeClassroom = classrooms.find((item) => item.id === activeClassroomId) ?? null

  // refreshData ผูกกับ activeClassroomId — ใช้ useCallback เพื่อให้ identity คงที่
  // และส่งเป็น prop ได้โดยไม่ทำให้ child re-render
  const refreshData = useCallback(async () => {
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
  }, [activeClassroomId])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // เปิด detail modal อัตโนมัติเมื่อมี ?student=<id> ใน URL (จาก global search)
  const studentIdFromUrl = searchParams.get('student')
  useEffect(() => {
    if (!studentIdFromUrl || students.length === 0) return
    const found = students.find((s) => String(s.id) === studentIdFromUrl)
    if (found) {
      setSelectedStudent(found)
    }
  }, [studentIdFromUrl, students])

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
    const ok = await confirm({
      title: 'ลบนักเรียน?',
      message: (
        <>
          ลบนักเรียน{' '}
          <span className="font-semibold text-[var(--text)]">{displayName(student)}</span>{' '}
          ออกจากระบบ
        </>
      ),
      details: (
        <p className="text-xs text-[var(--muted)]">
          คะแนน บันทึกสุขภาพ และประวัติเช็คชื่อของนักเรียนคนนี้จะยังคงอยู่
          แต่จะไม่ปรากฏในรายการ
        </p>
      ),
      variant: 'danger',
      confirmText: 'ลบนักเรียน',
    })
    if (!ok) return

    try {
      await deleteStudentRecord(student.id)
      await refreshData()
    } catch (err) {
      console.error('[students] delete failed:', err)
      await alert({ title: 'ลบไม่สำเร็จ', message: 'ลองใหม่อีกครั้ง', variant: 'error' })
    }
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/" className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-ghost)]">
          <ChevronLeft size={16} />
          กลับไปหน้าห้องเรียน
        </Link>
      </div>

      <PageHeader
        icon={Users}
        badge="Student Directory"
        title={activeClassroom ? `นักเรียนห้อง ${activeClassroom.name}` : 'นักเรียนทั้งหมด'}
        subtitle="แสดงข้อมูลนักเรียนพร้อมรายละเอียดที่ import จาก Excel"
        tone="brand"
        actions={
          <>
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
              className="btn btn-primary btn-press"
            >
              <Plus size={16} />
              เพิ่มนักเรียน
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-3 stagger-children md:grid-cols-3">
        <div className="card animate-slide-up flex items-center gap-3 p-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
            style={{ background: 'var(--primary-ghost)', color: 'var(--primary-strong)' }}
          >
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">นักเรียนทั้งหมด</p>
            <p className="text-3xl font-bold text-[var(--text)]">{students.length}</p>
          </div>
        </div>
        <div className="card animate-slide-up flex items-center gap-3 p-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
            style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
          >
            <UserSquare2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">นักเรียนชาย</p>
            <p className="text-3xl font-bold text-[var(--text)]">{maleCount}</p>
          </div>
        </div>
        <div className="card animate-slide-up flex items-center gap-3 p-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}
          >
            <UserSquare2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">นักเรียนหญิง</p>
            <p className="text-3xl font-bold text-[var(--text)]">{femaleCount}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-xs)] transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_var(--primary-soft)]">
        <Search size={18} className="flex-shrink-0 text-[var(--muted-soft)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาจากชื่อ, รหัส, เลขที่ หรือเลข 13 หลัก..."
          className="w-full border-0 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="flex-shrink-0 rounded-md p-0.5 text-[var(--muted-soft)] transition hover:text-[var(--text-soft)]">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-[var(--muted)]">
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">เลขที่</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">ชื่อ-นามสกุล</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">ห้อง</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">เพศ</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">วันเกิด</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">อายุ</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">น้ำหนัก</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 backdrop-blur">ส่วนสูง</th>
                <th className="sticky top-0 bg-[var(--surface-soft)] px-4 py-3.5 text-center backdrop-blur">จัดการ</th>
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
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)] text-[var(--muted-soft)]">
                      <Search size={20} />
                    </div>
                    <p className="font-medium text-[var(--text-soft)]">ไม่พบข้อมูลนักเรียน</p>
                    {search && <p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนคำค้นหาใหม่</p>}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="table-row-hover border-b border-[var(--line-soft)]">
                    <td className="px-4 py-3 text-sm text-[var(--text-soft)]">{student.student_number || student.student_id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          photoPath={student.photo_path}
                          name={`${student.first_name} ${student.last_name}`}
                          size={40}
                        />
                        <span>{displayName(student)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="pill pill-brand">
                        {student.classroom_name || student.classroom_label || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {student.gender === 'ชาย' ? (
                        <span className="pill pill-info">{student.gender}</span>
                      ) : student.gender === 'หญิง' ? (
                        <span className="pill pill-accent">{student.gender}</span>
                      ) : (
                        <span className="text-sm text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-soft)]">{formatNullable(student.birth_date)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-soft)]">{formatNullable(student.age_years)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-soft)]">{formatNullable(student.weight_kg)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-soft)]">{formatNullable(student.height_cm)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(student)}
                          className="btn-press btn-compact flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                          className="btn-press btn-compact flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition hover:bg-[var(--primary-ghost)] hover:text-[var(--primary-strong)]"
                          title="แก้ไข"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(student)}
                          className="btn-press btn-compact flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger-strong)]"
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
          <div className="border-t border-[var(--line-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs text-[var(--muted)]">
            แสดง {filteredStudents.length} จาก {students.length} รายการ
          </div>
        )}
      </section>

      {/* Student Detail Modal */}
      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:pl-[296px]">
          <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="modal-content relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="pill pill-brand mb-2">
                  Imported Profile
                </span>
                <h2 className="text-2xl font-bold text-[var(--text)]">{displayName(selectedStudent)}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">ข้อมูลรายละเอียดจากไฟล์ Excel</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null)
                    setEditingStudent(selectedStudent)
                    setModalOpen(true)
                  }}
                  className="btn btn-secondary btn-sm btn-press"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="btn-press flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ID Cards */}
            <div className="grid gap-3 stagger-children md:grid-cols-3">
              <div className="animate-slide-up rounded-[var(--radius-md)] bg-[var(--primary-ghost)] p-4">
                <p className="text-xs font-medium text-[var(--primary-strong)]">รหัสหลัก</p>
                <p className="mt-1 text-base font-bold text-[var(--text)]">{selectedStudent.student_id}</p>
              </div>
              <div className="animate-slide-up rounded-[var(--radius-md)] bg-[var(--info-soft)] p-4">
                <p className="text-xs font-medium text-[var(--info)]">เลข 13 หลัก</p>
                <p className="mt-1 text-base font-bold text-[var(--text)]">{formatNullable(selectedStudent.national_id)}</p>
              </div>
              <div className="animate-slide-up rounded-[var(--radius-md)] bg-[var(--success-soft)] p-4">
                <p className="text-xs font-medium text-[var(--success-strong)]">ห้องเรียน</p>
                <p className="mt-1 text-base font-bold text-[var(--text)]">{formatNullable(selectedStudent.classroom_name || selectedStudent.classroom_label)}</p>
              </div>
            </div>

            {/* Detail Sections */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--text)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
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
                    <div key={label as string} className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2.5">
                      <p className="text-[12px] font-medium text-[var(--muted)]">{label as string}</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--text)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  ผู้ปกครอง
                </h3>

                {/* เบอร์โทรผู้ปกครอง - โชว์เด่น + ปุ่มโทร */}
                {selectedStudent.guardian_phone ? (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--success-soft)] bg-[var(--success-soft)] px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--success-strong)]">เบอร์โทรผู้ปกครอง</p>
                      <p className="mt-0.5 text-lg font-bold text-[var(--text)]">{selectedStudent.guardian_phone}</p>
                    </div>
                    <a
                      href={`tel:${selectedStudent.guardian_phone}`}
                      className="btn-press inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--success)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-xs)] transition hover:bg-[var(--success-strong)]"
                    >
                      <Phone size={16} />
                      โทรเลย
                    </a>
                  </div>
                ) : (
                  <div className="mb-4 rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-center text-sm text-[var(--muted)]">
                    ยังไม่มีเบอร์โทรผู้ปกครอง — กดแก้ไขเพื่อเพิ่ม
                  </div>
                )}

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
                    <div key={label as string} className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2.5">
                      <p className="text-[12px] font-medium text-[var(--muted)]">{label as string}</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedStudent.source_payload ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--line)] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--text)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  ข้อมูลดิบจากไฟล์
                </h3>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(selectedStudent.source_payload).map(([label, value]) => (
                    <div key={label} className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
                      <p className="mt-0.5 text-sm font-medium text-[var(--text)]">{formatNullable(value)}</p>
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
        <div className="empty-state mt-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary-ghost)] text-[var(--primary-strong)]">
            <UserSquare2 size={30} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text)]">ยังไม่มีนักเรียนในห้องนี้</h3>
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
