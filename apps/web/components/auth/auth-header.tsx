'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

/**
 * The top bar on sign-in, sign-up and "one more step": a round back button
 * (to wherever the person came from, or home), the logo, and a close button
 * that leaves for the home page. Phones have no browser chrome to go back with
 * in a home-screen app, so the page must offer it.
 */
export function AuthHeader({ closeHref = '/' }: { closeHref?: string }) {
  const router = useRouter()
  const back = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back()
    else router.push(closeHref)
  }
  return (
    <header className="sticky top-0 z-10 bg-[#f7f5fc]/95 backdrop-blur md:static md:bg-transparent">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <button type="button" onClick={back} aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink ring-1 ring-[color:var(--border)] transition active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link href="/" aria-label="PakHotels home"><BrandLogo /></Link>
        <Link href={closeHref} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink ring-1 ring-[color:var(--border)] transition active:scale-95">
          <X className="h-5 w-5" />
        </Link>
      </div>
    </header>
  )
}
