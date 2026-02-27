'use client'

import { useState, useEffect } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import ClassroomCard from '@/components/ClassroomCard'
import CreateClassroomModal from '@/components/CreateClassroomModal'
import { Classroom } from '@/types'

export default function HomePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)

  useEffect(() => {
    // Clear selected classroom so app always starts at home
    localStorage.removeItem('selectedClassroom')
    loadClassrooms()
  }, [])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(data)
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuccess = () => {
    loadClassrooms()
    setIsModalOpen(false)
    setEditingClassroom(null)
  }

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/classrooms?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        loadClassrooms()
      }
    } catch (error) {
      console.error('Failed to delete classroom:', error)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingClassroom(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">ห้องเรียนทั้งหมด</h1>
          <p className="text-text-secondary mt-1">จัดการห้องเรียนและนักเรียน</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={20} />
          สร้างห้องเรียนใหม่
        </button>
      </div>

      {/* Classroom Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : classrooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-surface rounded-xl border border-border">
          <BookOpen size={48} className="text-text-secondary mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">ยังไม่มีห้องเรียน</h3>
          <p className="text-text-secondary mb-4">กดปุ่ม "สร้างห้องเรียนใหม่" เพื่อเริ่มต้น</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium"
          >
            <Plus size={20} />
            สร้างห้องเรียนใหม่
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classrooms.map((classroom) => (
            <ClassroomCard 
              key={classroom.id} 
              classroom={classroom}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CreateClassroomModal 
        isOpen={isModalOpen} 
        onClose={handleModalClose}
        onSuccess={handleCreateSuccess}
        editingClassroom={editingClassroom}
      />
    </div>
  )
}
