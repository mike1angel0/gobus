export interface SeatData {
  id: string
  row: number
  column: number
  label: string
  type: 'STANDARD' | 'PREMIUM' | 'DISABLED_ACCESSIBLE' | 'BLOCKED'
  price: number
  isEnabled?: boolean
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

export interface DriverData {
  id: string
  name: string
  email: string
  createdAt?: string
  assignedSchedules?: {
    id: string
    route: { name: string }
    bus: { model: string; licensePlate: string }
    departureTime: string
    arrivalTime: string
    tripDate?: string
  }[]
}

export interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  emergencyContact?: string
  notificationPrefs?: string
  role: string
  provider?: {
    id: string
    name: string
  }
}

export interface MessageData {
  id: string
  senderId: string
  receiverId: string
  content: string
  read: boolean
  createdAt: string
  sender: { id: string; name: string }
  receiver: { id: string; name: string }
}

export interface DriverPerformance {
  id: string
  name: string
  trips: number
  onTimeRate: number
  avgDelay: number
  status: string
}

export interface AdminStats {
  totalProviders: number
  totalUsers: number
  totalBookings: number
  totalRevenue: number
}

export interface ProviderSummary {
  id: string
  name: string
  contactEmail: string
  status: string
  routeCount: number
  busCount: number
  userCount: number
}

export interface ActivityItem {
  id: string
  type: string
  description: string
  timestamp: string
}

export interface BusTemplate {
  id: string
  name: string
  category: 'coach' | 'minibus' | 'microbus'
  rows: number
  columns: number
  description: string
  seatTypes: Record<string, string>
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
