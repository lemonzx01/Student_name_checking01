'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, Edit, Trash2, Download, ChevronLeft, ChevronRight, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { Student } from '@/types'
import StudentModal from '@/components/StudentModal'

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

export default function StudentsPage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsPerPage = 10

  useEffect(() => {
    loadStudents()
  }, [classroomId])

  const loadStudents = async () => {
    try {
      // Build URL with classroom filter
      let url = '/api/students'
      if (classroomId) {
        url += `?classroom=${classroomId}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error('Failed to load students:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('คุณแน่ใจที่จะลบนักเรียนคนนี้?')) return
    
    try {
      await fetch(`/api/students?id=${id}`, { method: 'DELETE' })
      loadStudents()
    } catch (error) {
      console.error('Failed to delete student:', error)
    }
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setIsModalOpen(true)
  }

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportMessage(null)

    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        throw new Error('ไม่สามารถโหลดไลบรารี Excel ได้')
      }
      
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      
      if (jsonData.length === 0) {
        throw new Error('ไฟล์ว่างเปล่า')
      }

      // Check if Electron is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      
      if (isElectron) {
        // Use Electron API
        const result = await window.electronAPI!.importStudentsExcel(jsonData)
        if (result.success) {
          setImportMessage({ 
            type: 'success', 
            text: `นำเข้าสำเร็จ! ${result.imported} คน (ข้าม ${result.skipped} คน)` 
          })
          loadStudents()
        } else {
          throw new Error(result.error || 'Import failed')
        }
      } else {
        // Use API
        const res = await fetch('/api/students/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: jsonData, classroom_id: classroomId ? Number(classroomId) : undefined })
        })
        
        const result = await res.json()
        if (result.success) {
          setImportMessage({ 
            type: 'success', 
            text: `นำเข้าสำเร็จ! ${result.imported} คน` 
          })
          loadStudents()
        } else {
          throw new Error(result.error || 'Import failed')
        }
      }
    } catch (error: any) {
      console.error('Import error:', error)
      setImportMessage({ type: 'error', text: error.message || 'เกิดข้อผิดพลาด' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleExportExcel = async () => {
    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        alert('ไม่สามารถโหลดไลบรารี Excel ได้')
        return
      }
      
      // Get all students
      const res = await fetch('/api/students')
      const allStudents = await res.json()
      
      if (allStudents.length === 0) {
        alert('ไม่มีข้อมูลนักเรียน')
        return
      }

      // Convert to Excel format
      const exportData = allStudents.map((s: any) => ({
        'รหัส': s.student_id,
        'ชื่อ': s.first_name,
        'นามสกุล': s.last_name,
        'ห้อง': s.classroom_name,
        'เพศ': s.gender,
        'วันเกิด': s.birth_date
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      
      // Download
      XLSX.writeFile(workbook, `students_export_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingStudent(null)
  }

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    return s.first_name.toLowerCase().includes(q) || 
      s.last_name.toLowerCase().includes(q) || 
      s.student_id.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div>
      {/* Import Message */}
      {importMessage && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          importMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {importMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {importMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">จัดการนักเรียน</h1>
            <p className="text-text-secondary mt-1">รวม {students.length} คน</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            disabled={importing}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={18} />
            {importing ? 'กำลังนำเข้า...' : 'Import Excel'}
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            Export Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            เพิ่มนักเรียน
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          className="w-full pl-12 pr-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">รหัส</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">ห้อง</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">เพศ</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">วันเกิด</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  กำลังโหลด...
                </td>
              </tr>
            ) : paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, index) => (
                <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm">{student.student_id}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm">{student.classroom_name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{student.gender}</td>
                  <td className="px-4 py-3 text-sm">{student.birth_date || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleEdit(student)}
                      className="p-1 text-text-secondary hover:text-primary transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(student.id)}
                      className="p-1 text-text-secondary hover:text-danger transition-colors ml-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-text-secondary">
              หน้า {currentPage} จาก {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    page === currentPage 
                      ? 'bg-primary text-white' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={loadStudents}
        student={editingStudent}
        classroomId={classroomId ? Number(classroomId) : null}
      />
    </div>
  )
}
