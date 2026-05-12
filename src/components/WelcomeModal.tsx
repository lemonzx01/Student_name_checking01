'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  HardDrive,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { downloadStudentTemplate } from '@/lib/excel-template'

const STORAGE_KEY = 'hasSeenWelcome'

/** First-run onboarding modal — แสดงครั้งเดียวต่อเครื่อง */
export default function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // ตรวจ flag ใน localStorage ตอน mount (client-only)
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        setOpen(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      await downloadStudentTemplate()
    } catch (err) {
      console.error('[WelcomeModal] download template failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (!open) return null

  const steps = [
    {
      icon: <Sparkles size={28} className="text-blue-600" />,
      title: 'ยินดีต้อนรับสู่ระบบจัดการนักเรียน',
      body: (
        <>
          <p className="text-slate-700">
            แอปนี้ช่วยจัดการห้องเรียน รายชื่อนักเรียน เช็คชื่อ คะแนน
            และสุขภาพ — ทำงานได้แบบออฟไลน์ ไม่ต้องเชื่อมเน็ต
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <HardDrive size={18} className="mt-0.5 flex-shrink-0 text-slate-500" />
            <div>
              <p className="font-semibold text-slate-800">ข้อมูลเก็บที่ไหน?</p>
              <p className="mt-0.5 text-slate-600">
                ทุกอย่างถูกเก็บใน <span className="font-mono">school.db</span>{' '}
                บนเครื่องคุณ — แอปจะสำรองข้อมูลอัตโนมัติทุกครั้งที่เปิด
                (เก็บย้อนหลัง 30 วัน)
              </p>
            </div>
          </div>
        </>
      ),
    },
    {
      icon: <BookOpen size={28} className="text-emerald-600" />,
      title: 'วิธีเริ่มต้นใช้งาน',
      body: (
        <>
          <ol className="space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                1
              </span>
              <span>
                <span className="font-semibold">สร้างห้องเรียน</span> — กดปุ่ม
                &quot;สร้างห้องเรียน&quot; แล้วตั้งชื่อ (เช่น ป.1, ม.1/1)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                2
              </span>
              <span>
                <span className="font-semibold">เพิ่มนักเรียน</span> —
                เพิ่มทีละคน หรือ Import จาก Excel (ดาวน์โหลด template ด้านล่าง)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                3
              </span>
              <span>
                <span className="font-semibold">เริ่มเช็คชื่อ / กรอกคะแนน</span>{' '}
                — เลือกเมนูจากด้านข้างเมื่อเข้าไปในห้องเรียนแล้ว
              </span>
            </li>
          </ol>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloading}
            className="btn-press mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {downloading ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel template'}
          </button>
        </>
      ),
    },
    {
      icon: <ShieldCheck size={28} className="text-violet-600" />,
      title: 'สำรองและกู้คืนข้อมูล',
      body: (
        <>
          <p className="text-sm text-slate-700">
            แอปจะสำรองข้อมูลอัตโนมัติทุกครั้งที่เปิด — ถ้าเผลอลบหรือข้อมูลผิด
            สามารถกู้คืนได้
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Download size={16} className="mt-0.5 flex-shrink-0 text-violet-600" />
              <span>
                <span className="font-semibold">สำรองด้วยตนเอง:</span> ไปที่
                &quot;ตั้งค่า&quot; → &quot;สำรองข้อมูล&quot;
                (ดาวน์โหลดไฟล์ JSON)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-violet-600" />
              <span>
                <span className="font-semibold">กู้คืน:</span> ไปที่
                &quot;ตั้งค่า&quot; → &quot;กู้คืนจากการสำรองอัตโนมัติ&quot;
                — เลือกวันที่ต้องการ
              </span>
            </li>
            <li className="flex items-start gap-2">
              <HardDrive size={16} className="mt-0.5 flex-shrink-0 text-violet-600" />
              <span>
                แนะนำให้ก๊อปโฟลเดอร์{' '}
                <span className="font-mono">backups</span>{' '}
                ไปเก็บใน USB / Google Drive ทุกสิ้นสัปดาห์
              </span>
            </li>
          </ul>
        </>
      ),
    },
  ]

  const isLast = step === steps.length - 1
  const current = steps[step]

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="modal-overlay absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={close}
      />
      <div className="modal-content relative w-full max-w-lg rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={close}
          title="ข้าม"
          className="btn-press absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100">
            {current.icon}
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <h2 className="text-xl font-bold text-slate-900">{current.title}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              ขั้นตอนที่ {step + 1} จาก {steps.length}
            </p>
          </div>
        </div>

        <div className="mb-6">{current.body}</div>

        {/* Progress dots */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            className="btn-press rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            ข้าม
          </button>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="btn-press inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft size={14} />
                ย้อนกลับ
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="btn-press inline-flex items-center gap-1 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
              >
                ต่อไป
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="btn-press rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                เริ่มใช้งาน
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
