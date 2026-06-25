import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import ThemeProvider from '@/components/ThemeProvider'
import ServiceWorker from '@/components/ServiceWorker'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ping Pong League',
  description: 'Office ping pong tournament tracker',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Ping Pong' },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#334155',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        <ThemeProvider>
          {children}
          <Toaster />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  )
}
