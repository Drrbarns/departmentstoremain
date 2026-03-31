import { supabaseAdmin } from './supabase-admin';

/**
 * Shared server-side authentication utilities.
 * Use these in API routes and server actions to verify callers.
 */

export interface AuthResult {
    authenticated: boolean;
    user?: any;
    role?: string;
    error?: string;
}

/**
 * Verify that the request has a valid Supabase session
 * and optionally check for admin/staff role.
 *
 * - requireAdmin: true → admin, staff, or staff_pos (anyone who can use the admin app)
 * - requireFullStaff: true (with requireAdmin) → admin or staff only (excludes staff_pos)
 */
export async function verifyAuth(
    request: Request,
    options: { requireAdmin?: boolean; requireFullStaff?: boolean } = {}
): Promise<AuthResult> {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        return { authenticated: false, error: 'Missing authorization token' };
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return { authenticated: false, error: 'Invalid or expired token' };
        }

        if (options.requireAdmin) {
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                return { authenticated: false, error: 'Could not verify user role' };
            }

            const allowed = options.requireFullStaff
                ? profile.role === 'admin' || profile.role === 'staff'
                : profile.role === 'admin' || profile.role === 'staff' || profile.role === 'staff_pos';

            if (!allowed) {
                return { authenticated: false, error: 'Admin access required' };
            }

            return { authenticated: true, user, role: profile.role };
        }

        return { authenticated: true, user };
    } catch (err: any) {
        return { authenticated: false, error: err.message || 'Auth verification failed' };
    }
}

/**
 * Verify admin auth for server actions.
 * Requires passing the auth token from the client.
 */
export async function verifyAdminToken(
    token: string,
    options: { requireFullStaff?: boolean } = {}
): Promise<AuthResult> {
    if (!token) {
        return { authenticated: false, error: 'Missing token' };
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return { authenticated: false, error: 'Invalid or expired token' };
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return { authenticated: false, error: 'Could not verify role' };
        }

        const allowed = options.requireFullStaff
            ? profile.role === 'admin' || profile.role === 'staff'
            : profile.role === 'admin' || profile.role === 'staff' || profile.role === 'staff_pos';

        if (!allowed) {
            return { authenticated: false, error: 'Admin access required' };
        }

        return { authenticated: true, user, role: profile.role };
    } catch (err: any) {
        return { authenticated: false, error: err.message || 'Auth failed' };
    }
}
