-- ============================================================
-- Comprehensive product search
-- ============================================================
-- Replaces the old whole-phrase ILIKE search with a tiered, ranked
-- search RPC that the storefront calls when ?search= is present.
--
-- Ranking tiers (high → low):
--   1000  exact name match
--    950  exact SKU / barcode / POS store code
--    900  name starts with the query
--    850  name contains the whole phrase
--    820  SKU / barcode / store code prefix
--    700+ ALL query words appear in the name (any order)
--    600+ ALL words appear across name+brand+vendor+category+tags+variants
--    500+ ALL words appear anywhere (incl. descriptions + SEO text)
--    minor partial: SOME words match → scored by matched ratio (up to ~400)
--    trigram similarity floor catches typos/misspellings
--
-- Requires pg_trgm (already installed in `extensions` schema).

-- Trigram indexes so similarity + ILIKE scans stay fast as the catalog grows.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (lower(name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
  ON public.products USING gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_products(
  p_query text,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(id uuid, rank real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
WITH q AS (
  SELECT
    lower(btrim(p_query)) AS ql,
    -- split into words, drop empties and 1-char noise unless the whole query is short
    (SELECT array_agg(t) FROM (
       SELECT t FROM unnest(regexp_split_to_array(lower(btrim(p_query)), '\s+')) AS t
       WHERE length(t) >= 2 OR length(btrim(p_query)) < 2
     ) s) AS toks
),
scored AS (
  SELECT
    p.id,
    h.hay_core,
    h.hay_wide,
    q.ql,
    q.toks,
    coalesce(array_length(q.toks, 1), 0) AS ntoks,
    -- tokens matched in the product name only
    (SELECT count(*) FROM unnest(q.toks) t WHERE lower(p.name) LIKE '%' || t || '%') AS name_hits,
    -- tokens matched in core fields (name, brand, vendor, category, tags, variants, codes)
    (SELECT count(*) FROM unnest(q.toks) t WHERE h.hay_core LIKE '%' || t || '%') AS core_hits,
    -- tokens matched anywhere (incl. descriptions + SEO)
    (SELECT count(*) FROM unnest(q.toks) t WHERE h.hay_wide LIKE '%' || t || '%') AS wide_hits,
    p.featured,
    p.rating_avg,
    p.created_at,
    lower(p.name) AS lname,
    lower(coalesce(p.sku, ''))                    AS lsku,
    lower(coalesce(p.barcode, ''))                AS lbarcode,
    lower(coalesce(p.metadata->>'pos_code', ''))  AS lpos
  FROM public.products p
  CROSS JOIN q
  CROSS JOIN LATERAL (
    SELECT
      lower(
        coalesce(p.name, '') || ' ' ||
        replace(coalesce(p.slug, ''), '-', ' ') || ' ' ||
        coalesce(p.sku, '') || ' ' ||
        coalesce(p.barcode, '') || ' ' ||
        coalesce(p.metadata->>'pos_code', '') || ' ' ||
        coalesce(p.brand, '') || ' ' ||
        coalesce(p.vendor, '') || ' ' ||
        coalesce(array_to_string(p.tags, ' '), '') || ' ' ||
        coalesce((SELECT c.name FROM public.categories c WHERE c.id = p.category_id), '') || ' ' ||
        coalesce((
          SELECT string_agg(
                   coalesce(v.name,'') || ' ' || coalesce(v.option1,'') || ' ' ||
                   coalesce(v.option2,'') || ' ' || coalesce(v.option3,'') || ' ' ||
                   coalesce(v.sku,'') || ' ' || coalesce(v.barcode,''), ' ')
          FROM public.product_variants v WHERE v.product_id = p.id
        ), '')
      ) AS hay_core,
      lower(
        coalesce(p.name, '') || ' ' ||
        replace(coalesce(p.slug, ''), '-', ' ') || ' ' ||
        coalesce(p.sku, '') || ' ' ||
        coalesce(p.barcode, '') || ' ' ||
        coalesce(p.metadata->>'pos_code', '') || ' ' ||
        coalesce(p.brand, '') || ' ' ||
        coalesce(p.vendor, '') || ' ' ||
        coalesce(array_to_string(p.tags, ' '), '') || ' ' ||
        coalesce((SELECT c.name FROM public.categories c WHERE c.id = p.category_id), '') || ' ' ||
        coalesce((
          SELECT string_agg(
                   coalesce(v.name,'') || ' ' || coalesce(v.option1,'') || ' ' ||
                   coalesce(v.option2,'') || ' ' || coalesce(v.option3,'') || ' ' ||
                   coalesce(v.sku,'') || ' ' || coalesce(v.barcode,''), ' ')
          FROM public.product_variants v WHERE v.product_id = p.id
        ), '') || ' ' ||
        coalesce(p.short_description, '') || ' ' ||
        coalesce(p.description, '') || ' ' ||
        coalesce(p.seo_title, '') || ' ' ||
        coalesce(p.seo_description, '')
      ) AS hay_wide
  ) h
  WHERE p.status = 'active'
)
SELECT s.id,
       (GREATEST(
          -- Tier 1: direct hits
          CASE WHEN s.lname = s.ql THEN 1000 ELSE 0 END,
          CASE WHEN s.ql <> '' AND s.ql IN (s.lsku, s.lbarcode, s.lpos) THEN 950 ELSE 0 END,
          -- Tier 2: prefix / whole-phrase
          CASE WHEN s.lname LIKE s.ql || '%' THEN 900 ELSE 0 END,
          CASE WHEN s.lname LIKE '%' || s.ql || '%' THEN 850 ELSE 0 END,
          CASE WHEN s.ql <> '' AND (s.lsku LIKE s.ql || '%' OR s.lbarcode LIKE s.ql || '%' OR s.lpos LIKE s.ql || '%') THEN 820 ELSE 0 END,
          -- Tier 3: every word in the name, any order
          CASE WHEN s.ntoks > 0 AND s.name_hits = s.ntoks THEN 700 + 50 * s.ntoks ELSE 0 END,
          -- Tier 4: every word across core fields (brand/category/tags/variants/codes)
          CASE WHEN s.ntoks > 0 AND s.core_hits = s.ntoks THEN 600 ELSE 0 END,
          -- Tier 5: every word anywhere incl. descriptions
          CASE WHEN s.ntoks > 0 AND s.wide_hits = s.ntoks THEN 500 ELSE 0 END,
          -- Tier 6: partial word hits — some words match, score by ratio
          CASE WHEN s.ntoks > 0 AND s.wide_hits > 0
               THEN (300.0 * s.wide_hits / s.ntoks)
                    + CASE WHEN s.name_hits > 0 THEN 80 ELSE 0 END
               ELSE 0 END,
          -- Tier 7: typo tolerance via trigram similarity on the name
          (word_similarity(s.ql, s.lname) * 450)::real,
          (similarity(s.ql, s.lname) * 400)::real
        )
        -- light tie-break boosts (keep below one tier step)
        + CASE WHEN s.featured THEN 12 ELSE 0 END
        + LEAST(coalesce(s.rating_avg, 0), 5) * 2
       )::real AS rank
FROM scored s
WHERE
  -- keep anything with a real signal; trigram floor catches typos
  (
    s.lname LIKE '%' || s.ql || '%'
    OR (s.ql <> '' AND (s.lsku LIKE s.ql || '%' OR s.lbarcode LIKE s.ql || '%' OR s.lpos LIKE s.ql || '%'))
    OR s.wide_hits > 0
    OR word_similarity(s.ql, s.lname) >= 0.45
    OR similarity(s.ql, s.lname) >= 0.3
  )
ORDER BY rank DESC, s.featured DESC, s.rating_avg DESC NULLS LAST, s.created_at DESC
LIMIT GREATEST(p_limit, 1);
$$;

-- Storefront calls this anonymously.
GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.search_products(text, integer) IS
  'Tiered, ranked product search: exact > prefix > phrase > all-words > partial-words > trigram typo match. Searches name, slug, SKU, barcode, POS code, brand, vendor, tags, category, variants, descriptions and SEO text.';
