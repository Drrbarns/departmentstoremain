import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Bearer auth for Sasu brain → shop API.
 * Missing / malformed header → 401. Wrong key → 403.
 */
export function requireBrainAuth(request: Request): NextResponse | null {
    const expected = process.env.BRAIN_API_KEY;
    if (!expected || expected.length < 16) {
        return NextResponse.json(
            { error: 'Brain API is not configured' },
            { status: 503 }
        );
    }

    const header = request.headers.get('authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
        return NextResponse.json(
            { error: 'Missing or invalid Authorization header' },
            { status: 401 }
        );
    }

    const token = header.slice(7).trim();
    if (!token) {
        return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    try {
        const a = Buffer.from(token, 'utf8');
        const b = Buffer.from(expected, 'utf8');
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    return null;
}
