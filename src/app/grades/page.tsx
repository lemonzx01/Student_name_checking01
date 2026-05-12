'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  FileSpreadsheet,
  ListChecks,
  Pencil,
} from 'lucide-react'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import CustomSelect from '@/components/CustomSelect'
import SubjectEditModal from '@/components/SubjectEditModal'
import { Classroom, Student, calculateGrade } from '@/types/index'
import { getClassrooms } from '@/lib/client-data'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useBeforeUnloadWarning } from '@/lib/hooks/useBeforeUnloadWarning'
import { useSubjects } from '@/lib/hooks/useSubjects'

const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default || xlsx
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}

// Grade data: grades[studentId][subjectCode] = { midterm, final }
type SemGrade = { midterm: number; final: number }
type GradeMap = Record<number, Record<string, SemGrade>>

function GradesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null

  // ─── รายวิชา (custom ผ่าน localStorage) ───
  const {
    subjects: SUBJECTS,
    updateSubject,
    renameCode,
    addSubject,
    removeSubject,
    resetToDefaults,
  } = useSubjects()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]?.code ?? 'TH')
  const [sem1, setSem1] = useState<GradeMap>({})
  const [sem2, setSem2] = useState<GradeMap>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // ป้องกัน auto-save ยิงตอนที่เพิ่งโหลดข้อมูลจาก DB
  const [isLoading, setIsLoading] = useState(true)
  const [editingSubjects, setEditingSubjects] = useState(false)

  const subjectDef = SUBJECTS.find(s => s.code === selectedSubject) || SUBJECTS[0] || { code: '', name: '', color: '#64748B' }
  const activeClassroom = classrooms.find((c) => c.id === selectedClassroom) || null

  // โหลดรายชื่อห้องเรียนทั้งหมด — ใช้ทำปุ่มเลือกห้อง
  useEffect(() => {
    getClassrooms()
      .then(setClassrooms)
      .catch((err) => console.error('Failed to load classrooms:', err))
  }, [])

  // เปลี่ยนห้องเรียน → อัปเดต URL + localStorage
  function switchClassroom(id: number) {
    if (id === selectedClassroom) return
    localStorage.setItem('selectedClassroom', String(id))
    router.replace(`/grades?classroom=${id}`)
  }

  useEffect(() => {
    if (selectedClassroom) {
      reloadAll()
    } else {
      setIsLoading(false)
    }
  }, [selectedClassroom, academicYear])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function reloadAll() {
    setIsLoading(true)
    try {
      await Promise.all([loadStudents(), loadAllGrades()])
    } finally {
      setIsLoading(false)
    }
  }

  const loadStudents = async () => {
    try {
      const res = await fetch(`/api/students?classroom=${selectedClassroom}`)
      setStudents(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadAllGrades = async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/grades?classroom=${selectedClassroom}&semester=1&year=${academicYear}`),
        fetch(`/api/grades?classroom=${selectedClassroom}&semester=2&year=${academicYear}`),
      ])
      setSem1(parseGrades(await r1.json()))
      setSem2(parseGrades(await r2.json()))
    } catch (e) { console.error(e) }
  }

  function parseGrades(rows: any[]): GradeMap {
    const map: GradeMap = {}
    rows.forEach((r: any) => {
      const sid = r.student_id
      const code = r.subject_code
      if (!map[sid]) map[sid] = {}
      map[sid][code] = {
        midterm: r.midterm_score || 0,
        final: r.final_score || 0,
      }
    })
    return map
  }

  function updateGrade(sem: 1 | 2, studentId: number, subject: string, field: 'midterm' | 'final', value: number) {
    const setter = sem === 1 ? setSem1 : setSem2
    setter(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: {
          ...(prev[studentId]?.[subject] || { midterm: 0, final: 0 }),
          [field]: value,
        },
      },
    }))
  }

  function getSemGrade(sem: GradeMap, studentId: number, subject: string): SemGrade {
    return sem[studentId]?.[subject] || { midterm: 0, final: 0 }
  }

  // ─── Auto-save ────────────────────────────────────────────
  // รวม sem1 + sem2 เป็น value เดียว — เปลี่ยนเมื่อใดจะ trigger auto-save
  const gradesValue = useMemo(() => ({ sem1, sem2 }), [sem1, sem2])

  const saveGrades = useCallback(
    async ({ sem1, sem2 }: { sem1: GradeMap; sem2: GradeMap }) => {
      if (!selectedClassroom) return

      // แปลง GradeMap เป็น payload — เก็บ entry ที่ >0 เพื่อให้ API รู้ว่าต้องอัปเดต
      const buildPayload = (semData: GradeMap) => {
        const grades: Record<number, Record<string, { midterm: number; final: number }>> = {}
        for (const [sid, subjects] of Object.entries(semData)) {
          grades[Number(sid)] = {}
          for (const [code, g] of Object.entries(subjects)) {
            if (g.midterm > 0 || g.final > 0) {
              grades[Number(sid)][code] = { midterm: g.midterm, final: g.final }
            }
          }
        }
        return grades
      }

      const responses = await Promise.all([
        fetch('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classroom: selectedClassroom,
            semester: 1,
            year: academicYear,
            grades: buildPayload(sem1),
          }),
        }),
        fetch('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classroom: selectedClassroom,
            semester: 2,
            year: academicYear,
            grades: buildPayload(sem2),
          }),
        }),
      ])

      for (const res of responses) {
        if (!res.ok) {
          throw new Error(`บันทึกไม่สำเร็จ: ${res.status}`)
        }
      }
    },
    [selectedClassroom, academicYear]
  )

  const { status: saveStatus, lastSavedAt, hasPendingChanges } = useAutoSave(gradesValue, saveGrades, {
    // ครูพิมพ์ตัวเลขลงในช่อง — รอให้หยุดพิมพ์สักหน่อยก่อนบันทึก
    debounceMs: 1000,
    enabled: !!selectedClassroom && !isLoading && students.length > 0,
  })

  // เตือนก่อนปิดหน้า ถ้ายังมีคะแนนที่รอบันทึก
  useBeforeUnloadWarning(hasPendingChanges)

  // Dropdown ตัวเลือกปีการศึกษา (ปัจจุบัน ± 5 ปี)
  const yearOptions = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const list: { value: string; label: string }[] = []
    for (let y = currentBE + 1; y >= currentBE - 5; y--) {
      list.push({ value: String(y), label: String(y) })
    }
    return list
  }, [])

  // Computed values
  function semTotal(g: SemGrade) { return g.midterm + g.final }
  function grandTotal(s1: SemGrade, s2: SemGrade) { return semTotal(s1) + semTotal(s2) }

  // Column sums for summary rows
  function colSum(field: (s: Student) => number) {
    return students.reduce((sum, s) => sum + field(s), 0)
  }
  function colAvg(field: (s: Student) => number) {
    return students.length > 0 ? colSum(field) / students.length : 0
  }

  const exportToExcel = async () => {
    if (students.length === 0) return
    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        setToast({ type: 'error', text: 'ไม่สามารถโหลดโมดูล Excel' })
        return
      }

      const headers = [
        'เลขที่', 'ชื่อ-สกุล',
        'ระหว่างเรียน1', 'ปลายภาค1', 'รวม1',
        'ระหว่างเรียน2', 'ปลายภาค2', 'รวม2',
        'คะแนนรวม', 'เกรด',
      ]
      const rows = students.map((s, i) => {
        const g1 = getSemGrade(sem1, s.id, selectedSubject)
        const g2 = getSemGrade(sem2, s.id, selectedSubject)
        const t1 = semTotal(g1)
        const t2 = semTotal(g2)
        const gt = t1 + t2
        return [
          i + 1,
          `${s.title || ''} ${s.first_name} ${s.last_name}`.trim(),
          g1.midterm || '', g1.final || '', t1 || '',
          g2.midterm || '', g2.final || '', t2 || '',
          gt || '',
          gt > 0 ? calculateGrade(gt) : '',
        ]
      })

      // Summary rows
      const sumRow = ['', 'รวม',
        colSum(s => getSemGrade(sem1, s.id, selectedSubject).midterm),
        colSum(s => getSemGrade(sem1, s.id, selectedSubject).final),
        colSum(s => semTotal(getSemGrade(sem1, s.id, selectedSubject))),
        colSum(s => getSemGrade(sem2, s.id, selectedSubject).midterm),
        colSum(s => getSemGrade(sem2, s.id, selectedSubject).final),
        colSum(s => semTotal(getSemGrade(sem2, s.id, selectedSubject))),
        colSum(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject))),
        '',
      ]
      const avgRow = ['', 'เฉลี่ย',
        ...[
          colAvg(s => getSemGrade(sem1, s.id, selectedSubject).midterm),
          colAvg(s => getSemGrade(sem1, s.id, selectedSubject).final),
          colAvg(s => semTotal(getSemGrade(sem1, s.id, selectedSubject))),
          colAvg(s => getSemGrade(sem2, s.id, selectedSubject).midterm),
          colAvg(s => getSemGrade(sem2, s.id, selectedSubject).final),
          colAvg(s => semTotal(getSemGrade(sem2, s.id, selectedSubject))),
          colAvg(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject))),
        ].map(v => v.toFixed(2)),
        '',
      ]

      const titleRow = [`แบบบันทึกผลการเรียน ปีการศึกษา ${academicYear}`]
      const subjectRow = [`รายวิชา${subjectDef.name}`]
      const maxRow = ['', '', '35', '15', '50', '35', '15', '50', '100', '']

      const ws = XLSX.utils.aoa_to_sheet([titleRow, subjectRow, [], headers, maxRow, ...rows, [], sumRow, avgRow])
      ws['!cols'] = [
        { wch: 6 }, { wch: 28 },
        { wch: 12 }, { wch: 10 }, { wch: 8 },
        { wch: 12 }, { wch: 10 }, { wch: 8 },
        { wch: 10 }, { wch: 8 },
      ]
      // Merge title rows
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, subjectDef.name)
      XLSX.writeFile(wb, `บันทึกผลการเรียน_${subjectDef.name}_${academicYear}.xlsx`)
      setToast({ type: 'success', text: 'ส่งออกไฟล์สำเร็จ' })
    } catch (e) {
      console.error(e)
      setToast({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งออก' })
    }
  }

  const inputClass = 'w-full px-1 py-1 text-center text-sm border border-[var(--line)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--primary)]'

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">
          <BookOpen size={13} />
          Grade Records
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">แบบบันทึกผลการเรียน</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {activeClassroom ? `ห้อง ${activeClassroom.name} • ` : ''}
              ปีการศึกษา {academicYear} • รายวิชา {subjectDef.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/grades/items?classroom=${selectedClassroom ?? ''}`}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <ListChecks size={18} />
              คะแนนเก็บ (ใหม่)
            </Link>
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

        {/* Tab indicator */}
        <div className="mt-4 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <span className="rounded-md bg-white px-3 py-1.5 text-slate-700 shadow-sm">
            คะแนนรวม (เดิม)
          </span>
          <Link
            href={`/grades/items?classroom=${selectedClassroom ?? ''}`}
            className="rounded-md px-3 py-1.5 text-slate-500 transition hover:bg-white hover:text-slate-700"
          >
            คะแนนเก็บ
          </Link>
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
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Controls — ห้องเรียน + รายวิชา + ปีการศึกษา (ปุ่มกดทั้งหมด) */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
        {/* ── ห้องเรียน ── */}
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

        {/* ── รายวิชา + ปีการศึกษา ── */}
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">รายวิชา</label>
              <button
                type="button"
                onClick={() => setEditingSubjects(true)}
                className="btn-press inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-600"
                title="แก้ไขชื่อวิชาและสี"
              >
                <Pencil size={11} />
                แก้ไขรายวิชา
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => {
                const isSelected = selectedSubject === s.code
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setSelectedSubject(s.code)}
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
      ) : students.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          ไม่มีนักเรียนในห้องนี้
        </div>
      ) : (
        <div className="animate-slide-up rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)] overflow-x-auto" data-grades-table>
          <table className="w-full min-w-[850px] border-collapse">
            {/* Multi-row header */}
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={3} className="border border-slate-200 px-2 py-1 text-xs text-center w-10">เลขที่</th>
                <th rowSpan={3} className="border border-slate-200 px-2 py-1 text-xs text-left w-44">ชื่อ-สกุล</th>
                <th colSpan={3} className="border border-slate-200 px-2 py-1 text-xs text-center bg-blue-50 text-blue-700">คะแนนภาคเรียนที่ 1</th>
                <th colSpan={3} className="border border-slate-200 px-2 py-1 text-xs text-center bg-emerald-50 text-emerald-700">คะแนนภาคเรียนที่ 2</th>
                <th rowSpan={2} className="border border-slate-200 px-2 py-1 text-xs text-center bg-amber-50 text-amber-700 w-16">คะแนน<br/>รวม</th>
                <th rowSpan={2} className="border border-slate-200 px-2 py-1 text-xs text-center bg-violet-50 text-violet-700 w-14">เกรด</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-blue-50/50 w-20">ระหว่างเรียน</th>
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-blue-50/50 w-16">ปลายภาค</th>
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-blue-50/50 w-14">รวม</th>
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-emerald-50/50 w-20">ระหว่างเรียน</th>
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-emerald-50/50 w-16">ปลายภาค</th>
                <th className="border border-slate-200 px-1 py-1 text-[11px] text-center bg-emerald-50/50 w-14">รวม</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">35</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">15</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">50</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">35</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">15</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">50</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center text-red-500 font-bold">100</th>
                <th className="border border-slate-200 px-1 py-0.5 text-[10px] text-center"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => {
                const g1 = getSemGrade(sem1, student.id, selectedSubject)
                const g2 = getSemGrade(sem2, student.id, selectedSubject)
                const t1 = semTotal(g1)
                const t2 = semTotal(g2)
                const gt = grandTotal(g1, g2)
                const grade = gt > 0 ? calculateGrade(gt) : null

                return (
                  <tr key={student.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="border border-slate-200 px-2 py-1 text-center text-xs text-slate-500">{i + 1}</td>
                    <td className="border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {[student.title, student.first_name, student.last_name].filter(Boolean).join(' ')}
                    </td>
                    {/* Sem 1 */}
                    <td className="border border-slate-200 px-0.5 py-0.5">
                      <input type="number" min="0" max="35" value={g1.midterm || ''} placeholder="-"
                        onChange={(e) => updateGrade(1, student.id, selectedSubject, 'midterm', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-slate-200 px-0.5 py-0.5">
                      <input type="number" min="0" max="15" value={g1.final || ''} placeholder="-"
                        onChange={(e) => updateGrade(1, student.id, selectedSubject, 'final', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-slate-200 px-1 py-1 text-center text-xs font-semibold bg-blue-50/30">
                      {t1 > 0 ? t1 : '-'}
                    </td>
                    {/* Sem 2 */}
                    <td className="border border-slate-200 px-0.5 py-0.5">
                      <input type="number" min="0" max="35" value={g2.midterm || ''} placeholder="-"
                        onChange={(e) => updateGrade(2, student.id, selectedSubject, 'midterm', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-slate-200 px-0.5 py-0.5">
                      <input type="number" min="0" max="15" value={g2.final || ''} placeholder="-"
                        onChange={(e) => updateGrade(2, student.id, selectedSubject, 'final', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-slate-200 px-1 py-1 text-center text-xs font-semibold bg-emerald-50/30">
                      {t2 > 0 ? t2 : '-'}
                    </td>
                    {/* Grand total + Grade */}
                    <td className="border border-slate-200 px-1 py-1 text-center text-xs font-bold bg-amber-50/30">
                      {gt > 0 ? gt : '-'}
                    </td>
                    <td className={`border border-slate-200 px-1 py-1 text-center text-xs font-bold ${
                      grade !== null && Number(grade) >= 2 ? 'text-emerald-600' : grade !== null ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {grade ?? '-'}
                    </td>
                  </tr>
                )
              })}

              {/* Summary: รวม */}
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={2} className="border border-slate-200 px-2 py-1.5 text-xs text-center">รวม</td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colSum(s => getSemGrade(sem1, s.id, selectedSubject).midterm)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colSum(s => getSemGrade(sem1, s.id, selectedSubject).final)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colSum(s => semTotal(getSemGrade(sem1, s.id, selectedSubject)))}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colSum(s => getSemGrade(sem2, s.id, selectedSubject).midterm)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colSum(s => getSemGrade(sem2, s.id, selectedSubject).final)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colSum(s => semTotal(getSemGrade(sem2, s.id, selectedSubject)))}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-amber-700">
                  {colSum(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject)))}
                </td>
                <td className="border border-slate-200"></td>
              </tr>

              {/* Summary: เฉลี่ย */}
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={2} className="border border-slate-200 px-2 py-1.5 text-xs text-center">เฉลี่ย</td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colAvg(s => getSemGrade(sem1, s.id, selectedSubject).midterm).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colAvg(s => getSemGrade(sem1, s.id, selectedSubject).final).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-blue-700">
                  {colAvg(s => semTotal(getSemGrade(sem1, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colAvg(s => getSemGrade(sem2, s.id, selectedSubject).midterm).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colAvg(s => getSemGrade(sem2, s.id, selectedSubject).final).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-emerald-700">
                  {colAvg(s => semTotal(getSemGrade(sem2, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center text-xs text-amber-700">
                  {colAvg(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-slate-200"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Grade Scale */}
      <div className="animate-slide-up mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">เกณฑ์การคำนวณเกรด (คะแนนรวม 100)</h3>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">80-100 = 4</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">75-79 = 3.5</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">70-74 = 3</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">65-69 = 2.5</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">60-64 = 2</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">55-59 = 1.5</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">50-54 = 1</span>
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">ต่ำกว่า 50 = 0</span>
        </div>
      </div>

      {/* Subject edit modal */}
      <SubjectEditModal
        open={editingSubjects}
        subjects={SUBJECTS}
        onClose={() => setEditingSubjects(false)}
        onUpdate={updateSubject}
        onRenameCode={renameCode}
        onAdd={addSubject}
        onRemove={removeSubject}
        onReset={resetToDefaults}
      />

      {/* Auto-save indicator (มุมล่างขวา) */}
      <AutoSaveIndicator
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        hidden={!selectedClassroom}
      />
    </div>
  )
}

export default function GradesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl"><div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" /></div>}>
      <GradesPageContent />
    </Suspense>
  )
}
