'use client'

import { useEffect, useState } from 'react'
import { getPhotoDataUrl } from '@/lib/client-data'

/**
 * In-memory cache สำหรับ data URL ของรูป — กัน fetch ซ้ำๆ ทุก render
 * Key: photo_path (filename หรือ string ที่เก็บใน DB)
 */
const photoCache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

/**
 * Hook สำหรับโหลด data URL ของรูปนักเรียน
 * - ใช้ cache ใน-memory: ขอครั้งเดียวต่อ session
 * - คืน null ระหว่างโหลด หรือถ้าไม่มีรูป
 */
export function usePhotoUrl(photoPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!photoPath) return null
    return photoCache.get(photoPath) ?? null
  })

  useEffect(() => {
    if (!photoPath) {
      setUrl(null)
      return
    }

    // ใช้ cache ถ้ามี
    const cached = photoCache.get(photoPath)
    if (cached !== undefined) {
      setUrl(cached)
      return
    }

    let cancelled = false

    // ถ้ามี promise pending สำหรับ key เดียวกัน — รอเลย ไม่ต้องยิงซ้ำ
    let promise = inflight.get(photoPath)
    if (!promise) {
      promise = getPhotoDataUrl(photoPath).then((result) => {
        photoCache.set(photoPath, result)
        inflight.delete(photoPath)
        return result
      })
      inflight.set(photoPath, promise)
    }

    promise.then((result) => {
      if (!cancelled) setUrl(result)
    })

    return () => {
      cancelled = true
    }
  }, [photoPath])

  return url
}

/** Invalidate cache สำหรับ key หนึ่ง — ใช้หลัง save/delete photo */
export function invalidatePhotoCache(photoPath: string | null | undefined) {
  if (!photoPath) return
  photoCache.delete(photoPath)
  inflight.delete(photoPath)
}

/** Invalidate ทั้งหมด (ใช้น้อย — เช่น หลัง restore backup) */
export function clearPhotoCache() {
  photoCache.clear()
  inflight.clear()
}
