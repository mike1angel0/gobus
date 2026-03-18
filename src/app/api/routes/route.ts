import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    // Public: return all routes
    const routes = await prisma.route.findMany({
      include: { stops: { orderBy: { orderIndex: 'asc' } }, provider: true },
    })
    return NextResponse.json(routes)
  }

  const providerId = (session.user as any).providerId
  const routes = await prisma.route.findMany({
    where: { providerId },
    include: { stops: { orderBy: { orderIndex: 'asc' } } },
  })
  return NextResponse.json(routes)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, stops } = body
  const providerId = (session.user as any).providerId

  if (!name || !stops || stops.length < 2) {
    return NextResponse.json({ error: 'Route name and at least 2 stops required' }, { status: 400 })
  }

  const route = await prisma.route.create({
    data: {
      name,
      providerId,
      stops: {
        create: stops.map((s: any, i: number) => ({
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          orderIndex: i,
        })),
      },
    },
    include: { stops: { orderBy: { orderIndex: 'asc' } } },
  })

  return NextResponse.json(route)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.route.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
