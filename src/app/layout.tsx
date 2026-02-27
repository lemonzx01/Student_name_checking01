import './globals.css'
import type { Metadata } from 'next'
import { Kanit } from 'next/font/google'
import ClientLayout from '@/components/ClientLayout'

const kanit = Kanit({ subsets: ['latin', 'thai'], weight: ['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'ระบบจัดการโรงเรียน',
  description: 'ระบบจัดการชั้นเรียนและนักเรียน',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={kanit.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
