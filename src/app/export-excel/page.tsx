'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Download,
  BookOpenCheck,
  ClipboardCheck,
  Heart,
  Loader2,
  CheckCircle2,
  File,
  Activity,
} from 'lucide-react'
import { type Classroom, type Student, DEFAULT_SUBJECTS, calculateGrade } from '@/types/index'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'
import { useDialog } from '@/lib/hooks/useConfirm'
const loadThaiFont = () => import('@/lib/thai-font').then((m) => m.NotoSansThai)

// Lazy loaders
const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default || xlsx
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}

const loadJsPDF = async () => {
  try {
    const jspdfModule = await import('jspdf')
    const jsPDF = jspdfModule.default || jspdfModule.jsPDF
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = autoTableModule.default || autoTableModule
    return { jsPDF, autoTable }
  } catch (e) {
    console.error('Failed to load jspdf:', e)
    return null
  }
}

interface AttendanceEntry {
  student_id: number
  classroom_id: number
  date: string
  status: string
  note: string
}

interface HealthEntry {
  student_id: number
  classroom_id: number
  date: string
  brushed_teeth: boolean
  drank_milk: boolean
}

interface WeightHeightRecord {
  student_id: number
  student_name: string
  student_code: string
  weight: number
  height: number
  bmi: number
  bmi_status: string
  date: string
}

type ExportFormat = 'excel' | 'pdf' | 'csv'
type ExportType = 'attendance' | 'health' | 'weight_height' | 'grades'

function ExportPageContent() {
  const searchParams = useSearchParams()
  const urlClassroom = searchParams.get('classroom')

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    urlClassroom ? Number(urlClassroom) : null
  )
  useEffect(() => {
    if (urlClassroom) {
      setSelectedClassroom(Number(urlClassroom))
      return
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null
    if (stored) setSelectedClassroom(Number(stored))
  }, [urlClassroom])
  const [currentClassroomName, setCurrentClassroomName] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportedFiles, setExportedFiles] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel')
  const [gradeSemester, setGradeSemester] = useState(1)
  const [gradeYear, setGradeYear] = useState(String(new Date().getFullYear() + 543))
  const [toast, setToast] = useState<string | null>(null)
  const { alert } = useDialog()

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    loadClassrooms()
  }, [])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(data)
      if (selectedClassroom) {
        const current = data.find((c: Classroom) => c.id === selectedClassroom)
        if (current) setCurrentClassroomName(current.name)
      }
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    }
  }

  const fetchExportData = async () => {
    const res = await fetch(
      `/api/export-excel?classroom=${selectedClassroom}&startDate=${startDate}&endDate=${endDate}`
    )
    if (!res.ok) throw new Error('Failed to fetch data')
    return res.json()
  }

  // ============================================================
  // EXCEL EXPORTS — 3 separate files
  // ============================================================
  const exportAttendanceExcel = async () => {
    const XLSX = await loadXLSX()
    if (!XLSX) throw new Error('ไม่สามารถโหลด xlsx')

    const data = await fetchExportData()
    const { students, attendance, attendanceDates } = data as {
      students: Student[]
      attendance: AttendanceEntry[]
      attendanceDates: string[]
    }

    const workbook = XLSX.utils.book_new()

    // Sheet 1: สรุปเช็คชื่อ
    const attHeaders = ['#', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลาป่วย', 'ลากิจ', 'รวมวัน']
    const attRows: (string | number)[][] = []
    students.forEach((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      attRows.push([
        index + 1, student.student_id, `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลาป่วย').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลากิจ').length,
        attendanceDates.length,
      ])
    })
    const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows])
    wsAtt['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(workbook, wsAtt, 'สรุปเช็คชื่อ')

    const fileName = `เช็คชื่อ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const exportHealthExcel = async () => {
    const XLSX = await loadXLSX()
    if (!XLSX) throw new Error('ไม่สามารถโหลด xlsx')

    const data = await fetchExportData()
    const { students, health, healthDates } = data as { students: Student[]; health: HealthEntry[]; healthDates: string[] }

    const workbook = XLSX.utils.book_new()

    // สรุปสุขภาพ (sheet เดียว)
    const healthSumHeaders = ['#', 'รหัส', 'ชื่อ-นามสกุล', 'แปรงฟัน (วัน)', 'ดื่มนม (วัน)', 'รวมวันที่บันทึก']
    const healthSumRows: (string | number)[][] = []
    students.forEach((student: Student, index: number) => {
      const sh = health.filter((h: HealthEntry) => h.student_id === student.id)
      healthSumRows.push([
        index + 1, student.student_id, `${student.first_name} ${student.last_name}`,
        sh.filter((h: HealthEntry) => h.brushed_teeth).length,
        sh.filter((h: HealthEntry) => h.drank_milk).length,
        healthDates.length,
      ])
    })
    const wsHealthSum = XLSX.utils.aoa_to_sheet([healthSumHeaders, ...healthSumRows])
    wsHealthSum['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(workbook, wsHealthSum, 'สรุปสุขภาพ')

    const fileName = `สุขภาพ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const exportWeightHeightExcel = async () => {
    const XLSX = await loadXLSX()
    if (!XLSX) throw new Error('ไม่สามารถโหลด xlsx')

    const { students, records } = await fetchWeightHeightData()
    const workbook = XLSX.utils.book_new()

    // สรุปน้ำหนัก/ส่วนสูง/BMI (sheet เดียว)
    const bmiHeaders = ['#', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ']
    const bmiRows: (string | number)[][] = students.map((student, index) => {
      const studentRecs = records
        .filter(r => r.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const latest = studentRecs[0]
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        latest?.weight || '-',
        latest?.height || '-',
        latest?.bmi || '-',
        latest?.bmi_status || '-',
      ]
    })
    const wsBMI = XLSX.utils.aoa_to_sheet([bmiHeaders, ...bmiRows])
    wsBMI['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(workbook, wsBMI, 'สรุปน้ำหนักส่วนสูง')

    const fileName = `น้ำหนักส่วนสูง_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const fetchGradeData = async () => {
    // Fetch students and grades separately, then merge
    const [studentsRes, gradesRes] = await Promise.all([
      fetch(`/api/students?classroom=${selectedClassroom}`),
      fetch(`/api/grades?classroom=${selectedClassroom}&semester=${gradeSemester}&year=${gradeYear}`),
    ])
    if (!studentsRes.ok) throw new Error('Failed to fetch students')
    if (!gradesRes.ok) throw new Error('Failed to fetch grade data')

    const students = await studentsRes.json() as Student[]
    const gradeRows = await gradesRes.json() as { student_id: number; subject_code: string; score: number }[]

    // Build grade lookup: student_id -> { subject_code: score }
    const gradeMap = new Map<number, Record<string, number>>()
    gradeRows.forEach((row) => {
      if (!gradeMap.has(row.student_id)) {
        gradeMap.set(row.student_id, {})
      }
      if (row.subject_code && row.score !== null) {
        gradeMap.get(row.student_id)![row.subject_code] = row.score
      }
    })

    return students.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      first_name: s.first_name,
      last_name: s.last_name,
      scores: gradeMap.get(s.id) || {},
    }))
  }

  const exportGradesExcel = async () => {
    const XLSX = await loadXLSX()
    if (!XLSX) throw new Error('ไม่สามารถโหลด xlsx')

    const students = await fetchGradeData()
    const workbook = XLSX.utils.book_new()

    const headers = ['#', 'รหัส', 'ชื่อ-นามสกุล', ...DEFAULT_SUBJECTS.map((s) => s.name), 'เฉลี่ย', 'เกรดเฉลี่ย']
    const dataRows = students.map((student, i) => {
      const scores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code] ?? '')
      const validScores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code]).filter((v) => v !== undefined && v !== null)
      const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0
      const avgGrade = validScores.length > 0 ? calculateGrade(avg) : '-'
      return [i + 1, student.student_id, `${student.first_name} ${student.last_name}`, ...scores, validScores.length > 0 ? Math.round(avg * 100) / 100 : '-', avgGrade]
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 25 }, ...DEFAULT_SUBJECTS.map(() => ({ wch: 10 })), { wch: 8 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(workbook, ws, 'คะแนน-เกรด')

    const fileName = `เกรด_${currentClassroomName || selectedClassroom}_ภาค${gradeSemester}_${gradeYear}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // ============================================================
  // PDF EXPORTS
  // ============================================================
  const exportAttendancePDF = async () => {
    const loaded = await loadJsPDF()
    if (!loaded) throw new Error('ไม่สามารถโหลด jspdf')
    const { jsPDF, autoTable } = loaded

    const data = await fetchExportData()
    const { students, attendance, attendanceDates } = data as {
      students: Student[]; attendance: AttendanceEntry[]; attendanceDates: string[]
    }

    const NotoSansThai = await loadThaiFont()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Setup Thai font
    doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
    doc.setFont('NotoSansThai')

    // Title
    doc.setFontSize(16)
    doc.text(`สรุปเช็คชื่อ - ${currentClassroomName || `ห้อง ${selectedClassroom}`}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`ช่วงวันที่: ${formatDateThai(startDate)} - ${formatDateThai(endDate)}`, 14, 22)

    // Summary table
    const tableHeaders = [['#', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลาป่วย', 'ลากิจ', 'รวมวัน']]
    const tableRows = students.map((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลาป่วย').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลากิจ').length,
        attendanceDates.length,
      ]
    })

    ;(autoTable as any)(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 2, font: 'NotoSansThai', halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, font: 'NotoSansThai', halign: 'center' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 22 },
      },
    })

    doc.save(`เช็คชื่อ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.pdf`)
  }

  const exportHealthPDF = async () => {
    const loaded = await loadJsPDF()
    if (!loaded) throw new Error('ไม่สามารถโหลด jspdf')
    const { jsPDF, autoTable } = loaded

    const data = await fetchExportData()
    const { students, health, healthDates } = data as {
      students: Student[]; health: HealthEntry[]; healthDates: string[]
    }

    const NotoSansThai = await loadThaiFont()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Setup Thai font
    doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
    doc.setFont('NotoSansThai')

    doc.setFontSize(16)
    doc.text(`สรุปสุขภาพ - ${currentClassroomName || `ห้อง ${selectedClassroom}`}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`ช่วงวันที่: ${formatDateThai(startDate)} - ${formatDateThai(endDate)}`, 14, 22)

    const tableHeaders = [['#', 'รหัส', 'ชื่อ-นามสกุล', 'แปรงฟัน (วัน)', 'ดื่มนม (วัน)', 'รวมวัน']]
    const tableRows = students.map((student: Student, index: number) => {
      const sh = health.filter((h: HealthEntry) => h.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        sh.filter((h: HealthEntry) => h.brushed_teeth).length,
        sh.filter((h: HealthEntry) => h.drank_milk).length,
        healthDates.length,
      ]
    })

    ;(autoTable as any)(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 2, font: 'NotoSansThai', halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, font: 'NotoSansThai', halign: 'center' },
      alternateRowStyles: { fillColor: [253, 242, 248] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 25 },
      },
    })

    doc.save(`สุขภาพ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.pdf`)
  }

  const exportGradesPDF = async () => {
    const loaded = await loadJsPDF()
    if (!loaded) throw new Error('ไม่สามารถโหลด jspdf')
    const { jsPDF, autoTable } = loaded

    const students = await fetchGradeData()

    const NotoSansThai = await loadThaiFont()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
    doc.setFont('NotoSansThai')

    doc.setFontSize(16)
    doc.text(`สรุปคะแนน/เกรด - ${currentClassroomName || `ห้อง ${selectedClassroom}`}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`ภาคเรียนที่ ${gradeSemester} ปีการศึกษา ${gradeYear}`, 14, 22)

    const headers = [['#', 'รหัส', 'ชื่อ-นามสกุล', ...DEFAULT_SUBJECTS.map((s) => s.name), 'เฉลี่ย', 'เกรด']]
    const rows = students.map((student, i) => {
      const scores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code] !== undefined ? String(student.scores[s.code]) : '-')
      const validScores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code]).filter((v) => v !== undefined && v !== null)
      const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0
      return [String(i + 1), student.student_id, `${student.first_name} ${student.last_name}`, ...scores, validScores.length > 0 ? String(Math.round(avg * 100) / 100) : '-', validScores.length > 0 ? calculateGrade(avg) : '-']
    })

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      styles: { fontSize: 7, cellPadding: 2, font: 'NotoSansThai', halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, font: 'NotoSansThai', halign: 'center' },
      columnStyles: { 2: { halign: 'left' } },
    })

    doc.save(`เกรด_${currentClassroomName || selectedClassroom}_ภาค${gradeSemester}_${gradeYear}.pdf`)
  }

  // ============================================================
  // CSV EXPORTS
  // ============================================================
  const csvEscape = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"'
    }
    return val
  }

  const downloadCSV = (content: string, fileName: string) => {
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportAttendanceCSV = async () => {
    const data = await fetchExportData()
    const { students, attendance, attendanceDates } = data as {
      students: Student[]; attendance: AttendanceEntry[]; attendanceDates: string[]
    }

    const headers = ['ลำดับ', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลาป่วย', 'ลากิจ', 'รวมวัน']
    const rows = students.map((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลาป่วย').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลากิจ').length,
        attendanceDates.length,
      ].map(v => csvEscape(String(v))).join(',')
    })

    const csv = [headers.map(h => csvEscape(h)).join(','), ...rows].join('\n')
    downloadCSV(csv, `เช็คชื่อ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.csv`)
  }

  const exportHealthCSV = async () => {
    const data = await fetchExportData()
    const { students, health, healthDates } = data as {
      students: Student[]; health: HealthEntry[]; healthDates: string[]
    }

    const headers = ['ลำดับ', 'รหัส', 'ชื่อ-นามสกุล', 'แปรงฟัน (วัน)', 'ดื่มนม (วัน)', 'รวมวัน']
    const rows = students.map((student: Student, index: number) => {
      const sh = health.filter((h: HealthEntry) => h.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        sh.filter((h: HealthEntry) => h.brushed_teeth).length,
        sh.filter((h: HealthEntry) => h.drank_milk).length,
        healthDates.length,
      ].map(v => csvEscape(String(v))).join(',')
    })

    const csv = [headers.map(h => csvEscape(h)).join(','), ...rows].join('\n')
    downloadCSV(csv, `สุขภาพ_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.csv`)
  }

  // ============================================================
  // WEIGHT/HEIGHT (PDF/CSV only — Excel is combined in exportAllExcel)
  // ============================================================
  const fetchWeightHeightData = async () => {
    const res = await fetch(
      `/api/health?classroom=${selectedClassroom}&mode=export&startDate=${startDate}&endDate=${endDate}`
    )
    if (!res.ok) throw new Error('Failed to fetch weight/height data')
    return res.json() as Promise<{
      students: Student[]
      records: WeightHeightRecord[]
      dates: string[]
    }>
  }

  const exportWeightHeightPDF = async () => {
    const loaded = await loadJsPDF()
    if (!loaded) throw new Error('ไม่สามารถโหลด jspdf')
    const { jsPDF, autoTable } = loaded

    const { students, records } = await fetchWeightHeightData()

    const NotoSansThai = await loadThaiFont()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Setup Thai font
    doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
    doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
    doc.setFont('NotoSansThai')

    doc.setFontSize(16)
    doc.text(`สรุปน้ำหนัก/ส่วนสูง - ${currentClassroomName || `ห้อง ${selectedClassroom}`}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`ช่วงวันที่: ${formatDateThai(startDate)} - ${formatDateThai(endDate)}`, 14, 22)

    const tableHeaders = [['#', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ']]
    const tableRows = students.map((student, index) => {
      const studentRecs = records
        .filter(r => r.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const latest = studentRecs[0]
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        latest?.weight || '-',
        latest?.height || '-',
        latest?.bmi || '-',
        latest?.bmi_status || '-',
      ]
    })

    // BMI summary counts
    const bmiCounts = { thin: 0, normal: 0, over: 0, obese: 0, vobese: 0 }
    students.forEach(student => {
      const studentRecs = records
        .filter(r => r.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const latest = studentRecs[0]
      if (latest?.bmi_status === 'ผอม') bmiCounts.thin++
      else if (latest?.bmi_status === 'ปกติ') bmiCounts.normal++
      else if (latest?.bmi_status === 'น้ำหนักเกิน') bmiCounts.over++
      else if (latest?.bmi_status === 'อ้วน') bmiCounts.obese++
      else if (latest?.bmi_status === 'อ้วนมาก') bmiCounts.vobese++
    })

    ;(autoTable as any)(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 2, font: 'NotoSansThai', halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, font: 'NotoSansThai', halign: 'center' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 25 },
      },
    })

    // Add BMI summary below table
    const finalY = (doc as any).lastAutoTable?.finalY || 200
    doc.setFontSize(10)
    doc.text(`สรุป BMI: ผอม ${bmiCounts.thin} | ปกติ ${bmiCounts.normal} | น้ำหนักเกิน ${bmiCounts.over} | อ้วน ${bmiCounts.obese} | อ้วนมาก ${bmiCounts.vobese}`, 14, finalY + 10)

    doc.save(`น้ำหนักส่วนสูง_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.pdf`)
  }

  const exportWeightHeightCSV = async () => {
    const { students, records } = await fetchWeightHeightData()

    const headers = ['ลำดับ', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ']
    const rows = students.map((student, index) => {
      const studentRecs = records
        .filter(r => r.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const latest = studentRecs[0]
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        latest?.weight || 0,
        latest?.height || 0,
        latest?.bmi || 0,
        latest?.bmi_status || '-',
      ].map(v => csvEscape(String(v))).join(',')
    })

    const csv = [headers.map(h => csvEscape(h)).join(','), ...rows].join('\n')
    downloadCSV(csv, `น้ำหนักส่วนสูง_${currentClassroomName || selectedClassroom}_${startDate}_${endDate}.csv`)
  }

  const exportGradesCSV = async () => {
    const students = await fetchGradeData()
    const headers = ['ลำดับ', 'รหัส', 'ชื่อ-นามสกุล', ...DEFAULT_SUBJECTS.map((s) => s.name), 'เฉลี่ย', 'เกรดเฉลี่ย']
    const rows = students.map((student, i) => {
      const scores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code] !== undefined ? student.scores[s.code] : '')
      const validScores = DEFAULT_SUBJECTS.map((s) => student.scores[s.code]).filter((v) => v !== undefined && v !== null)
      const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0
      return [i + 1, student.student_id, `${student.first_name} ${student.last_name}`, ...scores, validScores.length > 0 ? Math.round(avg * 100) / 100 : '-', validScores.length > 0 ? calculateGrade(avg) : '-'].map((v) => csvEscape(String(v))).join(',')
    })
    const csv = [headers.map((h) => csvEscape(h)).join(','), ...rows].join('\n')
    downloadCSV(csv, `เกรด_${currentClassroomName || selectedClassroom}_ภาค${gradeSemester}_${gradeYear}.csv`)
  }

  // ============================================================
  // UNIFIED EXPORT HANDLER
  // ============================================================
  const handleExport = async (type: ExportType) => {
    if (!selectedClassroom) return
    const key = `${type}-${selectedFormat}`
    setExporting(key)
    try {
      if (selectedFormat === 'excel') {
        if (type === 'attendance') await exportAttendanceExcel()
        else if (type === 'health') await exportHealthExcel()
        else if (type === 'grades') await exportGradesExcel()
        else await exportWeightHeightExcel()
      } else if (selectedFormat === 'pdf') {
        if (type === 'attendance') await exportAttendancePDF()
        else if (type === 'health') await exportHealthPDF()
        else if (type === 'grades') await exportGradesPDF()
        else await exportWeightHeightPDF()
      } else {
        if (type === 'attendance') await exportAttendanceCSV()
        else if (type === 'health') await exportHealthCSV()
        else if (type === 'grades') await exportGradesCSV()
        else await exportWeightHeightCSV()
      }
      setExportedFiles(prev => [...prev, key])
      const names: Record<string, string> = { attendance: 'เช็คชื่อ', health: 'สุขภาพ', weight_height: 'น้ำหนัก/ส่วนสูง', grades: 'คะแนน/เกรด' }
      showToast(`ดาวน์โหลด${names[type] || ''}สำเร็จแล้ว!`)
    } catch (error) {
      console.error('Export error:', error)
      await alert({
        title: 'ส่งออกไม่สำเร็จ',
        message: 'เกิดข้อผิดพลาดในการส่งออก — ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setExporting(null)
    }
  }

  const exportAll = async () => {
    setExportedFiles([])
    await handleExport('attendance')
    await handleExport('health')
    await handleExport('weight_height')
    await handleExport('grades')
  }

  const formatIcon = {
    excel: <FileSpreadsheet size={18} />,
    pdf: <FileText size={18} />,
    csv: <FileDown size={18} />,
  }

  const formatExt = { excel: '.xlsx', pdf: '.pdf', csv: '.csv' }

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100]">
          <div className="toast-enter flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-[var(--shadow-lg)]">
            <CheckCircle2 size={20} />
            <span className="font-medium text-sm">{toast}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          <File size={13} />
          Export Manager
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">ส่งออกเอกสาร</h1>
        <p className="text-sm text-slate-500 mt-1">เลือกห้อง ช่วงเวลา และรูปแบบไฟล์ที่ต้องการ</p>
      </div>

      {/* Settings Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">ห้องเรียน</label>
            <CustomSelect
              value={selectedClassroom ?? ''}
              onChange={(v) => {
                const id = Number(v) || null
                setSelectedClassroom(id)
                if (id) {
                  const found = classrooms.find((c) => c.id === id)
                  setCurrentClassroomName(found?.name || '')
                  localStorage.setItem('selectedClassroom', String(id))
                }
              }}
              options={[
                { value: '', label: 'เลือกห้องเรียน' },
                ...classrooms.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="เลือกห้องเรียน"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">วันที่เริ่ม</label>
            <CalendarPicker value={startDate} onChange={setStartDate} compact />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">วันที่สิ้นสุด</label>
            <CalendarPicker value={endDate} onChange={setEndDate} compact />
          </div>
        </div>

        {/* Format Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">รูปแบบไฟล์</label>
          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 relative z-30">
            {(['excel', 'pdf', 'csv'] as ExportFormat[]).map((fmt) => (
              <button
                type="button"
                key={fmt}
                onClick={() => { setSelectedFormat(fmt); setExportedFiles([]) }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedFormat === fmt
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {formatIcon[fmt]}
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ExportCard
          title="เช็คชื่อ"
          subtitle="Attendance"
          icon={<ClipboardCheck size={22} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          borderAccent="stat-blue"
          desc="สรุปมา / ขาด / ลาป่วย / ลากิจ"
          exporting={exporting === `attendance-${selectedFormat}`}
          exported={exportedFiles.includes(`attendance-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('attendance')}
          formatExt={formatExt[selectedFormat]}
        />
        <ExportCard
          title="สุขภาพ"
          subtitle="Health"
          icon={<Heart size={22} />}
          iconBg="bg-pink-100"
          iconColor="text-pink-600"
          borderAccent="stat-pink"
          desc="แปรงฟัน + ดื่มนม รายคน"
          exporting={exporting === `health-${selectedFormat}`}
          exported={exportedFiles.includes(`health-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('health')}
          formatExt={formatExt[selectedFormat]}
        />
        <ExportCard
          title="น้ำหนัก/ส่วนสูง"
          subtitle="Weight & Height"
          icon={<Activity size={22} />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          borderAccent="stat-green"
          desc="น้ำหนัก + ส่วนสูง + BMI"
          exporting={exporting === `weight_height-${selectedFormat}`}
          exported={exportedFiles.includes(`weight_height-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('weight_height')}
          formatExt={formatExt[selectedFormat]}
        />
        <ExportCard
          title="คะแนน/เกรด"
          subtitle="Grades"
          icon={<BookOpenCheck size={22} />}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          borderAccent="stat-purple"
          desc={`คะแนน/เกรด เทอม ${gradeSemester}/${gradeYear}`}
          exporting={exporting === `grades-${selectedFormat}`}
          exported={exportedFiles.includes(`grades-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('grades')}
          formatExt={formatExt[selectedFormat]}
        />
      </div>

      {/* Export All */}
      <div className="rounded-2xl bg-slate-900 p-5 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-white">
            <h3 className="font-bold text-base">ดาวน์โหลดทั้งหมด</h3>
            <p className="text-xs text-slate-300 mt-0.5">รวม 4 ไฟล์ — เช็คชื่อ, สุขภาพ, น้ำหนัก/ส่วนสูง, คะแนน</p>
          </div>
          <button
            onClick={exportAll}
            disabled={!selectedClassroom || exporting !== null}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-[var(--shadow-sm)] transition hover:bg-slate-100 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {exporting ? 'กำลังสร้าง...' : `ดาวน์โหลดทั้ง 4 ไฟล์`}
            {!exporting && exportedFiles.length >= 4 && <CheckCircle2 size={16} className="text-emerald-500" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ExportCard Component
// ============================================================
function ExportCard({
  title, subtitle, icon, iconBg, iconColor, borderAccent, desc, exporting, exported, disabled, onExport, formatExt,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  borderAccent: string
  desc: string
  exporting: boolean
  exported: boolean
  disabled: boolean
  onExport: () => void
  formatExt: string
}) {
  return (
    <div className={`card-hover rounded-2xl overflow-hidden bg-white border border-[var(--line)] shadow-[var(--shadow-sm)] flex flex-col h-full ${borderAccent}`}>
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight text-slate-900">{title}</h3>
            <p className="text-[11px] text-[var(--muted)] font-medium">{subtitle} {formatExt}</p>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5 flex flex-col flex-1">
        <p className="text-sm text-[var(--muted)] mb-4 flex-1">{desc}</p>
        <button
          onClick={onExport}
          disabled={disabled}
          className={`btn-press w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all border
            ${exported
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : disabled
                ? 'bg-slate-50 text-slate-400 border-[var(--line)]'
                : 'bg-[var(--primary)] text-white border-[var(--primary)] hover:bg-[var(--primary-strong)]'
            }
            disabled:cursor-not-allowed`}
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : exported ? (
            <CheckCircle2 size={16} />
          ) : (
            <Download size={16} />
          )}
          {exporting ? 'กำลังสร้างไฟล์...' : exported ? 'ดาวน์โหลดแล้ว' : `ดาวน์โหลด ${formatExt}`}
        </button>
      </div>
    </div>
  )
}

export default function ExportExcelPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl"><div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" /></div>}>
      <ExportPageContent />
    </Suspense>
  )
}

function formatDateThai(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDate()
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${day} ${months[d.getMonth()]}`
}
