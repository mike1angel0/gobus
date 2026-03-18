'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DriversPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated' || (session && (session.user as any).role !== 'PROVIDER')) {
      router.push('/')
      return
    }
    if (status === 'authenticated') fetchDrivers()
  }, [status])

  const fetchDrivers = async () => {
    const res = await fetch('/api/drivers')
    const data = await res.json()
    setDrivers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (res.ok) {
      toast.success('Driver created')
      setShowForm(false)
      setName('')
      setEmail('')
      setPassword('')
      fetchDrivers()
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to create driver')
    }
  }

  const deleteDriver = async (id: string) => {
    if (!confirm('Delete this driver?')) return
    const res = await fetch(`/api/drivers?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Driver deleted')
      fetchDrivers()
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Drivers</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add Driver'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">New Driver</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field w-full" required minLength={6} />
            </div>
          </div>
          <button type="submit" className="btn-accent w-full">Create Driver</button>
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
      ) : drivers.length === 0 ? (
        <div className="glass-card p-12 text-center text-dark-400">
          No drivers yet. Add your first driver above.
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map(driver => (
            <div key={driver.id} className="glass-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{driver.name}</h3>
                  <p className="text-dark-400 text-sm">{driver.email}</p>
                  {driver.assignedSchedules?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {driver.assignedSchedules.map((s: any) => (
                        <p key={s.id} className="text-xs text-dark-500">
                          {s.route?.name} • {s.departureTime}–{s.arrivalTime} • {s.bus?.model}
                        </p>
                      ))}
                    </div>
                  )}
                  {(!driver.assignedSchedules || driver.assignedSchedules.length === 0) && (
                    <p className="text-xs text-dark-500 mt-1">No active schedules</p>
                  )}
                </div>
                <button onClick={() => deleteDriver(driver.id)} className="text-dark-500 hover:text-red-400 text-sm">
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
