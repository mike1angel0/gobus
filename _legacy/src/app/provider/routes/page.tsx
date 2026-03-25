'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const cityCoords: Record<string, { latitude: number; longitude: number }> = {
  'Bucharest': { latitude: 44.4268, longitude: 26.1025 },
  'Vienna': { latitude: 48.2082, longitude: 16.3738 },
  'Budapest': { latitude: 47.4979, longitude: 19.0402 },
  'Sofia': { latitude: 42.6977, longitude: 23.3219 },
  'Istanbul': { latitude: 41.0082, longitude: 28.9784 },
  'Prague': { latitude: 50.0755, longitude: 14.4378 },
  'Berlin': { latitude: 52.5200, longitude: 13.4050 },
  'Munich': { latitude: 48.1351, longitude: 11.5820 },
  'Belgrade': { latitude: 44.7866, longitude: 20.4489 },
  'Bratislava': { latitude: 48.1486, longitude: 17.1077 },
  'Timisoara': { latitude: 45.7489, longitude: 21.2087 },
  'Cluj-Napoca': { latitude: 46.7712, longitude: 23.6236 },
  'Sibiu': { latitude: 45.7983, longitude: 24.1256 },
  'Plovdiv': { latitude: 42.1354, longitude: 24.7453 },
  'Nuremberg': { latitude: 49.4521, longitude: 11.0767 },
}

export default function ProviderRoutes() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [stops, setStops] = useState<{ name: string; latitude: number; longitude: number }[]>([
    { name: '', latitude: 0, longitude: 0 },
    { name: '', latitude: 0, longitude: 0 },
  ])

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') fetchRoutes()
  }, [status])

  const fetchRoutes = async () => {
    const res = await fetch('/api/routes')
    const data = await res.json()
    setRoutes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const addStop = () => setStops([...stops, { name: '', latitude: 0, longitude: 0 }])
  const removeStop = (i: number) => {
    if (stops.length <= 2) return
    setStops(stops.filter((_, idx) => idx !== i))
  }

  const updateStop = (i: number, cityName: string) => {
    const coords = cityCoords[cityName] || { latitude: 0, longitude: 0 }
    setStops(stops.map((s, idx) => idx === i ? { name: cityName, ...coords } : s))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || stops.some(s => !s.name)) {
      toast.error('Fill in all fields')
      return
    }

    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stops }),
    })

    if (res.ok) {
      toast.success('Route created')
      setShowForm(false)
      setName('')
      setStops([{ name: '', latitude: 0, longitude: 0 }, { name: '', latitude: 0, longitude: 0 }])
      fetchRoutes()
    } else {
      toast.error('Failed to create route')
    }
  }

  const deleteRoute = async (id: string) => {
    if (!confirm('Delete this route?')) return
    const res = await fetch(`/api/routes?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Route deleted')
      fetchRoutes()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Routes</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Route'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6 space-y-4">
          <div>
            <label className="block text-dark-400 text-sm mb-1.5">Route Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. Bucharest → Vienna"
              required
            />
          </div>

          <div>
            <label className="block text-dark-400 text-sm mb-2">Stops</label>
            <div className="space-y-2">
              {stops.map((stop, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-dark-500 text-sm w-6">{i + 1}.</span>
                  <select
                    value={stop.name}
                    onChange={e => updateStop(i, e.target.value)}
                    className="input-field flex-1"
                    required
                  >
                    <option value="">Select city</option>
                    {Object.keys(cityCoords).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {stops.length > 2 && (
                    <button type="button" onClick={() => removeStop(i)} className="text-red-400 hover:text-red-300 p-1">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addStop} className="text-primary-400 hover:text-primary-300 text-sm mt-2">
              + Add Stop
            </button>
          </div>

          <button type="submit" className="btn-accent w-full">Create Route</button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="glass-card p-12 text-center text-dark-400">
          No routes yet. Create your first route above.
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map(route => (
            <div key={route.id} className="glass-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{route.name}</h3>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {route.stops?.map((stop: any, i: number) => (
                      <div key={stop.id} className="flex items-center">
                        <span className="text-sm text-dark-300">{stop.name}</span>
                        {i < route.stops.length - 1 && <span className="text-dark-500 mx-1">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteRoute(route.id)} className="text-dark-500 hover:text-red-400 text-sm">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
