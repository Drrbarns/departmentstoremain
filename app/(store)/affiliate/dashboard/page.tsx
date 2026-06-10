'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AffiliateDashboardPanel from '@/components/AffiliateDashboardPanel';

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth/login?redirect=/affiliate/dashboard'); return; }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return <div className="min-h-[50vh] flex items-center justify-center text-gray-400"><i className="ri-loader-4-line animate-spin text-2xl" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Dashboard</h1>
        <Link href="/account" className="text-sm text-gray-500 hover:text-gray-900">← Account</Link>
      </div>
      <AffiliateDashboardPanel />
    </div>
  );
}
