'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Calendar, CheckCircle, Download, FileText, UserMinus, UserX } from 'lucide-react'
import { Classroom, AttendanceRow, Student } from '@/types'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/PageHeader'
import { toLocalISO } from '@/lib/local-date'

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
    const firstDay = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1))
    const lastDay = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
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
        const dateStr = toLocalISO(d)
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
      <PageHeader
        icon={BarChart3}
        badge="Attendance Report"
        title="รายงานการเช็คชื่อ"
        subtitle="สรุปการมาเรียนของนักเรียนตามช่วงวันที่ที่เลือก"
      />

      {/* Controls */}
      <div className="card mb-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-soft)]">ห้องเรียน</label>
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
              className="btn btn-primary w-full"
            >
              <FileText size={18} />
              {loading ? 'กำลังโหลด...' : 'สร้างรายงาน'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-2.5 text-sm font-medium text-[var(--warning-strong)]">
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
              color="text-[var(--success)]"
              bg="bg-[var(--success-soft)]"
            />
            <SummaryStat
              icon={<UserX size={20} />}
              label="ขาดเรียน"
              value={totals.absent}
              accent="stat-red"
              color="text-[var(--danger)]"
              bg="bg-[var(--danger-soft)]"
            />
            <SummaryStat
              icon={<UserMinus size={20} />}
              label="ลาป่วย/ลากิจ"
              value={totals.sickLeave + totals.personalLeave}
              accent="stat-amber"
              color="text-[var(--warning)]"
              bg="bg-[var(--warning-soft)]"
            />
            <SummaryStat
              icon={<Calendar size={20} />}
              label="อัตราการมาเรียน"
              value={`${totals.attendanceRate}%`}
              accent="stat-blue"
              color="text-[var(--primary)]"
              bg="bg-[var(--primary-ghost)]"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--text-soft)]">
                แสดงผล {reportData.length} วัน
              </div>
              <button
                type="button"
                onClick={exportToExcel}
                className="btn btn-sm"
                style={{ background: 'var(--success)', color: '#fff' }}
              >
                <Download size={16} />
                ส่งออก Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--text-soft)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">วันที่</th>
                    <th className="px-4 py-3 text-center font-semibold">วัน</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--success)]">มา</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--danger)]">ขาด</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--warning)]">ลาป่วย</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--info)]">ลากิจ</th>
                    <th className="px-4 py-3 text-center font-semibold">% มา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {reportData.map((row) => (
                    <tr key={row.date} className="transition hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{row.date}</td>
                      <td className="px-4 py-3 text-center text-[var(--muted)]">{row.day}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[var(--success)]">{row.present}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[var(--danger)]">{row.absent}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[var(--warning)]">{row.sickLeave}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[var(--info)]">{row.personalLeave}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[var(--text)]">{row.presentPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && reportData.length === 0 && !error && (
        <div className="empty-state">
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
      className={`card flex items-center gap-4 p-4 ${accent}`}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${color}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}
