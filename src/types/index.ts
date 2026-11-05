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

// ==============================================================================
// CATÁLOGO TCGDEX & ESTOQUE DE CARTAS TCG (VARIANTES)
// ==============================================================================

export interface CardConditionOption {
  value: string;
  label: string;
  shortLabel?: string;
  description?: string;
  badgeVariant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'crimson';
}

export interface CardLanguageOption {
  value: string;
  label: string;
  shortLabel?: string;
  description?: string;
  badgeVariant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'crimson';
}

export interface CardFinishOption {
  value: string;
  label: string;
  shortLabel?: string;
  description?: string;
  badgeVariant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'crimson';
}

export interface TcgdexSetSummary {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: {
    total: number;
    official: number;
  };
}

export interface TcgdexAttack {
  name: string;
  cost?: string[];
  damage?: string | number;
  effect?: string;
}

export interface TcgdexAbility {
  type?: string;
  name: string;
  effect?: string;
}

export interface TcgdexWeakness {
  type: string;
  value?: string;
}

export interface TcgdexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string | null;
  // Metadados enriquecidos a partir de cache de sets / detalhes sob demanda
  setId?: string;
  setName?: string;
  totalCards?: number | null;
  rarity?: string | null;
}

export interface TcgdexCardDetail {
  id: string;
  localId: string;
  name: string;
  image?: string | null;
  category?: string | null;
  illustrator?: string | null;
  rarity?: string | null;
  hp?: number | null;
  types?: string[];
  evolveFrom?: string | null;
  stage?: string | null;
  description?: string | null;
  effect?: string | null;
  trainerType?: string | null;
  energyType?: string | null;
  retreat?: number | null;
  regulationMark?: string | null;
  set: {
    id: string;
    name: string;
    logo?: string;
    symbol?: string;
    cardCount?: {
      official: number;
      total: number;
    };
  };
  variants?: {
    normal?: boolean;
    reverse?: boolean;
    holo?: boolean;
    firstEdition?: boolean;
    wPromo?: boolean;
  };
  attacks?: TcgdexAttack[];
  abilities?: TcgdexAbility[];
  weaknesses?: TcgdexWeakness[];
  resistances?: TcgdexWeakness[];
}

export interface TcgCollectionSetting {
  collectionId: string;
  tcgdexSetId?: string | null;
  tcgdexSetName?: string | null;
  showInCardStock: boolean;
  updatedAt: string;
}

export interface TcgCard {
  id: string;
  tcgdexId: string;
  name: string;
  setName: string;
  setCode: string;
  localId: string;
  totalCards: number | null;
  imageUrl: string | null;
  rarity: string | null;
  category: string | null;
  hp: number | null;
  types: string[];
  illustrator: string | null;
  description: string | null;
  ligaPokemonUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TcgCardVariant {
  id: string;
  cardId: string;
  collectionId?: string | null;
  categoryId?: string | null;
  condition: string;
  language: string;
  finish: string;
  quantity: number;
  acquisitionCost: number | null;
  referenceValue: number | null;
  salePrice: number | null;
  referenceDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joins
  card?: TcgCard;
  collection?: Collection;
  category?: Category;
}

export type TcgCardStockMovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface TcgCardStockMovement {
  id: string;
  variantId: string;
  type: TcgCardStockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number | null;
  reason: string;
  actor: string | null;
  createdAt: string;
  // Join para exibição
  variant?: TcgCardVariant;
}

export interface TcgCardStockLot {
  id: string;
  variantId: string;
  quantity: number;
  unitCost: number | null;
  entryDate: string;
  notes: string | null;
  actor: string | null;
  createdAt: string;
}

// ==============================================================================
// SISTEMA DE GERENCIAMENTO DE LEILÕES (AUCTIONS)
// ==============================================================================

export type AuctionStatus = 'PRE_LEILAO' | 'EM_ANDAMENTO' | 'FINALIZADO';
export type AuctionItemStatus = 'EM_LEILAO' | 'ARREMATADO' | 'NAO_ARREMATADO';
export type AuctionPaymentStatus = 'PENDENTE' | 'PAGO' | 'VENCIDO';
export type AuctionShippingStatus = 'NAO_SOLICITADO' | 'SOLICITADO' | 'ENVIADO' | 'RECEBIDO';

export interface TcgAuction {
  id: string;
  code: string; // Ex: '001', '009'
  title: string | null;
  status: AuctionStatus;
  startDate: string; // ISO timestamptz
  endDate: string; // ISO timestamptz
  paymentDeadlineHours: number; // default 48
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Totais agregados calculados para exibição
  itemsCount?: number;
  arrematadosCount?: number;
  naoArrematadosCount?: number;
  paidCount?: number;
  pendingCount?: number;
  totalArrematado?: number;
  totalPendente?: number;
  totalCusto?: number;
  totalLucro?: number;
}

export interface AuctionBundleCard {
  variantId: string;
  name: string;
  localId?: string;
  totalCards?: number | null;
  setName?: string;
  condition?: string;
  language?: string;
  finish?: string;
  costPrice?: number;
  imageUrl?: string | null;
}

export interface TcgAuctionItem {
  id: string;
  auctionId: string;
  cardVariantId: string | null;
  isBundle?: boolean;
  bundleVariantIds?: string[];
  bundleCards?: AuctionBundleCard[];
  isFreebie: boolean;
  isCustomItem: boolean;
  title: string;
  subtitle: string | null;
  condition: string | null;
  language: string | null;
  finish: string | null;
  initialPrice: number;
  bidStep: number;
  bidOptions: number[]; // 5 opções de valor
  finalPrice: number | null;
  costPrice: number;
  status: AuctionItemStatus;
  winningCustomerId: string | null;
  paymentStatus: AuctionPaymentStatus;
  shippingStatus: AuctionShippingStatus;
  customPhotoUrl: string | null; // Foto real (celular ou upload)
  apiImageUrl: string | null; // Fallback
  orderIndex: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joins
  cardVariant?: TcgCardVariant;
  winningCustomer?: Customer;
  auction?: TcgAuction;
}

export interface AuctionDashboardStats {
  totalAuctions: number;
  totalItems: number;
  totalArrematados: number;
  totalNaoArrematados: number;
  conversionRate: number; // %
  totalArrematadoValue: number;
  totalPendingValue: number;
  totalPaidValue: number;
  totalCostValue: number;
  totalProfitValue: number;
  profitMargin: number; // %
}

export interface CustomerArremateGroup {
  customer: Customer;
  auction: TcgAuction;
  items: TcgAuctionItem[];
  totalValue: number;
  paymentDeadline: string; // ISO timestamptz (endDate + 48h)
  isOverdue: boolean;
  hoursRemaining: number;
  allPaid: boolean;
  shippingStatus: AuctionShippingStatus;
}

export interface CustomerVaultStockItem {
  id: string;
  customerId: string;
  variantId?: string;
  productId?: string;
  name: string;
  subtitle?: string;
  condition?: string | null;
  language?: string | null;
  finish?: string | null;
  imageUrl?: string | null;
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  paymentStatus: 'PAGO';
  shippingStatus: AuctionShippingStatus;
  notes?: string;
  createdAt: string;
}

export type ShipmentCarrier =
  | 'CORREIOS_MINI'
  | 'CORREIOS_PAC'
  | 'CORREIOS_SEDEX'
  | 'JADLOG'
  | 'MELHOR_ENVIO'
  | 'BALCAO'
  | 'OUTRO';

export type ShipmentStatus = 'ENVIADO' | 'RECEBIDO';

export interface ShipmentItemSnapshot {
  id: string;
  sourceType: 'AUCTION' | 'STOCK';
  name: string;
  subtitle?: string;
  condition?: string | null;
  language?: string | null;
  finish?: string | null;
  imageUrl?: string | null;
  auctionCode?: number | string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  isFreebie?: boolean;
}

export interface CustomerShipmentPackage {
  id: string;
  shipmentCode: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  trackingCode?: string;
  carrier: ShipmentCarrier;
  customCarrierName?: string;
  shippingCost?: number;
  status: ShipmentStatus;
  totalItemsCount: number;
  totalValue: number;
  isQuestClosure: boolean;
  items: ShipmentItemSnapshot[];
  notes?: string;
  dispatchedAt: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}





