export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  collectionId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stockQuantity: number;
  images: string[];
  isActive: boolean;
  featured?: boolean;
  rarity?: string;
  language?: string;
  condition?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'ENTRADA' | 'SAIDA';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  date: string;
  previousStock: number;
  newStock: number;
  // Campos de rastreabilidade para Vendas
  unitPrice?: number;        // Preço unitário praticado na venda
  originalPrice?: number;    // Preço de tabela no momento da venda
  totalValue?: number;       // unitPrice * quantity
  channel?: string;          // WhatsApp, Balcão, Evento, etc.
  customerId?: string;       // ID do cliente cadastrado (opcional)
  customerName?: string;     // Identificação do comprador (opcional)
  paymentMethod?: string;    // Pix, Cartão, Dinheiro, etc.
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  // Endereço de Envio / Entrega
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  referencePoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleRegistrationData {
  productId: string;
  quantity: number;
  unitPrice: number;
  channel: string;
  customerId?: string;
  customerName?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface DashboardStats {
  totalProducts: number;
  availableProducts: number;
  outOfStockProducts: number;
  totalCollections: number;
  totalStockValue: number;
  totalSalesCount: number;
  totalRevenue: number;
}
