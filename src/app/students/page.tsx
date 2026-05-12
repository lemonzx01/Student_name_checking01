'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, Eye, NotebookPen, Pencil, Phone, Plus, Search, Trash2, UserSquare2, Users, X } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import ExcelImportButton from '@/components/ExcelImportButton'
import StudentAvatar from '@/components/StudentAvatar'
import StudentModal from '@/components/StudentModal'
import { Classroom, Student, StudentNote } from '@/types'
import {
  addStudentNoteRecord,
  deleteStudentNoteRecord,
  deleteStudentRecord,
  getClassrooms,
  getStudentNotes,
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
  const [notes, setNotes] = useState<StudentNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().split('T')[0])
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const { confirm, alert } = useDialog()

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

  // เปิด detail modal อัตโนมัติเมื่อมี ?student=<id> ใน URL (จาก global search)
  const studentIdFromUrl = searchParams.get('student')
  useEffect(() => {
    if (!studentIdFromUrl || students.length === 0) return
    const found = students.find((s) => String(s.id) === studentIdFromUrl)
    if (found) {
      setSelectedStudent(found)
    }
  }, [studentIdFromUrl, students])

  // โหลดบันทึกประจำตัว ทุกครั้งที่เปิดดูนักเรียนคนใหม่
  useEffect(() => {
    if (!selectedStudent) {
      setNotes([])
      setNoteText('')
      return
    }

    let cancelled = false
    setNotesLoading(true)
    getStudentNotes(selectedStudent.id)
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((err) => {
        console.error('[notes] load error', err)
        if (!cancelled) setNotes([])
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedStudent])

  async function handleAddNote() {
    if (!selectedStudent) return
    const trimmed = noteText.trim()
    if (!trimmed) {
      await alert({ title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกข้อความบันทึก', variant: 'warning' })
      return
    }
    if (!noteDate) {
      await alert({ title: 'ข้อมูลไม่ครบ', message: 'กรุณาเลือกวันที่', variant: 'warning' })
      return
    }

    setSavingNote(true)
    try {
      const created = await addStudentNoteRecord({
        student_id: selectedStudent.id,
        date: noteDate,
        note: trimmed,
      })
      setNotes((prev) => [created, ...prev])
      setNoteText('')
    } catch (err) {
      console.error('[notes] add error', err)
      await alert({ title: 'บันทึกไม่สำเร็จ', message: 'ลองใหม่อีกครั้ง', variant: 'error' })
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDeleteNote(note: StudentNote) {
    const ok = await confirm({
      title: 'ลบบันทึกนี้?',
      message: 'บันทึกประจำตัวที่เลือกจะถูกลบทิ้ง',
      variant: 'danger',
      confirmText: 'ลบบันทึก',
    })
    if (!ok) return

    try {
      await deleteStudentNoteRecord(note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    } catch (err) {
      console.error('[notes] delete error', err)
      await alert({ title: 'ลบไม่สำเร็จ', message: 'ลองใหม่อีกครั้ง', variant: 'error' })
    }
  }

  function formatThaiShortDate(iso: string): string {
    // รับ 'YYYY-MM-DD' → '12 เม.ย. 2568'
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${d} ${months[m - 1]} ${y + 543}`
  }

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
          <span className="font-semibold text-slate-900">{displayName(student)}</span>{' '}
          ออกจากระบบ
        </>
      ),
      details: (
        <p className="text-xs text-slate-600">
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
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar
                          photoPath={student.photo_path}
                          name={`${student.first_name} ${student.last_name}`}
                          size={40}
                        />
                        <span>{displayName(student)}</span>
                      </div>
                    </td>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null)
                    setEditingStudent(selectedStudent)
                    setModalOpen(true)
                  }}
                  className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="btn-press flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-slate-500 transition hover:bg-slate-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ID Cards */}
            <div className="grid gap-3 stagger-children md:grid-cols-3">
              <div className="animate-slide-up rounded-2xl bg-blue-50 p-4 stat-blue">
                <p className="text-xs font-medium text-blue-600">รหัสหลัก</p>
                <p className="mt-1 text-base font-bold text-slate-900">{selectedStudent.student_id}</p>
              </div>
              <div className="animate-slide-up rounded-2xl bg-violet-50 p-4 stat-purple">
                <p className="text-xs font-medium text-violet-600">เลข 13 หลัก</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatNullable(selectedStudent.national_id)}</p>
              </div>
              <div className="animate-slide-up rounded-2xl bg-emerald-50 p-4 stat-green">
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

                {/* เบอร์โทรผู้ปกครอง - โชว์เด่น + ปุ่มโทร */}
                {selectedStudent.guardian_phone ? (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-emerald-700">เบอร์โทรผู้ปกครอง</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-900">{selectedStudent.guardian_phone}</p>
                    </div>
                    <a
                      href={`tel:${selectedStudent.guardian_phone}`}
                      className="btn-press inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <Phone size={16} />
                      โทรเลย
                    </a>
                  </div>
                ) : (
                  <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm text-[var(--muted)]">
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
                    <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-[var(--muted)]">{label as string}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatNullable(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* บันทึกประจำตัวนักเรียน */}
            <div className="mt-5 rounded-2xl border border-[var(--line)] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <NotebookPen size={15} />
                </div>
                บันทึกประจำตัวนักเรียน
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {notes.length}
                </span>
              </h3>

              {/* ฟอร์มเพิ่มบันทึกใหม่ */}
              <div className="mb-4 rounded-xl border border-[var(--line)] bg-slate-50 p-4">
                <div className="mb-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <CalendarDays size={13} />
                      วันที่
                    </label>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">รายละเอียดบันทึก</label>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={2}
                      placeholder="เช่น พูดคุยกับผู้ปกครองเรื่องการบ้าน, พฤติกรรมในห้องเรียน, การแจ้งเตือน ฯลฯ"
                      className="w-full resize-none rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={savingNote || !noteText.trim()}
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} />
                    {savingNote ? 'กำลังบันทึก...' : 'เพิ่มบันทึก'}
                  </button>
                </div>
              </div>

              {/* รายการบันทึก */}
              {notesLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-16 w-full rounded-xl" />
                  <div className="skeleton h-16 w-full rounded-xl" />
                </div>
              ) : notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-[var(--muted)]">
                  ยังไม่มีบันทึก — เพิ่มบันทึกแรกด้วยแบบฟอร์มด้านบน
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="group flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 transition hover:border-violet-200 hover:bg-violet-50/30"
                    >
                      <div className="flex min-w-[90px] flex-shrink-0 flex-col items-center rounded-lg bg-violet-50 px-2 py-1.5 text-center text-violet-700">
                        <span className="text-[11px] font-medium">วันที่</span>
                        <span className="text-sm font-bold">{formatThaiShortDate(note.date)}</span>
                      </div>
                      <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {note.note}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note)}
                        className="btn-press flex-shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        title="ลบบันทึก"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
