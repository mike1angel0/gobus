'use client'

import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>GoBus — Bus Transit Platform</title>
        <meta name="description" content="Modern bus transit booking platform" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen bg-dark-950 text-white antialiased">
        <SessionProvider>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
