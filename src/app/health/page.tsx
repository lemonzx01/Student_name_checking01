'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Minus,
  School,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Classroom, calculateBmi, getClassroomColor } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'
import AutoSaveIndicator from '@/components/AutoSaveIndicator'
import PageHeader from '@/components/PageHeader'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useBeforeUnloadWarning } from '@/lib/hooks/useBeforeUnloadWarning'
import { todayISO } from '@/lib/local-date'

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
  const urlClassroom = searchParams.get('classroom')
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(
    urlClassroom ? Number(urlClassroom) : null
  )
  useEffect(() => {
    if (urlClassroom) {
      setSelectedClassroom(Number(urlClassroom))
      return
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedClassroom') : null
    if (stored) setSelectedClassroom(Number(stored))
  }, [urlClassroom])

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentClassroomName =
    classrooms.find((c) => c.id === selectedClassroom)?.name || ''

  const loadClassrooms = useCallback(async () => {
    try {
      const res = await fetch('/api/classrooms')
      if (!res.ok) {
        console.error(`[health] loadClassrooms failed: ${res.status}`)
        setClassrooms([])
        return
      }
      const data = await res.json()
      setClassrooms(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load classrooms:', error)
    }
  }, [])

  const loadHealthData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/health?classroom=${selectedClassroom}&date=${selectedDate}`)
      if (!res.ok) {
        console.error(`[health] loadHealthData failed: ${res.status}`)
        setHealthRecords([])
        return
      }
      const data = await res.json()
      setHealthRecords(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load health data:', error)
      setHealthRecords([])
    } finally {
      setLoading(false)
    }
  }, [selectedClassroom, selectedDate])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  useEffect(() => {
    if (selectedClassroom) {
      loadHealthData()
    }
  }, [selectedClassroom, selectedDate, loadHealthData])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // เปลี่ยนห้องเรียน → อัปเดต URL + localStorage
  function switchClassroom(id: number) {
    if (id === selectedClassroom) return
    localStorage.setItem('selectedClassroom', String(id))
    router.replace(`/health?classroom=${id}`)
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

  // ใช้ pill tokens แทนการ hardcode สีโดยตรง
  // ผอม → info, ปกติ → ok, น้ำหนักเกิน → warn, อ้วน/อ้วนมาก → danger
  const bmiPillClass = (status: string) => {
    switch (status) {
      case 'ผอม':
        return 'pill pill-info'
      case 'ปกติ':
        return 'pill pill-ok'
      case 'น้ำหนักเกิน':
        return 'pill pill-warn'
      case 'อ้วน':
      case 'อ้วนมาก':
        return 'pill pill-danger'
      default:
        return 'pill pill-muted'
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
      <PageHeader
        icon={Activity}
        badge="Health Tracking"
        tone="ok"
        title="น้ำหนัก / ส่วนสูง"
        subtitle={`บันทึกและคำนวณค่า BMI${currentClassroomName ? ` • ห้อง ${currentClassroomName}` : ''}`}
        actions={
          <button
            type="button"
            onClick={exportToExcel}
            disabled={healthRecords.length === 0}
            className="btn btn-secondary btn-sm"
          >
            <FileSpreadsheet size={18} />
            ส่งออก Excel
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div
          className={`toast-enter mb-6 flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3.5 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-[var(--success-soft)] text-[var(--success-strong)]'
              : 'bg-[var(--danger-soft)] text-[var(--danger-strong)]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Classroom selector — ปุ่มกดเลือกห้อง */}
      {classrooms.length > 0 && (
        <div className="card animate-slide-up mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-soft)]">
                <School className="h-3.5 w-3.5" />
              </span>
              <span className="section-title text-xs">ห้องเรียน</span>
            </div>
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">
              {classrooms.length} ห้อง
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {classrooms.map((cls) => {
              const isSelected = selectedClassroom === cls.id
              const color = getClassroomColor(cls)
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => switchClassroom(cls.id)}
                  className={`btn-press inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    isSelected
                      ? `${color.bg} text-white shadow-md ring-1 ring-white/40`
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-sm'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : color.bg}`}
                  />
                  {cls.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Controls + Stats */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card animate-slide-up p-5">
          <label className="section-title mb-2 block">วันที่บันทึก</label>
          <CalendarPicker value={selectedDate} onChange={(d) => setSelectedDate(d)} />
          <p className="mt-3 text-xs text-[var(--muted)]">
            ระบบจะจัดเก็บข้อมูลตามวันที่ เพื่อติดตามการเปลี่ยนแปลง
          </p>
        </div>

        <div className="animate-slide-up grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {(['ผอม', 'ปกติ', 'น้ำหนักเกิน', 'อ้วน', 'อ้วนมาก'] as const).map((status) => {
            // map BMI group → tone token (ใช้ accent border-left สื่อสถานะ)
            const accentVar =
              status === 'ผอม'
                ? 'var(--info)'
                : status === 'ปกติ'
                  ? 'var(--success)'
                  : status === 'น้ำหนักเกิน'
                    ? 'var(--warning)'
                    : 'var(--danger)'
            return (
              <div
                key={status}
                className="card p-3"
                style={{ borderLeft: `3px solid ${accentVar}` }}
              >
                <p className="text-[11px] font-medium text-[var(--muted)]">{status}</p>
                <p className="mt-0.5 text-xl font-bold text-[var(--text)]">
                  {bmiStats.byStatus[status] || 0}
                  <span className="ml-1 text-xs font-normal text-[var(--muted)]">คน</span>
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* BMI Legend */}
      <div className="card mb-6 p-4">
        <h3 className="section-title mb-3">ช่วงค่า BMI</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <LegendBadge accent="var(--info)" label="ผอม (<18.5)" />
          <LegendBadge accent="var(--success)" label="ปกติ (18.5-22.9)" />
          <LegendBadge accent="var(--warning)" label="น้ำหนักเกิน (23-24.9)" />
          <LegendBadge accent="var(--danger)" label="อ้วน (25-29.9)" />
          <LegendBadge accent="var(--danger-strong)" label="อ้วนมาก (≥30)" />
        </div>
      </div>

      {/* Table */}
      {!selectedClassroom ? (
        <div className="empty-state">กรุณาเลือกห้องเรียนก่อน</div>
      ) : loading ? (
        <div className="grid gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : healthRecords.length === 0 ? (
        <div className="empty-state">ไม่พบข้อมูลนักเรียนในห้องนี้</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-soft)] text-[var(--text)]">
                <tr>
                  <th className="w-14 px-3 py-3 text-center font-bold">#</th>
                  <th className="px-3 py-3 text-left font-bold">ชื่อนักเรียน</th>
                  <th className="w-28 px-3 py-3 text-center font-bold">น้ำหนัก (กก.)</th>
                  <th className="w-28 px-3 py-3 text-center font-bold">ส่วนสูง (ซม.)</th>
                  <th className="w-20 px-3 py-3 text-center font-bold">BMI</th>
                  <th className="w-32 px-3 py-3 text-center font-bold">สถานะ</th>
                  <th className="w-24 px-3 py-3 text-center font-bold">แปรงฟัน</th>
                  <th className="w-24 px-3 py-3 text-center font-bold">ดื่มนม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {healthRecords.map((record, index) => (
                  <tr
                    key={record.student_id}
                    className="transition hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-3 py-2.5 text-center text-[var(--muted)]">{index + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text)]">
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
                        className="input text-center"
                        style={{ padding: '6px 10px', fontSize: 13 }}
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
                        className="input text-center"
                        style={{ padding: '6px 10px', fontSize: 13 }}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-[var(--text)]">
                      {record.bmi > 0 ? record.bmi.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={bmiPillClass(record.bmi_status)}>
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

function LegendBadge({ accent, label }: { accent: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-soft)]">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
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
