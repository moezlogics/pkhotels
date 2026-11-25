'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import HotelBilling from '@/components/billing/hotel-billing';
import AdminBilling from '@/components/billing/admin-billing';
import { useAuth } from '@/context/auth-context';

/* Admins see the whole billing desk; a hotel (or an admin with ?hotelId=) sees that hotel's invoices. */
function BillingInner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const hotelId = sp.get('hotelId');
  if (!user) return null;
  if (user.role === 'ADMIN' && !hotelId) return <AdminBilling />;
  return <HotelBilling hotelId={hotelId} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
