import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spear — Panel AV',
  description: 'Panel de control del Asesor Virtual',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
