import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      schedule: {
        include: {
          route: {
            include: {
              stops: { orderBy: { orderIndex: 'asc' } },
            },
          },
          bus: { include: { tracking: true } },
          stopTimes: { orderBy: { orderIndex: 'asc' } },
          delays: { where: { active: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(bookings)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { scheduleId, seatLabels, totalPrice, boardingStop, alightingStop, tripDate } = body
  const userId = (session.user as any).id

  // Check seats aren't already booked
  const existingBookings = await prisma.booking.findMany({
    where: {
      scheduleId,
      tripDate,
      status: 'CONFIRMED',
    },
  })

  const occupiedSeats = new Set<string>()
  existingBookings.forEach(b => {
    b.seatLabels.split(',').forEach(l => occupiedSeats.add(l.trim()))
  })

  const requestedSeats = seatLabels as string[]
  const conflict = requestedSeats.find(s => occupiedSeats.has(s))
  if (conflict) {
    return NextResponse.json({ error: `Seat ${conflict} is already booked` }, { status: 409 })
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      scheduleId,
      seatLabels: requestedSeats.join(','),
      totalPrice,
      boardingStop,
      alightingStop,
      tripDate,
    },
  })

  return NextResponse.json(booking)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
  return NextResponse.json({ success: true })
}
