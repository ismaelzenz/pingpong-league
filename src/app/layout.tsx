import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ping Pong League',
  description: 'Office ping pong tournament tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
