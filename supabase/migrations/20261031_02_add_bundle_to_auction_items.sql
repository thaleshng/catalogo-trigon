-- ==============================================================================
-- TRIGON TCG — Migration: Suporte a Duplas / Combos de Cartas nos Leilões
-- Data: 2026-10-31
-- ==============================================================================

-- Adiciona campos para suporte a lotes combo (duplas, trios ou conjuntos de cartas)
ALTER TABLE public.tcg_auction_items 
ADD COLUMN IF NOT EXISTS is_bundle boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bundle_variant_ids uuid[] NULL,
ADD COLUMN IF NOT EXISTS bundle_items jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_tcg_auction_items_is_bundle ON public.tcg_auction_items(is_bundle);

