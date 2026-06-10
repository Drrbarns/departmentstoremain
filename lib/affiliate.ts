/**
 * Shared types + pure helpers for the affiliate system.
 *
 * Pricing model: MARKUP ON TOP. A customer arriving via an affiliate link pays
 *   customerPrice = base * (1 + commission_pct/100)
 * The business keeps `base`; the markup (= base * pct/100) is the affiliate's
 * commission. The markup is a single uniform multiplier per affiliate, so it
 * can be applied centrally to any price.
 */

export type AffiliateStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type AffiliateCommissionStatus =
    | 'pending'
    | 'matured'
    | 'paid'
    | 'clawed_back'
    | 'cancelled';
export type AffiliatePayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface Affiliate {
    id: string;
    user_id: string | null;
    code: string;
    status: AffiliateStatus;
    commission_pct: number;
    /** A commission % the affiliate has requested, awaiting admin approval. */
    pending_commission_pct: number | null;
    commission_requested_at: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    payout_method: string | null;
    payout_number: string | null;
    payout_provider: string | null;
    payout_name: string | null;
    total_earned: number;
    total_paid: number;
    balance_pending: number;
    balance_available: number;
    notes: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AffiliateCommission {
    id: string;
    affiliate_id: string;
    order_id: string | null;
    order_number: string;
    base_amount: number;
    commission_pct: number;
    commission_amount: number;
    status: AffiliateCommissionStatus;
    matures_at: string | null;
    payout_id: string | null;
    matured_at: string | null;
    paid_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AffiliatePayout {
    id: string;
    affiliate_id: string;
    amount: number;
    method: string | null;
    destination: string | null;
    provider: string | null;
    status: AffiliatePayoutStatus;
    moolre_ref: string | null;
    failure_reason: string | null;
    processed_by: string | null;
    created_at: string;
    processed_at: string | null;
}

export interface AffiliateSettings {
    enabled: boolean;
    default_commission_pct: number;
    /** Hard ceiling on any markup an affiliate can set (default or per-product). */
    max_commission_pct: number;
    attribution_days: number;
    maturity_days: number;
    min_payout: number;
    cookie_name: string;
    auto_disburse: boolean;
}

export const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettings = {
    enabled: true,
    default_commission_pct: 10,
    max_commission_pct: 50,
    attribution_days: 30,
    maturity_days: 7,
    min_payout: 0,
    cookie_name: 'dds_ref',
    auto_disburse: false,
};

/** How an affiliate chose to express a per-product override (UI input mode). */
export type AffiliateMarkupType = 'pct' | 'price';

export interface AffiliateProductMarkup {
    id?: string;
    affiliate_id?: string;
    product_id: string;
    markup_type: AffiliateMarkupType;
    /** Effective markup percent — always the source of truth used for math. */
    markup_pct: number;
    /** Original fixed price entered when markup_type === 'price' (for redisplay). */
    fixed_price: number | null;
    /** Approval state — only 'approved' overrides affect pricing/commission. */
    status?: 'pending' | 'approved' | 'rejected';
    created_at?: string;
    updated_at?: string;
}

/** Map of product_id → effective markup percent for the active affiliate. */
export type ProductMarkupMap = Record<string, number>;

/** Cookie name used for attribution. Mirrors the default setting. */
export const AFFILIATE_COOKIE = 'dds_ref';

/** Round to 2 dp (GHS). Avoids float drift in money math. */
export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Clamp a markup percent to the allowed range [0, cap]. */
export function clampPct(pct: number, cap = 100): number {
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    const max = Number.isFinite(cap) && cap > 0 ? cap : 100;
    return Math.min(round2(pct), max);
}

/**
 * Convert a desired absolute selling price into an equivalent markup percent
 * relative to the product's base price. Floored at base (never negative) and
 * capped. Used so per-product fixed prices feed the same percentage engine and
 * apply proportionally to variants.
 */
export function priceToPct(fixedPrice: number, basePrice: number, cap = 100): number {
    if (!basePrice || basePrice <= 0) return 0;
    const pct = ((fixedPrice - basePrice) / basePrice) * 100;
    return clampPct(pct, cap);
}

/**
 * Effective markup percent for a specific product: a per-product override if
 * present, otherwise the affiliate's default — always clamped to the cap.
 */
export function effectivePct(
    productId: string | undefined,
    markups: ProductMarkupMap | undefined,
    defaultPct: number,
    cap = 100,
): number {
    const override = productId && markups ? markups[productId] : undefined;
    const pct = override !== undefined ? override : defaultPct;
    return clampPct(pct, cap);
}

/** Customer-facing price after the affiliate markup. */
export function applyMarkup(basePrice: number, commissionPct: number): number {
    if (!commissionPct || commissionPct <= 0) return round2(basePrice);
    return round2(basePrice * (1 + commissionPct / 100));
}

/** The affiliate's commission (= the markup the customer paid) for a base amount. */
export function commissionFor(baseAmount: number, commissionPct: number): number {
    if (!commissionPct || commissionPct <= 0) return 0;
    return round2(baseAmount * (commissionPct / 100));
}

/** Multiplier form, handy for client-side display: price * markupMultiplier(pct). */
export function markupMultiplier(commissionPct: number): number {
    if (!commissionPct || commissionPct <= 0) return 1;
    return 1 + commissionPct / 100;
}

/**
 * Generates a URL-safe affiliate code from a name plus a short random suffix,
 * e.g. "Ama Mensah" -> "AMAMEN-7QK2". Caller must ensure uniqueness.
 */
export function generateAffiliateCode(name?: string | null): string {
    const base = (name || 'AFF')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'AFF';
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    return `${base}-${suffix}`;
}
