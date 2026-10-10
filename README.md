# TRIGON — Catálogo Digital & Gestão de Colecionáveis TCG

Aplicação web moderna, minimalista e premium desenvolvida para a **TRIGON**, loja especializada em Pokémon TCG, colecionáveis raros e acessórios de alta performance.

O projeto oferece um catálogo digital público organizado por coleções para visualização de produtos e compra direta via WhatsApp, acompanhado de um painel administrativo completo para controle de coleções, produtos e estoque.

---

## 🚀 Tecnologias Utilizadas

- **React 18** + **Vite 4** + **TypeScript**
- **Tailwind CSS 3** (Tema escuro customizado com preto ônix, grafite profundo e acentos em vermelho carmesim)
- **React Router 6/7** (Navegação SPA com URLs amigáveis baseadas em *slugs*)
- **Supabase Auth** para login administrativo
- **Lucide React** (Ícones modernos e consistentes)
- **Persistência Temporária via localStorage** (Simulação desacoplada com camada de serviços pronta para Supabase)
- **Deploy Ready para Vercel** (`vercel.json` configurado com reescritas para SPA)

---

## 🎨 Identidade Visual e Recursos

- **Logo Oficial TRIGON:** Posicionada em destaque no header, no hero, no footer e no menu administrativo.
- **Hero Background:** Arte imersiva de alta resolução integrada com iluminação carmesim, eclipse e pilares místicos.
- **Efeito Holo Foil & Micro-interações:** Cards de produtos colecionáveis com animação holográfica ao passar o cursor, sombras dinâmicas e transições suaves.
- **Mobile First:** Layout 100% responsivo com menu drawer para smartphones e tablets.

---

## 📂 Estrutura e Organização do Projeto

```text
catalogo-trigon/
├── public/
│   ├── images/
│   │   ├── trigon-logo.png          # Logo oficial TRIGON
│   │   └── trigon-hero-bg.jpg       # Background temático oficial
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── catalog/                 # Componentes do catálogo público
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── CollectionCard.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   └── ProductGallery.tsx
│   │   └── common/                  # Componentes reutilizáveis
│   │       ├── Badge.tsx
│   │       ├── Breadcrumbs.tsx
│   │       ├── Button.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   ├── config/
│   │   └── site.ts                  # Centraliza WhatsApp, mensagens e redes
│   ├── layouts/
│   │   ├── PublicLayout.tsx         # Layout do catálogo público
│   │   └── AdminLayout.tsx          # Layout do painel administrativo
│   ├── mocks/
│   │   ├── mockCollections.ts       # Coleções iniciais (30 Anos, 151, etc.)
│   │   ├── mockProducts.ts          # Produtos iniciais (Cartas SAR, ETBs, Displays)
│   │   └── mockMovements.ts         # Histórico de estoque inicial
│   ├── pages/
│   │   ├── HomePage.tsx             # Catálogo inicial com coleções
│   │   ├── CollectionPage.tsx       # Grade de produtos da coleção
│   │   ├── ProductDetailPage.tsx    # Detalhes do produto & WhatsApp
│   │   └── admin/
│   │       ├── AdminLoginPage.tsx   # Login demonstrativo
│   │       ├── AdminDashboardPage.tsx # Indicadores e estatísticas
│   │       ├── AdminCollectionsPage.tsx # CRUD de coleções
│   │       ├── AdminProductsPage.tsx    # CRUD de produtos
│   │       └── AdminStockPage.tsx       # Controle e histórico de estoque
│   ├── services/
│   │   ├── collectionService.ts     # Abstração de coleções
│   │   ├── productService.ts        # Abstração de produtos
│   │   ├── stockService.ts          # Abstração de estoque e dashboard
│   │   └── storageService.ts        # Gerenciamento de persistência local
│   ├── types/
│   │   └── index.ts                 # Interfaces TypeScript
│   └── utils/
│       ├── formatters.ts            # Moeda BRL (R$) e datas
│       ├── slugify.ts               # Geração de slugs para URLs
│       └── idGenerator.ts           # Gerador de IDs únicos
├── vercel.json                      # Configuração de redirecionamento SPA
├── tailwind.config.js
└── package.json
```

---

## 🛠️ Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js instalado (v16 ou superior)
- Gerenciador de pacotes `npm`

### Passo a Passo

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Abra seu navegador no endereço indicado (geralmente `http://localhost:5173/`).

4. Para testar o build de produção:
   ```bash
   npm run build
   npm run preview
   ```

### Configuração do Supabase Auth

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no arquivo `.env` local e nas variáveis de ambiente do provedor de deploy. O `.env` não deve ser enviado ao Git.

Crie ou convide o administrador em **Supabase → Authentication → Users** e desative o cadastro público se não for necessário. A tela `/admin/login` autentica esse usuário com Supabase Auth. Para proteger os dados, habilite RLS e configure políticas apropriadas nas tabelas; proteger a rota no frontend, por si só, não substitui essas políticas.

---

## 📱 Configuração do WhatsApp

Para alterar o número do WhatsApp da loja e a mensagem predefinida, edite apenas o arquivo:
`src/config/site.ts`

```typescript
export const SITE_CONFIG = {
  whatsapp: {
    number: '5511999999999', // Insira DDI + DDD + Número sem traços ou parênteses
    formattedNumber: '(11) 99999-9999',
    buildPurchaseMessage: (productName, price, productUrl) => { ... }
  }
};
```

---

## ⚡ Integração Futura com o Supabase

A arquitetura do projeto foi estruturada com **camada de serviços desacoplada**, onde todas as chamadas retornam `Promise<T>`. 

Os componentes de UI nunca tocam o `localStorage` diretamente.

### Modelo de Dados Recomendado no Supabase (SQL)

```sql
-- 1. Tabela de Coleções
create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  cover_image text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Produtos
create table products (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete restrict,
  name text not null,
  slug text unique not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  images text[] not null default '{}',
  is_active boolean default true,
  rarity text,
  language text default 'Português',
  condition text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Movimentações de Estoque
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  product_name text not null,
  type text check (type in ('ENTRADA', 'SAIDA')) not null,
  quantity integer check (quantity > 0) not null,
  reason text not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  previous_stock integer not null,
  new_stock integer not null
);
```

### Como substituir a persistência pelo Supabase:

1. Instale o cliente Supabase:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Crie o arquivo `src/services/supabase.ts` com suas credenciais:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```

3. Nos arquivos `collectionService.ts`, `productService.ts` e `stockService.ts`, substitua os métodos que usam `StorageService` por queries do `supabase.from('...')`. 

Nenhum componente ou página de catálogo precisará ser alterado!

---

## 🛡️ Demonstração do Painel Administrativo

- Acesso direto pela barra de navegação ou pela rota: `/admin`
- Tela de login demonstrativa: `/admin/login`
- Permite criar, editar e excluir coleções e produtos em tempo real.
- Permite controle manual de estoque e ajustes rápidos com botões `+1`, `+5`, `-1`, `-5`.
- Se quiser redefinir os dados para o padrão inicial, basta clicar em **"Restaurar Mocks"** na barra lateral do painel.
