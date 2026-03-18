'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import SearchForm from '@/components/SearchForm'
import TripCard from '@/components/TripCard'
import type { SearchResult } from '@/types'

function SearchContent() {
  const searchParams = useSearchParams()
  const origin = searchParams.get('origin') || ''
  const destination = searchParams.get('destination') || ''
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!origin || !destination) return

    const fetchResults = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      }
      setLoading(false)
    }

    fetchResults()

    // Poll for updates every 15s
    const interval = setInterval(fetchResults, 15000)
    return () => clearInterval(interval)
  }, [origin, destination, date])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="glass-card p-4 mb-8">
        <SearchForm
          initialOrigin={origin}
          initialDestination={destination}
          initialDate={date}
          compact
        />
      </div>

      <h2 className="text-xl font-bold mb-4">
        {origin && destination ? (
          <>
            {origin} → {destination}
            <span className="text-dark-400 font-normal text-base ml-2">{date}</span>
          </>
        ) : (
          'Search for routes'
        )}
      </h2>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-6 bg-dark-700 rounded w-1/3 mb-3" />
              <div className="h-8 bg-dark-700 rounded w-2/3 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-dark-400 text-lg">No trips found for this route and date.</p>
          <p className="text-dark-500 text-sm mt-2">Try a different date or route.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map(trip => (
            <TripCard key={trip.scheduleId} trip={trip} date={date} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8"><div className="glass-card p-12 text-center text-dark-400">Loading...</div></div>}>
      <SearchContent />
    </Suspense>
  )
}
