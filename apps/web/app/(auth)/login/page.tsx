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

const input =
  'h-[50px] w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[17px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink focus:ring-1 focus:ring-ink disabled:opacity-60'

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next')
  const [email, setEmail] = useState(sp.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address.')
    if (!password) return setErr('Enter your password.')
    setBusy(true)
    try {
      await login({ email: email.trim().toLowerCase(), password })
      toast.success('Signed in')
      router.push(safeNextUrl(next ?? '/trips'))
    } catch (error: any) {
      const m = error?.response?.data?.message
      if (m === 'Account is pending activation') return router.push('/pending-activation')
      setErr(error?.response?.status === 429 ? 'Too many tries. Wait a minute and try again.' : typeof m === 'string' && !/unauthor/i.test(m) ? m : 'Email or password is wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5fc]">
      <AuthHeader />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-4 md:mt-6 md:rounded-[32px] md:bg-white md:p-9 md:ring-1 md:ring-[color:var(--border)]">
        <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">Welcome back</h1>
        <p className="mt-1.5 text-[16px] text-neutral-500">Sign in to see your trips and book faster.</p>
        {sp.get('sessionExpired') === 'true' && <p className="mt-4 rounded-xl bg-surface px-3.5 py-2.5 text-[15px] text-ink">Your session ended. Sign in again to continue.</p>}
        {sp.get('error') === 'google' && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-[15px] text-red-700">Google sign-in did not finish. Try again, or use your email.</p>}
        <div className="mt-6">
          <GoogleButton next={next} disabled={busy} />
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-[14px] font-medium text-neutral-600">Email</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-[14px] font-medium text-neutral-600">
              Password
              <Link href="/contact" className="font-normal underline">Forgot it?</Link>
            </span>
            <div className="relative">
              <input className={`${input} pr-12`} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} />
              <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-neutral-500">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>
          {err && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[15px] text-red-700">{err}</p>}
          <button type="submit" disabled={busy} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />} Sign in
          </button>
        </form>
        <p className="mt-5 text-[15px] text-neutral-600">
          New to PakHotels?{' '}
          <Link href={`/register/${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-ink underline">Create an account</Link>
        </p>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f5fc]" />}>
      <LoginForm />
    </Suspense>
  )
}
