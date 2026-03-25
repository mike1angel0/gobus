'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const cities = [
  'Bucharest', 'Vienna', 'Budapest', 'Sofia', 'Istanbul',
  'Prague', 'Berlin', 'Munich', 'Belgrade', 'Bratislava',
  'Timisoara', 'Cluj-Napoca', 'Sibiu', 'Plovdiv', 'Nuremberg',
]

interface SearchFormProps {
  initialOrigin?: string
  initialDestination?: string
  initialDate?: string
  compact?: boolean
}

export default function SearchForm({ initialOrigin = '', initialDestination = '', initialDate = '', compact = false }: SearchFormProps) {
  const router = useRouter()
  const [origin, setOrigin] = useState(initialOrigin)
  const [destination, setDestination] = useState(initialDestination)
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!origin || !destination) return
    router.push(`/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}`)
  }

  const swapCities = () => {
    setOrigin(destination)
    setDestination(origin)
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'flex flex-wrap gap-3 items-end' : 'space-y-4'}>
      <div className={compact ? 'flex items-end gap-2 flex-1 min-w-[300px]' : 'grid grid-cols-1 md:grid-cols-2 gap-4 relative'}>
        <div className={compact ? 'flex-1' : ''}>
          <label className="block text-dark-400 text-sm mb-1.5">From</label>
          <select
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            className="input-field w-full"
            required
          >
            <option value="">Select origin</option>
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {!compact && (
          <button
            type="button"
            onClick={swapCities}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-dark-700 border border-dark-600 rounded-full w-10 h-10 flex items-center justify-center hover:bg-dark-600 transition-colors hidden md:flex"
          >
            ⇄
          </button>
        )}

        <div className={compact ? 'flex-1' : ''}>
          <label className="block text-dark-400 text-sm mb-1.5">To</label>
          <select
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="input-field w-full"
            required
          >
            <option value="">Select destination</option>
            {cities.filter(c => c !== origin).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={compact ? 'w-44' : ''}>
        <label className="block text-dark-400 text-sm mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input-field w-full"
          min={new Date().toISOString().split('T')[0]}
          required
        />
      </div>

      <button type="submit" className={`btn-primary ${compact ? 'h-[42px]' : 'w-full py-3 text-lg'}`}>
        {compact ? 'Search' : 'Search Buses'}
      </button>
    </form>
  )
}
