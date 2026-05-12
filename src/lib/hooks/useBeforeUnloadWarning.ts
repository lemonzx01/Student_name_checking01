'use client'

import { useEffect } from 'react'

/**
 * เตือนก่อนปิดหน้า/refresh เมื่อมีข้อมูลที่ยังไม่ได้บันทึก
 * ใช้คู่กับ useAutoSave().hasPendingChanges
 */
export function useBeforeUnloadWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [enabled])
}
