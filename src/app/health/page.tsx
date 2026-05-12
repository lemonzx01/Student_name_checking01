'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Classroom, calculateBmi } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useBeforeUnloadWarning } from '@/lib/hooks/useBeforeUnloadWarning'

const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default || xlsx
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}

interface HealthRecord {
  student_id: number
  student_name: string
  student_code?: string
  title?: string
  brushed_teeth: boolean
  drank_milk: boolean
  weight_kg: number | null
  height_cm: number | null
  bmi: number
  bmi_status: string
  date: string
}

function HealthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classroomParam =
    searchParams.get('classroom') ||
    (typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null)
  const selectedClassroom = classroomParam ? Number(classroomParam) : null

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentClassroomName =
    classrooms.find((c) => c.id === selectedClassroom)?.name || ''

  useEffect(() => {
    loadClassrooms()
  }, [])

  useEffect(() => {
    if (selectedClassroom) {
      loadHealthData()
    }
  }, [selectedClassroom, selectedDate])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    }
  }

  // เปลี่ยนห้องเรียน → อัปเดต URL + localStorage
  function switchClassroom(id: number) {
    if (id === selectedClassroom) return
    localStorage.setItem('selectedClassroom', String(id))
    router.replace(`/health?classroom=${id}`)
  }

  const loadHealthData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/health?classroom=${selectedClassroom}&date=${selectedDate}`)
      const data = await res.json()
      setHealthRecords(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load health data:', error)
      setHealthRecords([])
    } finally {
      setLoading(false)
    }
  }

  // ─── Auto-save ────────────────────────────────────────────
  // บันทึกอัตโนมัติทุกครั้งที่ครูแก้ไขน้ำหนัก/ส่วนสูง/แปรงฟัน/ดื่มนม
  const saveHealth = useCallback(
    async (records: HealthRecord[]) => {
      if (!selectedClassroom || records.length === 0) return

      const payload = {
        classroom: selectedClassroom,
        date: selectedDate,
        records: records.map((r) => ({
          student_id: r.student_id,
          brushed_teeth: r.brushed_teeth,
          drank_milk: r.drank_milk,
          weight_kg: r.weight_kg,
          height_cm: r.height_cm,
        })),
      }
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
    },
    [selectedClassroom, selectedDate]
  )

  const { status: saveStatus, lastSavedAt, hasPendingChanges } = useAutoSave(healthRecords, saveHealth, {
    // ครูพิมพ์ตัวเลขลงในช่อง — รอหยุดพิมพ์สักพัก
    debounceMs: 1000,
    enabled: !!selectedClassroom && !loading && healthRecords.length > 0,
  })

  // เตือนก่อนปิดหน้า ถ้ามีข้อมูลสุขภาพรอบันทึก
  useBeforeUnloadWarning(hasPendingChanges)

  const updateField = (
    studentId: number,
    field: 'weight_kg' | 'height_cm' | 'brushed_teeth' | 'drank_milk',
    value: number | boolean | null
  ) => {
    setHealthRecords((prev) =>
      prev.map((r) => {
        if (r.student_id !== studentId) return r
        const next: HealthRecord = { ...r, [field]: value }
        const weight = typeof next.weight_kg === 'number' ? next.weight_kg : 0
        const height = typeof next.height_cm === 'number' ? next.height_cm : 0
        const bmi = calculateBmi(weight, height)
        next.bmi = bmi.bmi
        next.bmi_status = bmi.status
        return next
      })
    )
  }

  const exportToExcel = async () => {
    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        setToast({ type: 'error', text: 'ไม่สามารถโหลดโมดูล xlsx' })
        return
      }

      const workbook = XLSX.utils.book_new()
      const headers = ['ลำดับ', 'ชื่อนักเรียน', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ', 'แปรงฟัน', 'ดื่มนม']
      const rows = healthRecords.map((r, i) => [
        i + 1,
        r.student_name,
        r.weight_kg ?? '',
        r.height_cm ?? '',
        r.bmi > 0 ? r.bmi.toFixed(1) : '-',
        r.bmi_status || '-',
        r.brushed_teeth ? 'ใช่' : '-',
        r.drank_milk ? 'ใช่' : '-',
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
      ]
      XLSX.utils.book_append_sheet(workbook, ws, 'สุขภาพ')

      const bmiGroups = ['ผอม', 'ปกติ', 'น้ำหนักเกิน', 'อ้วน', 'อ้วนมาก']
      const total = healthRecords.filter((r) => r.bmi > 0).length
      const summaryRows = bmiGroups.map((status) => {
        const count = healthRecords.filter((r) => r.bmi_status === status).length
        return [status, count, total > 0 ? ((count / total) * 100).toFixed(1) : '0.0']
      })
      summaryRows.push(['รวม', total, '100.0'])

      const ws2 = XLSX.utils.aoa_to_sheet([['สถานะ BMI', 'จำนวน (คน)', 'ร้อยละ (%)'], ...summaryRows])
      ws2['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(workbook, ws2, 'สรุป BMI')

      const fileName = `สุขภาพ_${currentClassroomName || selectedClassroom}_${selectedDate}.xlsx`
      XLSX.writeFile(workbook, fileName)
      setToast({ type: 'success', text: 'ส่งออกไฟล์สำเร็จ' })
    } catch (error) {
      console.error('Export error:', error)
      setToast({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งออก' })
    }
  }

  const bmiBadgeClass = (status: string) => {
    switch (status) {
      case 'ผอม':
        return 'bg-blue-50 text-blue-700 border border-blue-200'
      case 'ปกติ':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      case 'น้ำหนักเกิน':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'อ้วน':
        return 'bg-orange-50 text-orange-700 border border-orange-200'
      case 'อ้วนมาก':
        return 'bg-red-50 text-red-700 border border-red-200'
      default:
        return 'bg-slate-50 text-slate-500 border border-slate-200'
    }
  }

  const getBmiIcon = (bmi: number) => {
    if (bmi === 0) return <Minus size={14} />
    if (bmi < 18.5) return <TrendingDown size={14} />
    if (bmi < 23) return <Minus size={14} />
    return <TrendingUp size={14} />
  }

  const bmiStats = (() => {
    const groups = ['ผอม', 'ปกติ', 'น้ำหนักเกิน', 'อ้วน', 'อ้วนมาก']
    const total = healthRecords.filter((r) => r.bmi > 0).length
    const byStatus = Object.fromEntries(
      groups.map((g) => [g, healthRecords.filter((r) => r.bmi_status === g).length])
    )
    return { total, byStatus }
  })()

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          <Activity size={13} />
          Health Tracking
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">น้ำหนัก / ส่วนสูง</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              บันทึกและคำนวณค่า BMI{currentClassroomName ? ` • ห้อง ${currentClassroomName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportToExcel}
              disabled={healthRecords.length === 0}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-sm)] transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              ส่งออก Excel
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Classroom selector — ปุ่มกดเลือกห้อง */}
      {classrooms.length > 0 && (
        <div className="animate-slide-up mb-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
          <label className="mb-2 block text-xs font-semibold text-slate-700">ห้องเรียน</label>
          <div className="flex flex-wrap gap-1.5">
            {classrooms.map((cls) => {
              const isSelected = selectedClassroom === cls.id
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => switchClassroom(cls.id)}
                  className={`btn-press inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cls.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Controls + Stats */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="animate-slide-up rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <label className="mb-2 block text-sm font-semibold text-slate-700">วันที่บันทึก</label>
          <CalendarPicker value={selectedDate} onChange={(d) => setSelectedDate(d)} />
          <p className="mt-3 text-xs text-[var(--muted)]">
            ระบบจะจัดเก็บข้อมูลตามวันที่ เพื่อติดตามการเปลี่ยนแปลง
          </p>
        </div>

        <div className="animate-slide-up grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {(['ผอม', 'ปกติ', 'น้ำหนักเกิน', 'อ้วน', 'อ้วนมาก'] as const).map((status) => (
            <div
              key={status}
              className={`rounded-2xl border bg-white p-3 shadow-[var(--shadow-sm)] ${
                status === 'ผอม'
                  ? 'stat-blue'
                  : status === 'ปกติ'
                    ? 'stat-green'
                    : status === 'น้ำหนักเกิน'
                      ? 'stat-amber'
                      : status === 'อ้วน'
                        ? 'stat-pink'
                        : 'stat-red'
              }`}
            >
              <p className="text-[11px] font-medium text-[var(--muted)]">{status}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {bmiStats.byStatus[status] || 0}
                <span className="ml-1 text-xs font-normal text-[var(--muted)]">คน</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* BMI Legend */}
      <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">ช่วงค่า BMI</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <LegendBadge color="bg-blue-500" label="ผอม (<18.5)" />
          <LegendBadge color="bg-emerald-500" label="ปกติ (18.5-22.9)" />
          <LegendBadge color="bg-amber-500" label="น้ำหนักเกิน (23-24.9)" />
          <LegendBadge color="bg-orange-500" label="อ้วน (25-29.9)" />
          <LegendBadge color="bg-red-500" label="อ้วนมาก (≥30)" />
        </div>
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          กรุณาเลือกห้องเรียนก่อน
        </div>
      ) : loading ? (
        <div className="grid gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : healthRecords.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          ไม่พบข้อมูลนักเรียนในห้องนี้
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="w-14 px-3 py-3 text-center font-semibold">#</th>
                  <th className="px-3 py-3 text-left font-semibold">ชื่อนักเรียน</th>
                  <th className="w-28 px-3 py-3 text-center font-semibold">น้ำหนัก (กก.)</th>
                  <th className="w-28 px-3 py-3 text-center font-semibold">ส่วนสูง (ซม.)</th>
                  <th className="w-20 px-3 py-3 text-center font-semibold">BMI</th>
                  <th className="w-32 px-3 py-3 text-center font-semibold">สถานะ</th>
                  <th className="w-24 px-3 py-3 text-center font-semibold">แปรงฟัน</th>
                  <th className="w-24 px-3 py-3 text-center font-semibold">ดื่มนม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {healthRecords.map((record, index) => (
                  <tr key={record.student_id} className="transition hover:bg-blue-50/30">
                    <td className="px-3 py-2.5 text-center text-[var(--muted)]">{index + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <div className="flex flex-col">
                        <span>{record.student_name}</span>
                        {record.student_code && (
                          <span className="text-xs text-[var(--muted)]">{record.student_code}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={record.weight_kg ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          updateField(record.student_id, 'weight_kg', raw === '' ? null : Number(raw))
                        }}
                        placeholder="0"
                        min="0"
                        step="0.1"
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-center focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={record.height_cm ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          updateField(record.student_id, 'height_cm', raw === '' ? null : Number(raw))
                        }}
                        placeholder="0"
                        min="0"
                        step="0.1"
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-center focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                      {record.bmi > 0 ? record.bmi.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${bmiBadgeClass(record.bmi_status)}`}
                      >
                        {getBmiIcon(record.bmi)}
                        {record.bmi_status || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={record.brushed_teeth}
                        onChange={(e) =>
                          updateField(record.student_id, 'brushed_teeth', e.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer rounded border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={record.drank_milk}
                        onChange={(e) =>
                          updateField(record.student_id, 'drank_milk', e.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer rounded border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auto-save indicator (มุมล่างขวา) */}
      <AutoSaveIndicator
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        hidden={!selectedClassroom}
      />
    </div>
  )
}

function LegendBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  )
}

export default function HealthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl">
          <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
        </div>
      }
    >
      <HealthPageContent />
    </Suspense>
  )
}
