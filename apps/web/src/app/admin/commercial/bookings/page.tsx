'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommercialBookingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/commercial/orders');
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-ink-soft">
      Loading commercial bookings...
    </div>
  );
}
