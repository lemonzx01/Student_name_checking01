'use client'

import { usePhotoUrl } from '@/lib/hooks/usePhotoUrl'

interface Props {
  photoPath?: string | null
  /** ใช้เป็น fallback initial (ตัวอักษรแรกของชื่อ) */
  name?: string | null
  /** ขนาดเป็น px */
  size?: number
  /** Tailwind class เสริม (เช่น border) */
  className?: string
}

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * อวาตาร์นักเรียน — แสดงรูปถ้ามี photo_path, ไม่งั้น fallback ตัวอักษรแรกของชื่อ
 * สีพื้นหลัง deterministic จาก hash ของชื่อ — ทำให้สีไม่เปลี่ยนทุก render
 */
export default function StudentAvatar({
  photoPath,
  name,
  size = 40,
  className = '',
}: Props) {
  const photoUrl = usePhotoUrl(photoPath)
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const colorClass = COLORS[hashName(name || '') % COLORS.length]
  const fontSize = Math.max(11, Math.round(size * 0.42))

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${
        photoUrl ? 'bg-slate-100' : colorClass
      } ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={name || 'ไม่มีรูป'}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name || ''}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
