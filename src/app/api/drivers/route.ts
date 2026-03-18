import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providerId = (session.user as any).providerId
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER', providerId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      assignedSchedules: {
        where: { status: 'ACTIVE' },
        include: { route: true, bus: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(drivers)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, email, password } = body

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const providerId = (session.user as any).providerId

  const driver = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'DRIVER',
      providerId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  })

  return NextResponse.json(driver)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'PROVIDER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const providerId = (session.user as any).providerId
  const driver = await prisma.user.findFirst({
    where: { id, role: 'DRIVER', providerId },
  })
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  // Unassign from schedules first
  await prisma.schedule.updateMany({
    where: { driverId: id },
    data: { driverId: null },
  })

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
