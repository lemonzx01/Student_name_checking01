'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, X } from 'lucide-react'
import { Student } from '@/types'
import { searchStudentsGlobal } from '@/lib/client-data'

interface Props {
  /** สไตล์เมื่ออยู่บน sidebar (พื้นสีเข้ม) vs หน้าแรก (พื้นสีอ่อน) */
  theme?: 'dark' | 'light'
  placeholder?: string
}

export default function GlobalSearch({ theme = 'light', placeholder = 'ค้นหานักเรียน (ชื่อ/รหัส)' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // ปิด dropdown เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // debounced search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const list = await searchStudentsGlobal(q)
        setResults(list)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const isDark = theme === 'dark'
  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={wrapRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
          isDark
            ? 'border-white/10 bg-white/5 focus-within:border-white/20 focus-within:bg-white/10'
            : 'border-[var(--line)] bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-blue-100'
        }`}
      >
        <Search size={18} className={isDark ? 'text-slate-400' : 'text-slate-400'} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none ${
            isDark ? 'text-white placeholder:text-slate-400' : 'text-slate-900 placeholder:text-slate-400'
          }`}
          style={{ minHeight: 0 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            title="ล้างคำค้นหา"
            className={`btn-compact rounded-md p-1 transition ${
              isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[var(--muted)]">
              <Loader2 size={16} className="animate-spin" />
              กำลังค้นหา...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              ไม่พบนักเรียนที่ตรงกัน
            </div>
          ) : (
            <ul className="py-1">
              {results.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/students?classroom=${s.classroom_id}&student=${s.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {[s.title, s.first_name, s.last_name].filter(Boolean).join(' ')}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        เลขที่ {s.student_number || s.student_id}
                        {s.classroom_name ? ` • ${s.classroom_name}` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
