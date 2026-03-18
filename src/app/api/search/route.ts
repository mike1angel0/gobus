import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  const date = searchParams.get('date')

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 })
  }

  try {
    // Find schedules whose routes contain both origin and destination in order
    const schedules = await prisma.schedule.findMany({
      where: {
        ...(date ? { tripDate: date } : {}),
        status: 'ACTIVE',
        route: {
          stops: {
            some: { name: origin },
          },
        },
      },
      include: {
        route: {
          include: {
            provider: true,
            stops: { orderBy: { orderIndex: 'asc' } },
          },
        },
        bus: {
          include: {
            seats: true,
          },
        },
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        delays: {
          where: {
            active: true,
            ...(date ? { tripDate: date } : {}),
          },
        },
        bookings: {
          where: {
            status: 'CONFIRMED',
            ...(date ? { tripDate: date } : {}),
          },
        },
      },
    })

    // Filter: route must have origin before destination
    const results = schedules
      .filter(s => {
        const stops = s.route.stops
        const originIdx = stops.findIndex(st => st.name === origin)
        const destIdx = stops.findIndex(st => st.name === destination)
        return originIdx >= 0 && destIdx >= 0 && originIdx < destIdx
      })
      .map(s => {
        const stops = s.route.stops
        const originStop = s.stopTimes.find(st => st.stopName === origin)
        const destStop = s.stopTimes.find(st => st.stopName === destination)

        const occupiedSeats = new Set<string>()
        s.bookings.forEach(b => {
          b.seatLabels.split(',').forEach(l => occupiedSeats.add(l.trim()))
        })

        const availableSeats = s.bus.seats.filter(
          seat => seat.type !== 'BLOCKED' && !occupiedSeats.has(seat.label)
        ).length
        const totalSeats = s.bus.seats.filter(seat => seat.type !== 'BLOCKED').length

        const originPrice = originStop?.priceFromStart || 0
        const destPrice = destStop?.priceFromStart || s.basePrice
        const price = destPrice - originPrice

        const latestDelay = s.delays.length > 0 ? s.delays[s.delays.length - 1] : null

        return {
          scheduleId: s.id,
          providerName: s.route.provider.name,
          providerLogo: s.route.provider.logo,
          routeName: s.route.name,
          origin,
          destination,
          departureTime: originStop?.departureTime || s.departureTime,
          arrivalTime: destStop?.arrivalTime || s.arrivalTime,
          price,
          availableSeats,
          totalSeats,
          delay: latestDelay ? {
            id: latestDelay.id,
            offsetMinutes: latestDelay.offsetMinutes,
            reason: latestDelay.reason,
            note: latestDelay.note || undefined,
            active: latestDelay.active,
            tripDate: latestDelay.tripDate,
          } : undefined,
          stops: s.stopTimes.map(st => ({
            id: st.id,
            stopName: st.stopName,
            arrivalTime: st.arrivalTime,
            departureTime: st.departureTime,
            orderIndex: st.orderIndex,
            priceFromStart: st.priceFromStart,
          })),
        }
      })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
