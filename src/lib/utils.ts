export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatTime(time: string): string {
  return time
}

export function getDelayStatus(offsetMinutes: number): 'on-time' | 'minor' | 'major' {
  if (offsetMinutes <= 0) return 'on-time'
  if (offsetMinutes <= 15) return 'minor'
  return 'major'
}

export function getDelayColor(offsetMinutes: number): string {
  const status = getDelayStatus(offsetMinutes)
  switch (status) {
    case 'on-time': return 'text-green-500'
    case 'minor': return 'text-yellow-500'
    case 'major': return 'text-red-500'
  }
}

export function getDelayBgColor(offsetMinutes: number): string {
  const status = getDelayStatus(offsetMinutes)
  switch (status) {
    case 'on-time': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'minor': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'major': return 'bg-red-500/20 text-red-400 border-red-500/30'
  }
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const totalMinutes = h * 60 + m + minutes
  const newH = Math.floor(totalMinutes / 60) % 24
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

export function interpolatePosition(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  fraction: number
): { lat: number; lng: number } {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  }
}

export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatPrice(price: number): string {
  return `€${price.toFixed(2)}`
}

export function getDayName(day: number): string {
  const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return days[day] || ''
}
