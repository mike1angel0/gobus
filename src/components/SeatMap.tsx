'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SeatData } from '@/types'

interface SeatMapProps {
  seats: SeatData[]
  rows: number
  columns: number
  selectedSeats: string[]
  onSeatClick?: (seat: SeatData) => void
  readonly?: boolean
  showPrices?: boolean
  basePrice?: number
}

const seatColors: Record<string, { bg: string; border: string; text: string }> = {
  STANDARD: { bg: 'bg-dark-700', border: 'border-dark-500', text: 'text-dark-300' },
  PREMIUM: { bg: 'bg-amber-900/40', border: 'border-amber-500/50', text: 'text-amber-400' },
  DISABLED_ACCESSIBLE: { bg: 'bg-blue-900/40', border: 'border-blue-500/50', text: 'text-blue-400' },
  BLOCKED: { bg: 'bg-dark-900', border: 'border-dark-800', text: 'text-dark-600' },
  OCCUPIED: { bg: 'bg-red-900/30', border: 'border-red-500/30', text: 'text-red-400' },
  SELECTED: { bg: 'bg-accent-500/30', border: 'border-accent-400', text: 'text-accent-400' },
}

export default function SeatMap({
  seats,
  rows,
  columns,
  selectedSeats,
  onSeatClick,
  readonly = false,
  showPrices = false,
  basePrice = 0,
}: SeatMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<SeatData | null>(null)

  const getSeatAt = (row: number, col: number) => {
    return seats.find(s => s.row === row && s.column === col)
  }

  const getSeatStyle = (seat: SeatData) => {
    if (selectedSeats.includes(seat.label)) return seatColors.SELECTED
    if (seat.isOccupied) return seatColors.OCCUPIED
    if (seat.type === 'BLOCKED') return seatColors.BLOCKED
    return seatColors[seat.type] || seatColors.STANDARD
  }

  const handleClick = (seat: SeatData) => {
    if (readonly || seat.type === 'BLOCKED' || seat.isOccupied) return
    onSeatClick?.(seat)
  }

  const aisleAfterCol = columns === 4 ? 1 : Math.floor(columns / 2) - 1

  return (
    <div className="space-y-4">
      {/* Bus front indicator */}
      <div className="flex justify-center">
        <div className="bg-dark-700 border border-dark-600 rounded-t-3xl px-8 py-2 text-dark-400 text-xs font-medium">
          FRONT
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl relative">
        {/* Tooltip */}
        {hoveredSeat && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 glass-card p-2 px-3 text-xs z-10 whitespace-nowrap">
            <p className="font-medium">{hoveredSeat.label} — {hoveredSeat.type.replace('_', ' ')}</p>
            {showPrices && hoveredSeat.type !== 'BLOCKED' && (
              <p className="text-accent-400">+€{(basePrice + hoveredSeat.price).toFixed(2)}</p>
            )}
            {hoveredSeat.isOccupied && <p className="text-red-400">Occupied</p>}
          </div>
        )}

        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center gap-1">
              <span className="text-dark-500 text-[10px] w-4 text-right mr-1">{r + 1}</span>
              {Array.from({ length: columns }, (_, c) => {
                const seat = getSeatAt(r, c)
                if (!seat) return <div key={c} className="w-9 h-9" />

                const style = getSeatStyle(seat)
                return (
                  <div key={c} className="flex items-center">
                    <button
                      onClick={() => handleClick(seat)}
                      onMouseEnter={() => setHoveredSeat(seat)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      disabled={readonly || seat.type === 'BLOCKED' || seat.isOccupied}
                      className={cn(
                        'w-9 h-9 rounded-lg border-2 text-[10px] font-medium transition-all duration-200 flex items-center justify-center',
                        style.bg, style.border, style.text,
                        !readonly && seat.type !== 'BLOCKED' && !seat.isOccupied && 'hover:scale-110 cursor-pointer',
                        (seat.type === 'BLOCKED' || seat.isOccupied) && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      {seat.type === 'BLOCKED' ? '✕' : seat.label}
                    </button>
                    {c === aisleAfterCol && <div className="w-4" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center text-xs">
        {[
          { label: 'Available', ...seatColors.STANDARD },
          { label: 'Premium', ...seatColors.PREMIUM },
          { label: 'Accessible', ...seatColors.DISABLED_ACCESSIBLE },
          { label: 'Selected', ...seatColors.SELECTED },
          { label: 'Occupied', ...seatColors.OCCUPIED },
          { label: 'Blocked', ...seatColors.BLOCKED },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={cn('w-4 h-4 rounded border-2', item.bg, item.border)} />
            <span className="text-dark-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
