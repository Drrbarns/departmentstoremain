-- Replace legacy Vercel / wrong-number contact values in site_settings so DB matches production brand.

UPDATE public.site_settings
SET value = to_jsonb('info@discountdiscoveryzone.com'::text),
    updated_at = now()
WHERE key = 'contact_email'
  AND jsonb_typeof(value) = 'string'
  AND (
    lower(coalesce(value #>> '{}', '')) LIKE '%vercel.app%'
    OR lower(coalesce(value #>> '{}', '')) LIKE '%discount-discovery-zone%'
  );

UPDATE public.site_settings
SET value = to_jsonb('+233248615775'::text),
    updated_at = now()
WHERE key = 'contact_phone'
  AND jsonb_typeof(value) = 'string'
  AND regexp_replace(coalesce(value #>> '{}', ''), '\D', '', 'g') IN ('233209597443', '0209597443');
