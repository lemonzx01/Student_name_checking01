// ─── Grade parsing utilities ─────────────────────────────────
// อ่าน "ระดับชั้น" จากข้อมูลห้องเรียนที่ครูกรอกมาหลายรูปแบบ
//
// ข้อมูลจริงมักไม่สม่ำเสมอ เช่น
//   name: "ป.3/1", "ม.4/4", "ป 5/2", "อนุบาล 2/1"
//   level: "ประถมศึกษา" (ไม่มีเลข), "ป.3", "มัธยมศึกษาตอนต้น"
// จึงต้องลองอ่านจาก "ชื่อห้อง" ก่อน (เจาะจงกว่า) แล้วค่อย fallback ไปที่ level

export interface GradeKey {
  /** ประเภทชั้น: อ(นุบาล) | ป(ระถม) | ม(ัธยม) */
  stage: 'อ' | 'ป' | 'ม'
  /** เลขชั้น เช่น 1-6 */
  num: number
}

/** "ป.3" | "ม.4" | "อ.2" — ใช้เป็น key เปรียบเทียบ/แสดงผล */
export function gradeKeyToString(g: GradeKey): string {
  return `${g.stage}.${g.num}`
}

// อ่าน GradeKey จาก string เดียว (ชื่อห้องหรือ level)
function parseFromText(text: string | null | undefined): GradeKey | null {
  if (!text) return null
  const t = String(text).trim()

  // ป.3, ป 3, ป.3/1
  let m = t.match(/ป\.?\s*(\d)/)
  if (m) return { stage: 'ป', num: Number(m[1]) }
  // ม.4, ม 4, ม.4/4
  m = t.match(/ม\.?\s*(\d)/)
  if (m) return { stage: 'ม', num: Number(m[1]) }
  // อ.2, อนุบาล 2
  m = t.match(/อ\.?\s*(\d)/) || t.match(/อนุบาล\s*(\d)/)
  if (m) return { stage: 'อ', num: Number(m[1]) }
  // ประถมศึกษาปีที่ 3 / ประถม 3
  m = t.match(/ประถม(?:ศึกษา)?(?:ปีที่)?\s*(\d)/)
  if (m) return { stage: 'ป', num: Number(m[1]) }
  // มัธยมศึกษาปีที่ 4 / มัธยม 4
  m = t.match(/มัธยม(?:ศึกษา)?(?:ปีที่)?\s*(\d)/)
  if (m) return { stage: 'ม', num: Number(m[1]) }
  // p.3 / m.4 (อังกฤษ)
  m = t.match(/\bp\.?\s*(\d)/i)
  if (m) return { stage: 'ป', num: Number(m[1]) }
  m = t.match(/\bm\.?\s*(\d)/i)
  if (m) return { stage: 'ม', num: Number(m[1]) }

  return null
}

/**
 * อ่านระดับชั้นของห้องเรียน — ลองจากชื่อห้องก่อน (เช่น "ป.3/1") แล้วค่อยดู level
 * คืน null ถ้าเดาไม่ได้เลย
 */
export function getClassroomGrade(c: {
  name?: string | null
  level?: string | null
}): GradeKey | null {
  return parseFromText(c.name) ?? parseFromText(c.level)
}

/** ตัวช่วยแบบ string: "ป.3" หรือ null */
export function getClassroomGradeKey(c: {
  name?: string | null
  level?: string | null
}): string | null {
  const g = getClassroomGrade(c)
  return g ? gradeKeyToString(g) : null
}

/** เรียงลำดับ grade key ให้อ่านง่าย: อ. → ป. → ม. แล้วตามเลขชั้น */
export function compareGradeKeys(a: string, b: string): number {
  const order: Record<string, number> = { อ: 0, ป: 1, ม: 2 }
  const pa = a.split('.')
  const pb = b.split('.')
  const sa = order[pa[0]] ?? 9
  const sb = order[pb[0]] ?? 9
  if (sa !== sb) return sa - sb
  return Number(pa[1] || 0) - Number(pb[1] || 0)
}
