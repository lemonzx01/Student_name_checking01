// ─── Schedule Helpers ─────────────────────────────────────────
// helper สร้างตารางสอนอัตโนมัติจากจำนวนคาบ/วิชา + ตรวจคาบซ้ำข้ามห้อง
// key format: "day-period"  (day 1=จันทร์ ... 5=ศุกร์ | period 1-6)
// FIXED_SLOTS: 3-6=ลูกเสือ, 4-6=ชุมนุม, 5-6=สวดมนต์
//
// คาบคู่: วิชาเดียวอาจติดกัน 2 คาบ แต่ห้าม 3 ติด และห้ามคร่อมพักเที่ยง (3↔4)
//
// ใช้รหัสวิชาเดียวกับ SUBJECTS ใน /app/schedule/page.tsx
//   TH, MA, EN, SC, SO, HI, HE, AR, WO

import { DEFAULT_SUBJECTS } from '@/lib/constants/subjects'

// ─── ค่าคงที่ที่ใช้ทั้งไฟล์ ───────────────────────────────────────
const CORE_SUBJECTS = new Set(['TH', 'MA', 'EN', 'SC'])
const FIXED_TEMPLATE_KEYS = new Set(['3-6', '4-6', '5-6'])

// คืน true ถ้าวาง `candidate` แล้วจะทำให้เกิด 3 คาบติดของวิชาเดียวกัน (ใน pool เดียวกัน)
// — ใช้เป็น hard filter (เอาออกจาก available pool)
function wouldFormTriple(candidate: string, ownPicks: string[]): boolean {
  const [dStr, pStr] = candidate.split('-')
  const d = Number(dStr)
  const p = Number(pStr)
  const sameDayPeriods = ownPicks
    .filter((s) => Number(s.split('-')[0]) === d)
    .map((s) => Number(s.split('-')[1]))

  const samePool = (a: number, b: number) => (a <= 3 && b <= 3) || (a >= 4 && b >= 4)

  // candidate อยู่กลาง: p-1 และ p+1 อยู่แล้ว (และอยู่ pool เดียวกับ p)
  if (
    sameDayPeriods.includes(p - 1) &&
    sameDayPeriods.includes(p + 1) &&
    samePool(p, p - 1) &&
    samePool(p, p + 1)
  ) {
    return true
  }
  // candidate ขยายต่อจาก 2 ที่มีอยู่: p-2, p-1 แล้ว → (p-2, p-1, p)
  if (
    sameDayPeriods.includes(p - 1) &&
    sameDayPeriods.includes(p - 2) &&
    samePool(p, p - 1) &&
    samePool(p - 1, p - 2)
  ) {
    return true
  }
  // candidate ขยายต่อจาก 2 ที่มีอยู่: p+1, p+2 แล้ว → (p, p+1, p+2)
  if (
    sameDayPeriods.includes(p + 1) &&
    sameDayPeriods.includes(p + 2) &&
    samePool(p, p + 1) &&
    samePool(p + 1, p + 2)
  ) {
    return true
  }
  return false
}

// คืน true ถ้าวาง `candidate` แล้วจะเกิด "คาบคู่" กับ slot ที่วิชานี้ใช้ไปแล้ว
// — ไม่คำนึงถึง 3 ติด (ใช้คู่กับ wouldFormTriple ในฝั่ง caller)
// — ห้ามคู่ข้ามพักเที่ยง (period 3 ↔ 4)
function wouldFormPair(candidate: string, ownPicks: string[]): boolean {
  const [dStr, pStr] = candidate.split('-')
  const d = Number(dStr)
  const p = Number(pStr)
  const sameDayPicks = ownPicks
    .map((s) => {
      const [edStr, epStr] = s.split('-')
      return { day: Number(edStr), period: Number(epStr) }
    })
    .filter((x) => x.day === d)

  for (const ex of sameDayPicks) {
    if (Math.abs(p - ex.period) !== 1) continue
    // pool boundary: 3↔4 ข้ามพักเที่ยง → ไม่ถือเป็นคู่
    if (!((p <= 3 && ex.period <= 3) || (p >= 4 && ex.period >= 4))) continue
    return true
  }
  return false
}

// map จาก subject_code → subject_name
// derive จาก DEFAULT_SUBJECTS (single source of truth)
// — ครูแก้ชื่อวิชาผ่าน Settings (useSubjects) จะ override ใน UI อีกชั้นหนึ่ง
//   แต่ตัว template generator นี้ใช้ default mapping เพื่อให้ schedule
//   ที่ generate ออกมา fallback ไปชื่อ default ก่อน
export const TEMPLATE_SUBJECT_NAMES: Record<string, string> = DEFAULT_SUBJECTS.reduce(
  (acc, s) => {
    acc[s.code] = s.name
    return acc
  },
  {} as Record<string, string>,
)

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
// - กระจายข้ามวันจันทร์-ศุกร์ (shuffle slot pool ให้ดูสุ่มจริง ไม่เป็นบล็อก)
// - บางวิชาอาจติดกัน 2 คาบในวันเดียวกัน (คาบคู่) แต่ไม่เกิน 2 ติด และไม่คร่อมพักเที่ยง (คาบ 3↔4)
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
      if (aN !== bN) return bN - aN
      return Math.random() - 0.5
    })

  const schedule: Record<string, string> = {}
  const morningUsed = new Set<string>()
  const afternoonUsed = new Set<string>()

  for (const [code, count] of sorted) {
    const useMorningFirst = CORE_SUBJECTS.has(code)
    const primary = useMorningFirst ? morningSlots : afternoonSlots
    const primaryUsed = useMorningFirst ? morningUsed : afternoonUsed
    const fallback = useMorningFirst ? afternoonSlots : morningSlots
    const fallbackUsed = useMorningFirst ? afternoonUsed : morningUsed
    const ownPicks: string[] = []

    const pickFrom = (pool: string[], used: Set<string>): string | null => {
      const allAvailable = pool.filter((s) => !used.has(s))
      if (allAvailable.length === 0) return null
      // hard-filter slot ที่จะทำให้เกิด 3 ติด
      const safe = allAvailable.filter((s) => !wouldFormTriple(s, ownPicks))
      // ถ้าทั้ง pool ทำให้เกิด triple (case extreme) → fallback ใช้ allAvailable
      const available = safe.length > 0 ? safe : allAvailable
      const pairExtenders = available.filter((s) => wouldFormPair(s, ownPicks))
      const candidates = pairExtenders.length > 0 ? pairExtenders : available
      return candidates[Math.floor(Math.random() * candidates.length)]
    }

    let placed = 0
    while (placed < count) {
      const pick = pickFrom(primary, primaryUsed)
      if (!pick) break
      schedule[pick] = code
      primaryUsed.add(pick)
      ownPicks.push(pick)
      placed++
    }
    while (placed < count) {
      const pick = pickFrom(fallback, fallbackUsed)
      if (!pick) break
      schedule[pick] = code
      fallbackUsed.add(pick)
      ownPicks.push(pick)
      placed++
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
// เลือก slot ตามลำดับ: subject usage ↑ → slot usage ↑ → pair preference → random
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
      if (aN !== bN) return bN - aN
      return Math.random() - 0.5
    })

  const schedule: Record<string, string> = {}
  // slot ที่ห้องนี้ใช้ไปแล้ว — กันวางวิชาซ้อนกันในห้องเดียวกัน
  const usedInThisRoom = new Set<string>()
  const shortfall: Record<string, number> = {}

  // ฟังก์ชันเลือก slot สำหรับวิชาหนึ่ง — เรียงตาม:
  //   1. subject usage ↑ (slot ที่วิชานี้ยังไม่ถูกใช้ในห้องอื่น มาก่อน) — กันคาบซ้ำเดียวกัน
  //   2. usage ทั่วไป ↑ (slot ที่ห้องอื่นใช้น้อย มาก่อน) — กันความหนาแน่น
  //   3. ภายใน tier เดียวกัน ถ้ามี slot ที่ทำให้เกิด "คาบคู่" ของวิชานี้ ให้เลือกอันนั้นก่อน
  //   4. random tiebreaker
  function pickSlotsFor(code: string, count: number, pool: string[]): number {
    const ownPicks: string[] = []
    let placed = 0

    while (placed < count) {
      const allAvailable = pool.filter((s) => !usedInThisRoom.has(s))
      if (allAvailable.length === 0) break
      // hard-filter slot ที่จะทำให้เกิด 3 ติด
      const safe = allAvailable.filter((s) => !wouldFormTriple(s, ownPicks))
      const available = safe.length > 0 ? safe : allAvailable

      const scored = available.map((s) => ({
        slot: s,
        subjUsage: subjectUsage[`${s}|${code}`] || 0,
        slotUsage: usage[s] || 0,
      }))
      const minSubj = Math.min(...scored.map((r) => r.subjUsage))
      const tier1 = scored.filter((r) => r.subjUsage === minSubj)
      const minSlot = Math.min(...tier1.map((r) => r.slotUsage))
      const tier2 = tier1.filter((r) => r.slotUsage === minSlot)

      const pairExtenders = tier2.filter((r) => wouldFormPair(r.slot, ownPicks))
      const candidates = pairExtenders.length > 0 ? pairExtenders : tier2

      const pick = candidates[Math.floor(Math.random() * candidates.length)].slot
      schedule[pick] = code
      usedInThisRoom.add(pick)
      ownPicks.push(pick)
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

export function detectScheduleClashes(
  allSchedules: Record<number, Record<string, { subject_code?: string }>>
): ScheduleClash[] {
  // group ตาม "slot|subject" — ตรวจ "วิชาเดียวกันที่เวลาเดียวกัน"
  const byKeySubject: Record<string, number[]> = {}

  for (const [idStr, sched] of Object.entries(allSchedules)) {
    const id = Number(idStr)
    if (!sched) continue
    for (const [key, slot] of Object.entries(sched)) {
      if (FIXED_TEMPLATE_KEYS.has(key)) continue
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

// ─── Smart Suggestions: หาคาบว่างที่ย้ายไปได้ ─────────────────
export interface SlotSuggestion {
  day: number
  period: number
}

/**
 * แนะนำ slot ว่างที่ครูสามารถย้ายคาบนี้ไปแทนได้ โดยไม่ชนกับห้องอื่นในขอบเขต
 *
 * เงื่อนไข slot ที่จะ recommend:
 * - ไม่ใช่ FIXED_TEMPLATE_KEYS (ลูกเสือ/ชุมนุม/สวดมนต์)
 * - ห้องนี้ยังว่างอยู่ (ไม่มี subject ใส่อยู่ก่อน)
 * - วิชาเดียวกันยังไม่ถูกใช้ในห้องอื่นใน scope ณ เวลานั้น
 *
 * เรียงตามวันแล้วตามคาบ — ผลลัพธ์ deterministic อ่านง่าย
 */
export function suggestAlternativeSlots(
  classroomId: number,
  subjectCode: string,
  scopedSchedules: Record<number, Record<string, { subject_code?: string }>>,
  daysCount: number,
  periodsCount: number,
  limit = 6,
): SlotSuggestion[] {
  const mySchedule = scopedSchedules[classroomId] || {}

  const result: SlotSuggestion[] = []
  for (let day = 1; day <= daysCount; day++) {
    for (let period = 1; period <= periodsCount; period++) {
      const key = `${day}-${period}`
      if (FIXED_TEMPLATE_KEYS.has(key)) continue
      if (mySchedule[key]?.subject_code) continue

      // เช็คว่าห้องอื่นใน scope ใช้วิชานี้ที่ slot เดียวกันหรือไม่
      let occupied = false
      for (const [otherIdStr, otherSched] of Object.entries(scopedSchedules)) {
        if (Number(otherIdStr) === classroomId) continue
        if (otherSched[key]?.subject_code === subjectCode) {
          occupied = true
          break
        }
      }
      if (occupied) continue

      result.push({ day, period })
      if (result.length >= limit) return result
    }
  }

  return result
}
