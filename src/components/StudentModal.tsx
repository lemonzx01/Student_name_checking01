'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Student, Classroom } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'

interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  student?: Student | null
  classroomId?: number | null
}

export default function StudentModal({ isOpen, onClose, onSuccess, student, classroomId }: StudentModalProps) {
  const [formData, setFormData] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    classroom_id: 1,
    gender: 'ชาย',
    birth_date: ''
  })
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadClassrooms()
      if (student) {
        setFormData({
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          classroom_id: student.classroom_id,
          gender: student.gender,
          birth_date: student.birth_date || ''
        })
      } else {
        setFormData({
          student_id: '',
          first_name: '',
          last_name: '',
          classroom_id: classroomId || 0,
          gender: 'ชาย',
          birth_date: ''
        })
      }
    }
  }, [isOpen, student, classroomId])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(data)
      if (data.length > 0 && !student) {
        // Use classroomId prop if available, otherwise first classroom
        const targetId = classroomId && data.some((c: Classroom) => c.id === classroomId) ? classroomId : data[0].id
        setFormData(prev => ({ ...prev, classroom_id: targetId }))
      }
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.student_id || !formData.first_name || !formData.last_name) return

    setLoading(true)
    try {
      const url = student ? `/api/students?id=${student.id}` : '/api/students'
      const method = student ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to save student:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {student ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียนใหม่'}
            </h2>
            {classroomId && classrooms.length > 0 && (
              <p className="text-xs text-text-secondary mt-0.5">
                ห้อง {classrooms.find(c => c.id === classroomId)?.name || classroomId}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                รหัสนักเรียน <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                placeholder="เช่น 001"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                ห้องเรียน <span className="text-danger">*</span>
              </label>
              {classrooms.length === 0 ? (
                <p className="px-4 py-2 text-sm text-danger bg-red-50 rounded-lg border border-red-200">
                  กรุณาสร้างห้องเรียนก่อน
                </p>
              ) : classroomId && !student ? (
                <div className="w-full px-4 py-2 border border-border rounded-lg bg-gray-50 text-text-primary font-medium">
                  {classrooms.find(c => c.id === classroomId)?.name || classroomId}
                </div>
              ) : (
                <select
                  value={formData.classroom_id}
                  onChange={(e) => setFormData({ ...formData, classroom_id: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                ชื่อ <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="ชื่อ"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                นามสกุล <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="นามสกุล"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                เพศ
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
              >
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
            </div>
            <div>
              <CalendarPicker
                value={formData.birth_date}
                onChange={(date) => setFormData({ ...formData, birth_date: date })}
                label="วันเกิด"
                compact
                placeholder="เลือกวันเกิด"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-text-secondary hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || !formData.student_id || !formData.first_name || !formData.last_name || classrooms.length === 0}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : student ? 'บันทึก' : 'เพิ่มนักเรียน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
