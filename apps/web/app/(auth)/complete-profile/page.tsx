'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { AuthHeader } from '@/components/auth/auth-header'
import { useAuth } from '@/context/auth-context'
import { safeNextUrl } from '@/lib/auth-intent'
import { normalizePhone } from '@/lib/countries'
import PhoneField from '@/components/hotel/PhoneField'

const input =
  'h-[52px] w-full rounded-2xl border border-neutral-300 bg-white px-4 text-[17px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink focus:ring-1 focus:ring-ink disabled:opacity-60'

/**
 * "One more step" after Google sign-in: Google gives us a name and an email,
 * never a phone number — and a hotel cannot confirm a booking without one.
 */
function CompleteProfile() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = safeNextUrl(sp.get('next'), '/trips')
  const { user, isLoading, isAuthenticated, refreshSession } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState<'stay' | 'hotel'>(next.startsWith('/dashboard') ? 'hotel' : 'stay')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(next)}`)
      return
    }
    setName((n) => n || user?.name || '')
    setPhone((p) => p || user?.phone || '')
  }, [isLoading, isAuthenticated, user, router, next])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (name.trim().length < 3) return setErr('Enter your full name, as on your CNIC.')
    const mobile = normalizePhone(phone)
    if (!mobile) return setErr('Enter your mobile number — 0300 1234567 in Pakistan, or pick your country code.')
    setBusy(true)
    try {
      await api.patch('/users/me', { name: name.trim(), phone: mobile })
      await refreshSession().catch(() => undefined)
      toast.success('You are all set')
      router.replace(purpose === 'hotel' && !next.startsWith('/dashboard') ? '/dashboard/hotel' : next)
    } catch (error: any) {
      const m = error?.response?.data?.message
      setErr((Array.isArray(m) ? m[0] : m) || 'Could not save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5fc]">
      <AuthHeader />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-4 md:mt-6 md:rounded-[32px] md:bg-white md:p-9 md:ring-1 md:ring-[color:var(--border)]">
        <p className="text-[15px] font-medium text-neutral-500">Almost done</p>
        <h1 className="mt-1 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">One more step</h1>
        <p className="mt-1.5 text-[16px] text-neutral-500">Hotels confirm bookings by call or WhatsApp, so we need your mobile number. We never show it publicly.</p>

        {user?.email && (
          <div className="mt-6 flex items-center gap-3 rounded-full bg-white p-2 pr-5 ring-1 ring-[color:var(--border)] md:bg-[#f7f5fc] md:ring-0">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[16px] font-semibold text-white">{(user.name || user.email)[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{user.name || 'Your Google account'}</p>
              <p className="truncate text-[14px] text-neutral-500">{user.email}</p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Full name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Mobile number</span>
            <PhoneField value={phone} onChange={setPhone} />
          </label>
          <fieldset className="pt-1">
            <legend className="mb-2 text-[14px] font-medium text-neutral-600">I am here to</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['stay', 'Book stays'], ['hotel', 'List my hotel']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setPurpose(k)} className={`h-12 rounded-full border text-[16px] font-medium transition ${purpose === k ? 'border-ink bg-ink text-white' : 'border-neutral-300 bg-white text-ink'}`}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-700">{err}</p>}
          <button type="submit" disabled={busy || isLoading} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />} Continue
          </button>
        </form>
      </main>
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f5fc]" />}>
      <CompleteProfile />
    </Suspense>
  )
}
