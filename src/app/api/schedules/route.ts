import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(request.url)
  const scheduleId = searchParams.get('id')

  if (scheduleId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: {
          include: {
            provider: true,
            stops: { orderBy: { orderIndex: 'asc' } },
          },
        },
        bus: { include: { seats: true, tracking: true } },
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        delays: { orderBy: { createdAt: 'desc' } },
        bookings: { where: { status: 'CONFIRMED' } },
      },
    })
    return NextResponse.json(schedule)
  }

  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providerId = (session.user as any).providerId
  const schedules = await prisma.schedule.findMany({
    where: { route: { providerId } },
    include: {
      route: true,
      bus: true,
      driver: { select: { id: true, name: true, email: true } },
      stopTimes: { orderBy: { orderIndex: 'asc' } },
      bookings: { where: { status: 'CONFIRMED' } },
      delays: { where: { active: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(schedules)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { routeId, busId, departureTime, arrivalTime, daysOfWeek, basePrice, tripDate, stopTimes, driverId } = body

  const schedule = await prisma.schedule.create({
    data: {
      routeId,
      busId,
      departureTime,
      arrivalTime,
      daysOfWeek,
      basePrice,
      tripDate,
      driverId: driverId || null,
      stopTimes: {
        create: stopTimes.map((st: any, i: number) => ({
          stopName: st.stopName,
          arrivalTime: st.arrivalTime,
          departureTime: st.departureTime,
          orderIndex: i,
          priceFromStart: st.priceFromStart || 0,
        })),
      },
    },
    include: {
      route: true,
      bus: true,
      driver: { select: { id: true, name: true, email: true } },
      stopTimes: { orderBy: { orderIndex: 'asc' } },
    },
  })

  return NextResponse.json(schedule)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, driverId } = body

  if (!id) return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 })

  const schedule = await prisma.schedule.update({
    where: { id },
    data: { driverId: driverId || null },
    include: {
      route: true,
      bus: true,
      driver: { select: { id: true, name: true, email: true } },
      stopTimes: { orderBy: { orderIndex: 'asc' } },
    },
  })

  return NextResponse.json(schedule)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.schedule.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
  return NextResponse.json({ success: true })
}
