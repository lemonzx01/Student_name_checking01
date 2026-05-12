'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Award,
  CheckCircle,
  ChevronLeft,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import CustomSelect from '@/components/CustomSelect'
import {
  CHARACTER_ITEMS,
  Classroom,
  EVAL_LEVELS,
  LITERACY_ITEMS,
  Student,
  StudentEvaluation,
} from '@/types/index'
import {
  getClassrooms,
  getEvaluationsList,
  getStudents,
  saveEvaluationsRecord,
} from '@/lib/client-data'
import { useAutoSave } from '@/lib/hooks/useAutoSave'

type EvalKey = string // item_code
type StudentEvalMap = Record<number, Record<EvalKey, number>> // studentId → code → level

const ALL_ITEMS = [
  ...CHARACTER_ITEMS.map((i) => ({ ...i, category: 'character' as const })),
  ...LITERACY_ITEMS.map((i) => ({ ...i, category: 'literacy' as const })),
]

function levelStyle(level: number | undefined) {
  if (level === undefined || level === null) return { bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-200' }
  return EVAL_LEVELS[level] ?? EVAL_LEVELS[1]
}

function EvaluationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialClassroom =
    searchParams.get('classroom') ||
    (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    initialClassroom ? Number(initialClassroom) : null
  )
  const [semester, setSemester] = useState<number>(1)
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear() + 543))
  const [students, setStudents] = useState<Student[]>([])
  const [evalMap, setEvalMap] = useState<StudentEvalMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getClassrooms().then(setClassrooms).catch(console.error)
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  useEffect(() => {
    if (!selectedClassroom) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([
      getStudents(selectedClassroom),
      getEvaluationsList(selectedClassroom, semester, academicYear),
    ])
      .then(([studentRows, evalRows]) => {
        setStudents(studentRows)
        const m: StudentEvalMap = {}
        for (const e of evalRows) {
          if (!m[e.student_id]) m[e.student_id] = {}
          m[e.student_id][e.item_code] = e.level
        }
        setEvalMap(m)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [selectedClassroom, semester, academicYear])

  function switchClassroom(id: number) {
    if (id === selectedClassroom) return
    localStorage.setItem('selectedClassroom', String(id))
    router.replace(`/evaluations?classroom=${id}`)
    setSelectedClassroom(id)
  }

  function setLevel(studentId: number, code: string, level: number) {
    setEvalMap((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [code]: level },
    }))
  }

  function setAllStudents(level: number) {
    setEvalMap((prev) => {
      const next: StudentEvalMap = { ...prev }
      for (const s of students) {
        const cur = next[s.id] ? { ...next[s.id] } : {}
        for (const item of ALL_ITEMS) {
          cur[item.code] = level
        }
        next[s.id] = cur
      }
      return next
    })
    setToast({ type: 'success', text: `ตั้งทั้งห้องเป็น "${EVAL_LEVELS[level].label}" — กำลังบันทึก` })
  }

  // ── Auto-save ──
  const saveValue = useMemo(() => evalMap, [evalMap])

  const saveFn = useCallback(
    async (m: StudentEvalMap) => {
      if (!selectedClassroom) return
      const evaluations: StudentEvaluation[] = []
      for (const [sid, codes] of Object.entries(m)) {
        for (const [code, level] of Object.entries(codes)) {
          if (level === undefined || level === null) continue
          const meta = ALL_ITEMS.find((i) => i.code === code)
          if (!meta) continue
          evaluations.push({
            student_id: Number(sid),
            classroom_id: selectedClassroom,
            semester,
            academic_year: academicYear,
            category: meta.category,
            item_code: code,
            level,
          })
        }
      }
      const result = await saveEvaluationsRecord(
        selectedClassroom,
        semester,
        academicYear,
        evaluations
      )
      if (!result.success) {
        throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      }
    },
    [selectedClassroom, semester, academicYear]
  )

  const { status, lastSavedAt } = useAutoSave(saveValue, saveFn, {
    debounceMs: 600,
    enabled: !!selectedClassroom && !isLoading && students.length > 0,
  })

  // Year dropdown
  const yearOptions = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const list: { value: string; label: string }[] = []
    for (let y = currentBE + 1; y >= currentBE - 5; y--) {
      list.push({ value: String(y), label: String(y) })
    }
    return list
  }, [])

  async function exportToExcel() {
    if (students.length === 0) return
    try {
      const xlsxMod = await import('xlsx')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = (xlsxMod as any).default || xlsxMod
      const headers = ['เลขที่', 'ชื่อ-สกุล', ...ALL_ITEMS.map((i) => i.name)]
      const rows = students.map((s, i) => {
        const evals = evalMap[s.id] || {}
        return [
          i + 1,
          [s.title, s.first_name, s.last_name].filter(Boolean).join(' '),
          ...ALL_ITEMS.map((it) => {
            const lv = evals[it.code]
            return lv === undefined ? '-' : EVAL_LEVELS[lv].label
          }),
        ]
      })
      const title = [`แบบประเมินคุณลักษณะอันพึงประสงค์ ภาคเรียนที่ ${semester}/${academicYear}`]
      const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...rows])
      ws['!cols'] = [{ wch: 6 }, { wch: 28 }, ...ALL_ITEMS.map(() => ({ wch: 14 }))]
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'คุณลักษณะ')
      const classroomName = classrooms.find((c) => c.id === selectedClassroom)?.name || 'ห้อง'
      XLSX.writeFile(wb, `คุณลักษณะ_${classroomName}_ภาค${semester}_${academicYear}.xlsx`)
      setToast({ type: 'success', text: 'ส่งออก Excel สำเร็จ' })
    } catch (err) {
      console.error('[evaluations] export failed', err)
      setToast({ type: 'error', text: 'ส่งออกไม่สำเร็จ' })
    }
  }

  const activeClassroom = classrooms.find((c) => c.id === selectedClassroom) || null

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      <div className="mb-4">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      {/* Header */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          <Award size={13} />
          Character & Literacy Evaluation
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ประเมินคุณลักษณะ + อ่าน/คิด/เขียน</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {activeClassroom ? `ห้อง ${activeClassroom.name} • ` : ''}
              ภาคเรียนที่ {semester} / ปีการศึกษา {academicYear}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportToExcel}
              disabled={students.length === 0}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-sm)] transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              ส่งออก Excel
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
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
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">ตั้งทั้งห้องเป็น</label>
            <div className="flex flex-wrap gap-1.5">
              {EVAL_LEVELS.map((lv) => (
                <button
                  key={lv.value}
                  type="button"
                  disabled={students.length === 0}
                  onClick={() => setAllStudents(lv.value)}
                  className={`btn-press inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${lv.bg} ${lv.text} ${lv.border} hover:opacity-80`}
                >
                  <Sparkles size={11} />
                  {lv.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs">
          {EVAL_LEVELS.map((lv) => (
            <div key={lv.value} className={`rounded-full border px-2.5 py-1 ${lv.bg} ${lv.text} ${lv.border}`}>
              <span className="font-bold">{lv.value}</span> = {lv.label}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          กรุณาเลือกห้องเรียนก่อน
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
                <th rowSpan={2} className="border border-slate-200 px-2 py-1 text-xs text-center w-10">
                  เลขที่
                </th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-1 text-xs text-left w-44">
                  ชื่อ-สกุล
                </th>
                <th
                  colSpan={CHARACTER_ITEMS.length}
                  className="border border-slate-200 bg-blue-50 px-2 py-1 text-xs text-center text-blue-700"
                >
                  คุณลักษณะอันพึงประสงค์ (8 ข้อ)
                </th>
                <th
                  colSpan={LITERACY_ITEMS.length}
                  className="border border-slate-200 bg-emerald-50 px-2 py-1 text-xs text-center text-emerald-700"
                >
                  อ่าน/คิดวิเคราะห์/เขียน
                </th>
              </tr>
              <tr className="bg-slate-50">
                {CHARACTER_ITEMS.map((it) => (
                  <th
                    key={it.code}
                    className="border border-slate-200 bg-blue-50/40 px-1 py-1 text-[10px] font-medium text-slate-700"
                    style={{ minWidth: 70 }}
                  >
                    <div className="leading-tight">{it.name}</div>
                  </th>
                ))}
                {LITERACY_ITEMS.map((it) => (
                  <th
                    key={it.code}
                    className="border border-slate-200 bg-emerald-50/40 px-1 py-1 text-[10px] font-medium text-slate-700"
                    style={{ minWidth: 70 }}
                  >
                    <div className="leading-tight">{it.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="border border-slate-200 px-2 py-1 text-center text-xs text-slate-500">
                    {i + 1}
                  </td>
                  <td className="border border-slate-200 px-3 py-1 text-xs font-medium text-slate-800 whitespace-nowrap">
                    {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                  </td>
                  {ALL_ITEMS.map((it) => {
                    const lv = evalMap[s.id]?.[it.code]
                    const style = levelStyle(lv)
                    return (
                      <td
                        key={it.code}
                        className="border border-slate-200 px-0.5 py-0.5 text-center"
                      >
                        <select
                          value={lv ?? ''}
                          onChange={(e) =>
                            setLevel(s.id, it.code, Number(e.target.value))
                          }
                          className={`w-full cursor-pointer rounded-md border px-1 py-1 text-[11px] font-semibold outline-none transition ${style.bg} ${style.text} ${style.border} focus:ring-1 focus:ring-blue-200`}
                        >
                          <option value="">-</option>
                          {EVAL_LEVELS.map((lvOpt) => (
                            <option key={lvOpt.value} value={lvOpt.value}>
                              {lvOpt.value} - {lvOpt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AutoSaveIndicator status={status} lastSavedAt={lastSavedAt} hidden={!selectedClassroom} />
    </div>
  )
}

export default function EvaluationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl">
          <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <EvaluationsContent />
    </Suspense>
  )
}
