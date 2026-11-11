-- ==============================================================================
-- TRIGON TCG — Migration Não-Destrutiva: Gaveta de Envio (Estoque/Catálogo) & Envios
-- Data: 2026-11-10
-- Objetivo:
--   1. Tabela para produtos e cartas do estoque adicionados à Gaveta de Envio
--   2. Tabela para histórico consolidado de despachos/envios e rastreio
--   3. Recuperação e contabilização das vendas já realizadas (Diego Antônio e Thalisson Oliveira)
-- ==============================================================================

-- 1. Tabela de Itens de Estoque/Catálogo na Gaveta do Cliente (customer_vault_stock_items)
CREATE TABLE IF NOT EXISTS public.customer_vault_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.tcg_card_variants(id) ON DELETE SET NULL,
  product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  subtitle text NULL,
  condition text NULL,
  language text NULL,
  finish text NULL,
  image_url text NULL,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  payment_status text NOT NULL DEFAULT 'PAGO' CHECK (payment_status IN ('PENDENTE', 'PAGO')),
  shipping_status text NOT NULL DEFAULT 'NAO_SOLICITADO' CHECK (shipping_status IN ('NAO_SOLICITADO', 'SOLICITADO', 'ENVIADO', 'RECEBIDO')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_vault_stock_items_customer_id ON public.customer_vault_stock_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_vault_stock_items_variant_id ON public.customer_vault_stock_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_customer_vault_stock_items_product_id ON public.customer_vault_stock_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_vault_stock_items_statuses ON public.customer_vault_stock_items(payment_status, shipping_status);
CREATE INDEX IF NOT EXISTS idx_customer_vault_stock_items_created_at ON public.customer_vault_stock_items(created_at DESC);

-- 2. Tabela de Pacotes Despachados / Histórico de Envios (customer_shipments)
CREATE TABLE IF NOT EXISTS public.customer_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NULL,
  customer_address text NULL,
  tracking_code text NULL,
  carrier text NOT NULL DEFAULT 'CORREIOS_MINI',
  custom_carrier_name text NULL,
  shipping_cost numeric(12, 2) NULL,
  status text NOT NULL DEFAULT 'ENVIADO' CHECK (status IN ('ENVIADO', 'RECEBIDO')),
  total_items_count integer NOT NULL DEFAULT 0,
  total_value numeric(12, 2) NOT NULL DEFAULT 0,
  is_quest_closure boolean NOT NULL DEFAULT false,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NULL,
  dispatched_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  delivered_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_shipments_customer_id ON public.customer_shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_shipments_status ON public.customer_shipments(status);
CREATE INDEX IF NOT EXISTS idx_customer_shipments_dispatched_at ON public.customer_shipments(dispatched_at DESC);

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_customer_vault_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customer_vault_stock_items_updated_at ON public.customer_vault_stock_items;
CREATE TRIGGER trigger_customer_vault_stock_items_updated_at
  BEFORE UPDATE ON public.customer_vault_stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_vault_updated_at();

DROP TRIGGER IF EXISTS trigger_customer_shipments_updated_at ON public.customer_shipments;
CREATE TRIGGER trigger_customer_shipments_updated_at
  BEFORE UPDATE ON public.customer_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_vault_updated_at();

-- 4. Permissões Row Level Security (RLS) - Permissões completas para acesso administrativo
ALTER TABLE public.customer_vault_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_shipments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_vault_stock_items' AND policyname = 'Public and authenticated full access on customer_vault_stock_items'
  ) THEN
    CREATE POLICY "Public and authenticated full access on customer_vault_stock_items"
      ON public.customer_vault_stock_items
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_shipments' AND policyname = 'Public and authenticated full access on customer_shipments'
  ) THEN
    CREATE POLICY "Public and authenticated full access on customer_shipments"
      ON public.customer_shipments
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- 5. CONTABILIZAÇÃO E RECUPERAÇÃO DAS 2 VENDAS JÁ EFETUADAS NA GAVETA DOS CLIENTES
-- Venda 1: Diego Antônio (2 un. Blister Triplo - Reinado Delta)
INSERT INTO public.customer_vault_stock_items (
  customer_id,
  product_id,
  name,
  subtitle,
  condition,
  language,
  image_url,
  unit_price,
  cost_price,
  quantity,
  payment_status,
  shipping_status,
  notes,
  created_at
)
SELECT 
  '68474096-170b-4c22-a6ad-a57331be56f4'::uuid AS customer_id,
  '4df1cc6b-e346-4038-8dba-ad9c71b2d952'::uuid AS product_id,
  'Blister Triplo - Reinado Delta',
  '2x un. • Produto do Catálogo',
  'Mint / Fresh Pack',
  'Português',
  'https://yhwussobckwfpxujkizp.supabase.co/storage/v1/object/public/trigon-catalog-images/products/1794012529705-wweltc9.webp',
  32.50,
  0,
  2,
  'PAGO',
  'NAO_SOLICITADO',
  'Venda via WhatsApp (Recuperada automaticamente)',
  '2026-11-07 00:50:09.893618+00'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_vault_stock_items 
  WHERE customer_id = '68474096-170b-4c22-a6ad-a57331be56f4'::uuid 
    AND product_id = '4df1cc6b-e346-4038-8dba-ad9c71b2d952'::uuid
    AND shipping_status IN ('NAO_SOLICITADO', 'SOLICITADO')
);

-- Venda 2: Thalisson Oliveira (1 un. Blister Triplo - Reinado Delta)
INSERT INTO public.customer_vault_stock_items (
  customer_id,
  product_id,
  name,
  subtitle,
  condition,
  language,
  image_url,
  unit_price,
  cost_price,
  quantity,
  payment_status,
  shipping_status,
  notes,
  created_at
)
SELECT 
  'ea6e0b45-4f49-49bd-b761-c0a3a695f6bc'::uuid AS customer_id,
  '4df1cc6b-e346-4038-8dba-ad9c71b2d952'::uuid AS product_id,
  'Blister Triplo - Reinado Delta',
  'Produto do Catálogo',
  'Mint / Fresh Pack',
  'Português',
  'https://yhwussobckwfpxujkizp.supabase.co/storage/v1/object/public/trigon-catalog-images/products/1794012529705-wweltc9.webp',
  32.50,
  0,
  1,
  'PAGO',
  'NAO_SOLICITADO',
  'Venda via WhatsApp (Recuperada automaticamente)',
  '2026-11-07 00:57:36.616427+00'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_vault_stock_items 
  WHERE customer_id = 'ea6e0b45-4f49-49bd-b761-c0a3a695f6bc'::uuid 
    AND product_id = '4df1cc6b-e346-4038-8dba-ad9c71b2d952'::uuid
    AND shipping_status IN ('NAO_SOLICITADO', 'SOLICITADO')
);

