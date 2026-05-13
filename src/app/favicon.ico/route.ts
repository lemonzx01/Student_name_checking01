// Browser อาจ ping /favicon.ico ตามค่า default ของระบบ (legacy) แม้ Next.js
// inject <link rel="icon" href="/icon.svg"> จาก metadata.icons แล้ว
// ส่ง SVG ตัวเดียวกันกลับไปเพื่อกัน 404 ใน console

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2563eb"/><path d="M16 7L4 13l12 6 10-5v7h2v-8L16 7zM7 16.5V21c0 1.5 4 3 9 3s9-1.5 9-3v-4.5l-9 4.5-9-4.5z" fill="#fff"/></svg>`

export function GET() {
  return new Response(ICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
