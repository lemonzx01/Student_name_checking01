import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const metadata: Metadata = {
  title: 'ระบบจัดการนักเรียน',
  description: 'จัดการห้องเรียน รายชื่อนักเรียน และการเช็คชื่อ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
