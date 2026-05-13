'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ClipboardCheck, Search, X } from 'lucide-react'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import PageHeader from '@/components/PageHeader'
import StudentAvatar from '@/components/StudentAvatar'
import { AttendanceStatus, Classroom } from '@/types'
import { getAttendance, getAttendanceDates, getClassrooms, saveAttendanceRecord } from '@/lib/client-data'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useBeforeUnloadWarning } from '@/lib/hooks/useBeforeUnloadWarning'
import { ATTENDANCE_STATUS } from '@/lib/constants/colors'
import { todayISO } from '@/lib/local-date'

const STATUS_OPTIONS: AttendanceStatus[] = ['มา', 'ขาด', 'ลาป่วย', 'ลากิจ']

// แผนที่จากค่าภาษาไทยใน type AttendanceStatus → key ใน ATTENDANCE_STATUS (design tokens)
const STATUS_KEY: Record<AttendanceStatus, keyof typeof ATTENDANCE_STATUS> = {
  มา: 'present',
  ขาด: 'absent',
  ลาป่วย: 'sick',
  ลากิจ: 'personal',
}

// helper — คืน style สำหรับปุ่ม status (มา/ขาด/...) ตาม tokens
function statusButtonStyle(status: AttendanceStatus, active: boolean): React.CSSProperties {
  const meta = ATTENDANCE_STATUS[STATUS_KEY[status]]
  if (active) {
    return { backgroundColor: meta.color, color: '#ffffff' }
  }
  return { backgroundColor: meta.bg, color: meta.text }
}

function AttendancePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [date, setDate] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  // flag กัน auto-save ยิงตอนที่เรากำลังโหลดข้อมูลใหม่จาก DB (เปลี่ยนห้อง/วันที่)
  const [isLoading, setIsLoading] = useState(true)

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

  // โหลดข้อมูล + จุดสีบนปฏิทิน พร้อมกันในรอบเดียว
  // - deps เป็น primitives [activeClassroomId, date] ตรง ๆ เพื่อกันการยิงซ้ำจาก
  //   identity ของ useCallback ที่ rebuild เมื่อ deps เปลี่ยน
  // - cancelled flag กัน race เมื่อผู้ใช้เปลี่ยนห้อง/วันที่อย่างรวดเร็ว
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (cancelled) return
      await Promise.all([refreshData(), fetchMarkedDates()])
    }
    load()
    return () => {
      cancelled = true
    }
    // refreshData/fetchMarkedDates ถูก memo ด้วย [activeClassroomId, date] อยู่แล้ว
    // — ใส่เป็น deps จะทำให้ effect ยิงซ้ำเมื่อ identity เปลี่ยน ซึ่งเทียบเท่ากับ
    //   primitives เหล่านี้พอดี → กันซ้ำด้วยการใช้ primitives ตรง ๆ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassroomId, date])

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

  const counts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1
        return acc
      }, {}),
    [rows]
  )

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
        <Link href="/" className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-ghost)]">
          <ChevronLeft size={16} />
          กลับไปหน้าห้องเรียน
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        icon={ClipboardCheck}
        badge="เช็คชื่อ"
        tone="ok"
        title={activeClassroom ? `เช็คชื่อห้อง ${activeClassroom.name}` : 'เช็คชื่อรายวัน'}
        subtitle="เลือกห้องและวันที่ แล้วบันทึกสถานะนักเรียน"
        actions={
          <>
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
          </>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-3 stagger-children sm:grid-cols-2 md:grid-cols-5">
        <div className="animate-slide-up card flex items-center gap-3 p-3.5 stat-blue">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-ghost)] text-[var(--primary-strong)] text-sm font-bold">
            {rows.length}
          </div>
          <p className="text-xs font-medium text-[var(--muted)]">ทั้งหมด</p>
        </div>
        {STATUS_OPTIONS.map((status) => {
          const meta = ATTENDANCE_STATUS[STATUS_KEY[status]]
          return (
            <div key={status} className="animate-slide-up card flex items-center gap-3 p-3.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                style={{ backgroundColor: meta.bg, color: meta.text }}
              >
                {counts[status] || 0}
              </div>
              <p className="text-xs font-medium text-[var(--muted)]">{status}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions + Search */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-xs)] transition-all focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-soft)]">
          <Search size={16} className="flex-shrink-0 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาจากชื่อ, รหัส หรือเลขที่..."
            className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--muted-soft)]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="flex-shrink-0 text-[var(--muted-soft)] hover:text-[var(--text-soft)]">
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
                className="btn-press status-pill rounded-[var(--radius-sm)] text-xs font-semibold"
                style={{
                  ...statusButtonStyle(status, false),
                  minWidth: 60,
                  padding: '6px 12px',
                }}
              >
                {status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[var(--surface-soft)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">
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
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--muted-soft)]">
                      <ClipboardCheck size={20} />
                    </div>
                    <p className="font-medium text-[var(--muted)]">กรุณาเลือกห้องเรียนก่อนเริ่มเช็คชื่อ</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <p className="font-medium text-[var(--muted)]">ไม่พบข้อมูลนักเรียนในห้องนี้</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  return (
                  <tr key={row.id} className="table-row-hover border-b border-[var(--line-soft)]">
                    <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{row.student_number || row.student_id}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-[var(--text)]">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar
                          photoPath={row.photo_path}
                          name={`${row.first_name} ${row.last_name}`}
                          size={40}
                        />
                        <span>{[row.title, row.first_name, row.last_name].filter(Boolean).join(' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((status) => {
                          const active = row.status === status
                          return (
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
                                active
                                  ? 'กดอีกครั้งเพื่อยกเลิก (กลับเป็น "มา")'
                                  : `กดเพื่อตั้งเป็น "${status}"`
                              }
                              className="status-pill rounded-[var(--radius-sm)] text-xs font-semibold"
                              style={{
                                ...statusButtonStyle(status, active),
                                minWidth: 60,
                                padding: '6px 12px',
                                boxShadow: active ? 'var(--shadow-xs)' : 'none',
                              }}
                            >
                              {status}
                            </button>
                          )
                        })}
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
                        className="input"
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
