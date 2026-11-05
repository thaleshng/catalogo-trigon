-- ==============================================================================
-- TRIGON TCG — Migration Não-Destrutiva: Gerenciamento de Leilões
-- Data: 2026-10-31
-- ==============================================================================

-- 1. Tabela Principal de Leilões (tcg_auctions)
CREATE TABLE IF NOT EXISTS public.tcg_auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NULL,
  status text NOT NULL DEFAULT 'PRE_LEILAO' CHECK (status IN ('PRE_LEILAO', 'EM_ANDAMENTO', 'FINALIZADO')),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  payment_deadline_hours integer NOT NULL DEFAULT 48 CHECK (payment_deadline_hours > 0),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tcg_auctions_code ON public.tcg_auctions(code);
CREATE INDEX IF NOT EXISTS idx_tcg_auctions_status ON public.tcg_auctions(status);
CREATE INDEX IF NOT EXISTS idx_tcg_auctions_dates ON public.tcg_auctions(start_date DESC, end_date DESC);

-- 2. Tabela de Lotes / Itens do Leilão (tcg_auction_items)
CREATE TABLE IF NOT EXISTS public.tcg_auction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.tcg_auctions(id) ON DELETE CASCADE,
  card_variant_id uuid NULL REFERENCES public.tcg_card_variants(id) ON DELETE SET NULL,
  is_bundle boolean NOT NULL DEFAULT false,
  bundle_variant_ids uuid[] NULL,
  bundle_items jsonb NULL,
  is_freebie boolean NOT NULL DEFAULT false,
  is_custom_item boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  subtitle text NULL,
  condition text NULL,
  language text NULL,
  finish text NULL,
  initial_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (initial_price >= 0),
  bid_step numeric(12, 2) NOT NULL DEFAULT 1 CHECK (bid_step > 0),
  bid_options numeric(12, 2)[] NOT NULL DEFAULT '{}',
  final_price numeric(12, 2) NULL CHECK (final_price IS NULL OR final_price >= 0),
  cost_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  status text NOT NULL DEFAULT 'EM_LEILAO' CHECK (status IN ('EM_LEILAO', 'ARREMATADO', 'NAO_ARREMATADO')),
  winning_customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'PENDENTE' CHECK (payment_status IN ('PENDENTE', 'PAGO', 'VENCIDO')),
  shipping_status text NOT NULL DEFAULT 'NAO_SOLICITADO' CHECK (shipping_status IN ('NAO_SOLICITADO', 'SOLICITADO', 'ENVIADO', 'RECEBIDO')),
  custom_photo_url text NULL,
  api_image_url text NULL,
  order_index integer NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tcg_auction_items_auction_id ON public.tcg_auction_items(auction_id);
CREATE INDEX IF NOT EXISTS idx_tcg_auction_items_card_variant_id ON public.tcg_auction_items(card_variant_id);
CREATE INDEX IF NOT EXISTS idx_tcg_auction_items_winning_customer ON public.tcg_auction_items(winning_customer_id);
CREATE INDEX IF NOT EXISTS idx_tcg_auction_items_statuses ON public.tcg_auction_items(status, payment_status, shipping_status);

-- Triggers para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_tcg_auctions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tcg_auctions_updated_at ON public.tcg_auctions;
CREATE TRIGGER trigger_tcg_auctions_updated_at
  BEFORE UPDATE ON public.tcg_auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tcg_auctions_updated_at();

DROP TRIGGER IF EXISTS trigger_tcg_auction_items_updated_at ON public.tcg_auction_items;
CREATE TRIGGER trigger_tcg_auction_items_updated_at
  BEFORE UPDATE ON public.tcg_auction_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tcg_auctions_updated_at();

