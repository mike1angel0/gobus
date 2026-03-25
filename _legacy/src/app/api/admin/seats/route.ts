import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { seatId, isEnabled } = await request.json()

  if (!seatId || typeof isEnabled !== 'boolean') {
    return NextResponse.json({ error: 'seatId and isEnabled required' }, { status: 400 })
  }

  const seat = await prisma.seat.update({
    where: { id: seatId },
    data: { isEnabled },
  })

  return NextResponse.json(seat)
}
