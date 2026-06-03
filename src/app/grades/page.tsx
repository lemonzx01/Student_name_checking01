'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  FileSpreadsheet,
  School,
} from 'lucide-react'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/PageHeader'
import { Classroom, Student, calculateGrade, getClassroomColor } from '@/types/index'
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
  const urlClassroomId = searchParams.get('classroom')
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    urlClassroomId ? Number(urlClassroomId) : null
  )
  useEffect(() => {
    if (urlClassroomId) {
      setSelectedClassroom(Number(urlClassroomId))
      return
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null
    if (stored) setSelectedClassroom(Number(stored))
  }, [urlClassroomId])

  // ─── รายวิชา (custom ผ่าน localStorage) — จัดการในหน้า /settings ───
  const { subjects: SUBJECTS } = useSubjects()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]?.code ?? 'TH')
  const [sem1, setSem1] = useState<GradeMap>({})
  const [sem2, setSem2] = useState<GradeMap>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // ป้องกัน auto-save ยิงตอนที่เพิ่งโหลดข้อมูลจาก DB
  const [isLoading, setIsLoading] = useState(true)
  // dirty flag — auto-save ส่งเฉพาะเมื่อ user แก้เอง (ไม่ใช่จาก reload)
  // กัน race: ตอน reload เปลี่ยน sem1/sem2 จาก setState — value เปลี่ยน ถ้าไม่มี dirty flag
  // จะมีโอกาส save ซ้ำด้วยข้อมูลห้องเก่าก่อน enabled flip
  const [isDirty, setIsDirty] = useState(false)

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

  // โหลด students — useCallback เพื่อให้ identity คงที่ตาม selectedClassroom
  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/students?classroom=${selectedClassroom}`)
      if (!res.ok) {
        console.error(`[grades] loadStudents failed: ${res.status}`)
        setStudents([])
        return
      }
      const data = await res.json()
      setStudents(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[grades] loadStudents error:', e)
      setStudents([])
    }
  }, [selectedClassroom])

  const loadAllGrades = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/grades?classroom=${selectedClassroom}&semester=1&year=${academicYear}`),
        fetch(`/api/grades?classroom=${selectedClassroom}&semester=2&year=${academicYear}`),
      ])
      if (!r1.ok || !r2.ok) {
        console.error(`[grades] loadAllGrades failed: sem1=${r1.status}, sem2=${r2.status}`)
        setSem1({})
        setSem2({})
        return
      }
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setSem1(parseGrades(Array.isArray(d1) ? d1 : []))
      setSem2(parseGrades(Array.isArray(d2) ? d2 : []))
    } catch (e) {
      console.error('[grades] loadAllGrades error:', e)
      setSem1({})
      setSem2({})
    }
  }, [selectedClassroom, academicYear])

  const reloadAll = useCallback(async () => {
    setIsLoading(true)
    setIsDirty(false)
    try {
      await Promise.all([loadStudents(), loadAllGrades()])
    } finally {
      setIsLoading(false)
    }
  }, [loadStudents, loadAllGrades])

  useEffect(() => {
    if (selectedClassroom) {
      reloadAll()
    } else {
      setIsLoading(false)
    }
  }, [selectedClassroom, academicYear, reloadAll])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

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
    // Clamp ตาม max ของช่อง — กันครู input garbage (เช่น พิมพ์ 163 ในช่องเต็ม 35)
    // midterm = คะแนนเก็บ /35, final = สอบ /15 → รวม sem = 50 → รวมปี = 100
    const max = field === 'midterm' ? 35 : 15
    const clamped = Math.max(0, Math.min(max, value))
    const setter = sem === 1 ? setSem1 : setSem2
    setter(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: {
          ...(prev[studentId]?.[subject] || { midterm: 0, final: 0 }),
          [field]: clamped,
        },
      },
    }))
    setIsDirty(true)
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
    enabled: !!selectedClassroom && !isLoading && students.length > 0 && isDirty,
    onSaved: () => setIsDirty(false),
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

  const inputClass = 'w-full px-1 py-1 text-center text-sm bg-transparent border border-transparent rounded-md text-[var(--text)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]'

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={BookOpen}
        badge="การเรียน"
        tone="brand"
        title="แบบบันทึกผลการเรียน"
        subtitle={`${activeClassroom ? `ห้อง ${activeClassroom.name} • ` : ''}ปีการศึกษา ${academicYear} • รายวิชา ${subjectDef.name}`}
        actions={
          <button
            type="button"
            onClick={exportToExcel}
            disabled={students.length === 0}
            className="btn btn-secondary btn-press"
          >
            <FileSpreadsheet size={18} />
            ส่งออก Excel
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]'
              : 'border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Controls — Compact toolbar: ห้อง+ปี (แถวบน) / รายวิชา (แถวล่าง) */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
        {/* ── แถว 1: ห้องเรียน (ซ้าย) + ปีการศึกษา (ขวา) ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {classrooms.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <School className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">ห้องเรียน</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {classrooms.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {classrooms.map((cls) => {
                  const isSelected = selectedClassroom === cls.id
                  const color = getClassroomColor(cls)
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => switchClassroom(cls.id)}
                      className={`btn-press inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? `${color.bg} text-white shadow-md ring-1 ring-white/40`
                          : 'border border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : color.bg}`}
                      />
                      {cls.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">ปีการศึกษา</span>
            <div className="w-[140px]">
              <CustomSelect
                value={academicYear}
                onChange={(v) => setAcademicYear(String(v))}
                options={yearOptions}
              />
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="my-4 border-t border-slate-100" />

        {/* ── แถว 2: รายวิชา ── */}
        <div>
          <div className="mb-2">
            <label className="block text-xs font-semibold text-slate-700">รายวิชา</label>
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
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="empty-state">กรุณาเลือกห้องเรียนก่อน</div>
      ) : students.length === 0 ? (
        <div className="empty-state">ไม่มีนักเรียนในห้องนี้</div>
      ) : (
        <div className="animate-slide-up card overflow-x-auto" data-grades-table>
          <table className="w-full min-w-[850px] border-collapse">
            {/* Multi-row header */}
            <thead>
              <tr className="bg-[var(--surface-soft)] text-[var(--text-soft)]">
                <th rowSpan={3} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-center w-10">เลขที่</th>
                <th rowSpan={3} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-left w-44">ชื่อ-สกุล</th>
                <th colSpan={3} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-center text-[var(--primary-strong)]">คะแนนภาคเรียนที่ 1</th>
                <th colSpan={3} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-center text-[var(--success-strong)]">คะแนนภาคเรียนที่ 2</th>
                <th rowSpan={2} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-center text-[var(--accent-strong)] w-16">คะแนน<br/>รวม</th>
                <th rowSpan={2} className="border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-center text-[var(--text)] w-14">เกรด</th>
              </tr>
              <tr className="bg-[var(--surface-soft)] text-[var(--text-soft)]">
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-20">ระหว่างเรียน</th>
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-16">ปลายภาค</th>
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-14">รวม</th>
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-20">ระหว่างเรียน</th>
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-16">ปลายภาค</th>
                <th className="border border-[var(--line-soft)] px-1 py-1 text-[11px] font-semibold text-center w-14">รวม</th>
              </tr>
              <tr className="bg-[var(--surface-soft)]">
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">35</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">15</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">50</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">35</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">15</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">50</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center text-[var(--muted)] font-semibold">100</th>
                <th className="border border-[var(--line-soft)] px-1 py-0.5 text-[10px] text-center"></th>
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
                  <tr key={student.id} className="table-row-hover bg-[var(--surface)]">
                    <td className="border border-[var(--line-soft)] px-2 py-1 text-center text-xs text-[var(--muted)]">{i + 1}</td>
                    <td className="border border-[var(--line-soft)] px-2 py-1 text-xs font-medium text-[var(--text)] whitespace-nowrap">
                      {[student.title, student.first_name, student.last_name].filter(Boolean).join(' ')}
                    </td>
                    {/* Sem 1 */}
                    <td className="border border-[var(--line-soft)] px-0.5 py-0.5">
                      <input type="number" min="0" max="35" value={g1.midterm || ''} placeholder="-"
                        onChange={(e) => updateGrade(1, student.id, selectedSubject, 'midterm', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-[var(--line-soft)] px-0.5 py-0.5">
                      <input type="number" min="0" max="15" value={g1.final || ''} placeholder="-"
                        onChange={(e) => updateGrade(1, student.id, selectedSubject, 'final', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs font-semibold text-[var(--primary-strong)]">
                      {t1 > 0 ? t1 : '-'}
                    </td>
                    {/* Sem 2 */}
                    <td className="border border-[var(--line-soft)] px-0.5 py-0.5">
                      <input type="number" min="0" max="35" value={g2.midterm || ''} placeholder="-"
                        onChange={(e) => updateGrade(2, student.id, selectedSubject, 'midterm', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-[var(--line-soft)] px-0.5 py-0.5">
                      <input type="number" min="0" max="15" value={g2.final || ''} placeholder="-"
                        onChange={(e) => updateGrade(2, student.id, selectedSubject, 'final', Number(e.target.value) || 0)}
                        className={inputClass} />
                    </td>
                    <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs font-semibold text-[var(--success-strong)]">
                      {t2 > 0 ? t2 : '-'}
                    </td>
                    {/* Grand total + Grade */}
                    <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs font-bold text-[var(--accent-strong)]">
                      {gt > 0 ? gt : '-'}
                    </td>
                    <td className={`border border-[var(--line-soft)] px-1 py-1 text-center text-xs font-bold ${
                      grade !== null && Number(grade) >= 2 ? 'text-[var(--success-strong)]' : grade !== null ? 'text-[var(--danger-strong)]' : 'text-[var(--muted-soft)]'
                    }`}>
                      {grade ?? '-'}
                    </td>
                  </tr>
                )
              })}

              {/* Summary: รวม */}
              <tr className="bg-[var(--surface-muted)] font-semibold">
                <td colSpan={2} className="border border-[var(--line-soft)] px-2 py-1.5 text-xs text-center text-[var(--text)]">รวม</td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colSum(s => getSemGrade(sem1, s.id, selectedSubject).midterm)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colSum(s => getSemGrade(sem1, s.id, selectedSubject).final)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colSum(s => semTotal(getSemGrade(sem1, s.id, selectedSubject)))}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colSum(s => getSemGrade(sem2, s.id, selectedSubject).midterm)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colSum(s => getSemGrade(sem2, s.id, selectedSubject).final)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colSum(s => semTotal(getSemGrade(sem2, s.id, selectedSubject)))}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--accent-strong)]">
                  {colSum(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject)))}
                </td>
                <td className="border border-[var(--line-soft)]"></td>
              </tr>

              {/* Summary: เฉลี่ย */}
              <tr className="bg-[var(--surface-muted)] font-semibold">
                <td colSpan={2} className="border border-[var(--line-soft)] px-2 py-1.5 text-xs text-center text-[var(--text)]">เฉลี่ย</td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colAvg(s => getSemGrade(sem1, s.id, selectedSubject).midterm).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colAvg(s => getSemGrade(sem1, s.id, selectedSubject).final).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--primary-strong)]">
                  {colAvg(s => semTotal(getSemGrade(sem1, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colAvg(s => getSemGrade(sem2, s.id, selectedSubject).midterm).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colAvg(s => getSemGrade(sem2, s.id, selectedSubject).final).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--success-strong)]">
                  {colAvg(s => semTotal(getSemGrade(sem2, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)] px-1 py-1 text-center text-xs text-[var(--accent-strong)]">
                  {colAvg(s => grandTotal(getSemGrade(sem1, s.id, selectedSubject), getSemGrade(sem2, s.id, selectedSubject))).toFixed(2)}
                </td>
                <td className="border border-[var(--line-soft)]"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Grade Scale */}
      <div className="animate-slide-up card mt-6 p-5">
        <h3 className="section-title mb-3">เกณฑ์การคำนวณเกรด (คะแนนรวม 100)</h3>
        <div className="flex flex-wrap gap-2">
          <span className="pill pill-ok">80-100 = 4</span>
          <span className="pill pill-ok">75-79 = 3.5</span>
          <span className="pill pill-ok">70-74 = 3</span>
          <span className="pill pill-ok">65-69 = 2.5</span>
          <span className="pill pill-ok">60-64 = 2</span>
          <span className="pill pill-warn">55-59 = 1.5</span>
          <span className="pill pill-warn">50-54 = 1</span>
          <span className="pill pill-danger">ต่ำกว่า 50 = 0</span>
        </div>
      </div>

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
