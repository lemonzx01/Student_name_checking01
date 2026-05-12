'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ClipboardCheck, MessageSquare, Search, X } from 'lucide-react'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import ParentContactModal from '@/components/ParentContactModal'
import StudentAvatar from '@/components/StudentAvatar'
import { AttendanceStatus, Classroom } from '@/types'
import { getAttendance, getAttendanceDates, getClassrooms, saveAttendanceRecord } from '@/lib/client-data'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useBeforeUnloadWarning } from '@/lib/hooks/useBeforeUnloadWarning'

const STATUS_OPTIONS: AttendanceStatus[] = ['มา', 'ขาด', 'ลาป่วย', 'ลากิจ']

const STATUS_STYLES: Record<AttendanceStatus, { active: string; icon: string }> = {
  มา: { active: 'bg-emerald-500 text-white shadow-emerald-500/25', icon: 'bg-emerald-50 text-emerald-600' },
  ขาด: { active: 'bg-red-500 text-white shadow-red-500/25', icon: 'bg-red-50 text-red-600' },
  ลาป่วย: { active: 'bg-amber-500 text-white shadow-amber-500/25', icon: 'bg-amber-50 text-amber-600' },
  ลากิจ: { active: 'bg-sky-500 text-white shadow-sky-500/25', icon: 'bg-sky-50 text-sky-600' },
}

function AttendancePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  // flag กัน auto-save ยิงตอนที่เรากำลังโหลดข้อมูลใหม่จาก DB (เปลี่ยนห้อง/วันที่)
  const [isLoading, setIsLoading] = useState(true)
  const [contactStudent, setContactStudent] = useState<any | null>(null)

  const activeClassroomId = classroomFromUrl ? Number(classroomFromUrl) : null
  const activeClassroom = classrooms.find((item) => item.id === activeClassroomId) ?? null

  // useCallback เพื่อให้ identity คงที่ — ปลอดภัยเมื่อใช้ใน effect deps + ส่งให้ child
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const classroomRows = await getClassrooms()
      setClassrooms(classroomRows)

      if (!activeClassroomId) {
        setRows([])
        return
      }

      const attendanceRows = await getAttendance(date, activeClassroomId)
      setRows(attendanceRows)
    } finally {
      setIsLoading(false)
    }
  }, [activeClassroomId, date])

  const fetchMarkedDates = useCallback(
    async (yearMonth?: string) => {
      if (!activeClassroomId) {
        setMarkedDates(new Set())
        return
      }
      const ym = yearMonth || date.slice(0, 7)
      const dates = await getAttendanceDates(activeClassroomId, ym)
      setMarkedDates(new Set(dates))
    },
    [activeClassroomId, date]
  )

  useEffect(() => {
    refreshData()
    fetchMarkedDates()
  }, [refreshData, fetchMarkedDates])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return rows
    }

    return rows.filter((row) => {
      const fullName = [row.title, row.first_name, row.last_name].filter(Boolean).join(' ').toLowerCase()
      return (
        fullName.includes(query) ||
        row.student_id.toLowerCase().includes(query) ||
        String(row.student_number || '').toLowerCase().includes(query)
      )
    })
  }, [rows, search])

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1
    return acc
  }, {})

  function setAllStatus(status: AttendanceStatus) {
    setRows((current) => current.map((item) => ({ ...item, status })))
  }

  // ─── Auto-save ────────────────────────────────────────────
  // บันทึกอัตโนมัติทุกครั้งที่ครูเปลี่ยนสถานะนักเรียนหรือหมายเหตุ (debounce 600ms)
  const saveAttendance = useCallback(
    async (currentRows: any[]) => {
      if (!activeClassroomId || currentRows.length === 0) return

      const attendance = currentRows.reduce<Record<number, { status: AttendanceStatus; note?: string }>>(
        (acc, row) => {
          acc[row.id] = {
            status: row.status,
            note: row.note || '',
          }
          return acc
        },
        {}
      )

      await saveAttendanceRecord(date, activeClassroomId, attendance)
    },
    [date, activeClassroomId]
  )

  const { status: saveStatus, lastSavedAt, hasPendingChanges } = useAutoSave(rows, saveAttendance, {
    debounceMs: 600,
    enabled: !!activeClassroomId && !isLoading && rows.length > 0,
    onSaved: () => {
      // อัปเดตจุดสีบนปฏิทินให้รู้ว่าวันนี้ได้เช็คไปแล้ว
      fetchMarkedDates()
    },
  })

  // เตือนก่อนปิดหน้า ถ้ายังมีการเช็คชื่อที่รอบันทึก
  useBeforeUnloadWarning(hasPendingChanges)

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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              <ClipboardCheck size={13} />
              Attendance Sheet
            </div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {activeClassroom ? `เช็คชื่อห้อง ${activeClassroom.name}` : 'เช็คชื่อรายวัน'}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">เลือกห้องและวันที่ แล้วบันทึกสถานะนักเรียน</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end">
            <CustomSelect
              value={activeClassroomId ?? ''}
              onChange={(value) => {
                if (!value) {
                  router.replace('/attendance')
                  return
                }
                localStorage.setItem('selectedClassroom', String(value))
                router.replace(`/attendance?classroom=${value}`)
              }}
              options={[
                { value: '', label: 'เลือกห้องเรียน' },
                ...classrooms.map((classroom) => ({ value: classroom.id, label: classroom.name })),
              ]}
              placeholder="เลือกห้องเรียน"
              className="min-w-[180px]"
            />

            <CalendarPicker value={date} onChange={setDate} compact markedDates={markedDates} onMonthChange={fetchMarkedDates} />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid gap-3 stagger-children sm:grid-cols-2 md:grid-cols-5">
          <div className="animate-slide-up flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 stat-blue">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">
              {rows.length}
            </div>
            <p className="text-xs font-medium text-[var(--muted)]">ทั้งหมด</p>
          </div>
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className="animate-slide-up flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${STATUS_STYLES[status].icon}`}>
                {counts[status] || 0}
              </div>
              <p className="text-xs font-medium text-[var(--muted)]">{status}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions + Search */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 shadow-[var(--shadow-sm)] transition-all focus-within:border-[var(--primary)]">
          <Search size={16} className="flex-shrink-0 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาจากชื่อ, รหัส หรือเลขที่..."
            className="w-full border-0 bg-transparent text-sm outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Bulk set all status */}
        {activeClassroomId && rows.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--muted)]">ตั้งทั้งหมด:</span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setAllStatus(status)}
                className={`btn-press status-pill rounded-lg px-2.5 py-1.5 text-xs font-medium ${STATUS_STYLES[status].icon}`}
              >
                {status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">เลขที่</th>
                <th className="px-4 py-3.5">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3.5">สถานะ</th>
                <th className="px-4 py-3.5">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {!activeClassroomId ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      <ClipboardCheck size={20} />
                    </div>
                    <p className="font-medium text-slate-500">กรุณาเลือกห้องเรียนก่อนเริ่มเช็คชื่อ</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <p className="font-medium text-slate-500">ไม่พบข้อมูลนักเรียนในห้องนี้</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isAbsent = row.status === 'ขาด' || row.status === 'ลาป่วย' || row.status === 'ลากิจ'
                  return (
                  <tr key={row.id} className="table-row-hover border-b border-slate-50">
                    <td className="px-4 py-3.5 text-sm text-slate-600">{row.student_number || row.student_id}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar
                          photoPath={row.photo_path}
                          name={`${row.first_name} ${row.last_name}`}
                          size={32}
                        />
                        <span>{[row.title, row.first_name, row.last_name].filter(Boolean).join(' ')}</span>
                        {isAbsent && (
                          <button
                            type="button"
                            onClick={() =>
                              setContactStudent({
                                id: row.id,
                                title: row.title,
                                first_name: row.first_name,
                                last_name: row.last_name,
                                classroom_name: activeClassroom?.name || '',
                                guardian_phone: row.guardian_phone,
                                _date: date,
                                _status: row.status,
                              })
                            }
                            title="แจ้งผู้ปกครอง"
                            className="btn-press inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <MessageSquare size={11} />
                            แจ้งผู้ปกครอง
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={status}
                            type="button"
                            // กดสถานะเดิมที่เลือกอยู่อีกครั้ง = "ยกเลิกการกด" → กลับเป็น 'มา' (default)
                            // กดสถานะใหม่ = เปลี่ยนเป็นสถานะนั้น
                            onClick={() => {
                              const nextStatus: AttendanceStatus = row.status === status ? 'มา' : status
                              setRows((current) =>
                                current.map((item) =>
                                  item.id === row.id ? { ...item, status: nextStatus } : item
                                )
                              )
                            }}
                            title={
                              row.status === status
                                ? 'กดอีกครั้งเพื่อยกเลิก (กลับเป็น "มา")'
                                : `กดเพื่อตั้งเป็น "${status}"`
                            }
                            className={`status-pill rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ${
                              row.status === status
                                ? STATUS_STYLES[status].active
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        value={row.note || ''}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) => (item.id === row.id ? { ...item, note: event.target.value } : item))
                          )
                        }
                        placeholder="หมายเหตุ..."
                        className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-0"
                      />
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Auto-save indicator (มุมล่างขวา) */}
      <AutoSaveIndicator
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        hidden={!activeClassroomId}
      />

      {/* Parent contact modal (เมื่อกด "แจ้งผู้ปกครอง" ในแถวนักเรียนที่ขาด) */}
      {contactStudent && (
        <ParentContactModal
          isOpen={!!contactStudent}
          onClose={() => setContactStudent(null)}
          student={contactStudent}
          defaultTemplate="absent"
          defaultContext={{ date: contactStudent._date }}
        />
      )}
    </div>
  )
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl">
        <div className="skeleton mb-4 h-6 w-40" />
        <div className="skeleton mb-6 h-48 w-full rounded-[var(--radius-lg)]" />
        <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    }>
      <AttendancePageContent />
    </Suspense>
  )
}
