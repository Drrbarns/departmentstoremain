#!/usr/bin/env node
/**
 * Create or update a staff-capable user (role: staff, admin, or staff_pos).
 *
 * Reads .env.local from repo root for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 *   node scripts/create-staff-user.mjs <email> <password> [role]
 *
 * Default role: staff
 * Example:
 *   node scripts/create-staff-user.mjs admin@gyan.com 'YourPassword' staff
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ALLOWED_ROLES = new Set(['staff', 'admin', 'staff_pos']);

function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function findAuthUserIdByEmail(supabase, email) {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === needle);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

async function main() {
  loadEnvLocal();

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const email = process.argv[2]?.trim();
  const password = process.argv[3];
  const role = (process.argv[4] || 'staff').trim();

  if (!email || !password) {
    console.error('Usage: node scripts/create-staff-user.mjs <email> <password> [role]');
    process.exit(1);
  }

  if (!ALLOWED_ROLES.has(role)) {
    console.error(`Role must be one of: ${[...ALLOWED_ROLES].join(', ')}`);
    process.exit(1);
  }

  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const localPart = email.split('@')[0] || 'Staff';
  const full_name = localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  let userId = data?.user?.id;

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      userId = prof?.id ?? (await findAuthUserIdByEmail(supabase, email));
      if (!userId) {
        console.error('User appears to exist in Auth but could not resolve id. Check Supabase Dashboard.');
        process.exit(1);
      }
      const { error: upAuth } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (upAuth) {
        console.error('Failed to update existing user:', upAuth.message);
        process.exit(1);
      }
      console.log(`Updated existing auth user: ${email}`);
    } else {
      console.error('createUser failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`Created auth user: ${email}`);
  }

  const { error: profErr } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name,
      role,
    },
    { onConflict: 'id' }
  );

  if (profErr) {
    console.error('Profile upsert failed:', profErr.message);
    process.exit(1);
  }

  console.log(`Profile role set to "${role}" for ${email}`);
  console.log('Done. Ask the user to sign in at /admin/login and change the password if this was temporary.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
