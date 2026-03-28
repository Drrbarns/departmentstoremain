import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parsePublicStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const marker = '/storage/v1/object/public/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const [bucket, ...pathParts] = rest.split('/');
    const path = pathParts.join('/');
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

function getExt(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

function getContentType(ext) {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

async function collectImageUrls() {
  const urls = new Set();

  const { data: productImages, error: productImageErr } = await supabase
    .from('product_images')
    .select('url');
  if (productImageErr) throw productImageErr;
  for (const row of productImages || []) if (row?.url) urls.add(row.url);

  const { data: variants, error: variantErr } = await supabase
    .from('product_variants')
    .select('image_url')
    .not('image_url', 'is', null);
  if (variantErr) throw variantErr;
  for (const row of variants || []) if (row?.image_url) urls.add(row.image_url);

  const { data: categories, error: categoryErr } = await supabase
    .from('categories')
    .select('image_url');
  if (categoryErr) throw categoryErr;
  for (const row of categories || []) if (row?.image_url) urls.add(row.image_url);

  const { data: settings, error: settingsErr } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['site_logo', 'site_logo_white']);
  if (settingsErr) throw settingsErr;
  for (const row of settings || []) {
    if (row?.value == null) continue;
    let value = row.value;
    if (typeof value !== 'string') value = String(value);
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        // keep as-is
      }
    }
    if (value) urls.add(value);
  }

  return [...urls];
}

async function optimizeObject(bucket, path) {
  const ext = getExt(path);
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return { skipped: true, reason: `unsupported extension .${ext || 'none'}` };
  }

  const { data: file, error: downloadErr } = await supabase.storage.from(bucket).download(path);
  if (downloadErr || !file) {
    return { skipped: true, reason: `download failed: ${downloadErr?.message || 'unknown'}` };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const beforeSize = inputBuffer.length;
  if (!beforeSize) return { skipped: true, reason: 'empty file' };

  const MAX_WIDTH = 1200;
  let pipeline = sharp(inputBuffer);
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = sharp(inputBuffer).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let outputBuffer;
  if (ext === 'jpg' || ext === 'jpeg') {
    outputBuffer = await pipeline.jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  } else if (ext === 'png') {
    outputBuffer = await pipeline.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer();
  } else {
    outputBuffer = await pipeline.webp({ quality: 72, effort: 6 }).toBuffer();
  }

  const afterSize = outputBuffer.length;
  if (afterSize >= beforeSize) {
    return { skipped: true, reason: 'already optimized', beforeSize, afterSize };
  }

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(path, outputBuffer, {
      upsert: true,
      cacheControl: '31536000',
      contentType: getContentType(ext),
    });

  if (uploadErr) {
    return { skipped: true, reason: `upload failed: ${uploadErr.message}`, beforeSize, afterSize };
  }

  return { optimized: true, beforeSize, afterSize };
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  console.log('Collecting image URLs from database...');
  const urls = await collectImageUrls();
  const objects = [];
  const seen = new Set();

  for (const url of urls) {
    const parsed = parsePublicStorageUrl(url);
    if (!parsed) continue;
    const key = `${parsed.bucket}/${parsed.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    objects.push(parsed);
  }

  console.log(`Found ${objects.length} unique storage objects to process.`);

  let optimizedCount = 0;
  let skippedCount = 0;
  let beforeTotal = 0;
  let afterTotal = 0;

  const concurrency = 8;
  let cursor = 0;

  async function worker() {
    while (cursor < objects.length) {
      const index = cursor;
      cursor += 1;
      const obj = objects[index];
      const label = `[${index + 1}/${objects.length}] ${obj.bucket}/${obj.path}`;
      try {
        const res = await optimizeObject(obj.bucket, obj.path);
        if (res.optimized) {
          optimizedCount += 1;
          beforeTotal += res.beforeSize;
          afterTotal += res.afterSize;
          console.log(`${label} -> optimized (${((1 - res.afterSize / res.beforeSize) * 100).toFixed(1)}% smaller)`);
        } else {
          skippedCount += 1;
          console.log(`${label} -> skipped (${res.reason})`);
        }
      } catch (err) {
        skippedCount += 1;
        console.log(`${label} -> skipped (${err.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log('\nDone.');
  console.log(`Optimized: ${optimizedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Total before: ${formatMb(beforeTotal)}`);
  console.log(`Total after: ${formatMb(afterTotal)}`);
  console.log(`Saved: ${formatMb(beforeTotal - afterTotal)}`);
}

main().catch((err) => {
  console.error('Optimization failed:', err);
  process.exit(1);
});

