'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  Copy,
  Eraser,
  FileText,
  Filter,
  Paintbrush,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { Classroom } from '@/types/index'
import { getClassrooms } from '@/lib/client-data'
import ScheduleHoursCounter from '@/components/ScheduleHoursCounter'
import ScheduleTemplateDialog from '@/components/ScheduleTemplateDialog'
import ScheduleClashPanel, { Clash } from '@/components/ScheduleClashPanel'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import UndoToast from '@/components/Toast'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import {
  TEMPLATE_SUBJECT_NAMES,
  detectScheduleClashes,
  generateMultiClassroomSchedules,
} from '@/lib/schedule-templates'

const loadThaiFont = () => import('@/lib/thai-font').then((m) => m.NotoSansThai)

// ─── Constants ───────────────────────────────────────────────
const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']
const PERIODS = [1, 2, 3, 4, 5, 6]
const PERIOD_TIMES = [
  '08.30-09.30',
  '09.30-10.30',
  '10.30-11.10',
  '12.20-13.20',
  '13.20-14.20',
  '14.20-15.20',
]
const LUNCH_TIME = '11.10-12.20'

const SUBJECTS = [
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

// Fixed activities (auto-filled, non-editable)
const FIXED_SLOTS: Record<string, { code: string; name: string }> = {
  '3-6': { code: 'SCOUT', name: 'ลูกเสือ' },
  '4-6': { code: 'CLUB', name: 'ชุมนุม' },
  '5-6': { code: 'PRAY', name: 'สวดมนต์' },
}

interface Slot {
  subject_code: string
  subject_name: string
  class_level: string
  room: string
}

type ScheduleMap = Record<string, Slot>
type AllSchedules = Record<number, ScheduleMap>

// ขอบเขตตรวจคาบซ้ำ: ระดับชั้นเดียวกัน / เลือกเอง
type ClashScope = 'grade' | 'custom'

function getSubjectColor(code: string): string {
  return SUBJECTS.find((s) => s.code === code)?.color || '#64748B'
}

// ดึงเลขชั้น (1-6) จาก level เช่น "ป.1", "ป 2", "ประถม 3"
function parseGradeNum(level: string | null | undefined): number | null {
  if (!level) return null
  const m1 = level.match(/ป\.?\s*(\d+)/)
  if (m1) return Number(m1[1])
  const m2 = level.match(/ประถม\s*(\d+)/)
  if (m2) return Number(m2[1])
  const m3 = level.match(/p\.?\s*(\d+)/i)
  if (m3) return Number(m3[1])
  return null
}

function isInScope(
  classroom: Classroom,
  scope: ClashScope,
  custom: Set<number>,
  grade: number | null,
): boolean {
  if (scope === 'grade') {
    if (grade == null) return false
    return parseGradeNum(classroom.level) === grade
  }
  if (scope === 'custom') return custom.has(classroom.id)
  return false
}

// ─── Component ───────────────────────────────────────────────
function SchedulePageContent() {
  const searchParams = useSearchParams()
  const urlClassroomId = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [allSchedules, setAllSchedules] = useState<AllSchedules>({})
  const [selectedId, setSelectedId] = useState<number | null>(
    urlClassroomId ? Number(urlClassroomId) : null
  )
  const [activePaint, setActivePaint] = useState<(typeof SUBJECTS)[number] | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [editingSlot, setEditingSlot] = useState<{ day: number; period: number } | null>(null)
  const [editForm, setEditForm] = useState<Slot>({ subject_code: '', subject_name: '', class_level: '', room: '' })
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)

  // ── Undo สำหรับลบช่อง / ล้างทั้งห้อง ──
  // เก็บ snapshot ของช่องล่าสุดที่ถูกลบ — กด "กู้คืน" ใน toast / Ctrl+Z จะ restore
  interface UndoEntry {
    type: 'cell' | 'clearRoom'
    classroomId: number
    // cell: data ของ cell เดิม
    cellKey?: string
    prevSlot?: Slot
    // clearRoom: ทั้งห้อง
    prevSchedule?: ScheduleMap
  }
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)

  // ── ขอบเขตตรวจคาบซ้ำ ──
  const [clashScope, setClashScope] = useState<ClashScope>('grade')
  const [customScope, setCustomScope] = useState<Set<number>>(new Set())
  const [gradeScope, setGradeScope] = useState<number | null>(null)
  const [showScopeSettings, setShowScopeSettings] = useState(false)

  const selectedClassroom = classrooms.find((c) => c.id === selectedId) || null
  const currentSchedule = selectedId ? allSchedules[selectedId] || {} : {}

  // ── Effects ──
  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId && classrooms.length > 0) {
      setSelectedId(classrooms[0].id)
    }
  }, [classrooms, selectedId])

  // Auto-set gradeScope จากห้องที่กำลังดูอยู่ — ครูไม่ต้องเลือกเอง
  useEffect(() => {
    if (clashScope !== 'grade') return
    if (gradeScope != null) return
    if (!selectedClassroom) return
    const g = parseGradeNum(selectedClassroom.level)
    if (g) setGradeScope(g)
  }, [clashScope, gradeScope, selectedClassroom])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Escape key clears paint mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePaint(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])


  // โหลดขอบเขตตรวจคาบซ้ำจาก localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const s = localStorage.getItem('clashScope')
      // legacy 'all' (และค่าอื่น) → fallback เป็น 'grade'
      if (s === 'custom' || s === 'grade') setClashScope(s)
      const raw = localStorage.getItem('clashScopeCustom')
      if (raw) {
        const ids = JSON.parse(raw) as number[]
        if (Array.isArray(ids)) setCustomScope(new Set(ids))
      }
      const g = localStorage.getItem('clashScopeGrade')
      if (g) {
        const n = Number(g)
        if (Number.isFinite(n) && n >= 1 && n <= 6) setGradeScope(n)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // บันทึกขอบเขตตรวจคาบซ้ำลง localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('clashScope', clashScope)
      localStorage.setItem('clashScopeCustom', JSON.stringify(Array.from(customScope)))
      localStorage.setItem('clashScopeGrade', gradeScope == null ? '' : String(gradeScope))
    } catch {
      /* ignore */
    }
  }, [clashScope, customScope, gradeScope])

  // ── Data fetching ──
  // ใช้ useCallback เพื่อให้ identity คงที่ ใช้เป็น retry ได้โดยไม่กลัว stale closure
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const cls = await getClassrooms()
      setClassrooms(cls)
      const results = await Promise.all(
        cls.map(async (c) => {
          const res = await fetch(`/api/schedule?classroom=${c.id}`)
          const data = await res.json()
          const map: ScheduleMap = {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((item: any) => {
            map[`${item.day_of_week}-${item.period}`] = {
              subject_code: item.subject_code || '',
              subject_name: item.subject_name || '',
              class_level: item.class_level || '',
              room: item.room || '',
            }
          })
          return [c.id, map] as const
        })
      )
      const schedules: AllSchedules = {}
      for (const [id, map] of results) schedules[id] = map
      setAllSchedules(schedules)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Auto-save ────────────────────────────────────────────
  // บันทึกเฉพาะ "ห้องที่ถูกแก้ไข" (dirty set) — ป้องกันไม่ให้การบันทึกของห้องอื่น
  // ไป wipe ข้อมูลที่ user ยังไม่ได้แตะใน session นี้
  const [dirtyClassrooms, setDirtyClassrooms] = useState<Set<number>>(new Set())

  const saveAllSchedules = useCallback(
    async (schedules: AllSchedules) => {
      if (classrooms.length === 0) return
      if (dirtyClassrooms.size === 0) return

      const ids = Array.from(dirtyClassrooms)
      const responses = await Promise.all(
        ids.map((id) =>
          fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classroom: id, schedule: schedules[id] || {} }),
          })
        )
      )
      for (const res of responses) {
        if (!res.ok) {
          throw new Error(`บันทึกไม่สำเร็จ: ${res.status}`)
        }
      }
      // เคลียร์ dirty set หลัง save สำเร็จ — รอบหน้าค่อยมาทับ
      setDirtyClassrooms(new Set())
    },
    [classrooms, dirtyClassrooms]
  )

  const { status: saveStatus, lastSavedAt, hasPendingChanges } = useAutoSave(
    allSchedules,
    saveAllSchedules,
    {
      // ตารางสอนมีข้อมูลเยอะ — รอหยุดแก้ไขสักพักก่อนบันทึก
      debounceMs: 1200,
      enabled: !loading && classrooms.length > 0,
    }
  )

  // เตือนก่อนปิดหน้า ถ้ายังมีข้อมูลรอบันทึก (หน้าต่างสั้น ~1.2 วิ ตาม debounce)
  useEffect(() => {
    if (!hasPendingChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasPendingChanges])

  // ── Cell interactions ──
  const markDirty = useCallback((id: number) => {
    setDirtyClassrooms((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const setCell = (day: number, period: number, slot: Slot | null, recordUndo = false) => {
    if (!selectedId) return
    const key = `${day}-${period}`
    const prev = (allSchedules[selectedId] || {})[key]

    // ถ้าเป็นการลบช่อง (slot === null หรือ empty) และมีของเดิม → บันทึก undo
    const isDelete = !slot || !(slot.subject_code || slot.subject_name)
    if (recordUndo && isDelete && prev) {
      setUndoEntry({
        type: 'cell',
        classroomId: selectedId,
        cellKey: key,
        prevSlot: { ...prev },
      })
    }

    setAllSchedules((current) => {
      const next = { ...(current[selectedId] || {}) }
      if (slot && (slot.subject_code || slot.subject_name)) {
        next[key] = slot
      } else {
        delete next[key]
      }
      return { ...current, [selectedId]: next }
    })
    markDirty(selectedId)
  }

  const handleCellClick = (day: number, period: number) => {
    if (!selectedId) return
    const key = `${day}-${period}`
    if (FIXED_SLOTS[key]) return

    // Paint mode: assign selected subject instantly
    if (activePaint) {
      const existing = currentSchedule[key]
      setCell(day, period, {
        subject_code: activePaint.code,
        subject_name: activePaint.name,
        class_level: selectedClassroom?.level || '',
        room: existing?.room || '',
      })
      return
    }

    // Otherwise open detail editor
    const existing = currentSchedule[key]
    setEditForm(existing ? { ...existing } : { subject_code: '', subject_name: '', class_level: '', room: '' })
    setEditingSlot({ day, period })
  }

  const handleCellRightClick = (e: React.MouseEvent, day: number, period: number) => {
    e.preventDefault()
    const key = `${day}-${period}`
    if (FIXED_SLOTS[key]) return
    setCell(day, period, null, true)
  }

  const saveEditModal = () => {
    if (!editingSlot) return
    setCell(editingSlot.day, editingSlot.period, editForm)
    setEditingSlot(null)
  }

  const deleteFromModal = () => {
    if (!editingSlot) return
    setCell(editingSlot.day, editingSlot.period, null, true)
    setEditingSlot(null)
  }

  const handleClearCurrent = () => {
    if (!selectedId) return
    // เก็บ snapshot เพื่อ undo
    const prevSchedule = { ...(allSchedules[selectedId] || {}) }
    setUndoEntry({
      type: 'clearRoom',
      classroomId: selectedId,
      prevSchedule,
    })
    setAllSchedules((prev) => ({ ...prev, [selectedId]: {} }))
    markDirty(selectedId)
    setShowConfirmClear(false)
    // ไม่ต้อง setToast — UndoToast จะแสดงพร้อมปุ่ม "กู้คืน" แทน
  }

  // คืนค่าจาก undoEntry
  const handleUndo = useCallback(() => {
    if (!undoEntry) return
    const { classroomId, type } = undoEntry
    if (type === 'cell' && undoEntry.cellKey && undoEntry.prevSlot) {
      setAllSchedules((prev) => ({
        ...prev,
        [classroomId]: {
          ...(prev[classroomId] || {}),
          [undoEntry.cellKey!]: undoEntry.prevSlot!,
        },
      }))
      markDirty(classroomId)
      setUndoEntry(null)
    } else if (type === 'clearRoom' && undoEntry.prevSchedule) {
      setAllSchedules((prev) => ({
        ...prev,
        [classroomId]: undoEntry.prevSchedule!,
      }))
      markDirty(classroomId)
      setUndoEntry(null)
    }
  }, [undoEntry, markDirty])

  // Ctrl+Z = undo (เฉพาะตอน undoEntry มีค่า + ไม่ได้พิมพ์อยู่ในช่อง input)
  useEffect(() => {
    if (!undoEntry) return
    const handler = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      if (isInputFocused) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undoEntry, handleUndo])

  const handleCopyFrom = (sourceId: number) => {
    if (!selectedId || sourceId === selectedId) return
    const source = allSchedules[sourceId] || {}
    const cloned: ScheduleMap = {}
    for (const [k, v] of Object.entries(source)) cloned[k] = { ...v }
    setAllSchedules((prev) => ({ ...prev, [selectedId]: cloned }))
    markDirty(selectedId)
    setShowCopyDialog(false)
    setToast({ type: 'success', text: 'คัดลอกตารางสำเร็จ' })
  }

  const handleApplyTemplate = (
    slots: Record<string, string>,
    targetClassroomIds: number[],
    targetHours: Record<string, number>,
    avoidClashes: boolean
  ) => {
    if (targetClassroomIds.length === 0) return

    let perClassroomSlots: Record<number, Record<string, string>> = {}

    if (targetClassroomIds.length === 1) {
      perClassroomSlots[targetClassroomIds[0]] = slots
    } else if (!avoidClashes) {
      // ทุกห้องตารางเหมือนกัน
      for (const id of targetClassroomIds) {
        perClassroomSlots[id] = slots
      }
    } else {
      // หลายห้อง + สลับ → generate ต่อห้องโดยหลบคาบที่ห้องอื่นใช้
      const inputs = targetClassroomIds.map((id) => ({ id, hours: targetHours }))
      perClassroomSlots = generateMultiClassroomSchedules(inputs)
    }

    // ตรวจ under-allocation
    const expected = Object.values(targetHours).reduce((a, b) => a + b, 0)
    const underAllocatedRooms: string[] = []
    for (const id of targetClassroomIds) {
      const actual = Object.keys(perClassroomSlots[id] || {}).length
      if (actual < expected) {
        const cls = classrooms.find((c) => c.id === id)
        underAllocatedRooms.push(`${cls?.name || `#${id}`} (${actual}/${expected})`)
      }
    }

    setAllSchedules((prev) => {
      const next = { ...prev }
      for (const classroomId of targetClassroomIds) {
        const classroom = classrooms.find((c) => c.id === classroomId)
        const newSchedule: ScheduleMap = {}
        const slotsForThisClassroom = perClassroomSlots[classroomId] || {}
        for (const [key, code] of Object.entries(slotsForThisClassroom)) {
          newSchedule[key] = {
            subject_code: code,
            subject_name: TEMPLATE_SUBJECT_NAMES[code] || code,
            class_level: classroom?.level || '',
            room: '',
          }
        }
        next[classroomId] = newSchedule
      }
      return next
    })
    // ทุกห้องที่ถูก apply template = dirty
    setDirtyClassrooms((prev) => {
      const next = new Set(prev)
      for (const id of targetClassroomIds) next.add(id)
      return next
    })

    if (underAllocatedRooms.length > 0) {
      setToast({
        type: 'error',
        text: `บางห้องใส่คาบไม่ครบ: ${underAllocatedRooms.join(', ')} — กรุณาลดจำนวนคาบรวม`,
      })
      return
    }

    const count = targetClassroomIds.length
    if (count === 1) {
      setToast({ type: 'success', text: 'สร้างตารางสอนแล้ว' })
    } else if (avoidClashes) {
      setToast({
        type: 'success',
        text: `สร้างตารางสอน ${count} ห้องแล้ว — สลับคาบให้ไม่ชนกัน`,
      })
    } else {
      setToast({ type: 'success', text: `สร้างตารางสอน ${count} ห้องแล้ว` })
    }
  }

  // ── Stats ──
  const scheduleStats = useMemo(() => {
    const filled = Object.keys(currentSchedule).length
    const totalSlots = DAYS.length * PERIODS.length
    const fixedCount = Object.keys(FIXED_SLOTS).length
    const editable = totalSlots - fixedCount
    return { filled, editable, percent: editable > 0 ? Math.round((filled / editable) * 100) : 0 }
  }, [currentSchedule])

  // คำนวณ fill % ของทุกห้อง (ใช้แสดงใน chips)
  const classroomFillMap = useMemo(() => {
    const m: Record<number, number> = {}
    const editable = DAYS.length * PERIODS.length - Object.keys(FIXED_SLOTS).length
    for (const c of classrooms) {
      const sched = allSchedules[c.id] || {}
      const filled = Object.keys(sched).length
      m[c.id] = editable > 0 ? Math.round((filled / editable) * 100) : 0
    }
    return m
  }, [classrooms, allSchedules])

  // ── Classroom ids ที่อยู่ในขอบเขตตรวจ ──
  const scopedClassroomIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of classrooms) {
      if (isInScope(c, clashScope, customScope, gradeScope)) s.add(c.id)
    }
    return s
  }, [classrooms, clashScope, customScope, gradeScope])

  // ── Schedules ที่ filter ตามขอบเขต ──
  const scopedSchedules = useMemo(() => {
    const result: AllSchedules = {}
    for (const [idStr, sched] of Object.entries(allSchedules)) {
      const id = Number(idStr)
      if (scopedClassroomIds.has(id)) result[id] = sched
    }
    return result
  }, [allSchedules, scopedClassroomIds])

  // ตรวจจับคาบซ้ำข้ามห้อง — ครู 1 คนสอน 2 ห้องในเวลาเดียวกันไม่ได้
  // *ตรวจเฉพาะห้องที่อยู่ในขอบเขต (scopedSchedules)*
  const clashes: Clash[] = useMemo(() => {
    const raw = detectScheduleClashes(scopedSchedules)
    return raw.map((c) => ({
      day: c.day,
      period: c.period,
      subjectCode: c.subjectCode,
      classroomIds: c.classroomIds,
      classroomNames: c.classroomIds.map(
        (id) => classrooms.find((cc) => cc.id === id)?.name || `#${id}`
      ),
    }))
  }, [scopedSchedules, classrooms])

  // ห้องปัจจุบันอยู่ใน scope ไหม — ใช้เตือนว่าห้องนี้ไม่ถูกตรวจ
  const currentInScope = useMemo(() => {
    if (!selectedId) return true
    return scopedClassroomIds.has(selectedId)
  }, [selectedId, scopedClassroomIds])

  // ชุดคีย์ที่ clash สำหรับห้องปัจจุบัน — ใช้ highlight cell
  const clashKeysForCurrent = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const s = new Set<string>()
    for (const c of clashes) {
      if (c.classroomIds.includes(selectedId)) {
        s.add(`${c.day}-${c.period}`)
      }
    }
    return s
  }, [clashes, selectedId])

  // ชื่อห้องอื่นที่ชนกับห้องปัจจุบันในแต่ละ cell — ใช้ใน tooltip
  const clashPeersForCurrent = useMemo(() => {
    if (!selectedId) return new Map<string, string[]>()
    const m = new Map<string, string[]>()
    for (const c of clashes) {
      if (c.classroomIds.includes(selectedId)) {
        const peers = c.classroomIds
          .filter((id) => id !== selectedId)
          .map((id) => classrooms.find((cc) => cc.id === id)?.name || `#${id}`)
        m.set(`${c.day}-${c.period}`, peers)
      }
    }
    return m
  }, [clashes, selectedId, classrooms])

  // จำนวนคาบ clash ของแต่ละห้อง — แสดงบน chip
  const clashCountMap = useMemo(() => {
    const m: Record<number, number> = {}
    for (const c of clashes) {
      for (const id of c.classroomIds) {
        m[id] = (m[id] || 0) + 1
      }
    }
    return m
  }, [clashes])

  const handleJumpToClash = (classroomId: number, _day: number, _period: number) => {
    setSelectedId(classroomId)
    setToast({ type: 'error', text: `สลับไปห้องที่ชนกัน — ตรวจเช็คคาบซ้ำ` })
  }

  // ── PDF Export ──
  const exportPDF = async () => {
    try {
      const jspdfModule = await import('jspdf')
      const jsPDF = jspdfModule.default || jspdfModule.jsPDF
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const NotoSansThai = await loadThaiFont()
      doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
      doc.setFont('NotoSansThai')

      classrooms.forEach((cls, clsIdx) => {
        if (clsIdx > 0) doc.addPage()
        const schedule = allSchedules[cls.id] || {}

        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(14)
        const title = `ตารางสอน ชั้น ${cls.name}`
        doc.text(title, 148.5, 14, { align: 'center' })

        doc.setFont('NotoSansThai', 'normal')
        const headerRow1 = ['ชั่วโมงที่', '1', '2', '3', 'พักกลางวัน', '4', '5', '6']
        const headerRow2 = ['เวลา', ...PERIOD_TIMES.slice(0, 3), LUNCH_TIME, ...PERIOD_TIMES.slice(3)]

        const bodyRows = DAYS.map((day, dayIndex) => {
          const dayNum = dayIndex + 1
          const cells: string[] = []
          PERIODS.forEach((period) => {
            const key = `${dayNum}-${period}`
            const fixed = FIXED_SLOTS[key]
            const slot = schedule[key]
            let cellText = ''
            if (fixed) cellText = fixed.name
            else if (slot) {
              const parts = [slot.subject_code, slot.subject_name].filter(Boolean)
              cellText = parts.join('\n')
            }
            cells.push(cellText)
            if (period === 3) cells.push('')
          })
          return [day, ...cells]
        })

        const lunchCells: { x: number; y: number; w: number; h: number }[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(autoTable as any)(doc, {
          head: [headerRow1, headerRow2],
          body: bodyRows,
          startY: 20,
          theme: 'grid',
          styles: {
            fontSize: 7.5,
            cellPadding: 1.5,
            font: 'NotoSansThai',
            halign: 'center',
            valign: 'middle',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
          },
          bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], minCellHeight: 22 },
          columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold' }, 4: { cellWidth: 24 } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didDrawCell: (data: any) => {
            if (data.column.index === 4 && data.section === 'body') {
              lunchCells.push({ x: data.cell.x, y: data.cell.y, w: data.cell.width, h: data.cell.height })
            }
          },
        })

        if (lunchCells.length > 0) {
          const first = lunchCells[0]
          const last = lunchCells[lunchCells.length - 1]
          const mx = first.x
          const my = first.y
          const mw = first.w
          const mh = last.y + last.h - my
          doc.setFillColor(255, 255, 255)
          doc.rect(mx + 0.15, my + 0.15, mw - 0.3, mh - 0.3, 'F')
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.3)
          doc.rect(mx, my, mw, mh, 'S')
          doc.setFont('NotoSansThai', 'bold')
          doc.setFontSize(18)
          doc.setTextColor(0, 0, 0)
          const cx = mx + mw / 2
          const cy = my + mh / 2
          const baselineOffset = 18 * 0.35 * (25.4 / 72)
          doc.text('พักกลางวัน', cx + baselineOffset + 14, cy + 10, { angle: 90, align: 'center' })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable?.finalY || 160
        const sigY = finalY + 18
        doc.setFont('NotoSansThai', 'normal')
        doc.setFontSize(10)
        doc.text('ลงชื่อ .......................................', 50, sigY, { align: 'center' })
        doc.text('ผู้สอน', 50, sigY + 6, { align: 'center' })
        doc.text('ลงชื่อ .......................................', 148.5, sigY, { align: 'center' })
        doc.text('รองฯฝ่ายวิชาการ', 148.5, sigY + 6, { align: 'center' })
        doc.text('ลงชื่อ .......................................', 247, sigY, { align: 'center' })
        doc.text('ผู้อำนวยการ', 247, sigY + 6, { align: 'center' })
      })

      doc.save(`ตารางสอน.pdf`)
      setToast({ type: 'success', text: 'ส่งออก PDF สำเร็จ' })
    } catch (e) {
      console.error('PDF export error:', e)
      setToast({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งออก PDF' })
    }
  }

  // ─── Render ───
  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-3">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับไปหน้าห้องเรียน
        </Link>
      </div>

      {/* Header — ลดทอนให้สั้น ตัด viewMode / semester / year */}
      <section className="animate-slide-up mb-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CalendarDays size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ตารางสอน</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {selectedClassroom ? (
                  <>
                    ห้อง <span className="font-semibold text-slate-700">{selectedClassroom.name}</span> — กรอกแล้ว{' '}
                    <span className="font-semibold text-[var(--primary)]">{scheduleStats.filled}</span>
                    /{scheduleStats.editable} คาบ
                  </>
                ) : (
                  'เลือกห้องด้านล่างเพื่อเริ่มจัดตาราง'
                )}
              </p>
            </div>
          </div>

          {/* สถานะคาบซ้ำ */}
          <div className="flex items-center gap-2">
            {clashes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                <AlertTriangle size={12} />
                คาบซ้ำ {clashes.length} จุด
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Classroom selector + Actions — แยกเป็น section อิสระ */}
      {classrooms.length > 0 && (
        <section
          className="animate-slide-up mb-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]"
          style={{ animationDelay: '60ms' }}
        >
          {/* ── ขอบเขตตรวจคาบซ้ำ (Clash Scope) ── */}
          <div className="mb-3 border-b border-slate-100 pb-3">
            {/* summary + toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                <Filter size={12} />
                {clashScope === 'grade'
                  ? gradeScope
                    ? `ตรวจคาบซ้ำกับห้องระดับเดียวกัน (ป.${gradeScope} · ${scopedClassroomIds.size} ห้อง)`
                    : 'ตรวจคาบซ้ำกับห้องระดับเดียวกัน'
                  : `ตรวจคาบซ้ำกับ ${scopedClassroomIds.size} ห้องที่เลือก`}
              </span>
              <button
                type="button"
                onClick={() => setShowScopeSettings((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                ตั้งค่าขั้นสูง
                <ChevronDown
                  size={12}
                  className={`transition-transform ${showScopeSettings ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* expanded controls */}
            {showScopeSettings && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-semibold text-[var(--muted)]">รูปแบบ</span>
                  <ScopeButton
                    label="ระดับชั้น"
                    active={clashScope === 'grade'}
                    onClick={() => {
                      if (gradeScope == null && selectedClassroom) {
                        const g = parseGradeNum(selectedClassroom.level)
                        if (g) setGradeScope(g)
                      }
                      setClashScope('grade')
                    }}
                  />
                  <ScopeButton
                    label="เลือกเอง"
                    active={clashScope === 'custom'}
                    onClick={() => {
                      if (clashScope !== 'custom' && customScope.size === 0 && selectedId) {
                        setCustomScope(new Set([selectedId]))
                      }
                      setClashScope('custom')
                    }}
                  />
                </div>

                {/* custom mode: checkboxes per classroom */}
                {clashScope === 'custom' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-[var(--muted)]">เลือกห้องที่จะตรวจ:</span>
                    {classrooms.map((c) => {
                      const checked = customScope.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomScope((prev) => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return next
                            })
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                            checked
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-[var(--line)] bg-white text-slate-500 hover:border-blue-200'
                          }`}
                        >
                          {checked && <Check size={10} strokeWidth={3} />}
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* grade mode: เลือกระดับชั้น 1-6 */}
                {clashScope === 'grade' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-[var(--muted)]">เลือกระดับชั้น:</span>
                    {[1, 2, 3, 4, 5, 6].map((g) => {
                      const active = gradeScope === g
                      const count = classrooms.filter((c) => parseGradeNum(c.level) === g).length
                      const disabled = count === 0
                      return (
                        <button
                          key={g}
                          type="button"
                          disabled={disabled}
                          onClick={() => setGradeScope(g)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                            active
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : disabled
                              ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : 'border-[var(--line)] bg-white text-slate-500 hover:border-blue-200'
                          }`}
                          title={disabled ? 'ไม่มีห้องในระดับนี้' : `${count} ห้อง`}
                        >
                          ป.{g}
                          <span className="text-[9px] opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <p className="mt-2 text-[10px] text-[var(--muted)]">
                  💡 default ตรวจกับห้องระดับเดียวกันอัตโนมัติ — เปลี่ยนเป็น "เลือกเอง" เฉพาะตอนที่ต้องการตรวจข้ามระดับ
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* ห้องเรียน */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-[var(--muted)]">เลือกห้อง</span>
              {classrooms.map((cls) => {
                const isSelected = selectedId === cls.id
                const pct = classroomFillMap[cls.id] || 0
                const clashCount = clashCountMap[cls.id] || 0
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedId(cls.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cls.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isSelected ? 'bg-white/20' : 'bg-white text-slate-500'
                      }`}
                    >
                      {pct}%
                    </span>
                    {clashCount > 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? 'bg-white text-red-600'
                            : 'bg-red-100 text-red-700'
                        }`}
                        title={`ชนกับห้องอื่น ${clashCount} คาบ`}
                      >
                        <AlertTriangle size={9} strokeWidth={2.5} />
                        {clashCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTemplateDialog(true)}
                disabled={!selectedId}
                title="สร้างตารางสอนอัตโนมัติจาก template"
                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              >
                <Sparkles size={14} />
                สร้างอัตโนมัติ
              </button>
              <button
                type="button"
                onClick={() => setShowCopyDialog(true)}
                disabled={!selectedId || classrooms.length < 2}
                title="คัดลอกตารางจากห้องอื่น"
                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
              >
                <Copy size={14} />
                คัดลอก
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                disabled={!selectedId}
                title="ล้างตารางห้องนี้ทั้งหมด"
                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Eraser size={14} />
                ล้าง
              </button>
              <button
                type="button"
                onClick={exportPDF}
                disabled={classrooms.length === 0}
                title="ส่งออกตารางสอนเป็น PDF"
                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
              >
                <FileText size={14} />
                PDF
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`toast-enter mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {loading ? (
        <div className="skeleton h-96 w-full rounded-[var(--radius-lg)]" />
      ) : !selectedId ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          ยังไม่มีห้องเรียน — สร้างห้องใน{' '}
          <Link href="/" className="font-semibold text-[var(--primary)] underline">
            หน้าห้องเรียน
          </Link>
        </div>
      ) : (
        <div
          className="animate-slide-up grid gap-4 lg:grid-cols-[1fr_280px]"
          style={{ animationDelay: '100ms' }}
        >
          {/* Main grid + Palette */}
          <div className="space-y-4">
            {/* Subject palette (paint mode) */}
            <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Paintbrush size={14} className="text-[var(--muted)]" />
                  <span className="text-xs font-semibold text-slate-700">โหมดระบาย</span>
                  <span className="hidden text-[11px] text-[var(--muted)] sm:inline">
                    — กดวิชา แล้วคลิกช่องที่ต้องการ
                  </span>
                </div>
                {activePaint && (
                  <button
                    type="button"
                    onClick={() => setActivePaint(null)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-slate-100"
                  >
                    <X size={12} />
                    ออก (Esc)
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECTS.map((s) => {
                  const isActive = activePaint?.code === s.code
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setActivePaint(isActive ? null : s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition ${
                        isActive ? 'shadow-md' : 'border-[var(--line)] hover:shadow-sm'
                      }`}
                      style={{
                        borderColor: isActive ? s.color : undefined,
                        backgroundColor: isActive ? `${s.color}20` : 'white',
                        color: isActive ? s.color : '#475569',
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-bold">{s.code}</span>
                      <span className="text-[10px] opacity-75">{s.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Grid */}
            <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
              <div className="overflow-x-auto">
                <div
                  className="min-w-[800px]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px repeat(3, 1fr) 48px repeat(3, 1fr)',
                    gap: 5,
                  }}
                >
                  {/* Header row — render ตาม DOM order ให้ตรงกับ body */}
                  <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--muted)]">
                    วัน / คาบ
                  </div>
                  {PERIODS.map((p, i) => {
                    const periodHeader = (
                      <div
                        key={`header-${p}`}
                        className="rounded-lg border border-[var(--line)] bg-slate-50 px-1.5 py-1.5 text-center"
                      >
                        <div className="text-xs font-bold text-slate-900">คาบ {p}</div>
                        <div className="text-[9px] text-[var(--muted)]">{PERIOD_TIMES[i]}</div>
                      </div>
                    )
                    if (p === 3) {
                      return [
                        periodHeader,
                        <div
                          key="header-lunch"
                          className="rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1.5 text-center"
                        >
                          <div className="text-[11px] font-bold text-amber-700">พัก</div>
                          <div className="text-[9px] text-amber-600">{LUNCH_TIME}</div>
                        </div>,
                      ]
                    }
                    return periodHeader
                  })}

                  {/* Day rows */}
                  {DAYS.map((day, dayIdx) => {
                    const dayNum = dayIdx + 1
                    return (
                      <Fragment key={`day-${dayNum}`}>
                        <div className="flex items-center justify-center rounded-lg border border-[var(--line)] bg-slate-100 text-sm font-bold text-slate-700">
                          {day}
                        </div>

                        {PERIODS.map((p) => {
                          const key = `${dayNum}-${p}`
                          const slot = currentSchedule[key]
                          const fixed = FIXED_SLOTS[key]
                          const isEmpty = !slot && !fixed
                          const color = slot ? getSubjectColor(slot.subject_code) : '#64748B'
                          const hasClash = clashKeysForCurrent.has(key)
                          const clashPeers = clashPeersForCurrent.get(key) || []
                          const clashTitle = hasClash
                            ? ` · ⚠ ชนกับห้อง ${clashPeers.join(', ')}`
                            : ''

                          const cellEl = fixed ? (
                            <div
                              key={`cell-${key}`}
                              className="flex min-h-[72px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-center"
                            >
                              <span className="text-xs font-bold text-slate-500">{fixed.code}</span>
                              <span className="mt-0.5 text-[11px] text-slate-500">{fixed.name}</span>
                            </div>
                          ) : isEmpty ? (
                            <button
                              type="button"
                              key={`cell-${key}`}
                              onClick={() => handleCellClick(dayNum, p)}
                              onContextMenu={(e) => handleCellRightClick(e, dayNum, p)}
                              title={activePaint ? 'คลิกเพื่อใส่วิชา' : 'คลิกเพื่อเพิ่มวิชา • คลิกขวาเพื่อลบ'}
                              className={`btn-press flex min-h-[72px] items-center justify-center rounded-lg border-2 border-dashed px-2 py-2 text-xs transition ${
                                activePaint
                                  ? 'border-[var(--primary)] bg-blue-50/50 text-blue-600 hover:bg-blue-100'
                                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--primary)] hover:bg-blue-50/50 hover:text-[var(--primary)]'
                              }`}
                            >
                              {activePaint ? `+ ${activePaint.code}` : '+ เพิ่ม'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              key={`cell-${key}`}
                              onClick={() => handleCellClick(dayNum, p)}
                              onContextMenu={(e) => handleCellRightClick(e, dayNum, p)}
                              title={slot && `${slot.subject_name}${slot.room ? ` • ห้อง ${slot.room}` : ''}${clashTitle} • คลิกเพื่อแก้ • คลิกขวาเพื่อลบ`}
                              className={`btn-press relative flex min-h-[72px] flex-col items-center justify-center rounded-lg border-2 px-1.5 py-1.5 text-center transition hover:shadow-md ${
                                hasClash ? 'ring-2 ring-red-400 ring-offset-1' : ''
                              }`}
                              style={{ borderColor: color, backgroundColor: `${color}15` }}
                            >
                              {hasClash && (
                                <span
                                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md"
                                  title={`ชนกับห้อง ${clashPeers.join(', ')}`}
                                >
                                  <AlertTriangle size={11} strokeWidth={2.5} />
                                </span>
                              )}
                              <span className="text-sm font-bold leading-tight" style={{ color }}>
                                {slot!.subject_code}
                              </span>
                              {slot!.subject_name && (
                                <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-700">
                                  {slot!.subject_name}
                                </span>
                              )}
                              {slot!.room && (
                                <span className="mt-0.5 text-[9px] text-[var(--muted)]">ห้อง {slot!.room}</span>
                              )}
                            </button>
                          )

                          if (p === 3) {
                            return [
                              cellEl,
                              <div
                                key={`lunch-${dayNum}`}
                                className="flex min-h-[72px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50"
                              >
                                <span
                                  className="text-[10px] font-bold text-amber-700"
                                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                >
                                  พักกลางวัน
                                </span>
                              </div>,
                            ]
                          }
                          return cellEl
                        })}
                      </Fragment>
                    )
                  })}
                </div>
              </div>

              {/* Tip */}
              <div className="mt-3 text-[11px] text-[var(--muted)]">
                <span className="font-semibold">ทิป:</span> คลิกเพิ่ม/แก้ไข • คลิกขวาลบ •{' '}
                กดวิชาจากแถบด้านบนเพื่อระบายเร็ว
              </div>
            </section>
          </div>

          {/* Sidebar: Clash Panel + Hours Counter */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {!currentInScope && (
              <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    ห้องนี้<span className="font-semibold">ไม่อยู่ในขอบเขตตรวจ</span> —
                    ปรับขอบเขต "ตรวจคาบซ้ำระหว่าง" ด้านบนให้ครอบคลุมห้องนี้
                  </div>
                </div>
              </div>
            )}
            <ScheduleClashPanel
              clashes={clashes}
              currentClassroomId={selectedId}
              onJumpTo={handleJumpToClash}
              scopeLabel={`เฉพาะ ${scopedClassroomIds.size} ห้อง`}
            />
            <ScheduleHoursCounter
              schedule={currentSchedule}
              level={selectedClassroom?.level}
            />
          </aside>
        </div>
      )}

      {/* Edit Modal */}
      {editingSlot && (
        <EditModal
          day={editingSlot.day}
          period={editingSlot.period}
          classroomName={selectedClassroom?.name || ''}
          form={editForm}
          setForm={setEditForm}
          onSave={saveEditModal}
          onDelete={deleteFromModal}
          onClose={() => setEditingSlot(null)}
          hasExisting={
            selectedId
              ? !!allSchedules[selectedId]?.[`${editingSlot.day}-${editingSlot.period}`]
              : false
          }
        />
      )}

      {/* Confirm Clear */}
      {showConfirmClear && (
        <ConfirmDialog
          title="ล้างตารางห้องนี้?"
          description={`ตารางสอนของ ${selectedClassroom?.name || 'ห้องนี้'} จะถูกล้างทั้งหมด — ระบบจะบันทึกการล้างนี้อัตโนมัติภายใน 1-2 วินาที`}
          confirmLabel="ล้างเลย"
          onConfirm={handleClearCurrent}
          onCancel={() => setShowConfirmClear(false)}
        />
      )}

      {/* Copy From Dialog */}
      {showCopyDialog && selectedId && (
        <CopyFromDialog
          classrooms={classrooms.filter((c) => c.id !== selectedId)}
          allSchedules={allSchedules}
          onPick={handleCopyFrom}
          onClose={() => setShowCopyDialog(false)}
        />
      )}

      {/* Template Dialog */}
      <ScheduleTemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onApply={handleApplyTemplate}
        hasExisting={Object.keys(currentSchedule).length > 0}
        classrooms={classrooms}
        currentClassroomId={selectedId}
      />

      {/* Auto-save indicator (มุมล่างขวา) */}
      <AutoSaveIndicator
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        hidden={classrooms.length === 0}
      />

      {/* Undo toast — แสดงตอน user ลบช่องคาบ หรือ ล้างห้อง */}
      <UndoToast
        open={!!undoEntry}
        message={
          undoEntry?.type === 'clearRoom'
            ? 'ล้างตารางห้องนี้แล้ว'
            : 'ลบช่องคาบแล้ว'
        }
        variant="info"
        durationMs={5000}
        action={{
          label: 'กู้คืน',
          onClick: handleUndo,
        }}
        onClose={() => setUndoEntry(null)}
      />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function EditModal({
  day,
  period,
  classroomName,
  form,
  setForm,
  onSave,
  onDelete,
  onClose,
  hasExisting,
}: {
  day: number
  period: number
  classroomName: string
  form: Slot
  setForm: (s: Slot) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  hasExisting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="animate-slide-up w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center gap-2">
          <Pencil size={18} className="text-[var(--primary)]" />
          <h3 className="text-lg font-bold text-slate-900">
            {DAYS[day - 1]}
            <span className="ml-1 font-normal text-[var(--muted)]">| คาบ {period}</span>
          </h3>
          {classroomName && (
            <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              ห้อง {classroomName}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">เลือกวิชา</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => {
                const active = form.subject_code === s.code
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setForm({ ...form, subject_code: s.code, subject_name: s.name })}
                    className={`rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition ${
                      active ? '' : 'border-[var(--line)] text-slate-600 hover:bg-slate-50'
                    }`}
                    style={{
                      borderColor: active ? s.color : undefined,
                      backgroundColor: active ? `${s.color}20` : undefined,
                      color: active ? s.color : undefined,
                    }}
                  >
                    {s.code}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              ห้องเรียน <span className="text-[var(--muted)]">(ถ้ามี)</span>
            </label>
            <input
              type="text"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="เช่น S201"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {hasExisting && (
            <button
              type="button"
              onClick={onDelete}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} />
              ลบ
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!form.subject_code}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <Save size={16} />
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="animate-slide-up w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle size={26} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press rounded-xl border border-[var(--line)] bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Check size={16} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CopyFromDialog({
  classrooms,
  allSchedules,
  onPick,
  onClose,
}: {
  classrooms: Classroom[]
  allSchedules: AllSchedules
  onPick: (id: number) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="animate-slide-up w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Copy size={18} className="text-[var(--primary)]" />
          <h3 className="text-lg font-bold text-slate-900">คัดลอกจากห้องอื่น</h3>
        </div>
        {classrooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">ไม่มีห้องอื่นให้คัดลอก</p>
        ) : (
          <div className="grid max-h-[360px] gap-2 overflow-y-auto">
            {classrooms.map((cls) => {
              const filled = Object.keys(allSchedules[cls.id] || {}).length
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onPick(cls.id)}
                  className="btn-press flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-left transition hover:border-[var(--primary)] hover:bg-blue-50/50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">ห้อง {cls.name}</div>
                    <div className="text-xs text-[var(--muted)]">{cls.level}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {filled} คาบ
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded-xl border border-[var(--line)] bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

function ScopeButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? 'bg-[var(--primary)] text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl">
          <div className="skeleton mb-4 h-6 w-40" />
          <div className="skeleton mb-6 h-48 w-full rounded-[var(--radius-lg)]" />
          <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <SchedulePageContent />
    </Suspense>
  )
}
