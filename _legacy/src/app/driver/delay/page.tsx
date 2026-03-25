'use client'

import { useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

function DelayForm() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId') || ''
  const tripDate = searchParams.get('tripDate') || new Date().toISOString().split('T')[0]

  const [reason, setReason] = useState('TRAFFIC')
  const [offsetMinutes, setOffsetMinutes] = useState(10)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const presets = [5, 10, 15, 20, 30, 45, 60]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleId) {
      toast.error('Missing schedule ID')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/delays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, offsetMinutes, reason, note: note || undefined, tripDate }),
    })

    if (res.ok) {
      toast.success('Delay reported')
      router.back()
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to report delay')
    }
    setSubmitting(false)
  }

  if ((session?.user as any)?.role !== 'DRIVER') {
    return null
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Report Delay</h1>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div>
          <label className="block text-dark-400 text-sm mb-2">Reason</label>
          <div className="grid grid-cols-2 gap-2">
            {['TRAFFIC', 'MECHANICAL', 'WEATHER', 'OTHER'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                  reason === r
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/50'
                    : 'bg-dark-700/50 text-dark-400 border border-dark-700 hover:border-dark-600'
                }`}
              >
                {r === 'TRAFFIC' ? 'Traffic' : r === 'MECHANICAL' ? 'Mechanical' : r === 'WEATHER' ? 'Weather' : 'Other'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-dark-400 text-sm mb-2">Delay (minutes)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {presets.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setOffsetMinutes(p)}
                className={`py-1.5 px-3 rounded-lg text-sm transition-colors ${
                  offsetMinutes === p
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/50'
                    : 'bg-dark-700/50 text-dark-400 border border-dark-700'
                }`}
              >
                +{p}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={offsetMinutes}
            onChange={e => setOffsetMinutes(Number(e.target.value))}
            className="input-field w-full"
            min={1}
            max={240}
          />
        </div>

        <div>
          <label className="block text-dark-400 text-sm mb-1.5">Note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input-field w-full"
            rows={3}
            placeholder="Any additional details..."
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-accent w-full">
          {submitting ? 'Submitting...' : 'Report Delay'}
        </button>
      </form>
    </div>
  )
}

export default function DriverDelayPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-6"><div className="glass-card p-6 animate-pulse"><div className="h-6 bg-dark-700 rounded w-1/3" /></div></div>}>
      <DelayForm />
    </Suspense>
  )
}
