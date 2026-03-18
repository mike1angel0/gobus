export interface SeatData {
  id: string
  row: number
  column: number
  label: string
  type: 'STANDARD' | 'PREMIUM' | 'DISABLED_ACCESSIBLE' | 'BLOCKED'
  price: number
  isOccupied?: boolean
  isSelected?: boolean
}

export interface StopData {
  id: string
  name: string
  latitude: number
  longitude: number
  orderIndex: number
}

export interface StopTimeData {
  id: string
  stopName: string
  arrivalTime: string
  departureTime: string
  orderIndex: number
  priceFromStart: number
}

export interface DelayData {
  id: string
  offsetMinutes: number
  reason: string
  note?: string
  active: boolean
  tripDate: string
}

export interface TrackingData {
  busId: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  currentStopIndex: number
  isActive: boolean
  scheduleId?: string
}

export interface SearchResult {
  scheduleId: string
  providerName: string
  providerLogo?: string
  routeName: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  price: number
  availableSeats: number
  totalSeats: number
  delay?: DelayData
  stops: StopTimeData[]
}

export interface BookingData {
  id: string
  scheduleId: string
  seatLabels: string[]
  totalPrice: number
  status: string
  boardingStop: string
  alightingStop: string
  tripDate: string
  schedule: {
    departureTime: string
    arrivalTime: string
    route: {
      name: string
      stops: StopData[]
    }
    bus: {
      id: string
      model: string
      licensePlate: string
    }
    stopTimes: StopTimeData[]
    delays: DelayData[]
  }
}
