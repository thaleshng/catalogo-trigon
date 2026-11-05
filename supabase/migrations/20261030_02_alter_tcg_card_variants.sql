-- ============================================================================
-- TRIGON TCG — Atualização da tabela tcg_card_variants
-- Torna collection_id opcional (NULL) e adiciona category_id opcional (Linha de Produtos)
-- ============================================================================

-- 1. Tornar collection_id opcional (pois a carta já carrega sua coleção em tcg_cards)
ALTER TABLE public.tcg_card_variants
  ALTER COLUMN collection_id DROP NOT NULL;

-- 2. Ajustar a foreign key de collection_id para ON DELETE SET NULL
ALTER TABLE public.tcg_card_variants
  DROP CONSTRAINT IF EXISTS tcg_card_variants_collection_id_fkey;

ALTER TABLE public.tcg_card_variants
  ADD CONSTRAINT tcg_card_variants_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

-- 3. Adicionar coluna opcional category_id (para vincular a uma Linha de Produtos do site)
ALTER TABLE public.tcg_card_variants
  ADD COLUMN IF NOT EXISTS category_id uuid NULL
  REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4. Atualizar constraint de unicidade da variante (carta + condição + idioma + acabamento)
ALTER TABLE public.tcg_card_variants
  DROP CONSTRAINT IF EXISTS uq_tcg_card_variant;

ALTER TABLE public.tcg_card_variants
  ADD CONSTRAINT uq_tcg_card_variant
  UNIQUE (card_id, condition, language, finish);

-- 5. Criar índice para category_id
CREATE INDEX IF NOT EXISTS idx_tcg_card_variants_category_id
  ON public.tcg_card_variants(category_id);

-- 6. Recarregar o cache de schema do PostgREST / Supabase
NOTIFY pgrst, 'reload schema';

