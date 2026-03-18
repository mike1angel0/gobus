import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, role, providerName, contactEmail, contactPhone } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    let providerId: string | undefined
    if (role === 'PROVIDER') {
      if (!providerName || !contactEmail) {
        return NextResponse.json({ error: 'Provider details required' }, { status: 400 })
      }
      const provider = await prisma.provider.create({
        data: {
          name: providerName,
          contactEmail,
          contactPhone: contactPhone || null,
        },
      })
      providerId = provider.id
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'PASSENGER',
        providerId,
      },
    })

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
