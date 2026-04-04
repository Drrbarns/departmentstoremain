#!/usr/bin/env node
/**
 * Backfill missing stock deductions for paid POS/walk-in orders.
 *
 * Strategy:
 * - Find orders where metadata.pos_sale is true and payment_status is paid
 * - Keep only those without metadata.stock_reduced = true
 * - Call mark_order_paid(order_number, ref) for each (idempotent stock reduction)
 *
 * Usage:
 *   node scripts/backfill-pos-stock-reduction.mjs
 *   node scripts/backfill-pos-stock-reduction.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isDryRun = process.argv.includes('--dry-run');

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

function isPosSale(metadata) {
  return metadata?.pos_sale === true || metadata?.pos_sale === 'true';
}

function stockReduced(metadata) {
  return metadata?.stock_reduced === true || metadata?.stock_reduced === 'true';
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, metadata, created_at')
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const candidates = (data || []).filter((o) => isPosSale(o.metadata) && !stockReduced(o.metadata));

  console.log(`Paid orders scanned: ${(data || []).length}`);
  console.log(`POS paid missing stock_reduced: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  if (isDryRun) {
    for (const o of candidates.slice(0, 50)) {
      console.log(`[dry-run] ${o.order_number}`);
    }
    if (candidates.length > 50) {
      console.log(`... and ${candidates.length - 50} more`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const o of candidates) {
    const ref = `pos-backfill-${Date.now()}`;
    const { error: rpcError } = await supabase.rpc('mark_order_paid', {
      order_ref: o.order_number,
      moolre_ref: ref
    });
    if (rpcError) {
      fail += 1;
      console.error(`[fail] ${o.order_number}: ${rpcError.message}`);
      continue;
    }
    ok += 1;
    console.log(`[ok] ${o.order_number}`);
  }

  console.log(`Done. backfilled=${ok} failed=${fail}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

