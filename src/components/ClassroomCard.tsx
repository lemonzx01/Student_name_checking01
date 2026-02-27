'use client'

import { useState } from 'react'
import { Classroom } from '@/types'
import { Users, Calendar, School, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface ClassroomCardProps {
  classroom: Classroom
  onEdit: (classroom: Classroom) => void
  onDelete: (id: number) => void
}

export default function ClassroomCard({ classroom, onEdit, onDelete }: ClassroomCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit(classroom)
  }

  const confirmDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(classroom.id)
    setShowDeleteConfirm(false)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  return (
    <Link href={`/students?classroom=${classroom.id}`}>
      <div className="bg-surface rounded-xl border border-border p-5 hover:border-primary hover:shadow-md transition-all cursor-pointer group relative">
        {/* Delete confirmation overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-white/95 rounded-xl z-20 flex flex-col items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={32} className="text-red-500 mb-2" />
            <p className="text-sm font-medium text-text-primary text-center mb-1">
              ต้องการลบห้อง "{classroom.name}" ?
            </p>
            <p className="text-xs text-text-secondary text-center mb-3">
              ข้อมูลนักเรียนและการเช็คชื่อจะถูกลบทั้งหมด
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ลบห้อง
              </button>
            </div>
          </div>
        )}
        
        {/* Color bar */}
        <div className="h-1 bg-primary rounded-full mb-3 group-hover:bg-primary-hover transition-colors"></div>
        
        {/* Header with title and actions */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            {/* Icon */}
            <div className="mb-2">
              <School size={36} className="text-primary" />
            </div>
            
            {/* Name */}
            <h3 className="text-lg font-bold text-text-primary mb-1">
              {classroom.name}
            </h3>
            
            {/* Level */}
            <p className="text-sm text-text-secondary mb-4">
              {classroom.level}
            </p>
          </div>
          
          {/* Action buttons - always visible on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleEditClick}
              className="p-1.5 bg-white border border-border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
              title="แก้ไข"
            >
              <Pencil size={14} className="text-blue-600" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 bg-white border border-border rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
              title="ลบ"
            >
              <Trash2 size={14} className="text-red-600" />
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-text-secondary">
            <Users size={14} />
            <span>{classroom.student_count || 0} คน</span>
          </div>
          <div className="flex items-center gap-1 text-text-secondary">
            <Calendar size={14} />
            <span>{classroom.academic_year}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
