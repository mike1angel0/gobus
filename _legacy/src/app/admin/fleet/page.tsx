'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import SeatMap from '@/components/SeatMap'
import type { SeatData } from '@/types'

interface BusWithProvider {
  id: string
  model: string
  licensePlate: string
  capacity: number
  rows: number
  columns: number
  seats: (SeatData & { isEnabled: boolean })[]
  provider: { name: string }
}

export default function AdminFleetPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [buses, setBuses] = useState<BusWithProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBusId, setEditingBusId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login')
    if (status === 'authenticated' && (session.user as any).role !== 'ADMIN') router.push('/')
    if (status === 'authenticated') fetchBuses()
  }, [status])

  const fetchBuses = async () => {
    const res = await fetch('/api/admin/buses')
    const data = await res.json()
    setBuses(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const toggleSeat = async (seat: SeatData) => {
    if (seat.type === 'BLOCKED') return
    setToggling(seat.id)
    const newEnabled = seat.isEnabled === false ? true : false

    const res = await fetch('/api/admin/seats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId: seat.id, isEnabled: newEnabled }),
    })

    if (res.ok) {
      setBuses(prev =>
        prev.map(bus => ({
          ...bus,
          seats: bus.seats.map(s =>
            s.id === seat.id ? { ...s, isEnabled: newEnabled } : s
          ),
        }))
      )
      toast.success(`Seat ${seat.label} ${newEnabled ? 'enabled' : 'disabled'}`)
    } else {
      toast.error('Failed to update seat')
    }
    setToggling(null)
  }

  const editingBus = editingBusId ? buses.find(b => b.id === editingBusId) : null

  // Editing view — full panel for a single bus
  if (editingBus) {
    const enabledCount = editingBus.seats.filter(s => s.type !== 'BLOCKED' && s.isEnabled !== false).length
    const disabledCount = editingBus.seats.filter(s => s.type !== 'BLOCKED' && s.isEnabled === false).length

    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => setEditingBusId(null)}
          className="flex items-center gap-1.5 text-dark-400 hover:text-white text-sm mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Fleet
        </button>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold">{editingBus.model}</h1>
            <div className="flex items-center gap-3">
              {disabledCount > 0 && (
                <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">
                  {disabledCount} disabled
                </span>
              )}
              <span className="text-xs bg-dark-700 text-dark-300 px-2 py-1 rounded">
                {enabledCount} active
              </span>
            </div>
          </div>
          <p className="text-dark-400 text-sm mb-5">
            {editingBus.licensePlate} &middot; {editingBus.provider.name} &middot; {editingBus.rows}&times;{editingBus.columns}
          </p>

          <p className="text-dark-500 text-xs mb-3">Click a seat to toggle enable/disable. Blocked seats cannot be toggled.</p>

          <SeatMap
            seats={editingBus.seats.map(s => ({
              ...s,
              isOccupied: false,
              isSelected: false,
            }))}
            rows={editingBus.rows}
            columns={editingBus.columns}
            selectedSeats={[]}
            onSeatClick={toggleSeat}
            editMode
          />

          {toggling && (
            <p className="text-dark-500 text-xs mt-2 text-center animate-pulse">Saving...</p>
          )}

          <button
            onClick={() => setEditingBusId(null)}
            className="btn-primary w-full mt-5"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Fleet Overview</h1>
      <p className="text-dark-400 text-sm mb-6">Manage seats across all provider buses. Disabled seats cannot be booked by passengers.</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : buses.length === 0 ? (
        <div className="glass-card p-12 text-center text-dark-400">
          No buses registered yet.
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map(bus => {
            const enabledCount = bus.seats.filter(s => s.type !== 'BLOCKED' && s.isEnabled !== false).length
            const disabledCount = bus.seats.filter(s => s.type !== 'BLOCKED' && s.isEnabled === false).length

            return (
              <div key={bus.id} className="glass-card p-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{bus.model}</h3>
                    <p className="text-dark-400 text-sm">
                      {bus.licensePlate} &middot; {bus.provider.name} &middot; {bus.rows}&times;{bus.columns}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {disabledCount > 0 && (
                      <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                        {disabledCount} disabled
                      </span>
                    )}
                    <span className="text-xs text-dark-400">
                      {enabledCount} active seats
                    </span>
                    <button
                      onClick={() => setEditingBusId(bus.id)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Manage Seats
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
