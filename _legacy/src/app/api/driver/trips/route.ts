import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'DRIVER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  const schedules = await prisma.schedule.findMany({
    where: {
      driverId: userId,
      status: 'ACTIVE',
      ...(date ? { tripDate: date } : {}),
    },
    include: {
      route: {
        include: {
          stops: { orderBy: { orderIndex: 'asc' } },
        },
      },
      bus: { include: { tracking: true } },
      stopTimes: { orderBy: { orderIndex: 'asc' } },
      bookings: { where: { status: 'CONFIRMED' } },
      delays: { where: { active: true } },
    },
    orderBy: { departureTime: 'asc' },
  })

  return NextResponse.json(schedules)
}
