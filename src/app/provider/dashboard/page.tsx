'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'

export default function ProviderDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') {
      fetch('/api/schedules').then(r => r.json()).then(data => {
        setSchedules(Array.isArray(data) ? data : [])
        setLoading(false)
      })
    }
  }, [status])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-dark-700 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-dark-700 rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  const totalBookings = schedules.reduce((sum, s) => sum + (s.bookings?.length || 0), 0)
  const totalRevenue = schedules.reduce((sum, s) => {
    return sum + (s.bookings?.reduce((bs: number, b: any) => bs + b.totalPrice, 0) || 0)
  }, 0)
  const activeTrips = schedules.filter(s => s.status === 'ACTIVE').length
  const avgOccupancy = schedules.length > 0
    ? Math.round(schedules.reduce((sum, s) => {
        const booked = s.bookings?.length || 0
        return sum + (s.bus ? (booked / (s.bus.capacity || 1)) * 100 : 0)
      }, 0) / schedules.length)
    : 0

  // Revenue by route
  const revenueByRoute: Record<string, number> = {}
  const bookingsByRoute: Record<string, number> = {}
  schedules.forEach(s => {
    const name = s.route?.name || 'Unknown'
    revenueByRoute[name] = (revenueByRoute[name] || 0) + (s.bookings?.reduce((bs: number, b: any) => bs + b.totalPrice, 0) || 0)
    bookingsByRoute[name] = (bookingsByRoute[name] || 0) + (s.bookings?.length || 0)
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-dark-400">{(session?.user as any)?.providerName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Bookings', value: totalBookings, color: 'text-primary-400' },
          { label: 'Revenue', value: formatPrice(totalRevenue), color: 'text-accent-400' },
          { label: 'Active Trips', value: activeTrips, color: 'text-blue-400' },
          { label: 'Avg. Occupancy', value: `${avgOccupancy}%`, color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-5">
            <p className="text-dark-400 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by route */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-4">Revenue by Route</h2>
          <div className="space-y-3">
            {Object.entries(revenueByRoute)
              .sort(([, a], [, b]) => b - a)
              .map(([name, rev]) => {
                const maxRev = Math.max(...Object.values(revenueByRoute))
                const pct = maxRev > 0 ? (rev / maxRev) * 100 : 0
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-300">{name}</span>
                      <span className="text-accent-400 font-medium">{formatPrice(rev)}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-4">Bookings by Route</h2>
          <div className="space-y-3">
            {Object.entries(bookingsByRoute)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => {
                const maxCount = Math.max(...Object.values(bookingsByRoute))
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-300">{name}</span>
                      <span className="text-primary-400 font-medium">{count} bookings</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent-500 to-primary-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="glass-card p-6 mt-6">
        <h2 className="text-lg font-bold mb-4">Recent Schedule Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-dark-400 border-b border-dark-700">
                <th className="text-left py-2 px-3">Route</th>
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Time</th>
                <th className="text-left py-2 px-3">Bus</th>
                <th className="text-right py-2 px-3">Bookings</th>
                <th className="text-right py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.slice(0, 10).map(s => (
                <tr key={s.id} className="border-b border-dark-800 hover:bg-dark-800/40">
                  <td className="py-2 px-3">{s.route?.name}</td>
                  <td className="py-2 px-3 text-dark-400">{s.tripDate}</td>
                  <td className="py-2 px-3 text-dark-400">{s.departureTime} - {s.arrivalTime}</td>
                  <td className="py-2 px-3 text-dark-400">{s.bus?.licensePlate}</td>
                  <td className="py-2 px-3 text-right">{s.bookings?.length || 0}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.delays?.length > 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      s.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {s.delays?.length > 0 ? 'Delayed' : s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
