import { supabase } from '../lib/supabase';
import {
  TcgAuctionItem,
  TcgAuction,
  Customer,
  CustomerVaultStockItem,
  AuctionShippingStatus,
  TcgCardVariant,
  Product,
  CustomerShipmentPackage,
  ShipmentCarrier,
  ShipmentStatus,
  ShipmentItemSnapshot,
} from '../types';
import { formatCurrency } from '../utils/formatters';
import { cardStockService } from './cardStockService';
import { stockService } from './stockService';
import { auctionService } from './auctionService';
import { questService } from './questService';
import { cleanSetName } from '../config/tcgSetTranslations';

const LOCAL_STORAGE_VAULT_STOCK = 'trigon_customer_vault_stock_items_v1';
const LOCAL_STORAGE_AUCTION_ITEMS = 'trigon_tcg_auction_items';
const LOCAL_STORAGE_AUCTIONS = 'trigon_tcg_auctions';
const LOCAL_STORAGE_SHIPMENTS = 'trigon_customer_shipments_v1';

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function readLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[customerVaultService] Falha ao persistir em ${key}:`, err);
  }
}

export const customerVaultService = {
  /**
   * Busca todas as cartas de leilão do cliente que foram PAGAS e ainda NÃO foram enviadas/recebidas
   * (Apenas 'NAO_SOLICITADO' ou 'SOLICITADO'. Se já foi ENVIADO ou RECEBIDO, sai da gaveta e não conta)
   */
  async getCustomerVaultAuctionItems(customerId: string): Promise<TcgAuctionItem[]> {
    const { data, error } = await supabase
      .from('tcg_auction_items')
      .select('*, tcg_auctions(id, code, title, status, start_date, end_date), customers(id, name, phone, email)')
      .eq('winning_customer_id', customerId)
      .eq('status', 'ARREMATADO')
      .eq('payment_status', 'PAGO')
      .in('shipping_status', ['NAO_SOLICITADO', 'SOLICITADO'])
      .order('created_at', { ascending: false });

    if (error && isMissingTableError(error)) {
      const localItems = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_AUCTION_ITEMS, []);
      const localAuctions = readLocal<TcgAuction[]>(LOCAL_STORAGE_AUCTIONS, []);
      const auctionMap = new Map(localAuctions.map((a) => [a.id, a]));

      return localItems
        .filter(
          (i) =>
            i.winningCustomerId === customerId &&
            i.status === 'ARREMATADO' &&
            i.paymentStatus === 'PAGO' &&
            (i.shippingStatus === 'NAO_SOLICITADO' || i.shippingStatus === 'SOLICITADO')
        )
        .map((i) => ({
          ...i,
          auction: auctionMap.get(i.auctionId) || i.auction,
        }));
    }

    if (error) {
      console.warn('[customerVaultService] Erro ao buscar cartas do leilão:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      auctionId: row.auction_id,
      cardVariantId: row.card_variant_id,
      isBundle: row.is_bundle,
      bundleVariantIds: row.bundle_variant_ids,
      bundleCards: row.bundle_items,
      isFreebie: row.is_freebie,
      isCustomItem: row.is_custom_item,
      title: row.title,
      subtitle: row.subtitle,
      condition: row.condition,
      language: row.language,
      finish: row.finish,
      initialPrice: Number(row.initial_price) || 0,
      bidStep: Number(row.bid_step) || 1,
      bidOptions: Array.isArray(row.bid_options) ? row.bid_options : [],
      finalPrice: row.final_price !== null ? Number(row.final_price) : null,
      costPrice: Number(row.cost_price) || 0,
      status: row.status,
      winningCustomerId: row.winning_customer_id,
      paymentStatus: row.payment_status,
      shippingStatus: row.shipping_status,
      customPhotoUrl: row.custom_photo_url,
      apiImageUrl: row.api_image_url,
      orderIndex: row.order_index,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      auction: row.tcg_auctions
        ? {
            id: row.tcg_auctions.id,
            code: row.tcg_auctions.code,
            title: row.tcg_auctions.title,
            status: row.tcg_auctions.status,
            startDate: row.tcg_auctions.start_date,
            endDate: row.tcg_auctions.end_date,
            paymentDeadlineHours: 48,
            notes: null,
            createdAt: row.tcg_auctions.created_at,
            updatedAt: row.tcg_auctions.updated_at,
          }
        : undefined,
    }));
  },

  /**
   * Busca itens adicionados diretamente do estoque da loja para a gaveta do cliente
   */
  getCustomerVaultStockItems(customerId: string): CustomerVaultStockItem[] {
    const all = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    return all.filter(
      (i) =>
        i.customerId === customerId &&
        i.paymentStatus === 'PAGO' &&
        i.shippingStatus !== 'ENVIADO' &&
        i.shippingStatus !== 'RECEBIDO'
    );
  },

  /**
   * Adiciona uma carta do estoque à gaveta do cliente (dando baixa temporária de 1 unidade)
   */
  async addStockItemToVault(params: {
    customerId: string;
    customerName: string;
    variant: TcgCardVariant;
    unitPrice: number;
    notes?: string;
  }): Promise<CustomerVaultStockItem> {
    if (params.variant.quantity < 1) {
      throw new Error(`A carta ${params.variant.card?.name || ''} está sem saldo no estoque (0 un.).`);
    }

    // 1. Dá baixa de 1 unidade do estoque
    await cardStockService.recordMovement({
      variantId: params.variant.id,
      type: 'SAIDA',
      quantity: 1,
      unitCost: params.variant.acquisitionCost || null,
      reason: `Reserva para Gaveta de Envio — ${params.customerName}`,
    });

    // 2. Registra o item pago na gaveta do cliente
    const cardName = params.variant.card?.name || 'Carta TCG';
    const num = params.variant.card?.localId
      ? `#${params.variant.card.localId}${params.variant.card.totalCards ? `/${params.variant.card.totalCards}` : ''}`
      : '';
    const setInfo = params.variant.card?.setName ? cleanSetName(params.variant.card.setName) : '';
    const subtitle = [setInfo, num].filter(Boolean).join(' • ');

    const newItem: CustomerVaultStockItem = {
      id: `vlt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      customerId: params.customerId,
      variantId: params.variant.id,
      name: cardName,
      subtitle: subtitle || undefined,
      condition: params.variant.condition || null,
      language: params.variant.language || null,
      finish: params.variant.finish || null,
      imageUrl: params.variant.card?.imageUrl || null,
      unitPrice: Math.max(0, params.unitPrice),
      costPrice: params.variant.acquisitionCost || 0,
      quantity: 1,
      paymentStatus: 'PAGO',
      shippingStatus: 'NAO_SOLICITADO',
      notes: params.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const all = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    all.unshift(newItem);
    writeLocal(LOCAL_STORAGE_VAULT_STOCK, all);

    return newItem;
  },

  /**
   * Adiciona um produto de catálogo/estoque geral à gaveta do cliente
   * (usado na opção 'Guardar na Gaveta de Envio' do modal Lançar Venda)
   */
  async addCatalogProductToVault(params: {
    customerId: string;
    customerName: string;
    product: Product;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }): Promise<CustomerVaultStockItem> {
    const qty = Math.max(1, params.quantity);
    const newItem: CustomerVaultStockItem = {
      id: `vlt_prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      customerId: params.customerId,
      productId: params.product.id,
      name: params.product.name,
      subtitle: qty > 1 ? `${qty}x un. • Produto do Catálogo` : 'Produto do Catálogo',
      condition: params.product.condition || null,
      language: params.product.language || null,
      finish: null,
      imageUrl: params.product.images?.[0] || null,
      unitPrice: Math.max(0, params.unitPrice),
      costPrice: 0,
      quantity: qty,
      paymentStatus: 'PAGO',
      shippingStatus: 'NAO_SOLICITADO',
      notes: params.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const all = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    all.unshift(newItem);
    writeLocal(LOCAL_STORAGE_VAULT_STOCK, all);

    return newItem;
  },

  /**
   * Remove um item de estoque da gaveta e devolve ao estoque (carta TCG ou produto do catálogo)
   */
  async removeStockItemFromVault(
    vaultItemId: string,
    customerName: string
  ): Promise<void> {
    const all = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    const item = all.find((i) => i.id === vaultItemId);
    if (!item) return;

    const qtyToReturn = item.quantity || 1;

    if (item.variantId) {
      try {
        await cardStockService.recordMovement({
          variantId: item.variantId,
          type: 'ENTRADA',
          quantity: qtyToReturn,
          unitCost: item.costPrice || null,
          reason: `Cancelamento de item da Gaveta de Envio — ${customerName}`,
        });
      } catch (err) {
        console.warn('[customerVaultService] Falha ao estornar carta ao estoque:', err);
      }
    } else if (item.productId) {
      try {
        await stockService.recordMovement(
          item.productId,
          'ENTRADA',
          qtyToReturn,
          `Cancelamento de item da Gaveta de Envio — ${customerName}`
        );
      } catch (err) {
        console.warn('[customerVaultService] Falha ao estornar produto ao catálogo:', err);
      }
    }

    const updated = all.filter((i) => i.id !== vaultItemId);
    writeLocal(LOCAL_STORAGE_VAULT_STOCK, updated);
  },

  /**
   * Altera a situação de envio de um item (Solicitado vs Não Solicitado)
   */
  async updateItemShippingStatus(
    itemId: string,
    isStockItem: boolean,
    newStatus: AuctionShippingStatus
  ): Promise<void> {
    if (isStockItem) {
      const all = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
      const found = all.find((i) => i.id === itemId);
      if (found) {
        found.shippingStatus = newStatus;
        writeLocal(LOCAL_STORAGE_VAULT_STOCK, all);
      }
    } else {
      await auctionService.updateItemStatuses({
        itemId,
        shippingStatus: newStatus,
      });
    }
  },

  /**
   * Helper para obter rótulo legível da transportadora
   */
  getCarrierLabel(carrier: ShipmentCarrier, customName?: string): string {
    switch (carrier) {
      case 'CORREIOS_MINI':
        return 'Correios (Mini Envios)';
      case 'CORREIOS_PAC':
        return 'Correios (PAC)';
      case 'CORREIOS_SEDEX':
        return 'Correios (Sedex)';
      case 'JADLOG':
        return 'Jadlog';
      case 'MELHOR_ENVIO':
        return 'Melhor Envio';
      case 'BALCAO':
        return 'Retirada no Balcão';
      case 'OUTRO':
        return customName?.trim() || 'Outra Transportadora';
      default:
        return 'Correios';
    }
  },

  /**
   * Helper para gerar link de rastreamento direto
   */
  getTrackingUrl(carrier: ShipmentCarrier, trackingCode?: string): string {
    if (!trackingCode || !trackingCode.trim()) return '';
    const clean = trackingCode.trim().toUpperCase();
    const encoded = encodeURIComponent(clean);
    switch (carrier) {
      case 'CORREIOS_MINI':
      case 'CORREIOS_PAC':
      case 'CORREIOS_SEDEX':
        return `https://rastreamento.correios.com.br/app/index.php?codigo=${encoded}`;
      case 'JADLOG':
        return `https://www.jadlog.com.br/jadlog/home`;
      case 'MELHOR_ENVIO':
        return `https://melhorrastreio.com.br/rastreio/${encoded}`;
      default:
        return `https://www.google.com/search?q=${encoded}`;
    }
  },

  /**
   * Retorna todo o histórico de envios (pacotes despachados) de um cliente
   */
  getCustomerShipments(customerId: string): CustomerShipmentPackage[] {
    const all = readLocal<CustomerShipmentPackage[]>(LOCAL_STORAGE_SHIPMENTS, []);
    return all
      .filter((s) => s.customerId === customerId)
      .sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime());
  },

  /**
   * Retorna todo o histórico de envios do sistema
   */
  getAllShipments(): CustomerShipmentPackage[] {
    const all = readLocal<CustomerShipmentPackage[]>(LOCAL_STORAGE_SHIPMENTS, []);
    return all.sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime());
  },

  /**
   * Despacha o pacote completo da gaveta do cliente, registrando no Histórico de Envios
   * Se elegível (>= R$ 100), registra fechamento na Quest
   */
  async dispatchFullVault(params: {
    customer: Customer;
    auctionItems: TcgAuctionItem[];
    stockItems: CustomerVaultStockItem[];
    registerQuestClosure: boolean;
    trackingCode?: string;
    carrier?: ShipmentCarrier;
    customCarrierName?: string;
    shippingCost?: number;
    notes?: string;
  }): Promise<{ questClosureCreated: boolean; shipment: CustomerShipmentPackage }> {
    const carrier = params.carrier || 'CORREIOS_MINI';
    const nowIso = new Date().toISOString();

    // 1. Marca cartas do leilão como ENVIADO
    for (const ai of params.auctionItems) {
      try {
        await auctionService.updateItemStatuses({
          itemId: ai.id,
          shippingStatus: 'ENVIADO',
        });
      } catch (err) {
        console.warn(`[customerVaultService] Erro ao marcar arremate ${ai.id} como enviado:`, err);
      }
    }

    // 2. Marca itens de estoque da gaveta como ENVIADO
    const allStock = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    const stockIds = new Set(params.stockItems.map((s) => s.id));
    for (const s of allStock) {
      if (stockIds.has(s.id)) {
        s.shippingStatus = 'ENVIADO';
      }
    }
    writeLocal(LOCAL_STORAGE_VAULT_STOCK, allStock);

    // 3. Calcula total consolidado do pacote
    const totalValue =
      params.auctionItems.reduce((acc, i) => acc + (i.isFreebie ? 0 : Number(i.finalPrice || i.initialPrice || 0)), 0) +
      params.stockItems.reduce((acc, i) => acc + Number(i.unitPrice || 0) * (i.quantity || 1), 0);

    const isQuestClosure = params.registerQuestClosure && totalValue >= 100;
    let questClosureCreated = false;

    if (isQuestClosure) {
      try {
        await questService.createClosure({
          customerId: params.customer.id,
          totalValue,
          saleReference: `Envio Gaveta Consolidada (${params.auctionItems.length} leilões + ${params.stockItems.length} estoque)`,
          notes: `Fechamento registrado automaticamente via expedição consolidada da Gaveta do cliente.`,
        });
        questClosureCreated = true;
      } catch (err) {
        console.warn('[customerVaultService] Falha ao registrar fechamento na Quest:', err);
      }
    }

    // 4. Monta snapshot de itens do pacote
    const itemSnapshots: ShipmentItemSnapshot[] = [
      ...params.auctionItems.map((ai) => ({
        id: ai.id,
        sourceType: 'AUCTION' as const,
        name: ai.title,
        subtitle: ai.subtitle || undefined,
        condition: ai.condition,
        language: ai.language,
        finish: ai.finish,
        imageUrl: ai.customPhotoUrl || ai.apiImageUrl,
        auctionCode: ai.auction?.code,
        unitPrice: ai.isFreebie ? 0 : Number(ai.finalPrice || ai.initialPrice || 0),
        quantity: 1,
        totalPrice: ai.isFreebie ? 0 : Number(ai.finalPrice || ai.initialPrice || 0),
        isFreebie: ai.isFreebie,
      })),
      ...params.stockItems.map((si) => ({
        id: si.id,
        sourceType: 'STOCK' as const,
        name: si.name,
        subtitle: si.subtitle,
        condition: si.condition,
        language: si.language,
        finish: si.finish,
        imageUrl: si.imageUrl,
        unitPrice: Number(si.unitPrice || 0),
        quantity: si.quantity || 1,
        totalPrice: Number(si.unitPrice || 0) * (si.quantity || 1),
      })),
    ];

    const stockUnits = params.stockItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
    const totalUnits = params.auctionItems.length + stockUnits;

    // 5. Gera código sequencial do pacote (ex: ENV-001)
    const allShipments = readLocal<CustomerShipmentPackage[]>(LOCAL_STORAGE_SHIPMENTS, []);
    const nextSeq = allShipments.length + 1;
    const shipmentCode = `ENV-${String(nextSeq).padStart(3, '0')}`;

    // Monta endereço consolidado
    const cust = params.customer;
    const addrParts = [
      cust.street ? `${cust.street}, ${cust.number || 'S/N'}${cust.complement ? ` (${cust.complement})` : ''}` : '',
      cust.neighborhood,
      cust.city ? `${cust.city}/${cust.state || ''}` : '',
      cust.cep ? `CEP: ${cust.cep}` : '',
    ].filter(Boolean);
    const customerAddress = addrParts.join(' - ');

    const newShipment: CustomerShipmentPackage = {
      id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      shipmentCode,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone || undefined,
      customerAddress: customerAddress || undefined,
      trackingCode: params.trackingCode?.trim() || undefined,
      carrier,
      customCarrierName: params.customCarrierName?.trim() || undefined,
      shippingCost: params.shippingCost ? Number(params.shippingCost) : undefined,
      status: 'ENVIADO',
      totalItemsCount: totalUnits,
      totalValue,
      isQuestClosure,
      items: itemSnapshots,
      notes: params.notes?.trim() || undefined,
      dispatchedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    allShipments.unshift(newShipment);
    writeLocal(LOCAL_STORAGE_SHIPMENTS, allShipments);

    return { questClosureCreated, shipment: newShipment };
  },

  /**
   * Atualiza o status do pacote no histórico (ENVIADO <-> RECEBIDO)
   * Se marcado como RECEBIDO, sincroniza os itens para RECEBIDO
   */
  async updateShipmentStatus(shipmentId: string, newStatus: ShipmentStatus): Promise<void> {
    const allShipments = readLocal<CustomerShipmentPackage[]>(LOCAL_STORAGE_SHIPMENTS, []);
    const shipment = allShipments.find((s) => s.id === shipmentId);
    if (!shipment) return;

    shipment.status = newStatus;
    shipment.updatedAt = new Date().toISOString();
    if (newStatus === 'RECEBIDO') {
      shipment.deliveredAt = new Date().toISOString();
    } else {
      shipment.deliveredAt = undefined;
    }

    // Sincroniza o status dos itens no banco / local
    for (const item of shipment.items) {
      if (item.sourceType === 'AUCTION') {
        try {
          await auctionService.updateItemStatuses({
            itemId: item.id,
            shippingStatus: newStatus,
          });
        } catch (err) {
          console.warn(`[customerVaultService] Falha ao atualizar arremate ${item.id} para ${newStatus}:`, err);
        }
      } else if (item.sourceType === 'STOCK') {
        const allStock = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
        const found = allStock.find((s) => s.id === item.id);
        if (found) {
          found.shippingStatus = newStatus;
          writeLocal(LOCAL_STORAGE_VAULT_STOCK, allStock);
        }
      }
    }

    writeLocal(LOCAL_STORAGE_SHIPMENTS, allShipments);
  },

  /**
   * Atualiza o código de rastreio e transportadora de um envio já criado
   */
  async updateShipmentTracking(params: {
    shipmentId: string;
    trackingCode: string;
    carrier?: ShipmentCarrier;
    customCarrierName?: string;
  }): Promise<CustomerShipmentPackage | null> {
    const allShipments = readLocal<CustomerShipmentPackage[]>(LOCAL_STORAGE_SHIPMENTS, []);
    const shipment = allShipments.find((s) => s.id === params.shipmentId);
    if (!shipment) return null;

    shipment.trackingCode = params.trackingCode.trim() || undefined;
    if (params.carrier) shipment.carrier = params.carrier;
    if (params.customCarrierName !== undefined) shipment.customCarrierName = params.customCarrierName.trim() || undefined;
    shipment.updatedAt = new Date().toISOString();

    writeLocal(LOCAL_STORAGE_SHIPMENTS, allShipments);
    return shipment;
  },

  /**
   * Formata mensagem de notificação de envio para o WhatsApp com link de rastreamento
   */
  formatShipmentWhatsAppNotification(shipment: CustomerShipmentPackage): string {
    const carrierLabel = this.getCarrierLabel(shipment.carrier, shipment.customCarrierName);
    const trackingUrl = this.getTrackingUrl(shipment.carrier, shipment.trackingCode);

    let lines: string[] = [];
    lines.push(`📦 *TRIGON TCG — PACOTE ENVIADO!* 🚚💨`);
    lines.push(`Olá, *${shipment.customerName}*! Seu pacote foi despachado!`);
    lines.push(``);
    lines.push(`📌 *Código do Envio:* \`${shipment.shipmentCode}\``);
    lines.push(`🚚 *Transportadora / Frete:* ${carrierLabel}`);

    if (shipment.trackingCode) {
      lines.push(`🔎 *Código de Rastreio:* \`${shipment.trackingCode}\``);
      if (trackingUrl) {
        lines.push(`🔗 *Acompanhar entrega:* ${trackingUrl}`);
      }
    } else {
      lines.push(`ℹ️ *Rastreio:* Postagem concluída / Retirada.`);
    }

    if (shipment.customerAddress) {
      lines.push(`📍 *Endereço de Entrega:* ${shipment.customerAddress}`);
    }

    lines.push(``);
    lines.push(`📋 *CONTEÚDO DO PACOTE (${shipment.totalItemsCount} un.):*`);
    shipment.items.forEach((item, idx) => {
      const cond = item.condition ? ` (${item.condition})` : '';
      const finish = item.finish && item.finish !== 'NORMAL' ? ` ✨${item.finish}` : '';
      const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
      const val = item.isFreebie ? 'R$ 0,00 (BRINDE)' : formatCurrency(item.totalPrice);
      const aucTag = item.auctionCode ? ` [Leilão #${item.auctionCode}]` : '';
      lines.push(`${idx + 1}. *${qty}${item.name}*${cond}${finish}${aucTag} — ${val}`);
    });

    lines.push(``);
    lines.push(`💰 *VALOR TOTAL CONSOLIDADO: ${formatCurrency(shipment.totalValue)}*`);

    if (shipment.isQuestClosure) {
      lines.push(`🎯 *Quest Trigon:* 🏆 Meta de R$ 100 atingida neste envio!`);
    }

    lines.push(``);
    lines.push(`Assim que o pacote chegar, por favor nos confirme o recebimento por aqui! Qualquer dúvida conte conosco! 🔺✨`);

    return lines.join('\n');
  },

  /**
   * Formata resumo completo da Gaveta para colar no WhatsApp
   */
  formatVaultWhatsAppSummary(params: {
    customer: Customer;
    auctionItems: TcgAuctionItem[];
    stockItems: CustomerVaultStockItem[];
    totalValue: number;
    questTarget: number;
  }): string {
    const { customer, auctionItems, stockItems, totalValue, questTarget } = params;
    const isQuestEligible = totalValue >= questTarget;
    const missing = Math.max(0, questTarget - totalValue);

    let lines: string[] = [];
    lines.push(`📦 *TRIGON TCG — GAVETA DE ENVIO CONSOLIDADA* 🔺`);
    lines.push(`👤 *Cliente:* ${customer.name}`);
    lines.push(`📱 *Telefone:* ${customer.phone}`);

    if (customer.street || customer.city) {
      lines.push(`📍 *Endereço:* ${customer.street || ''}, ${customer.number || 'S/N'}${customer.complement ? ` (${customer.complement})` : ''} - ${customer.neighborhood || ''}, ${customer.city || ''}/${customer.state || ''} - CEP: ${customer.cep || ''}`);
    }

    lines.push(``);
    lines.push(`═════════════════════════════════`);

    if (auctionItems.length > 0) {
      lines.push(`🏆 *CARTAS DE LEILÃO (PAGAS):*`);
      auctionItems.forEach((ai, idx) => {
        const val = ai.isFreebie ? 'R$ 0,00 (BRINDE)' : formatCurrency(ai.finalPrice || ai.initialPrice);
        const aucCode = ai.auction?.code ? ` [Leilão #${ai.auction.code}]` : '';
        const cond = ai.condition ? ` (${ai.condition})` : '';
        lines.push(`${idx + 1}. *${ai.title}*${cond}${aucCode} — ${val}`);
      });
      lines.push(``);
    }

    if (stockItems.length > 0) {
      lines.push(`🃏 *PRODUTOS & CARTAS DO ESTOQUE:*`);
      stockItems.forEach((si, idx) => {
        const cond = si.condition ? ` (${si.condition})` : '';
        const qtyPrefix = si.quantity && si.quantity > 1 ? `${si.quantity}x ` : '';
        const lineTotal = Number(si.unitPrice || 0) * (si.quantity || 1);
        lines.push(`${idx + 1}. *${qtyPrefix}${si.name}*${cond} — ${formatCurrency(lineTotal)}`);
      });
      lines.push(``);
    }

    lines.push(`═════════════════════════════════`);
    lines.push(`💰 *TOTAL CONSOLIDADO: ${formatCurrency(totalValue)}*`);

    if (isQuestEligible) {
      lines.push(`🎯 *PROGRAMA QUEST TRIGON:* ✅ *META ATINGIDA!*`);
      lines.push(`Este pacote ultrapassou ${formatCurrency(questTarget)} e está APTO para registrar/avançar peça na sua Quest! 🏆🔺`);
    } else {
      lines.push(`🎯 *PROGRAMA QUEST TRIGON:*`);
      lines.push(`Faltam apenas *${formatCurrency(missing)}* em produtos para atingir ${formatCurrency(questTarget)} e liberar sua peça na Quest! 🎁`);
    }

    lines.push(``);
    lines.push(`Se desejar incluir mais algum item do nosso catálogo antes do envio, nos avise por aqui! ✅`);

    return lines.join('\n');
  },

  /**
   * Retorna um mapa com o total de itens pendentes na gaveta para todos os clientes
   * (usado para exibir distintivos/badges na tabela de clientes)
   */
  async getPendingVaultCountsMap(): Promise<Map<string, number>> {
    const countsMap = new Map<string, number>();

    // 1. Itens de leilão pagos e não enviados/recebidos (apenas NAO_SOLICITADO ou SOLICITADO)
    const { data, error } = await supabase
      .from('tcg_auction_items')
      .select('winning_customer_id')
      .eq('status', 'ARREMATADO')
      .eq('payment_status', 'PAGO')
      .in('shipping_status', ['NAO_SOLICITADO', 'SOLICITADO']);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (!row.winning_customer_id) continue;
        const cur = countsMap.get(row.winning_customer_id) || 0;
        countsMap.set(row.winning_customer_id, cur + 1);
      }
    } else {
      const localItems = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_AUCTION_ITEMS, []);
      for (const i of localItems) {
        if (
          i.winningCustomerId &&
          i.status === 'ARREMATADO' &&
          i.paymentStatus === 'PAGO' &&
          (i.shippingStatus === 'NAO_SOLICITADO' || i.shippingStatus === 'SOLICITADO')
        ) {
          const cur = countsMap.get(i.winningCustomerId) || 0;
          countsMap.set(i.winningCustomerId, cur + 1);
        }
      }
    }

    // 2. Itens de estoque na gaveta
    const allStock = readLocal<CustomerVaultStockItem[]>(LOCAL_STORAGE_VAULT_STOCK, []);
    for (const s of allStock) {
      if (
        s.paymentStatus === 'PAGO' &&
        s.shippingStatus !== 'ENVIADO' &&
        s.shippingStatus !== 'RECEBIDO'
      ) {
        const cur = countsMap.get(s.customerId) || 0;
        countsMap.set(s.customerId, cur + (s.quantity || 1));
      }
    }

    return countsMap;
  },
};
