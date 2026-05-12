'use client'

import { useEffect, useState, useCallback } from 'react'
import { DEFAULT_SUBJECTS, type SubjectDef } from '@/types/index'

const STORAGE_KEY = 'customSubjects'

/** เซ็ตของรหัสวิชา default — ใช้ display ตัว lock icon ถ้าจะ */
const DEFAULT_CODES = new Set(DEFAULT_SUBJECTS.map((s) => s.code))

/**
 * วิชาที่มี flag บอกว่าเป็น default (รหัสยังตรงกับ DEFAULT) หรือ custom
 * ผู้ใช้สามารถแก้ทุกอย่างได้รวมถึงรหัส แต่ flag นี้ใช้แสดง UI
 */
export interface SubjectWithMeta extends SubjectDef {
  isDefault: boolean
}

/**
 * Storage format ใหม่ (เรียบง่าย):
 * { subjects: [{code, name, color}, ...] }
 *
 * ถ้า storage ว่าง → ใช้ DEFAULT_SUBJECTS
 * ถ้ามี → ใช้ list นี้ตรง ๆ
 */
interface StoredData {
  subjects?: SubjectDef[]
  // legacy format support
  overrides?: Record<string, Partial<Pick<SubjectDef, 'name' | 'color'>>>
  custom?: SubjectDef[]
}

function attachMeta(s: SubjectDef): SubjectWithMeta {
  return { ...s, isDefault: DEFAULT_CODES.has(s.code) }
}

function loadFromStorage(): SubjectWithMeta[] {
  if (typeof window === 'undefined') return DEFAULT_SUBJECTS.map(attachMeta)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SUBJECTS.map(attachMeta)

    const parsed = JSON.parse(raw)

    // ─── Format ใหม่: { subjects: [...] } ───
    if (parsed && Array.isArray(parsed.subjects)) {
      return (parsed.subjects as SubjectDef[])
        .filter((s) => s.code && s.name)
        .map(attachMeta)
    }

    // ─── Legacy format A: array ตรง ๆ (เก่าสุด) ───
    if (Array.isArray(parsed)) {
      const map = new Map<string, SubjectDef>()
      for (const def of DEFAULT_SUBJECTS) {
        map.set(def.code, def)
      }
      for (const item of parsed as Partial<SubjectDef>[]) {
        if (!item.code) continue
        const existing = map.get(item.code)
        map.set(item.code, {
          code: item.code,
          name: item.name || existing?.name || item.code,
          color: item.color || existing?.color || '#64748B',
        })
      }
      return Array.from(map.values()).map(attachMeta)
    }

    // ─── Legacy format B: { overrides, custom } ───
    if (parsed && (parsed.overrides || parsed.custom)) {
      const data = parsed as StoredData
      const overrides = data.overrides || {}
      const customs = data.custom || []
      const result: SubjectDef[] = DEFAULT_SUBJECTS.map((def) => {
        const o = overrides[def.code]
        return {
          code: def.code,
          name: o?.name || def.name,
          color: o?.color || def.color,
        }
      })
      for (const c of customs) {
        if (!c.code || result.some((r) => r.code === c.code)) continue
        result.push({ code: c.code, name: c.name || c.code, color: c.color || '#64748B' })
      }
      return result.map(attachMeta)
    }

    return DEFAULT_SUBJECTS.map(attachMeta)
  } catch {
    return DEFAULT_SUBJECTS.map(attachMeta)
  }
}

function saveToStorage(subjects: SubjectWithMeta[]): void {
  if (typeof window === 'undefined') return
  try {
    const data: StoredData = {
      subjects: subjects.map((s) => ({ code: s.code, name: s.name, color: s.color })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('subjects-changed'))
  } catch (err) {
    console.error('[useSubjects] save failed:', err)
  }
}

/** call API to migrate subject_code in grades + schedules */
async function migrateSubjectCodeInDB(
  from: string,
  to: string,
  newName?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/subjects/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, newName }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `อัปเดต DB ไม่สำเร็จ (${res.status})` }
    }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'เชื่อมต่อ API ไม่ได้' }
  }
}

/**
 * Hook จัดการรายการวิชา
 * - ครูแก้ชื่อ/รหัส/สี ได้ทุกวิชา (รวม TH/MA/EN ฯลฯ ที่เป็น default)
 * - ตอนแก้รหัส → ระบบจะ migrate รหัสใน DB (grades + schedules) ให้อัตโนมัติ
 *   เพื่อกันคะแนนเก่าหาย
 * - เพิ่มวิชาใหม่ + ลบได้
 */
export function useSubjects() {
  const [subjects, setSubjects] = useState<SubjectWithMeta[]>(() =>
    DEFAULT_SUBJECTS.map(attachMeta)
  )

  useEffect(() => {
    setSubjects(loadFromStorage())

    const customHandler = () => setSubjects(loadFromStorage())
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSubjects(loadFromStorage())
    }

    window.addEventListener('subjects-changed', customHandler)
    window.addEventListener('storage', storageHandler)

    return () => {
      window.removeEventListener('subjects-changed', customHandler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  /**
   * อัปเดต name/color ของวิชาที่มีอยู่ — sync กับ schedules ในฐานข้อมูลเงียบ ๆ
   */
  const updateSubject = useCallback(
    (code: string, patch: Partial<Pick<SubjectDef, 'name' | 'color'>>) => {
      setSubjects((current) => {
        const next = current.map((s) => (s.code === code ? { ...s, ...patch } : s))
        saveToStorage(next)
        return next
      })

      // ถ้าแก้ชื่อ → sync กับ schedules ด้วย (ตารางสอนจะแสดงชื่อใหม่)
      if (patch.name) {
        migrateSubjectCodeInDB(code, code, patch.name).catch((err) =>
          console.warn('[useSubjects] sync schedule name failed:', err)
        )
      }
    },
    []
  )

  /**
   * เปลี่ยนรหัสวิชา (รหัสใดก็ได้ รวมถึง default)
   * — ก่อน: เรียก API ให้ migrate รหัสในฐานข้อมูล
   * — หลัง: อัปเดต localStorage
   * คืน { ok: boolean, error?: string }
   */
  const renameCode = useCallback(
    async (
      oldCode: string,
      newCode: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = newCode.trim()
      if (!trimmed) return { ok: false, error: 'รหัสว่างไม่ได้' }
      if (trimmed === oldCode) return { ok: true }

      // กันรหัสซ้ำ
      if (subjects.some((s) => s.code === trimmed)) {
        return { ok: false, error: `รหัส "${trimmed}" มีอยู่แล้ว` }
      }

      // 1) อัปเดต DB ก่อน (migrate grades + schedules)
      const dbResult = await migrateSubjectCodeInDB(oldCode, trimmed)
      if (!dbResult.ok) return dbResult

      // 2) อัปเดต local list
      setSubjects((current) => {
        const next = current.map((s) =>
          s.code === oldCode ? { ...s, code: trimmed, isDefault: DEFAULT_CODES.has(trimmed) } : s
        )
        saveToStorage(next)
        return next
      })

      return { ok: true }
    },
    [subjects]
  )

  /** เพิ่มวิชาใหม่ */
  const addSubject = useCallback((subject: SubjectDef): boolean => {
    if (!subject.code || !subject.name) return false
    let success = false
    setSubjects((current) => {
      if (current.some((s) => s.code === subject.code)) return current
      const next: SubjectWithMeta[] = [
        ...current,
        {
          code: subject.code,
          name: subject.name,
          color: subject.color || '#64748B',
          isDefault: DEFAULT_CODES.has(subject.code),
        },
      ]
      saveToStorage(next)
      success = true
      return next
    })
    return success
  }, [])

  /** ลบวิชา (ลบได้ทุกวิชา รวม default — แต่ default มี confirm 2 ขั้นในการ UI) */
  const removeSubject = useCallback((code: string): boolean => {
    let success = false
    setSubjects((current) => {
      const next = current.filter((s) => s.code !== code)
      if (next.length === current.length) return current
      saveToStorage(next)
      success = true
      return next
    })
    return success
  }, [])

  /** รีเซ็ตเป็นค่าเริ่มต้นทั้งหมด — ลบทุกอย่าง รวม custom */
  const resetToDefaults = useCallback(() => {
    const defaults = DEFAULT_SUBJECTS.map(attachMeta)
    saveToStorage(defaults)
    setSubjects(defaults)
  }, [])

  return {
    subjects,
    updateSubject,
    renameCode,
    addSubject,
    removeSubject,
    resetToDefaults,
  }
}
