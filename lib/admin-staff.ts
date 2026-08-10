import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import {
  DEFAULT_STAFF_ROLE,
  STAFF_ROLES,
  isStaffRole,
  roleLabel,
  type StaffRole,
} from '@/lib/admin-staff-shared';

export {
  DEFAULT_STAFF_ROLE,
  STAFF_ROLES,
  isStaffRole,
  roleLabel,
  type StaffRole,
};

/** Extract Bearer token, including cookie fallbacks used elsewhere in admin APIs. */
export function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/\bsb-access-token=([^;]+)/);
  if (match) return decodeURIComponent(match[1].trim());

  const authCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sb-') && (c.includes('-auth-token') || c.includes('auth')));
  if (!authCookie) return null;

  const value = authCookie.split('=').slice(1).join('=').trim();
  const decoded = decodeURIComponent(value);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    if (parsed?.access_token) return parsed.access_token;
    if (typeof parsed === 'string') return parsed;
  } catch {
    return decoded;
  }
  return null;
}

/** Full staff (admin/staff) only — POS-only users cannot manage accounts. */
export async function requireFullStaff(request: Request) {
  const token = getAccessToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
      auth: null as null,
      token: null as null,
    };
  }

  const auth = await verifyAuth(
    new Request(request.url, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    { requireAdmin: true, requireFullStaff: true }
  );

  if (!auth.authenticated) {
    return {
      error: NextResponse.json(
        { error: auth.error || 'Forbidden' },
        { status: auth.error?.toLowerCase().includes('admin') ? 403 : 401 }
      ),
      auth: null as null,
      token: null as null,
    };
  }

  return { error: null, auth, token };
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === needle);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}
