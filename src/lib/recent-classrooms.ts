/**
 * MRU list ของห้องที่ครูเปิดล่าสุด — ใช้เรียงห้องบนหน้าหลัก
 * ห้องที่กดเข้าล่าสุดอยู่บนสุด เผื่อกรณีห้องเยอะจะได้หาง่าย
 */
const KEY = 'recentClassrooms'
const MAX = 50

export function markClassroomVisited(id: number): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(KEY)
    const ids: number[] = raw ? JSON.parse(raw) : []
    const next = [id, ...ids.filter((x) => x !== id)].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
    // เก็บค่าเดี่ยวไว้เผื่อ page อื่นยัง consume ของเดิม
    window.localStorage.setItem('selectedClassroom', String(id))
  } catch {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([id]))
    } catch {
      // ignore
    }
  }
}

export function getRecentClassroomIds(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) {
      const single = window.localStorage.getItem('selectedClassroom')
      return single ? [Number(single)] : []
    }
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : []
  } catch {
    return []
  }
}
