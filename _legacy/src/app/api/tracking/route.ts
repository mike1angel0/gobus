import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const busId = searchParams.get('busId')
  const providerId = searchParams.get('providerId')

  if (busId) {
    const tracking = await prisma.busTracking.findUnique({
      where: { busId },
    })
    return NextResponse.json(tracking)
  }

  if (providerId) {
    const tracking = await prisma.busTracking.findMany({
      where: {
        bus: { providerId },
        isActive: true,
      },
      include: {
        bus: {
          include: {
            schedules: {
              include: {
                route: true,
                stopTimes: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
        },
      },
    })
    return NextResponse.json(tracking)
  }

  return NextResponse.json({ error: 'busId or providerId required' }, { status: 400 })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'PROVIDER' && role !== 'DRIVER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { busId, latitude, longitude, speed, heading, scheduleId, currentStopIndex, isActive, tripDate } = body

  // For DRIVER: validate they are assigned to this schedule and the bus matches
  if (role === 'DRIVER') {
    const userId = (session.user as any).id
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, driverId: userId },
      include: { bus: true },
    })
    if (!schedule) {
      return NextResponse.json({ error: 'Not assigned to this schedule' }, { status: 403 })
    }
    if (schedule.busId !== busId) {
      return NextResponse.json({ error: 'Bus does not match schedule' }, { status: 403 })
    }
  }

  const tracking = await prisma.busTracking.upsert({
    where: { busId },
    update: {
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      scheduleId,
      currentStopIndex: currentStopIndex || 0,
      isActive: isActive ?? true,
      tripDate,
    },
    create: {
      busId,
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      scheduleId,
      currentStopIndex: currentStopIndex || 0,
      isActive: isActive ?? true,
      tripDate,
    },
  })

  return NextResponse.json(tracking)
}
