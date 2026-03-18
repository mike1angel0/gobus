'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import SeatMap from '@/components/SeatMap'
import type { SeatData } from '@/types'

export default function FleetPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [buses, setBuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [licensePlate, setLicensePlate] = useState('')
  const [model, setModel] = useState('')
  const [rows, setRows] = useState(10)
  const [columns, setColumns] = useState(4)
  const [seatTypes, setSeatTypes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') fetchBuses()
  }, [status])

  const fetchBuses = async () => {
    const res = await fetch('/api/buses')
    const data = await res.json()
    setBuses(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const generateSeats = () => {
    const seats: any[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const label = `${String.fromCharCode(65 + r)}${c + 1}`
        const type = seatTypes[label] || 'STANDARD'
        seats.push({
          row: r,
          column: c,
          label,
          type,
          price: type === 'PREMIUM' ? 5 : 0,
        })
      }
    }
    return seats
  }

  const seatMapSeats: SeatData[] = generateSeats()

  const cycleSeatType = (seat: SeatData) => {
    const types = ['STANDARD', 'PREMIUM', 'DISABLED_ACCESSIBLE', 'BLOCKED']
    const current = seatTypes[seat.label] || 'STANDARD'
    const next = types[(types.indexOf(current) + 1) % types.length]
    setSeatTypes({ ...seatTypes, [seat.label]: next })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const seats = generateSeats()
    const capacity = seats.filter(s => s.type !== 'BLOCKED').length

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      licensePlate,
      model,
      capacity,
      rows,
      columns,
      seats,
    }

    const res = await fetch('/api/buses', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      toast.success(editingId ? 'Bus updated' : 'Bus created')
      resetForm()
      fetchBuses()
    } else {
      toast.error('Failed to save bus')
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setLicensePlate('')
    setModel('')
    setRows(10)
    setColumns(4)
    setSeatTypes({})
  }

  const startEdit = (bus: any) => {
    setEditingId(bus.id)
    setLicensePlate(bus.licensePlate)
    setModel(bus.model)
    setRows(bus.rows)
    setColumns(bus.columns)
    const types: Record<string, string> = {}
    bus.seats.forEach((s: any) => { types[s.label] = s.type })
    setSeatTypes(types)
    setShowForm(true)
  }

  const deleteBus = async (id: string) => {
    if (!confirm('Delete this bus?')) return
    const res = await fetch(`/api/buses?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Bus deleted')
      fetchBuses()
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fleet Management</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Bus'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">{editingId ? 'Edit Bus' : 'New Bus'}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">License Plate</label>
              <input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Model</label>
              <input type="text" value={model} onChange={e => setModel(e.target.value)} className="input-field w-full" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Rows</label>
              <input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} className="input-field w-full" min={2} max={20} />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Columns</label>
              <input type="number" value={columns} onChange={e => setColumns(Number(e.target.value))} className="input-field w-full" min={2} max={6} />
            </div>
          </div>

          <div>
            <label className="block text-dark-400 text-sm mb-2">Seat Map Builder <span className="text-dark-500">(click seats to cycle type)</span></label>
            <SeatMap
              seats={seatMapSeats}
              rows={rows}
              columns={columns}
              selectedSeats={[]}
              onSeatClick={cycleSeatType}
            />
          </div>

          <p className="text-dark-400 text-sm">
            Capacity: {seatMapSeats.filter(s => s.type !== 'BLOCKED').length} seats
            ({seatMapSeats.filter(s => s.type === 'PREMIUM').length} premium,
            {' '}{seatMapSeats.filter(s => s.type === 'DISABLED_ACCESSIBLE').length} accessible)
          </p>

          <button type="submit" className="btn-accent w-full">
            {editingId ? 'Update Bus' : 'Create Bus'}
          </button>
        </form>
      )}

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
          No buses yet. Add your first bus above.
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map(bus => (
            <div key={bus.id} className="glass-card overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-dark-700/30 transition-colors"
                onClick={() => setExpandedId(expandedId === bus.id ? null : bus.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{bus.model}</h3>
                    <p className="text-dark-400 text-sm">{bus.licensePlate} • {bus.capacity} seats • {bus.rows}×{bus.columns}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(bus) }} className="btn-secondary text-xs py-1 px-2">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteBus(bus.id) }} className="text-dark-500 hover:text-red-400 text-sm px-2">Delete</button>
                  </div>
                </div>
              </div>
              {expandedId === bus.id && (
                <div className="border-t border-dark-700 p-5">
                  <SeatMap
                    seats={bus.seats.map((s: any) => ({ ...s, isOccupied: false, isSelected: false }))}
                    rows={bus.rows}
                    columns={bus.columns}
                    selectedSeats={[]}
                    readonly
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
