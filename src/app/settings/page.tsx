'use client'

import { useState } from 'react'
import { Download, Upload, Database, AlertTriangle, CheckCircle, GraduationCap, Calendar, Laptop, Settings } from 'lucide-react'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    
    try {
      // Check if Electron is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      
      if (isElectron) {
        // Use Electron API directly
        const data = await window.electronAPI!.exportData()
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setMessage({ type: 'success', text: 'สำรองข้อมูลสำเร็จ!' })
      } else {
        // Fallback: Use API (for web mode)
        const res = await fetch('/api/settings/export')
        if (res.ok) {
          const data = await res.json()
          
          if (data.error) {
            throw new Error(data.error)
          }
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          setMessage({ type: 'success', text: 'สำรองข้อมูลสำเร็จ!' })
        } else {
          throw new Error('Export failed')
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการสำรองข้อมูล' })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate data structure
      if (!data.version || !data.classrooms || !data.students) {
        throw new Error('Invalid backup file format')
      }
      
      // Check if Electron is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      
      if (isElectron) {
        // Use Electron API directly
        const result = await window.electronAPI!.importData(data)
        if (result.success) {
          setMessage({ type: 'success', text: 'นำเข้าข้อมูลสำเร็จ! กำลังรีเฟรช...' })
          setTimeout(() => window.location.href = '/', 1500)
        } else {
          throw new Error(result.error || 'Import failed')
        }
      } else {
        // Fallback: Use API (for web mode)
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })

        if (res.ok) {
          setMessage({ type: 'success', text: 'นำเข้าข้อมูลสำเร็จ! กำลังรีเฟรช...' })
          setTimeout(() => window.location.href = '/', 1500)
        } else {
          throw new Error('Import failed')
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      setMessage({ type: 'error', text: 'ไฟล์ไม่ถูกต้องหรือเกิดข้อผิดพลาด' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">ตั้งค่า</h1>
        <p className="text-text-secondary mt-1">จัดการข้อมูลและการสำรองข้อมูล</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      {/* Backup/Restore Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Export */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Download className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">สำรองข้อมูล</h2>
              <p className="text-sm text-text-secondary">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            สำรองข้อมูลห้องเรียน นักเรียน การเช็คชื่อ และคะแนนทั้งหมด
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Database size={18} />
            {exporting ? 'กำลังสำรอง...' : 'ดาวน์โหลดไฟล์สำรอง'}
          </button>
        </div>

        {/* Import */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Upload className="text-green-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">นำเข้าข้อมูล</h2>
              <p className="text-sm text-text-secondary">อัปโหลดไฟล์ JSON เพื่อกู้คืนข้อมูล</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            ⚠️ การนำเข้าจะแทนที่ข้อมูลเดิมทั้งหมด
          </p>
          <label className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border hover:border-primary rounded-lg px-4 py-8 cursor-pointer transition-colors">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
            <Upload size={20} className="text-text-secondary" />
            <span className="text-text-secondary">
              {importing ? 'กำลังนำเข้า...' : 'เลือกไฟล์ JSON'}
            </span>
          </label>
        </div>
      </div>

      {/* App Info */}
      <div className="mt-8 p-6 bg-surface rounded-xl border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-4">ข้อมูลโปรแกรม</h2>
        <div className="space-y-2 text-sm text-text-secondary">
          <p><GraduationCap className="inline" size={16} /> <strong>ระบบจัดการโรงเรียน</strong> v1.0</p>
          <p><Calendar className="inline" size={14} /> พัฒนาในปีการศึกษา {new Date().getFullYear() + 543}</p>
          <p><Laptop className="inline" size={14} /> Desktop Application (Offline Mode)</p>
          <p><Settings className="inline" size={14} /> Tech: Next.js + Electron + SQLite</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 p-6 bg-red-50 rounded-xl border border-red-200">
        <h2 className="text-lg font-bold text-red-700 mb-2"><AlertTriangle className="inline" size={18} /> พื้นที่เสี่ยง</h2>
        <p className="text-sm text-red-600 mb-4">
          การลบข้อมูลจะไม่สามารถกู้คืนได้ กรุณาสำรองข้อมูลก่อนดำเนินการ
        </p>
        <button
          onClick={async () => {
            if (confirm('คุณแน่ใจที่จะลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถยกเลิกได้')) {
              if (confirm('ยืนยันอีกครั้ง: ข้อมูลห้องเรียน นักเรียน เช็คชื่อ คะแนน สุขภาพ ทั้งหมดจะหายไป')) {
                try {
                  const res = await fetch('/api/settings', { method: 'DELETE' })
                  if (res.ok) {
                    setMessage({ type: 'success', text: 'ลบข้อมูลทั้งหมดสำเร็จ! กำลังรีเฟรช...' })
                    setTimeout(() => window.location.href = '/', 1500)
                  } else {
                    throw new Error('Delete failed')
                  }
                } catch (error) {
                  console.error('Delete error:', error)
                  setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการลบข้อมูล' })
                }
              }
            }
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          ลบข้อมูลทั้งหมด
        </button>
      </div>
    </div>
  )
}
