import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon?: LucideIcon
  badge?: string         // ข้อความใน pill badge ด้านบน
  title: string
  subtitle?: string
  actions?: ReactNode    // ปุ่มขวา (เช่น "เพิ่มนักเรียน")
  tone?: 'brand' | 'accent' | 'ok' | 'warn' | 'danger' | 'info'  // สี pill
}

// สีของ icon bubble ตาม tone — ใช้ token เดียวกับ pill เพื่อให้ dark mode ตามอัตโนมัติ
const TONE_BUBBLE: Record<NonNullable<PageHeaderProps['tone']>, { bg: string; fg: string }> = {
  brand: { bg: 'var(--primary-ghost)', fg: 'var(--primary)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-strong)' },
  ok: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warn: { bg: 'var(--warning-soft)', fg: 'var(--warning-strong)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger-strong)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
}

export default function PageHeader({
  icon: Icon,
  badge,
  title,
  subtitle,
  actions,
  tone = 'brand',
}: PageHeaderProps) {
  const bubble = TONE_BUBBLE[tone]

  return (
    // z-20: ให้ dropdown ในส่วน actions (ปฏิทิน/เลือกห้อง) ลอยเหนือ content ใต้ header เสมอ
    <div className="animate-slide-up hero-card relative z-20 mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-[var(--shadow-sm)]">
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {/* Icon ประจำหน้า — ให้แต่ละหน้ามีเอกลักษณ์จำง่าย */}
          {Icon && (
            <div
              className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-xs)] sm:flex"
              style={{ backgroundColor: bubble.bg, color: bubble.fg }}
            >
              <Icon size={26} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            {badge && (
              <span className={`pill pill-${tone} mb-2`}>
                {Icon && <Icon size={13} />}
                {badge}
              </span>
            )}
            <h1 className="text-2xl font-bold text-[var(--text)] sm:text-[28px]">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
