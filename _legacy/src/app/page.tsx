'use client'

import SearchForm from '@/components/SearchForm'

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-500/10" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary-400 via-primary-300 to-accent-400 bg-clip-text text-transparent">
                Travel Europe
              </span>
              <br />
              <span className="text-dark-200">by Bus</span>
            </h1>
            <p className="text-dark-400 text-lg sm:text-xl max-w-2xl mx-auto">
              Book your bus journey across Europe. Real-time tracking, seat selection, and instant booking.
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8">
            <SearchForm />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-12">
            {[
              { value: '8+', label: 'Routes' },
              { value: '15+', label: 'Daily Trips' },
              { value: '10+', label: 'Cities' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary-400">{stat.value}</p>
                <p className="text-dark-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Routes */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Popular Routes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { from: 'Bucharest', to: 'Vienna', price: '€45', time: '12h' },
            { from: 'Bucharest', to: 'Istanbul', price: '€50', time: '12h' },
            { from: 'Sofia', to: 'Budapest', price: '€35', time: '9h' },
            { from: 'Budapest', to: 'Prague', price: '€28', time: '6h' },
            { from: 'Berlin', to: 'Munich', price: '€32', time: '6h' },
            { from: 'Prague', to: 'Berlin', price: '€25', time: '4.5h' },
          ].map(route => (
            <div key={`${route.from}-${route.to}`} className="glass-card p-5 hover:border-primary-500/30 transition-all cursor-pointer group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white group-hover:text-primary-400 transition-colors">
                    {route.from} → {route.to}
                  </p>
                  <p className="text-dark-500 text-sm mt-1">{route.time} journey</p>
                </div>
                <p className="text-accent-400 font-bold text-lg">{route.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
