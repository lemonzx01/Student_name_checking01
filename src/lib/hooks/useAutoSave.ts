'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * สถานะของระบบบันทึกอัตโนมัติ:
 * - idle:   ยังไม่มีการแก้ไข (หรือเพิ่งโหลดข้อมูลมา ยังไม่ได้แตะอะไร)
 * - saving: กำลังบันทึกลงฐานข้อมูล
 * - saved:  บันทึกสำเร็จล่าสุด
 * - error:  เกิดข้อผิดพลาดในการบันทึก — ครูควรเห็นเพื่อรู้ว่าข้อมูลยังไม่ปลอดภัย
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutoSaveOptions {
  /** ระยะเวลาที่รอหลังจากหยุดพิมพ์ก่อนจะสั่งบันทึก (มิลลิวินาที) — default 800ms */
  debounceMs?: number
  /** ปิด/เปิดการบันทึกอัตโนมัติ เช่น เมื่อยังไม่ได้เลือกห้องเรียน */
  enabled?: boolean
  /** callback หลังบันทึกสำเร็จ (เช่น รีเฟรชข้อมูลรอง เช่น markedDates) */
  onSaved?: () => void
  /** callback เมื่อเกิดข้อผิดพลาด */
  onError?: (error: unknown) => void
}

export interface UseAutoSaveReturn {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  /** สั่งบันทึกทันที โดยไม่รอ debounce (เช่น ก่อนปิดแอป) */
  saveNow: () => Promise<void>
  /** มีข้อมูลที่รอบันทึกอยู่หรือไม่ (กำลัง debounce หรือกำลัง save) */
  hasPendingChanges: boolean
}

/**
 * Hook สำหรับบันทึกข้อมูลอัตโนมัติแบบ debounce
 *
 * การทำงาน:
 * 1. เมื่อ `value` เปลี่ยน จะตั้งเวลารอ (debounce) ตาม debounceMs
 * 2. ถ้า value เปลี่ยนอีกครั้งก่อนครบเวลา → ยกเลิกรอบเก่า ตั้งใหม่
 * 3. พอครบเวลา → เรียก saveFn(value)
 * 4. กระโดดข้าม save ในรอบแรก (ตอนที่ข้อมูลถูกโหลดมาจาก DB) — ป้องกัน "บันทึกซ้ำ" ข้อมูลที่เพิ่งโหลด
 *
 * ข้อควรระวัง:
 * - saveFn ควร stable (ใช้ useCallback) ไม่งั้นจะ trigger ใหม่ทุก render
 * - value ควรเป็นตัวอ้างอิงใหม่เมื่อมีการแก้ไขจริงเท่านั้น (เช่น setState ด้วย object ใหม่)
 */
export function useAutoSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { debounceMs = 800, enabled = true, onSaved, onError } = options

  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)

  // ref เก็บสถานะที่ไม่ trigger re-render
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRunRef = useRef(true)
  const prevEnabledRef = useRef(enabled)
  const latestValueRef = useRef<T>(value)
  const saveFnRef = useRef(saveFn)
  const onSavedRef = useRef(onSaved)
  const onErrorRef = useRef(onError)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  // saveFn ที่จะใช้ตอน flush — capture ตอน timer ถูกสร้างขึ้น
  // แก้บัค: ถ้า saveFn เปลี่ยน closure (เช่น ครูเปลี่ยน date) ระหว่าง debounce window
  //       เดิมจะใช้ saveFn ใหม่ → บันทึกข้อมูลเก่าไปลงบริบทใหม่
  // ตอนนี้: capture saveFn ตอนผู้ใช้แก้ไข แล้ว flush ใช้ saveFn ที่ผูกกับการแก้ไขนั้น
  const pendingSaveFnRef = useRef<((value: T) => Promise<void>) | null>(null)

  // อัปเดต ref ของ callback ให้ล่าสุดเสมอ (เพื่อไม่ต้อง restart hook)
  useEffect(() => {
    saveFnRef.current = saveFn
    onSavedRef.current = onSaved
    onErrorRef.current = onError
  })

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  // ฟังก์ชันบันทึกจริง — ใช้ทั้งใน debounce และใน saveNow
  // ใช้ loop แทน recursion เพื่อกัน stack overflow ตอนพิมพ์เร็ว ๆ + network ช้า
  const performSave = useCallback(async () => {
    // ถ้ากำลัง save อยู่แล้ว ให้ตั้ง flag ว่าต้อง save อีกรอบ (ข้อมูลใหม่กว่า)
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    isSavingRef.current = true
    setStatus('saving')
    setHasPendingChanges(true)

    try {
      // วน save จนกว่าจะไม่มีข้อมูลใหม่เข้ามาระหว่าง save
      // (เคสพิมพ์เร็ว: pendingSaveRef ถูก set ระหว่าง await)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const valueToSave = latestValueRef.current
        pendingSaveRef.current = false
        // iter แรก: ใช้ saveFn ที่ capture ตอนสร้าง timer (closure ตอนแก้ไข)
        // iter ถัดไป: ใช้ saveFn ปัจจุบัน เพราะถ้ามีการแก้ไขเพิ่ม
        //              ผู้ใช้อยู่ในบริบทปัจจุบันแล้ว
        const fn = pendingSaveFnRef.current ?? saveFnRef.current
        // เคลียร์ทันทีหลังใช้งาน — กัน iter 2 ใช้ saveFn เก่ากับ value ใหม่
        pendingSaveFnRef.current = null
        await fn(valueToSave)

        // ถ้าระหว่าง save มีการแก้ไขเพิ่ม → loop ต่อ
        if (!pendingSaveRef.current) break
      }

      setStatus('saved')
      setLastSavedAt(new Date())
      setHasPendingChanges(false)
      onSavedRef.current?.()
    } catch (error) {
      console.error('[useAutoSave] save failed:', error)
      setStatus('error')
      onErrorRef.current?.(error)
    } finally {
      isSavingRef.current = false
      pendingSaveRef.current = false
      pendingSaveFnRef.current = null
    }
  }, [])

  // Effect หลัก: ฟัง value + เริ่ม debounce
  useEffect(() => {
    // ตรวจจับการเปลี่ยนสถานะ disabled → enabled (เช่น เปลี่ยนห้อง/วันที่แล้วข้อมูลโหลดเสร็จ)
    // ถ้าเพิ่งเปิดใช้งาน ให้ถือว่า value ปัจจุบันคือ "ข้อมูลเริ่มต้น" ที่เพิ่งโหลดมา — ไม่ต้อง save ซ้ำ
    const justEnabled = !prevEnabledRef.current && enabled
    prevEnabledRef.current = enabled

    // รอบแรกตอน mount: ข้อมูลเพิ่งโหลดจาก DB ไม่ต้อง save
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      return
    }

    // disable อยู่ หรือเพิ่งจะเปลี่ยนมา enable (ข้อมูลใหม่เพิ่งเข้ามา) → ไม่ save
    if (!enabled || justEnabled) {
      return
    }

    // ยกเลิก timer เก่า (ถ้ามี) — กรณีผู้ใช้พิมพ์ต่อเนื่อง
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setHasPendingChanges(true)
    // รีเซ็ต error ถ้าผู้ใช้แก้ไขต่อ (เพื่อให้ลองใหม่)
    setStatus((prev) => (prev === 'error' ? 'idle' : prev))

    // capture saveFn ปัจจุบัน (ที่ผูกกับ closure ของ value ตอนนี้)
    // ใช้ตอน flush เพื่อกัน closure mismatch — ถ้าครูเปลี่ยน date ก่อน timer ฟอง
    // saveFn จะเปลี่ยน identity แต่ pendingSaveFnRef ยังเป็นตัวเก่า → ข้อมูลลงบริบทเดิม
    // เจตนา: saveFn อยู่ใน deps ของ useAutoSave caller ไม่ใช่ deps ของ effect นี้
    //        ดังนั้นจะ capture เฉพาะตอน "ผู้ใช้แก้ไข" (value/enabled เปลี่ยน) เท่านั้น
    pendingSaveFnRef.current = saveFn

    timerRef.current = setTimeout(() => {
      performSave()
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
    // หมายเหตุ: ตั้งใจไม่ใส่ saveFn ใน deps — เราอยาก capture saveFn ที่ผูกกับ "การแก้ไข"
    //          ไม่ใช่ saveFn ใหม่ที่เกิดจาก context change (เช่น เปลี่ยน date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, debounceMs, performSave])

  // เมื่อเปลี่ยนเป็น disabled: ถ้ามีคาบรอบันทึก → flush ก่อน (กันข้อมูลหาย)
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        // flush เฉพาะกรณี "ยังไม่ได้เริ่ม save" — ถ้ากำลัง save อยู่แล้ว
        // performSave มันจะดูแลให้ (loop ภายใน + saveFn ที่ capture ไว้)
        // ถ้าเรียกซ้ำตอน in-flight จะตั้ง pendingSaveRef → loop iter 2 ใช้ saveFn ปัจจุบัน → ผิดบริบท
        if (hasPendingChanges && !isSavingRef.current) {
          performSave().catch((err) => console.error('[useAutoSave] flush failed:', err))
        }
      }
      setHasPendingChanges(false)
      setStatus((prev) => (prev === 'saving' ? prev : 'idle'))
    }
  }, [enabled, hasPendingChanges, performSave])

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!enabled) return
    await performSave()
  }, [enabled, performSave])

  return {
    status,
    lastSavedAt,
    saveNow,
    hasPendingChanges,
  }
}
