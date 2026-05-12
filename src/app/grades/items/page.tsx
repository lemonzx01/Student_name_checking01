'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle,
  ChevronLeft,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import CustomSelect from '@/components/CustomSelect'
import {
  Classroom,
  GRADE_ITEM_CATEGORIES,
  GradeItem,
  GradeItemCategory,
  Student,
} from '@/types/index'
import {
  createGradeItemRecord,
  deleteGradeItemRecord,
  getAllGradeItemScoresForClassroom,
  getClassrooms,
  getGradeItemsList,
  getStudents,
  saveGradeItemScoresRecord,
  updateGradeItemRecord,
} from '@/lib/client-data'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useSubjects } from '@/lib/hooks/useSubjects'
import { useDialog } from '@/lib/hooks/useConfirm'

// scores[itemId][studentId] = score | null
type ScoresMap = Record<number, Record<number, number | null>>

function GradeItemsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm, alert } = useDialog()
  const initialClassroom =
    searchParams.get('classroom') ||
    (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)

  const { subjects: SUBJECTS } = useSubjects()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    initialClassroom ? Number(initialClassroom) : null
  )
  const [subjectCode, setSubjectCode] = useState<string>('')
  const [semester, setSemester] = useState<number>(1)
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear() + 543))
  const [students, setStudents] = useState<Student[]>([])
  const [items, setItems] = useState<GradeItem[]>([])
  const [scores, setScores] = useState<ScoresMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal state
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<GradeItem | null>(null)
  const [itemName, setItemName] = useState('')
  const [fullScore, setFullScore] = useState<number>(10)
  const [weight, setWeight] = useState<number>(1)
  const [category, setCategory] = useState<GradeItemCategory>('formative')

  useEffect(() => {
    getClassrooms().then(setClassrooms).catch(console.error)
  }, [])

  // ตั้ง subject default ตอนแรก
  useEffect(() => {
    if (!subjectCode && SUBJECTS.length > 0) {
      setSubjectCode(SUBJECTS[0].code)
    }
  }, [SUBJECTS, subjectCode])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function reload() {
    if (!selectedClassroom || !subjectCode) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [studentRows, itemRows, scoreRows] = await Promise.all([
        getStudents(selectedClassroom),
        getGradeItemsList(selectedClassroom, subjectCode, semester, academicYear),
        getAllGradeItemScoresForClassroom(selectedClassroom, subjectCode, semester, academicYear),
      ])
      setStudents(studentRows)
      setItems(itemRows)
      const m: ScoresMap = {}
      for (const s of scoreRows) {
        if (!m[s.grade_item_id]) m[s.grade_item_id] = {}
        m[s.grade_item_id][s.student_id] = s.score
      }
      setScores(m)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassroom, subjectCode, semester, academicYear])

  function switchClassroom(id: number) {
    if (id === selectedClassroom) return
    localStorage.setItem('selectedClassroom', String(id))
    router.replace(`/grades/items?classroom=${id}`)
    setSelectedClassroom(id)
  }

  function updateScore(itemId: number, studentId: number, value: string) {
    const num = value === '' ? null : Number(value)
    setScores((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [studentId]: num },
    }))
  }

  // ── Modal handlers ──
  function openCreateModal() {
    setEditingItem(null)
    setItemName('')
    setFullScore(10)
    setWeight(1)
    setCategory('formative')
    setShowItemModal(true)
  }

  function openEditModal(item: GradeItem) {
    setEditingItem(item)
    setItemName(item.item_name)
    setFullScore(item.full_score)
    setWeight(item.weight)
    setCategory(item.category)
    setShowItemModal(true)
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClassroom || !subjectCode || !itemName.trim()) return
    try {
      if (editingItem) {
        const result = await updateGradeItemRecord(editingItem.id, {
          item_name: itemName.trim(),
          full_score: fullScore,
          weight,
          category,
        })
        if (!result.success) throw new Error(result.error || 'แก้ไขไม่สำเร็จ')
        setToast({ type: 'success', text: 'แก้ไขชิ้นงานสำเร็จ' })
      } else {
        const created = await createGradeItemRecord({
          classroom_id: selectedClassroom,
          subject_code: subjectCode,
          semester,
          academic_year: academicYear,
          item_name: itemName.trim(),
          full_score: fullScore,
          weight,
          category,
          display_order: items.length,
        })
        if (!created) throw new Error('สร้างไม่สำเร็จ')
        setToast({ type: 'success', text: 'เพิ่มชิ้นงานสำเร็จ' })
      }
      setShowItemModal(false)
      await reload()
    } catch (err) {
      await alert({
        title: 'บันทึกไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  async function deleteItem(item: GradeItem) {
    const ok = await confirm({
      title: `ลบชิ้นงาน "${item.item_name}"?`,
      message: 'จะลบคะแนนของชิ้นงานนี้ทั้งหมดด้วย — กู้คืนไม่ได้',
      variant: 'danger',
      confirmText: 'ลบ',
    })
    if (!ok) return
    try {
      const result = await deleteGradeItemRecord(item.id)
      if (!result.success) throw new Error(result.error || 'ลบไม่สำเร็จ')
      setToast({ type: 'success', text: 'ลบสำเร็จ' })
      await reload()
    } catch (err) {
      await alert({
        title: 'ลบไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    }
  }

  // ── Auto-save scores ──
  const saveValue = useMemo(() => scores, [scores])
  const saveFn = useCallback(
    async (m: ScoresMap) => {
      // บันทึกทีละ item — แต่รวบใน Promise.all เพื่อให้เร็ว
      const promises = items.map(async (it) => {
        const studentScores = m[it.id] || {}
        const payload = students.map((s) => ({
          student_id: s.id,
          score: studentScores[s.id] ?? null,
        }))
        await saveGradeItemScoresRecord(it.id, payload)
      })
      await Promise.all(promises)
    },
    [items, students]
  )

  const { status, lastSavedAt } = useAutoSave(saveValue, saveFn, {
    debounceMs: 800,
    enabled: !!selectedClassroom && !isLoading && items.length > 0 && students.length > 0,
  })

  // ── Computed ──
  function weightedTotal(studentId: number): { earned: number; max: number; pct: number } {
    let earnedSum = 0
    let maxSum = 0
    for (const it of items) {
      const score = scores[it.id]?.[studentId]
      const maxContribution = it.full_score * it.weight
      maxSum += maxContribution
      if (score !== null && score !== undefined) {
        const ratio = it.full_score > 0 ? score / it.full_score : 0
        earnedSum += ratio * maxContribution
      }
    }
    const pct = maxSum > 0 ? (earnedSum / maxSum) * 100 : 0
    return { earned: Math.round(earnedSum * 100) / 100, max: maxSum, pct }
  }

  function itemAverage(itemId: number): number {
    const m = scores[itemId] || {}
    const arr = students.map((s) => m[s.id]).filter((v) => v !== null && v !== undefined) as number[]
    if (arr.length === 0) return 0
    return arr.reduce((s, v) => s + v, 0) / arr.length
  }

  const yearOptions = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const list: { value: string; label: string }[] = []
    for (let y = currentBE + 1; y >= currentBE - 5; y--) {
      list.push({ value: String(y), label: String(y) })
    }
    return list
  }, [])

  const activeClassroom = classrooms.find((c) => c.id === selectedClassroom) || null
  const activeSubject = SUBJECTS.find((s) => s.code === subjectCode)

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
        <span className="text-slate-300">•</span>
        <Link
          href={`/grades?classroom=${selectedClassroom ?? ''}`}
          className="text-sm font-medium text-slate-600 hover:text-[var(--primary)]"
        >
          คะแนนรวม (เดิม)
        </Link>
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
          อยู่ที่ คะแนนเก็บ (ใหม่)
        </span>
      </div>

      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">
          <ListChecks size={13} />
          Formative Assessment
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">คะแนนเก็บระหว่างภาค</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {activeClassroom ? `ห้อง ${activeClassroom.name} • ` : ''}
              {activeSubject ? `วิชา${activeSubject.name} • ` : ''}
              ภาคเรียนที่ {semester}/{academicYear}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedClassroom || !subjectCode}
            onClick={openCreateModal}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <Plus size={16} />
            เพิ่มชิ้นงาน
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <CheckCircle size={18} />
          {toast.text}
        </div>
      )}

      {/* Controls */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
        {classrooms.length > 0 && (
          <div className="mb-4 border-b border-slate-100 pb-4">
            <label className="mb-2 block text-xs font-semibold text-slate-700">ห้องเรียน</label>
            <div className="flex flex-wrap gap-1.5">
              {classrooms.map((cls) => {
                const isSelected = selectedClassroom === cls.id
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => switchClassroom(cls.id)}
                    className={`btn-press inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cls.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">รายวิชา</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => {
                const isSelected = subjectCode === s.code
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setSubjectCode(s.code)}
                    className={`btn-press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={isSelected ? { backgroundColor: s.color } : undefined}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: isSelected ? '#ffffff80' : s.color }}
                    />
                    {s.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">ภาคเรียน</label>
            <CustomSelect
              value={semester}
              onChange={(v) => setSemester(Number(v))}
              options={[
                { value: 1, label: 'ภาคเรียนที่ 1' },
                { value: 2, label: 'ภาคเรียนที่ 2' },
              ]}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">ปีการศึกษา</label>
            <CustomSelect
              value={academicYear}
              onChange={(v) => setAcademicYear(String(v))}
              options={yearOptions}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          กรุณาเลือกห้องเรียนก่อน
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
            <ListChecks size={22} />
          </div>
          <p className="text-lg font-bold text-slate-900">ยังไม่มีชิ้นงาน</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            กดปุ่ม &quot;+ เพิ่มชิ้นงาน&quot; เพื่อเริ่มเก็บคะแนนระหว่างเรียน
          </p>
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          ไม่มีนักเรียนในห้องนี้
        </div>
      ) : (
        <div className="animate-slide-up overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={3} className="border border-slate-200 px-2 py-1 text-xs text-center w-10">
                  เลขที่
                </th>
                <th rowSpan={3} className="border border-slate-200 px-3 py-1 text-xs text-left w-44">
                  ชื่อ-สกุล
                </th>
                {items.map((it) => {
                  const cat = GRADE_ITEM_CATEGORIES.find((c) => c.value === it.category)
                  return (
                    <th
                      key={it.id}
                      className="border border-slate-200 px-1 py-1 text-[11px] font-semibold text-slate-700"
                      style={{ minWidth: 90, backgroundColor: cat ? `${cat.color}15` : undefined }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="line-clamp-2 leading-tight">{it.item_name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(it)}
                            className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-blue-600"
                            title="แก้ไข"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(it)}
                            className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-red-600"
                            title="ลบ"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </th>
                  )
                })}
                <th rowSpan={3} className="border border-slate-200 bg-amber-50 px-1 py-1 text-xs text-center text-amber-700 w-20">
                  รวม (%)
                </th>
              </tr>
              <tr className="bg-slate-50">
                {items.map((it) => (
                  <th
                    key={`fs-${it.id}`}
                    className="border border-slate-200 px-1 py-0.5 text-[10px] font-medium text-red-500"
                  >
                    เต็ม {it.full_score}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50">
                {items.map((it) => (
                  <th
                    key={`w-${it.id}`}
                    className="border border-slate-200 px-1 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    น้ำหนัก ×{it.weight}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const total = weightedTotal(s.id)
                return (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="border border-slate-200 px-2 py-1 text-center text-xs text-slate-500">
                      {i + 1}
                    </td>
                    <td className="border border-slate-200 px-3 py-1 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </td>
                    {items.map((it) => {
                      const v = scores[it.id]?.[s.id]
                      return (
                        <td key={it.id} className="border border-slate-200 px-0.5 py-0.5">
                          <input
                            type="number"
                            min="0"
                            max={it.full_score}
                            step="0.5"
                            value={v ?? ''}
                            placeholder="-"
                            onChange={(e) => updateScore(it.id, s.id, e.target.value)}
                            className="w-full rounded-md border border-[var(--line)] px-1 py-1 text-center text-xs outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-blue-100"
                          />
                        </td>
                      )
                    })}
                    <td className="border border-slate-200 bg-amber-50/30 px-1 py-1 text-center text-xs font-bold text-amber-700">
                      {total.pct > 0 ? `${total.pct.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                )
              })}

              {/* Average row */}
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={2} className="border border-slate-200 px-2 py-1.5 text-xs text-center">
                  คะแนนเฉลี่ยห้อง
                </td>
                {items.map((it) => {
                  const avg = itemAverage(it.id)
                  return (
                    <td
                      key={`avg-${it.id}`}
                      className="border border-slate-200 px-1 py-1 text-center text-xs text-slate-700"
                    >
                      {avg > 0 ? avg.toFixed(2) : '-'}
                    </td>
                  )
                })}
                <td className="border border-slate-200 bg-amber-50/40 px-1 py-1"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: เพิ่ม/แก้ไขชิ้นงาน */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setShowItemModal(false)}
          />
          <div className="modal-content relative w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingItem ? 'แก้ไขชิ้นงาน' : 'เพิ่มชิ้นงานใหม่'}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  เช่น &quot;ใบงาน 1&quot;, &quot;ทดสอบย่อย 1&quot;, &quot;การบ้าน&quot;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={saveItem} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">ชื่อชิ้นงาน</span>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">คะแนนเต็ม</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={fullScore}
                    onChange={(e) => setFullScore(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">น้ำหนัก</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">หมวดหมู่</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GradeItemCategory)}
                  className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                >
                  {GRADE_ITEM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="btn-press flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!itemName.trim()}
                  className="btn-press flex-1 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
                >
                  {editingItem ? 'บันทึก' : 'เพิ่ม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AutoSaveIndicator status={status} lastSavedAt={lastSavedAt} hidden={!selectedClassroom} />
    </div>
  )
}

export default function GradeItemsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl">
          <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <GradeItemsContent />
    </Suspense>
  )
}
