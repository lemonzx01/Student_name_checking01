'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar, FileText } from 'lucide-react'
import { Classroom } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'

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

export default function AttendanceReportPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadClassrooms()
    // Set default date range (current month)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(firstDay)
    setEndDate(lastDay)
  }, [])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(data)
      if (data.length > 0) {
        setSelectedClassroom(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    }
  }

  const generateReport = async () => {
    if (!selectedClassroom || !startDate || !endDate) {
      alert('กรุณาเลือกห้องเรียนและช่วงวันที่')
      return
    }

    setLoading(true)
    try {
      // Get students in classroom
      const studentsRes = await fetch(`/api/students?classroom=${selectedClassroom}`)
      const students = await studentsRes.json()

      // Get attendance data for each date in range
      const report: any[] = []
      const start = new Date(startDate)
      const end = new Date(endDate)

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        
        try {
          const attRes = await fetch(`/api/attendance?date=${dateStr}&classroom=${selectedClassroom}`)
          const attendance = await attRes.json()

          // Count statuses
          const stats = {
            present: attendance.filter((a: any) => a.status === 'มา').length,
            absent: attendance.filter((a: any) => a.status === 'ขาด').length,
            leave: attendance.filter((a: any) => a.status === 'ลา').length,
          }

          const total = students.length
          const presentPercent = total > 0 ? ((stats.present / total) * 100).toFixed(1) : '0'

          report.push({
            date: dateStr,
            day: d.toLocaleDateString('th-TH', { weekday: 'short' }),
            present: stats.present,
            absent: stats.absent,
            leave: stats.leave,
            presentPercent,
            total
          })
        } catch (e) {
          console.error('Error fetching attendance for', dateStr, e)
        }
      }

      setReportData(report)
    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = async () => {
    if (reportData.length === 0) return

    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        alert('ไม่สามารถโหลดไลบรารี Excel ได้')
        return
      }
      
      const classroomName = classrooms.find(c => c.id === selectedClassroom)?.name || ''
      
      const exportData = reportData.map(r => ({
        'วันที่': r.date,
        'วัน': r.day,
        'มา': r.present,
        'ขาด': r.absent,
        'ลา': r.leave,
        'รวม': r.total,
        'เปอร์เซ็นต์มา': r.presentPercent + '%'
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงาน')

      // Set column widths
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }
      ]

      const fileName = `รายงานเช็คชื่อ_${classroomName}_${startDate}_ถึง_${endDate}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error('Export error:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">รายงานการเช็คชื่อ</h1>
        <p className="text-text-secondary mt-1">สร้างรายงานการมาเรียนของนักเรียน</p>
      </div>

      {/* Controls */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Classroom */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">ห้องเรียน</label>
            <select
              value={selectedClassroom || ''}
              onChange={(e) => setSelectedClassroom(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-white"
            >
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <CalendarPicker 
              value={startDate} 
              onChange={setStartDate}
              label="วันที่เริ่ม"
              compact
            />
          </div>

          {/* End Date */}
          <div>
            <CalendarPicker 
              value={endDate} 
              onChange={setEndDate}
              label="วันที่สิ้นสุด"
              compact
              dropdownAlign="right"
            />
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <FileText size={18} />
              {loading ? 'กำลังโหลด...' : 'สร้างรายงาน'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Data */}
      {reportData.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* Summary */}
          <div className="p-4 bg-blue-50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-blue-600">วันที่มาเรียน</p>
                <p className="text-2xl font-bold text-blue-700">
                  {reportData.reduce((sum, r) => sum + r.present, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-red-600">ขาด</p>
                <p className="text-2xl font-bold text-red-700">
                  {reportData.reduce((sum, r) => sum + r.absent, 0)}
                </p>
              </div>
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Download size={18} />
              Export Excel
            </button>
          </div>

          {/* Table */}
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">วันที่</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">วัน</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-green-600">มา</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-red-600">ขาด</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-yellow-600">ลา</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">% มา</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={row.date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm">{row.date}</td>
                  <td className="px-4 py-3 text-sm text-center">{row.day}</td>
                  <td className="px-4 py-3 text-sm text-center text-green-600 font-medium">{row.present}</td>
                  <td className="px-4 py-3 text-sm text-center text-red-600 font-medium">{row.absent}</td>
                  <td className="px-4 py-3 text-sm text-center text-yellow-600 font-medium">{row.leave}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium">{row.presentPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
