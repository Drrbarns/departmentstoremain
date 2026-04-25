/**
 * Checkout shipping fees.
 *
 * Policy (Apr 2026):
 *   - Store pickup is free.
 *   - All delivery methods are paid on delivery directly to the rider,
 *     so the order total never includes a shipping line.  We surface the
 *     fact via UI copy ("At a Cost"), not in the amount charged through
 *     Moolre.
 */

export const PICKUP_METHODS = new Set(['pickup']);

/** Amount to charge through the checkout (always 0 today). */
export function getCheckoutShippingGhs(_deliveryMethod: string): number {
    return 0;
}

/** Label to show in the checkout summary next to "Shipping". */
export function shippingLabel(deliveryMethod: string): string {
    if (PICKUP_METHODS.has(deliveryMethod)) return 'FREE';
    return 'At a Cost';
}
