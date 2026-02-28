'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Download,
  ClipboardCheck,
  Heart,
  Loader2,
  CheckCircle2,
  School,
  File,
  Activity,
} from 'lucide-react'
import type { Classroom, Student } from '@/types/index'
import CalendarPicker from '@/components/CalendarPicker'
import { NotoSansThai } from '@/lib/thai-font'

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
type ExportType = 'attendance' | 'health' | 'weight_height'

export default function ExportPage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
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
  const [toast, setToast] = useState<string | null>(null)

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
      if (classroomId) {
        const current = data.find((c: Classroom) => c.id === Number(classroomId))
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
    const attHeaders = ['#', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลา', 'รวมวัน']
    const attRows: (string | number)[][] = []
    students.forEach((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      attRows.push([
        index + 1, student.student_id, `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลา').length,
        attendanceDates.length,
      ])
    })
    const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows])
    wsAtt['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
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
    const tableHeaders = [['#', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลา', 'รวมวัน']]
    const tableRows = students.map((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลา').length,
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
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 25 },
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

    const headers = ['ลำดับ', 'รหัส', 'ชื่อ-นามสกุล', 'มา', 'ขาด', 'ลา', 'รวมวัน']
    const rows = students.map((student: Student, index: number) => {
      const studentAtt = attendance.filter((a: AttendanceEntry) => a.student_id === student.id)
      return [
        index + 1,
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'มา').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ขาด').length,
        studentAtt.filter((a: AttendanceEntry) => a.status === 'ลา').length,
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
        else await exportWeightHeightExcel()
      } else if (selectedFormat === 'pdf') {
        if (type === 'attendance') await exportAttendancePDF()
        else if (type === 'health') await exportHealthPDF()
        else await exportWeightHeightPDF()
      } else {
        if (type === 'attendance') await exportAttendanceCSV()
        else if (type === 'health') await exportHealthCSV()
        else await exportWeightHeightCSV()
      }
      setExportedFiles(prev => [...prev, key])
      const names: Record<string, string> = { attendance: 'เช็คชื่อ', health: 'สุขภาพ', weight_height: 'น้ำหนัก/ส่วนสูง' }
      showToast(`ดาวน์โหลด${names[type] || ''}สำเร็จแล้ว!`)
    } catch (error) {
      console.error('Export error:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally {
      setExporting(null)
    }
  }

  const exportAll = async () => {
    setExportedFiles([])
    await handleExport('attendance')
    await handleExport('health')
    await handleExport('weight_height')
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
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-3 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg">
            <CheckCircle2 size={20} />
            <span className="font-medium text-sm">{toast}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <File className="text-primary" size={28} />
          ส่งออกเอกสาร
        </h1>
        <p className="text-text-secondary mt-1">
          ส่งออกข้อมูลเช็คชื่อ, สุขภาพ และน้ำหนัก/ส่วนสูง เป็น Excel, PDF หรือ CSV
        </p>
      </div>

      {/* Settings Card */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">ตั้งค่าการส่งออก</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Classroom */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">ห้องเรียน</label>
            {selectedClassroom ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl font-medium">
                <School size={16} className="text-text-secondary" />
                {currentClassroomName || `ห้อง ${selectedClassroom}`}
              </div>
            ) : (
              <div className="px-4 py-2.5 bg-gray-100 rounded-xl text-text-secondary text-sm">
                กรุณาเลือกห้องจากหน้าแรก
              </div>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">วันที่เริ่ม</label>
            <CalendarPicker value={startDate} onChange={setStartDate} compact placeholder="เลือกวันเริ่มต้น" />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">วันที่สิ้นสุด</label>
            <CalendarPicker value={endDate} onChange={setEndDate} compact placeholder="เลือกวันสิ้นสุด" />
          </div>
        </div>

        {/* Format Selector - separate row */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">รูปแบบไฟล์</label>
          <div className="flex gap-2 relative z-30">
            {(['excel', 'pdf', 'csv'] as ExportFormat[]).map((fmt) => (
              <button
                type="button"
                key={fmt}
                onClick={() => { setSelectedFormat(fmt); setExportedFiles([]) }}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  selectedFormat === fmt
                    ? fmt === 'excel' ? 'bg-green-500 text-white shadow-md ring-2 ring-green-300'
                      : fmt === 'pdf' ? 'bg-red-500 text-white shadow-md ring-2 ring-red-300'
                      : 'bg-blue-500 text-white shadow-md ring-2 ring-blue-300'
                    : 'bg-white text-text-secondary border border-border hover:bg-gray-50 hover:border-gray-300'
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Card 1: Attendance */}
        <ExportCard
          title="เช็คชื่อ"
          subtitle="Attendance"
          icon={<ClipboardCheck size={20} className="text-white" />}
          color="blue"
          format={selectedFormat}
          details={[
            { color: 'bg-blue-500', label: 'สรุปเช็คชื่อ', desc: 'มา/ขาด/ลา ต่อคน' },
          ]}
          exporting={exporting === `attendance-${selectedFormat}`}
          exported={exportedFiles.includes(`attendance-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('attendance')}
          formatExt={formatExt[selectedFormat]}
        />

        {/* Card 2: Health */}
        <ExportCard
          title="สุขภาพ"
          subtitle="Health"
          icon={<Heart size={20} className="text-white" />}
          color="pink"
          format={selectedFormat}
          details={[
            { color: 'bg-pink-500', label: 'สรุปสุขภาพ', desc: 'แปรงฟัน + ดื่มนม ต่อคน' },
          ]}
          exporting={exporting === `health-${selectedFormat}`}
          exported={exportedFiles.includes(`health-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('health')}
          formatExt={formatExt[selectedFormat]}
        />

        {/* Card 3: Weight/Height */}
        <ExportCard
          title="น้ำหนัก/ส่วนสูง"
          subtitle="Weight & Height"
          icon={<Activity size={20} className="text-white" />}
          color="green"
          format={selectedFormat}
          details={[
            { color: 'bg-green-500', label: 'สรุปน้ำหนัก/ส่วนสูง', desc: 'น้ำหนัก + ส่วนสูง + BMI ต่อคน' },
          ]}
          exporting={exporting === `weight_height-${selectedFormat}`}
          exported={exportedFiles.includes(`weight_height-${selectedFormat}`)}
          disabled={!selectedClassroom || exporting !== null}
          onExport={() => handleExport('weight_height')}
          formatExt={formatExt[selectedFormat]}
        />
      </div>

      {/* Export All */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">ส่งออกทั้งหมด</h3>
            <p className="text-sm text-text-secondary mt-1">
              ดาวน์โหลดทั้ง 3 ไฟล์ (เช็คชื่อ + สุขภาพ + น้ำหนัก/ส่วนสูง) เป็น {selectedFormat.toUpperCase()}
            </p>
          </div>
          <button
            onClick={exportAll}
            disabled={!selectedClassroom || exporting !== null}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Download size={20} />
            )}
            {exporting
              ? 'กำลังสร้างไฟล์...'
              : `ดาวน์โหลดทั้ง 3 ไฟล์ (${formatExt[selectedFormat]})${exportedFiles.length >= 3 ? ' ✓' : ''}`}
          </button>
        </div>
      </div>

      {/* Format Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-border">
        <h3 className="text-sm font-medium text-text-secondary mb-3">เปรียบเทียบรูปแบบ</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className={`p-3 rounded-lg border-2 transition-colors ${selectedFormat === 'excel' ? 'border-green-400 bg-green-50' : 'border-transparent bg-white'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet size={16} className="text-green-600" />
              <span className="font-semibold text-green-700">Excel (.xlsx)</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-text-secondary">
              <li>แยก Sheet ตามหมวด</li>
              <li>แก้ไขข้อมูลได้</li>
              <li>เหมาะกับข้อมูลละเอียด</li>
            </ul>
          </div>
          <div className={`p-3 rounded-lg border-2 transition-colors ${selectedFormat === 'pdf' ? 'border-red-400 bg-red-50' : 'border-transparent bg-white'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-red-600" />
              <span className="font-semibold text-red-700">PDF (.pdf)</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-text-secondary">
              <li>พร้อมพิมพ์ทันที</li>
              <li>รูปแบบสวยงาม</li>
              <li>เหมาะกับรายงานสรุป</li>
            </ul>
          </div>
          <div className={`p-3 rounded-lg border-2 transition-colors ${selectedFormat === 'csv' ? 'border-blue-400 bg-blue-50' : 'border-transparent bg-white'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileDown size={16} className="text-blue-600" />
              <span className="font-semibold text-blue-700">CSV (.csv)</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-text-secondary">
              <li>ไฟล์เล็ก เปิดได้ทุกโปรแกรม</li>
              <li>นำเข้าระบบอื่นได้</li>
              <li>เหมาะกับข้อมูลดิบ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ExportCard Component
// ============================================================
function ExportCard({
  title, subtitle, icon, color, format, details, exporting, exported, disabled, onExport, formatExt,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: 'blue' | 'pink' | 'green'
  format: ExportFormat
  details: { color: string; label: string; desc: string }[]
  exporting: boolean
  exported: boolean
  disabled: boolean
  onExport: () => void
  formatExt: string
}) {
  const bgHeader = color === 'blue' ? 'bg-blue-50' : color === 'pink' ? 'bg-pink-50' : 'bg-green-50'
  const bgIcon = color === 'blue' ? 'bg-blue-500' : color === 'pink' ? 'bg-pink-500' : 'bg-green-500'
  const btnBg = color === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : color === 'pink' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-green-500 hover:bg-green-600'

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className={`${bgHeader} px-6 py-4 border-b border-border`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${bgIcon} flex items-center justify-center`}>{icon}</div>
          <div>
            <h3 className="font-semibold text-text-primary">ไฟล์{title}</h3>
            <p className="text-xs text-text-secondary">{subtitle} {formatExt}</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-2 mb-4 text-sm text-text-secondary">
          {details.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${d.color}`}></div>
              <span>
                {format === 'excel' ? `Sheet ${i + 1}: ` : ''}
                <strong className="text-text-primary">{d.label}</strong> — {d.desc}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onExport}
          disabled={disabled}
          className={`w-full flex items-center justify-center gap-2 ${btnBg} text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50`}
        >
          {exporting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          {exporting ? 'กำลังสร้างไฟล์...' : `ดาวน์โหลด${title} (${formatExt})${exported ? ' ✓' : ''}`}
        </button>
      </div>
    </div>
  )
}

function formatDateThai(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDate()
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${day} ${months[d.getMonth()]}`
}
