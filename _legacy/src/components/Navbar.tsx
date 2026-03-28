'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = (session?.user as any)?.role
  const isProvider = role === 'PROVIDER'
  const isDriver = role === 'DRIVER'
  const isAdmin = role === 'ADMIN'

  const navLink = "text-dark-300 hover:text-white transition-colors text-sm"
  const mobileLink = "block text-dark-300 hover:text-white py-2 text-sm"

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center font-bold text-sm">
              T
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              GoBus
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className={navLink}>Search</Link>
            <Link href="/help" className={navLink}>Help</Link>
            {session ? (
              <>
                {isAdmin ? (
                  <>
                    <Link href="/admin" className={navLink}>Overview</Link>
                    <Link href="/admin/fleet" className={navLink}>Fleet</Link>
                  </>
                ) : isProvider ? (
                  <>
                    <Link href="/provider/dashboard" className={navLink}>Dashboard</Link>
                    <Link href="/provider/routes" className={navLink}>Routes</Link>
                    <Link href="/provider/fleet" className={navLink}>Fleet</Link>
                    <Link href="/provider/schedules" className={navLink}>Schedules</Link>
                    <Link href="/provider/drivers" className={navLink}>Drivers</Link>
                    <Link href="/provider/tracking" className={navLink}>Tracking</Link>
                    <Link href="/provider/performance" className={navLink}>Performance</Link>
                    <Link href="/provider/chat" className={navLink}>Chat</Link>
                  </>
                ) : isDriver ? (
                  <>
                    <Link href="/driver/trips" className={navLink}>My Trips</Link>
                    <Link href="/driver/history" className={navLink}>History</Link>
                    <Link href="/driver/chat" className={navLink}>Chat</Link>
                    <Link href="/driver/profile" className={navLink}>Profile</Link>
                  </>
                ) : (
                  <>
                    <Link href="/my-trips" className={navLink}>My Trips</Link>
                    <Link href="/profile" className={navLink}>Profile</Link>
                  </>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-dark-400 text-sm">{session.user?.name}</span>
                  <button
                    onClick={() => signOut()}
                    className="btn-secondary text-sm py-1.5 px-3"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login" className="btn-secondary text-sm py-1.5 px-3">
                  Login
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm py-1.5 px-3">
                  Register
                </Link>
              </div>
            )}
          </div>

          <button
            className="md:hidden text-dark-300 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/" className={mobileLink} onClick={() => setMenuOpen(false)}>Search</Link>
            <Link href="/help" className={mobileLink} onClick={() => setMenuOpen(false)}>Help</Link>
            {session ? (
              <>
                {isAdmin ? (
                  <>
                    <Link href="/admin" className={mobileLink} onClick={() => setMenuOpen(false)}>Overview</Link>
                    <Link href="/admin/fleet" className={mobileLink} onClick={() => setMenuOpen(false)}>Fleet</Link>
                  </>
                ) : isProvider ? (
                  <>
                    <Link href="/provider/dashboard" className={mobileLink} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                    <Link href="/provider/routes" className={mobileLink} onClick={() => setMenuOpen(false)}>Routes</Link>
                    <Link href="/provider/fleet" className={mobileLink} onClick={() => setMenuOpen(false)}>Fleet</Link>
                    <Link href="/provider/schedules" className={mobileLink} onClick={() => setMenuOpen(false)}>Schedules</Link>
                    <Link href="/provider/drivers" className={mobileLink} onClick={() => setMenuOpen(false)}>Drivers</Link>
                    <Link href="/provider/tracking" className={mobileLink} onClick={() => setMenuOpen(false)}>Tracking</Link>
                    <Link href="/provider/performance" className={mobileLink} onClick={() => setMenuOpen(false)}>Performance</Link>
                    <Link href="/provider/chat" className={mobileLink} onClick={() => setMenuOpen(false)}>Chat</Link>
                  </>
                ) : isDriver ? (
                  <>
                    <Link href="/driver/trips" className={mobileLink} onClick={() => setMenuOpen(false)}>My Trips</Link>
                    <Link href="/driver/history" className={mobileLink} onClick={() => setMenuOpen(false)}>History</Link>
                    <Link href="/driver/chat" className={mobileLink} onClick={() => setMenuOpen(false)}>Chat</Link>
                    <Link href="/driver/profile" className={mobileLink} onClick={() => setMenuOpen(false)}>Profile</Link>
                  </>
                ) : (
                  <>
                    <Link href="/my-trips" className={mobileLink} onClick={() => setMenuOpen(false)}>My Trips</Link>
                    <Link href="/profile" className={mobileLink} onClick={() => setMenuOpen(false)}>Profile</Link>
                  </>
                )}
                <button onClick={() => signOut()} className="btn-secondary text-sm w-full mt-2">Sign Out</button>
              </>
            ) : (
              <div className="flex gap-2 mt-2">
                <Link href="/auth/login" className="btn-secondary text-sm flex-1 text-center" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/auth/register" className="btn-primary text-sm flex-1 text-center" onClick={() => setMenuOpen(false)}>Register</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
