'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, MessageSquare, Phone, X } from 'lucide-react'
import Link from 'next/link'
import {
  LINE_OPEN_URL,
  MinimalStudent,
  absentMessage,
  activityMessage,
  generalNoticeMessage,
  homeworkMessage,
  lowGradeMessage,
  meetingRequestMessage,
} from '@/lib/parent-message-templates'

export type ContactTemplateKey =
  | 'absent'
  | 'lowGrade'
  | 'homework'
  | 'meeting'
  | 'general'
  | 'activity'

interface Props {
  isOpen: boolean
  onClose: () => void
  student: MinimalStudent & {
    id: number
    guardian_phone?: string | null
  }
  defaultTemplate?: ContactTemplateKey
  defaultContext?: {
    date?: string
    subject?: string
    score?: number
    homeworkDetail?: string
    meetingDateTime?: string
    meetingReason?: string
    notice?: string
    activity?: string
    activityDateTime?: string
  }
}

const TEMPLATE_LABELS: Record<ContactTemplateKey, string> = {
  absent: 'แจ้งขาดเรียน',
  lowGrade: 'แจ้งคะแนนต่ำ',
  homework: 'แจ้งการบ้าน',
  meeting: 'เชิญพบครู',
  general: 'แจ้งทั่วไป',
  activity: 'แจ้งกิจกรรม',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ParentContactModal({
  isOpen,
  onClose,
  student,
  defaultTemplate = 'absent',
  defaultContext = {},
}: Props) {
  const [template, setTemplate] = useState<ContactTemplateKey>(defaultTemplate)
  const [date, setDate] = useState(defaultContext.date || todayIso())
  const [subject, setSubject] = useState(defaultContext.subject || '')
  const [score, setScore] = useState<string>(
    defaultContext.score !== undefined ? String(defaultContext.score) : ''
  )
  const [homeworkDetail, setHomeworkDetail] = useState(defaultContext.homeworkDetail || '')
  const [meetingDateTime, setMeetingDateTime] = useState(defaultContext.meetingDateTime || '')
  const [meetingReason, setMeetingReason] = useState(defaultContext.meetingReason || '')
  const [notice, setNotice] = useState(defaultContext.notice || '')
  const [activity, setActivity] = useState(defaultContext.activity || '')
  const [activityDateTime, setActivityDateTime] = useState(defaultContext.activityDateTime || '')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTemplate(defaultTemplate)
      setDate(defaultContext.date || todayIso())
      setCopied(false)
    }
  }, [isOpen, defaultTemplate, defaultContext.date])

  const messageText = useMemo(() => {
    switch (template) {
      case 'absent':
        return absentMessage(student, date)
      case 'lowGrade':
        return lowGradeMessage(student, subject || '(ระบุวิชา)', Number(score) || 0)
      case 'homework':
        return homeworkMessage(student, homeworkDetail || '(ระบุรายละเอียดการบ้าน)')
      case 'meeting':
        return meetingRequestMessage(
          student,
          meetingDateTime || '(ระบุวันเวลา)',
          meetingReason
        )
      case 'general':
        return generalNoticeMessage(student, notice || '(ใส่ข้อความที่ต้องการแจ้ง)')
      case 'activity':
        return activityMessage(
          student,
          activity || '(ระบุกิจกรรม)',
          activityDateTime || '(ระบุวันเวลา)'
        )
    }
  }, [
    template,
    student,
    date,
    subject,
    score,
    homeworkDetail,
    meetingDateTime,
    meetingReason,
    notice,
    activity,
    activityDateTime,
  ])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(messageText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[ParentContact] copy failed:', err)
    }
  }

  if (!isOpen) return null

  const phone = student.guardian_phone?.trim() || ''
  const noPhone = !phone

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-content relative w-full max-w-2xl rounded-[var(--radius-lg)] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">ติดต่อผู้ปกครอง</h2>
              <p className="text-xs text-[var(--muted)]">
                {[student.title, student.first_name, student.last_name].filter(Boolean).join(' ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="ปิด"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {/* Template chooser */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold text-slate-700">เลือกข้อความสำเร็จรูป</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TEMPLATE_LABELS) as ContactTemplateKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTemplate(key)}
                  className={`btn-press rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    template === key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {TEMPLATE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Template-specific inputs */}
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
            {template === 'absent' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">วันที่ขาดเรียน</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            )}
            {template === 'lowGrade' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">ชื่อวิชา</span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="เช่น คณิตศาสตร์"
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">คะแนนที่ได้</span>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            )}
            {template === 'homework' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">รายละเอียดการบ้าน</span>
                <textarea
                  value={homeworkDetail}
                  onChange={(e) => setHomeworkDetail(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            )}
            {template === 'meeting' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">วันเวลา</span>
                  <input
                    value={meetingDateTime}
                    onChange={(e) => setMeetingDateTime(e.target.value)}
                    placeholder="เช่น พฤหัส 15 ส.ค. 14:00 น."
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">เรื่อง (ไม่บังคับ)</span>
                  <input
                    value={meetingReason}
                    onChange={(e) => setMeetingReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            )}
            {template === 'general' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">เนื้อหา</span>
                <textarea
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            )}
            {template === 'activity' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">กิจกรรม</span>
                  <input
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">วันเวลา</span>
                  <input
                    value={activityDateTime}
                    onChange={(e) => setActivityDateTime(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Message preview */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold text-slate-700">ข้อความที่จะส่ง</label>
            <textarea
              readOnly
              value={messageText}
              rows={7}
              className="w-full resize-none rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-3 font-mono text-sm leading-relaxed text-slate-800"
            />
          </div>

          {/* Actions */}
          {noPhone ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">ยังไม่มีเบอร์โทรผู้ปกครอง</p>
              <p className="mt-0.5">
                สามารถคัดลอกข้อความไปแปะใน LINE ได้ หรือ{' '}
                <Link
                  href={`/students?student=${student.id}`}
                  className="font-semibold underline underline-offset-2"
                >
                  เพิ่มเบอร์ในหน้าข้อมูลนักเรียน
                </Link>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-medium text-emerald-700">เบอร์โทรผู้ปกครอง</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-900">{phone}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
            </button>

            <a
              href={LINE_OPEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <ExternalLink size={16} />
              เปิด LINE
            </a>

            {!noPhone && (
              <a
                href={`tel:${phone}`}
                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <Phone size={16} />
                โทร
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
