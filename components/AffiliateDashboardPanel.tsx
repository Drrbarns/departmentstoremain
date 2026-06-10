'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Affiliate, AffiliateCommission, AffiliatePayout } from '@/lib/affiliate';
import AffiliatePricingManager from '@/components/AffiliatePricingManager';

const COMMISSION_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  matured: 'bg-green-100 text-green-800',
  paid: 'bg-gray-200 text-gray-700',
  clawed_back: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function ghs(n: number | null | undefined) {
  return `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fdate(s: string) {
  return new Date(s).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Full affiliate dashboard body (referral link, balances, My Pricing,
 * commissions, payouts). Self-contained — fetches its own data. Shows a
 * "Become an Affiliate" CTA when the signed-in user isn't an affiliate yet.
 * Used both on /affiliate/dashboard and inside the account page Affiliate tab.
 */
export default function AffiliateDashboardPanel() {
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
    (async () => {
      try {
        const res = await fetch('/api/affiliate/dashboard', { headers: await authHeaders(), credentials: 'include' });
        const data = await res.json();
        setAffiliate(data.affiliate || null);
        setCommissions(data.commissions || []);
        setPayouts(data.payouts || []);
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [authHeaders]);

  if (loading) {
    return <div className="py-16 flex items-center justify-center text-gray-400"><i className="ri-loader-4-line animate-spin text-2xl" /></div>;
  }

  if (!affiliate) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 text-2xl">
          <i className="ri-money-dollar-circle-line" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Earn with every share</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Become an affiliate to get your own link, set custom markups (even per product), and earn commission paid straight to your MoMo.
        </p>
        <Link
          href="/affiliate"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold transition-all shadow-lg shadow-gray-900/20"
        >
          <i className="ri-user-add-line" />
          Become an Affiliate
        </Link>
      </div>
    );
  }

  const refLink = `${origin}/?ref=${affiliate.code}`;

  return (
    <div>
      {affiliate.status !== 'active' && (
        <div className="mb-6 p-4 rounded-xl bg-[#FFFFCC] text-[#996633] text-sm flex items-center gap-2">
          <i className="ri-time-line" />
          Your application is <span className="font-semibold">{affiliate.status}</span>. You'll be able to earn once it's approved.
        </div>
      )}

      <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-300">Default markup</span>
          <span className="text-2xl font-bold">{affiliate.commission_pct}%</span>
        </div>
        <div className="flex gap-2">
          <input readOnly value={refLink} className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm" />
          <button
            onClick={() => { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-2 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 whitespace-nowrap"
          >{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Available" value={affiliate.balance_available} accent="text-green-600" />
        <Stat label="Pending" value={affiliate.balance_pending} accent="text-amber-600" />
        <Stat label="Total earned" value={affiliate.total_earned} accent="text-gray-900" />
        <Stat label="Total paid" value={affiliate.total_paid} accent="text-gray-500" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">My Pricing</h2>
      <div className="mb-8">
        <AffiliatePricingManager
          onDefaultChange={(pct) => setAffiliate((a) => (a ? { ...a, commission_pct: pct } : a))}
        />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Commissions</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        {commissions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No commissions yet. Share your link to start earning.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Order</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-right px-4 py-2.5">Commission</th>
                  <th className="text-center px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.order_number}</td>
                    <td className="px-4 py-2.5 text-gray-500">{fdate(c.created_at)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{ghs(c.commission_amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${COMMISSION_BADGE[c.status]}`}>
                        {c.status === 'clawed_back' ? 'reversed' : c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Payouts</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {payouts.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payouts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">To</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-center px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 text-gray-500">{fdate(p.created_at)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.provider} {p.destination}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{ghs(p.amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
      <div className={`text-lg font-bold ${accent}`}>{ghs(value)}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
