/**
 * สี status สำหรับการเช็คชื่อ (attendance)
 * ใช้ทดแทน STATUS_STYLES ที่กระจายอยู่ในหลายหน้า
 */
export const ATTENDANCE_STATUS = {
  present: {
    label: 'มา',
    color: 'var(--success)',
    bg: 'var(--success-soft)',
    text: 'var(--success-strong)',
  },
  absent: {
    label: 'ขาด',
    color: 'var(--danger)',
    bg: 'var(--danger-soft)',
    text: 'var(--danger-strong)',
  },
  sick: {
    label: 'ลาป่วย',
    color: 'var(--warning)',
    bg: 'var(--warning-soft)',
    text: 'var(--warning-strong)',
  },
  personal: {
    label: 'ลากิจ',
    color: 'var(--info)',
    bg: 'var(--info-soft)',
    text: 'var(--info)',
  },
} as const

// key สำหรับ lookup สี (present/absent/sick/personal) — คนละอย่างกับค่าสถานะที่เก็บใน DB
// ซึ่งเป็นภาษาไทย ('มา'|'ขาด'|...) อยู่ใน type AttendanceStatus ที่ @/types
export type AttendanceStatusKey = keyof typeof ATTENDANCE_STATUS

/**
 * Tone presets สำหรับ Card / Stat / Pill — ให้ทุกหน้าใช้ตัวเดียวกัน
 */
export const TONE = {
  brand:  { bg: 'var(--primary-ghost)', text: 'var(--primary-strong)', accent: 'var(--primary)' },
  accent: { bg: 'var(--accent-soft)',   text: 'var(--accent-strong)',  accent: 'var(--accent)' },
  ok:     { bg: 'var(--success-soft)',  text: 'var(--success-strong)', accent: 'var(--success)' },
  warn:   { bg: 'var(--warning-soft)',  text: 'var(--warning-strong)', accent: 'var(--warning)' },
  danger: { bg: 'var(--danger-soft)',   text: 'var(--danger-strong)',  accent: 'var(--danger)' },
  info:   { bg: 'var(--info-soft)',     text: 'var(--info)',            accent: 'var(--info)' },
  muted:  { bg: 'var(--surface-muted)', text: 'var(--muted)',           accent: 'var(--muted)' },
} as const

export type Tone = keyof typeof TONE
