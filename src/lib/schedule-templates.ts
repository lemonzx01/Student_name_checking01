// ─── Schedule Helpers ─────────────────────────────────────────
// helper สร้างตารางสอนอัตโนมัติจากจำนวนคาบ/วิชา + ตรวจคาบซ้ำข้ามห้อง
// key format: "day-period"  (day 1=จันทร์ ... 5=ศุกร์ | period 1-6)
// FIXED_SLOTS: 3-6=ลูกเสือ, 4-6=ชุมนุม, 5-6=สวดมนต์
//
// ใช้รหัสวิชาเดียวกับ SUBJECTS ใน /app/schedule/page.tsx
//   TH, MA, EN, SC, SO, HI, HE, AR, WO

// ─── ค่าคงที่ที่ใช้ทั้งไฟล์ ───────────────────────────────────────
const CORE_SUBJECTS = new Set(['TH', 'MA', 'EN', 'SC'])
const FIXED_TEMPLATE_KEYS = new Set(['3-6', '4-6', '5-6'])

// map จาก subject_code → subject_name (ซิงค์กับ SUBJECTS ใน schedule page)
export const TEMPLATE_SUBJECT_NAMES: Record<string, string> = {
  TH: 'ภาษาไทย',
  MA: 'คณิตศาสตร์',
  EN: 'ภาษาอังกฤษ',
  SC: 'วิทยาศาสตร์',
  SO: 'สังคมศึกษา',
  HI: 'ประวัติศาสตร์',
  HE: 'สุขศึกษา/พละ',
  AR: 'ศิลปะ',
  WO: 'การงานฯ',
}

// คำนวณจำนวนคาบของแต่ละวิชา จาก schedule map
export function countSubjectHours(schedule: Record<string, { subject_code: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const slot of Object.values(schedule)) {
    if (slot.subject_code) {
      counts[slot.subject_code] = (counts[slot.subject_code] || 0) + 1
    }
  }
  return counts
}

// สร้าง slot mapping จากจำนวนคาบที่กำหนดเอง
// - วิชาหลัก (TH, MA, EN, SC) → คาบเช้า (1-3) ก่อน
// - วิชารอง (SO, HI, HE, AR, WO) → คาบบ่าย (4-6) ก่อน
// - กระจายข้ามวันจันทร์-ศุกร์ (period-major ordering)
// CORE_SUBJECTS / FIXED_TEMPLATE_KEYS ถูกประกาศไว้ด้านบนของไฟล์แล้ว

export function generateScheduleFromHours(
  counts: Record<string, number>
): Record<string, string> {
  // slot list: เช้า (period 1-3) เรียงตามวันก่อน → ข้ามวัน spread
  const morningSlots: string[] = []
  const afternoonSlots: string[] = []
  for (let period = 1; period <= 6; period++) {
    for (let day = 1; day <= 5; day++) {
      const key = `${day}-${period}`
      if (FIXED_TEMPLATE_KEYS.has(key)) continue
      if (period <= 3) morningSlots.push(key)
      else afternoonSlots.push(key)
    }
  }

  // เรียงวิชา: วิชาหลักก่อน แล้วเรียงตามจำนวนมากไปน้อย
  const sorted = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([aCode, aN], [bCode, bN]) => {
      const aCore = CORE_SUBJECTS.has(aCode) ? 0 : 1
      const bCore = CORE_SUBJECTS.has(bCode) ? 0 : 1
      if (aCore !== bCore) return aCore - bCore
      return bN - aN
    })

  const schedule: Record<string, string> = {}
  let morningIdx = 0
  let afternoonIdx = 0

  for (const [code, count] of sorted) {
    const useMorningFirst = CORE_SUBJECTS.has(code)
    const primary = useMorningFirst ? morningSlots : afternoonSlots
    const fallback = useMorningFirst ? afternoonSlots : morningSlots
    let placed = 0
    // ใส่ใน primary ก่อน
    while (placed < count) {
      const pIdx = useMorningFirst ? morningIdx : afternoonIdx
      if (pIdx < primary.length) {
        schedule[primary[pIdx]] = code
        if (useMorningFirst) morningIdx = pIdx + 1
        else afternoonIdx = pIdx + 1
        placed++
      } else break
    }
    // ถ้ายังไม่ครบ ไป fallback
    while (placed < count) {
      const fIdx = useMorningFirst ? afternoonIdx : morningIdx
      if (fIdx < fallback.length) {
        schedule[fallback[fIdx]] = code
        if (useMorningFirst) afternoonIdx = fIdx + 1
        else morningIdx = fIdx + 1
        placed++
      } else break
    }
  }

  return schedule
}

// จำนวนคาบว่างทั้งหมดในสัปดาห์ (ไม่รวม fixed slots)
export const TOTAL_AVAILABLE_SLOTS = 5 * 6 - 3 // = 27

// ─── Multi-classroom: สร้างตารางที่หลีกเลี่ยง "คาบซ้ำเดียวกัน" ────────────
//
// แนวคิด: ในโรงเรียนประถมปกติ ห้อง ป.4/1 กับ ป.4/2 มีครูประจำชั้น "คนละคน"
// ดังนั้น "คาบซ้ำ" ที่ปัญหาจริงคือ "วิชาเดียวกันที่เวลาเดียวกัน" (เพราะครู specialist อาจสอนซ้ำ)
// ไม่ใช่ "ห้องสองห้องมีคาบใน slot เดียวกัน"
//
// algorithm นี้ track per-subject slot usage:
//   subjectUsage["1-1|TH"] = จำนวนห้องที่ใช้ "ภาษาไทยที่จันทร์ คาบ 1"
// แต่ละห้องวางวิชา X จะหลบ slot ที่ห้องก่อนหน้าวางวิชา X ไว้แล้ว
//
// เลือก slot ตามลำดับ: subject usage ↑ → core/secondary preference → base index
export function generateScheduleAvoidingClashes(
  counts: Record<string, number>,
  /** จำนวนห้องที่ใช้ slot นั้นแล้ว (ใช้ตอน fallback, ไม่ใช่ตัวหลัก) */
  usage: Record<string, number> = {},
  /** subjectUsage["slot|subjectCode"] = จำนวนห้องที่วางวิชา code นั้นที่ slot นั้น */
  subjectUsage: Record<string, number> = {}
): Record<string, string> {
  // สร้าง slot list (ลำดับเริ่มต้น)
  const morningSlotsBase: string[] = []
  const afternoonSlotsBase: string[] = []
  for (let period = 1; period <= 6; period++) {
    for (let day = 1; day <= 5; day++) {
      const key = `${day}-${period}`
      if (FIXED_TEMPLATE_KEYS.has(key)) continue
      if (period <= 3) morningSlotsBase.push(key)
      else afternoonSlotsBase.push(key)
    }
  }

  // เรียงวิชา: หลักก่อน แล้วตามจำนวนคาบจากมากไปน้อย
  const sorted = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([aCode, aN], [bCode, bN]) => {
      const aCore = CORE_SUBJECTS.has(aCode) ? 0 : 1
      const bCore = CORE_SUBJECTS.has(bCode) ? 0 : 1
      if (aCore !== bCore) return aCore - bCore
      return bN - aN
    })

  const schedule: Record<string, string> = {}
  // slot ที่ห้องนี้ใช้ไปแล้ว — กันวางวิชาซ้อนกันในห้องเดียวกัน
  const usedInThisRoom = new Set<string>()
  const shortfall: Record<string, number> = {}

  // ฟังก์ชันเลือก slot สำหรับวิชาหนึ่ง — เรียงตาม:
  //   1. subject usage ↑ (slot ที่วิชานี้ยังไม่ถูกใช้ในห้องอื่น มาก่อน) — กันคาบซ้ำเดียวกัน
  //   2. usage ทั่วไป ↑ (slot ที่ห้องอื่นใช้น้อย มาก่อน) — กันความหนาแน่น
  //   3. base index (ลำดับเริ่มต้น)
  function pickSlotsFor(code: string, count: number, pool: string[]): number {
    const ranked = pool
      .filter((s) => !usedInThisRoom.has(s))
      .map((s, i) => ({
        slot: s,
        subjUsage: subjectUsage[`${s}|${code}`] || 0,
        slotUsage: usage[s] || 0,
        baseIdx: i,
      }))
      .sort((a, b) => {
        if (a.subjUsage !== b.subjUsage) return a.subjUsage - b.subjUsage
        if (a.slotUsage !== b.slotUsage) return a.slotUsage - b.slotUsage
        return a.baseIdx - b.baseIdx
      })

    let placed = 0
    for (const { slot } of ranked) {
      if (placed >= count) break
      schedule[slot] = code
      usedInThisRoom.add(slot)
      placed++
    }
    return placed
  }

  for (const [code, count] of sorted) {
    const useMorningFirst = CORE_SUBJECTS.has(code)
    const primary = useMorningFirst ? morningSlotsBase : afternoonSlotsBase
    const fallback = useMorningFirst ? afternoonSlotsBase : morningSlotsBase

    const placedPrimary = pickSlotsFor(code, count, primary)
    const remaining = count - placedPrimary
    if (remaining > 0) {
      const placedFallback = pickSlotsFor(code, remaining, fallback)
      if (placedFallback < remaining) {
        shortfall[code] = remaining - placedFallback
      }
    }
  }

  if (Object.keys(shortfall).length > 0) {
    console.warn(
      '[generateScheduleAvoidingClashes] ใส่คาบไม่ครบ:',
      shortfall,
      `(slot ทั้งหมด ${TOTAL_AVAILABLE_SLOTS}, ใส่ไปแล้ว ${Object.keys(schedule).length})`
    )
  }

  return schedule
}

/**
 * สร้างตารางสำหรับหลายห้องพร้อมกัน — แต่ละห้องจัด "วิชาเดียวกัน" ให้อยู่คนละ slot
 * (ในระดับประถม ห้อง ป.4/1 กับ ป.4/2 มีครูประจำชั้นคนละคน — ครู specialist อาจสอนซ้ำ)
 *
 * รับ: classroomHours = [{ id, hours }, ...] เรียงตามลำดับที่อยากให้ generate
 * คืน: Record<classroomId, slots>
 */
export function generateMultiClassroomSchedules(
  classroomHours: Array<{ id: number; hours: Record<string, number> }>
): Record<number, Record<string, string>> {
  const result: Record<number, Record<string, string>> = {}
  const slotUsage: Record<string, number> = {}
  // subjectUsage["1-1|TH"] = จำนวนห้องที่วาง TH ที่จันทร์คาบ 1 — ใช้กันคาบซ้ำเดียวกัน
  const subjectUsage: Record<string, number> = {}

  for (const { id, hours } of classroomHours) {
    const sched = generateScheduleAvoidingClashes(hours, slotUsage, subjectUsage)
    result[id] = sched
    // อัปเดต usage ก่อนสร้างห้องถัดไป
    for (const [slot, code] of Object.entries(sched)) {
      slotUsage[slot] = (slotUsage[slot] || 0) + 1
      const key = `${slot}|${code}`
      subjectUsage[key] = (subjectUsage[key] || 0) + 1
    }
  }

  return result
}

// ตรวจจับ "คาบซ้ำเดียวกัน" — วิชาเดียวกันที่เวลาเดียวกันในหลายห้อง
// แบบนี้ ครู specialist (เช่น ครูพละ, ครูภาษาอังกฤษ) ที่สอนซ้ำหลายชั้นจะถูกตรวจจับ
// แต่ห้องสองห้องมีคนละวิชาที่เวลาเดียวกัน = ไม่ชน (ครูประจำชั้นคนละคน)
//
// คืนรายการ {day, period, subject_code, classroomIds} ที่ซ้ำ
export interface ScheduleClash {
  day: number
  period: number
  /** วิชาที่ซ้ำกัน (เช่น "TH") — undefined ในกรณี clash แบบเก่า เพื่อ backward compat */
  subjectCode?: string
  classroomIds: number[]
}

// คีย์ที่เป็นกิจกรรมกลาง (ลูกเสือ/ชุมนุม/สวดมนต์) ไม่ถือเป็นคาบสอนจริง ไม่ชน
const FIXED_KEYS = new Set(['3-6', '4-6', '5-6'])

export function detectScheduleClashes(
  allSchedules: Record<number, Record<string, { subject_code?: string }>>
): ScheduleClash[] {
  // group ตาม "slot|subject" — ตรวจ "วิชาเดียวกันที่เวลาเดียวกัน"
  const byKeySubject: Record<string, number[]> = {}

  for (const [idStr, sched] of Object.entries(allSchedules)) {
    const id = Number(idStr)
    if (!sched) continue
    for (const [key, slot] of Object.entries(sched)) {
      if (FIXED_KEYS.has(key)) continue
      const code = slot?.subject_code
      if (!code) continue
      const groupKey = `${key}|${code}`
      byKeySubject[groupKey] = byKeySubject[groupKey] || []
      byKeySubject[groupKey].push(id)
    }
  }

  const clashes: ScheduleClash[] = []
  for (const [groupKey, ids] of Object.entries(byKeySubject)) {
    if (ids.length > 1) {
      const [slotKey, code] = groupKey.split('|')
      const [dayStr, periodStr] = slotKey.split('-')
      clashes.push({
        day: Number(dayStr),
        period: Number(periodStr),
        subjectCode: code,
        classroomIds: ids,
      })
    }
  }

  // จัดเรียงตามวัน > คาบ
  clashes.sort((a, b) => (a.day - b.day) || (a.period - b.period))
  return clashes
}
