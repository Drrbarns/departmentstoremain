'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { round2, clampPct, effectivePct, type ProductMarkupMap } from '@/lib/affiliate';

interface ActiveAffiliate {
  code: string;
  commission_pct: number;
  full_name: string | null;
}

interface AffiliateContextType {
  affiliate: ActiveAffiliate | null;
  /** Default commission percentage of the attributed affiliate (0 if none). */
  commissionPct: number;
  /** Program-wide max markup cap. */
  cap: number;
  /** Per-product markup overrides (product_id → effective %). */
  markups: ProductMarkupMap;
  /** Whether the markup is active for the current visitor. */
  isReferred: boolean;
  /**
   * Apply the affiliate markup to a base price. Pass the product id to honour
   * any per-product override; omit it to use the affiliate's default markup.
   */
  mk: (base: number, productId?: string) => number;
  /** Effective markup percent for a given product (or the default). */
  pctFor: (productId?: string) => number;
  /** True once attribution has been resolved (cookie checked / ref captured). */
  ready: boolean;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export function AffiliateProvider({ children }: { children: ReactNode }) {
  const [affiliate, setAffiliate] = useState<ActiveAffiliate | null>(null);
  const [markups, setMarkups] = useState<ProductMarkupMap>({});
  const [cap, setCap] = useState(100);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromActive() {
      const res = await fetch('/api/affiliate/active', { credentials: 'include' });
      const data = await res.json();
      if (cancelled) return;
      if (data.affiliate) {
        setAffiliate(data.affiliate);
        setMarkups(data.markups || {});
        if (typeof data.cap === 'number') setCap(data.cap);
      }
    }

    async function resolve() {
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');

        if (ref) {
          // Capture the click + set the attribution cookie, then hydrate full
          // pricing (cap + per-product markups) from /active.
          await fetch('/api/affiliate/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: ref, path: window.location.pathname }),
          });
          await hydrateFromActive();

          // Strip ?ref= from the URL so it doesn't get shared/bookmarked.
          params.delete('ref');
          const qs = params.toString();
          const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
          window.history.replaceState({}, '', clean);
        } else {
          await hydrateFromActive();
        }
      } catch {
        /* attribution is best-effort */
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  const commissionPct = clampPct(affiliate?.commission_pct || 0, cap);

  const pctFor = useCallback(
    (productId?: string) => (affiliate ? effectivePct(productId, markups, commissionPct, cap) : 0),
    [affiliate, markups, commissionPct, cap]
  );

  const mk = useCallback(
    (base: number, productId?: string) => {
      const pct = pctFor(productId);
      return pct > 0 ? round2(base * (1 + pct / 100)) : base;
    },
    [pctFor]
  );

  return (
    <AffiliateContext.Provider
      value={{ affiliate, commissionPct, cap, markups, isReferred: !!affiliate, mk, pctFor, ready }}
    >
      {children}
    </AffiliateContext.Provider>
  );
}

export function useAffiliate() {
  const ctx = useContext(AffiliateContext);
  if (ctx === undefined) {
    // Safe fallback when used outside the provider (e.g. admin area): no markup.
    return {
      affiliate: null,
      commissionPct: 0,
      cap: 100,
      markups: {},
      isReferred: false,
      mk: (base: number) => base,
      pctFor: () => 0,
      ready: true,
    } as AffiliateContextType;
  }
  return ctx;
}
