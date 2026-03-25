'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import SeatMap from '@/components/SeatMap'
import LiveMap from '@/components/LiveMap'
import DelayBadge from '@/components/DelayBadge'
import { formatPrice, addMinutesToTime } from '@/lib/utils'
import type { SeatData } from '@/types'

function TripContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const scheduleId = params.id as string
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [schedule, setSchedule] = useState<any>(null)
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [boardingStop, setBoardingStop] = useState('')
  const [alightingStop, setAlightingStop] = useState('')

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`/api/schedules?id=${scheduleId}`)
      const data = await res.json()
      setSchedule(data)
      if (data?.stopTimes?.length >= 2 && !boardingStop) {
        setBoardingStop(data.stopTimes[0].stopName)
        setAlightingStop(data.stopTimes[data.stopTimes.length - 1].stopName)
      }
    } catch {
      toast.error('Failed to load trip')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSchedule()
    const interval = setInterval(fetchSchedule, 5000)
    return () => clearInterval(interval)
  }, [scheduleId])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-dark-700 rounded w-1/3 mb-4" />
          <div className="h-64 bg-dark-700 rounded mb-4" />
          <div className="h-32 bg-dark-700 rounded" />
        </div>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="glass-card p-12 text-center">
          <p className="text-dark-400 text-lg">Trip not found.</p>
        </div>
      </div>
    )
  }

  const occupiedSeats = new Set<string>()
  schedule.bookings?.forEach((b: any) => {
    if (b.tripDate === date) {
      b.seatLabels.split(',').forEach((l: string) => occupiedSeats.add(l.trim()))
    }
  })

  const seats: SeatData[] = schedule.bus.seats.map((s: any) => ({
    ...s,
    isOccupied: occupiedSeats.has(s.label),
    isSelected: selectedSeats.includes(s.label),
  }))

  const activeDelay = schedule.delays?.find((d: any) => d.active && d.tripDate === date)
  const delayOffset = activeDelay?.offsetMinutes || 0

  const handleSeatClick = (seat: SeatData) => {
    setSelectedSeats(prev =>
      prev.includes(seat.label)
        ? prev.filter(s => s !== seat.label)
        : [...prev, seat.label]
    )
  }

  // Calculate price based on boarding/alighting stops
  const boardingIdx = schedule.stopTimes.findIndex((st: any) => st.stopName === boardingStop)
  const alightingIdx = schedule.stopTimes.findIndex((st: any) => st.stopName === alightingStop)
  const boardingPrice = boardingIdx >= 0 ? schedule.stopTimes[boardingIdx].priceFromStart : 0
  const alightingPrice = alightingIdx >= 0 ? schedule.stopTimes[alightingIdx].priceFromStart : schedule.basePrice
  const segmentPrice = alightingPrice - boardingPrice

  const selectedSeatData = seats.filter(s => selectedSeats.includes(s.label))
  const premiumSurcharge = selectedSeatData.reduce((sum, s) => sum + s.price, 0)
  const totalPrice = selectedSeats.length * segmentPrice + premiumSurcharge

  const handleBooking = async () => {
    if (!session) {
      toast.error('Please sign in to book')
      router.push('/auth/login')
      return
    }
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat')
      return
    }

    setBooking(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          seatLabels: selectedSeats,
          totalPrice,
          boardingStop,
          alightingStop,
          tripDate: date,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Booking failed')
      } else {
        toast.success('Booking confirmed!')
        router.push('/my-trips')
      }
    } catch {
      toast.error('Booking failed')
    }
    setBooking(false)
  }

  const stops = schedule.route.stops.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
  const tracking = schedule.bus.tracking

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{schedule.route.provider.logo}</span>
              <span className="text-dark-300 font-medium">{schedule.route.provider.name}</span>
            </div>
            <h1 className="text-2xl font-bold">{schedule.route.name}</h1>
            <p className="text-dark-400 mt-1">{date} • {schedule.bus.model} ({schedule.bus.licensePlate})</p>
          </div>
          <DelayBadge offsetMinutes={delayOffset} reason={activeDelay?.reason} showReason size="md" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Route + Map */}
        <div className="space-y-6">
          {/* Stop timeline */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Route & Schedule</h2>
            <div className="space-y-0">
              {schedule.stopTimes.map((st: any, i: number) => {
                const adjustedArr = delayOffset ? addMinutesToTime(st.arrivalTime, delayOffset) : st.arrivalTime
                const adjustedDep = delayOffset ? addMinutesToTime(st.departureTime, delayOffset) : st.departureTime
                const isCurrent = tracking?.isActive && tracking.currentStopIndex === i

                return (
                  <div key={st.id} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-accent-500 ring-4 ring-accent-500/20' : 'bg-primary-500'}`} />
                      {i < schedule.stopTimes.length - 1 && (
                        <div className="w-0.5 h-12 bg-dark-600" />
                      )}
                    </div>
                    <div className="pb-4 -mt-1">
                      <p className="font-medium">{st.stopName}</p>
                      <div className="flex items-center gap-2 text-sm text-dark-400">
                        <span>{st.arrivalTime === st.departureTime ? st.arrivalTime : `${st.arrivalTime} - ${st.departureTime}`}</span>
                        {delayOffset > 0 && (
                          <span className="text-yellow-400 text-xs">→ {adjustedArr === adjustedDep ? adjustedArr : `${adjustedArr} - ${adjustedDep}`}</span>
                        )}
                      </div>
                      <p className="text-xs text-dark-500">€{st.priceFromStart.toFixed(2)} from start</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Map */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-bold mb-3">Live Map</h2>
            <LiveMap
              stops={stops}
              tracking={tracking?.isActive ? tracking : null}
              height="300px"
            />
          </div>
        </div>

        {/* Right: Seat Selection + Booking */}
        <div className="space-y-6">
          {/* Stop selection */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Your Journey</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-dark-400 text-sm mb-1.5">Board at</label>
                <select
                  value={boardingStop}
                  onChange={e => setBoardingStop(e.target.value)}
                  className="input-field w-full"
                >
                  {schedule.stopTimes.slice(0, -1).map((st: any) => (
                    <option key={st.id} value={st.stopName}>{st.stopName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-dark-400 text-sm mb-1.5">Alight at</label>
                <select
                  value={alightingStop}
                  onChange={e => setAlightingStop(e.target.value)}
                  className="input-field w-full"
                >
                  {schedule.stopTimes.filter((_: any, i: number) => i > boardingIdx).map((st: any) => (
                    <option key={st.id} value={st.stopName}>{st.stopName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seat map */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Select Seats</h2>
            <SeatMap
              seats={seats}
              rows={schedule.bus.rows}
              columns={schedule.bus.columns}
              selectedSeats={selectedSeats}
              onSeatClick={handleSeatClick}
              showPrices
              basePrice={segmentPrice}
            />
          </div>

          {/* Booking summary */}
          <div className="glass-card p-6 border-accent-500/30">
            <h2 className="text-lg font-bold mb-4">Booking Summary</h2>
            {selectedSeats.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-dark-300">
                  <span>Seats</span>
                  <span>{selectedSeats.join(', ')}</span>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>{boardingStop} → {alightingStop}</span>
                  <span>{formatPrice(segmentPrice)} × {selectedSeats.length}</span>
                </div>
                {premiumSurcharge > 0 && (
                  <div className="flex justify-between text-dark-300">
                    <span>Premium surcharge</span>
                    <span>{formatPrice(premiumSurcharge)}</span>
                  </div>
                )}
                <hr className="border-dark-700" />
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-accent-400">{formatPrice(totalPrice)}</span>
                </div>
                <button
                  onClick={handleBooking}
                  disabled={booking}
                  className="btn-accent w-full py-3 text-lg mt-4"
                >
                  {booking ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            ) : (
              <p className="text-dark-400 text-center py-4">
                Click on seats to select them
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TripPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8"><div className="glass-card p-8 animate-pulse"><div className="h-64 bg-dark-700 rounded" /></div></div>}>
      <TripContent />
    </Suspense>
  )
}
