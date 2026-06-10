'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { clampPct, round2 } from '@/lib/affiliate';

interface Override {
  id: string;
  product_id: string;
  markup_type: 'pct' | 'price';
  markup_pct: number;
  fixed_price: number | null;
  status: 'pending' | 'approved' | 'rejected';
  product_name: string;
  product_slug: string;
  base_price: number;
  image: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  image: string | null;
  override: Override | null;
}

function ghs(n: number) {
  return `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AffiliatePricingManager({ onDefaultChange }: { onDefaultChange?: (pct: number) => void }) {
  const [cap, setCap] = useState(100);
  const [defaultPct, setDefaultPct] = useState(0);
  const [pendingPct, setPendingPct] = useState<number | null>(null);
  const [defaultInput, setDefaultInput] = useState('0');
  const [savingDefault, setSavingDefault] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [code, setCode] = useState('');
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/affiliate/markups', { headers: await authHeaders(), credentials: 'include' });
    const data = await res.json();
    if (typeof data.cap === 'number') setCap(data.cap);
    if (typeof data.default_commission_pct === 'number') {
      setDefaultPct(data.default_commission_pct);
      setDefaultInput(String(data.default_commission_pct));
    }
    setPendingPct(typeof data.pending_commission_pct === 'number' ? data.pending_commission_pct : null);
    if (data.code) setCode(data.code);
    setOverrides(data.overrides || []);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
    load();
  }, [load]);

  // Debounced product search.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = search.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/affiliate/markups?search=${encodeURIComponent(term)}`, {
          headers: await authHeaders(), credentials: 'include',
        });
        const data = await res.json();
        setResults(data.results || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, authHeaders]);

  const saveDefault = async () => {
    const pct = clampPct(Number(defaultInput), cap);
    setSavingDefault(true);
    try {
      const res = await fetch('/api/affiliate/dashboard', {
        method: 'PATCH', headers: await authHeaders(), credentials: 'include',
        body: JSON.stringify({ commission_pct: pct }),
      });
      const data = await res.json();
      if (data.affiliate) {
        const approved = Number(data.affiliate.commission_pct);
        const pend = data.affiliate.pending_commission_pct;
        setDefaultPct(approved);
        setPendingPct(pend !== null && pend !== undefined ? Number(pend) : null);
        onDefaultChange?.(approved);
      }
    } finally { setSavingDefault(false); }
  };

  const cancelRequest = async () => {
    // Re-request the current approved rate, which clears the pending request.
    setDefaultInput(String(defaultPct));
    setSavingDefault(true);
    try {
      const res = await fetch('/api/affiliate/dashboard', {
        method: 'PATCH', headers: await authHeaders(), credentials: 'include',
        body: JSON.stringify({ commission_pct: defaultPct }),
      });
      const data = await res.json();
      if (data.affiliate) setPendingPct(null);
    } finally { setSavingDefault(false); }
  };

  const saveOverride = async (productId: string, type: 'pct' | 'price', value: number) => {
    const res = await fetch('/api/affiliate/markups', {
      method: 'POST', headers: await authHeaders(), credentials: 'include',
      body: JSON.stringify({ product_id: productId, markup_type: type, value }),
    });
    if (res.ok) {
      await load();
      // Refresh the search row so it reflects the new override.
      setResults((prev) => prev.map((r) => r.id === productId ? { ...r } : r));
      if (search.trim().length >= 2) {
        const r2 = await fetch(`/api/affiliate/markups?search=${encodeURIComponent(search.trim())}`, {
          headers: await authHeaders(), credentials: 'include',
        });
        const d2 = await r2.json();
        setResults(d2.results || []);
      }
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Could not save price.');
    }
  };

  const removeOverride = async (productId: string) => {
    const res = await fetch(`/api/affiliate/markups?product_id=${productId}`, {
      method: 'DELETE', headers: await authHeaders(), credentials: 'include',
    });
    if (res.ok) {
      await load();
      if (search.trim().length >= 2) {
        const r2 = await fetch(`/api/affiliate/markups?search=${encodeURIComponent(search.trim())}`, {
          headers: await authHeaders(), credentials: 'include',
        });
        const d2 = await r2.json();
        setResults(d2.results || []);
      }
    }
  };

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm"><i className="ri-loader-4-line animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Default markup */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900">Your default commission</h3>
          <span className="text-sm text-gray-500">Active: <span className="font-semibold text-gray-900">{defaultPct}%</span></span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Added on top of the base price for every product you share, unless you set a custom price below. Changes need admin approval. Max allowed: <span className="font-semibold">{cap}%</span>.
        </p>

        {pendingPct !== null && (
          <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              <i className="ri-time-line mr-1" />
              Requested <span className="font-semibold">{pendingPct}%</span> — awaiting admin approval.
            </p>
            <button onClick={cancelRequest} disabled={savingDefault} className="text-xs font-medium text-amber-700 hover:text-amber-900 underline disabled:opacity-50">Cancel</button>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Request a rate</label>
            <div className="flex items-center">
              <input
                type="number" min={0} max={cap} step="0.5"
                value={defaultInput}
                onChange={(e) => setDefaultInput(e.target.value)}
                className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-gray-900 focus:ring-0"
              />
              <span className="ml-2 text-gray-500">%</span>
            </div>
          </div>
          <button
            onClick={saveDefault}
            disabled={savingDefault || clampPct(Number(defaultInput), cap) === (pendingPct ?? defaultPct)}
            className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >{savingDefault ? 'Sending…' : 'Request approval'}</button>
        </div>
        {Number(defaultInput) > cap && (
          <p className="text-xs text-amber-600 mt-2">Will be capped to {cap}%.</p>
        )}
      </div>

      {/* Per-product pricing */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Custom product pricing</h3>
        <p className="text-sm text-gray-500 mb-4">
          Sell specific products for more or less. Set a markup % or a fixed selling price — never below the base price, and within the {cap}% cap.
        </p>

        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to customise…"
            className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-gray-900 focus:ring-0"
          />
        </div>

        {searching && <div className="text-sm text-gray-400 mb-3"><i className="ri-loader-4-line animate-spin" /> Searching…</div>}

        {results.length > 0 && (
          <div className="space-y-2 mb-5">
            {results.map((r) => (
              <PriceRow
                key={r.id}
                productId={r.id}
                name={r.name}
                image={r.image}
                basePrice={r.base_price}
                defaultPct={defaultPct}
                cap={cap}
                existing={r.override}
                promoLink={code && r.slug ? `${origin}/product/${r.slug}?ref=${code}` : ''}
                onSave={saveOverride}
                onRemove={removeOverride}
              />
            ))}
          </div>
        )}

        <h4 className="text-sm font-semibold text-gray-700 mb-2">Your custom-priced products ({overrides.length})</h4>
        {overrides.length === 0 ? (
          <p className="text-sm text-gray-400">None yet. Search above to set a custom price on any product.</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <PriceRow
                key={o.id}
                productId={o.product_id}
                name={o.product_name}
                image={o.image}
                basePrice={o.base_price}
                defaultPct={defaultPct}
                cap={cap}
                existing={o}
                promoLink={code && o.product_slug ? `${origin}/product/${o.product_slug}?ref=${code}` : ''}
                onSave={saveOverride}
                onRemove={removeOverride}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceRow({
  productId, name, image, basePrice, defaultPct, cap, existing, promoLink, onSave, onRemove,
}: {
  productId: string;
  name: string;
  image: string | null;
  basePrice: number;
  defaultPct: number;
  cap: number;
  existing: Override | null;
  promoLink: string;
  onSave: (productId: string, type: 'pct' | 'price', value: number) => Promise<void>;
  onRemove: (productId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'pct' | 'price'>(existing?.markup_type || 'pct');
  const [value, setValue] = useState<string>(
    existing
      ? (existing.markup_type === 'price' && existing.fixed_price != null ? String(existing.fixed_price) : String(existing.markup_pct))
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (!promoLink) return;
    navigator.clipboard?.writeText(promoLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const num = Number(value);
  const previewPct = mode === 'pct'
    ? clampPct(num, cap)
    : (basePrice > 0 ? clampPct(((num - basePrice) / basePrice) * 100, cap) : 0);
  const customerPrice = round2(basePrice * (1 + previewPct / 100));
  const defaultPrice = round2(basePrice * (1 + clampPct(defaultPct, cap) / 100));

  const handleSave = async () => {
    if (!Number.isFinite(num) || num < 0) return;
    setSaving(true);
    try { await onSave(productId, mode, num); } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-500">Base {ghs(basePrice)} · Default {ghs(defaultPrice)}</p>
          {existing && existing.status === 'pending' && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"><i className="ri-time-line" /> Awaiting admin approval</span>
          )}
          {existing && existing.status === 'approved' && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"><i className="ri-check-line" /> Live</span>
          )}
          {existing && existing.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded"><i className="ri-close-line" /> Rejected</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'pct' | 'price')}
          className="px-2 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:ring-0"
        >
          <option value="pct">Markup %</option>
          <option value="price">Fixed price</option>
        </select>
        <input
          type="number" min={0} step={mode === 'pct' ? '0.5' : '1'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === 'pct' ? '%' : 'GHS'}
          className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:ring-0"
        />
        <button
          onClick={handleSave}
          disabled={saving || value === ''}
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
        >{saving ? '…' : 'Set'}</button>
        {existing && (
          <button
            onClick={() => onRemove(productId)}
            title="Remove custom price"
            className="px-2.5 py-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          ><i className="ri-delete-bin-line" /></button>
        )}
      </div>

      <div className="text-right sm:w-36">
        <p className="text-xs text-gray-500">Sells at</p>
        <p className="text-sm font-bold text-gray-900">{ghs(customerPrice)}</p>
        <p className="text-[11px] text-gray-400">{previewPct}% markup</p>
        {promoLink && (
          <button
            onClick={copyLink}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-900"
          >
            <i className={copied ? 'ri-check-line' : 'ri-links-line'} />
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
      </div>
    </div>
  );
}
