'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Activity, TrendingUp, TrendingDown, Minus, FileSpreadsheet } from 'lucide-react'
import { Classroom, Student } from '@/types'

const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default || xlsx
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}
import CalendarPicker from '@/components/CalendarPicker'

interface HealthRecord {
  student_id: number
  student_name: string
  weight: number
  height: number
  bmi: number
  bmi_status: string
  date: string
}

export default function HealthPage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [currentClassroomName, setCurrentClassroomName] = useState('')
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadClassrooms()
  }, [])

  useEffect(() => {
    if (selectedClassroom) {
      loadHealthData()
    }
  }, [selectedClassroom, selectedDate])

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

  const loadHealthData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/health?classroom=${selectedClassroom}&date=${selectedDate}`)
      const data = await res.json()
      setHealthRecords(data)
    } catch (error) {
      console.error('Failed to load health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveHealthData = async () => {
    setSaving(true)
    try {
      for (const record of healthRecords) {
        if (record.weight > 0 || record.height > 0) {
          await fetch('/api/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: record.student_id,
              weight: record.weight,
              height: record.height,
              date: selectedDate
            })
          })
        }
      }
      alert('บันทึกสำเร็จ!')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const updateRecord = (studentId: number, field: 'weight' | 'height', value: number) => {
    setHealthRecords(prev => prev.map(r => {
      if (r.student_id === studentId) {
        const newRecord = { ...r, [field]: value }
        
        // Recalculate BMI
        if (newRecord.weight > 0 && newRecord.height > 0) {
          const heightInMeters = newRecord.height / 100
          const bmi = newRecord.weight / (heightInMeters * heightInMeters)
          newRecord.bmi = Math.round(bmi * 10) / 10
          
          if (bmi < 18.5) newRecord.bmi_status = 'ผอม'
          else if (bmi < 23) newRecord.bmi_status = 'ปกติ'
          else if (bmi < 25) newRecord.bmi_status = 'น้ำหนักเกิน'
          else if (bmi < 30) newRecord.bmi_status = 'อ้วน'
          else newRecord.bmi_status = 'อ้วนมาก'
        } else {
          newRecord.bmi = 0
          newRecord.bmi_status = ''
        }
        
        return newRecord
      }
      return r
    }))
  }

  const exportToExcel = async () => {
    try {
      const XLSX = await loadXLSX()
      if (!XLSX) { alert('ไม่สามารถโหลด xlsx'); return }

      const workbook = XLSX.utils.book_new()

      // Sheet 1: ข้อมูลน้ำหนัก/ส่วนสูง
      const headers = ['ลำดับ', 'ชื่อนักเรียน', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ']
      const rows = healthRecords.map((r, i) => [
        i + 1,
        r.student_name,
        r.weight || '',
        r.height || '',
        r.bmi > 0 ? r.bmi.toFixed(1) : '-',
        r.bmi_status || '-',
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = [
        { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
      ]
      XLSX.utils.book_append_sheet(workbook, ws, 'น้ำหนัก-ส่วนสูง')

      // Sheet 2: สรุป BMI
      const bmiGroups = ['ผอม', 'ปกติ', 'น้ำหนักเกิน', 'อ้วน', 'อ้วนมาก']
      const summaryHeaders = ['สถานะ BMI', 'จำนวน (คน)', 'ร้อยละ (%)']
      const total = healthRecords.filter(r => r.bmi > 0).length
      const summaryRows = bmiGroups.map(status => {
        const count = healthRecords.filter(r => r.bmi_status === status).length
        return [status, count, total > 0 ? ((count / total) * 100).toFixed(1) : '0.0']
      })
      summaryRows.push(['รวม', total, '100.0'])

      const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows])
      ws2['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(workbook, ws2, 'สรุป BMI')

      const fileName = `น้ำหนักส่วนสูง_${currentClassroomName || selectedClassroom}_${selectedDate}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error('Export error:', error)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  function getBmiColor(bmi: number): string {
    if (bmi === 0) return 'text-gray-400'
    if (bmi < 18.5) return 'text-blue-600'
    if (bmi < 23) return 'text-green-600'
    if (bmi < 25) return 'text-yellow-600'
    if (bmi < 30) return 'text-orange-600'
    return 'text-red-600'
  }

  function getBmiIcon(bmi: number) {
    if (bmi === 0) return <Minus size={16} />
    if (bmi < 18.5) return <TrendingDown size={16} />
    if (bmi < 23) return <Minus size={16} />
    return <TrendingUp size={16} />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">น้ำหนัก/ส่วนสูง</h1>
          <p className="text-text-secondary mt-1">บันทึกและคำนวณค่า BMI</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            disabled={healthRecords.length === 0}
            className="flex items-center gap-2 border border-border hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
          <button
            onClick={saveHealthData}
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

        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-text-secondary mb-2">วันที่</label>
          <CalendarPicker value={selectedDate} onChange={(newDate) => { setSelectedDate(newDate) }} />
        </div>
      </div>

      {/* BMI Legend */}
      <div className="mb-6 p-4 bg-surface rounded-xl border border-border">
        <h3 className="text-sm font-medium text-text-secondary mb-2">ค่า BMI</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-blue-500 rounded"></span>
            <span>ผอม (&lt;18.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-green-500 rounded"></span>
            <span>ปกติ (18.5-22.9)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-yellow-500 rounded"></span>
            <span>น้ำหนักเกิน (23-24.9)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-orange-500 rounded"></span>
            <span>อ้วน (25-29.9)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-red-500 rounded"></span>
            <span>อ้วนมาก (≥30)</span>
          </div>
        </div>
      </div>

      {/* Health Table */}
      {!selectedClassroom ? (
        <div className="text-center py-12 text-text-secondary">
          กรุณาเลือกห้องเรียน
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-text-secondary">
          กำลังโหลด...
        </div>
      ) : healthRecords.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          ไม่พบข้อมูลนักเรียน
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-16">ลำดับ</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">ชื่อนักเรียน</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-32">น้ำหนัก (กก.)</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-32">ส่วนสูง (ซม.)</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-32">BMI</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-32">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {healthRecords.map((record, index) => (
                <tr key={record.student_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-center text-text-secondary">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{record.student_name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={record.weight || ''}
                      onChange={(e) => updateRecord(record.student_id, 'weight', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="0"
                      step="0.1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={record.height || ''}
                      onChange={(e) => updateRecord(record.student_id, 'height', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="0"
                      step="0.1"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${getBmiColor(record.bmi)}`}>
                      {record.bmi > 0 ? record.bmi.toFixed(1) : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      record.bmi_status === 'ผอม' ? 'bg-blue-100 text-blue-700' :
                      record.bmi_status === 'ปกติ' ? 'bg-green-100 text-green-700' :
                      record.bmi_status === 'น้ำหนักเกิน' ? 'bg-yellow-100 text-yellow-700' :
                      record.bmi_status === 'อ้วน' ? 'bg-orange-100 text-orange-700' :
                      record.bmi_status === 'อ้วนมาก' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {getBmiIcon(record.bmi)}
                      <span>{record.bmi_status || '-'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
