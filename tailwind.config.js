/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ใช้ CSS var ผ่าน rgb() — ต้องระวัง: CSS var ปัจจุบันเป็น hex
        // จึงใช้ var() ตรง ๆ (รองรับ opacity ไม่ได้ แต่ยอม trade-off เพื่อ single source)
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        'surface-muted': 'var(--surface-muted)',
        text: {
          DEFAULT: 'var(--text)',
          soft: 'var(--text-soft)',
          muted: 'var(--muted)',
          'muted-soft': 'var(--muted-soft)',
        },
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
          strong: 'var(--line-strong)',
        },
        brand: {
          DEFAULT: 'var(--primary)',
          soft: 'var(--primary-soft)',
          strong: 'var(--primary-strong)',
          ghost: 'var(--primary-ghost)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          strong: 'var(--accent-strong)',
        },
        ok: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          strong: 'var(--success-strong)',
        },
        warn: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          strong: 'var(--warning-strong)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          strong: 'var(--danger-strong)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },
        nav: {
          DEFAULT: 'var(--nav)',
          hover: 'var(--nav-hover)',
          active: 'var(--nav-active)',
        },
      },
      borderRadius: {
        // เพิ่ม key ใหม่เฉพาะ — ห้าม override sm/md/lg/xl (Tailwind ใช้กับ rounded-xl 12px, rounded-2xl 16px, rounded-3xl 24px ใน 241 จุด)
        'token-sm': 'var(--radius-sm)',
        token: 'var(--radius)',
        'token-md': 'var(--radius-md)',
        'token-lg': 'var(--radius-lg)',
        'token-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        // เพิ่ม key ใหม่เฉพาะ — Tailwind shadow-sm/md/lg ยังคงทำงานปกติ
        'token-xs': 'var(--shadow-xs)',
        'token-sm': 'var(--shadow-sm)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'Kanit', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
