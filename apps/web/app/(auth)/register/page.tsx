'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthHeader } from '@/components/auth/auth-header'
import { GoogleButton } from '@/components/auth/google-button'
import { useAuth } from '@/context/auth-context'
import { safeNextUrl } from '@/lib/auth-intent'
import { normalizePhone } from '@/lib/countries'
import PhoneField from '@/components/hotel/PhoneField'

export const dynamic = 'force-dynamic'

const input =
  'h-[50px] w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[17px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink focus:ring-1 focus:ring-ink disabled:opacity-60'

/** Sign-up for guests and hotel owners alike: a hotel account starts when you add your hotel. */
function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const forHotel = next?.startsWith('/dashboard')
  const { registerAndSignIn } = useAuth()
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const email = f.email.trim().toLowerCase()
    if (f.name.trim().length < 3) return setErr('Enter your full name.')
    if (!normalizePhone(f.phone)) return setErr('Enter your mobile number — 0300 1234567 in Pakistan, or pick your country code.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Enter a valid email address.')
    if (f.password.length < 6) return setErr('Password needs at least 6 characters.')
    setBusy(true)
    try {
      await registerAndSignIn({ name: f.name.trim(), email, password: f.password, phone: normalizePhone(f.phone) })
      toast.success('Your account is ready')
      router.replace(safeNextUrl(next ?? '/trips'))
      router.refresh()
    } catch (error) {
      const r = (error as { response?: { status?: number; data?: { message?: string | string[] } } }).response
      if (r?.status === 409) {
        router.push(`/login?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ''}`)
        toast('You already have an account. Enter your password to sign in.')
        return
      }
      if (r?.status === 429) return setErr('Too many tries. Wait a minute and try again.')
      const m = r?.data?.message
      setErr((Array.isArray(m) ? m[0] : m) || 'Could not create your account. Check your details and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5fc]">
      <AuthHeader />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-4 md:mt-6 md:rounded-[32px] md:bg-white md:p-9 md:ring-1 md:ring-[color:var(--border)]">
        <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">{forHotel ? 'Create your hotel account' : 'Create your account'}</h1>
        <p className="mt-1.5 text-[16px] text-neutral-500">
          {forHotel ? 'Then add your hotel and rooms. Free to list.' : 'Book in a minute and keep every trip in one place.'}
        </p>
        <div className="mt-6">
          <GoogleButton label="Continue with Google" next={next} disabled={busy} />
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Full name</span>
            <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Mobile number</span>
            <PhoneField value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Email</span>
            <input className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Password</span>
            <div className="relative">
              <input className={`${input} pr-12`} type={show ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" placeholder="At least 6 characters" disabled={busy} />
              <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-neutral-500">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>
          {err && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[15px] text-red-700">{err}</p>}
          <button type="submit" disabled={busy} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />} Create account
          </button>
        </form>
        <p className="mt-5 text-[15px] text-neutral-600">
          Already have an account?{' '}
          <Link href={`/login/${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-ink underline">Sign in</Link>
        </p>
        <p className="mt-6 text-[13px] text-neutral-500">
          By creating an account you agree to the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy-policy" className="underline">privacy policy</Link>.
        </p>
      </main>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f5fc]" />}>
      <RegisterForm />
    </Suspense>
  )
}
