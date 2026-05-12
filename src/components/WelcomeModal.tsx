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
      icon: <Sparkles size={36} className="text-[var(--primary)]" />,
      iconBg: 'bg-[var(--primary-ghost)]',
      title: 'ยินดีต้อนรับสู่ระบบจัดการนักเรียน',
      body: (
        <>
          <p className="text-[var(--text-soft)]">
            แอปนี้ช่วยจัดการห้องเรียน รายชื่อนักเรียน เช็คชื่อ คะแนน
            และสุขภาพ — ทำงานได้แบบออฟไลน์ ไม่ต้องเชื่อมเน็ต
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
            <HardDrive size={18} className="mt-0.5 flex-shrink-0 text-[var(--muted)]" />
            <div>
              <p className="font-semibold text-[var(--text)]">ข้อมูลเก็บที่ไหน?</p>
              <p className="mt-0.5 text-[var(--text-soft)]">
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
      icon: <BookOpen size={36} className="text-[var(--success)]" />,
      iconBg: 'bg-[var(--success-soft)]',
      title: 'วิธีเริ่มต้นใช้งาน',
      body: (
        <>
          <ol className="space-y-2.5 text-sm text-[var(--text-soft)]">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-strong)]">
                1
              </span>
              <span>
                <span className="font-semibold text-[var(--text)]">สร้างห้องเรียน</span> — กดปุ่ม
                &quot;สร้างห้องเรียน&quot; แล้วตั้งชื่อ (เช่น ป.1, ม.1/1)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-strong)]">
                2
              </span>
              <span>
                <span className="font-semibold text-[var(--text)]">เพิ่มนักเรียน</span> —
                เพิ่มทีละคน หรือ Import จาก Excel (ดาวน์โหลด template ด้านล่าง)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-strong)]">
                3
              </span>
              <span>
                <span className="font-semibold text-[var(--text)]">เริ่มเช็คชื่อ / กรอกคะแนน</span>{' '}
                — เลือกเมนูจากด้านข้างเมื่อเข้าไปในห้องเรียนแล้ว
              </span>
            </li>
          </ol>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloading}
            className="btn btn-sm mt-5"
            style={{ background: 'var(--success-soft)', color: 'var(--success-strong)' }}
          >
            <FileSpreadsheet size={16} />
            {downloading ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel template'}
          </button>
        </>
      ),
    },
    {
      icon: <ShieldCheck size={36} className="text-[var(--accent-strong)]" />,
      iconBg: 'bg-[var(--accent-soft)]',
      title: 'สำรองและกู้คืนข้อมูล',
      body: (
        <>
          <p className="text-sm text-[var(--text-soft)]">
            แอปจะสำรองข้อมูลอัตโนมัติทุกครั้งที่เปิด — ถ้าเผลอลบหรือข้อมูลผิด
            สามารถกู้คืนได้
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--text-soft)]">
            <li className="flex items-start gap-2">
              <Download size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent-strong)]" />
              <span>
                <span className="font-semibold text-[var(--text)]">สำรองด้วยตนเอง:</span> ไปที่
                &quot;ตั้งค่า&quot; → &quot;สำรองข้อมูล&quot;
                (ดาวน์โหลดไฟล์ JSON)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent-strong)]" />
              <span>
                <span className="font-semibold text-[var(--text)]">กู้คืน:</span> ไปที่
                &quot;ตั้งค่า&quot; → &quot;กู้คืนจากการสำรองอัตโนมัติ&quot;
                — เลือกวันที่ต้องการ
              </span>
            </li>
            <li className="flex items-start gap-2">
              <HardDrive size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent-strong)]" />
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
      <div className="modal-content relative w-full max-w-2xl rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <button
          type="button"
          onClick={close}
          title="ข้าม"
          className="btn btn-ghost btn-icon absolute right-3 top-3"
          aria-label="ปิด"
        >
          <X size={16} />
        </button>

        <div className="p-8 pb-6">
          {/* Hero icon */}
          <div className="mb-5 flex justify-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] ${current.iconBg}`}>
              {current.icon}
            </div>
          </div>

          {/* Title */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-[var(--text)]">{current.title}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              ขั้นตอนที่ {step + 1} จาก {steps.length}
            </p>
          </div>

          {/* Body */}
          <div className="mb-6">{current.body}</div>

          {/* Progress dots */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step ? 'w-8 bg-[var(--primary)]' : 'w-2 bg-[var(--line-strong)]'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={close}
              className="btn btn-ghost"
            >
              ข้าม
            </button>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="btn btn-secondary"
                >
                  <ChevronLeft size={14} />
                  ย้อนกลับ
                </button>
              )}
              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="btn btn-primary"
                >
                  ต่อไป
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="btn btn-primary"
                  style={{ background: 'var(--success)' }}
                >
                  เริ่มใช้งาน
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
