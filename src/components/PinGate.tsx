'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, GraduationCap, Lock, ShieldCheck } from 'lucide-react'

const PIN_HASH_KEY = 'pinHash'
const PIN_ENABLED_KEY = 'pinEnabled'
const SESSION_UNLOCK_KEY = 'pinUnlocked'
const FAILED_COUNT_KEY = 'pinFailedCount'
const LOCKOUT_UNTIL_KEY = 'pinLockoutUntil'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 1000 // 30 seconds

// PBKDF2 parameters — ใช้ SHA-256 + 100k iterations (OWASP ~2023 ขั้นต่ำ)
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const PBKDF2_KEY_BITS = 256
const SALT_BYTES = 16

interface StoredPinRecord {
  // algo: 'pbkdf2' = ฟอร์แมตใหม่ (salted) | 'sha256' = ฟอร์แมตเก่า (จาก localStorage รุ่นก่อน)
  algo: 'pbkdf2' | 'sha256'
  salt?: string // hex; required when algo='pbkdf2'
  hash: string // hex
  iter?: number // PBKDF2 iterations; required when algo='pbkdf2'
}

// --- helpers ---

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return out
}

/**
 * Constant-time equality check บน hex string — กัน timing attack เล็กน้อย
 * (ในบริบท localStorage นี้ความเสี่ยงน้อย แต่ทำให้ปลอดภัยขึ้นโดยไม่มี cost)
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Legacy SHA-256 hash (ไม่ salted) — ใช้สำหรับตรวจสอบรูปแบบเก่าตอน migration เท่านั้น
 * **ห้ามใช้กับ PIN ใหม่** — ปลอดภัยน้อย, rainbow table ทำได้
 */
async function legacySha256Hash(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hash))
}

/**
 * PBKDF2 derive — return hex hash
 */
async function pbkdf2DeriveHex(
  pin: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // cast: TS lib แยก ArrayBuffer/SharedArrayBuffer แต่ Web Crypto รับ BufferSource ทั่วไป
      salt: salt as BufferSource,
      iterations,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    PBKDF2_KEY_BITS
  )
  return bytesToHex(new Uint8Array(bits))
}

/**
 * สร้าง record ใหม่ของ PIN ด้วย PBKDF2 + random salt
 */
async function buildPbkdf2Record(pin: string): Promise<StoredPinRecord> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  const hash = await pbkdf2DeriveHex(pin, salt, PBKDF2_ITERATIONS)
  return {
    algo: 'pbkdf2',
    salt: bytesToHex(salt),
    hash,
    iter: PBKDF2_ITERATIONS,
  }
}

/**
 * อ่าน stored record จาก localStorage — รองรับทั้งฟอร์แมตใหม่ (JSON) และเก่า (raw hex SHA-256)
 * Backward compat: PIN เก่าที่เก็บเป็น raw SHA-256 hex (64 chars) จะถูก parse เป็น legacy record
 */
function readStoredRecord(): StoredPinRecord | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(PIN_HASH_KEY)
  if (!raw) return null

  // ฟอร์แมตใหม่: JSON
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as StoredPinRecord
      if (parsed && typeof parsed.hash === 'string' && (parsed.algo === 'pbkdf2' || parsed.algo === 'sha256')) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }

  // ฟอร์แมตเก่า: raw hex SHA-256 (64 chars)
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return { algo: 'sha256', hash: raw.toLowerCase() }
  }

  return null
}

function writeStoredRecord(record: StoredPinRecord): void {
  localStorage.setItem(PIN_HASH_KEY, JSON.stringify(record))
}

/**
 * Hash PIN เพื่อเปรียบเทียบกับค่าที่เก็บไว้
 *
 * Backward-compat: ฟังก์ชันนี้คงสัญญา API เดิมที่ caller สามารถใช้ pattern
 *   `(await hashPin(pin)) === getStoredPinHash()` เพื่อตรวจสอบความถูกต้อง
 *
 * วิธีการ:
 * - ถ้ามี stored record แบบ PBKDF2 → derive hash โดยใช้ salt+iter ของ record นั้น
 *   (เพื่อให้ผลเทียบกับ getStoredPinHash() ตรงกัน)
 * - ถ้ามี stored record แบบเก่า (SHA-256) หรือไม่มีเลย → fallback เป็น legacy SHA-256
 *   (ครอบคลุมเคส migration และเคสตั้ง PIN ครั้งแรก)
 *
 * หมายเหตุ: caller ใหม่ควรใช้ `verifyPin(pin)` ซึ่ง robust กว่า (รองรับ migration auto)
 */
export async function hashPin(pin: string): Promise<string> {
  const record = typeof window !== 'undefined' ? readStoredRecord() : null
  if (record && record.algo === 'pbkdf2' && record.salt && record.iter) {
    const salt = hexToBytes(record.salt)
    return pbkdf2DeriveHex(pin, salt, record.iter)
  }
  // ไม่มี record หรือเป็น legacy SHA-256 → ใช้ SHA-256
  return legacySha256Hash(pin)
}

/**
 * ตรวจสอบ PIN เทียบกับที่เก็บไว้ — รองรับทั้งฟอร์แมตใหม่ (PBKDF2) และเก่า (SHA-256)
 * return:
 *   - ok: PIN ถูกหรือไม่
 *   - needsRehash: ถ้า PIN ถูก แต่อยู่ในฟอร์แมตเก่า → caller ควรเรียก setStoredPin เพื่อ migrate
 */
export async function verifyPin(pin: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  const record = readStoredRecord()
  if (!record) return { ok: false, needsRehash: false }

  if (record.algo === 'pbkdf2' && record.salt && record.iter) {
    const salt = hexToBytes(record.salt)
    const candidate = await pbkdf2DeriveHex(pin, salt, record.iter)
    return { ok: constantTimeEqual(candidate, record.hash), needsRehash: false }
  }

  // legacy SHA-256 — ตรวจสอบเพื่อให้ครูเข้าระบบได้ครั้งแรกหลังอัพเดท
  // แล้ว caller จะ re-hash ด้วย PBKDF2 อัตโนมัติ (graceful migration)
  if (record.algo === 'sha256') {
    const candidate = await legacySha256Hash(pin)
    const ok = constantTimeEqual(candidate, record.hash.toLowerCase())
    return { ok, needsRehash: ok }
  }

  return { ok: false, needsRehash: false }
}

export function isPinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PIN_ENABLED_KEY) === '1'
}

/**
 * Return hash hex string ที่เก็บไว้ใน localStorage (โดยไม่รวม salt/metadata)
 *
 * Backward-compat: ฟังก์ชันเดิม return raw string จาก localStorage ตรงๆ ซึ่งเป็น SHA-256 hex
 *   เพื่อให้ caller เปรียบเทียบ `hashPin(pin) === getStoredPinHash()`
 *
 * เวอร์ชันใหม่: extract เฉพาะ `hash` field จาก JSON record และคู่กับ `hashPin()` ใหม่
 *   ซึ่ง derive PBKDF2 ด้วย salt ของ record นั้น → equality check จะ work เหมือนเดิม
 *
 * caller ใหม่ควรใช้ `verifyPin` ซึ่ง robust กว่า (handles migration, constant-time compare)
 */
export function getStoredPinHash(): string | null {
  const record = readStoredRecord()
  return record ? record.hash : null
}

/**
 * ตั้งค่า PIN ใหม่ — ใช้ PBKDF2 + random salt + 100k iterations
 */
export async function setStoredPin(pin: string, enabled = true): Promise<void> {
  const record = await buildPbkdf2Record(pin)
  writeStoredRecord(record)
  localStorage.setItem(PIN_ENABLED_KEY, enabled ? '1' : '0')
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
  const [showPin, setShowPin] = useState(false)
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

      const storedRaw = localStorage.getItem(PIN_HASH_KEY)
      if (!storedRaw) {
        // ไม่มี hash แต่ flag เปิด — กรณีผิดปกติ ปลดล็อกแล้ว reset flag
        disablePin()
        setUnlocked(true)
        return
      }

      const { ok, needsRehash } = await verifyPin(pinInput)
      if (ok) {
        // graceful migration: ถ้าเป็น legacy SHA-256 → re-hash ด้วย PBKDF2
        // ทำหลัง verify สำเร็จเท่านั้น เพื่อไม่ล็อกครูออกจากระบบ
        if (needsRehash) {
          try {
            await setStoredPin(pinInput, true)
          } catch (err) {
            // ถ้า migrate ล้มเหลว ก็ยังให้ครูเข้าระบบได้ — ลองใหม่ครั้งหน้า
            console.warn('[PinGate] PIN migration failed:', err)
          }
        }
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
              type={showPin ? 'text' : 'password'}
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
              className="w-full rounded-xl border border-[var(--line)] bg-white px-10 py-3 text-center text-xl font-bold tracking-[0.4em] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:border-[var(--primary)] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              disabled={isLockedOut}
              tabIndex={-1}
              aria-label={showPin ? 'ซ่อน PIN' : 'แสดง PIN'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
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

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--muted)]">
          ลืม PIN? กรุณาติดต่อผู้ดูแลระบบของโรงเรียนเพื่อรีเซ็ต
        </p>
      </div>
    </div>
  )
}
