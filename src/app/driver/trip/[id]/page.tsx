'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import LiveMap from '@/components/LiveMap'

export default function DriverTripDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'DRIVER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') fetchTrip()
  }, [status])

  const fetchTrip = async () => {
    const res = await fetch(`/api/schedules?id=${scheduleId}`)
    const data = await res.json()
    setTrip(data)
    setLoading(false)

    if (data?.bus?.tracking?.isActive && data.bus.tracking.scheduleId === scheduleId) {
      setSharing(true)
      setCurrentStopIndex(data.bus.tracking.currentStopIndex || 0)
    }
  }

  const postLocation = useCallback(async (position: GeolocationPosition) => {
    if (!trip) return
    try {
      await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: trip.bus.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed || 0,
          heading: position.coords.heading || 0,
          scheduleId,
          currentStopIndex,
          isActive: true,
          tripDate: trip.tripDate,
        }),
      })
    } catch {
      // Silently fail on individual updates
    }
  }, [trip, scheduleId, currentStopIndex])

  const startSharing = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }

    const id = navigator.geolocation.watchPosition(
      postLocation,
      (err) => {
        toast.error('Location error: ' + err.message)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    watchIdRef.current = id
    setSharing(true)
    toast.success('Location sharing started')
  }

  const stopSharing = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (trip) {
      await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: trip.bus.id,
          latitude: trip.bus.tracking?.latitude || 0,
          longitude: trip.bus.tracking?.longitude || 0,
          scheduleId,
          currentStopIndex,
          isActive: false,
          tripDate: trip.tripDate,
        }),
      })
    }

    setSharing(false)
    toast.success('Location sharing stopped')
  }

  const endTrip = async () => {
    await stopSharing()
    router.push('/driver/trips')
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="glass-card p-6 animate-pulse">
          <div className="h-6 bg-dark-700 rounded w-2/3 mb-4" />
          <div className="h-48 bg-dark-700 rounded mb-4" />
          <div className="h-4 bg-dark-700 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="glass-card p-12 text-center text-dark-400">Trip not found.</div>
      </div>
    )
  }

  const stops = trip.stopTimes || []

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{trip.route?.name}</h1>
        <span className="text-dark-400 text-sm">{trip.departureTime} - {trip.arrivalTime}</span>
      </div>

      {/* Map */}
      <div className="glass-card overflow-hidden" style={{ height: 250 }}>
        <LiveMap
          stops={trip.route?.stops || []}
          tracking={trip.bus?.tracking}
        />
      </div>

      {/* Location sharing toggle */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Share Location</p>
          <p className="text-dark-500 text-xs">
            {sharing ? 'Broadcasting live GPS' : 'Tap to start sharing'}
          </p>
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sharing
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}
        >
          {sharing ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Stop progress */}
      <div className="glass-card p-4">
        <h3 className="font-semibold text-sm mb-3">Stop Progress</h3>
        <div className="space-y-0">
          {stops.map((stop: any, i: number) => {
            const isCompleted = i < currentStopIndex
            const isCurrent = i === currentStopIndex
            return (
              <div key={stop.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setCurrentStopIndex(i)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : isCurrent
                        ? 'bg-accent-500 border-accent-500'
                        : 'bg-dark-700 border-dark-600'
                    }`}
                  />
                  {i < stops.length - 1 && (
                    <div className={`w-0.5 h-6 ${isCompleted ? 'bg-green-500/50' : 'bg-dark-700'}`} />
                  )}
                </div>
                <div className="pb-4">
                  <p className={`text-sm ${isCurrent ? 'font-bold text-white' : isCompleted ? 'text-dark-400' : 'text-dark-500'}`}>
                    {stop.stopName}
                  </p>
                  <p className="text-xs text-dark-500">{stop.arrivalTime}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/driver/delay?scheduleId=${scheduleId}&tripDate=${trip.tripDate}`}
          className="btn-secondary flex-1 text-center text-sm"
        >
          Report Delay
        </Link>
        <button onClick={endTrip} className="btn-primary flex-1 text-sm">
          End Trip
        </button>
      </div>
    </div>
  )
}
