import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import { Footer } from '@/components/footer'
import { Nav } from '@/components/nav'
import './globals.css'

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-plex-sans', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://vigoros.studio'),
  title: { default: 'Vigoros', template: '%s · Vigoros' },
  description: 'The independent scoring authority for time-locked market forecasts. A benchmark that cannot be backtested.',
  openGraph: { siteName: 'Vigoros', type: 'website' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
