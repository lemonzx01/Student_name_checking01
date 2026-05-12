'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Award,
  ChevronLeft,
  Download,
  FileText,
  NotebookPen,
  Printer,
  User,
} from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import {
  getClassrooms,
  getGradesData,
  getPhotoDataUrl,
  getStudentNotes,
  getStudents,
} from '@/lib/client-data'
import {
  Classroom,
  DEFAULT_SUBJECTS,
  Student,
  StudentNote,
  calculateGrade,
} from '@/types/index'

type SemGrade = { midterm: number; final: number }
type SubjectGrades = Record<string, SemGrade>
type StudentGrades = Record<number, SubjectGrades>

function displayName(student: Student) {
  return [student.title, student.first_name, student.last_name].filter(Boolean).join(' ')
}

function computeSubjectTotal(g: SemGrade): number {
  return (Number(g.midterm) || 0) + (Number(g.final) || 0)
}

// รายวิชาที่ "ครูคนนี้ใช้จริง" = มีคะแนนอย่างน้อย 1 คนในห้อง
function deriveActiveSubjectCodes(allGrades: StudentGrades): string[] {
  const codes = new Set<string>()
  for (const subjects of Object.values(allGrades)) {
    for (const [code, g] of Object.entries(subjects)) {
      if (computeSubjectTotal(g) > 0) {
        codes.add(code)
      }
    }
  }
  // เรียงตามลำดับใน DEFAULT_SUBJECTS
  return DEFAULT_SUBJECTS.filter((s) => codes.has(s.code)).map((s) => s.code)
}

function computeSummary(subjects: SubjectGrades, activeCodes: string[]) {
  const activeSet = new Set(activeCodes)
  const entries = DEFAULT_SUBJECTS.filter((s) => activeSet.has(s.code)).map((subj) => {
    const g = subjects[subj.code] || { midterm: 0, final: 0 }
    const total = computeSubjectTotal(g)
    const grade = total > 0 ? calculateGrade(total) : '-'
    return { code: subj.code, name: subj.name, midterm: g.midterm, final: g.final, total, grade }
  })
  const graded = entries.filter((e) => e.total > 0)
  const gpa =
    graded.length > 0
      ? graded.reduce((sum, e) => sum + Number(e.grade), 0) / graded.length
      : 0
  return { entries, gpa }
}

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

function ReportCardContent() {
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<StudentGrades>({})
  const [notes, setNotes] = useState<StudentNote[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    classroomFromUrl ? Number(classroomFromUrl) : null
  )
  const [semester, setSemester] = useState<number>(1)
  const [academicYear, setAcademicYear] = useState<string>(
    String(new Date().getFullYear() + 543)
  )
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getClassrooms().then(setClassrooms).catch(console.error)
  }, [])

  // ถ้ายังไม่ได้เลือกห้อง แต่มีห้องล่าสุดใน localStorage ให้ใช้
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
    ])
      .then(([studentRows, gradeRows]) => {
        setStudents(studentRows)
        setGrades(parseGrades(gradeRows))
        // เลือกนักเรียนคนแรกถ้ายังไม่ได้เลือก
        if (studentRows.length > 0 && !studentRows.some((s) => s.id === selectedStudentId)) {
          setSelectedStudentId(studentRows[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedClassroom, semester, academicYear])

  // โหลดบันทึกประจำตัวของนักเรียนที่เลือก
  useEffect(() => {
    if (!selectedStudentId) {
      setNotes([])
      return
    }
    getStudentNotes(selectedStudentId).then(setNotes).catch(() => setNotes([]))
  }, [selectedStudentId])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  )

  const selectedClassroomObj = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroom) ?? null,
    [classrooms, selectedClassroom]
  )

  // รายวิชาที่ครูใช้จริง (มีคะแนน) — คำนวณจาก grades ของห้องปัจจุบัน
  const activeSubjectCodes = useMemo(() => deriveActiveSubjectCodes(grades), [grades])

  const summary = useMemo(() => {
    if (!selectedStudent) return null
    const subjects = grades[selectedStudent.id] || {}
    return computeSummary(subjects, activeSubjectCodes)
  }, [grades, selectedStudent, activeSubjectCodes])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  async function buildAndDownloadPdf(mode: 'single' | 'all') {
    if (!selectedClassroomObj) {
      setMessage({ type: 'error', text: 'กรุณาเลือกห้องเรียน' })
      return
    }
    if (mode === 'single' && !selectedStudent) {
      setMessage({ type: 'error', text: 'กรุณาเลือกนักเรียน' })
      return
    }

    setExporting(true)
    try {
      const jspdfModule = await import('jspdf')
      const jsPDF = jspdfModule.default || jspdfModule.jsPDF
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule
      const NotoSansThai = await import('@/lib/thai-font').then((m) => m.NotoSansThai)

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
      doc.setFont('NotoSansThai')

      const studentsToRender: Student[] =
        mode === 'single' && selectedStudent ? [selectedStudent] : students

      // โหลดรูปทุกคนล่วงหน้า (async) — เพื่อให้ render PDF ทีเดียวจบ
      const photoMap = new Map<number, string | null>()
      await Promise.all(
        studentsToRender.map(async (s) => {
          if (s.photo_path) {
            const url = await getPhotoDataUrl(s.photo_path)
            photoMap.set(s.id, url)
          }
        })
      )

      for (let index = 0; index < studentsToRender.length; index++) {
        const student = studentsToRender[index]
        if (index > 0) doc.addPage()

        const subjects = grades[student.id] || {}
        const { entries, gpa } = computeSummary(subjects, activeSubjectCodes)

        // Header
        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(16)
        doc.text('ใบรายงานคะแนนนักเรียน', 105, 18, { align: 'center' })

        // รูปนักเรียนมุมขวาบน (ถ้ามี)
        const photoUrl = photoMap.get(student.id)
        if (photoUrl) {
          try {
            const fmt = photoUrl.includes('image/png') ? 'PNG' : 'JPEG'
            doc.addImage(photoUrl, fmt, 170, 8, 22, 22)
          } catch (err) {
            console.warn('[report-card] addImage failed:', err)
          }
        }

        doc.setFontSize(11)
        doc.setFont('NotoSansThai', 'normal')
        doc.text(
          `ภาคเรียนที่ ${semester} / ปีการศึกษา ${academicYear}`,
          105,
          25,
          { align: 'center' }
        )

        // Student info box
        const fullName = displayName(student)
        const classLabel = selectedClassroomObj.name
        const studentNumber = student.student_number || student.student_id || '-'

        doc.setDrawColor(0)
        doc.setLineWidth(0.3)
        doc.rect(14, 31, 182, 22)

        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(11)
        doc.text('ชื่อ–นามสกุล:', 18, 39)
        doc.text('เลขที่:', 18, 46)
        doc.text('ห้องเรียน:', 105, 39)
        doc.text('รหัสนักเรียน:', 105, 46)

        doc.setFont('NotoSansThai', 'normal')
        doc.text(fullName, 50, 39)
        doc.text(String(studentNumber), 50, 46)
        doc.text(classLabel, 130, 39)
        doc.text(String(student.student_id || '-'), 140, 46)

        // Subjects table
        ;(autoTable as any)(doc, {
          head: [['รหัส', 'รายวิชา', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด']],
          body: entries.map((e) => [
            e.code,
            e.name,
            e.total > 0 ? String(e.midterm) : '-',
            e.total > 0 ? String(e.final) : '-',
            e.total > 0 ? String(e.total) : '-',
            e.grade,
          ]),
          startY: 58,
          theme: 'grid',
          styles: {
            font: 'NotoSansThai',
            fontSize: 10,
            cellPadding: 2.5,
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            halign: 'center',
          },
          headStyles: {
            fillColor: [235, 240, 250],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
          },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 60, halign: 'left' },
            2: { cellWidth: 26 },
            3: { cellWidth: 26 },
            4: { cellWidth: 26 },
            5: { cellWidth: 26, fontStyle: 'bold' },
          },
        })

        const tableEndY = (doc as any).lastAutoTable?.finalY ?? 150

        // GPA summary
        doc.setDrawColor(0)
        doc.rect(14, tableEndY + 6, 182, 14)
        doc.setFont('NotoSansThai', 'bold')
        doc.setFontSize(12)
        doc.text('เกรดเฉลี่ยรวม (GPA)', 18, tableEndY + 15)
        doc.setFontSize(14)
        doc.text(gpa > 0 ? gpa.toFixed(2) : '-', 180, tableEndY + 15, { align: 'right' })

        // Teacher notes (ใช้ notes เฉพาะเมื่อ single, ถ้า all ก็ข้าม เพราะโหลดไม่หมด)
        if (mode === 'single' && notes.length > 0) {
          const noteStartY = tableEndY + 26
          doc.setFont('NotoSansThai', 'bold')
          doc.setFontSize(11)
          doc.text('บันทึกประจำตัวนักเรียน (ล่าสุด 5 รายการ)', 14, noteStartY)

          ;(autoTable as any)(doc, {
            head: [['วันที่', 'บันทึก']],
            body: notes.slice(0, 5).map((n) => [formatThaiShortDate(n.date), n.note]),
            startY: noteStartY + 3,
            theme: 'grid',
            styles: {
              font: 'NotoSansThai',
              fontSize: 9,
              cellPadding: 2,
              lineColor: [0, 0, 0],
              lineWidth: 0.2,
            },
            headStyles: {
              fillColor: [245, 240, 255],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              font: 'NotoSansThai',
            },
            columnStyles: {
              0: { cellWidth: 35, halign: 'center' },
              1: { cellWidth: 147 },
            },
          })
        }

        // Signature line
        const pageHeight = doc.internal.pageSize.getHeight()
        doc.setFont('NotoSansThai', 'normal')
        doc.setFontSize(10)
        doc.text('..................................................', 30, pageHeight - 22)
        doc.text('ลงชื่อครูประจำชั้น', 40, pageHeight - 16)
        doc.text('..................................................', 130, pageHeight - 22)
        doc.text('ลงชื่อผู้ปกครอง', 142, pageHeight - 16)
      }

      const filename =
        mode === 'single' && selectedStudent
          ? `report-card_${displayName(selectedStudent).replace(/\s+/g, '_')}_ภาค${semester}_${academicYear}.pdf`
          : `report-card_ห้อง${selectedClassroomObj.name}_ภาค${semester}_${academicYear}.pdf`

      doc.save(filename)
      setMessage({ type: 'success', text: 'ดาวน์โหลด PDF สำเร็จ' })
    } catch (err) {
      console.error('[report-card] PDF error', err)
      setMessage({ type: 'error', text: 'สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง' })
    } finally {
      setExporting(false)
    }
  }

  const yearOptions = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const list: { value: string; label: string }[] = []
    for (let y = currentBE + 1; y >= currentBE - 5; y--) {
      list.push({ value: String(y), label: `ปีการศึกษา ${y}` })
    }
    return list
  }, [])

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      {/* Breadcrumb */}
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
      <section className="animate-slide-up mb-5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
          <FileText size={13} />
          Report Card
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ใบรายงานคะแนน</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ดาวน์โหลด PDF คะแนนนักเรียนรายคนหรือทั้งห้อง (แสดงเฉพาะวิชาที่กรอกคะแนนแล้ว) พร้อมบันทึกประจำตัว
        </p>

        {/* ตัวเลือก */}
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
                label: `${s.student_number || '-'}  ${displayName(s)}`,
              }))}
              placeholder="เลือกนักเรียน"
            />
          </div>
        </div>

        {/* ปุ่ม export */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={exporting || !selectedStudent || activeSubjectCodes.length === 0}
            onClick={() => buildAndDownloadPdf('single')}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF (นักเรียนคนนี้)'}
          </button>
          <button
            type="button"
            disabled={exporting || students.length === 0 || activeSubjectCodes.length === 0}
            onClick={() => buildAndDownloadPdf('all')}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--primary)] bg-white px-5 py-3 text-sm font-bold text-[var(--primary)] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={16} />
            ดาวน์โหลด PDF (ทั้งห้อง {students.length} คน)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer size={16} />
            พิมพ์หน้านี้
          </button>
        </div>

        {message ? (
          <div
            className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {/* Info banner - บอกว่ากำลังแสดงกี่วิชา */}
        {!loading && selectedClassroom ? (
          activeSubjectCodes.length > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
              <FileText size={18} className="mt-0.5 flex-shrink-0 text-blue-600" />
              <div>
                <span className="font-semibold text-blue-700">
                  แสดง {activeSubjectCodes.length} วิชา
                </span>{' '}
                ที่คุณกรอกคะแนนในภาคเรียนนี้ —{' '}
                <Link
                  href={`/grades?classroom=${selectedClassroom}`}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-strong)]"
                >
                  เพิ่ม/แก้ไขคะแนนที่เมนูคะแนน/เกรด
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <span className="font-semibold text-amber-700">ยังไม่มีวิชาที่กรอกคะแนน</span>{' '}
                สำหรับห้องนี้ ภาคเรียน {semester}/{academicYear} —{' '}
                <Link
                  href={`/grades?classroom=${selectedClassroom}`}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-strong)]"
                >
                  ไปกรอกคะแนนก่อน
                </Link>
              </div>
            </div>
          )
        ) : null}
      </section>

      {/* Preview */}
      {loading ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-8 shadow-[var(--shadow-sm)]">
          <div className="skeleton mb-3 h-5 w-48" />
          <div className="skeleton mb-2 h-4 w-full" />
          <div className="skeleton mb-2 h-4 w-5/6" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      ) : !selectedStudent || !summary ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
            <AlertTriangle size={22} />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {students.length === 0
              ? 'ห้องนี้ยังไม่มีนักเรียน'
              : 'กรุณาเลือกนักเรียนเพื่อดูตัวอย่าง'}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            เมื่อเลือกแล้ว คุณจะเห็นตัวอย่าง PDF ที่จะดาวน์โหลด
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)] print:border-0 print:shadow-none">
          {/* Header ในตัวอย่าง */}
          <div className="border-b border-[var(--line)] bg-slate-50 px-6 py-4 print:bg-white">
            <p className="text-center text-lg font-bold text-slate-900">
              ใบรายงานคะแนนนักเรียน
            </p>
            <p className="mt-1 text-center text-sm text-[var(--muted)]">
              ภาคเรียนที่ {semester} / ปีการศึกษา {academicYear}
            </p>
          </div>

          {/* ข้อมูลนักเรียน */}
          <div className="grid gap-3 border-b border-[var(--line)] px-6 py-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ชื่อ–นามสกุล</p>
                <p className="text-base font-bold text-slate-900">{displayName(selectedStudent)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">เลขที่</p>
                <p className="text-base font-bold text-slate-900">
                  {selectedStudent.student_number || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">รหัสนักเรียน</p>
                <p className="text-base font-bold text-slate-900">
                  {selectedStudent.student_id || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ห้องเรียน</p>
                <p className="text-base font-bold text-slate-900">
                  {selectedClassroomObj?.name || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* ตารางคะแนน */}
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-blue-50 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                  <th className="border border-[var(--line)] px-3 py-2">รหัส</th>
                  <th className="border border-[var(--line)] px-3 py-2">รายวิชา</th>
                  <th className="border border-[var(--line)] px-3 py-2 text-center">กลางภาค</th>
                  <th className="border border-[var(--line)] px-3 py-2 text-center">ปลายภาค</th>
                  <th className="border border-[var(--line)] px-3 py-2 text-center">รวม</th>
                  <th className="border border-[var(--line)] px-3 py-2 text-center">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((e) => (
                  <tr key={e.code}>
                    <td className="border border-[var(--line)] px-3 py-2 font-mono text-xs">
                      {e.code}
                    </td>
                    <td className="border border-[var(--line)] px-3 py-2">{e.name}</td>
                    <td className="border border-[var(--line)] px-3 py-2 text-center">
                      {e.total > 0 ? e.midterm : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-3 py-2 text-center">
                      {e.total > 0 ? e.final : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-3 py-2 text-center font-semibold">
                      {e.total > 0 ? e.total : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-3 py-2 text-center font-bold text-slate-900">
                      {e.grade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* GPA */}
            <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-amber-600" />
                <span className="text-sm font-semibold text-slate-800">เกรดเฉลี่ยรวม (GPA)</span>
              </div>
              <span className="text-2xl font-bold text-amber-700">
                {summary.gpa > 0 ? summary.gpa.toFixed(2) : '-'}
              </span>
            </div>
          </div>

          {/* บันทึกประจำตัว */}
          <div className="border-t border-[var(--line)] px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
              <NotebookPen size={16} className="text-violet-600" />
              <span className="text-sm font-bold text-slate-800">
                บันทึกประจำตัวนักเรียน (ล่าสุด 5 รายการ)
              </span>
            </div>
            {notes.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
                ยังไม่มีบันทึกประจำตัวสำหรับนักเรียนคนนี้
              </p>
            ) : (
              <ul className="space-y-2">
                {notes.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--line)] px-4 py-2.5"
                  >
                    <span className="min-w-[90px] flex-shrink-0 rounded-md bg-violet-50 px-2 py-1 text-center text-xs font-bold text-violet-700">
                      {formatThaiShortDate(n.date)}
                    </span>
                    <span className="flex-1 text-sm text-slate-700">{n.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatThaiShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d} ${months[m - 1]} ${y + 543}`
}

export default function ReportCardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl">
          <div className="skeleton mb-4 h-6 w-40" />
          <div className="skeleton mb-4 h-40 w-full rounded-[var(--radius-lg)]" />
          <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <ReportCardContent />
    </Suspense>
  )
}
