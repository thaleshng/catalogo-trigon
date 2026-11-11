import {
  TcgAuction,
  TcgAuctionItem,
  AuctionBundleCard,
  TcgCardVariant,
  AuctionStatus,
  AuctionItemStatus,
  AuctionPaymentStatus,
  AuctionShippingStatus,
  AuctionDashboardStats,
  CustomerArremateGroup,
  Customer,
} from '../types';
import { supabase } from '../lib/supabase';
import { cardStockService } from './cardStockService';
import { customerService } from './customerService';
import { generateId } from '../utils/idGenerator';
import { formatCurrency } from '../utils/formatters';
import { cleanSetName, compareCardNumbers, formatPokemonGenderName } from '../config/tcgSetTranslations';

const LOCAL_STORAGE_KEYS = {
  AUCTIONS: 'trigon_tcg_auctions_v1',
  AUCTION_ITEMS: 'trigon_tcg_auction_items_v1',
};

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
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
    console.warn(`[auctionService] Falha ao persistir em ${key}:`, err);
  }
}

function mapAuctionRow(row: any): TcgAuction {
  return {
    id: row.id,
    code: row.code,
    title: row.title || null,
    status: row.status as AuctionStatus,
    startDate: row.start_date,
    endDate: row.end_date,
    paymentDeadlineHours: Number(row.payment_deadline_hours) || 48,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuctionItemRow(row: any): TcgAuctionItem {
  return {
    id: row.id,
    auctionId: row.auction_id,
    cardVariantId: row.card_variant_id || null,
    isBundle: Boolean(row.is_bundle),
    bundleVariantIds: Array.isArray(row.bundle_variant_ids) ? row.bundle_variant_ids : [],
    bundleCards: Array.isArray(row.bundle_items)
      ? row.bundle_items.map((bc: any) => ({
          ...bc,
          name: formatPokemonGenderName(bc.name),
        }))
      : [],
    isFreebie: Boolean(row.is_freebie),
    isCustomItem: Boolean(row.is_custom_item),
    title: formatPokemonGenderName(row.title),
    subtitle: row.subtitle || null,
    condition: row.condition || null,
    language: row.language || null,
    finish: row.finish || null,
    initialPrice: Number(row.initial_price) || 0,
    bidStep: Number(row.bid_step) || 1,
    bidOptions: Array.isArray(row.bid_options)
      ? row.bid_options.map((n: any) => Number(n))
      : [],
    finalPrice: row.final_price !== null && row.final_price !== undefined ? Number(row.final_price) : null,
    costPrice: Number(row.cost_price) || 0,
    status: row.status as AuctionItemStatus,
    winningCustomerId: row.winning_customer_id || null,
    paymentStatus: row.payment_status as AuctionPaymentStatus,
    shippingStatus: row.shipping_status as AuctionShippingStatus,
    customPhotoUrl: row.custom_photo_url || null,
    apiImageUrl: row.api_image_url || null,
    orderIndex: Number(row.order_index) || 0,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    winningCustomer: row.customers
      ? {
          id: row.customers.id,
          name: row.customers.name,
          phone: row.customers.phone || '',
          email: row.customers.email || '',
          createdAt: row.customers.created_at || new Date().toISOString(),
          updatedAt: row.customers.updated_at || new Date().toISOString(),
        }
      : undefined,
  };
}

export const auctionService = {
  /**
   * Formata código sequencial do leilão com zeros à esquerda (ex: 1 -> "001", 9 -> "009", 12 -> "012")
   */
  formatAuctionCode(num: number): string {
    const s = String(Math.max(1, Math.floor(num)));
    return s.padStart(3, '0');
  },

  /**
   * Calcula as 5 opções de valor do leilão
   * Ex: inicial 10, step 5 -> [10, 15, 20, 25, 30]
   */
  calculateBidOptions(initialPrice: number, bidStep: number): number[] {
    const safeInitial = Math.max(0, Number(initialPrice) || 0);
    const safeStep = Math.max(0.5, Math.min(100, Number(bidStep) || 1));
    return [
      safeInitial,
      Number((safeInitial + safeStep).toFixed(2)),
      Number((safeInitial + safeStep * 2).toFixed(2)),
      Number((safeInitial + safeStep * 3).toFixed(2)),
      Number((safeInitial + safeStep * 4).toFixed(2)),
    ];
  },

  /**
   * Gera a bandeira correspondente ao idioma da carta
   */
  getLanguageFlag(lang?: string | null): string {
    if (!lang) return '🌐';
    const clean = lang.toUpperCase().trim();
    if (clean === 'PT' || clean === 'PT-BR') return '🇧🇷';
    if (clean === 'EN') return '🇺🇸';
    if (clean === 'JP' || clean === 'JA') return '🇯🇵';
    if (clean === 'ZH' || clean === 'ZH-CN') return '🇨🇳';
    if (clean === 'ZH-TW') return '🇹🇼';
    if (clean === 'KO') return '🇰🇷';
    if (clean === 'ES') return '🇪🇸';
    if (clean === 'FR') return '🇫🇷';
    if (clean === 'DE') return '🇩🇪';
    if (clean === 'IT') return '🇮🇹';
    return '🌐';
  },

  /**
   * Gera o emoji de status da condição
   */
  getConditionEmoji(cond?: string | null): string {
    if (!cond) return '⚪';
    const clean = cond.toUpperCase().trim();
    if (clean === 'M' || clean === 'NM') return '🟢';
    if (clean === 'SP') return '🟡';
    if (clean === 'MP') return '🟠';
    if (clean === 'HP') return '🔴';
    if (clean === 'DMG' || clean === 'D') return '⚠️';
    return '⚪';
  },

  /**
   * Converte o acabamento para texto amigável na mensagem do WhatsApp.
   * Cartas Normal / Comum retornam null para omitir.
   */
  formatFinishDisplay(finish?: string | null): string | null {
    if (!finish) return null;
    const upper = finish.toUpperCase().trim();
    if (
      upper === 'NORMAL' ||
      upper === 'COMMON' ||
      upper === 'COMUM' ||
      upper === 'VARIADO'
    ) {
      return null;
    }
    if (upper === 'REVERSE_FOIL' || upper === 'REVERSE FOIL' || upper === 'REVERSE') {
      return 'Reverse Foil';
    }
    if (upper === 'FOIL' || upper === 'HOLO') {
      return 'Foil';
    }
    if (upper === 'POKEBALL_FOIL') {
      return 'Poké Ball Foil';
    }
    if (upper === 'MASTERBALL_FOIL') {
      return 'Master Ball Foil';
    }
    if (upper === 'FULL_ART_ETCHED') {
      return 'Texturizada';
    }
    if (upper === 'PROMO_STAMPED') {
      return 'Promo';
    }
    return finish;
  },

  /**
   * Mensagem 1: Legenda formatada para envio no WhatsApp com a foto do item
   * Exemplo:
   * Heracross - Reverse Foil (008/189)
   * Origem Perdida
   * 🟢 NM
   * 🇧🇷 Português
   */
  formatItemCaption(item: TcgAuctionItem): string {
    const lines: string[] = [];

    // Se for uma dupla / combo de cartas (ex: Dottler e Orbeetle)
    if (item.isBundle && item.bundleCards && item.bundleCards.length > 1) {
      // Ordena as cartas em ordem crescente de número (pré-evolução antes da evolução)
      const sortedCards = [...item.bundleCards].sort((a, b) =>
        compareCardNumbers(a.localId, b.localId)
      );
      for (const card of sortedCards) {
        const cleanName = formatPokemonGenderName(card.name);
        const finishLabel = this.formatFinishDisplay(card.finish);
        const finishPart = finishLabel ? ` - ${finishLabel}` : '';
        const numStr = card.localId
          ? ` (${card.localId}${card.totalCards ? `/${card.totalCards}` : ''})`
          : '';
        lines.push(`${cleanName}${finishPart}${numStr}`);
      }
    } else if (item.bundleCards && item.bundleCards.length === 1) {
      const card = item.bundleCards[0];
      const cleanName = formatPokemonGenderName(card.name);
      const finishLabel = this.formatFinishDisplay(card.finish || item.finish);
      const finishPart = finishLabel ? ` - ${finishLabel}` : '';
      const numStr = card.localId
        ? ` (${card.localId}${card.totalCards ? `/${card.totalCards}` : ''})`
        : '';
      lines.push(`${cleanName}${finishPart}${numStr}`);
    } else {
      // Se não houver bundleCards mas o título tiver " + " (combo legado)
      if (item.title.includes(' + ')) {
        const parts = item.title.split(' + ').map((p) => p.trim());
        const sortedParts = [...parts].sort((a, b) => {
          const aMatch = a.match(/\((.*?)\)/);
          const bMatch = b.match(/\((.*?)\)/);
          return compareCardNumbers(aMatch?.[1] || a, bMatch?.[1] || b);
        });
        for (const part of sortedParts) {
          lines.push(formatPokemonGenderName(part));
        }
      } else {
        // Carta única / item avulso
        const cleanTitle = formatPokemonGenderName(item.title);
        const finishLabel = this.formatFinishDisplay(item.finish);
        if (finishLabel && !cleanTitle.toLowerCase().includes(finishLabel.toLowerCase())) {
          // Se o título termina com (número/total), insere " - Acabamento" antes do parênteses
          const match = cleanTitle.match(/^(.*?)\s*(\([a-zA-Z0-9/]+\))$/);
          if (match) {
            lines.push(`${match[1].trim()} - ${finishLabel} ${match[2]}`);
          } else {
            lines.push(`${cleanTitle} - ${finishLabel}`);
          }
        } else {
          lines.push(cleanTitle);
        }
      }
    }

    if (item.subtitle) {
      const cleaned = cleanSetName(item.subtitle);
      if (cleaned) {
        lines.push(cleaned);
      }
    }

    if (item.condition) {
      const emoji = this.getConditionEmoji(item.condition);
      lines.push(`${emoji} ${item.condition}`);
    }

    if (item.language) {
      const flag = this.getLanguageFlag(item.language);
      const label =
        item.language === 'PT'
          ? 'Português'
          : item.language === 'EN'
            ? 'Inglês'
            : item.language === 'JP'
              ? 'Japonês'
              : item.language === 'ZH' || item.language === 'ZH-CN'
                ? 'Chinês'
                : item.language;
      lines.push(`${flag} ${label}`);
    }

    // Variado e Acabamentos em linhas isoladas removidos para não poluir
    if (item.isFreebie) {
      lines.push('🎁 BRINDE DO LEILÃO');
    }

    return lines.join('\n');
  },

  /**
   * Mensagem 2: Enquete dos 5 valores para envio no WhatsApp
   */
  formatItemPoll(item: TcgAuctionItem): string {
    const opts =
      item.bidOptions && item.bidOptions.length === 5
        ? item.bidOptions
        : this.calculateBidOptions(item.initialPrice, item.bidStep);

    return opts
      .map((val, idx) => {
        const formatted = formatCurrency(val);
        return idx === 4 ? `${formatted} (arremate)` : formatted;
      })
      .join('\n');
  },

  /**
   * Mensagem de cobrança padrão de 48 horas
   */
  formatCustomerPaymentNotice(params: {
    customerName: string;
    auctionCode: string;
    deadlineFormatted: string;
  }): string {
    return `Olá *${params.customerName}*! Tudo bem? 😊

Passando para enviar o seu relatório de arremates do Leilão *TRIGON TCG*. 🔺🃏

📅 *Leilão: ${params.auctionCode}*

Pedimos, por gentileza, que o pagamento seja realizado em até 2 dias corridos após o envio desse relatório *(${params.deadlineFormatted})*.

🔎 Antes de realizar o pagamento, pedimos que confira o relatório e verifique se todas as cartas arrematadas por você estão listadas corretamente. Caso identifique qualquer divergência, é só nos chamar por aqui!

💰*Pagamento via PIX ou cartão*:
📱 *PIX:* (31) 98341-0432
*Gabriel Henrique da Silva Gomes — Mercado Pago*

💳 *Cartão:* solicite por aqui a emissão do link de pagamento.

Após o pagamento, pode nos enviar o comprovante por aqui para confirmarmos certinho. ✅

📦 *Lembrando que, caso prefira, suas cartas podem continuar armazenadas com a TRIGON para acumular com futuros arremates e solicitar o envio de tudo junto depois, economizando no frete.*

Muito obrigado pela participação e parabéns pelos arremates! 🔺🔥`;
  },

  /**
   * Lista / Resumo detalhado dos itens arrematados pelo cliente
   */
  formatCustomerItemsSummary(params: {
    customerName: string;
    auctionCode: string;
    items: TcgAuctionItem[];
    totalValue: number;
  }): string {
    const itemsLines = params.items
      .map((it, idx) => {
        const sub = it.subtitle ? ` (${it.subtitle})` : '';
        const price = it.isFreebie ? '🎁 BRINDE' : formatCurrency(it.finalPrice || it.initialPrice);
        return `${idx + 1}. *${it.title}*${sub} — ${price}`;
      })
      .join('\n');

    return `📋 *Relatório de Arremates — Leilão ${params.auctionCode}*
👤 *Cliente:* ${params.customerName}

${itemsLines}

---------------------------------
💰 *Total dos Arremates: ${formatCurrency(params.totalValue)}*`;
  },

  /**
   * Mensagem de prazo vencido após 48 horas
   */
  formatCustomerOverdueNotice(params: { customerName: string }): string {
    return `Olá *${params.customerName}*! Tudo bem? 😊

Passando para lembrar que identificamos que o pagamento referente aos seus arremates no *Leilão TRIGON TCG* ainda está pendente.

O prazo informado para pagamento já foi encerrado e, por isso, pedimos que regularize assim que possível ou nos avise caso tenha ocorrido algum imprevisto. 🔺🃏

💰 *Pagamento via PIX ou cartão*:
📱 *PIX:* (31) 98341-0432
*Gabriel Henrique da Silva Gomes — Mercado Pago*

💳 *Cartão*: basta solicitar por aqui o link de pagamento.

Se o pagamento já tiver sido realizado, pode nos enviar o comprovante para conferirmos e darmos baixa. ✅

Agradecemos pela atenção e por participar dos leilões da *TRIGON*! 🔺`;
  },

  /**
   * Lista todos os leilões com métricas agregadas (ordenados DESC por data)
   */
  async getAuctions(): Promise<TcgAuction[]> {
    const { data: auctionsData, error: auctionsErr } = await supabase
      .from('tcg_auctions')
      .select('*')
      .order('start_date', { ascending: false });

    if (auctionsErr && isMissingTableError(auctionsErr)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const localItems = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      return this.enrichAuctionsWithStats(local, localItems);
    }

    const auctions = (auctionsData || []).map(mapAuctionRow);

    // Carrega itens para calcular os totais
    const { data: itemsData } = await supabase.from('tcg_auction_items').select('*');
    const items = (itemsData || []).map(mapAuctionItemRow);

    return this.enrichAuctionsWithStats(auctions, items);
  },

  enrichAuctionsWithStats(auctions: TcgAuction[], items: TcgAuctionItem[]): TcgAuction[] {
    const itemsByAuction = new Map<string, TcgAuctionItem[]>();
    for (const item of items) {
      const list = itemsByAuction.get(item.auctionId) || [];
      list.push(item);
      itemsByAuction.set(item.auctionId, list);
    }

    return auctions.map((auc) => {
      const aucItems = itemsByAuction.get(auc.id) || [];
      const itemsCount = aucItems.length;
      const arrematados = aucItems.filter((i) => i.status === 'ARREMATADO');
      const naoArrematados = aucItems.filter((i) => i.status === 'NAO_ARREMATADO');
      const paid = arrematados.filter((i) => i.paymentStatus === 'PAGO');
      const pending = arrematados.filter((i) => i.paymentStatus !== 'PAGO');

      const totalArrematado = arrematados.reduce(
        (acc, i) => acc + (i.isFreebie ? 0 : Number(i.finalPrice || i.initialPrice || 0)),
        0
      );
      const totalPendente = pending.reduce(
        (acc, i) => acc + (i.isFreebie ? 0 : Number(i.finalPrice || i.initialPrice || 0)),
        0
      );
      // O custo financeiro do leilão (CMV) considera APENAS as cartas arrematadas,
      // pois os lotes que não saíram são devolvidos ao estoque e permanecem como patrimônio da loja.
      const totalCusto = arrematados.reduce((acc, i) => acc + (Number(i.costPrice) || 0), 0);
      const totalLucro = totalArrematado - totalCusto;

      return {
        ...auc,
        itemsCount,
        arrematadosCount: arrematados.length,
        naoArrematadosCount: naoArrematados.length,
        paidCount: paid.length,
        pendingCount: pending.length,
        totalArrematado,
        totalPendente,
        totalCusto,
        totalLucro,
      };
    });
  },

  /**
   * Obtém um leilão por ID com seus lotes / itens
   */
  async getAuctionById(id: string): Promise<{ auction: TcgAuction; items: TcgAuctionItem[] } | null> {
    const { data: aucData, error: aucErr } = await supabase
      .from('tcg_auctions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (aucErr && isMissingTableError(aucErr)) {
      const localAuctions = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const localItems = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = localAuctions.find((a) => a.id === id);
      if (!found) return null;
      const items = localItems.filter((i) => i.auctionId === id);
      const [enriched] = this.enrichAuctionsWithStats([found], items);
      return { auction: enriched, items };
    }

    if (!aucData) return null;

    const { data: itemsData } = await supabase
      .from('tcg_auction_items')
      .select('*, customers(id, name, phone, email)')
      .eq('auction_id', id)
      .order('order_index', { ascending: true });

    const items = (itemsData || []).map(mapAuctionItemRow);
    const [enriched] = this.enrichAuctionsWithStats([mapAuctionRow(aucData)], items);

    return { auction: enriched, items };
  },

  /**
   * Cria um novo leilão (Pré-Leilão)
   */
  async createAuction(input: {
    code: string;
    title?: string | null;
    startDate: string;
    endDate: string;
    paymentDeadlineHours?: number;
    notes?: string | null;
  }): Promise<TcgAuction> {
    const now = new Date().toISOString();
    const payload = {
      code: input.code.trim().padStart(3, '0'),
      title: input.title?.trim() || `Leilão #${input.code.trim().padStart(3, '0')}`,
      status: 'PRE_LEILAO',
      start_date: input.startDate,
      end_date: input.endDate,
      payment_deadline_hours: input.paymentDeadlineHours || 48,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('tcg_auctions')
      .insert(payload)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const created: TcgAuction = {
        id: generateId('auc'),
        code: payload.code,
        title: payload.title,
        status: 'PRE_LEILAO',
        startDate: payload.start_date,
        endDate: payload.end_date,
        paymentDeadlineHours: payload.payment_deadline_hours,
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
      };
      local.unshift(created);
      writeLocal(LOCAL_STORAGE_KEYS.AUCTIONS, local);
      return created;
    }

    if (error) throw new Error(error.message || 'Erro ao criar leilão.');
    return mapAuctionRow(data);
  },

  /**
   * Registra um leilão retroativo já finalizado (#001 a #008)
   */
  async registerPastAuction(input: {
    code: string;
    title?: string | null;
    startDate: string;
    endDate: string;
    notes?: string | null;
  }): Promise<TcgAuction> {
    const now = new Date().toISOString();
    const payload = {
      code: input.code.trim().padStart(3, '0'),
      title: input.title?.trim() || `Leilão #${input.code.trim().padStart(3, '0')} (Histórico)`,
      status: 'FINALIZADO',
      start_date: input.startDate,
      end_date: input.endDate,
      payment_deadline_hours: 48,
      notes: input.notes?.trim() || 'Leilão registrado retroativamente',
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('tcg_auctions')
      .insert(payload)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const created: TcgAuction = {
        id: generateId('auc'),
        code: payload.code,
        title: payload.title,
        status: 'FINALIZADO',
        startDate: payload.start_date,
        endDate: payload.end_date,
        paymentDeadlineHours: 48,
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
      };
      local.unshift(created);
      writeLocal(LOCAL_STORAGE_KEYS.AUCTIONS, local);
      return created;
    }

    if (error) throw new Error(error.message || 'Erro ao registrar leilão passado.');
    return mapAuctionRow(data);
  },

  /**
   * Inicia o leilão: valida horário inicial e altera status para EM_ANDAMENTO
   */
  async startAuction(auctionId: string): Promise<TcgAuction> {
    const detail = await this.getAuctionById(auctionId);
    if (!detail) throw new Error('Leilão não encontrado.');

    const startTime = new Date(detail.auction.startDate).getTime();
    const now = Date.now();

    // Valida se o horário de início já chegou
    if (now < startTime) {
      const formatted = new Date(detail.auction.startDate).toLocaleString('pt-BR');
      throw new Error(
        `O leilão só pode ser iniciado dentro do horário programado (${formatted}).`
      );
    }

    const { data, error } = await supabase
      .from('tcg_auctions')
      .update({ status: 'EM_ANDAMENTO', updated_at: new Date().toISOString() })
      .eq('id', auctionId)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const found = local.find((a) => a.id === auctionId);
      if (found) {
        found.status = 'EM_ANDAMENTO';
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTIONS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao iniciar leilão.');
    return mapAuctionRow(data);
  },

  /**
   * Finaliza o leilão e devolve automaticamente ao estoque as cartas NÃO arrematadas
   */
  async finishAuction(auctionId: string): Promise<TcgAuction> {
    const detail = await this.getAuctionById(auctionId);
    if (!detail) throw new Error('Leilão não encontrado.');

    const endTime = new Date(detail.auction.endDate).getTime();
    const now = Date.now();

    // Valida se o horário de término já chegou (não permite encerrar antes do tempo)
    if (now < endTime) {
      const formatted = new Date(detail.auction.endDate).toLocaleString('pt-BR');
      throw new Error(
        `O leilão não pode ser encerrado antes do horário de término programado (${formatted}).`
      );
    }

    // 1. Estorna estoque de itens que ainda estavam pendentes (EM_LEILAO)
    try {
      await this.markAllUnsoldAsNaoArrematado(auctionId);
    } catch (err) {
      console.warn('[auctionService] Falha ao devolver estoque dos lotes não arrematados:', err);
    }

    const { data, error } = await supabase
      .from('tcg_auctions')
      .update({ status: 'FINALIZADO', updated_at: new Date().toISOString() })
      .eq('id', auctionId)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const found = local.find((a) => a.id === auctionId);
      if (found) {
        found.status = 'FINALIZADO';
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTIONS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao finalizar leilão.');
    return mapAuctionRow(data);
  },

  /**
   * Atualiza informações cadastrais do leilão (título, datas, prazo de pagamento, observações)
   */
  async updateAuction(
    auctionId: string,
    updates: {
      title?: string | null;
      startDate?: string;
      endDate?: string;
      paymentDeadlineHours?: number;
      notes?: string | null;
    }
  ): Promise<TcgAuction> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) payload.title = updates.title?.trim() || null;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.endDate !== undefined) payload.end_date = updates.endDate;
    if (updates.paymentDeadlineHours !== undefined)
      payload.payment_deadline_hours = updates.paymentDeadlineHours;
    if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

    const { data, error } = await supabase
      .from('tcg_auctions')
      .update(payload)
      .eq('id', auctionId)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuction[]>(LOCAL_STORAGE_KEYS.AUCTIONS, []);
      const found = local.find((a) => a.id === auctionId);
      if (found) {
        if (updates.title !== undefined) found.title = updates.title;
        if (updates.startDate !== undefined) found.startDate = updates.startDate;
        if (updates.endDate !== undefined) found.endDate = updates.endDate;
        if (updates.paymentDeadlineHours !== undefined)
          found.paymentDeadlineHours = updates.paymentDeadlineHours;
        if (updates.notes !== undefined) found.notes = updates.notes;
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTIONS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao atualizar informações do leilão.');
    return mapAuctionRow(data);
  },

  /**
   * Atualiza dados de um lote do leilão (preços, fotos, brinde, condição, idioma, acabamento, etc.)
   */
  async updateAuctionItem(
    itemId: string,
    updates: {
      title?: string;
      subtitle?: string | null;
      condition?: string | null;
      language?: string | null;
      finish?: string | null;
      initialPrice?: number;
      bidStep?: number;
      costPrice?: number;
      isFreebie?: boolean;
      customPhotoUrl?: string | null;
      notes?: string | null;
    }
  ): Promise<TcgAuctionItem> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle?.trim() || null;
    if (updates.condition !== undefined) payload.condition = updates.condition;
    if (updates.language !== undefined) payload.language = updates.language;
    if (updates.finish !== undefined) payload.finish = updates.finish;
    if (updates.costPrice !== undefined) payload.cost_price = Number(updates.costPrice) || 0;
    if (updates.isFreebie !== undefined) payload.is_freebie = Boolean(updates.isFreebie);
    if (updates.customPhotoUrl !== undefined)
      payload.custom_photo_url = updates.customPhotoUrl?.trim() || null;
    if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

    if (updates.isFreebie) {
      payload.initial_price = 0;
      payload.bid_step = 0;
      payload.bid_options = [0, 0, 0, 0, 0];
    } else {
      if (updates.initialPrice !== undefined) {
        payload.initial_price = Math.max(0, Number(updates.initialPrice) || 0);
      }
      if (updates.bidStep !== undefined) {
        payload.bid_step = Math.max(0.5, Number(updates.bidStep) || 1);
      }
      // Se alterou preço inicial ou step, recalcula as 5 opções da enquete
      if (updates.initialPrice !== undefined || updates.bidStep !== undefined) {
        const init = payload.initial_price ?? updates.initialPrice ?? 10;
        const step = payload.bid_step ?? updates.bidStep ?? 2;
        payload.bid_options = this.calculateBidOptions(init, step);
      }
    }

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .update(payload)
      .eq('id', itemId)
      .select('*, customers(id, name, phone, email)')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === itemId);
      if (found) {
        Object.assign(found, {
          title: payload.title ?? found.title,
          subtitle: payload.subtitle !== undefined ? payload.subtitle : found.subtitle,
          condition: payload.condition ?? found.condition,
          language: payload.language ?? found.language,
          finish: payload.finish ?? found.finish,
          costPrice: payload.cost_price ?? found.costPrice,
          isFreebie: payload.is_freebie ?? found.isFreebie,
          customPhotoUrl:
            payload.custom_photo_url !== undefined
              ? payload.custom_photo_url
              : found.customPhotoUrl,
          notes: payload.notes !== undefined ? payload.notes : found.notes,
          initialPrice: payload.initial_price ?? found.initialPrice,
          bidStep: payload.bid_step ?? found.bidStep,
          bidOptions: payload.bid_options ?? found.bidOptions,
          updatedAt: new Date().toISOString(),
        });
        writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao atualizar lote do leilão.');
    return mapAuctionItemRow(data);
  },

  /**
   * Reordena os lotes do leilão persistindo a nova sequência de order_index
   */
  async reorderAuctionItems(orderedItemIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const updates = orderedItemIds.map((id, index) => {
      return supabase
        .from('tcg_auction_items')
        .update({ order_index: index + 1, updated_at: now })
        .eq('id', id);
    });

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error && !isMissingTableError(r.error))?.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
    if (local.length > 0) {
      const orderMap = new Map<string, number>();
      orderedItemIds.forEach((id, idx) => orderMap.set(id, idx + 1));
      for (const item of local) {
        if (orderMap.has(item.id)) {
          item.orderIndex = orderMap.get(item.id)!;
        }
      }
      writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
    }
  },

  /**
   * Adiciona uma ou mais cartas (Dupla / Combo) do estoque ao leilão (subtrai 1 unidade de cada do estoque)
   */
  async addCardsToAuction(input: {
    auctionId: string;
    variantIds: string[];
    initialPrice: number;
    bidStep: number;
    isFreebie?: boolean;
    customTitle?: string;
    customSubtitle?: string;
    customPhotoUrl?: string | null;
    notes?: string | null;
    pastOutcome?: 'ARREMATADO' | 'NAO_ARREMATADO';
    pastWinningCustomerId?: string | null;
    pastFinalPrice?: number | null;
    pastPaymentStatus?: AuctionPaymentStatus;
    pastShippingStatus?: AuctionShippingStatus;
  }): Promise<TcgAuctionItem> {
    if (!input.variantIds || input.variantIds.length === 0) {
      throw new Error('Nenhuma carta selecionada para o lote.');
    }

    const auctionDetail = await this.getAuctionById(input.auctionId);
    if (!auctionDetail) throw new Error('Leilão não encontrado.');

    const isAuctionFinalizado = auctionDetail.auction.status === 'FINALIZADO';
    const outcome = input.pastOutcome || (isAuctionFinalizado ? 'ARREMATADO' : 'EM_LEILAO');

    // 1. Busca variantes no estoque para garantir saldo
    const allVariants = await cardStockService.getVariants();
    const targetVariants: TcgCardVariant[] = [];

    for (const vid of input.variantIds) {
      const v = allVariants.find((item) => item.id === vid);
      if (!v) throw new Error(`Carta não encontrada no estoque (ID: ${vid}).`);
      if (v.quantity < 1 && (!isAuctionFinalizado || outcome === 'ARREMATADO')) {
        throw new Error(`A carta ${v.card?.name || ''} está sem saldo no estoque (0 un.).`);
      }
      targetVariants.push(v);
    }

    const isBundle = targetVariants.length > 1;

    // 2. Movimentação de estoque:
    // Se o leilão é ativo/pré-leilão: reserva temporária de 1 unidade (SAIDA)
    // Se o leilão é finalizado e o item foi ARREMATADO: dedução permanente de 1 unidade (SAIDA)
    // Se o leilão é finalizado e o item NÃO foi arrematado: não deduz do estoque atual
    if (!isAuctionFinalizado || outcome === 'ARREMATADO') {
      const reason = isAuctionFinalizado
        ? `Arremate no Leilão Passado #${auctionDetail.auction.code}`
        : `Reserva para Lote ${isBundle ? 'Combo ' : ''}Leilão #${auctionDetail.auction.code}`;

      for (const v of targetVariants) {
        await cardStockService.recordMovement({
          variantId: v.id,
          type: 'SAIDA',
          quantity: 1,
          unitCost: v.acquisitionCost || null,
          reason,
        });
      }
    }

    // 3. Ordena as cartas do lote em ordem crescente de número (Dottler 019 antes de Orbeetle 020)
    targetVariants.sort((a, b) => compareCardNumbers(a.card?.localId, b.card?.localId));

    // Monta dados do lote
    const bidOptions = this.calculateBidOptions(input.initialPrice, input.bidStep);

    const bundleCards: AuctionBundleCard[] = targetVariants.map((v) => ({
      variantId: v.id,
      name: formatPokemonGenderName(v.card?.name || 'Carta TCG'),
      localId: v.card?.localId,
      totalCards: v.card?.totalCards,
      setName: v.card?.setName,
      condition: v.condition,
      language: v.language,
      finish: v.finish,
      costPrice: Number(v.acquisitionCost || 0),
      imageUrl: v.card?.imageUrl,
    }));

    // Título do lote: se combo, junta nome e número das cartas (ex: Dottler (019/196) + Orbeetle (020/196))
    const autoTitle = targetVariants
      .map((v) => {
        const cleanName = formatPokemonGenderName(v.card?.name || 'Carta TCG');
        const num = v.card?.localId
          ? ` (${v.card.localId}${v.card.totalCards ? `/${v.card.totalCards}` : ''})`
          : '';
        return `${cleanName}${num}`;
      })
      .join(' + ');

    const cardTitle = formatPokemonGenderName(input.customTitle?.trim() || autoTitle);

    // Coleções envolvidas (sem códigos como swsh11)
    const distinctSets = Array.from(
      new Set(
        targetVariants
          .map((v) => cleanSetName(v.card?.setName))
          .filter(Boolean)
      )
    );
    const subtitle = input.customSubtitle?.trim() || distinctSets.join(' / ') || null;

    // Condição, Idioma e Acabamento
    const distinctConditions = Array.from(new Set(targetVariants.map((v) => v.condition).filter(Boolean)));
    const condition = distinctConditions.length === 1 ? distinctConditions[0] : distinctConditions.join(' / ');

    const distinctLanguages = Array.from(new Set(targetVariants.map((v) => v.language).filter(Boolean)));
    const language = distinctLanguages.length === 1 ? distinctLanguages[0] : distinctLanguages.join(' / ');

    const distinctFinishes = Array.from(new Set(targetVariants.map((v) => v.finish).filter(Boolean)));
    const finish = distinctFinishes.length === 1 ? distinctFinishes[0] : 'VARIADO';

    const totalCost = targetVariants.reduce((acc, v) => acc + Number(v.acquisitionCost || 0), 0);
    const orderIndex = auctionDetail.items.length + 1;
    const now = new Date().toISOString();

    const itemStatus: AuctionItemStatus = isAuctionFinalizado
      ? outcome === 'NAO_ARREMATADO'
        ? 'NAO_ARREMATADO'
        : 'ARREMATADO'
      : 'EM_LEILAO';

    const finalPrice = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? (input.isFreebie ? 0 : Number(input.pastFinalPrice ?? input.initialPrice))
      : null;

    const winningCustomerId = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastWinningCustomerId || null
      : null;

    const paymentStatus: AuctionPaymentStatus = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastPaymentStatus || 'PAGO'
      : 'PENDENTE';

    const shippingStatus: AuctionShippingStatus = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastShippingStatus || 'RECEBIDO'
      : 'NAO_SOLICITADO';

    const payload = {
      auction_id: input.auctionId,
      card_variant_id: targetVariants[0]?.id || null,
      is_bundle: isBundle,
      bundle_variant_ids: input.variantIds,
      bundle_items: bundleCards,
      is_freebie: Boolean(input.isFreebie),
      is_custom_item: false,
      title: cardTitle,
      subtitle: subtitle,
      condition: condition,
      language: language,
      finish: finish,
      initial_price: input.isFreebie ? 0 : input.initialPrice,
      bid_step: input.bidStep,
      bid_options: bidOptions,
      final_price: finalPrice,
      cost_price: totalCost,
      status: itemStatus,
      winning_customer_id: winningCustomerId,
      payment_status: paymentStatus,
      shipping_status: shippingStatus,
      custom_photo_url: input.customPhotoUrl?.trim() || null,
      api_image_url: targetVariants[0]?.card?.imageUrl || null,
      order_index: orderIndex,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .insert(payload)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const created: TcgAuctionItem = {
        id: generateId('auc_item'),
        auctionId: payload.auction_id,
        cardVariantId: payload.card_variant_id,
        isBundle: payload.is_bundle,
        bundleVariantIds: payload.bundle_variant_ids,
        bundleCards: payload.bundle_items,
        isFreebie: payload.is_freebie,
        isCustomItem: false,
        title: payload.title,
        subtitle: payload.subtitle,
        condition: payload.condition,
        language: payload.language,
        finish: payload.finish,
        initialPrice: payload.initial_price,
        bidStep: payload.bid_step,
        bidOptions: payload.bid_options,
        finalPrice: payload.final_price,
        costPrice: payload.cost_price,
        status: payload.status,
        winningCustomerId: payload.winning_customer_id,
        paymentStatus: payload.payment_status,
        shippingStatus: payload.shipping_status,
        customPhotoUrl: payload.custom_photo_url,
        apiImageUrl: payload.api_image_url,
        orderIndex: payload.order_index,
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
      };
      local.push(created);
      writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
      return created;
    }

    if (error) throw new Error(error.message || 'Erro ao adicionar cartas ao leilão.');
    return mapAuctionItemRow(data);
  },

  /**
   * Adiciona uma carta única do estoque ao leilão (atalho para addCardsToAuction com 1 item)
   */
  async addCardToAuction(input: {
    auctionId: string;
    variantId: string;
    initialPrice: number;
    bidStep: number;
    isFreebie?: boolean;
    customPhotoUrl?: string | null;
    notes?: string | null;
  }): Promise<TcgAuctionItem> {
    return this.addCardsToAuction({
      auctionId: input.auctionId,
      variantIds: [input.variantId],
      initialPrice: input.initialPrice,
      bidStep: input.bidStep,
      isFreebie: input.isFreebie,
      customPhotoUrl: input.customPhotoUrl,
      notes: input.notes,
    });
  },

  /**
   * Adiciona um item avulso ao leilão (playmat, sleeve, booster avulso, etc.)
   */
  async addCustomItemToAuction(input: {
    auctionId: string;
    title: string;
    subtitle?: string | null;
    initialPrice: number;
    bidStep: number;
    costPrice?: number;
    isFreebie?: boolean;
    customPhotoUrl?: string | null;
    notes?: string | null;
    pastOutcome?: 'ARREMATADO' | 'NAO_ARREMATADO';
    pastWinningCustomerId?: string | null;
    pastFinalPrice?: number | null;
    pastPaymentStatus?: AuctionPaymentStatus;
    pastShippingStatus?: AuctionShippingStatus;
  }): Promise<TcgAuctionItem> {
    const auctionDetail = await this.getAuctionById(input.auctionId);
    if (!auctionDetail) throw new Error('Leilão não encontrado.');

    const isAuctionFinalizado = auctionDetail.auction.status === 'FINALIZADO';
    const outcome = input.pastOutcome || (isAuctionFinalizado ? 'ARREMATADO' : 'EM_LEILAO');

    const bidOptions = this.calculateBidOptions(input.initialPrice, input.bidStep);
    const orderIndex = auctionDetail.items.length + 1;
    const now = new Date().toISOString();

    const itemStatus: AuctionItemStatus = isAuctionFinalizado
      ? outcome === 'NAO_ARREMATADO'
        ? 'NAO_ARREMATADO'
        : 'ARREMATADO'
      : 'EM_LEILAO';

    const finalPrice = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? (input.isFreebie ? 0 : Number(input.pastFinalPrice ?? input.initialPrice))
      : null;

    const winningCustomerId = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastWinningCustomerId || null
      : null;

    const paymentStatus: AuctionPaymentStatus = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastPaymentStatus || 'PAGO'
      : 'PENDENTE';

    const shippingStatus: AuctionShippingStatus = isAuctionFinalizado && outcome === 'ARREMATADO'
      ? input.pastShippingStatus || 'RECEBIDO'
      : 'NAO_SOLICITADO';

    const payload = {
      auction_id: input.auctionId,
      card_variant_id: null,
      is_freebie: Boolean(input.isFreebie),
      is_custom_item: true,
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      condition: null,
      language: null,
      finish: null,
      initial_price: input.isFreebie ? 0 : input.initialPrice,
      bid_step: input.bidStep,
      bid_options: bidOptions,
      final_price: finalPrice,
      cost_price: input.costPrice || 0,
      status: itemStatus,
      winning_customer_id: winningCustomerId,
      payment_status: paymentStatus,
      shipping_status: shippingStatus,
      custom_photo_url: input.customPhotoUrl?.trim() || null,
      api_image_url: null,
      order_index: orderIndex,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .insert(payload)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const created: TcgAuctionItem = {
        id: generateId('auc_item'),
        auctionId: payload.auction_id,
        cardVariantId: null,
        isFreebie: payload.is_freebie,
        isCustomItem: true,
        title: payload.title,
        subtitle: payload.subtitle,
        condition: null,
        language: null,
        finish: null,
        initialPrice: payload.initial_price,
        bidStep: payload.bid_step,
        bidOptions: payload.bid_options,
        finalPrice: payload.final_price,
        costPrice: payload.cost_price,
        status: payload.status,
        winningCustomerId: payload.winning_customer_id,
        paymentStatus: payload.payment_status,
        shippingStatus: payload.shipping_status,
        customPhotoUrl: payload.custom_photo_url,
        apiImageUrl: null,
        orderIndex: payload.order_index,
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
      };
      local.push(created);
      writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
      return created;
    }

    if (error) throw new Error(error.message || 'Erro ao adicionar item avulso ao leilão.');
    return mapAuctionItemRow(data);
  },

  /**
   * Registra arremate de um item (vincula cliente, valor final e status)
   */
  async markItemArrematado(input: {
    itemId: string;
    winningCustomerId: string;
    finalPrice: number;
    paymentStatus?: AuctionPaymentStatus;
    shippingStatus?: AuctionShippingStatus;
  }): Promise<TcgAuctionItem> {
    // Valida se o leilão já foi iniciado
    const { data: itemData } = await supabase
      .from('tcg_auction_items')
      .select('auction_id, tcg_auctions(status)')
      .eq('id', input.itemId)
      .maybeSingle();

    if (itemData?.tcg_auctions && (itemData.tcg_auctions as any).status === 'PRE_LEILAO') {
      throw new Error('Não é possível registrar arremate enquanto o leilão estiver em fase de Pré-Leilão.');
    }

    const payload = {
      status: 'ARREMATADO',
      winning_customer_id: input.winningCustomerId,
      final_price: input.finalPrice,
      payment_status: input.paymentStatus || 'PENDENTE',
      shipping_status: input.shippingStatus || 'NAO_SOLICITADO',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .update(payload)
      .eq('id', input.itemId)
      .select('*, customers(id, name, phone, email)')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === input.itemId);
      if (found) {
        found.status = 'ARREMATADO';
        found.winningCustomerId = input.winningCustomerId;
        found.finalPrice = input.finalPrice;
        found.paymentStatus = input.paymentStatus || 'PENDENTE';
        found.shippingStatus = input.shippingStatus || 'NAO_SOLICITADO';
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao registrar arremate do item.');
    return mapAuctionItemRow(data);
  },

  /**
   * Marca o item como NÃO ARREMATADO e devolve automaticamente a carta ao estoque
   */
  async markItemNaoArrematado(itemId: string): Promise<TcgAuctionItem> {
    const { data: current, error: getErr } = await supabase
      .from('tcg_auction_items')
      .select('*, tcg_auctions(code, status)')
      .eq('id', itemId)
      .maybeSingle();

    if (current?.tcg_auctions && (current.tcg_auctions as any).status === 'PRE_LEILAO') {
      throw new Error('Não é possível marcar como Não Saiu antes do início do leilão.');
    }

    let variantIdsToRestock: { id: string; cost?: number | null }[] = [];
    let auctionCode = current?.tcg_auctions?.code || '—';

    if (current) {
      if (current.is_bundle && Array.isArray(current.bundle_items) && current.bundle_items.length > 0) {
        for (const bc of current.bundle_items) {
          variantIdsToRestock.push({ id: bc.variantId, cost: bc.costPrice });
        }
      } else if (Array.isArray(current.bundle_variant_ids) && current.bundle_variant_ids.length > 0) {
        for (const id of current.bundle_variant_ids) {
          variantIdsToRestock.push({ id, cost: current.cost_price });
        }
      } else if (current.card_variant_id) {
        variantIdsToRestock.push({ id: current.card_variant_id, cost: current.cost_price });
      }
    }

    if (getErr && isMissingTableError(getErr)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === itemId);
      if (found) {
        if (found.isBundle && found.bundleCards && found.bundleCards.length > 0) {
          for (const bc of found.bundleCards) {
            variantIdsToRestock.push({ id: bc.variantId, cost: bc.costPrice });
          }
        } else if (found.bundleVariantIds && found.bundleVariantIds.length > 0) {
          for (const id of found.bundleVariantIds) {
            variantIdsToRestock.push({ id, cost: found.costPrice });
          }
        } else if (found.cardVariantId) {
          variantIdsToRestock.push({ id: found.cardVariantId, cost: found.costPrice });
        }
      }
    }

    // Devolve ao estoque se era(m) carta(s) reservada(s)
    for (const target of variantIdsToRestock) {
      try {
        await cardStockService.recordMovement({
          variantId: target.id,
          type: 'ENTRADA',
          quantity: 1,
          unitCost: target.cost || null,
          reason: `Devolução de lote não arrematado — Leilão #${auctionCode}`,
        });
      } catch (err) {
        console.warn('[auctionService] Falha ao estornar estoque:', err);
      }
    }

    const payload = {
      status: 'NAO_ARREMATADO',
      winning_customer_id: null,
      final_price: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .update(payload)
      .eq('id', itemId)
      .select('*')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === itemId);
      if (found) {
        found.status = 'NAO_ARREMATADO';
        found.winningCustomerId = null;
        found.finalPrice = null;
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao marcar item como não arrematado.');
    return mapAuctionItemRow(data);
  },

  /**
   * Marca em lote todos os itens pendentes ('EM_LEILAO') como NÃO ARREMATADO
   * e estorna automaticamente as cartas ao estoque da loja
   */
  async markAllUnsoldAsNaoArrematado(auctionId: string): Promise<{ count: number }> {
    const detail = await this.getAuctionById(auctionId);
    if (!detail) throw new Error('Leilão não encontrado.');

    if (detail.auction.status === 'PRE_LEILAO') {
      throw new Error('Não é possível marcar como Não Saiu antes do início do leilão.');
    }

    const pendingItems = detail.items.filter((i) => i.status === 'EM_LEILAO');
    if (pendingItems.length === 0) {
      return { count: 0 };
    }

    // 1. Devolve as cartas dos lotes pendentes ao estoque
    for (const item of pendingItems) {
      const variantIdsToRestock: { id: string; cost?: number | null }[] = [];
      if (item.isBundle && item.bundleCards && item.bundleCards.length > 0) {
        for (const bc of item.bundleCards) {
          variantIdsToRestock.push({ id: bc.variantId, cost: bc.costPrice });
        }
      } else if (item.bundleVariantIds && item.bundleVariantIds.length > 0) {
        for (const id of item.bundleVariantIds) {
          variantIdsToRestock.push({ id, cost: item.costPrice });
        }
      } else if (item.cardVariantId) {
        variantIdsToRestock.push({ id: item.cardVariantId, cost: item.costPrice });
      }

      for (const target of variantIdsToRestock) {
        try {
          await cardStockService.recordMovement({
            variantId: target.id,
            type: 'ENTRADA',
            quantity: 1,
            unitCost: target.cost || null,
            reason: `Devolução em massa de lote não arrematado — Leilão #${detail.auction.code}`,
          });
        } catch (err) {
          console.warn(`[auctionService] Falha ao estornar estoque do item ${item.id}:`, err);
        }
      }
    }

    // 2. Atualiza todos os itens pendentes para NAO_ARREMATADO no Supabase
    const itemIds = pendingItems.map((i) => i.id);
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('tcg_auction_items')
      .update({
        status: 'NAO_ARREMATADO',
        winning_customer_id: null,
        final_price: null,
        updated_at: nowIso,
      })
      .in('id', itemIds);

    // Fallback local
    const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
    const idSet = new Set(itemIds);
    let changedLocal = false;
    for (const item of local) {
      if (idSet.has(item.id)) {
        item.status = 'NAO_ARREMATADO';
        item.winningCustomerId = null;
        item.finalPrice = null;
        item.updatedAt = nowIso;
        changedLocal = true;
      }
    }
    if (changedLocal) {
      writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message || 'Erro ao atualizar lotes não arrematados.');
    }

    return { count: pendingItems.length };
  },

  /**
   * Atualiza o status de pagamento e situação de envio de um arremate
   */
  async updateItemStatuses(input: {
    itemId: string;
    paymentStatus?: AuctionPaymentStatus;
    shippingStatus?: AuctionShippingStatus;
  }): Promise<TcgAuctionItem> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (input.paymentStatus) payload.payment_status = input.paymentStatus;
    if (input.shippingStatus) payload.shipping_status = input.shippingStatus;

    const { data, error } = await supabase
      .from('tcg_auction_items')
      .update(payload)
      .eq('id', input.itemId)
      .select('*, customers(id, name, phone, email)')
      .single();

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === input.itemId);
      if (found) {
        if (input.paymentStatus) found.paymentStatus = input.paymentStatus;
        if (input.shippingStatus) found.shippingStatus = input.shippingStatus;
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
        return found;
      }
    }

    if (error) throw new Error(error.message || 'Erro ao atualizar status do item.');
    return mapAuctionItemRow(data);
  },

  /**
   * Remove um item do leilão (se era carta reservada, estorna para o estoque)
   */
  async removeAuctionItem(itemId: string): Promise<void> {
    const { data: item } = await supabase
      .from('tcg_auction_items')
      .select('*, tcg_auctions(code)')
      .eq('id', itemId)
      .maybeSingle();

    let variantIdsToRestock: { id: string; cost?: number | null }[] = [];
    let auctionCode = item?.tcg_auctions?.code || '—';

    if (item) {
      if (item.is_bundle && Array.isArray(item.bundle_items) && item.bundle_items.length > 0) {
        for (const bc of item.bundle_items) {
          variantIdsToRestock.push({ id: bc.variantId, cost: bc.costPrice });
        }
      } else if (Array.isArray(item.bundle_variant_ids) && item.bundle_variant_ids.length > 0) {
        for (const id of item.bundle_variant_ids) {
          variantIdsToRestock.push({ id, cost: item.cost_price });
        }
      } else if (item.card_variant_id) {
        variantIdsToRestock.push({ id: item.card_variant_id, cost: item.cost_price });
      }
    }

    if (variantIdsToRestock.length > 0) {
      for (const target of variantIdsToRestock) {
        try {
          await cardStockService.recordMovement({
            variantId: target.id,
            type: 'ENTRADA',
            quantity: 1,
            unitCost: target.cost || null,
            reason: `Remoção do lote do Leilão #${auctionCode}`,
          });
        } catch (err) {
          console.warn('[auctionService] Falha ao estornar estoque na remoção:', err);
        }
      }
    }

    const { error } = await supabase.from('tcg_auction_items').delete().eq('id', itemId);
    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const filtered = local.filter((i) => i.id !== itemId);
      writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, filtered);
    }
  },

  /**
   * Atualiza a foto personalizada (tirada pelo celular ou upload) do item
   */
  async updateItemPhoto(itemId: string, photoUrl: string | null): Promise<void> {
    const cleanUrl = photoUrl?.trim() || null;
    const { error } = await supabase
      .from('tcg_auction_items')
      .update({ custom_photo_url: cleanUrl, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      const found = local.find((i) => i.id === itemId);
      if (found) {
        found.customPhotoUrl = cleanUrl;
        found.updatedAt = new Date().toISOString();
        writeLocal(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, local);
      }
    }
  },

  /**
   * Calcula estatísticas financeiras consolidadas de todos os leilões para o Dashboard
   */
  async getDashboardStats(): Promise<AuctionDashboardStats> {
    const auctions = await this.getAuctions();
    let totalItems = 0;
    let totalArrematados = 0;
    let totalNaoArrematados = 0;
    let totalArrematadoValue = 0;
    let totalPendingValue = 0;
    let totalPaidValue = 0;
    let totalCostValue = 0;

    for (const a of auctions) {
      totalItems += a.itemsCount || 0;
      totalArrematados += a.arrematadosCount || 0;
      totalNaoArrematados += a.naoArrematadosCount || 0;
      totalArrematadoValue += a.totalArrematado || 0;
      totalPendingValue += a.totalPendente || 0;
      totalCostValue += a.totalCusto || 0;
      totalPaidValue += (a.totalArrematado || 0) - (a.totalPendente || 0);
    }

    const totalProfitValue = totalArrematadoValue - totalCostValue;
    const conversionRate = totalItems > 0 ? (totalArrematados / totalItems) * 100 : 0;
    const profitMargin =
      totalArrematadoValue > 0 ? (totalProfitValue / totalArrematadoValue) * 100 : 0;

    return {
      totalAuctions: auctions.length,
      totalItems,
      totalArrematados,
      totalNaoArrematados,
      conversionRate,
      totalArrematadoValue,
      totalPendingValue,
      totalPaidValue,
      totalCostValue,
      totalProfitValue,
      profitMargin,
    };
  },

  /**
   * Obtém os arremates agrupados por cliente e leilão com prazo de 48h
   */
  async getCustomerArremateGroups(filterAuctionId?: string): Promise<CustomerArremateGroup[]> {
    const customers = await customerService.getCustomers();
    const customerMap = new Map<string, Customer>();
    for (const c of customers) customerMap.set(c.id, c);

    const auctions = await this.getAuctions();
    const auctionMap = new Map<string, TcgAuction>();
    for (const a of auctions) auctionMap.set(a.id, a);

    let query = supabase
      .from('tcg_auction_items')
      .select('*, customers(id, name, phone, email)')
      .eq('status', 'ARREMATADO')
      .not('winning_customer_id', 'is', null)
      .order('order_index', { ascending: true })
      .order('id', { ascending: true });

    if (filterAuctionId) {
      query = query.eq('auction_id', filterAuctionId);
    }

    const { data: itemsData, error } = await query;
    let rawItems: TcgAuctionItem[] = [];

    if (error && isMissingTableError(error)) {
      const local = readLocal<TcgAuctionItem[]>(LOCAL_STORAGE_KEYS.AUCTION_ITEMS, []);
      rawItems = local.filter(
        (i) =>
          i.status === 'ARREMATADO' &&
          i.winningCustomerId &&
          (!filterAuctionId || i.auctionId === filterAuctionId)
      );
    } else {
      rawItems = (itemsData || []).map(mapAuctionItemRow);
    }

    // Agrupa por `${customerId}__${auctionId}`
    const groupsMap = new Map<string, TcgAuctionItem[]>();
    for (const item of rawItems) {
      if (!item.winningCustomerId) continue;
      const key = `${item.winningCustomerId}__${item.auctionId}`;
      const list = groupsMap.get(key) || [];
      list.push(item);
      groupsMap.set(key, list);
    }

    const result: CustomerArremateGroup[] = [];

    for (const [key, items] of groupsMap.entries()) {
      const [customerId, auctionId] = key.split('__');
      const customer: Customer =
        customerMap.get(customerId) ||
        (items[0]?.winningCustomer as Customer) || {
          id: customerId,
          name: 'Cliente não identificado',
          phone: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      const auction = auctionMap.get(auctionId) || {
        id: auctionId,
        code: '—',
        title: 'Leilão',
        status: 'FINALIZADO' as AuctionStatus,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        paymentDeadlineHours: 48,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const totalValue = items.reduce(
        (acc, i) => acc + (i.isFreebie ? 0 : Number(i.finalPrice || i.initialPrice || 0)),
        0
      );

      // Data de término + 48 horas
      const endDateMs = new Date(auction.endDate).getTime();
      const deadlineMs = endDateMs + (auction.paymentDeadlineHours || 48) * 60 * 60 * 1000;
      const paymentDeadline = new Date(deadlineMs).toISOString();

      const nowMs = Date.now();
      const diffMs = deadlineMs - nowMs;
      const hoursRemaining = Math.round(diffMs / (60 * 60 * 1000));
      const allPaid = items.every((i) => i.paymentStatus === 'PAGO');
      const isOverdue = !allPaid && diffMs < 0;

      // Situação de envio consolidada
      const shippingStatus = items.every((i) => i.shippingStatus === 'RECEBIDO')
        ? 'RECEBIDO'
        : items.some((i) => i.shippingStatus === 'ENVIADO')
          ? 'ENVIADO'
          : items.some((i) => i.shippingStatus === 'SOLICITADO')
            ? 'SOLICITADO'
            : 'NAO_SOLICITADO';

      // Ordenação determinística e estável dos itens do cliente (por índice de ordem do lote e título)
      items.sort(
        (a, b) =>
          (a.orderIndex ?? 0) - (b.orderIndex ?? 0) ||
          (a.title || '').localeCompare(b.title || '', 'pt-BR') ||
          a.id.localeCompare(b.id)
      );

      result.push({
        customer,
        auction,
        items,
        totalValue,
        paymentDeadline,
        isOverdue,
        hoursRemaining,
        allPaid,
        shippingStatus,
      });
    }

    // Ordenação fixa e estável: por leilão DESC, e determinística por nome do cliente
    // (não altera a posição visual do cliente ao mudar seu status de pagamento ou envio)
    return result.sort((a, b) => {
      const cmpAuc = (b.auction.code || '').localeCompare(a.auction.code || '');
      if (cmpAuc !== 0) return cmpAuc;
      const cmpName = (a.customer.name || '').localeCompare(b.customer.name || '', 'pt-BR');
      if (cmpName !== 0) return cmpName;
      return a.customer.id.localeCompare(b.customer.id);
    });
  },
};
