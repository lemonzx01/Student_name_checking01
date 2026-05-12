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

interface Props {
  classroomId?: number | null
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  iconBg: string
  iconColor: string
  valueTruncate?: boolean
}

function StatCard({ icon, label, value, iconBg, iconColor, valueTruncate }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
          <p
            className={`text-3xl font-bold text-[var(--text)] ${
              valueTruncate ? 'truncate' : ''
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  icon,
  iconColor,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <h3 className="section-title text-[15px]">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export default function DashboardStats({ classroomId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classroomId) {
      setStats(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getDashboardStats(classroomId)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classroomId])

  const scopedClassroomName = stats?.latestClassroom?.name ?? null

  if (!classroomId) {
    return (
      <div className="empty-state">
        <p className="text-base font-semibold text-[var(--text)]">ยังไม่ได้เลือกห้องเรียน</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          เลือกห้องเรียนที่{' '}
          <Link href="/" className="font-semibold text-[var(--primary)] underline">
            หน้าหลัก
          </Link>{' '}
          ก่อนเพื่อดูภาพรวม
        </p>
      </div>
    )
  }

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
      <div className="empty-state">
        <p className="text-sm text-[var(--muted)]">ยังโหลดสถิติไม่ได้ — ลองรีเฟรชหน้าใหม่</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header — ห้องที่กำลังดู */}
      <div className="card flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-soft)]">
        <span>กำลังดูข้อมูลของห้อง</span>
        <span className="font-semibold text-[var(--text)]">{scopedClassroomName ?? '...'}</span>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<School size={22} />}
          iconBg="var(--primary-ghost)"
          iconColor="var(--primary-strong)"
          label="ห้องเรียน"
          value={scopedClassroomName || '—'}
          valueTruncate
        />
        <StatCard
          icon={<Users size={22} />}
          iconBg="var(--success-soft)"
          iconColor="var(--success-strong)"
          label="นักเรียนในห้อง"
          value={stats.studentCount}
        />
        <StatCard
          icon={<Activity size={22} />}
          iconBg="var(--accent-soft)"
          iconColor="var(--accent-strong)"
          label="BMI ผิดปกติ"
          value={stats.bmiAbnormal.length}
        />
        <StatCard
          icon={<Award size={22} />}
          iconBg="var(--info-soft)"
          iconColor="var(--info)"
          label="เกรดเฉลี่ยห้องนี้"
          value={
            stats.latestClassroom?.avg_score
              ? Number(stats.latestClassroom.avg_score).toFixed(1)
              : '—'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top absent */}
        <SectionCard
          icon={<TrendingDown size={18} />}
          iconBg="var(--danger-soft)"
          iconColor="var(--danger-strong)"
          title="ขาดบ่อยสุด 5 อันดับ (30 วัน)"
        >
          {stats.topAbsent.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีข้อมูลขาดเรียนในช่วง 30 วันล่าสุด
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stats.topAbsent.map((s, idx) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-strong)]">
                    {idx + 1}
                  </span>
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <span className="pill pill-danger">
                    {s.absent_count} วัน
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* BMI abnormal */}
        <SectionCard
          icon={<AlertTriangle size={18} />}
          iconBg="var(--warning-soft)"
          iconColor="var(--warning-strong)"
          title="BMI ผิดปกติ"
        >
          {stats.bmiAbnormal.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
              ทุกคนมีค่า BMI อยู่ในช่วงปกติ
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {stats.bmiAbnormal.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                >
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text)]">{s.bmi}</p>
                    <p
                      className={`text-[11px] font-semibold ${
                        s.status === 'ผอม' ? 'text-[var(--info)]' : 'text-[var(--warning-strong)]'
                      }`}
                    >
                      {s.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Recent students */}
        <SectionCard
          icon={<UserPlus size={18} />}
          iconBg="var(--primary-ghost)"
          iconColor="var(--primary-strong)"
          title="นักเรียนที่เพิ่มล่าสุด"
        >
          {stats.recentStudents.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีนักเรียนในระบบ
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stats.recentStudents.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                >
                  <StudentAvatar
                    photoPath={s.photo_path}
                    name={`${s.first_name} ${s.last_name}`}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">{s.classroom_name || '-'}</p>
                  </div>
                  <Link
                    href={`/students?student=${s.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--primary)] transition hover:bg-[var(--primary-ghost)]"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Recent attendance */}
        <SectionCard
          icon={<CalendarCheck size={18} />}
          iconBg="var(--success-soft)"
          iconColor="var(--success-strong)"
          title="การเช็คชื่อล่าสุด"
        >
          {stats.recentAttendance.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
              ยังไม่มีบันทึกการเช็คชื่อ
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stats.recentAttendance.map((a, idx) => (
                <li
                  key={`${a.date}-${a.classroom_id}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock size={15} className="flex-shrink-0 text-[var(--muted-soft)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {formatThaiShortDate(a.date)}
                      </p>
                      <p className="text-[12px] text-[var(--muted)]">{a.classroom_name || '-'}</p>
                    </div>
                  </div>
                  <span className="pill pill-ok">
                    {a.count} คน
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
