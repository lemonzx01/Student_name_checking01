'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Save, Check, X, Search, Filter, Users } from 'lucide-react'
import { Student } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'

const STATUS_COLORS = {
  'มา': { bg: 'bg-green-100', text: 'text-green-700' },
  'ขาด': { bg: 'bg-red-100', text: 'text-red-700' },
  'ลา': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'สาย': { bg: 'bg-orange-100', text: 'text-orange-700' },
}

const STATUS_OPTIONS = ['มา', 'ขาด', 'ลา', 'สาย']

export default function AttendancePage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams.get('classroom') || (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomId ? Number(classroomId) : null
  
  const [students, setStudents] = useState<Student[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<Record<number, { status: string; note?: string }>>({})
  const [health, setHealth] = useState<Record<number, { brushed_teeth: boolean; drank_milk: boolean }>>({})
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filter students based on search and status
  const filteredStudents = students.filter(student => {
    const matchesSearch = searchQuery === '' || 
      student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    
    const att = attendance[student.id]
    const studentStatus = att?.status || 'มา'
    const matchesStatus = statusFilter === 'all' || studentStatus === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Summary counts
  const statusCounts = students.reduce((acc, s) => {
    const st = attendance[s.id]?.status || 'มา'
    acc[st] = (acc[st] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  useEffect(() => {
    if (selectedClassroom) {
      loadStudents()
      loadAttendance()
    }
  }, [selectedClassroom, date])

  const loadStudents = async () => {
    try {
      const res = await fetch(`/api/students?classroom=${selectedClassroom}`)
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error('Failed to load students:', error)
    }
  }

  const loadAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?date=${date}&classroom=${selectedClassroom}`)
      const data = await res.json()
      
      const attendanceMap: Record<number, { status: string; note?: string }> = {}
      const healthMap: Record<number, { brushed_teeth: boolean; drank_milk: boolean }> = {}
      
      data.forEach((item: any) => {
        if (item.status) {
          attendanceMap[item.id] = { status: item.status, note: item.note || '' }
        }
        if (item.brushed_teeth !== undefined) {
          healthMap[item.id] = { 
            brushed_teeth: Boolean(item.brushed_teeth), 
            drank_milk: Boolean(item.drank_milk) 
          }
        }
      })
      
      setAttendance(attendanceMap)
      setHealth(healthMap)
    } catch (error) {
      console.error('Failed to load attendance:', error)
    }
  }

  const saveAttendance = async () => {
    setSaving(true)
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, classroom: selectedClassroom, attendance, health })
      })
      alert('บันทึกสำเร็จ!')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = (studentId: number, status: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }))
  }

  const updateNote = (studentId: number, note: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], note }
    }))
  }

  const updateHealth = (studentId: number, field: 'brushed_teeth' | 'drank_milk', value: boolean) => {
    setHealth(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }))
  }

  const changeDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text-primary">เช็คชื่อ</h1>
      </div>

      {/* Controls */}
      <div className="bg-surface rounded-xl border border-border mb-6">
        {/* Top Row - Classroom, Date, Save */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <CalendarPicker value={date} onChange={(newDate) => { setDate(newDate) }} />
          </div>

          <button
            onClick={saveAttendance}
            disabled={saving || !selectedClassroom}
            className="flex items-center gap-2 bg-success hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>

        {/* Bottom Row - Search & Filters */}
        {selectedClassroom && students.length > 0 && (
          <div className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหานักเรียน... (ชื่อ, นามสกุล, รหัส)"
                className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-text-secondary mr-1" />
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                ทั้งหมด ({students.length})
              </button>
              {STATUS_OPTIONS.map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? STATUS_COLORS[status as keyof typeof STATUS_COLORS].bg + ' ' + STATUS_COLORS[status as keyof typeof STATUS_COLORS].text + ' ring-1 ring-current'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {status} ({statusCounts[status] || 0})
                </button>
              ))}
            </div>

            {/* Result count */}
            {(searchQuery || statusFilter !== 'all') && (
              <div className="flex items-center gap-1.5 text-xs text-text-secondary ml-auto">
                <Users size={13} />
                <span>แสดง {filteredStudents.length} / {students.length} คน</span>
              </div>
            )}
          </div>
        )}
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
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary w-12">#</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary w-20">รหัส</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">ชื่อ-นามสกุล</th>
                <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary w-48">สถานะ</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">หมายเหตุ</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-20">แปรงฟัน</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-20">ดื่มนม</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-text-secondary">
                    <Search size={24} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">ไม่พบนักเรียนที่ตรงกับการค้นหา</p>
                    <button onClick={() => { setSearchQuery(''); setStatusFilter('all') }} className="text-xs text-primary hover:underline mt-1">ล้างตัวกรอง</button>
                  </td>
                </tr>
              ) : filteredStudents.map((student, index) => {
                const att = attendance[student.id] || { status: 'มา', note: undefined }
                const hl = health[student.id] || { brushed_teeth: false, drank_milk: false }

                return (
                  <tr 
                    key={student.id} 
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-3 py-3 text-center text-sm text-text-secondary">{index + 1}</td>
                    <td className="px-3 py-3 text-sm">{student.student_id}</td>
                    <td className="px-3 py-3 text-sm font-medium">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {STATUS_OPTIONS.map(status => (
                          <button
                            key={status}
                            onClick={() => updateStatus(student.id, status)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                              att.status === status
                                ? STATUS_COLORS[status as keyof typeof STATUS_COLORS].bg + ' ' + STATUS_COLORS[status as keyof typeof STATUS_COLORS].text
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={att.note || ''}
                        onChange={(e) => updateNote(student.id, e.target.value)}
                        placeholder="หมายเหตุ..."
                        className="w-full px-2 py-1 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => updateHealth(student.id, 'brushed_teeth', !hl.brushed_teeth)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          hl.brushed_teeth ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {hl.brushed_teeth ? <Check size={14} /> : <X size={14} />}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => updateHealth(student.id, 'drank_milk', !hl.drank_milk)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          hl.drank_milk ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {hl.drank_milk ? <Check size={14} /> : <X size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
