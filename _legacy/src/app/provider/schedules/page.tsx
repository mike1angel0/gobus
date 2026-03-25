'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function SchedulesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schedules, setSchedules] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [buses, setBuses] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [routeId, setRouteId] = useState('')
  const [busId, setBusId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [departureTime, setDepartureTime] = useState('06:00')
  const [arrivalTime, setArrivalTime] = useState('18:00')
  const [daysOfWeek, setDaysOfWeek] = useState('1,2,3,4,5,6,7')
  const [basePrice, setBasePrice] = useState(30)
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/schedules').then(r => r.json()),
        fetch('/api/routes').then(r => r.json()),
        fetch('/api/buses').then(r => r.json()),
        fetch('/api/drivers').then(r => r.json()),
      ]).then(([sData, rData, bData, dData]) => {
        setSchedules(Array.isArray(sData) ? sData : [])
        setRoutes(Array.isArray(rData) ? rData : [])
        setBuses(Array.isArray(bData) ? bData : [])
        setDrivers(Array.isArray(dData) ? dData : [])
        setLoading(false)
      })
    }
  }, [status])

  const selectedRoute = routes.find((r: any) => r.id === routeId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeId || !busId) {
      toast.error('Select route and bus')
      return
    }

    // Generate stop times from route stops
    const route = routes.find((r: any) => r.id === routeId)
    if (!route) return

    const stops = route.stops.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
    const [depH, depM] = departureTime.split(':').map(Number)
    const [arrH, arrM] = arrivalTime.split(':').map(Number)
    const totalMinutes = ((arrH * 60 + arrM) - (depH * 60 + depM) + 1440) % 1440

    const stopTimes = stops.map((stop: any, i: number) => {
      const fraction = stops.length > 1 ? i / (stops.length - 1) : 0
      const minutesFromStart = Math.round(totalMinutes * fraction)
      const h = Math.floor(((depH * 60 + depM) + minutesFromStart) / 60) % 24
      const m = ((depH * 60 + depM) + minutesFromStart) % 60
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const price = Math.round(basePrice * fraction * 100) / 100
      return {
        stopName: stop.name,
        arrivalTime: time,
        departureTime: time,
        priceFromStart: price,
      }
    })

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId, busId, departureTime, arrivalTime, daysOfWeek, basePrice, tripDate, stopTimes, driverId: driverId || undefined,
      }),
    })

    if (res.ok) {
      toast.success('Schedule created')
      setShowForm(false)
      const data = await fetch('/api/schedules').then(r => r.json())
      setSchedules(Array.isArray(data) ? data : [])
    } else {
      toast.error('Failed to create schedule')
    }
  }

  const cancelSchedule = async (id: string) => {
    if (!confirm('Cancel this schedule?')) return
    const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Schedule cancelled')
      const data = await fetch('/api/schedules').then(r => r.json())
      setSchedules(Array.isArray(data) ? data : [])
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Route</label>
              <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input-field w-full" required>
                <option value="">Select route</option>
                {routes.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Bus</label>
              <select value={busId} onChange={e => setBusId(e.target.value)} className="input-field w-full" required>
                <option value="">Select bus</option>
                {buses.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.model} ({b.licensePlate})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-dark-400 text-sm mb-1.5">Driver (optional)</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="input-field w-full">
              <option value="">No driver assigned</option>
              {drivers.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
              ))}
            </select>
          </div>

          {selectedRoute && (
            <div className="text-sm text-dark-400">
              Stops: {selectedRoute.stops?.sort((a: any, b: any) => a.orderIndex - b.orderIndex).map((s: any) => s.name).join(' → ')}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Departure</label>
              <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Arrival</label>
              <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Base Price (€)</label>
              <input type="number" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))} className="input-field w-full" min={1} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Trip Date</label>
              <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Days of Week</label>
              <input type="text" value={daysOfWeek} onChange={e => setDaysOfWeek(e.target.value)} className="input-field w-full" placeholder="1,2,3,4,5" />
            </div>
          </div>

          <button type="submit" className="btn-accent w-full">Create Schedule</button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card p-4 animate-pulse"><div className="h-5 bg-dark-700 rounded w-1/3" /></div>)}
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className="glass-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{s.route?.name}</h3>
                  <p className="text-dark-400 text-sm">
                    {s.departureTime} - {s.arrivalTime} • €{s.basePrice} • {s.bus?.model} ({s.bus?.licensePlate})
                  </p>
                  <p className="text-dark-500 text-xs mt-1">
                    Date: {s.tripDate} • Days: {s.daysOfWeek} • Bookings: {s.bookings?.length || 0}
                    {s.driver && <> • Driver: {s.driver.name}</>}
                  </p>
                  {s.status === 'ACTIVE' && (
                    <div className="mt-1.5">
                      <select
                        value={s.driver?.id || ''}
                        onChange={async (e) => {
                          const res = await fetch('/api/schedules', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: s.id, driverId: e.target.value || null }),
                          })
                          if (res.ok) {
                            toast.success('Driver updated')
                            const data = await fetch('/api/schedules').then(r => r.json())
                            setSchedules(Array.isArray(data) ? data : [])
                          }
                        }}
                        className="input-field text-xs py-1 px-2"
                      >
                        <option value="">No driver</option>
                        {drivers.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {s.stopTimes?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {s.stopTimes.map((st: any, i: number) => (
                        <span key={st.id} className="text-xs text-dark-400">
                          {st.stopName} ({st.arrivalTime}){i < s.stopTimes.length - 1 ? ' → ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {s.status}
                  </span>
                  {s.status === 'ACTIVE' && (
                    <button onClick={() => cancelSchedule(s.id)} className="text-dark-500 hover:text-red-400 text-sm">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <div className="glass-card p-12 text-center text-dark-400">
              No schedules yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
