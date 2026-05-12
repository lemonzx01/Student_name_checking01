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

export default function PageHeader({
  icon: Icon,
  badge,
  title,
  subtitle,
  actions,
  tone = 'brand',
}: PageHeaderProps) {
  return (
    <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
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
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
