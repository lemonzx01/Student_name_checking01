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
  User,
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
  StudentNote,
  calculateGrade,
  evalLevelLabel,
} from '@/types/index'
import {
  getAllAttendanceByClassroomClient,
  getClassrooms,
  getEvaluationsList,
  getGradesData,
  getPhotoDataUrl,
  getStudentNotes,
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

interface AttendanceSummary {
  total: number
  present: number
  absent: number
  sick: number
  personal: number
}

function Por6Content() {
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<StudentGrades>({})
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceSummary>>({})
  const [notesByStudent, setNotesByStudent] = useState<Record<number, StudentNote[]>>({})
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    classroomFromUrl ? Number(classroomFromUrl) : null
  )
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
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
      getAllAttendanceByClassroomClient(selectedClassroom),
    ])
      .then(([sList, gList, eList, attRows]) => {
        setStudents(sList)
        setGrades(parseGrades(gList))
        setEvaluations(eList)
        // สรุปการเข้าเรียน per-student
        const map: Record<number, AttendanceSummary> = {}
        for (const r of attRows as any[]) {
          if (!map[r.student_id]) {
            map[r.student_id] = { total: 0, present: 0, absent: 0, sick: 0, personal: 0 }
          }
          map[r.student_id].total += 1
          if (r.status === 'มา') map[r.student_id].present += 1
          else if (r.status === 'ขาด') map[r.student_id].absent += 1
          else if (r.status === 'ลาป่วย') map[r.student_id].sick += 1
          else if (r.status === 'ลากิจ') map[r.student_id].personal += 1
        }
        setAttendanceMap(map)
        if (sList.length > 0 && !sList.some((s) => s.id === selectedStudentId)) {
          setSelectedStudentId(sList[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedClassroom, semester, academicYear])

  // โหลด notes ของนักเรียนที่เลือก (สำหรับ preview)
  useEffect(() => {
    if (!selectedStudentId) return
    if (notesByStudent[selectedStudentId]) return
    getStudentNotes(selectedStudentId)
      .then((notes) =>
        setNotesByStudent((prev) => ({ ...prev, [selectedStudentId]: notes }))
      )
      .catch(() => {})
  }, [selectedStudentId, notesByStudent])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  const selectedClassroomObj = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroom) ?? null,
    [classrooms, selectedClassroom]
  )

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  )

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

  async function buildPdf(mode: 'single' | 'all') {
    if (!selectedClassroomObj) return
    if (mode === 'single' && !selectedStudent) return
    setExporting(true)
    try {
      const { doc, autoTable } = await createThaiDoc('portrait')
      const studentsToRender = mode === 'single' && selectedStudent ? [selectedStudent] : students

      // โหลด notes + photos ล่วงหน้า
      const notesMap = new Map<number, StudentNote[]>()
      const photoMap = new Map<number, string | null>()
      await Promise.all(
        studentsToRender.map(async (s) => {
          const [notes, photoUrl] = await Promise.all([
            getStudentNotes(s.id).catch(() => [] as StudentNote[]),
            s.photo_path ? getPhotoDataUrl(s.photo_path).catch(() => null) : Promise.resolve(null),
          ])
          notesMap.set(s.id, notes)
          photoMap.set(s.id, photoUrl)
        })
      )

      for (let i = 0; i < studentsToRender.length; i++) {
        const s = studentsToRender[i]
        if (i > 0) doc.addPage()

        // Title
        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(16)
        doc.text('ปพ.6 — แบบรายงานผลการเรียนต่อผู้ปกครอง', 105, 17, { align: 'center' })
        doc.setFontSize(11)
        doc.setFont('NotoSansThai', 'normal')
        doc.text(
          `ภาคเรียนที่ ${semester} / ปีการศึกษา ${academicYear}`,
          105,
          23,
          { align: 'center' }
        )

        // รูป + ข้อมูล
        const photoUrl = photoMap.get(s.id)
        if (photoUrl) {
          try {
            const fmt = photoUrl.includes('image/png') ? 'PNG' : 'JPEG'
            doc.addImage(photoUrl, fmt, 168, 28, 25, 28)
          } catch (err) {
            console.warn('[por6] addImage failed:', err)
          }
        }

        doc.setDrawColor(0)
        doc.setLineWidth(0.3)
        doc.rect(14, 28, 150, 28)
        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(10)
        doc.text('ชื่อ-นามสกุล:', 18, 35)
        doc.text('เลขที่:', 18, 42)
        doc.text('ห้องเรียน:', 18, 49)
        doc.text('รหัสนักเรียน:', 100, 35)
        doc.text('ครูประจำชั้น:', 100, 42)

        doc.setFont('NotoSansThai', 'normal')
        doc.text(thaiFullName(s), 45, 35)
        doc.text(String(s.student_number || '-'), 35, 42)
        doc.text(selectedClassroomObj.name, 40, 49)
        doc.text(String(s.student_id || '-'), 130, 35)
        doc.text('-', 130, 42)

        // ตารางคะแนนรายวิชา
        const subjects = grades[s.id] || {}
        const subjectRows = DEFAULT_SUBJECTS
          .map((sub) => {
            const g = subjects[sub.code]
            const total = g ? (g.midterm || 0) + (g.final || 0) : 0
            if (total === 0) return null
            return [
              sub.code,
              sub.name,
              String(g.midterm || '-'),
              String(g.final || '-'),
              String(total),
              calculateGrade(total),
            ]
          })
          .filter((r): r is string[] => r !== null)

        const graded = subjectRows.map((r) => Number(r[5])).filter((v) => !Number.isNaN(v))
        const gpa = graded.length > 0 ? (graded.reduce((a, b) => a + b, 0) / graded.length).toFixed(2) : '-'

        autoTable(doc, {
          head: [['รหัส', 'รายวิชา', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด']],
          body: subjectRows.length > 0 ? subjectRows : [['-', 'ยังไม่มีคะแนน', '-', '-', '-', '-']],
          startY: 60,
          theme: 'grid',
          styles: { font: 'NotoSansThai', fontSize: 9, cellPadding: 1.8, lineWidth: 0.15 },
          headStyles: {
            fillColor: [230, 240, 250],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
            halign: 'center',
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 18 },
            1: { halign: 'left', cellWidth: 60 },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center', fontStyle: 'bold' },
          },
        })

        const tableEnd = (doc as any).lastAutoTable?.finalY ?? 100

        // GPA
        doc.rect(14, tableEnd + 4, 182, 9)
        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(11)
        doc.text('เกรดเฉลี่ยรวม (GPA)', 18, tableEnd + 10)
        doc.setFontSize(13)
        doc.text(gpa, 180, tableEnd + 10, { align: 'right' })

        // คุณลักษณะ + อ่าน/คิด/เขียน
        const allItems = [...CHARACTER_ITEMS, ...LITERACY_ITEMS]
        const evalBody = [
          allItems.slice(0, 6).map((it) => {
            const lv = getEvalLevel(s.id, it.code)
            return `${it.name}: ${lv === null ? '-' : evalLevelLabel(lv)}`
          }),
          allItems.slice(6).map((it) => {
            const lv = getEvalLevel(s.id, it.code)
            return `${it.name}: ${lv === null ? '-' : evalLevelLabel(lv)}`
          }),
        ]

        autoTable(doc, {
          head: [['คุณลักษณะอันพึงประสงค์ + อ่าน/คิด/เขียน', '', '']],
          body: evalBody.map((row) => {
            // ensure each row has 3 cells
            const r = [...row]
            while (r.length < 3) r.push('')
            return r.slice(0, 3)
          }),
          startY: tableEnd + 18,
          theme: 'grid',
          styles: { font: 'NotoSansThai', fontSize: 8.5, cellPadding: 1.5, lineWidth: 0.15 },
          headStyles: {
            fillColor: [240, 250, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
            halign: 'center',
          },
        })

        const evalEnd = (doc as any).lastAutoTable?.finalY ?? tableEnd + 30

        // การมาเรียน
        const att = attendanceMap[s.id] || { total: 0, present: 0, absent: 0, sick: 0, personal: 0 }
        autoTable(doc, {
          head: [['การมาเรียน', 'มา', 'ขาด', 'ลาป่วย', 'ลากิจ', 'รวม']],
          body: [
            [
              'จำนวน (ครั้ง)',
              String(att.present),
              String(att.absent),
              String(att.sick),
              String(att.personal),
              String(att.total),
            ],
          ],
          startY: evalEnd + 4,
          theme: 'grid',
          styles: { font: 'NotoSansThai', fontSize: 9, cellPadding: 1.8, lineWidth: 0.15, halign: 'center' },
          headStyles: {
            fillColor: [255, 240, 230],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
          },
        })

        const attEnd = (doc as any).lastAutoTable?.finalY ?? evalEnd + 15

        // ความเห็นครู (notes ล่าสุด)
        const notes = notesMap.get(s.id) || []
        if (notes.length > 0) {
          doc.setFont('NotoSansThai', 'bold')
          doc.setFontSize(10)
          doc.text('ความเห็นครู / บันทึกประจำตัว', 14, attEnd + 8)
          doc.setFont('NotoSansThai', 'normal')
          doc.setFontSize(9)
          const latestNote = notes[0]
          const lines = doc.splitTextToSize(latestNote.note, 180)
          doc.rect(14, attEnd + 10, 182, Math.max(12, lines.length * 4 + 4))
          doc.text(lines.slice(0, 3), 16, attEnd + 14)
        }

        // Signature lines
        const pageHeight = doc.internal.pageSize.getHeight()
        const yLine = pageHeight - 24
        doc.setFont('NotoSansThai', 'normal')
        doc.setFontSize(9)
        doc.text('..................................................', 14, yLine)
        doc.text('ครูประจำชั้น', 30, yLine + 5)
        doc.text('..................................................', 80, yLine)
        doc.text('ผู้ปกครอง', 98, yLine + 5)
        doc.text('..................................................', 146, yLine)
        doc.text('ผู้บริหาร', 165, yLine + 5)
      }

      const filename =
        mode === 'single' && selectedStudent
          ? `ปพ6_${thaiFullName(selectedStudent).replace(/\s+/g, '_')}_ภาค${semester}_${academicYear}.pdf`
          : `ปพ6_${selectedClassroomObj.name}_ภาค${semester}_${academicYear}.pdf`
      doc.save(filename)
      setMessage({ type: 'success', text: 'ดาวน์โหลด PDF สำเร็จ' })
    } catch (err) {
      console.error('[por6] PDF error', err)
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

      const rows: any[][] = []
      rows.push([`ปพ.6 — ชั้น ${selectedClassroomObj.name} ภาคเรียนที่ ${semester}/${academicYear}`])
      rows.push([])

      for (const s of students) {
        const subjects = grades[s.id] || {}
        const att = attendanceMap[s.id] || { total: 0, present: 0, absent: 0, sick: 0, personal: 0 }
        rows.push([`นักเรียน: ${thaiFullName(s)}  (เลขที่ ${s.student_number || '-'})`])
        rows.push(['รายวิชา', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด'])
        for (const sub of DEFAULT_SUBJECTS) {
          const g = subjects[sub.code]
          const total = g ? (g.midterm || 0) + (g.final || 0) : 0
          if (total === 0) continue
          rows.push([sub.name, g.midterm || '-', g.final || '-', total, calculateGrade(total)])
        }
        rows.push([])
        rows.push([
          'การมาเรียน',
          `มา ${att.present}`,
          `ขาด ${att.absent}`,
          `ลาป่วย ${att.sick}`,
          `ลากิจ ${att.personal}`,
          `รวม ${att.total}`,
        ])
        rows.push([])
        rows.push(['------'])
        rows.push([])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'ปพ.6')
      XLSX.writeFile(wb, `ปพ6_${selectedClassroomObj.name}_ภาค${semester}_${academicYear}.xlsx`)
      setMessage({ type: 'success', text: 'ส่งออก Excel สำเร็จ' })
    } catch (err) {
      console.error('[por6] excel error', err)
      setMessage({ type: 'error', text: 'ส่งออก Excel ไม่สำเร็จ' })
    }
  }

  const studentSubjects = selectedStudent ? grades[selectedStudent.id] || {} : {}
  const studentNotes = selectedStudent ? notesByStudent[selectedStudent.id] || [] : []
  const att = selectedStudent ? attendanceMap[selectedStudent.id] || { total: 0, present: 0, absent: 0, sick: 0, personal: 0 } : null

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
          ปพ.6
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ใบ ปพ.6 — รายงานต่อผู้ปกครอง</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          รายงานผลการเรียนรายบุคคล (1 นักเรียน/หน้า): คะแนน + คุณลักษณะ + การมาเรียน + ลายเซ็น
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
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
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">นักเรียน</label>
            <CustomSelect
              value={selectedStudentId ?? ''}
              onChange={(v) => setSelectedStudentId(v ? Number(v) : null)}
              options={students.map((s) => ({
                value: s.id,
                label: `${s.student_number || '-'}  ${thaiFullName(s)}`,
              }))}
              placeholder="เลือกนักเรียน"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting || !selectedStudent}
            onClick={() => buildPdf('single')}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'กำลังสร้าง PDF...' : 'PDF (นักเรียนคนนี้)'}
          </button>
          <button
            type="button"
            disabled={exporting || students.length === 0}
            onClick={() => buildPdf('all')}
            className="btn-press inline-flex items-center gap-2 rounded-xl border-2 border-[var(--primary)] bg-white px-5 py-3 text-sm font-bold text-[var(--primary)] transition hover:bg-blue-50 disabled:opacity-50"
          >
            <FileText size={16} />
            PDF (ทั้งห้อง {students.length} คน)
          </button>
          <button
            type="button"
            disabled={students.length === 0}
            onClick={exportExcel}
            className="btn-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            Excel
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
      </section>

      {/* Preview */}
      {loading ? (
        <div className="skeleton h-40 rounded-[var(--radius-lg)]" />
      ) : !selectedStudent ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted)]">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
          กรุณาเลือกนักเรียน
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--line)] bg-slate-50 px-6 py-4">
            <p className="text-center text-lg font-bold">ใบ ปพ.6 — รายงานผลการเรียน</p>
            <p className="mt-1 text-center text-sm text-[var(--muted)]">
              ภาคเรียนที่ {semester}/{academicYear}
            </p>
          </div>

          <div className="grid gap-3 border-b border-[var(--line)] px-6 py-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ชื่อ–นามสกุล</p>
                <p className="text-base font-bold">{thaiFullName(selectedStudent)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">เลขที่</p>
                <p className="text-base font-bold">{selectedStudent.student_number || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">รหัส</p>
                <p className="text-base font-bold">{selectedStudent.student_id || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ห้อง</p>
                <p className="text-base font-bold">{selectedClassroomObj?.name}</p>
              </div>
            </div>
          </div>

          {/* คะแนนรายวิชา */}
          <div className="px-6 py-4">
            <h3 className="mb-2 text-sm font-bold text-slate-700">คะแนนรายวิชา</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-slate-200 px-3 py-1.5 text-left">รายวิชา</th>
                  <th className="border border-slate-200 px-3 py-1.5 text-center">กลางภาค</th>
                  <th className="border border-slate-200 px-3 py-1.5 text-center">ปลายภาค</th>
                  <th className="border border-slate-200 px-3 py-1.5 text-center">รวม</th>
                  <th className="border border-slate-200 px-3 py-1.5 text-center">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_SUBJECTS.map((sub) => {
                  const g = studentSubjects[sub.code]
                  const total = g ? (g.midterm || 0) + (g.final || 0) : 0
                  if (total === 0) return null
                  return (
                    <tr key={sub.code}>
                      <td className="border border-slate-200 px-3 py-1.5">{sub.name}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-center">{g.midterm || '-'}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-center">{g.final || '-'}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-center font-semibold">{total}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-center font-bold">
                        {calculateGrade(total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* คุณลักษณะ + การมาเรียน */}
          <div className="grid gap-4 border-t border-[var(--line)] px-6 py-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">คุณลักษณะ + อ่าน/คิด/เขียน</h3>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {[...CHARACTER_ITEMS, ...LITERACY_ITEMS].map((it) => {
                    const lv = getEvalLevel(selectedStudent.id, it.code)
                    return (
                      <tr key={it.code}>
                        <td className="border border-slate-200 px-2 py-1">{it.name}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center font-semibold">
                          {lv === null ? '-' : evalLevelLabel(lv)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">การมาเรียน</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs text-[var(--muted)]">มา</p>
                  <p className="text-2xl font-bold text-emerald-700">{att?.present ?? 0}</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="text-xs text-[var(--muted)]">ขาด</p>
                  <p className="text-2xl font-bold text-red-700">{att?.absent ?? 0}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs text-[var(--muted)]">ลาป่วย</p>
                  <p className="text-2xl font-bold text-amber-700">{att?.sick ?? 0}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs text-[var(--muted)]">ลากิจ</p>
                  <p className="text-2xl font-bold text-blue-700">{att?.personal ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">รวม {att?.total ?? 0} ครั้ง</p>

              <h3 className="mt-4 mb-2 text-sm font-bold text-slate-700">ความเห็นครู (ล่าสุด)</h3>
              {studentNotes.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
                  ยังไม่มีบันทึก
                </p>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {studentNotes[0].note}
                </p>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-[var(--line)] bg-slate-50 px-6 py-3 text-xs">
            <span className="mr-2 font-semibold text-slate-600">เกณฑ์การประเมิน:</span>
            {EVAL_LEVELS.map((l) => (
              <span key={l.value} className={`mr-2 rounded px-2 py-0.5 ${l.bg} ${l.text}`}>
                {l.value} = {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Por6Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl">
          <div className="skeleton h-40 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <Por6Content />
    </Suspense>
  )
}
