'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Award,
  CalendarCheck,
  ChevronRight,
  Clock,
  School,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react'
import { getDashboardStats, type DashboardStats as Stats } from '@/lib/client-data'
import StudentAvatar from '@/components/StudentAvatar'

function formatThaiShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]
  return `${d} ${months[m - 1]} ${y + 543}`
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDashboardStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="skeleton h-44 w-full rounded-[var(--radius-lg)]"
          />
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
        ยังโหลดสถิติไม่ได้ — ลองรีเฟรชหน้าใหม่
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] stat-blue">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <School size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">ห้องเรียนทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">{stats.classroomCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] stat-green">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">นักเรียนทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">{stats.studentCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] stat-amber">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">BMI ผิดปกติ</p>
              <p className="text-2xl font-bold text-slate-900">{stats.bmiAbnormal.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] stat-purple">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">เกรดเฉลี่ยห้องล่าสุด</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.latestClassroom?.avg_score
                  ? Number(stats.latestClassroom.avg_score).toFixed(1)
                  : '—'}
              </p>
              {stats.latestClassroom?.name && (
                <p className="text-[11px] text-[var(--muted)]">{stats.latestClassroom.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top absent */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown size={18} className="text-red-500" />
            <h3 className="text-base font-bold text-slate-900">ขาดบ่อยสุด 5 อันดับ (30 วัน)</h3>
          </div>
          {stats.topAbsent.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีข้อมูลขาดเรียนในช่วง 30 วันล่าสุด
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.topAbsent.map((s, idx) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 transition hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">
                    {idx + 1}
                  </span>
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                    {s.absent_count} วัน
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* BMI abnormal */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-base font-bold text-slate-900">BMI ผิดปกติ</h3>
          </div>
          {stats.bmiAbnormal.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">
              ทุกคนมีค่า BMI อยู่ในช่วงปกติ
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {stats.bmiAbnormal.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                >
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">{s.bmi}</p>
                    <p
                      className={`text-[10px] font-semibold ${
                        s.status === 'ผอม' ? 'text-sky-600' : 'text-amber-600'
                      }`}
                    >
                      {s.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent students */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" />
            <h3 className="text-base font-bold text-slate-900">นักเรียนที่เพิ่มล่าสุด</h3>
          </div>
          {stats.recentStudents.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีนักเรียนในระบบ
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.recentStudents.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <Link
                    href={`/students?student=${s.id}`}
                    className="text-[var(--primary)] hover:opacity-80"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent attendance */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck size={18} className="text-emerald-500" />
            <h3 className="text-base font-bold text-slate-900">การเช็คชื่อล่าสุด</h3>
          </div>
          {stats.recentAttendance.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีบันทึกการเช็คชื่อ
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.recentAttendance.map((a, idx) => (
                <li
                  key={`${a.date}-${a.classroom_id}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={14} className="text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {formatThaiShortDate(a.date)}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">{a.classroom_name || '-'}</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {a.count} คน
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
