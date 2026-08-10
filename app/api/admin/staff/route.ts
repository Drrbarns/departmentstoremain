import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  DEFAULT_STAFF_ROLE,
  isStaffRole,
  requireFullStaff,
  type StaffRole,
} from '@/lib/admin-staff';

export async function GET(request: Request) {
  const gate = await requireFullStaff(request);
  if (gate.error) return gate.error;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .in('role', ['admin', 'staff', 'staff_pos'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staff = data || [];

  // Attach last sign-in when available (best-effort; never fail the list).
  const enriched = await Promise.all(
    staff.map(async (row) => {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.id);
        return {
          ...row,
          last_sign_in_at: authUser?.user?.last_sign_in_at || null,
          banned: Boolean((authUser?.user as any)?.banned_until),
        };
      } catch {
        return { ...row, last_sign_in_at: null, banned: false };
      }
    })
  );

  const counts = {
    total: enriched.length,
    admin: enriched.filter((s) => s.role === 'admin').length,
    staff: enriched.filter((s) => s.role === 'staff').length,
    staff_pos: enriched.filter((s) => s.role === 'staff_pos').length,
  };

  return NextResponse.json({
    staff: enriched,
    counts,
    viewerId: gate.auth!.user.id,
    viewerRole: gate.auth!.role,
  });
}

export async function POST(request: Request) {
  const gate = await requireFullStaff(request);
  if (gate.error) return gate.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  const roleInput = String(body.role || DEFAULT_STAFF_ROLE).trim();
  const role: StaffRole = isStaffRole(roleInput) ? roleInput : DEFAULT_STAFF_ROLE;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  if (role === 'admin' && gate.auth!.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can create other admin accounts' }, { status: 403 });
  }

  const displayName =
    fullName ||
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });

  let userId = created?.user?.id ?? null;

  if (createErr) {
    const msg = String(createErr.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      // Promote an existing customer/auth user into staff.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('email', email)
        .maybeSingle();

      userId = existingProfile?.id || null;
      if (!userId) {
        // Fall back to Auth user lookup via list (expensive but rare path).
        const { findAuthUserIdByEmail } = await import('@/lib/admin-staff');
        userId = await findAuthUserIdByEmail(email);
      }
      if (!userId) {
        return NextResponse.json(
          { error: 'A user with this email already exists but could not be resolved' },
          { status: 409 }
        );
      }

      const { error: upAuth } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: { full_name: displayName },
      });
      if (upAuth) {
        return NextResponse.json({ error: upAuth.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: displayName,
        role,
      },
      { onConflict: 'id' }
    )
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .single();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ staff: profile }, { status: 201 });
}
