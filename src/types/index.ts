export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductOrganizationType = 'collection' | 'category';

export interface Product {
  id: string;
  collectionId?: string | null;
  categoryId?: string | null;
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

export type GiftStatus = 'reservado' | 'enviado';

export interface Gift {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerGift {
  id: string;
  customerId: string;
  giftId: string;
  status: GiftStatus;
  giftedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Relacionamentos carregados em joins para exibição
  gift?: Gift;
  customer?: Customer;
}

// ==============================================================================
// SISTEMA DE FIDELIDADE QUEST TRIGON
// ==============================================================================

export type QuestModality = 'jornada' | 'livre';
export type CustomerQuestStatus = 'em_andamento' | 'concluida' | 'cancelada';
export type QuestStepStatus = 'conquistada' | 'reservada' | 'enviada' | 'cancelada';

export interface QuestModel {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  piecesCount: number;
  level: number; // 1 a 5
  minValue: number;
  assemblyInstructions: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Indicadores de participação agregados
  activeParticipantsCount?: number;
  completedParticipantsCount?: number;
}

export interface CustomerQuestProgress {
  customerId: string;
  currentLevel: number; // 1 a 5
  totalQuestsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestClosure {
  id: string;
  customerId: string;
  totalValue: number;
  closureDate: string;
  saleReference?: string;
  notes?: string;
  isUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQuest {
  id: string;
  customerId: string;
  modelId: string;
  modality: QuestModality;
  status: CustomerQuestStatus;
  startedLevel: number;
  startedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  // Relacionamentos
  model?: QuestModel;
  customer?: Customer;
  steps?: QuestStep[];
  // Contadores calculados
  sentPiecesCount?: number;
  conqueredPiecesCount?: number;
  reservedPiecesCount?: number;
}

export interface QuestStep {
  id: string;
  customerQuestId: string;
  stepNumber: number;
  pieceName: string;
  normalizedPieceName: string;
  status: QuestStepStatus;
  closureId?: string | null;
  notes?: string;
  earnedAt: string;
  reservedAt?: string | null;
  sentAt?: string | null;
  isException: boolean;
  exceptionReason?: string;
  createdAt: string;
  updatedAt: string;
  closure?: QuestClosure;
}

export interface QuestAuditLog {
  id: string;
  customerQuestId?: string;
  stepId?: string;
  action: string;
  reason: string;
  actor?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}


