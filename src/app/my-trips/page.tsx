'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import LiveMap from '@/components/LiveMap'
import DelayBadge from '@/components/DelayBadge'
import { formatPrice, addMinutesToTime } from '@/lib/utils'

export default function MyTripsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchBookings()
      const interval = setInterval(fetchBookings, 5000)
      return () => clearInterval(interval)
    }
  }, [status])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    }
    setLoading(false)
  }

  const cancelBooking = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Booking cancelled')
        fetchBookings()
      }
    } catch {
      toast.error('Failed to cancel')
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = bookings.filter(b => b.tripDate >= today && b.status === 'CONFIRMED')
  const past = bookings.filter(b => b.tripDate < today || b.status !== 'CONFIRMED')

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Trips</h1>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-6 bg-dark-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-dark-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Trips</h1>

      {bookings.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-dark-400 text-lg">No bookings yet.</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">
            Search Buses
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-accent-400">Upcoming Trips</h2>
              <div className="space-y-4">
                {upcoming.map(booking => {
                  const delay = booking.schedule.delays?.find((d: any) => d.active)
                  const delayOffset = delay?.offsetMinutes || 0
                  const tracking = booking.schedule.bus.tracking
                  const isExpanded = expandedId === booking.id
                  const stops = booking.schedule.route.stops.sort((a: any, b: any) => a.orderIndex - b.orderIndex)

                  return (
                    <div key={booking.id} className="glass-card overflow-hidden">
                      <div
                        className="p-5 cursor-pointer hover:bg-dark-700/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-lg">{booking.boardingStop} → {booking.alightingStop}</p>
                            <p className="text-dark-400 text-sm">
                              {booking.tripDate} • {booking.schedule.departureTime} - {booking.schedule.arrivalTime}
                              {delayOffset > 0 && (
                                <span className="text-yellow-400 ml-2">
                                  (adj. {addMinutesToTime(booking.schedule.arrivalTime, delayOffset)})
                                </span>
                              )}
                            </p>
                            <p className="text-dark-500 text-sm mt-1">
                              Seats: {booking.seatLabels} • {booking.schedule.bus.model}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <DelayBadge offsetMinutes={delayOffset} reason={delay?.reason} />
                            <span className="text-accent-400 font-bold">{formatPrice(booking.totalPrice)}</span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-dark-700 p-5 space-y-4">
                          {/* Stop timeline */}
                          <div className="space-y-0">
                            {booking.schedule.stopTimes.map((st: any, i: number) => {
                              const isCurrent = tracking?.isActive && tracking.currentStopIndex === i
                              return (
                                <div key={st.id} className="flex gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-accent-500 ring-2 ring-accent-500/20' : 'bg-primary-500/60'}`} />
                                    {i < booking.schedule.stopTimes.length - 1 && <div className="w-0.5 h-8 bg-dark-700" />}
                                  </div>
                                  <div className="pb-2 -mt-1">
                                    <p className="text-sm font-medium">{st.stopName}</p>
                                    <p className="text-xs text-dark-400">{st.arrivalTime}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Map if tracking active */}
                          {tracking?.isActive && (
                            <LiveMap
                              stops={stops}
                              tracking={tracking}
                              height="250px"
                            />
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); cancelBooking(booking.id) }}
                            className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-dark-400">Past & Cancelled</h2>
              <div className="space-y-3 opacity-60">
                {past.map(booking => (
                  <div key={booking.id} className="glass-card p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{booking.boardingStop} → {booking.alightingStop}</p>
                        <p className="text-dark-500 text-sm">{booking.tripDate} • {booking.status}</p>
                      </div>
                      <span className="text-dark-400">{formatPrice(booking.totalPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
