'use client'

import Link from 'next/link'
import DelayBadge from './DelayBadge'
import { formatPrice } from '@/lib/utils'
import type { SearchResult } from '@/types'

interface TripCardProps {
  trip: SearchResult
  date: string
}

export default function TripCard({ trip, date }: TripCardProps) {
  const delayOffset = trip.delay?.active ? trip.delay.offsetMinutes : 0

  return (
    <Link
      href={`/trip/${trip.scheduleId}?date=${date}`}
      className="glass-card p-5 hover:border-primary-500/30 transition-all duration-200 block group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Provider & Times */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{trip.providerLogo}</span>
            <span className="text-dark-300 text-sm font-medium">{trip.providerName}</span>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold">{trip.departureTime}</p>
              <p className="text-dark-400 text-sm">{trip.origin}</p>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-primary-500 to-accent-500 opacity-50" />
              <span className="text-dark-500 text-xs">{trip.routeName}</span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-accent-500 to-primary-500 opacity-50" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{trip.arrivalTime}</p>
              <p className="text-dark-400 text-sm">{trip.destination}</p>
            </div>
          </div>
        </div>

        {/* Right: Price & Status */}
        <div className="sm:text-right sm:min-w-[140px] flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
          <p className="text-2xl font-bold text-accent-400">{formatPrice(trip.price)}</p>
          <DelayBadge offsetMinutes={delayOffset} reason={trip.delay?.reason} />
          <p className="text-dark-400 text-xs">
            {trip.availableSeats} / {trip.totalSeats} seats available
          </p>
        </div>
      </div>

      {/* Stops preview */}
      <div className="mt-4 flex items-center gap-1 overflow-x-auto">
        {trip.stops.map((stop, i) => (
          <div key={stop.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-dark-400">{stop.departureTime}</span>
              <div className="w-2 h-2 rounded-full bg-primary-500/60" />
              <span className="text-[10px] text-dark-500 whitespace-nowrap">{stop.stopName}</span>
            </div>
            {i < trip.stops.length - 1 && (
              <div className="w-8 h-[1px] bg-dark-600 mx-1 mt-[-6px]" />
            )}
          </div>
        ))}
      </div>
    </Link>
  )
}
