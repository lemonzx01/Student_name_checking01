'use client'

import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'normal' | 'large' | 'extra-large'

const THEME_KEY = 'theme'
const FONT_KEY = 'fontSize'

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** apply theme + font size attributes ลงบน <html> */
function applyTheme(mode: ThemeMode, fontSize: FontSize) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const effectiveDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark())
  if (effectiveDark) {
    html.setAttribute('data-theme', 'dark')
  } else {
    html.removeAttribute('data-theme')
  }
  if (fontSize === 'normal') {
    html.removeAttribute('data-font-size')
  } else {
    html.setAttribute('data-font-size', fontSize)
  }
}

/**
 * Hook สำหรับจัดการ theme (light/dark/system) + fontSize (normal/large/extra-large)
 * เก็บใน localStorage + apply ทันทีลงบน <html>
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('light')
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [ready, setReady] = useState(false)

  // โหลดจาก localStorage ตอน mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_KEY) as ThemeMode | null) || 'light'
    const savedFont = (localStorage.getItem(FONT_KEY) as FontSize | null) || 'normal'
    setMode(savedTheme)
    setFontSize(savedFont)
    applyTheme(savedTheme, savedFont)
    setReady(true)
  }, [])

  // apply เมื่อ state เปลี่ยน
  useEffect(() => {
    if (!ready) return
    applyTheme(mode, fontSize)
    localStorage.setItem(THEME_KEY, mode)
    localStorage.setItem(FONT_KEY, fontSize)
  }, [mode, fontSize, ready])

  // listen system preference change (เฉพาะกรณี mode = 'system')
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system', fontSize)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode, fontSize])

  const updateMode = useCallback((newMode: ThemeMode) => setMode(newMode), [])
  const updateFontSize = useCallback((newSize: FontSize) => setFontSize(newSize), [])

  return { mode, fontSize, setMode: updateMode, setFontSize: updateFontSize, ready }
}

/**
 * Light initializer ที่อ่าน localStorage เป็นครั้งแรกแล้วใส่ attribute ลงบน <html>
 * เรียกใน ClientLayout ตอน mount เพื่อกัน FOUC (flash of unstyled content)
 */
export function initThemeFromStorage() {
  if (typeof window === 'undefined') return
  try {
    const savedTheme = (localStorage.getItem(THEME_KEY) as ThemeMode | null) || 'light'
    const savedFont = (localStorage.getItem(FONT_KEY) as FontSize | null) || 'normal'
    applyTheme(savedTheme, savedFont)
  } catch {
    // ignore
  }
}
