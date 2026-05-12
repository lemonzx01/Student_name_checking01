'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Calendar, CheckCircle, Download, FileText, UserMinus, UserX } from 'lucide-react'
import { Classroom, AttendanceRow, Student } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'

const loadXLSX = async () => {
  try {
    const xlsx = await import('xlsx')
    return xlsx.default || xlsx
  } catch (e) {
    console.error('Failed to load xlsx:', e)
    return null
  }
}

interface ReportRow {
  date: string
  day: string
  present: number
  absent: number
  sickLeave: number
  personalLeave: number
  total: number
  presentPercent: string
}

export default function AttendanceReportPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadClassrooms()
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(firstDay)
    setEndDate(lastDay)
  }, [])

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      const data = await res.json()
      setClassrooms(data)
      if (data.length > 0) setSelectedClassroom(data[0].id)
    } catch (err) {
      console.error('Failed to load classrooms:', err)
    }
  }

  const generateReport = async () => {
    if (!selectedClassroom || !startDate || !endDate) {
      setError('กรุณาเลือกห้องเรียนและช่วงวันที่')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const url = `/api/export-excel?classroom=${selectedClassroom}&startDate=${startDate}&endDate=${endDate}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const data: {
        students: Student[]
        attendance: AttendanceRow[]
      } = await res.json()

      const total = data.students.length
      const dayMap = new Map<string, AttendanceRow[]>()
      for (const row of data.attendance) {
        if (!dayMap.has(row.date)) dayMap.set(row.date, [])
        dayMap.get(row.date)!.push(row)
      }

      const start = new Date(startDate)
      const end = new Date(endDate)
      const result: ReportRow[] = []
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const rows = dayMap.get(dateStr)
        if (!rows || rows.length === 0) continue

        const present = rows.filter((a) => a.status === 'มา').length
        const absent = rows.filter((a) => a.status === 'ขาด').length
        const sickLeave = rows.filter((a) => a.status === 'ลาป่วย').length
        const personalLeave = rows.filter((a) => a.status === 'ลากิจ').length
        const presentPercent = total > 0 ? ((present / total) * 100).toFixed(1) : '0'

        result.push({
          date: dateStr,
          day: d.toLocaleDateString('th-TH', { weekday: 'short' }),
          present,
          absent,
          sickLeave,
          personalLeave,
          total,
          presentPercent,
        })
      }
      setReportData(result)
      if (result.length === 0) {
        setError('ไม่พบข้อมูลการเช็คชื่อในช่วงวันที่ที่เลือก')
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError('เกิดข้อผิดพลาดในการสร้างรายงาน')
    } finally {
      setLoading(false)
    }
  }

  const totals = useMemo(() => {
    const present = reportData.reduce((sum, r) => sum + r.present, 0)
    const absent = reportData.reduce((sum, r) => sum + r.absent, 0)
    const sickLeave = reportData.reduce((sum, r) => sum + r.sickLeave, 0)
    const personalLeave = reportData.reduce((sum, r) => sum + r.personalLeave, 0)
    const totalAll = present + absent + sickLeave + personalLeave
    const attendanceRate = totalAll > 0 ? ((present / totalAll) * 100).toFixed(1) : '0.0'
    return { present, absent, sickLeave, personalLeave, attendanceRate }
  }, [reportData])

  const exportToExcel = async () => {
    if (reportData.length === 0) return
    try {
      const XLSX = await loadXLSX()
      if (!XLSX) {
        setError('ไม่สามารถโหลดโมดูล Excel')
        return
      }

      const classroomName = classrooms.find((c) => c.id === selectedClassroom)?.name || ''
      const exportData = reportData.map((r) => ({
        วันที่: r.date,
        วัน: r.day,
        มา: r.present,
        ขาด: r.absent,
        ลาป่วย: r.sickLeave,
        ลากิจ: r.personalLeave,
        รวม: r.total,
        เปอร์เซ็นต์มา: r.presentPercent + '%',
      }))
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงาน')
      worksheet['!cols'] = [
        { wch: 12 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 10 },
        { wch: 8 },
        { wch: 14 },
      ]
      const fileName = `รายงานเช็คชื่อ_${classroomName}_${startDate}_ถึง_${endDate}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (err) {
      console.error('Export error:', err)
      setError('เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          <BarChart3 size={13} />
          Attendance Report
        </div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">รายงานการเช็คชื่อ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">สรุปการมาเรียนของนักเรียนตามช่วงวันที่ที่เลือก</p>
      </div>

      {/* Controls */}
      <div className="animate-slide-up mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">ห้องเรียน</label>
            <CustomSelect
              value={selectedClassroom || ''}
              onChange={(v) => setSelectedClassroom(Number(v))}
              options={classrooms.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="เลือกห้องเรียน"
            />
          </div>
          <div>
            <CalendarPicker value={startDate} onChange={setStartDate} label="วันที่เริ่ม" compact />
          </div>
          <div>
            <CalendarPicker value={endDate} onChange={setEndDate} label="วันที่สิ้นสุด" compact />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={generateReport}
              disabled={loading}
              className="btn-press w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
            >
              <FileText size={18} />
              {loading ? 'กำลังโหลด...' : 'สร้างรายงาน'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
            {error}
          </div>
        )}
      </div>

      {/* Summary + Table */}
      {reportData.length > 0 && (
        <>
          <div className="animate-slide-up mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              icon={<CheckCircle size={20} />}
              label="มาเรียนรวม"
              value={totals.present}
              accent="stat-green"
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <SummaryStat
              icon={<UserX size={20} />}
              label="ขาดเรียน"
              value={totals.absent}
              accent="stat-red"
              color="text-red-600"
              bg="bg-red-50"
            />
            <SummaryStat
              icon={<UserMinus size={20} />}
              label="ลาป่วย/ลากิจ"
              value={totals.sickLeave + totals.personalLeave}
              accent="stat-amber"
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <SummaryStat
              icon={<Calendar size={20} />}
              label="อัตราการมาเรียน"
              value={`${totals.attendanceRate}%`}
              accent="stat-blue"
              color="text-blue-600"
              bg="bg-blue-50"
            />
          </div>

          <div className="animate-slide-up overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-700">
                แสดงผล {reportData.length} วัน
              </div>
              <button
                type="button"
                onClick={exportToExcel}
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-emerald-700"
              >
                <Download size={16} />
                ส่งออก Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">วันที่</th>
                    <th className="px-4 py-3 text-center font-semibold">วัน</th>
                    <th className="px-4 py-3 text-center font-semibold text-emerald-600">มา</th>
                    <th className="px-4 py-3 text-center font-semibold text-red-600">ขาด</th>
                    <th className="px-4 py-3 text-center font-semibold text-amber-600">ลาป่วย</th>
                    <th className="px-4 py-3 text-center font-semibold text-sky-600">ลากิจ</th>
                    <th className="px-4 py-3 text-center font-semibold">% มา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {reportData.map((row) => (
                    <tr key={row.date} className="transition hover:bg-blue-50/30">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.date}</td>
                      <td className="px-4 py-3 text-center text-[var(--muted)]">{row.day}</td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-600">{row.present}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{row.absent}</td>
                      <td className="px-4 py-3 text-center font-semibold text-amber-600">{row.sickLeave}</td>
                      <td className="px-4 py-3 text-center font-semibold text-sky-600">{row.personalLeave}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900">{row.presentPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && reportData.length === 0 && !error && (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--line)] bg-white px-6 py-16 text-center text-[var(--muted)]">
          เลือกห้องเรียนและช่วงวันที่ แล้วกด &ldquo;สร้างรายงาน&rdquo;
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  icon,
  label,
  value,
  accent,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent: string
  color: string
  bg: string
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] ${accent}`}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${color}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
