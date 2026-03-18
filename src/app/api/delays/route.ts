import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scheduleId = searchParams.get('scheduleId')
  const tripDate = searchParams.get('tripDate')

  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })
  }

  const delays = await prisma.delay.findMany({
    where: {
      scheduleId,
      ...(tripDate ? { tripDate } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(delays)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { scheduleId, offsetMinutes, reason, note, tripDate } = body

  // Deactivate previous delays for this trip
  await prisma.delay.updateMany({
    where: { scheduleId, tripDate, active: true },
    data: { active: false },
  })

  const delay = await prisma.delay.create({
    data: {
      scheduleId,
      offsetMinutes,
      reason,
      note,
      tripDate,
      active: true,
    },
  })

  return NextResponse.json(delay)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, active } = body

  const delay = await prisma.delay.update({
    where: { id },
    data: { active },
  })

  return NextResponse.json(delay)
}
