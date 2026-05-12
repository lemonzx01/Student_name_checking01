'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { GraduationCap, Lock, ShieldCheck } from 'lucide-react'

const PIN_HASH_KEY = 'pinHash'
const PIN_ENABLED_KEY = 'pinEnabled'
const SESSION_UNLOCK_KEY = 'pinUnlocked'
const FAILED_COUNT_KEY = 'pinFailedCount'
const LOCKOUT_UNTIL_KEY = 'pinLockoutUntil'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 1000 // 30 seconds

export async function hashPin(pin: string): Promise<string> {
  // SHA-256 ของ PIN ผ่าน Web Crypto API
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(hash))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isPinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PIN_ENABLED_KEY) === '1'
}

export function getStoredPinHash(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PIN_HASH_KEY)
}

export function setStoredPin(pin: string, enabled = true): Promise<void> {
  return hashPin(pin).then((hash) => {
    localStorage.setItem(PIN_HASH_KEY, hash)
    localStorage.setItem(PIN_ENABLED_KEY, enabled ? '1' : '0')
  })
}

export function disablePin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
  localStorage.setItem(PIN_ENABLED_KEY, '0')
  sessionStorage.removeItem(SESSION_UNLOCK_KEY)
}

export function markSessionUnlocked(): void {
  sessionStorage.setItem(SESSION_UNLOCK_KEY, '1')
}

function isSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_UNLOCK_KEY) === '1'
}

/**
 * PinGate ครอบ app ทั้งหมด — ถ้าผู้ใช้เปิด PIN ไว้ จะบล็อก UI จนกว่าจะกรอก PIN ถูก
 * - กรอกผิด 5 ครั้ง → ล็อก 30 วินาที
 * - ผ่านแล้ว session unlocked จนปิดแอป
 */
export default function PinGate({ children }: { children: ReactNode }) {
  // ใช้ undefined = ยังไม่ตรวจสอบ; true = ปลดล็อกแล้ว/ไม่ต้องใช้; false = ต้องกรอก PIN
  const [unlocked, setUnlocked] = useState<boolean | undefined>(undefined)
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState('')
  const [lockoutUntil, setLockoutUntil] = useState<number>(0)
  const [now, setNow] = useState(Date.now())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // ตรวจสอบสถานะตอน mount
    if (!isPinEnabled()) {
      setUnlocked(true)
      return
    }
    if (isSessionUnlocked()) {
      setUnlocked(true)
      return
    }
    setUnlocked(false)

    const lockUntil = Number(localStorage.getItem(LOCKOUT_UNTIL_KEY) || 0)
    if (lockUntil > Date.now()) {
      setLockoutUntil(lockUntil)
    }
  }, [])

  useEffect(() => {
    // อัปเดต now ทุกวินาทีถ้ายังล็อกอยู่ — สำหรับนับถอยหลัง
    if (lockoutUntil > Date.now()) {
      const t = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(t)
    }
  }, [lockoutUntil])

  useEffect(() => {
    if (unlocked === false && lockoutUntil <= now) {
      // auto-focus เมื่อหน้าจอ unlock ready
      inputRef.current?.focus()
    }
  }, [unlocked, lockoutUntil, now])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (lockoutUntil > Date.now()) return

      const storedHash = getStoredPinHash()
      if (!storedHash) {
        // ไม่มี hash แต่ flag เปิด — กรณีผิดปกติ ปลดล็อกแล้ว reset flag
        disablePin()
        setUnlocked(true)
        return
      }

      const inputHash = await hashPin(pinInput)
      if (inputHash === storedHash) {
        markSessionUnlocked()
        localStorage.removeItem(FAILED_COUNT_KEY)
        localStorage.removeItem(LOCKOUT_UNTIL_KEY)
        setUnlocked(true)
        return
      }

      const failed = Number(localStorage.getItem(FAILED_COUNT_KEY) || 0) + 1
      localStorage.setItem(FAILED_COUNT_KEY, String(failed))
      setPinInput('')
      if (failed >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS
        localStorage.setItem(LOCKOUT_UNTIL_KEY, String(until))
        setLockoutUntil(until)
        localStorage.setItem(FAILED_COUNT_KEY, '0')
        setError(`กรอกผิด ${MAX_ATTEMPTS} ครั้ง — ล็อก 30 วินาที`)
      } else {
        setError(`PIN ไม่ถูกต้อง (${failed}/${MAX_ATTEMPTS})`)
      }
    },
    [pinInput, lockoutUntil]
  )

  if (unlocked === undefined) {
    return null // กัน flicker ระหว่างเช็ค
  }

  if (unlocked) {
    return <>{children}</>
  }

  const remainingSec = Math.max(0, Math.ceil((lockoutUntil - now) / 1000))
  const isLockedOut = lockoutUntil > now

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="modal-content w-full max-w-sm rounded-[var(--radius-lg)] bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">ระบบนักเรียน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">กรอก PIN เพื่อเข้าใช้งาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={6}
              value={pinInput}
              disabled={isLockedOut}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                setPinInput(v)
                setError('')
              }}
              placeholder="พิมพ์ PIN 4-6 หลัก"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-10 py-3 text-center text-xl font-bold tracking-[0.4em] outline-none transition focus:border-[var(--primary)] disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {isLockedOut && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-700">
              รอ {remainingSec} วินาที ก่อนลองใหม่
            </p>
          )}

          <button
            type="submit"
            disabled={isLockedOut || pinInput.length < 4}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck size={16} />
            ปลดล็อก
          </button>
        </form>

        <details className="mt-5 cursor-pointer text-xs text-[var(--muted)]">
          <summary className="select-none font-medium hover:text-slate-700">ลืม PIN?</summary>
          <p className="mt-2 leading-relaxed text-[11px]">
            ระบบเก็บ PIN ในเครื่องนี้เท่านั้น — ลืมแล้วต้อง:
            <br />
            1. เปิด DevTools (F12 หรือ Ctrl+Shift+I)
            <br />
            2. ไปที่แท็บ Application → Local Storage
            <br />
            3. ลบ key &quot;pinHash&quot; และ &quot;pinEnabled&quot;
            <br />
            4. โหลดหน้าใหม่ — จะปลดล็อกอัตโนมัติ
          </p>
        </details>
      </div>
    </div>
  )
}
