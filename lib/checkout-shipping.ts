/**
 * Checkout shipping amounts (GHS). Override with NEXT_PUBLIC_* env vars on Vercel.
 * All values are non-negative; invalid env strings fall back to defaults.
 */
function parseGhs(value: string | undefined, fallback: number): number {
    if (value == null || value.trim() === '') return fallback;
    const n = parseFloat(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Default fees if env is unset — adjust env in production without redeploying logic. */
const DEFAULTS = {
    pickup: 15,
    doorstep: 40,
    accra: 40,
    'outside-accra': 30,
} as const;

export function getCheckoutShippingGhs(deliveryMethod: string): number {
    switch (deliveryMethod) {
        case 'doorstep':
            return parseGhs(process.env.NEXT_PUBLIC_SHIPPING_DOORSTEP_GHS, DEFAULTS.doorstep);
        case 'accra':
            return parseGhs(process.env.NEXT_PUBLIC_SHIPPING_ACCRA_GHS, DEFAULTS.accra);
        case 'outside-accra':
            return parseGhs(process.env.NEXT_PUBLIC_SHIPPING_OUTSIDE_ACCRA_GHS, DEFAULTS['outside-accra']);
        case 'pickup':
        default:
            return parseGhs(process.env.NEXT_PUBLIC_SHIPPING_PICKUP_GHS, DEFAULTS.pickup);
    }
}
