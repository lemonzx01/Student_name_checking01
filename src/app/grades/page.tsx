'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Calendar, FileSpreadsheet } from 'lucide-react'
import { Student, calculateGrade, DEFAULT_SUBJECTS } from '@/types/index'

// Lazy load xlsx
const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}

export default function GradesPage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null
  
  const [students, setStudents] = useState<Student[]>([])
  const [semester, setSemester] = useState(1)
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [grades, setGrades] = useState<Record<number, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)
  const [currentRow, setCurrentRow] = useState(0)
  const [currentCol, setCurrentCol] = useState(0)

  const subjects = DEFAULT_SUBJECTS

  useEffect(() => {
    if (selectedClassroom) {
      loadStudents()
      loadGrades()
    }
  }, [selectedClassroom, semester, academicYear])

  const loadStudents = async () => {
    try {
      const res = await fetch(`/api/students?classroom=${selectedClassroom}`)
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error('Failed to load students:', error)
    }
  }

  const loadGrades = async () => {
    try {
      const res = await fetch(`/api/grades?classroom=${selectedClassroom}&semester=${semester}&year=${academicYear}`)
      const data = await res.json()
      
      const gradesMap: Record<number, Record<string, number>> = {}
      data.forEach((item: any) => {
        if (!gradesMap[item.student_id]) {
          gradesMap[item.student_id] = {}
        }
        if (item.score !== null) {
          gradesMap[item.student_id][item.subject_code] = item.score
        }
      })
      
      setGrades(gradesMap)
    } catch (error) {
      console.error('Failed to load grades:', error)
    }
  }

  const saveGrades = async () => {
    setSaving(true)
    try {
      await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          classroom: selectedClassroom, 
          semester, 
          year: academicYear, 
          grades 
        })
      })
      alert('บันทึกสำเร็จ!')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const updateGrade = (studentId: number, subject: string, score: number) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: score
      }
    }))
  }

  // Keyboard navigation — only active when a grade input is focused
  const tableRef = { current: null as HTMLDivElement | null }
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keys when an input inside the grades table is focused
    const active = document.activeElement
    if (!active || active.tagName !== 'INPUT' || !active.closest('[data-grades-table]')) return
    if (students.length === 0 || subjects.length === 0) return

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      setCurrentRow(r => Math.min(r + 1, students.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCurrentRow(r => Math.max(r - 1, 0))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setCurrentCol(c => Math.min(c + 1, subjects.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setCurrentCol(c => Math.max(c - 1, 0))
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setCurrentCol(c => Math.max(c - 1, 0))
      } else {
        setCurrentCol(c => Math.min(c + 1, subjects.length - 1))
      }
    }
  }, [students, subjects])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const exportToExcel = async () => {
    if (students.length === 0) return

    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        alert('ไม่สามารถโหลดไลบรารี Excel ได้')
        return
      }
      
      // Prepare data for export
      const exportData = students.map(student => {
        const studentGrades = grades[student.id] || {}
        const row: any = {
          'รหัส': student.student_id,
          'ชื่อ': student.first_name,
          'นามสกุล': student.last_name
        }
        
        // Add each subject score
        subjects.forEach(subject => {
          row[subject.name] = studentGrades[subject.code] ?? ''
        })
        
        // Add average
        const scores = Object.values(studentGrades).filter(s => s !== null && s !== undefined)
        const avg = scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 0
        row['เฉลี่ย'] = avg.toFixed(2)
        
        return row
      })

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Grades')
      
      // Set column widths
      const colWidths = [
        { wch: 10 }, // รหัส
        { wch: 15 }, // ชื่อ
        { wch: 20 }, // นามสกุล
        ...subjects.map(() => ({ wch: 10 })), // วิชา
        { wch: 10 }  // เฉลี่ย
      ]
      worksheet['!cols'] = colWidths

      const fileName = `คะแนน_${selectedClassroom}_ภาค${semester}_${academicYear}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error('Export error:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  const calculateStudentAverage = (studentId: number) => {
    const studentGrades = grades[studentId]
    if (!studentGrades) return null
    
    const scores = Object.values(studentGrades).filter(s => s !== null && s !== undefined)
    if (scores.length === 0) return null
    
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }

  const calculateGPA = (studentId: number) => {
    const avg = calculateStudentAverage(studentId)
    if (avg === null) return null
    return calculateGrade(avg)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">บันทึกเกรด</h1>
          <p className="text-text-secondary mt-1">กรอกคะแนนและใช้ Tab/Arrow เพื่อนำทาง</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            disabled={students.length === 0}
            className="flex items-center gap-2 border border-border hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
          <button
            onClick={saveGrades}
            disabled={saving || !selectedClassroom}
            className="flex items-center gap-2 bg-success hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-4 mb-6">

        
        {/* Semester Selector */}
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-text-secondary mb-2">ภาคเรียน</label>
          <div className="relative">
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value={1}>ภาคเรียนที่ 1</option>
              <option value={2}>ภาคเรียนที่ 2</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={18} />
          </div>
        </div>
        
        {/* Academic Year */}
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-text-secondary mb-2">ปีการศึกษา</label>
          <div className="relative">
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="2568"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={18} />
          </div>
        </div>
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="text-center py-12 text-text-secondary">
          กรุณาเลือกห้องเรียน
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          ไม่มีนักเรียนในห้องนี้
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-x-auto" data-grades-table>
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary w-12">#</th>
                <th className="px-3 py-3 text-left text-text-secondary w-24">รหัส</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary w-48">ชื่อ-นามสกุล</th>
                {subjects.map(subject => (
                  <th key={subject.code} className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-20" style={{ color: subject.color }}>
                    {subject.name}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary w-24 bg-blue-50">คะแนนเฉลี่ย</th>
                <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary w-20 bg-blue-50">เกรด</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, rowIndex) => {
                const studentGrades = grades[student.id] || {}
                const avg = calculateStudentAverage(student.id)
                const gpa = calculateGPA(student.id)
                const isSelected = rowIndex === currentRow

                return (
                  <tr 
                    key={student.id} 
                    className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}
                  >
                    <td className="px-3 py-2 text-center text-sm text-text-secondary">{rowIndex + 1}</td>
                    <td className="px-3 py-2 text-sm">{student.student_id}</td>
                    <td className="px-3 py-2 text-sm font-medium">
                      {student.first_name} {student.last_name}
                    </td>
                    {subjects.map((subject, colIndex) => (
                      <td key={subject.code} className="px-1 py-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={studentGrades[subject.code] || ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw === '') {
                              // Remove grade entry when cleared
                              setGrades(prev => {
                                const copy = { ...prev }
                                if (copy[student.id]) {
                                  const subCopy = { ...copy[student.id] }
                                  delete subCopy[subject.code]
                                  copy[student.id] = subCopy
                                }
                                return copy
                              })
                              return
                            }
                            updateGrade(student.id, subject.code, Number(raw))
                          }}
                          onFocus={() => { setCurrentRow(rowIndex); setCurrentCol(colIndex) }}
                          className={`w-full px-2 py-1 text-center text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                            isSelected && colIndex === currentCol ? 'border-primary bg-blue-50' : 'border-border'
                          }`}
                          placeholder="-"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-medium bg-blue-50/50">
                      {avg !== null ? avg.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center font-bold bg-blue-50/50" style={{ color: gpa !== null && gpa >= 2 ? '#10B981' : '#EF4444' }}>
                      {gpa !== null ? gpa.toFixed(1) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grade Scale */}
      <div className="mt-6 p-4 bg-surface rounded-xl border border-border">
        <h3 className="text-sm font-medium text-text-secondary mb-2">เกณฑ์การคำนวณเกรด</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">80-100 = 4.0</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">75-79 = 3.5</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">70-74 = 3.0</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">65-69 = 2.5</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">60-64 = 2.0</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">55-59 = 1.5</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">50-54 = 1.0</span>
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">ต่ำกว่า 50 = 0.0</span>
        </div>
      </div>
    </div>
  )
}
