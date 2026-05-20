import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SPEAR · Asesor Virtual',
  description: 'Panel Ejecutivo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
