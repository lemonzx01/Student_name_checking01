// วันหยุดราชการไทย + วันพระใหญ่ + วันปิดภาคเรียน
// รองรับปี 2567-2570 (2024-2027) — ข้อมูลจากประกาศสำนักนายกฯ

export interface ThaiHoliday {
  date: string // YYYY-MM-DD
  name: string
  type: 'national' | 'religious' | 'royal' | 'school' | 'observance'
}

// ─── ปีปัจจุบัน + ถัดไป ─────────────────────────────
// อัพเดทเมื่อมีประกาศใหม่

// 2025 (พ.ศ. 2568)
const HOLIDAYS_2025: ThaiHoliday[] = [
  { date: '2025-01-01', name: 'วันขึ้นปีใหม่', type: 'national' },
  { date: '2025-02-12', name: 'วันมาฆบูชา', type: 'religious' },
  { date: '2025-04-07', name: 'ชดเชยวันจักรี', type: 'royal' },
  { date: '2025-04-14', name: 'วันสงกรานต์', type: 'national' },
  { date: '2025-04-15', name: 'วันสงกรานต์', type: 'national' },
  { date: '2025-04-16', name: 'วันสงกรานต์', type: 'national' },
  { date: '2025-05-01', name: 'วันแรงงาน', type: 'national' },
  { date: '2025-05-05', name: 'ชดเชยวันฉัตรมงคล', type: 'royal' },
  { date: '2025-05-12', name: 'วันวิสาขบูชา', type: 'religious' },
  { date: '2025-06-03', name: 'วันเฉลิมพระชนมพรรษา พระราชินี', type: 'royal' },
  { date: '2025-07-10', name: 'วันอาสาฬหบูชา', type: 'religious' },
  { date: '2025-07-11', name: 'วันเข้าพรรษา', type: 'religious' },
  { date: '2025-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', type: 'royal' },
  { date: '2025-08-12', name: 'วันแม่แห่งชาติ', type: 'royal' },
  { date: '2025-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'royal' },
  { date: '2025-10-23', name: 'วันปิยมหาราช', type: 'royal' },
  { date: '2025-12-05', name: 'วันพ่อแห่งชาติ', type: 'royal' },
  { date: '2025-12-10', name: 'วันรัฐธรรมนูญ', type: 'national' },
  { date: '2025-12-31', name: 'วันสิ้นปี', type: 'national' },
]

// 2026 (พ.ศ. 2569)
const HOLIDAYS_2026: ThaiHoliday[] = [
  { date: '2026-01-01', name: 'วันขึ้นปีใหม่', type: 'national' },
  { date: '2026-01-02', name: 'หยุดชดเชย', type: 'national' },
  { date: '2026-03-03', name: 'วันมาฆบูชา', type: 'religious' },
  { date: '2026-04-06', name: 'วันจักรี', type: 'royal' },
  { date: '2026-04-13', name: 'วันสงกรานต์', type: 'national' },
  { date: '2026-04-14', name: 'วันสงกรานต์', type: 'national' },
  { date: '2026-04-15', name: 'วันสงกรานต์', type: 'national' },
  { date: '2026-05-01', name: 'วันแรงงาน', type: 'national' },
  { date: '2026-05-04', name: 'วันฉัตรมงคล', type: 'royal' },
  { date: '2026-05-31', name: 'วันวิสาขบูชา', type: 'religious' },
  { date: '2026-06-01', name: 'ชดเชยวันวิสาขบูชา', type: 'religious' },
  { date: '2026-06-03', name: 'วันเฉลิมพระชนมพรรษา พระราชินี', type: 'royal' },
  { date: '2026-07-29', name: 'วันอาสาฬหบูชา', type: 'religious' },
  { date: '2026-07-30', name: 'วันเข้าพรรษา', type: 'religious' },
  { date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', type: 'royal' },
  { date: '2026-08-12', name: 'วันแม่แห่งชาติ', type: 'royal' },
  { date: '2026-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'royal' },
  { date: '2026-10-23', name: 'วันปิยมหาราช', type: 'royal' },
  { date: '2026-12-05', name: 'วันพ่อแห่งชาติ', type: 'royal' },
  { date: '2026-12-07', name: 'ชดเชยวันพ่อแห่งชาติ', type: 'royal' },
  { date: '2026-12-10', name: 'วันรัฐธรรมนูญ', type: 'national' },
  { date: '2026-12-31', name: 'วันสิ้นปี', type: 'national' },
]

// 2027 (พ.ศ. 2570) — เผื่อไว้ (จะอัพเดทเมื่อมีประกาศ)
const HOLIDAYS_2027: ThaiHoliday[] = [
  { date: '2027-01-01', name: 'วันขึ้นปีใหม่', type: 'national' },
  { date: '2027-04-06', name: 'วันจักรี', type: 'royal' },
  { date: '2027-04-13', name: 'วันสงกรานต์', type: 'national' },
  { date: '2027-04-14', name: 'วันสงกรานต์', type: 'national' },
  { date: '2027-04-15', name: 'วันสงกรานต์', type: 'national' },
  { date: '2027-05-01', name: 'วันแรงงาน', type: 'national' },
  { date: '2027-05-04', name: 'วันฉัตรมงคล', type: 'royal' },
  { date: '2027-06-03', name: 'วันเฉลิมพระชนมพรรษา พระราชินี', type: 'royal' },
  { date: '2027-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', type: 'royal' },
  { date: '2027-08-12', name: 'วันแม่แห่งชาติ', type: 'royal' },
  { date: '2027-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'royal' },
  { date: '2027-10-23', name: 'วันปิยมหาราช', type: 'royal' },
  { date: '2027-12-05', name: 'วันพ่อแห่งชาติ', type: 'royal' },
  { date: '2027-12-10', name: 'วันรัฐธรรมนูญ', type: 'national' },
  { date: '2027-12-31', name: 'วันสิ้นปี', type: 'national' },
]

const ALL_HOLIDAYS = [...HOLIDAYS_2025, ...HOLIDAYS_2026, ...HOLIDAYS_2027]

// สร้าง map เพื่อ lookup เร็ว
const HOLIDAY_MAP: Record<string, ThaiHoliday> = {}
for (const h of ALL_HOLIDAYS) {
  HOLIDAY_MAP[h.date] = h
}

// ─── ปีที่มีข้อมูลประกาศจริง ────────────────────────
// ถ้าเกินปีนี้ จะใช้สูตร "วันหยุดตรึงวันที่" แทน (ไม่รวมวันพระ/ชดเชยที่เลื่อน)
const OFFICIAL_YEARS = new Set([2025, 2026, 2027])
export const LATEST_OFFICIAL_YEAR = 2027

// วันหยุดที่ตรึงวันที่แน่นอนทุกปี (คำนวณอัตโนมัติได้)
// * ไม่รวม: มาฆ/วิสาข/อาสาฬห/เข้าพรรษา (ใช้จันทรคติ เลื่อนทุกปี)
// * ไม่รวม: วันชดเชย (สำนักนายกฯ ประกาศรายปี)
const FIXED_HOLIDAY_RECIPE: Array<{ mmdd: string; name: string; type: ThaiHoliday['type'] }> = [
  { mmdd: '01-01', name: 'วันขึ้นปีใหม่', type: 'national' },
  { mmdd: '04-06', name: 'วันจักรี', type: 'royal' },
  { mmdd: '04-13', name: 'วันสงกรานต์', type: 'national' },
  { mmdd: '04-14', name: 'วันสงกรานต์', type: 'national' },
  { mmdd: '04-15', name: 'วันสงกรานต์', type: 'national' },
  { mmdd: '05-01', name: 'วันแรงงาน', type: 'national' },
  { mmdd: '05-04', name: 'วันฉัตรมงคล', type: 'royal' },
  { mmdd: '06-03', name: 'วันเฉลิมพระชนมพรรษา พระราชินี', type: 'royal' },
  { mmdd: '07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', type: 'royal' },
  { mmdd: '08-12', name: 'วันแม่แห่งชาติ', type: 'royal' },
  { mmdd: '10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'royal' },
  { mmdd: '10-23', name: 'วันปิยมหาราช', type: 'royal' },
  { mmdd: '12-05', name: 'วันพ่อแห่งชาติ', type: 'royal' },
  { mmdd: '12-10', name: 'วันรัฐธรรมนูญ', type: 'national' },
  { mmdd: '12-31', name: 'วันสิ้นปี', type: 'national' },
]

function generateFixedHolidaysForYear(year: number): ThaiHoliday[] {
  return FIXED_HOLIDAY_RECIPE.map((r) => ({
    date: `${year}-${r.mmdd}`,
    name: r.name,
    type: r.type,
  }))
}

/** มีข้อมูลประกาศจริงของปีนี้หรือไม่ (ใช้เตือน UI) */
export function hasOfficialHolidayData(year: number): boolean {
  return OFFICIAL_YEARS.has(year)
}

export function getHoliday(dateISO: string): ThaiHoliday | null {
  // 1) ข้อมูลประกาศจริง → ใช้เลย
  if (HOLIDAY_MAP[dateISO]) return HOLIDAY_MAP[dateISO]

  // 2) ถ้าเป็นปีที่มีข้อมูลแล้ว แปลว่าไม่ใช่วันหยุดจริง
  const year = Number(dateISO.slice(0, 4))
  if (OFFICIAL_YEARS.has(year)) return null

  // 3) ปีที่ยังไม่มีข้อมูล → ใช้สูตรวันหยุดตรึง
  const mmdd = dateISO.slice(5) // MM-DD
  const recipe = FIXED_HOLIDAY_RECIPE.find((r) => r.mmdd === mmdd)
  if (recipe) {
    return { date: dateISO, name: recipe.name, type: recipe.type }
  }
  return null
}

export function isThaiHoliday(dateISO: string): boolean {
  return getHoliday(dateISO) !== null
}

export function getHolidaysInMonth(year: number, month0: number): ThaiHoliday[] {
  // month0: 0-11 (JavaScript Month)
  const yearStr = String(year)
  const monthStr = String(month0 + 1).padStart(2, '0')
  const prefix = `${yearStr}-${monthStr}`

  if (OFFICIAL_YEARS.has(year)) {
    return ALL_HOLIDAYS.filter((h) => h.date.startsWith(prefix))
  }
  // ปียังไม่มีข้อมูล → คำนวณจากสูตรเท่าที่ได้
  return generateFixedHolidaysForYear(year).filter((h) => h.date.startsWith(prefix))
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function isSchoolDay(date: Date): boolean {
  const iso = formatDateISO(date)
  return !isWeekend(date) && !isThaiHoliday(iso)
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
