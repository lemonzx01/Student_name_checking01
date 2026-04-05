'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { importStudentsFromExcel } from '@/lib/client-data'
import { extractImportedStudents } from '@/lib/student-import'

interface Props {
  onImported?: () => void
  variant?: 'primary' | 'secondary'
}

export default function ExcelImportButton({
  onImported,
  variant = 'secondary',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const xlsx = await import('xlsx')
      const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = xlsx.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      }) as unknown[][]

      const students = extractImportedStudents(rows)
      const result = await importStudentsFromExcel(students)

      if (!result.success) {
        throw new Error(result.error || 'ไม่สามารถ import ข้อมูลได้')
      }

      setMessage({
        type: 'success',
        text: `นำเข้า ${result.imported} คน, อัปเดต ${result.updated} คน, สร้าง ${result.classroomsCreated} ห้อง`,
      })
      onImported?.()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดระหว่างนำเข้า Excel',
      })
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  const buttonClassName =
    variant === 'primary'
      ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] shadow-sm'
      : 'border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className={`btn-press inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {loading ? 'กำลังอ่านไฟล์...' : 'Import Excel'}
      </button>

      {message && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className={`toast-enter flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg ${
              message.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <AlertCircle size={16} className="flex-shrink-0" />}
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="ml-1 flex-shrink-0 rounded-lg p-0.5 transition hover:bg-white/20">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
