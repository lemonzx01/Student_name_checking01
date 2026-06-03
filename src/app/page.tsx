'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Download,
  FileBarChart,
  LayoutGrid,
  List,
  Plus,
  School,
  Search,
  Users,
  X,
} from 'lucide-react'
import AttendanceCalendar from '@/components/AttendanceCalendar'
import BackupStatusCard from '@/components/BackupStatusCard'
import ClassroomCard from '@/components/ClassroomCard'
import ClassroomRow from '@/components/ClassroomRow'
import Pagination from '@/components/Pagination'
import CreateClassroomModal from '@/components/CreateClassroomModal'
import DuplicateClassroomModal from '@/components/DuplicateClassroomModal'
import ExcelImportButton from '@/components/ExcelImportButton'
import GlobalSearch from '@/components/GlobalSearch'
import TodaySchedule from '@/components/TodaySchedule'
import { Classroom } from '@/types'
import {
  archiveClassroomRecord,
  deleteClassroomRecord,
  getClassrooms,
  getClassroomStats,
} from '@/lib/client-data'
import { useDialog } from '@/lib/hooks/useConfirm'
import { formatThaiDate } from '@/lib/constants/thai-date'
import { getRecentClassroomIds } from '@/lib/recent-classrooms'

interface QuickActionProps {
  href: string
  icon: typeof ClipboardCheck
  title: string
  desc: string
  color: string
}

function QuickAction({ href, icon: Icon, title, desc, color }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="card card-interactive btn-press group flex items-center gap-4 p-5"
    >
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon size={28} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{desc}</p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [duplicateSource, setDuplicateSource] = useState<Classroom | null>(null)
  const [lastClassroomId, setLastClassroomId] = useState<number | null>(null)
  const [recentIds, setRecentIds] = useState<number[]>([])
  const [nowTick, setNowTick] = useState(0)
  const [classroomSearch, setClassroomSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [currentPage, setCurrentPage] = useState(1)
  const { confirm, alert } = useDialog()

  // Keep "วันนี้" label fresh — re-tick every 60s + when tab regains focus,
  // so the date doesn't get stuck on yesterday past midnight.
  // ใช้โอกาสนี้ refresh recent classrooms list ด้วย — ตอนกลับมาจากเปิดห้องอื่น
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick((n) => n + 1)
    }, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNowTick((n) => n + 1)
        setRecentIds(getRecentClassroomIds())
      }
    }
    const onFocus = () => setRecentIds(getRecentClassroomIds())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

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
    // โหลดห้องล่าสุดที่ครูเปิด (เก็บไว้ตอน navigate ใน ClientLayout)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedClassroom')
      if (saved) setLastClassroomId(Number(saved))
      const savedView = localStorage.getItem('classroomViewMode')
      if (savedView === 'list' || savedView === 'card') setViewMode(savedView)
      setRecentIds(getRecentClassroomIds())
    }
  }, [])

  function handleViewModeChange(mode: 'card' | 'list') {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('classroomViewMode', mode)
    }
  }

  async function handleArchive(classroom: Classroom) {
    const ok = await confirm({
      title: `เก็บห้อง ${classroom.name} เป็นถาวร?`,
      message:
        'ห้องนี้จะถูกซ่อนจากหน้าหลัก แต่ข้อมูลจะยังอยู่ — เปิดดูได้ที่เมนู "ห้องเก็บถาวร" หรือนำกลับมาใช้ได้ภายหลัง',
      confirmText: 'เก็บถาวร',
    })
    if (!ok) return
    try {
      const result = await archiveClassroomRecord(classroom.id)
      if (!result.success) throw new Error(result.error || 'เก็บถาวรไม่สำเร็จ')
      await loadClassrooms()
    } catch (err) {
      await alert({
        title: 'เก็บถาวรไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  async function handleDelete(classroom: Classroom) {
    // โหลดสถิติของห้องเพื่อแสดงผลกระทบ — fallback ถ้าโหลดไม่ได้ (web mode)
    const stats = await getClassroomStats(classroom.id)
    const studentCount = stats?.studentCount ?? (classroom.student_count || 0)

    const details = (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--text)]">ข้อมูลที่จะถูกลบทั้งหมด:</p>
        <ul className="ml-4 list-disc space-y-0.5 text-[var(--muted)]">
          <li>นักเรียน {studentCount} คน</li>
          {stats && (
            <>
              <li>รายการเช็คชื่อ {stats.attendanceCount} รายการ</li>
              <li>รายการคะแนน {stats.gradeCount} รายการ</li>
              <li>รายการสุขภาพ {stats.healthCount} รายการ</li>
              <li>ช่องตารางสอน {stats.scheduleCount} ช่อง</li>
            </>
          )}
        </ul>
        <p className="mt-2 text-xs text-[var(--danger-strong)]">
          ระบบจะสร้างไฟล์สำรองโดยอัตโนมัติก่อนลบ — กู้คืนได้จากหน้า &quot;ตั้งค่า&quot;
        </p>
      </div>
    )

    const ok = await confirm({
      title: `ลบห้อง ${classroom.name}?`,
      message: 'การลบนี้จะลบนักเรียนและข้อมูลที่เกี่ยวข้องทั้งหมด',
      details,
      variant: 'danger',
      confirmText: 'ลบห้องเรียน',
      requireTypeToConfirm: classroom.name,
      typeToConfirmPlaceholder: `พิมพ์ ${classroom.name}`,
    })
    if (!ok) return

    try {
      await deleteClassroomRecord(classroom.id)
      await loadClassrooms()
    } catch (err) {
      console.error('[home] delete classroom failed:', err)
      await alert({
        title: 'ลบไม่สำเร็จ',
        message: 'เกิดข้อผิดพลาดในการลบห้อง — ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  const totalStudents = classrooms.reduce((sum, c) => sum + (c.student_count || 0), 0)
  const today = useMemo(() => new Date(), [nowTick])
  const thaiDate = useMemo(() => formatThaiDate(today), [today])

  // Quick Actions ไปห้องล่าสุดที่เปิด ถ้าไม่มีใช้ห้องแรก
  const quickClassroom = useMemo(() => {
    if (lastClassroomId && classrooms.some((c) => c.id === lastClassroomId)) {
      return classrooms.find((c) => c.id === lastClassroomId) ?? null
    }
    return classrooms[0] ?? null
  }, [lastClassroomId, classrooms])
  const quickClassroomId = quickClassroom?.id

  // ตัวเลือกกรองตามระดับชั้น (อนุบาล/ประถม/มัธยม ฯลฯ) — ดึงจาก data จริง
  const availableLevels = useMemo(() => {
    const set = new Set<string>()
    for (const c of classrooms) {
      if (c.level) set.add(c.level)
    }
    return Array.from(set)
  }, [classrooms])

  // โชว์ filter UI เฉพาะตอนห้องเริ่มมีหลายห้อง — 1-3 ห้องเห็นได้หมดอยู่แล้ว
  const SHOW_FILTER_THRESHOLD = 4
  const showFilterBar = classrooms.length >= SHOW_FILTER_THRESHOLD

  // เรียงตาม MRU — ห้องที่กดเข้าล่าสุดอยู่บนสุด, ที่เหลือคงลำดับเดิมจาก DB
  // ใช้กับทั้ง filtered list และตอนไม่มี filter (classrooms ดิบ ๆ)
  const sortByRecency = useMemo(() => {
    const rank = new Map<number, number>()
    recentIds.forEach((id, idx) => rank.set(id, idx))
    return (list: Classroom[]) => {
      return [...list].sort((a, b) => {
        const ra = rank.get(a.id)
        const rb = rank.get(b.id)
        if (ra === undefined && rb === undefined) return 0
        if (ra === undefined) return 1
        if (rb === undefined) return -1
        return ra - rb
      })
    }
  }, [recentIds])

  const filteredClassrooms = useMemo(() => {
    if (!showFilterBar) return sortByRecency(classrooms)
    const q = classroomSearch.trim().toLowerCase()
    const matched = classrooms.filter((c) => {
      if (levelFilter && c.level !== levelFilter) return false
      if (!q) return true
      const haystack = `${c.name} ${c.level} ${c.academic_year}`.toLowerCase()
      return haystack.includes(q)
    })
    return sortByRecency(matched)
  }, [classrooms, classroomSearch, levelFilter, showFilterBar, sortByRecency])

  // Pagination — card view โชว์ 6 ใบ/หน้า, list view โชว์ 15 บรรทัด/หน้า
  const pageSize = viewMode === 'card' ? 6 : 15
  const totalPages = Math.max(1, Math.ceil(filteredClassrooms.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedClassrooms = useMemo(
    () => filteredClassrooms.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredClassrooms, safePage, pageSize],
  )

  // รีเซ็ตหน้าตอน search/filter/viewMode เปลี่ยน — กันไม่ให้ค้างที่หน้าที่หายไป
  useEffect(() => {
    setCurrentPage(1)
  }, [classroomSearch, levelFilter, viewMode])

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* ─── 1. Welcome Hero — ทักทาย + วันที่ + ค้นหา + สถิติย่อ ─── */}
      <section className="animate-slide-up card mb-6 overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <span className="pill pill-brand">ยินดีต้อนรับ</span>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-[var(--text)] md:text-4xl">
              ระบบจัดการนักเรียน
            </h1>
            <p className="mt-2 text-lg text-[var(--text-soft)]">วันนี้คือ{thaiDate}</p>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
              ดูตารางสอนวันนี้ เช็คชื่อ และเข้าทำงานในห้องเรียนของคุณได้จากเมนูด้านล่าง
            </p>
          </div>

          <div className="space-y-3">
            <GlobalSearch placeholder="พิมพ์ชื่อ หรือรหัสนักเรียน" />
            <div className="grid grid-cols-2 gap-3">
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-ghost)] text-[var(--primary)]">
                  <School size={22} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)]">ห้องทั้งหมด</p>
                  <p className="text-xl font-bold text-[var(--text)]">{classrooms.length}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                  <Users size={22} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)]">นักเรียน</p>
                  <p className="text-xl font-bold text-[var(--text)]">{totalStudents}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. ห้องเรียนทั้งหมด — Entry point หลัก, ครูเลือกห้องก่อนทำงาน ─── */}
      <section className="animate-slide-up mb-6" style={{ animationDelay: '60ms' }}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--text)] md:text-2xl">ห้องเรียนทั้งหมด</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              คลิกที่การ์ดเพื่อเปิดรายชื่อนักเรียนในห้องนั้น
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {classrooms.length > 0 && (
              <span className="pill pill-muted">{classrooms.length} ห้อง</span>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingClassroom(null)
                setModalOpen(true)
              }}
              className="btn btn-primary btn-press"
            >
              <Plus size={16} />
              สร้างห้องเรียน
            </button>
            <ExcelImportButton onImported={loadClassrooms} />
          </div>
        </div>

        {showFilterBar && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-xs)] transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_var(--primary-soft)]">
              <Search size={18} className="flex-shrink-0 text-[var(--muted-soft)]" />
              <input
                value={classroomSearch}
                onChange={(e) => setClassroomSearch(e.target.value)}
                placeholder="ค้นหาห้อง — ชื่อห้อง, ระดับชั้น หรือปีการศึกษา"
                className="w-full border-0 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
              />
              {classroomSearch && (
                <button
                  type="button"
                  onClick={() => setClassroomSearch('')}
                  className="flex-shrink-0 rounded-md p-0.5 text-[var(--muted-soft)] transition hover:text-[var(--text-soft)]"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {availableLevels.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLevelFilter('')}
                  className={`pill ${levelFilter === '' ? 'pill-brand' : 'pill-muted'} btn-press`}
                >
                  ทั้งหมด
                </button>
                {availableLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevelFilter(level)}
                    className={`pill ${levelFilter === level ? 'pill-brand' : 'pill-muted'} btn-press`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            {/* View toggle: card ↔ list — เปลี่ยน layout ตอนห้องเริ่มเยอะ */}
            <div className="flex flex-shrink-0 items-center rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow-xs)]">
              <button
                type="button"
                onClick={() => handleViewModeChange('card')}
                className={`flex h-8 items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 text-xs font-medium transition ${
                  viewMode === 'card'
                    ? 'bg-[var(--primary-ghost)] text-[var(--primary-strong)]'
                    : 'text-[var(--muted)] hover:text-[var(--text-soft)]'
                }`}
                title="แสดงแบบการ์ด"
                aria-pressed={viewMode === 'card'}
              >
                <LayoutGrid size={14} />
                การ์ด
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`flex h-8 items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-[var(--primary-ghost)] text-[var(--primary-strong)]'
                    : 'text-[var(--muted)] hover:text-[var(--text-soft)]'
                }`}
                title="แสดงแบบรายการ — เห็นห้องเยอะในจอเดียว"
                aria-pressed={viewMode === 'list'}
              >
                <List size={14} />
                รายการ
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5">
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
          <div className="empty-state">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-ghost)] text-[var(--primary)]">
              <BookOpen size={30} />
            </div>
            <h3 className="text-xl font-bold text-[var(--text)]">ยังไม่มีห้องเรียน</h3>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-[var(--muted)]">
              เริ่มด้วยการสร้างห้องเรียน หรือ นำเข้ารายชื่อจากไฟล์ Excel ระบบจะสร้างห้องให้อัตโนมัติ
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingClassroom(null)
                  setModalOpen(true)
                }}
                className="btn btn-primary btn-lg btn-press"
              >
                <Plus size={18} />
                สร้างห้องเรียน
              </button>
              <ExcelImportButton onImported={loadClassrooms} />
            </div>
          </div>
        ) : filteredClassrooms.length === 0 ? (
          <div className="empty-state">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted-soft)]">
              <Search size={28} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text)]">ไม่พบห้องที่ตรงกับการค้นหา</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
              ลองเปลี่ยนคำค้นหา หรือกดปุ่ม &quot;ทั้งหมด&quot; เพื่อยกเลิกตัวกรอง
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setClassroomSearch('')
                  setLevelFilter('')
                }}
                className="btn btn-ghost btn-press"
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>
        ) : viewMode === 'list' && showFilterBar ? (
          <>
            <div className="stagger-children flex flex-col gap-2">
              {pagedClassrooms.map((classroom) => (
                <ClassroomRow
                  key={classroom.id}
                  classroom={classroom}
                  onEdit={(item) => {
                    setEditingClassroom(item)
                    setModalOpen(true)
                  }}
                  onDelete={handleDelete}
                  onDuplicate={(item) => setDuplicateSource(item)}
                  onArchive={handleArchive}
                />
              ))}
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setCurrentPage} />
          </>
        ) : (
          <>
            <div className="grid gap-4 stagger-children md:grid-cols-2 xl:grid-cols-3">
              {pagedClassrooms.map((classroom) => (
                <ClassroomCard
                  key={classroom.id}
                  classroom={classroom}
                  onEdit={(item) => {
                    setEditingClassroom(item)
                    setModalOpen(true)
                  }}
                  onDelete={handleDelete}
                  onDuplicate={(item) => setDuplicateSource(item)}
                  onArchive={handleArchive}
                />
              ))}
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setCurrentPage} />
          </>
        )}
      </section>

      {/* ─── 3. วันนี้สอนอะไร + ปฏิทินเช็คชื่อ (ห้องล่าสุด) ─── */}
      {quickClassroomId ? (
        <section className="animate-slide-up mb-6 space-y-4" style={{ animationDelay: '100ms' }}>
          <TodaySchedule
            classroomId={quickClassroomId}
            classroomName={quickClassroom?.name || ''}
          />
          <AttendanceCalendar
            classroomId={quickClassroomId}
            classroomName={quickClassroom?.name || ''}
          />
        </section>
      ) : null}

      {/* ─── 4. งานที่ทำบ่อย (Quick Actions) — Shortcut ของห้องล่าสุด ─── */}
      {quickClassroomId ? (
        <section className="animate-slide-up mb-8" style={{ animationDelay: '140ms' }}>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text)] md:text-2xl">งานที่ทำบ่อย</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                ไปยัง <span className="font-semibold text-[var(--primary)]">{quickClassroom?.name || '—'}</span>
                {lastClassroomId && quickClassroomId === lastClassroomId ? ' (ห้องล่าสุดที่เปิด)' : ''}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              href={`/attendance?classroom=${quickClassroomId}`}
              icon={ClipboardCheck}
              title="เช็คชื่อวันนี้"
              desc="มา ขาด ลา รายวัน"
              color="#2563eb"
            />
            <QuickAction
              href={`/grades?classroom=${quickClassroomId}`}
              icon={FileBarChart}
              title="กรอกคะแนน"
              desc="กลางภาค / ปลายภาค"
              color="#16a34a"
            />
            <QuickAction
              href={`/health?classroom=${quickClassroomId}`}
              icon={Activity}
              title="สุขภาพ"
              desc="น้ำหนัก ส่วนสูง แปรงฟัน"
              color="#ea580c"
            />
            <QuickAction
              href={`/export-excel?classroom=${quickClassroomId}`}
              icon={Download}
              title="ส่งออกข้อมูล"
              desc="พิมพ์เป็น Excel หรือ PDF"
              color="#7c3aed"
            />
          </div>
        </section>
      ) : null}

      {/* ─── 5. Backup status (footer notice) ─── */}
      <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
        <BackupStatusCard />
      </section>

      <CreateClassroomModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadClassrooms}
        editingClassroom={editingClassroom}
      />

      <DuplicateClassroomModal
        isOpen={!!duplicateSource}
        onClose={() => setDuplicateSource(null)}
        onSuccess={loadClassrooms}
        source={duplicateSource}
      />
    </div>
  )
}
