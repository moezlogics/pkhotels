"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { OAUTH_NEXT_KEY } from "@/components/auth/google-button";

/**
 * Where Google sends people back. The API has already set the session
 * cookies; trade them for a token, then send the person on — via "One more
 * step" first if the account has no mobile number yet (hotels need it to
 * confirm bookings, and Google never shares one).
 */
export default function SigningInPage() {
  const router = useRouter();
  const { completeSocialSignIn } = useAuth();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let next: string | null = null;
    try {
      const stored = sessionStorage.getItem(OAUTH_NEXT_KEY);
      if (stored?.startsWith("/")) next = stored;
      sessionStorage.removeItem(OAUTH_NEXT_KEY);
    } catch {
      /* storage blocked */
    }

    (async () => {
      try {
        await completeSocialSignIn();
        const me = (await api.get("/auth/profile")).data as { phone?: string; role?: string };
        const fallback = me?.role && me.role !== "USER" ? "/dashboard" : "/trips";
        const target = next ?? fallback;
        if (!me?.phone) {
          router.replace(`/complete-profile?next=${encodeURIComponent(target)}`);
          return;
        }
        toast.success("Signed in with Google");
        router.replace(target);
        router.refresh();
      } catch {
        setFailed(true);
      }
    })();
  }, [completeSocialSignIn, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f5fc] px-4 text-center">
      {failed ? (
        <>
          <p className="text-[20px] font-semibold text-ink">We could not finish signing you in</p>
          <p className="max-w-sm text-[16px] text-neutral-500">Google confirmed your account, but the session did not start. Please try once more.</p>
          <Link href="/login" className="mt-2 rounded-full bg-ink px-5 py-3 text-[16px] font-semibold text-white">Back to sign in</Link>
        </>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-ink" />
          <p className="text-[16px] text-neutral-500">Signing you in…</p>
        </>
      )}
    </div>
  );
}
