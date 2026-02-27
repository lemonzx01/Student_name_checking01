'use client'

import { useState, useEffect } from 'react'
import { X, School, BookOpen, Calendar } from 'lucide-react'
import { Classroom } from '@/types'

interface CreateClassroomModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingClassroom?: Classroom | null
}

export default function CreateClassroomModal({ isOpen, onClose, onSuccess, editingClassroom }: CreateClassroomModalProps) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('มัธยมศึกษาตอนต้น')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543))
  const [loading, setLoading] = useState(false)

  const isEditing = !!editingClassroom

  useEffect(() => {
    if (editingClassroom) {
      setName(editingClassroom.name)
      setLevel(editingClassroom.level)
      setAcademicYear(editingClassroom.academic_year)
    } else {
      setName('')
      setLevel('มัธยมศึกษาตอนต้น')
      setAcademicYear(String(new Date().getFullYear() + 543))
    }
  }, [editingClassroom, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      if (isEditing && editingClassroom) {
        const res = await fetch('/api/classrooms', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingClassroom.id, name, level, academic_year: academicYear })
        })
        
        if (res.ok) {
          onSuccess()
        }
      } else {
        const res = await fetch('/api/classrooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, level, academic_year: academicYear })
        })
        
        if (res.ok) {
          setName('')
          onSuccess()
        }
      }
    } catch (error) {
      console.error(isEditing ? 'Failed to update classroom:' : 'Failed to create classroom:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with gradient */}
        <div className={`px-6 py-5 border-b border-gray-100 ${isEditing ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-gradient-to-r from-primary/5 to-primary/10'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isEditing ? 'bg-blue-100' : 'bg-primary/10'}`}>
                {isEditing ? (
                  <BookOpen size={22} className="text-blue-600" />
                ) : (
                  <School size={22} className="text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {isEditing ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียนใหม่'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEditing ? 'อัปเดตข้อมูลห้องเรียน' : 'กรอกข้อมูลห้องเรียนใหม่'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <School size={16} className="text-gray-400" />
              ชื่อห้องเรียน
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ม.1/1"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 transition-all"
              autoFocus
            />
          </div>

          {/* Level */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <BookOpen size={16} className="text-gray-400" />
              ระดับชั้น
            </label>
            <div className="relative">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 appearance-none cursor-pointer transition-all"
              >
                <option value="ประถมศึกษา">ประถมศึกษา</option>
                <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น</option>
                <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Academic Year */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar size={16} className="text-gray-400" />
              ปีการศึกษา
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="เช่น 2568"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all shadow-lg shadow-primary/25 ${
                isEditing 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white' 
                  : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary-hover hover:to-primary text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
            >
              {loading 
                ? (isEditing ? 'กำลังบันทึก...' : 'กำลังสร้าง...') 
                : (isEditing ? 'บันทึก' : 'สร้างห้อง')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
