'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import {
  CHARACTER_ITEMS,
  Classroom,
  DEFAULT_SUBJECTS,
  EVAL_LEVELS,
  LITERACY_ITEMS,
  Student,
  StudentEvaluation,
  calculateGrade,
  evalLevelLabel,
} from '@/types/index'
import {
  getClassrooms,
  getEvaluationsList,
  getGradesData,
  getStudents,
} from '@/lib/client-data'
import { createThaiDoc, thaiFullName } from '@/lib/pdf-thai'

type SemGrade = { midterm: number; final: number }
type StudentGrades = Record<number, Record<string, SemGrade>>

function parseGrades(rows: any[]): StudentGrades {
  const map: StudentGrades = {}
  for (const r of rows) {
    const sid = Number(r.student_id)
    const code = r.subject_code
    if (!map[sid]) map[sid] = {}
    map[sid][code] = {
      midterm: Number(r.midterm_score) || 0,
      final: Number(r.final_score) || 0,
    }
  }
  return map
}

function deriveActiveSubjectCodes(allGrades: StudentGrades): string[] {
  const codes = new Set<string>()
  for (const subjects of Object.values(allGrades)) {
    for (const [code, g] of Object.entries(subjects)) {
      if ((g.midterm || 0) + (g.final || 0) > 0) {
        codes.add(code)
      }
    }
  }
  return DEFAULT_SUBJECTS.filter((s) => codes.has(s.code)).map((s) => s.code)
}

function Por5Content() {
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<StudentGrades>({})
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    classroomFromUrl ? Number(classroomFromUrl) : null
  )
  const [semester, setSemester] = useState<number>(1)
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear() + 543))
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getClassrooms().then(setClassrooms).catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedClassroom || classrooms.length === 0) return
    const last = typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null
    if (last && classrooms.some((c) => String(c.id) === last)) {
      setSelectedClassroom(Number(last))
    } else {
      setSelectedClassroom(classrooms[0].id)
    }
  }, [classrooms, selectedClassroom])

  useEffect(() => {
    if (!selectedClassroom) {
      setStudents([])
      return
    }
    setLoading(true)
    Promise.all([
      getStudents(selectedClassroom),
      getGradesData(selectedClassroom, semester, academicYear),
      getEvaluationsList(selectedClassroom, semester, academicYear),
    ])
      .then(([sList, gList, eList]) => {
        setStudents(sList)
        setGrades(parseGrades(gList))
        setEvaluations(eList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedClassroom, semester, academicYear])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  const selectedClassroomObj = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroom) ?? null,
    [classrooms, selectedClassroom]
  )

  const activeSubjectCodes = useMemo(() => deriveActiveSubjectCodes(grades), [grades])

  const yearOptions = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const list: { value: string; label: string }[] = []
    for (let y = currentBE + 1; y >= currentBE - 5; y--) {
      list.push({ value: String(y), label: `ปีการศึกษา ${y}` })
    }
    return list
  }, [])

  function getEvalLevel(studentId: number, itemCode: string): number | null {
    const e = evaluations.find((ev) => ev.student_id === studentId && ev.item_code === itemCode)
    return e ? e.level : null
  }

  async function buildPdf() {
    if (!selectedClassroomObj) return
    setExporting(true)
    try {
      const { doc, autoTable } = await createThaiDoc('landscape')

      // Cover
      doc.setFont('NotoSansThai', 'bold')
      doc.setFontSize(18)
      doc.text('ปพ.5 — สมุดประเมินผลการเรียน', 148, 25, { align: 'center' })
      doc.setFontSize(13)
      doc.setFont('NotoSansThai', 'normal')
      doc.text(
        `ชั้น ${selectedClassroomObj.name}    ภาคเรียนที่ ${semester} / ปีการศึกษา ${academicYear}`,
        148,
        33,
        { align: 'center' }
      )
      doc.text(
        `จำนวนนักเรียน ${students.length} คน    วิชาที่กรอกคะแนนแล้ว ${activeSubjectCodes.length} วิชา`,
        148,
        40,
        { align: 'center' }
      )

      // ตารางสรุปคะแนนรายวิชา
      const subjectNames: Record<string, string> = {}
      for (const sub of DEFAULT_SUBJECTS) subjectNames[sub.code] = sub.name

      const head = [
        ['ที่', 'ชื่อ-สกุล', ...activeSubjectCodes.map((c) => subjectNames[c] || c), 'GPA'],
      ]

      const body = students.map((s, idx) => {
        const subjects = grades[s.id] || {}
        const cells = activeSubjectCodes.map((code) => {
          const g = subjects[code]
          const total = g ? (g.midterm || 0) + (g.final || 0) : 0
          return total > 0 ? calculateGrade(total) : '-'
        })
        const graded = activeSubjectCodes
          .map((code) => {
            const g = subjects[code]
            const total = g ? (g.midterm || 0) + (g.final || 0) : 0
            return total > 0 ? Number(calculateGrade(total)) : null
          })
          .filter((v): v is number => v !== null)
        const gpa = graded.length > 0 ? (graded.reduce((a, b) => a + b, 0) / graded.length).toFixed(2) : '-'
        return [
          String(idx + 1),
          thaiFullName(s),
          ...cells,
          gpa,
        ]
      })

      autoTable(doc, {
        head,
        body,
        startY: 46,
        theme: 'grid',
        styles: { font: 'NotoSansThai', fontSize: 8, cellPadding: 1.5, lineWidth: 0.15 },
        headStyles: {
          fillColor: [230, 240, 250],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          font: 'NotoSansThai',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'left', cellWidth: 50 },
        },
      })

      // หน้าสรุปคุณลักษณะ + อ่าน/คิด/เขียน
      doc.addPage('a4', 'landscape')
      doc.setFont('NotoSansThai', 'bold')
      doc.setFontSize(14)
      doc.text('สรุปคุณลักษณะอันพึงประสงค์ + อ่าน/คิด/เขียน', 148, 18, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont('NotoSansThai', 'normal')
      doc.text(
        `ชั้น ${selectedClassroomObj.name}  ภาคเรียนที่ ${semester}/${academicYear}`,
        148,
        24,
        { align: 'center' }
      )

      const allItems = [
        ...CHARACTER_ITEMS.map((i) => ({ code: i.code, short: i.name })),
        ...LITERACY_ITEMS.map((i) => ({ code: i.code, short: i.name })),
      ]

      const evalHead = [['ที่', 'ชื่อ-สกุล', ...allItems.map((i) => i.short)]]
      const evalBody = students.map((s, idx) => [
        String(idx + 1),
        thaiFullName(s),
        ...allItems.map((it) => {
          const lv = getEvalLevel(s.id, it.code)
          return lv === null ? '-' : String(lv)
        }),
      ])

      autoTable(doc, {
        head: evalHead,
        body: evalBody,
        startY: 30,
        theme: 'grid',
        styles: { font: 'NotoSansThai', fontSize: 7, cellPadding: 1.2, lineWidth: 0.15 },
        headStyles: {
          fillColor: [240, 250, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          font: 'NotoSansThai',
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          1: { halign: 'left', cellWidth: 45 },
        },
      })

      // Legend
      const legendY = (doc as any).lastAutoTable?.finalY + 6 || 200
      doc.setFontSize(9)
      doc.setFont('NotoSansThai', 'bold')
      doc.text('เกณฑ์การประเมิน: ', 14, legendY)
      doc.setFont('NotoSansThai', 'normal')
      doc.text(
        EVAL_LEVELS.map((l) => `${l.value} = ${l.label}`).join('   |   '),
        45,
        legendY
      )

      // Signature area
      doc.setFontSize(10)
      const pageHeight = doc.internal.pageSize.getHeight()
      const yLine = pageHeight - 18
      doc.text('..................................................', 30, yLine)
      doc.text('ครูประจำชั้น', 50, yLine + 6)
      doc.text('..................................................', 130, yLine)
      doc.text('ผู้บริหาร', 158, yLine + 6)
      doc.text('..................................................', 220, yLine)
      doc.text('วันที่', 246, yLine + 6)

      const filename = `ปพ5_${selectedClassroomObj.name}_ภาค${semester}_${academicYear}.pdf`
      doc.save(filename)
      setMessage({ type: 'success', text: 'ดาวน์โหลด PDF สำเร็จ' })
    } catch (err) {
      console.error('[por5] PDF error', err)
      setMessage({ type: 'error', text: 'สร้าง PDF ไม่สำเร็จ' })
    } finally {
      setExporting(false)
    }
  }

  async function exportExcel() {
    if (!selectedClassroomObj) return
    try {
      const xlsxMod = await import('xlsx')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = (xlsxMod as any).default || xlsxMod
      const subjectNames: Record<string, string> = {}
      for (const sub of DEFAULT_SUBJECTS) subjectNames[sub.code] = sub.name

      const headers = ['เลขที่', 'ชื่อ-สกุล', ...activeSubjectCodes.map((c) => subjectNames[c] || c), 'GPA']
      const rows = students.map((s, idx) => {
        const subjects = grades[s.id] || {}
        const cells = activeSubjectCodes.map((code) => {
          const g = subjects[code]
          const total = g ? (g.midterm || 0) + (g.final || 0) : 0
          return total > 0 ? calculateGrade(total) : ''
        })
        const graded = activeSubjectCodes
          .map((code) => {
            const g = subjects[code]
            const total = g ? (g.midterm || 0) + (g.final || 0) : 0
            return total > 0 ? Number(calculateGrade(total)) : null
          })
          .filter((v): v is number => v !== null)
        const gpa = graded.length > 0 ? (graded.reduce((a, b) => a + b, 0) / graded.length).toFixed(2) : ''
        return [idx + 1, thaiFullName(s), ...cells, gpa]
      })

      const ws = XLSX.utils.aoa_to_sheet([
        [`ปพ.5 — ชั้น ${selectedClassroomObj.name} ภาคเรียนที่ ${semester}/${academicYear}`],
        [],
        headers,
        ...rows,
      ])
      ws['!cols'] = [{ wch: 6 }, { wch: 28 }, ...activeSubjectCodes.map(() => ({ wch: 14 })), { wch: 8 }]
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'ปพ.5')
      XLSX.writeFile(wb, `ปพ5_${selectedClassroomObj.name}_ภาค${semester}_${academicYear}.xlsx`)
      setMessage({ type: 'success', text: 'ส่งออก Excel สำเร็จ' })
    } catch (err) {
      console.error('[por5] excel error', err)
      setMessage({ type: 'error', text: 'ส่งออก Excel ไม่สำเร็จ' })
    }
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-4">
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)] transition hover:bg-blue-50"
        >
          <ChevronLeft size={16} />
          กลับหน้าหลัก
        </Link>
      </div>

      <section className="animate-slide-up mb-5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
          <FileText size={13} />
          ปพ.5
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ใบ ปพ.5 — สมุดประเมินผลทั้งห้อง</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          สรุปคะแนนรายวิชา + คุณลักษณะอันพึงประสงค์ + อ่าน/คิด/เขียน ของนักเรียนทั้งห้อง (ครูเอาไปกรอกในแบบฟอร์มราชการต่อได้)
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">ห้องเรียน</label>
            <CustomSelect
              value={selectedClassroom ?? ''}
              onChange={(v) => {
                const id = v ? Number(v) : null
                setSelectedClassroom(id)
                if (id) localStorage.setItem('selectedClassroom', String(id))
              }}
              options={classrooms.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="เลือกห้อง"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">ภาคเรียน</label>
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
            <label className="mb-1 block text-xs font-semibold text-slate-700">ปีการศึกษา</label>
            <CustomSelect
              value={academicYear}
              onChange={(v) => setAcademicYear(String(v))}
              options={yearOptions}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting || students.length === 0}
            onClick={buildPdf}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF ทั้งห้อง'}
          </button>
          <button
            type="button"
            disabled={students.length === 0}
            onClick={exportExcel}
            className="btn-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            ส่งออก Excel
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {!loading && selectedClassroom && activeSubjectCodes.length === 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <span className="font-semibold text-amber-700">ยังไม่มีวิชาที่กรอกคะแนน</span> — ไปกรอกที่{' '}
              <Link
                href={`/grades?classroom=${selectedClassroom}`}
                className="font-semibold text-[var(--primary)] underline"
              >
                เมนูคะแนน/เกรด
              </Link>{' '}
              ก่อน
            </div>
          </div>
        )}
      </section>

      {/* Preview */}
      {loading ? (
        <div className="skeleton h-40 rounded-[var(--radius-lg)]" />
      ) : !selectedClassroom || students.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted)]">
          {!selectedClassroom ? 'กรุณาเลือกห้องเรียน' : 'ห้องนี้ยังไม่มีนักเรียน'}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ตารางสรุปคะแนน */}
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
            <h3 className="mb-3 text-sm font-bold text-slate-700">สรุปเกรดรายวิชา</h3>
            <table className="w-full min-w-[800px] border-collapse text-xs">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-slate-200 px-2 py-1 text-center">ที่</th>
                  <th className="border border-slate-200 px-3 py-1 text-left">ชื่อ-สกุล</th>
                  {activeSubjectCodes.map((c) => {
                    const sub = DEFAULT_SUBJECTS.find((s) => s.code === c)
                    return (
                      <th key={c} className="border border-slate-200 px-2 py-1 text-center">
                        {sub?.name || c}
                      </th>
                    )
                  })}
                  <th className="border border-slate-200 bg-amber-50 px-2 py-1 text-center">GPA</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const subjects = grades[s.id] || {}
                  const graded: number[] = []
                  return (
                    <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">{i + 1}</td>
                      <td className="border border-slate-200 px-3 py-1 whitespace-nowrap">{thaiFullName(s)}</td>
                      {activeSubjectCodes.map((c) => {
                        const g = subjects[c]
                        const total = g ? (g.midterm || 0) + (g.final || 0) : 0
                        const grade = total > 0 ? calculateGrade(total) : '-'
                        if (total > 0) graded.push(Number(grade))
                        return (
                          <td key={c} className="border border-slate-200 px-2 py-1 text-center">
                            {grade}
                          </td>
                        )
                      })}
                      <td className="border border-slate-200 bg-amber-50/30 px-2 py-1 text-center font-bold text-amber-700">
                        {graded.length > 0
                          ? (graded.reduce((a, b) => a + b, 0) / graded.length).toFixed(2)
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ตารางคุณลักษณะ */}
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
            <h3 className="mb-3 text-sm font-bold text-slate-700">คุณลักษณะอันพึงประสงค์ + อ่าน/คิด/เขียน</h3>
            <table className="w-full min-w-[800px] border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50">
                  <th className="border border-slate-200 px-2 py-1 text-center">ที่</th>
                  <th className="border border-slate-200 px-3 py-1 text-left">ชื่อ-สกุล</th>
                  {[...CHARACTER_ITEMS, ...LITERACY_ITEMS].map((it) => (
                    <th key={it.code} className="border border-slate-200 px-1 py-1 text-center text-[10px]">
                      {it.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">{i + 1}</td>
                    <td className="border border-slate-200 px-3 py-1 whitespace-nowrap">{thaiFullName(s)}</td>
                    {[...CHARACTER_ITEMS, ...LITERACY_ITEMS].map((it) => {
                      const lv = getEvalLevel(s.id, it.code)
                      return (
                        <td key={it.code} className="border border-slate-200 px-1 py-1 text-center">
                          {lv === null ? '-' : evalLevelLabel(lv)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Por5Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl">
          <div className="skeleton h-40 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <Por5Content />
    </Suspense>
  )
}
