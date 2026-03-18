'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DriverTripsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'DRIVER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') fetchTrips()
  }, [status, selectedDate])

  const fetchTrips = async () => {
    setLoading(true)
    const res = await fetch(`/api/driver/trips?date=${selectedDate}`)
    const data = await res.json()
    setTrips(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">My Trips</h1>

      <input
        type="date"
        value={selectedDate}
        onChange={e => setSelectedDate(e.target.value)}
        className="input-field w-full mb-4"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-2/3 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="glass-card p-12 text-center text-dark-400">
          No trips scheduled for this date.
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const isActive = trip.bus?.tracking?.isActive && trip.bus?.tracking?.scheduleId === trip.id
            return (
              <div key={trip.id} className="glass-card p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{trip.route?.name}</h3>
                    <p className="text-dark-400 text-sm">
                      {trip.departureTime} - {trip.arrivalTime}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      Live
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-dark-400 text-sm">
                    Bus: {trip.bus?.model} ({trip.bus?.licensePlate})
                  </p>
                  <p className="text-dark-400 text-sm">
                    Passengers: {trip.bookings?.length || 0} bookings
                  </p>
                  {trip.delays?.length > 0 && (
                    <p className="text-yellow-400 text-sm">
                      Delay: +{trip.delays[0].offsetMinutes} min ({trip.delays[0].reason})
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 mb-4 flex-wrap">
                  {trip.stopTimes?.map((st: any, i: number) => (
                    <span key={st.id} className="text-xs text-dark-500">
                      {st.stopName} ({st.arrivalTime}){i < trip.stopTimes.length - 1 ? ' → ' : ''}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/driver/trip/${trip.id}`}
                  className="btn-accent w-full text-center block text-sm"
                >
                  {isActive ? 'Continue Trip' : 'Start Trip'}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
