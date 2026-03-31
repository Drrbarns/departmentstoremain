#!/usr/bin/env node
/**
 * Creates POS-only staff accounts (role staff_pos) in Supabase Auth + profiles.
 *
 * Prerequisites:
 *   1. Apply migration: supabase/migrations/20260331120000_staff_pos_role_and_rls.sql
 *   2. Set env (or pass inline):
 *        export SUPABASE_URL="https://xxxx.supabase.co"
 *        export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 *
 * Run:
 *   node scripts/create-staff-pos-users.mjs
 *
 * Emails default to @discountdiscoveryzone.com — edit STAFF below if needed.
 * Passwords are printed once; users should change them after first login (Settings → reset via admin).
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STAFF = [
  { full_name: 'Naomi', email: 'naomi.pos@discountdiscoveryzone.com' },
  { full_name: 'Susan', email: 'susan.pos@discountdiscoveryzone.com' },
  { full_name: 'Emmanuella', email: 'emmanuella.pos@discountdiscoveryzone.com' },
];

function randomPassword() {
  return crypto.randomBytes(10).toString('base64url').slice(0, 16) + 'Aa1!';
}

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Creating staff_pos users...\n');

  for (const row of STAFF) {
    const password = randomPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: row.full_name },
    });

    if (error) {
      if (String(error.message).toLowerCase().includes('already')) {
        console.log(`Auth user already exists: ${row.email}`);
        const { data: prof } = await supabase.from('profiles').select('id').eq('email', row.email).maybeSingle();
        if (prof?.id) {
          await supabase
            .from('profiles')
            .update({ role: 'staff_pos', full_name: row.full_name })
            .eq('id', prof.id);
          console.log(`  Updated profile to staff_pos for ${row.email}\n`);
        } else {
          console.warn(`  No profile row for ${row.email}; fix manually in Supabase.\n`);
        }
        continue;
      }
      console.error(`Failed ${row.email}:`, error.message);
      continue;
    }

    const userId = data.user?.id;
    if (!userId) {
      console.error('No user id for', row.email);
      continue;
    }

    const { error: upErr } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email: row.email,
        full_name: row.full_name,
        role: 'staff_pos',
      },
      { onConflict: 'id' }
    );

    if (upErr) {
      console.error('Profile update failed:', row.email, upErr.message);
      continue;
    }

    console.log(`OK: ${row.full_name} <${row.email}>`);
    console.log(`    Temporary password: ${password}\n`);
  }

  console.log('Done. Share passwords securely; ask users to change after login.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
