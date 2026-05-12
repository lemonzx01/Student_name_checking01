/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 15+: ย้ายจาก experimental.serverComponentsExternalPackages มาเป็น top-level
  serverExternalPackages: ['better-sqlite3'],

  // ─── Static export สำหรับการ package Electron ──────────────
  // ในโหมด `npm run dev` (Next.js dev server + เปิดเว็บ) ต้องคอมเมนต์ทิ้ง
  // เพราะ static export ทำให้ /api/* ใช้ไม่ได้
  //
  // เมื่อจะ build ติดตั้งลง Electron (`npm run build:electron`)
  // ให้ uncomment บรรทัด `output: 'export'` ด้านล่าง — Electron จะโหลด /out/index.html
  // และทุก data flow จะผ่าน IPC (window.electronAPI) แทน HTTP fetch
  //
  // output: 'export',
}

module.exports = nextConfig
