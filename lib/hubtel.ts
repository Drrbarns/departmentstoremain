/**
 * Hubtel Online Checkout client.
 *
 *  - POST https://payproxyapi.hubtel.com/items/initiate
 *      starts a hosted-checkout session.
 *  - GET  https://rmsc.hubtel.com/v1/merchantaccount/merchants/{merchant}/transactions/status?clientReference=...
 *      looks up a transaction by client reference. This is the public RMSC
 *      status-check endpoint (no IP whitelisting required), which is what
 *      our callback handler and /verify route use to confirm payments.
 *
 * Auth on both endpoints is HTTP Basic with the Hubtel-issued API ID/Key.
 *
 * NOTE: This store charges the full order amount in a single payment (no
 * deposit / balance plans), so this is a trimmed version of the integration
 * used on the Sarah Lawson store — initiate + status + a couple of helpers.
 */

const INITIATE_URL = 'https://payproxyapi.hubtel.com/items/initiate';
const STATUS_BASE_URL = 'https://rmsc.hubtel.com/v1/merchantaccount/merchants';

function requiredEnv(name: string): string {
    const v = process.env[name];
    if (!v || !v.trim()) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v.trim();
}

function buildAuthHeader(): string {
    const id = requiredEnv('HUBTEL_API_ID');
    const key = requiredEnv('HUBTEL_API_KEY');
    const encoded = Buffer.from(`${id}:${key}`).toString('base64');
    return `Basic ${encoded}`;
}

export interface HubtelInitiatePayload {
    /** Total amount; Hubtel accepts up to 2 decimal places. */
    totalAmount: number;
    description: string;
    callbackUrl: string;
    returnUrl: string;
    cancellationUrl: string;
    /** Hubtel Collection Account Number (the "merchantAccountNumber"). */
    merchantAccountNumber: string;
    /**
     * Unique transaction identifier. **Max 32 characters** per the docs;
     * makeHubtelClientReference() guarantees that for you.
     */
    clientReference: string;
    payeeName?: string;
    payeeMobileNumber?: string;
    payeeEmail?: string;
}

export interface HubtelInitiateResult {
    responseCode?: string;
    status?: string;
    message?: string;
    data?: {
        checkoutUrl?: string;
        checkoutId?: string;
        clientReference?: string;
        message?: string;
        checkoutDirectUrl?: string;
    };
}

export async function initiateHubtelCheckout(
    payload: HubtelInitiatePayload,
): Promise<HubtelInitiateResult> {
    if (payload.clientReference.length > 32) {
        throw new Error(
            `Hubtel clientReference must be <=32 chars (got ${payload.clientReference.length}: "${payload.clientReference}")`,
        );
    }
    const res = await fetch(INITIATE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: buildAuthHeader(),
        },
        body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res, 'initiate');
}

export interface HubtelStatusResult {
    message?: string;
    responseCode?: string;
    data?: {
        date?: string;
        status?: string; // "Paid" | "Unpaid" | "Refunded"
        transactionId?: string;
        externalTransactionId?: string;
        paymentMethod?: string;
        clientReference?: string;
        currencyCode?: string | null;
        amount?: number;
        charges?: number;
        amountAfterCharges?: number;
        isFulfilled?: boolean | null;
    };
}

export async function checkHubtelStatus(
    clientReference: string,
): Promise<HubtelStatusResult> {
    const merchant = requiredEnv('HUBTEL_MERCHANT_ACCOUNT_NUMBER');
    const url = `${STATUS_BASE_URL}/${encodeURIComponent(merchant)}/transactions/status?clientReference=${encodeURIComponent(clientReference)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: buildAuthHeader(),
        },
    });
    const raw = await parseJsonOrThrow<any>(res, 'status');
    return normalizeStatusResponse(raw);
}

/**
 * The RMSC status endpoint returns PascalCase fields with names different
 * from the ones in Hubtel's public Online Checkout docs, and `Data` comes
 * back as an array. Coerce everything into the camelCase shape the callback /
 * verify routes expect, mapping both the documented names and the RMSC names.
 *
 *   TransactionAmount  → amount               (what the CUSTOMER paid)
 *   Fee                → charges              (merchant-side fee)
 *   AmountAfterFees    → amountAfterCharges   (what the MERCHANT settles with)
 */
function normalizeStatusResponse(raw: any): HubtelStatusResult {
    const root = raw || {};
    let dataRaw: any = root.data ?? root.Data ?? {};
    if (Array.isArray(dataRaw)) {
        dataRaw = dataRaw[0] || {};
    }
    const toNumber = (v: unknown): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : undefined;
    };
    return {
        message: root.message ?? root.Message,
        responseCode: root.responseCode ?? root.ResponseCode,
        data: {
            date: dataRaw.date ?? dataRaw.Date ?? dataRaw.StartDate,
            status:
                dataRaw.status ??
                dataRaw.Status ??
                dataRaw.TransactionStatus ??
                dataRaw.InvoiceStatus,
            transactionId:
                dataRaw.transactionId ?? dataRaw.TransactionId ?? dataRaw.CheckoutId,
            externalTransactionId:
                dataRaw.externalTransactionId ??
                dataRaw.ExternalTransactionId ??
                dataRaw.NetworkTransactionId,
            paymentMethod: dataRaw.paymentMethod ?? dataRaw.PaymentMethod,
            clientReference: dataRaw.clientReference ?? dataRaw.ClientReference,
            currencyCode: dataRaw.currencyCode ?? dataRaw.CurrencyCode ?? null,
            amount: toNumber(
                dataRaw.amount ?? dataRaw.Amount ?? dataRaw.TransactionAmount,
            ),
            charges: toNumber(dataRaw.charges ?? dataRaw.Charges ?? dataRaw.Fee),
            amountAfterCharges: toNumber(
                dataRaw.amountAfterCharges ??
                    dataRaw.AmountAfterCharges ??
                    dataRaw.AmountAfterFees,
            ),
            isFulfilled: dataRaw.isFulfilled ?? dataRaw.IsFulfilled ?? null,
        },
    };
}

async function parseJsonOrThrow<T = unknown>(res: Response, label: string): Promise<T> {
    const text = await res.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`Hubtel ${label}: non-JSON response (${res.status}) — ${text.slice(0, 200)}`);
    }
}

/**
 * Classifies a Hubtel status string as a successful payment.
 *
 * IMPORTANT: Hubtel uses ResponseCode === "0000" to mean "this API/callback
 * request was received correctly" — NOT "payment succeeded". The actual
 * payment outcome lives in Data.Status / Data.TransactionStatus (Paid /
 * Failed / Unpaid / Pending). We only treat the payment as paid when the
 * status string itself is in the success set.
 *
 * `responseCode` is kept in the signature for call-site compatibility; it is
 * intentionally unused.
 */
export function isHubtelPaid(
    status: string | null | undefined,
    _responseCode?: string | null,
): boolean {
    const s = (status || '').trim().toLowerCase();
    return s === 'paid' || s === 'success' || s === 'successful' || s === 'completed';
}

export function isHubtelFailure(
    status: string | null | undefined,
    responseCode?: string | null,
): boolean {
    const s = (status || '').trim().toLowerCase();
    if (s === 'failed' || s === 'failure' || s === 'declined' || s === 'cancelled' || s === 'canceled') {
        return true;
    }
    const code = String(responseCode ?? '').trim();
    return code === '2001' || code === '4000' || code === '4070';
}

/**
 * Constructs a unique clientReference that fits inside Hubtel's 32-char limit.
 *
 * Layout: `<orderRef>-r<base36Timestamp>` truncated to 32 chars. The "-r"
 * suffix lets a retry produce a fresh, non-colliding reference while the
 * callback can still recover the order ref by stripping the suffix.
 */
export function makeHubtelClientReference(orderRef: string): string {
    const MAX = 32;
    const suffix = `-r${Date.now().toString(36)}`;
    if (orderRef.length + suffix.length <= MAX) {
        return `${orderRef}${suffix}`;
    }
    return orderRef.slice(0, MAX);
}

/**
 * Recover the order ref from a Hubtel clientReference by stripping a trailing
 * "-r...". Order numbers here are `ORD-<digits>-<digits>` which never end in
 * "-r<...>", so this only removes the suffix we added.
 */
export function stripHubtelReferenceSuffix(ref: string): string {
    return ref.replace(/-r[a-z0-9]+$/i, '');
}

/**
 * Normalises a Ghana phone number into 233XXXXXXXXX. Accepts inputs like
 * "+233...", "0...", "233..." or 9-digit local numbers.
 */
export function normalizeGhPhone(input: string | null | undefined): string {
    const digits = String(input || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('233')) return digits;
    if (digits.startsWith('0')) return `233${digits.slice(1)}`;
    if (digits.length === 9) return `233${digits}`;
    return digits;
}
