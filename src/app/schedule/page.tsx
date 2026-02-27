'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Trash2, Plus, Pencil, ChevronRight, ChevronLeft, FileText, GraduationCap, CalendarDays, ChevronDown, BookOpen, Check } from 'lucide-react'
import type { Classroom } from '@/types/index'
import { NotoSansThai } from '@/lib/thai-font'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const PERIOD_TIMES = [
  '08.10-09.00',
  '09.00-09.50',
  '09.50-10.40',
  '10.40-11.30',
  '11.30-12.20',
  '12.30-13.10',
  '13.10-14.00',
  '14.00-14.50',
  '14.50-15.40',
  '15.40-16.30',
]

const SUBJECT_GROUPS = [
  'ภาษาไทย',
  'คณิตศาสตร์',
  'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษา',
  'ประวัติศาสตร์',
  'สุขศึกษาและพละ',
  'ศิลปะ',
  'การงานฯ',
  'ภาษาอังกฤษ',
]

interface ScheduleSlot {
  subject_code: string
  subject_name: string
  class_level: string
  room: string
}

export default function SchedulePage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [currentClassroomName, setCurrentClassroomName] = useState('')
  const [schedule, setSchedule] = useState<Record<string, ScheduleSlot>>({})
  const [saving, setSaving] = useState(false)
  const currentThaiYear = new Date().getFullYear() + 543
  const [semester, setSemester] = useState('2')
  const [academicYear, setAcademicYear] = useState(String(currentThaiYear))

  // Generate year options: current year ± 3
  const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentThaiYear - 3 + i))

  // Edit modal state
  const [editModal, setEditModal] = useState<{ day: number; period: number } | null>(null)
  const [editForm, setEditForm] = useState<ScheduleSlot>({
    subject_code: '',
    subject_name: '',
    class_level: '',
    room: '',
  })

  // Confirm dialog
  const [showConfirm, setShowConfirm] = useState(false)

  // Custom dropdown states
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)
  const yearDropdownRef = useRef<HTMLDivElement>(null)
  const subjectDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setShowYearDropdown(false)
      }
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target as Node)) {
        setShowSubjectDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Scroll ref
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadClassrooms()
  }, [])

  useEffect(() => {
    if (selectedClassroom) {
      loadSchedule()
    }
  }, [selectedClassroom])

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

  const loadSchedule = async () => {
    try {
      const res = await fetch(`/api/schedule?classroom=${selectedClassroom}`)
      const data = await res.json()

      const scheduleMap: Record<string, ScheduleSlot> = {}
      data.forEach((item: any) => {
        const key = `${item.day_of_week}-${item.period}`
        scheduleMap[key] = {
          subject_code: item.subject_code || '',
          subject_name: item.subject_name || '',
          class_level: item.class_level || '',
          room: item.room || '',
        }
      })

      setSchedule(scheduleMap)
    } catch (error) {
      console.error('Failed to load schedule:', error)
    }
  }

  // --- Save ---
  const handleSaveClick = () => {
    setShowConfirm(true)
  }

  const confirmSave = async () => {
    setShowConfirm(false)
    setSaving(true)
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroom: selectedClassroom, schedule }),
      })
      alert('บันทึกสำเร็จ!')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  // --- Edit modal ---
  const openEditModal = (day: number, period: number) => {
    const key = `${day}-${period}`
    const existing = schedule[key]
    setEditForm(
      existing
        ? { ...existing }
        : { subject_code: '', subject_name: '', class_level: '', room: '' }
    )
    setEditModal({ day, period })
  }

  const saveEditModal = () => {
    if (!editModal) return
    const key = `${editModal.day}-${editModal.period}`
    if (editForm.subject_code || editForm.subject_name) {
      setSchedule(prev => ({ ...prev, [key]: { ...editForm } }))
    } else {
      // Remove empty slot
      setSchedule(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setEditModal(null)
  }

  const deleteSlot = () => {
    if (!editModal) return
    const key = `${editModal.day}-${editModal.period}`
    setSchedule(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditModal(null)
  }

  // --- Scroll ---
  const scrollGrid = (direction: 'left' | 'right') => {
    if (gridRef.current) {
      gridRef.current.scrollBy({
        left: direction === 'right' ? 200 : -200,
        behavior: 'smooth',
      })
    }
  }

  // --- PDF Export ---
  const exportPDF = async () => {
    try {
      const jspdfModule = await import('jspdf')
      const jsPDF = jspdfModule.default || jspdfModule.jsPDF
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Thai font
      doc.addFileToVFS('NotoSansThai.ttf', NotoSansThai)
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'normal')
      doc.addFont('NotoSansThai.ttf', 'NotoSansThai', 'bold')
      doc.setFont('NotoSansThai')

      // Title
      doc.setFont('NotoSansThai', 'bold')
      doc.setFontSize(14)
      const title = `ตารางสอน ชั้น ${currentClassroomName || `ห้อง ${selectedClassroom}`}  ภาคเรียนที่ ${semester}/${academicYear}`
      doc.text(title, 148.5, 14, { align: 'center' })

      doc.setFont('NotoSansThai', 'normal')
      const headerRow1 = ['ชั่วโมงที่', ...PERIODS.map(p => String(p))]
      const headerRow2 = ['เวลา', ...PERIOD_TIMES]

      const bodyRows = DAYS.map((day, dayIndex) => {
        const dayNum = dayIndex + 1
        const cells = PERIODS.map(period => {
          const key = `${dayNum}-${period}`
          const slot = schedule[key]
          if (!slot) return ''
          const parts: string[] = []
          if (slot.subject_code) parts.push(slot.subject_code)
          if (slot.subject_name) parts.push(slot.subject_name)
          if (slot.class_level) parts.push(slot.class_level)
          if (slot.room) parts.push(slot.room)
          return parts.join('\n')
        })
        return [day, ...cells]
      })

      ;(autoTable as any)(doc, {
        head: [headerRow1, headerRow2],
        body: bodyRows,
        startY: 20,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 1.5,
          font: 'NotoSansThai',
          halign: 'center',
          valign: 'middle',
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          font: 'NotoSansThai',
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          minCellHeight: 22,
        },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          if (data.column.index === 0 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Signature lines
      const finalY = (doc as any).lastAutoTable?.finalY || 160
      const sigY = finalY + 18

      doc.setFont('NotoSansThai', 'normal')
      doc.setFontSize(10)

      doc.text('ลงชื่อ .......................................', 50, sigY, { align: 'center' })
      doc.text('ผู้สอน', 50, sigY + 6, { align: 'center' })

      doc.text('ลงชื่อ .......................................', 148.5, sigY, { align: 'center' })
      doc.text('รองฯฝ่ายวิชาการ', 148.5, sigY + 6, { align: 'center' })

      doc.text('ลงชื่อ .......................................', 247, sigY, { align: 'center' })
      doc.text('ผู้อำนวยการ', 247, sigY + 6, { align: 'center' })

      doc.save(
        `ตารางสอน_${currentClassroomName || selectedClassroom}_${semester}_${academicYear}.pdf`
      )
    } catch (e) {
      console.error('PDF export error:', e)
      alert('เกิดข้อผิดพลาดในการส่งออก PDF')
    }
  }

  // ========== RENDER ==========
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">ตารางสอน</h1>
          <p className="text-text-secondary mt-1">จัดตารางเรียนสำหรับแต่ละห้อง</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            disabled={!selectedClassroom}
            className="flex items-center gap-2 bg-white border border-border hover:bg-gray-50 text-text-primary px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <FileText size={18} />
            ส่งออก PDF
          </button>
          <button
            onClick={handleSaveClick}
            disabled={saving || !selectedClassroom}
            className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        {/* Classroom chip */}
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2.5 rounded-full font-semibold text-sm">
          <GraduationCap size={16} />
          {selectedClassroom
            ? currentClassroomName || `ห้อง ${selectedClassroom}`
            : 'เลือกห้อง'}
        </div>

        {/* Semester toggle */}
        <div className="flex items-center bg-surface border border-border rounded-full p-1">
          {['1', '2'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSemester(s)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                semester === s
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              เทอม {s}
            </button>
          ))}
        </div>

        {/* Academic year dropdown */}
        <div ref={yearDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setShowYearDropdown(!showYearDropdown)}
            className="flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2.5 hover:border-primary/50 transition-colors"
          >
            <CalendarDays size={16} className="text-primary" />
            <span className="text-xs text-text-secondary">ปีการศึกษา</span>
            <span className="text-sm font-bold text-text-primary">{academicYear}</span>
            <ChevronDown size={14} className={`text-text-secondary transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showYearDropdown && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-border shadow-xl z-50 py-1 min-w-[140px] animate-in fade-in slide-in-from-top-2">
              {yearOptions.map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { setAcademicYear(y); setShowYearDropdown(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                    academicYear === y
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-text-primary hover:bg-gray-50'
                  }`}
                >
                  <span>{y}</span>
                  {academicYear === y && <Check size={14} className="text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Grid */}
      {!selectedClassroom ? (
        <div className="text-center py-12 text-text-secondary">กรุณาเลือกห้องเรียน</div>
      ) : (
        <div>
          <div ref={gridRef} className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="border border-blue-400 px-2 py-3 text-sm font-medium w-24 whitespace-nowrap">
                    วัน / คาบ
                  </th>
                  {PERIODS.map((period, i) => (
                    <th
                      key={period}
                      className="border border-blue-400 px-2 py-2 text-center min-w-[100px]"
                    >
                      <div className="text-sm font-bold">คาบที่ {period}</div>
                      <div className="text-xs font-normal opacity-80">{PERIOD_TIMES[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIndex) => {
                  const dayNum = dayIndex + 1
                  return (
                    <tr key={day} className="hover:bg-blue-50/20">
                      <td className="border border-border px-3 py-3 font-bold text-sm text-text-primary bg-gray-50 whitespace-nowrap text-center">
                        {day}
                      </td>
                      {PERIODS.map(period => {
                        const key = `${dayNum}-${period}`
                        const slot = schedule[key]

                        return (
                          <td
                            key={period}
                            className="border border-border p-1 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                            onClick={() => openEditModal(dayNum, period)}
                          >
                            {slot ? (
                              <div className="border-2 border-primary rounded-lg p-2 min-h-[72px] flex flex-col items-center justify-center gap-0.5 bg-blue-50/40">
                                <div className="font-bold text-sm text-primary leading-tight">
                                  {slot.subject_code}
                                </div>
                                {slot.subject_name && (
                                  <div className="text-xs text-text-secondary leading-tight truncate max-w-full">
                                    {slot.subject_name}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 mt-0.5">
                                  {slot.class_level && (
                                    <span className="text-xs text-text-secondary">
                                      ม.{slot.class_level}
                                    </span>
                                  )}
                                  {slot.room && (
                                    <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-medium">
                                      {slot.room}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="min-h-[72px] flex items-center justify-center text-gray-300 hover:text-primary transition-colors">
                                <Plus size={20} />
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== Edit Modal ========== */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <Pencil size={18} className="text-primary" />
              <h3 className="text-lg font-bold text-text-primary">
                {DAYS[editModal.day - 1]}{' '}
                <span className="text-text-secondary font-normal">| คาบที่ {editModal.period}</span>
              </h3>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">รหัสวิชา</label>
                <input
                  type="text"
                  value={editForm.subject_code}
                  onChange={e => setEditForm(f => ({ ...f, subject_code: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="เช่น ว32222"
                  autoFocus
                />
              </div>

              <div ref={subjectDropdownRef} className="relative">
                <label className="block text-sm font-medium text-text-secondary mb-1">กลุ่มสาระวิชา</label>
                <button
                  type="button"
                  onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                  className={`w-full px-4 py-2.5 border rounded-xl text-left flex items-center justify-between transition-colors ${
                    showSubjectDropdown
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-border hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className={editForm.subject_name ? 'text-primary' : 'text-gray-400'} />
                    <span className={editForm.subject_name ? 'text-text-primary font-medium' : 'text-gray-400'}>
                      {editForm.subject_name || 'เลือกกลุ่มสาระวิชา'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-text-secondary transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSubjectDropdown && (
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-border shadow-xl z-50 py-1 max-h-[280px] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setEditForm(f => ({ ...f, subject_name: '' })); setShowSubjectDropdown(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                        !editForm.subject_name ? 'bg-gray-50 text-text-secondary' : 'text-text-secondary hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">—</span>
                      </div>
                      <span>ไม่เลือก</span>
                    </button>
                    {SUBJECT_GROUPS.map((name, idx) => {
                      const colors = [
                        'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
                        'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500', 'bg-red-500'
                      ]
                      const isSelected = editForm.subject_name === name
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => { setEditForm(f => ({ ...f, subject_name: name })); setShowSubjectDropdown(false) }}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text-primary hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full ${colors[idx]} flex items-center justify-center shadow-sm`}>
                            <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                          </div>
                          <span className="flex-1">{name}</span>
                          {isSelected && <Check size={16} className="text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  ระดับชั้น (ห้อง)
                </label>
                <input
                  type="text"
                  value={editForm.class_level}
                  onChange={e => setEditForm(f => ({ ...f, class_level: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="เช่น 5/6"
                />
                <p className="text-xs text-text-secondary mt-1">
                  * ใส่ตัวเลขและเครื่องหมาย /
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">ห้องเรียน</label>
                <input
                  type="text"
                  value={editForm.room}
                  onChange={e => setEditForm(f => ({ ...f, room: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="เช่น S201"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              {schedule[`${editModal.day}-${editModal.period}`] && (
                <button
                  onClick={deleteSlot}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="ลบ"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setEditModal(null)}
                className="px-5 py-2.5 border border-border rounded-xl text-text-secondary hover:bg-gray-50 font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEditModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors"
              >
                <Save size={16} />
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Save Confirm Dialog ========== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-xl text-center">
            <div className="w-16 h-16 rounded-full border-4 border-gray-300 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-gray-400">?</span>
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">บันทึกข้อมูล?</h3>
            <p className="text-text-secondary mb-6">
              ยืนยันข้อมูลเทอม {semester}/{academicYear}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={confirmSave}
                className="px-6 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                บันทึก
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2.5 border border-border rounded-lg text-text-secondary hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
