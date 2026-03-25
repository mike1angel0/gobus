'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import LiveMap from '@/components/LiveMap'
import DelayBadge from '@/components/DelayBadge'
import { interpolatePosition, calculateDistance } from '@/lib/utils'

export default function TrackingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [buses, setBuses] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [tracking, setTracking] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBus, setSelectedBus] = useState<string | null>(null)
  const [simulating, setSimulating] = useState<Record<string, boolean>>({})
  const simulationRefs = useRef<Record<string, NodeJS.Timeout>>({})

  // Delay form
  const [delayScheduleId, setDelayScheduleId] = useState('')
  const [delayMinutes, setDelayMinutes] = useState(15)
  const [delayReason, setDelayReason] = useState('TRAFFIC')
  const [delayNote, setDelayNote] = useState('')
  const [showDelayForm, setShowDelayForm] = useState(false)

  const providerId = (session?.user as any)?.providerId

  const fetchData = useCallback(async () => {
    if (!providerId) return
    try {
      const [busesRes, schedulesRes, trackingRes] = await Promise.all([
        fetch('/api/buses').then(r => r.json()),
        fetch('/api/schedules').then(r => r.json()),
        fetch(`/api/tracking?providerId=${providerId}`).then(r => r.json()),
      ])
      setBuses(Array.isArray(busesRes) ? busesRes : [])
      setSchedules(Array.isArray(schedulesRes) ? schedulesRes : [])
      setTracking(Array.isArray(trackingRes) ? trackingRes : [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [providerId])

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') {
      fetchData()
      const interval = setInterval(fetchData, 5000)
      return () => clearInterval(interval)
    }
  }, [status, fetchData])

  // Clean up simulations on unmount
  useEffect(() => {
    return () => {
      Object.values(simulationRefs.current).forEach(clearInterval)
    }
  }, [])

  const updatePosition = async (busId: string, lat: number, lng: number, scheduleId?: string, stopIdx?: number, active?: boolean) => {
    const today = new Date().toISOString().split('T')[0]
    await fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        busId,
        latitude: lat,
        longitude: lng,
        speed: 80,
        heading: 0,
        scheduleId,
        currentStopIndex: stopIdx || 0,
        isActive: active ?? true,
        tripDate: today,
      }),
    })
  }

  const startSimulation = (busId: string, scheduleId: string) => {
    const schedule = schedules.find((s: any) => s.id === scheduleId)
    if (!schedule || !schedule.route) {
      toast.error('Schedule not found')
      return
    }

    const stops = schedule.stopTimes?.sort((a: any, b: any) => a.orderIndex - b.orderIndex) || []
    const routeStops = schedule.route?.stops?.sort((a: any, b: any) => a.orderIndex - b.orderIndex) || []

    if (routeStops.length < 2) {
      toast.error('Route needs at least 2 stops')
      return
    }

    // Build waypoints from route stops
    const waypoints = routeStops.map((s: any) => ({ lat: s.latitude, lng: s.longitude, name: s.name }))

    setSimulating(prev => ({ ...prev, [busId]: true }))

    let step = 0
    const totalSteps = 100 * (waypoints.length - 1) // 100 steps per segment

    const interval = setInterval(async () => {
      if (step >= totalSteps) {
        clearInterval(interval)
        delete simulationRefs.current[busId]
        setSimulating(prev => ({ ...prev, [busId]: false }))
        await updatePosition(busId, waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng, scheduleId, waypoints.length - 1, false)
        toast.success(`Bus ${busId.slice(0, 8)} arrived at destination`)
        fetchData()
        return
      }

      const segmentIndex = Math.floor(step / 100)
      const segmentFraction = (step % 100) / 100

      const pos = interpolatePosition(
        waypoints[segmentIndex],
        waypoints[Math.min(segmentIndex + 1, waypoints.length - 1)],
        segmentFraction
      )

      await updatePosition(busId, pos.lat, pos.lng, scheduleId, segmentIndex, true)
      step += 1
    }, 500) // Move every 500ms

    simulationRefs.current[busId] = interval
    toast.success('Simulation started')
  }

  const stopSimulation = (busId: string) => {
    if (simulationRefs.current[busId]) {
      clearInterval(simulationRefs.current[busId])
      delete simulationRefs.current[busId]
    }
    setSimulating(prev => ({ ...prev, [busId]: false }))
    toast.success('Simulation stopped')
  }

  const handleDelay = async (e: React.FormEvent) => {
    e.preventDefault()
    const today = new Date().toISOString().split('T')[0]

    const res = await fetch('/api/delays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: delayScheduleId,
        offsetMinutes: delayMinutes,
        reason: delayReason,
        note: delayNote || null,
        tripDate: today,
      }),
    })

    if (res.ok) {
      toast.success(`Delay of +${delayMinutes}min applied`)
      setShowDelayForm(false)
      setDelayNote('')
      fetchData()
    } else {
      toast.error('Failed to apply delay')
    }
  }

  // Collect all stops from all routes for the map
  const allStops = schedules.flatMap((s: any) =>
    s.route?.stops?.map((st: any) => ({
      id: st.id,
      name: st.name,
      latitude: st.latitude || st.lat,
      longitude: st.longitude || st.lng,
      orderIndex: st.orderIndex,
    })) || []
  )

  // Deduplicate stops by name
  const uniqueStops = allStops.filter((s: any, i: number, arr: any[]) =>
    arr.findIndex((x: any) => x.name === s.name) === i
  )

  // Active bus tracking
  const activeTracking = tracking.filter((t: any) => t.isActive)

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-dark-700 rounded w-1/3 mb-4" />
          <div className="h-[400px] bg-dark-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Live Tracking & Delay Management</h1>

      {/* Map showing all active buses */}
      <div className="glass-card p-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Fleet Overview ({activeTracking.length} active)</h2>
        <LiveMap
          stops={uniqueStops}
          tracking={selectedBus ? activeTracking.find((t: any) => t.busId === selectedBus) : activeTracking[0]}
          height="400px"
          zoom={5}
          center={[46.0, 20.0]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bus list with controls */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Buses</h2>
          {buses.map((bus: any) => {
            const busTracking = tracking.find((t: any) => t.busId === bus.id)
            const busSchedules = schedules.filter((s: any) => s.busId === bus.id && s.status === 'ACTIVE')
            const isSimulating = simulating[bus.id]

            return (
              <div
                key={bus.id}
                className={`glass-card p-4 cursor-pointer transition-all ${selectedBus === bus.id ? 'border-primary-500/50' : ''}`}
                onClick={() => setSelectedBus(bus.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold">{bus.model}</h3>
                    <p className="text-dark-400 text-sm">{bus.licensePlate}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    busTracking?.isActive ? 'bg-accent-500/20 text-accent-400' : 'bg-dark-600 text-dark-400'
                  }`}>
                    {busTracking?.isActive ? 'Active' : 'Idle'}
                  </span>
                </div>

                {busTracking?.isActive && (
                  <p className="text-dark-500 text-xs mb-2">
                    Position: {busTracking.latitude.toFixed(4)}, {busTracking.longitude.toFixed(4)}
                  </p>
                )}

                {/* Simulation controls */}
                {busSchedules.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {busSchedules.map((sched: any) => (
                      <div key={sched.id} className="flex items-center justify-between bg-dark-900/50 rounded-lg p-2">
                        <span className="text-xs text-dark-300">{sched.route?.name} ({sched.departureTime})</span>
                        <div className="flex gap-1">
                          {isSimulating ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); stopSimulation(bus.id) }}
                              className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30"
                            >
                              Stop
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); startSimulation(bus.id, sched.id) }}
                              className="text-xs bg-accent-500/20 text-accent-400 px-2 py-1 rounded hover:bg-accent-500/30"
                            >
                              Simulate Trip
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Delay management */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Delay Management</h2>
            <button onClick={() => setShowDelayForm(!showDelayForm)} className="btn-secondary text-sm">
              {showDelayForm ? 'Cancel' : '+ Report Delay'}
            </button>
          </div>

          {showDelayForm && (
            <form onSubmit={handleDelay} className="glass-card p-4 space-y-3">
              <div>
                <label className="block text-dark-400 text-sm mb-1">Schedule</label>
                <select
                  value={delayScheduleId}
                  onChange={e => setDelayScheduleId(e.target.value)}
                  className="input-field w-full text-sm"
                  required
                >
                  <option value="">Select schedule</option>
                  {schedules.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.route?.name} — {s.departureTime} ({s.tripDate})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-dark-400 text-sm mb-1">Delay (min)</label>
                  <input
                    type="number"
                    value={delayMinutes}
                    onChange={e => setDelayMinutes(Number(e.target.value))}
                    className="input-field w-full text-sm"
                    min={1}
                    max={300}
                  />
                </div>
                <div>
                  <label className="block text-dark-400 text-sm mb-1">Reason</label>
                  <select value={delayReason} onChange={e => setDelayReason(e.target.value)} className="input-field w-full text-sm">
                    <option value="TRAFFIC">Traffic</option>
                    <option value="MECHANICAL">Mechanical</option>
                    <option value="WEATHER">Weather</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-dark-400 text-sm mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={delayNote}
                  onChange={e => setDelayNote(e.target.value)}
                  className="input-field w-full text-sm"
                  placeholder="Additional details..."
                />
              </div>
              <button type="submit" className="btn-primary w-full text-sm">Apply Delay</button>
            </form>
          )}

          {/* Active delays */}
          <div className="space-y-2">
            {schedules
              .filter((s: any) => s.delays?.length > 0)
              .map((s: any) => {
                const activeDelay = s.delays.find((d: any) => d.active)
                if (!activeDelay) return null
                return (
                  <div key={s.id} className="glass-card p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{s.route?.name}</p>
                        <p className="text-dark-500 text-xs">{s.departureTime} - {s.arrivalTime} • {s.tripDate}</p>
                      </div>
                      <DelayBadge
                        offsetMinutes={activeDelay.offsetMinutes}
                        reason={activeDelay.reason}
                        showReason
                      />
                    </div>
                    {activeDelay.note && (
                      <p className="text-dark-400 text-xs mt-2 italic">{activeDelay.note}</p>
                    )}
                    <button
                      onClick={async () => {
                        await fetch('/api/delays', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: activeDelay.id, active: false }),
                        })
                        toast.success('Delay resolved')
                        fetchData()
                      }}
                      className="text-xs text-accent-400 hover:text-accent-300 mt-2"
                    >
                      Mark as Resolved
                    </button>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
