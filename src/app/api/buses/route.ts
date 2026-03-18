import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providerId = (session.user as any).providerId
  const buses = await prisma.bus.findMany({
    where: { providerId },
    include: { seats: true, tracking: true },
  })
  return NextResponse.json(buses)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { licensePlate, model, capacity, rows, columns, seats } = body
  const providerId = (session.user as any).providerId

  const bus = await prisma.bus.create({
    data: {
      licensePlate,
      model,
      capacity,
      rows,
      columns,
      providerId,
      seats: {
        create: seats.map((s: any) => ({
          row: s.row,
          column: s.column,
          label: s.label,
          type: s.type || 'STANDARD',
          price: s.price || 0,
        })),
      },
    },
    include: { seats: true },
  })

  return NextResponse.json(bus)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, licensePlate, model, capacity, rows, columns, seats } = body

  // Update bus and rebuild seats
  await prisma.seat.deleteMany({ where: { busId: id } })

  const bus = await prisma.bus.update({
    where: { id },
    data: {
      licensePlate,
      model,
      capacity,
      rows,
      columns,
      seats: {
        create: seats.map((s: any) => ({
          row: s.row,
          column: s.column,
          label: s.label,
          type: s.type || 'STANDARD',
          price: s.price || 0,
        })),
      },
    },
    include: { seats: true },
  })

  return NextResponse.json(bus)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.bus.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
