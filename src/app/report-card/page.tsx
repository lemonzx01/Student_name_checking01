'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Award,
  Download,
  FileText,
  User,
} from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/PageHeader'
import {
  getClassrooms,
  getGradesData,
  getPhotoDataUrl,
  getStudents,
} from '@/lib/client-data'
import { useSubjects, type SubjectWithMeta } from '@/lib/hooks/useSubjects'
import {
  Classroom,
  Student,
  calculateGrade,
} from '@/types/index'

type SemScore = { midterm: number; final: number }
// เก็บคะแนนทั้งปีเป็นโครงสร้างเดียว — แยกตามภาคเรียน เพื่อให้ตรงกับหน้า /grades
// ซึ่งคิดเกรด "ทั้งปี" จากการรวม sem1 + sem2 (ต่อวิชาคะแนนเต็ม 100)
type AnnualGrade = { sem1: SemScore; sem2: SemScore }
type SubjectGrades = Record<string, AnnualGrade>
type StudentGrades = Record<number, SubjectGrades>

const EMPTY_ANNUAL: AnnualGrade = {
  sem1: { midterm: 0, final: 0 },
  sem2: { midterm: 0, final: 0 },
}

function displayName(student: Student) {
  return [student.title, student.first_name, student.last_name].filter(Boolean).join(' ')
}

function computeAnnualTotal(g: AnnualGrade): number {
  return (
    (Number(g.sem1.midterm) || 0) +
    (Number(g.sem1.final) || 0) +
    (Number(g.sem2.midterm) || 0) +
    (Number(g.sem2.final) || 0)
  )
}

// รายวิชาที่ "ครูคนนี้ใช้จริง" = มีคะแนนอย่างน้อย 1 คนในห้อง (ทั้งปี)
function deriveActiveSubjectCodes(
  allGrades: StudentGrades,
  subjects: SubjectWithMeta[]
): string[] {
  const codes = new Set<string>()
  for (const subjectGrades of Object.values(allGrades)) {
    for (const [code, g] of Object.entries(subjectGrades)) {
      if (computeAnnualTotal(g) > 0) {
        codes.add(code)
      }
    }
  }
  // เรียงตามลำดับใน live subjects (เผื่อครูเปลี่ยนชื่อ/ลำดับวิชา)
  return subjects.filter((s) => codes.has(s.code)).map((s) => s.code)
}

function computeSummary(
  subjectGrades: SubjectGrades,
  activeCodes: string[],
  subjects: SubjectWithMeta[]
) {
  const activeSet = new Set(activeCodes)
  const entries = subjects.filter((s) => activeSet.has(s.code)).map((subj) => {
    const g = subjectGrades[subj.code] || EMPTY_ANNUAL
    const total = computeAnnualTotal(g)
    const grade = total > 0 ? calculateGrade(total) : '-'
    return {
      code: subj.code,
      name: subj.name,
      s1m: g.sem1.midterm,
      s1f: g.sem1.final,
      s2m: g.sem2.midterm,
      s2f: g.sem2.final,
      total,
      grade,
    }
  })
  const graded = entries.filter((e) => e.total > 0)
  const gpa =
    graded.length > 0
      ? graded.reduce((sum, e) => sum + Number(e.grade), 0) / graded.length
      : 0
  return { entries, gpa }
}

// รวม rows ของ sem1 และ sem2 เป็น StudentGrades โครงสร้างเดียว
function mergeAnnualGrades(sem1Rows: any[], sem2Rows: any[]): StudentGrades {
  const map: StudentGrades = {}
  const apply = (rows: any[], semKey: 'sem1' | 'sem2') => {
    for (const r of rows) {
      const sid = Number(r.student_id)
      const code = r.subject_code
      if (!sid || !code) continue
      if (!map[sid]) map[sid] = {}
      if (!map[sid][code]) {
        map[sid][code] = {
          sem1: { midterm: 0, final: 0 },
          sem2: { midterm: 0, final: 0 },
        }
      }
      map[sid][code][semKey] = {
        midterm: Number(r.midterm_score) || 0,
        final: Number(r.final_score) || 0,
      }
    }
  }
  apply(sem1Rows, 'sem1')
  apply(sem2Rows, 'sem2')
  return map
}

function ReportCardContent() {
  const searchParams = useSearchParams()
  const classroomFromUrl = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<StudentGrades>({})
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    classroomFromUrl ? Number(classroomFromUrl) : null
  )
  const [academicYear, setAcademicYear] = useState<string>(
    String(new Date().getFullYear() + 543)
  )
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { subjects } = useSubjects()

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
    // โหลด sem1 + sem2 พร้อมกัน — รวมเป็นโครงสร้าง annual (ตรงกับหน้า /grades)
    Promise.all([
      getStudents(selectedClassroom),
      getGradesData(selectedClassroom, 1, academicYear),
      getGradesData(selectedClassroom, 2, academicYear),
    ])
      .then(([studentRows, sem1Rows, sem2Rows]) => {
        setStudents(studentRows)
        setGrades(mergeAnnualGrades(sem1Rows, sem2Rows))
        // เลือกนักเรียนคนแรกถ้ายังไม่ได้เลือก
        if (studentRows.length > 0 && !studentRows.some((s) => s.id === selectedStudentId)) {
          setSelectedStudentId(studentRows[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedClassroom, academicYear])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  )

  const selectedClassroomObj = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroom) ?? null,
    [classrooms, selectedClassroom]
  )

  // รายวิชาที่ครูใช้จริง (มีคะแนน) — คำนวณจาก grades ของห้องปัจจุบัน
  const activeSubjectCodes = useMemo(
    () => deriveActiveSubjectCodes(grades, subjects),
    [grades, subjects]
  )

  const summary = useMemo(() => {
    if (!selectedStudent) return null
    const studentSubjectGrades = grades[selectedStudent.id] || {}
    return computeSummary(studentSubjectGrades, activeSubjectCodes, subjects)
  }, [grades, selectedStudent, activeSubjectCodes, subjects])

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

        const studentSubjectGrades = grades[student.id] || {}
        const { entries, gpa } = computeSummary(studentSubjectGrades, activeSubjectCodes, subjects)

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
        doc.text(`ปีการศึกษา ${academicYear}`, 105, 25, { align: 'center' })

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

        // Subjects table — แสดงคะแนนทั้ง 2 ภาคเรียน + รวมทั้งปี + เกรด (ตรงกับหน้า /grades)
        ;(autoTable as any)(doc, {
          head: [
            [
              { content: 'รหัส', rowSpan: 2 },
              { content: 'รายวิชา', rowSpan: 2 },
              { content: 'ภาคเรียนที่ 1', colSpan: 2 },
              { content: 'ภาคเรียนที่ 2', colSpan: 2 },
              { content: 'รวม', rowSpan: 2 },
              { content: 'เกรด', rowSpan: 2 },
            ],
            ['กลาง', 'ปลาย', 'กลาง', 'ปลาย'],
          ],
          body: entries.map((e) => [
            e.code,
            e.name,
            e.total > 0 ? String(e.s1m || '-') : '-',
            e.total > 0 ? String(e.s1f || '-') : '-',
            e.total > 0 ? String(e.s2m || '-') : '-',
            e.total > 0 ? String(e.s2f || '-') : '-',
            e.total > 0 ? String(e.total) : '-',
            e.grade,
          ]),
          startY: 58,
          theme: 'grid',
          styles: {
            font: 'NotoSansThai',
            fontSize: 9,
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            halign: 'center',
            valign: 'middle',
          },
          headStyles: {
            fillColor: [235, 240, 250],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: 'NotoSansThai',
          },
          columnStyles: {
            0: { cellWidth: 14 },
            1: { cellWidth: 50, halign: 'left' },
            2: { cellWidth: 18 },
            3: { cellWidth: 18 },
            4: { cellWidth: 18 },
            5: { cellWidth: 18 },
            6: { cellWidth: 24, fontStyle: 'bold' },
            7: { cellWidth: 22, fontStyle: 'bold' },
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
          ? `report-card_${displayName(selectedStudent).replace(/\s+/g, '_')}_ปี${academicYear}.pdf`
          : `report-card_ห้อง${selectedClassroomObj.name}_ปี${academicYear}.pdf`

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
      <PageHeader
        icon={FileText}
        badge="Report Card"
        tone="warn"
        title="ใบรายงานคะแนน"
        subtitle="ดาวน์โหลด PDF คะแนนนักเรียนรายคนหรือทั้งห้อง (แสดงเฉพาะวิชาที่กรอกคะแนนแล้ว) พร้อมบันทึกประจำตัว"
      />

      {/* Controls */}
      <section className="card animate-slide-up mb-5 p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">ห้องเรียน</label>
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
            <label className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">ปีการศึกษา</label>
            <CustomSelect
              value={academicYear}
              onChange={(v) => setAcademicYear(String(v))}
              options={yearOptions}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">นักเรียน</label>
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

        {/* Action buttons */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={exporting || !selectedStudent || activeSubjectCodes.length === 0}
            onClick={() => buildAndDownloadPdf('single')}
            className="btn btn-primary btn-lg"
          >
            <Download size={16} />
            {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF (นักเรียนคนนี้)'}
          </button>
          <button
            type="button"
            disabled={exporting || students.length === 0 || activeSubjectCodes.length === 0}
            onClick={() => buildAndDownloadPdf('all')}
            className="btn btn-brand-ghost btn-lg"
          >
            <FileText size={16} />
            ดาวน์โหลด PDF (ทั้งห้อง {students.length} คน)
          </button>
        </div>

        {message ? (
          <div className="mt-4">
            <span className={`pill ${message.type === 'success' ? 'pill-ok' : 'pill-danger'}`}>
              {message.text}
            </span>
          </div>
        ) : null}

        {/* Warning banner - เฉพาะกรณียังไม่มีวิชาที่กรอกคะแนน */}
        {!loading && selectedClassroom && activeSubjectCodes.length === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--line-soft)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text)]">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[var(--warning)]" />
            <div>
              <span className="font-semibold text-[var(--warning-strong)]">ยังไม่มีวิชาที่กรอกคะแนน</span>{' '}
              สำหรับห้องนี้ ปีการศึกษา {academicYear} —{' '}
              <Link
                href={`/grades?classroom=${selectedClassroom}`}
                className="font-semibold text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-strong)]"
              >
                ไปกรอกคะแนนก่อน
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {/* Preview */}
      {loading ? (
        <div className="card p-8">
          <div className="skeleton mb-3 h-5 w-48" />
          <div className="skeleton mb-2 h-4 w-full" />
          <div className="skeleton mb-2 h-4 w-5/6" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      ) : !selectedStudent || !summary ? (
        <div className="empty-state">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--warning-soft)] text-[var(--warning)]">
            <AlertTriangle size={22} />
          </div>
          <p className="text-lg font-bold text-[var(--text)]">
            {students.length === 0
              ? 'ห้องนี้ยังไม่มีนักเรียน'
              : 'กรุณาเลือกนักเรียนเพื่อดูตัวอย่าง'}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            เมื่อเลือกแล้ว คุณจะเห็นตัวอย่าง PDF ที่จะดาวน์โหลด
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden print:border-0 print:shadow-none">
          {/* Header ในตัวอย่าง */}
          <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-6 py-4 print:bg-[var(--surface)]">
            <p className="text-center text-lg font-bold text-[var(--text)]">
              ใบรายงานคะแนนนักเรียน
            </p>
            <p className="mt-1 text-center text-sm text-[var(--muted)]">
              ปีการศึกษา {academicYear}
            </p>
          </div>

          {/* ข้อมูลนักเรียน */}
          <div className="grid gap-3 border-b border-[var(--line)] px-6 py-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-ghost)] text-[var(--primary)]">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ชื่อ–นามสกุล</p>
                <p className="text-base font-bold text-[var(--text)]">{displayName(selectedStudent)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">เลขที่</p>
                <p className="text-base font-bold text-[var(--text)]">
                  {selectedStudent.student_number || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">รหัสนักเรียน</p>
                <p className="text-base font-bold text-[var(--text)]">
                  {selectedStudent.student_id || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">ห้องเรียน</p>
                <p className="text-base font-bold text-[var(--text)]">
                  {selectedClassroomObj?.name || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* ตารางคะแนน — แสดงทั้ง 2 ภาคเรียน + รวมทั้งปี + เกรด */}
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-[var(--primary-ghost)] text-xs font-bold uppercase tracking-wider text-[var(--text-soft)]">
                  <th className="border border-[var(--line)] px-2 py-2 text-left" rowSpan={2}>รหัส</th>
                  <th className="border border-[var(--line)] px-2 py-2 text-left" rowSpan={2}>รายวิชา</th>
                  <th className="border border-[var(--line)] px-2 py-1 text-center" colSpan={2}>ภาคเรียนที่ 1</th>
                  <th className="border border-[var(--line)] px-2 py-1 text-center" colSpan={2}>ภาคเรียนที่ 2</th>
                  <th className="border border-[var(--line)] px-2 py-2 text-center" rowSpan={2}>รวม</th>
                  <th className="border border-[var(--line)] px-2 py-2 text-center" rowSpan={2}>เกรด</th>
                </tr>
                <tr className="bg-[var(--primary-ghost)] text-[11px] font-semibold text-[var(--text-soft)]">
                  <th className="border border-[var(--line)] px-2 py-1 text-center">กลาง</th>
                  <th className="border border-[var(--line)] px-2 py-1 text-center">ปลาย</th>
                  <th className="border border-[var(--line)] px-2 py-1 text-center">กลาง</th>
                  <th className="border border-[var(--line)] px-2 py-1 text-center">ปลาย</th>
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((e) => (
                  <tr key={e.code}>
                    <td className="border border-[var(--line)] px-2 py-2 font-mono text-xs text-[var(--text-soft)]">
                      {e.code}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-[var(--text)]">{e.name}</td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center text-[var(--text)]">
                      {e.total > 0 ? (e.s1m || '-') : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center text-[var(--text)]">
                      {e.total > 0 ? (e.s1f || '-') : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center text-[var(--text)]">
                      {e.total > 0 ? (e.s2m || '-') : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center text-[var(--text)]">
                      {e.total > 0 ? (e.s2f || '-') : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center font-semibold text-[var(--text)]">
                      {e.total > 0 ? e.total : '-'}
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2 text-center font-bold text-[var(--text)]">
                      {e.grade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* GPA */}
            <div className="mt-4 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-[var(--warning-strong)]" />
                <span className="text-sm font-semibold text-[var(--text)]">เกรดเฉลี่ยรวม (GPA)</span>
              </div>
              <span className="text-2xl font-bold text-[var(--warning-strong)]">
                {summary.gpa > 0 ? summary.gpa.toFixed(2) : '-'}
              </span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
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
