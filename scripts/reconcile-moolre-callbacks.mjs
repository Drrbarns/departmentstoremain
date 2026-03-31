#!/usr/bin/env node
/**
 * Parse Moolre dashboard export (callback.txt) and print SQL to reconcile unpaid orders.
 *
 * Usage:
 *   node scripts/reconcile-moolre-callbacks.mjs /path/to/callback.txt
 *   node scripts/reconcile-moolre-callbacks.mjs /path/to/callback.txt --dry-run
 *
 * --dry-run: only list parsed rows (no SQL)
 * default: prints a DO block for Supabase SQL editor / MCP execute_sql
 *
 * Customer confirmations after backfill: Admin → Payment reconciliation →
 * "Resend confirmations (Moolre backfill list)", or POST /api/admin/resend-order-confirmations
 * with {"preset":"moolre_mar2026_reconcile"} and admin Bearer token.
 */

import fs from 'fs';

const file = process.argv[2] || `${process.env.HOME}/Downloads/callback.txt`;
const dry = process.argv.includes('--dry-run');

if (!fs.existsSync(file)) {
  console.error('File not found:', file);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');

const rows = [];
for (const line of lines) {
  const t = line.trim();
  if (!t.startsWith('{"status":')) continue;
  try {
    const j = JSON.parse(t.replace(/,\s*}$/, '}').replace(/,\s*}\s*$/, '}'));
    if (j.status !== 1 || !j.data) continue;
    const d = j.data;
    const tx = d.txstatus ?? d.txtstatus;
    if (tx !== 1 && tx !== '1') continue;
    const ext = d.externalref;
    if (!ext) continue;
    const orderRef = String(ext).replace(/-R\d+$/, '');
    const amt = parseFloat(d.amount ?? d.value);
    const txid = String(d.transactionid ?? d.thirdpartyref ?? 'moolre-import');
    if (!orderRef || Number.isNaN(amt)) continue;
    rows.push({ orderRef, amt, txid, ts: d.ts || '' });
  } catch {
    // skip
  }
}

// Dedupe by orderRef: keep row with lexicographically greatest tx id (usually higher = newer)
const byOrder = new Map();
for (const r of rows) {
  const prev = byOrder.get(r.orderRef);
  if (!prev || r.txid > prev.txid) byOrder.set(r.orderRef, r);
}

const unique = [...byOrder.values()].sort((a, b) => a.orderRef.localeCompare(b.orderRef));

if (dry) {
  console.log(JSON.stringify(unique, null, 2));
  console.error('Count:', unique.length);
  process.exit(0);
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const values = unique
  .map((r) => `('${esc(r.orderRef)}','${esc(r.txid)}',${r.amt}::numeric)`)
  .join(',\n    ');

const sql = `
DO $body$
DECLARE
  r record;
  j jsonb;
  o_id uuid;
  o_pay payment_status;
  o_total numeric;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ${values}
    ) AS t(order_ref, moolre_ref, callback_amount)
  LOOP
    SELECT id, payment_status, total
    INTO o_id, o_pay, o_total
    FROM public.orders
    WHERE order_number = r.order_ref;

    IF NOT FOUND THEN
      RAISE NOTICE 'SKIP no order: %', r.order_ref;
      CONTINUE;
    END IF;

    IF o_pay = 'paid' THEN
      RAISE NOTICE 'SKIP already paid: %', r.order_ref;
      CONTINUE;
    END IF;

    IF ABS(o_total - r.callback_amount) > 0.02 THEN
      RAISE NOTICE 'SKIP amount mismatch %: order % vs callback %', r.order_ref, o_total, r.callback_amount;
      CONTINUE;
    END IF;

    SELECT public.mark_order_paid(r.order_ref, r.moolre_ref) INTO j;
    IF j IS NULL OR (j->>'id') IS NULL THEN
      RAISE NOTICE 'FAIL mark_order_paid: %', r.order_ref;
    ELSE
      RAISE NOTICE 'OK paid: %', r.order_ref;
    END IF;
  END LOOP;
END
$body$;
`;

process.stdout.write(sql);
