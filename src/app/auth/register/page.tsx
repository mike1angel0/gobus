'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'PASSENGER',
    providerName: '',
    contactEmail: '',
    contactPhone: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Auto sign in
      await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })

      toast.success('Account created!')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('Registration failed')
      setLoading(false)
    }
  }

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-dark-900/80 rounded-lg">
            {['PASSENGER', 'PROVIDER'].map(role => (
              <button
                key={role}
                type="button"
                onClick={() => update('role', role)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  form.role === role
                    ? 'bg-primary-500 text-white shadow'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                {role === 'PASSENGER' ? 'Passenger' : 'Bus Provider'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-dark-400 text-sm mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              className="input-field w-full"
              minLength={6}
              required
            />
          </div>

          {form.role === 'PROVIDER' && (
            <>
              <hr className="border-dark-700" />
              <div>
                <label className="block text-dark-400 text-sm mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={form.providerName}
                  onChange={e => update('providerName', e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-400 text-sm mb-1.5">Company Email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={e => update('contactEmail', e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-400 text-sm mb-1.5">Phone (optional)</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={e => update('contactPhone', e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-dark-400 text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary-400 hover:text-primary-300">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
