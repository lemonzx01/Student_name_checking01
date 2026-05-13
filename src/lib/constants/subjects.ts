/**
 * Single source of truth สำหรับรายการวิชาเริ่มต้น (default subjects)
 *
 * ใช้ในที่เดียวกัน:
 * - /app/schedule/page.tsx (paint palette / edit modal)
 * - /components/TodaySchedule.tsx (subject map ตอนแสดงวันนี้)
 * - /components/ScheduleHoursCounter.tsx (เทียบจำนวนคาบกับเป้า)
 * - /lib/schedule-templates.ts (subject_name mapping ตอน generate)
 * - /lib/hooks/useSubjects.ts (default list ตอน localStorage ว่าง)
 *
 * แก้รายการนี้ที่เดียวพอ — ห้าม hardcode ซ้ำในไฟล์อื่น
 */

import type { SubjectDef } from '@/types/index'

export type { SubjectDef }

export const DEFAULT_SUBJECTS: SubjectDef[] = [
  { code: 'TH', name: 'ภาษาไทย', color: '#3B82F6' },
  { code: 'MA', name: 'คณิตศาสตร์', color: '#EF4444' },
  { code: 'EN', name: 'ภาษาอังกฤษ', color: '#8B5CF6' },
  { code: 'SC', name: 'วิทยาศาสตร์', color: '#10B981' },
  { code: 'SO', name: 'สังคมศึกษา', color: '#F59E0B' },
  { code: 'HI', name: 'ประวัติศาสตร์', color: '#D97706' },
  { code: 'HE', name: 'สุขศึกษา/พละ', color: '#EC4899' },
  { code: 'AR', name: 'ศิลปะ', color: '#06B6D4' },
  { code: 'WO', name: 'การงานฯ', color: '#84CC16' },
]

/** map code → { name, color } — ใช้ lookup เร็ว ๆ */
export const DEFAULT_SUBJECT_MAP: Record<string, { name: string; color: string }> =
  DEFAULT_SUBJECTS.reduce(
    (acc, s) => {
      acc[s.code] = { name: s.name, color: s.color }
      return acc
    },
    {} as Record<string, { name: string; color: string }>,
  )

/** หา color จาก subject code — fallback เป็นสีเทาถ้าไม่เจอ */
export function getDefaultSubjectColor(code: string): string {
  return DEFAULT_SUBJECT_MAP[code]?.color || '#64748B'
}

/** หา name จาก subject code — fallback เป็น code เองถ้าไม่เจอ */
export function getDefaultSubjectName(code: string): string {
  return DEFAULT_SUBJECT_MAP[code]?.name || code
}
