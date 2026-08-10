import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isStaffRole, requireFullStaff, type StaffRole } from '@/lib/admin-staff';

type RouteContext = { params: Promise<{ id: string }> };

async function countAdmins() {
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');
  return count || 0;
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireFullStaff(request);
  if (gate.error) return gate.error;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', id)
    .single();

  if (existingErr || !existing) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  if (!['admin', 'staff', 'staff_pos'].includes(String(existing.role))) {
    return NextResponse.json({ error: 'That account is not a staff member' }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (body.full_name !== undefined) {
    const name = String(body.full_name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    updates.full_name = name;
  }

  if (body.phone !== undefined) {
    updates.phone = String(body.phone || '').trim() || null;
  }

  if (body.role !== undefined) {
    const nextRole = String(body.role || '').trim();
    if (!isStaffRole(nextRole)) {
      return NextResponse.json(
        { error: 'Role must be admin, staff, or staff_pos' },
        { status: 400 }
      );
    }
    if (nextRole === 'admin' && gate.auth!.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can assign the admin role' }, { status: 403 });
    }
    if (existing.role === 'admin' && nextRole !== 'admin') {
      if (id === gate.auth!.user.id) {
        return NextResponse.json({ error: 'You cannot demote your own admin account' }, { status: 400 });
      }
      const admins = await countAdmins();
      if (admins <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last admin account' }, { status: 400 });
      }
    }
    updates.role = nextRole as StaffRole;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (updates.full_name) {
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { full_name: updates.full_name },
    });
  }

  return NextResponse.json({ staff: updated });
}

/** Change staff password. Body: { password: string } */
export async function PUT(request: Request, context: RouteContext) {
  const gate = await requireFullStaff(request);
  if (gate.error) return gate.error;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const password = String(body.password || '');
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .single();

  if (!existing || !['admin', 'staff', 'staff_pos'].includes(String(existing.role))) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password,
    ban_duration: 'none',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Remove staff access: demote profile to customer and ban the Auth user
 * so they can no longer sign in to /admin. Keeps the account for order history.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const gate = await requireFullStaff(request);
  if (gate.error) return gate.error;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });

  if (id === gate.auth!.user.id) {
    return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email, full_name')
    .eq('id', id)
    .single();

  if (!existing || !['admin', 'staff', 'staff_pos'].includes(String(existing.role))) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  if (existing.role === 'admin') {
    if (gate.auth!.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can remove other admins' }, { status: 403 });
    }
    const admins = await countAdmins();
    if (admins <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin account' }, { status: 400 });
    }
  }

  const { error: profErr } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'customer' })
    .eq('id', id);

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Ban for ~100 years so /admin login fails; account retained for history.
  const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: '876000h',
  });

  if (banErr) {
    // Roll role back if ban fails so we don't leave a soft-broken state silently.
    await supabaseAdmin.from('profiles').update({ role: existing.role }).eq('id', id);
    return NextResponse.json({ error: banErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
