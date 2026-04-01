#!/usr/bin/env node
/**
 * Send order-confirmation SMS only (same wording as checkout) for paid web orders.
 * Reads .env.local from repo root: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * MOOLRE_SMS_API_KEY, MOOLRE_SMS_SENDER_ID (optional), NEXT_PUBLIC_APP_URL (optional).
 *
 * Skips POS orders (pos_sale). Skips rows with no phone.
 *
 *   node scripts/send-bulk-confirmation-sms.mjs
 *   node scripts/send-bulk-confirmation-sms.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

const ORDER_NUMBERS = `ORD-1774643821651-701
ORD-1774645453678-159
ORD-1774646995850-822
ORD-1774648687287-543
ORD-1774735286322-791
ORD-1774742704416-277
ORD-1774743020889-746
ORD-1774743375810-901
ORD-1774750530902-650
ORD-1774754759931-80
ORD-1774757739447-687
ORD-1774758976297-4
ORD-1774778809361-929
ORD-1774784667992-849
ORD-1774790576289-186
ORD-1774791152170-935
ORD-1774791783999-853
ORD-1774794313396-8
ORD-1774796361731-769
ORD-1774801275851-707
ORD-1774803312400-178
ORD-1774809541070-434
ORD-1774810078615-678
ORD-1774810336092-464
ORD-1774815138868-304
ORD-1774851532591-451
ORD-1774858815518-261
ORD-1774871759429-700
ORD-1774879668013-234
ORD-1774898255430-70
ORD-1774913754348-866
ORD-1774914939659-754
ORD-1774940345499-737
ORD-1774945211237-999
ORD-1774945963155-833
ORD-1774946423675-128
ORD-1774947439104-700
ORD-1774947485155-200
ORD-1774947830939-12
ORD-1774948842664-280
ORD-1774949751765-810
ORD-1774949964687-419
ORD-1774950802350-684
ORD-1774951315319-295
ORD-1774951813230-663
ORD-1774953044586-555
ORD-1774954173260-401
ORD-1774954381800-952
ORD-1774960353141-611`
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

function formatRecipient(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '233' + cleaned.slice(1);
  if (!cleaned.startsWith('233') && cleaned.length === 9) cleaned = '233' + cleaned;
  return '+' + cleaned;
}

function customerName(order) {
  const sa = order.shipping_address || {};
  const m = order.metadata || {};
  if (sa.full_name) return sa.full_name;
  if (sa.firstName) return sa.lastName ? `${sa.firstName} ${sa.lastName}` : sa.firstName;
  if (m.first_name) return m.last_name ? `${m.first_name} ${m.last_name}` : m.first_name;
  return 'Customer';
}

function isPos(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return metadata.pos_sale === true || metadata.pos_sale === 'true';
}

async function sendMoolreSms(recipient, message, vasKey, senderId) {
  const res = await fetch('https://api.moolre.com/open/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-VASKEY': vasKey,
    },
    body: JSON.stringify({
      type: 1,
      senderid: senderId || 'DD Zone',
      messages: [{ recipient, message }],
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok && json?.status === 1, json, http: res.status };
}

async function main() {
  loadEnvLocal();
  const dry = process.argv.includes('--dry-run');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vasKey = process.env.MOOLRE_SMS_API_KEY;
  const senderId = process.env.MOOLRE_SMS_SENDER_ID || 'DD Zone';
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.discountdiscoveryzone.com').replace(/\/$/, '');

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!vasKey && !dry) {
    console.error('Missing MOOLRE_SMS_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const order_number of ORDER_NUMBERS) {
    const { data: order, error } = await supabase.from('orders').select('*').eq('order_number', order_number).maybeSingle();

    if (error || !order) {
      console.error('[skip]', order_number, error?.message || 'not found');
      skipped++;
      continue;
    }

    if (order.payment_status !== 'paid') {
      console.log('[skip not paid]', order_number);
      skipped++;
      continue;
    }

    if (isPos(order.metadata)) {
      console.log('[skip POS]', order_number);
      skipped++;
      continue;
    }

    const phone = order.phone || order.shipping_address?.phone;
    if (!phone) {
      console.log('[skip no phone]', order_number);
      skipped++;
      continue;
    }

    const name = customerName(order);
    const trackingNumber = order.metadata?.tracking_number || '';
    const trackingUrl = `${baseUrl}/order-tracking?order=${order.order_number || order.id}`;

    let shippingNotesSms = '';
    const { data: items } = await supabase.from('order_items').select('product_name, metadata').eq('order_id', order.id);
    if (items?.length) {
      const notes = [];
      for (const item of items) {
        const pre = item.metadata?.preorder_shipping;
        if (pre) notes.push(`${item.product_name}: ${pre}`);
      }
      if (notes.length) shippingNotesSms = ` Note: ${notes.join('; ')}.`;
    }

    const smsMessage = trackingNumber
      ? `Hi ${name}, your order #${order.order_number || order.id} is confirmed! Tracking: ${trackingNumber}. Track here: ${trackingUrl}${shippingNotesSms}`
      : `Hi ${name}, your order #${order.order_number || order.id} at Discount Discovery Zone is confirmed! Track here: ${trackingUrl}${shippingNotesSms}`;

    const recipient = formatRecipient(phone);

    if (dry) {
      console.log('[dry-run]', order_number, '→', recipient.slice(0, 8) + '…');
      sent++;
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    const r = await sendMoolreSms(recipient, smsMessage, vasKey, senderId);
    if (r.ok) {
      console.log('[ok]', order_number);
      sent++;
    } else {
      console.error('[fail]', order_number, r.http, JSON.stringify(r.json).slice(0, 200));
      errors.push({ order_number, detail: r.json });
    }

    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  console.log('\nDone. SMS attempts (ok path):', sent, '| skipped:', skipped, '| hard fails:', errors.length);
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
