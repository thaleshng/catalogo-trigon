-- ==============================================================================
-- TRIGON TCG — Migration Não-Destrutiva: Catálogo TCGdex e Estoque de Cartas
-- Data: 2026-10-30
-- ==============================================================================

-- 1. Tabela de Cartas-Base identificadas pela TCGdex (tcg_cards)
CREATE TABLE IF NOT EXISTS public.tcg_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tcgdex_id text NOT NULL UNIQUE,
  name text NOT NULL,
  set_name text NOT NULL DEFAULT 'Não informado',
  set_code text NOT NULL DEFAULT 'Não informado',
  local_id text NOT NULL DEFAULT '—',
  total_cards integer NULL,
  image_url text NULL,
  rarity text NULL,
  category text NULL,
  hp integer NULL,
  types text[] NOT NULL DEFAULT '{}',
  illustrator text NULL,
  description text NULL,
  liga_pokemon_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tcg_cards_tcgdex_id ON public.tcg_cards(tcgdex_id);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_name ON public.tcg_cards(name);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_set_name ON public.tcg_cards(set_name);

-- 2. Tabela de Variantes de Estoque de Cartas (tcg_card_variants)
-- Prevalece a coleção original da carta (em tcg_cards.set_name).
-- Opcionalmente, a variante pode ser vinculada no estoque a uma Linha de Produtos (category_id)
-- ou Coleção de Produtos comercializados no site (collection_id).
CREATE TABLE IF NOT EXISTS public.tcg_card_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.tcg_cards(id) ON DELETE RESTRICT,
  collection_id uuid NULL REFERENCES public.collections(id) ON DELETE SET NULL,
  category_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  condition text NOT NULL,
  language text NOT NULL,
  finish text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  acquisition_cost numeric(12, 2) NULL CHECK (acquisition_cost IS NULL OR acquisition_cost >= 0),
  reference_value numeric(12, 2) NULL CHECK (reference_value IS NULL OR reference_value >= 0),
  sale_price numeric(12, 2) NULL CHECK (sale_price IS NULL OR sale_price >= 0),
  reference_date timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_tcg_card_variant UNIQUE (card_id, condition, language, finish)
);

CREATE INDEX IF NOT EXISTS idx_tcg_card_variants_card_id ON public.tcg_card_variants(card_id);
CREATE INDEX IF NOT EXISTS idx_tcg_card_variants_category_id ON public.tcg_card_variants(category_id);
CREATE INDEX IF NOT EXISTS idx_tcg_card_variants_collection_id ON public.tcg_card_variants(collection_id);
CREATE INDEX IF NOT EXISTS idx_tcg_card_variants_filters ON public.tcg_card_variants(condition, language, finish);

-- Ajustes não-destrutivos caso a tabela tenha sido criada anteriormente com collection_id NOT NULL
ALTER TABLE public.tcg_card_variants ALTER COLUMN collection_id DROP NOT NULL;
ALTER TABLE public.tcg_card_variants ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Tabela de Lotes de Aquisição (tcg_card_stock_lots)
-- Preserva o histórico de custos de aquisição sem sobrescrever lotes anteriores
CREATE TABLE IF NOT EXISTS public.tcg_card_stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.tcg_card_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12, 2) NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  entry_date timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  notes text NULL,
  actor text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tcg_card_stock_lots_variant_id ON public.tcg_card_stock_lots(variant_id);

-- 4. Tabela de Movimentações de Estoque de Cartas (tcg_card_stock_movements)
CREATE TABLE IF NOT EXISTS public.tcg_card_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.tcg_card_variants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
  quantity integer NOT NULL CHECK (quantity > 0),
  previous_stock integer NOT NULL CHECK (previous_stock >= 0),
  new_stock integer NOT NULL CHECK (new_stock >= 0),
  unit_cost numeric(12, 2) NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reason text NOT NULL,
  actor text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tcg_card_stock_movements_variant_id ON public.tcg_card_stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_tcg_card_stock_movements_created_at ON public.tcg_card_stock_movements(created_at DESC);

-- 5. Função RPC Atômica para Movimentação de Estoque de Cartas
CREATE OR REPLACE FUNCTION public.record_tcg_card_stock_movement(
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text,
  p_unit_cost numeric DEFAULT NULL,
  p_actor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_variant public.tcg_card_variants%ROWTYPE;
  v_prev_stock integer;
  v_new_stock integer;
  v_movement_id uuid;
  v_lot_id uuid := NULL;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade da movimentação deve ser um número inteiro positivo.';
  END IF;

  IF p_type NOT IN ('ENTRADA', 'SAIDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_type;
  END IF;

  SELECT * INTO v_variant
  FROM public.tcg_card_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante de carta não encontrada no estoque.';
  END IF;

  v_prev_stock := v_variant.quantity;

  IF p_type = 'ENTRADA' THEN
    v_new_stock := v_prev_stock + p_quantity;
  ELSIF p_type = 'SAIDA' THEN
    IF v_prev_stock < p_quantity THEN
      RAISE EXCEPTION 'Saldo insuficiente para a variante. Saldo atual: %, solicitado: %.', v_prev_stock, p_quantity;
    END IF;
    v_new_stock := v_prev_stock - p_quantity;
  ELSIF p_type = 'AJUSTE' THEN
    IF v_prev_stock < p_quantity THEN
      RAISE EXCEPTION 'Saldo insuficiente para ajuste de redução. Saldo atual: %, solicitado: %.', v_prev_stock, p_quantity;
    END IF;
    v_new_stock := v_prev_stock - p_quantity;
  END IF;

  UPDATE public.tcg_card_variants
  SET
    quantity = v_new_stock,
    acquisition_cost = COALESCE(p_unit_cost, acquisition_cost),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_variant_id;

  IF p_type = 'ENTRADA' THEN
    INSERT INTO public.tcg_card_stock_lots (
      variant_id,
      quantity,
      unit_cost,
      notes,
      actor
    ) VALUES (
      p_variant_id,
      p_quantity,
      p_unit_cost,
      p_reason,
      p_actor
    )
    RETURNING id INTO v_lot_id;
  END IF;

  INSERT INTO public.tcg_card_stock_movements (
    variant_id,
    type,
    quantity,
    previous_stock,
    new_stock,
    unit_cost,
    reason,
    actor
  ) VALUES (
    p_variant_id,
    p_type,
    p_quantity,
    v_prev_stock,
    v_new_stock,
    p_unit_cost,
    p_reason,
    p_actor
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'variant_id', p_variant_id,
    'movement_id', v_movement_id,
    'lot_id', v_lot_id,
    'previous_stock', v_prev_stock,
    'new_stock', v_new_stock
  );
END;
$$;

-- 6. Row Level Security (RLS)
ALTER TABLE public.tcg_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_card_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_card_stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_card_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tcg_cards' AND policyname = 'Admin full access on tcg_cards'
  ) THEN
    CREATE POLICY "Admin full access on tcg_cards"
      ON public.tcg_cards
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tcg_card_variants' AND policyname = 'Admin full access on tcg_card_variants'
  ) THEN
    CREATE POLICY "Admin full access on tcg_card_variants"
      ON public.tcg_card_variants
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tcg_card_stock_lots' AND policyname = 'Admin full access on tcg_card_stock_lots'
  ) THEN
    CREATE POLICY "Admin full access on tcg_card_stock_lots"
      ON public.tcg_card_stock_lots
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tcg_card_stock_movements' AND policyname = 'Admin full access on tcg_card_stock_movements'
  ) THEN
    CREATE POLICY "Admin full access on tcg_card_stock_movements"
      ON public.tcg_card_stock_movements
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
