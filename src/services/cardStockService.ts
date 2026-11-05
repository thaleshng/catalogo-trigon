import {
  TcgCard,
  TcgCardVariant,
  TcgCardStockMovement,
  TcgCardStockMovementType,
  TcgCardStockLot,
  TcgdexCardDetail,
} from '../types';
import { supabase } from '../lib/supabase';
import { authService } from './authService';
import { formatTcgdexImageUrl, normalizeCardLocalId, formatCardNumber } from './tcgdexService';
import { cleanSetName, formatPokemonGenderName, translateAsianPokemonName } from '../config/tcgSetTranslations';
import { generateId } from '../utils/idGenerator';

const LOCAL_STORAGE_KEYS = {
  CARDS: 'trigon_tcg_cards_v1',
  VARIANTS: 'trigon_tcg_variants_v1',
  MOVEMENTS: 'trigon_tcg_movements_v1',
  LOTS: 'trigon_tcg_lots_v1',
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

function normalizeOptionalNumber(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(String(val).replace(',', '.'));
  if (Number.isNaN(num)) return null;
  if (num < 0) {
    throw new Error('Os valores financeiros não podem ser negativos.');
  }
  return Math.round(num * 100) / 100;
}

function resolveCardDisplayName(rawName?: string | null, tcgdexId?: string | null): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  // Se for a carta M2a-110 salva anteriormente com o nome genérico Scrafty ex
  if (tcgdexId === 'M2a-110' && trimmed === 'Scrafty ex') {
    return 'Mega Scrafty ex';
  }
  // Se ainda possuir ideogramas asiáticos (japonês / chinês)
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) {
    const translated = translateAsianPokemonName(trimmed);
    if (translated && translated !== trimmed) {
      return translated;
    }
  }
  return formatPokemonGenderName(trimmed);
}

function mapCard(row: any): TcgCard {
  const rawName = row.name || '';
  const resolvedName = resolveCardDisplayName(rawName, row.tcgdex_id);

  // Auto-cura do banco de dados e local storage caso o nome tenha sido enriquecido
  if (resolvedName && resolvedName !== rawName && row.id) {
    supabase
      .from('tcg_cards')
      .update({ name: resolvedName, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .then(
        () => {},
        () => {}
      );

    try {
      const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
      const idx = localCards.findIndex(
        (c) => c.id === row.id || (row.tcgdex_id && c.tcgdexId === row.tcgdex_id)
      );
      if (idx >= 0 && localCards[idx].name !== resolvedName) {
        localCards[idx].name = resolvedName;
        writeLocal(LOCAL_STORAGE_KEYS.CARDS, localCards);
      }
    } catch {}
  }

  return {
    id: row.id,
    tcgdexId: row.tcgdex_id,
    name: resolvedName,
    setName: cleanSetName(row.set_name) || 'Não informado',
    setCode: row.set_code || 'Não informado',
    localId: row.local_id || '—',
    totalCards:
      row.total_cards !== null && row.total_cards !== undefined
        ? Number(row.total_cards)
        : null,
    imageUrl: row.image_url || null,
    rarity: row.rarity || null,
    category: row.category || null,
    hp: row.hp !== null && row.hp !== undefined ? Number(row.hp) : null,
    types: Array.isArray(row.types) ? row.types : [],
    illustrator: row.illustrator || null,
    description: row.description || null,
    ligaPokemonUrl: row.liga_pokemon_url || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVariant(row: any): TcgCardVariant {
  return {
    id: row.id,
    cardId: row.card_id,
    collectionId: row.collection_id || null,
    categoryId: row.category_id || null,
    condition: row.condition,
    language: row.language,
    finish: row.finish,
    quantity: Number(row.quantity) || 0,
    acquisitionCost:
      row.acquisition_cost !== null && row.acquisition_cost !== undefined
        ? Number(row.acquisition_cost)
        : null,
    referenceValue:
      row.reference_value !== null && row.reference_value !== undefined
        ? Number(row.reference_value)
        : null,
    salePrice:
      row.sale_price !== null && row.sale_price !== undefined
        ? Number(row.sale_price)
        : null,
    referenceDate: row.reference_date || null,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    card: row.tcg_cards ? mapCard(row.tcg_cards) : row.card,
  };
}

function mapMovement(row: any): TcgCardStockMovement {
  return {
    id: row.id,
    variantId: row.variant_id,
    type: row.type as TcgCardStockMovementType,
    quantity: Number(row.quantity) || 0,
    previousStock: Number(row.previous_stock) || 0,
    newStock: Number(row.new_stock) || 0,
    unitCost:
      row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : null,
    reason: row.reason || '',
    actor: row.actor || null,
    createdAt: row.created_at,
    variant: row.tcg_card_variants ? mapVariant(row.tcg_card_variants) : row.variant,
  };
}

function mapLot(row: any): TcgCardStockLot {
  return {
    id: row.id,
    variantId: row.variant_id,
    quantity: Number(row.quantity) || 0,
    unitCost:
      row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : null,
    entryDate: row.entry_date,
    notes: row.notes || null,
    actor: row.actor || null,
    createdAt: row.created_at,
  };
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export interface RegisterCardVariantInput {
  cardDetail: TcgdexCardDetail;
  condition: string;
  language: string;
  finish: string;
  quantity: number;
  collectionId?: string | null;
  categoryId?: string | null;
  acquisitionCost?: number | null;
  referenceValue?: number | null;
  salePrice?: number | null;
  referenceDate?: string | null;
  notes?: string | null;
  ligaPokemonUrl?: string | null;
  allowAddToExisting?: boolean;
}

export interface RegisterCardVariantResult {
  status: 'CREATED' | 'ADDED_TO_EXISTING' | 'DUPLICATE_FOUND';
  variant: TcgCardVariant;
  movement?: TcgCardStockMovement;
}

export interface RegisterManualCardInput {
  name: string;
  setName: string;
  setCode?: string | null;
  localId: string;
  totalCards?: number | null;
  rarity?: string | null;
  imageUrl?: string | null;
  ligaPokemonUrl?: string | null;

  condition: string;
  language: string;
  finish: string;
  quantity: number;
  collectionId?: string | null;
  categoryId?: string | null;
  acquisitionCost?: number | null;
  referenceValue?: number | null;
  salePrice?: number | null;
  referenceDate?: string | null;
  notes?: string | null;
  allowAddToExisting?: boolean;
}

export const cardStockService = {
  async getCurrentActor(): Promise<string | null> {
    try {
      const user = await authService.getUser();
      return user?.email || user?.id || 'Administrador';
    } catch {
      return 'Administrador';
    }
  },

  // ==========================================================================
  // CARTAS-BASE (tcg_cards)
  // ==========================================================================

  async ensureCardFromTcgdex(
    detail: TcgdexCardDetail,
    ligaPokemonUrl?: string | null
  ): Promise<TcgCard> {
    const tcgdexId = detail.id.trim();
    const totalCards =
      detail.set?.cardCount?.official ?? detail.set?.cardCount?.total ?? null;
    const imageUrl = formatTcgdexImageUrl(detail.image, 'high') || detail.image || null;
    const targetName = formatPokemonGenderName(
      translateAsianPokemonName(detail.name) || detail.name || 'Carta TCG'
    );

    const metadata = {
      variants: detail.variants || {},
      setLogo: detail.set?.logo || null,
      setSymbol: detail.set?.symbol || null,
    };

    const { data: existing, error: findErr } = await supabase
      .from('tcg_cards')
      .select('*')
      .eq('tcgdex_id', tcgdexId)
      .maybeSingle();

    if (findErr && isMissingTableError(findErr)) {
      const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
      const found = localCards.find((c) => c.tcgdexId === tcgdexId);
      const now = new Date().toISOString();
      if (found) {
        let changed = false;
        if (targetName && targetName !== found.name) {
          found.name = targetName;
          changed = true;
        }
        if (
          ligaPokemonUrl !== undefined &&
          ligaPokemonUrl !== null &&
          ligaPokemonUrl.trim() !== (found.ligaPokemonUrl || '')
        ) {
          found.ligaPokemonUrl = ligaPokemonUrl.trim() || null;
          changed = true;
        }
        if (changed) {
          found.updatedAt = now;
          writeLocal(LOCAL_STORAGE_KEYS.CARDS, localCards);
        }
        return found;
      }
      const created: TcgCard = {
        id: generateId('card'),
        tcgdexId,
        name: targetName,
        setName: cleanSetName(detail.set?.name) || 'Não informado',
        setCode: detail.set?.id || 'Não informado',
        localId: detail.localId || '—',
        totalCards,
        imageUrl,
        rarity: detail.rarity || null,
        category: detail.category || null,
        hp: detail.hp ?? null,
        types: detail.types || [],
        illustrator: detail.illustrator || null,
        description: detail.description || detail.effect || null,
        ligaPokemonUrl: ligaPokemonUrl?.trim() || null,
        metadata,
        createdAt: now,
        updatedAt: now,
      };
      localCards.push(created);
      writeLocal(LOCAL_STORAGE_KEYS.CARDS, localCards);
      return created;
    }

    if (findErr) {
      throw new Error(findErr.message);
    }

    if (existing) {
      const needsNameUpdate =
        targetName &&
        (targetName !== existing.name ||
          /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(existing.name));
      const needsUrlUpdate =
        ligaPokemonUrl !== undefined &&
        ligaPokemonUrl !== null &&
        ligaPokemonUrl.trim() !== (existing.liga_pokemon_url || '');

      if (needsNameUpdate || needsUrlUpdate) {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (needsNameUpdate) updatePayload.name = targetName;
        if (needsUrlUpdate) updatePayload.liga_pokemon_url = ligaPokemonUrl.trim() || null;

        const { data: updated, error: updErr } = await supabase
          .from('tcg_cards')
          .update(updatePayload)
          .eq('id', existing.id)
          .select()
          .single();
        if (!updErr && updated) return mapCard(updated);
      }
      return mapCard(existing);
    }

    const { data: inserted, error: insErr } = await supabase
      .from('tcg_cards')
      .insert({
        tcgdex_id: tcgdexId,
        name: targetName,
        set_name: cleanSetName(detail.set?.name) || 'Não informado',
        set_code: detail.set?.id || 'Não informado',
        local_id: detail.localId || '—',
        total_cards: totalCards,
        image_url: imageUrl,
        rarity: detail.rarity || null,
        category: detail.category || null,
        hp: detail.hp ?? null,
        types: detail.types || [],
        illustrator: detail.illustrator || null,
        description: detail.description || detail.effect || null,
        liga_pokemon_url: ligaPokemonUrl?.trim() || null,
        metadata,
      })
      .select()
      .single();

    if (insErr) {
      throw new Error(insErr.message);
    }

    return mapCard(inserted);
  },

  async updateCardLigaPokemonUrl(
    cardId: string,
    ligaPokemonUrl: string | null
  ): Promise<TcgCard> {
    const cleanUrl = ligaPokemonUrl?.trim() || null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('tcg_cards')
      .update({
        liga_pokemon_url: cleanUrl,
        updated_at: now,
      })
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
        const idx = localCards.findIndex((c) => c.id === cardId);
        if (idx < 0) throw new Error('Carta não encontrada.');
        localCards[idx] = {
          ...localCards[idx],
          ligaPokemonUrl: cleanUrl,
          updatedAt: now,
        };
        writeLocal(LOCAL_STORAGE_KEYS.CARDS, localCards);
        return localCards[idx];
      }
      throw new Error(error.message);
    }

    return mapCard(data);
  },

  // ==========================================================================
  // CONSULTA DE VARIANTES NO ESTOQUE
  // ==========================================================================

  async getVariants(filters?: {
    tcgdexId?: string;
    setName?: string;
    categoryId?: string;
    collectionId?: string;
    search?: string;
    condition?: string;
    language?: string;
  }): Promise<TcgCardVariant[]> {
    let query = supabase
      .from('tcg_card_variants')
      .select('*, tcg_cards!inner(*)')
      .order('updated_at', { ascending: false });

    if (filters?.condition) {
      query = query.eq('condition', filters.condition);
    }
    if (filters?.language) {
      query = query.eq('language', filters.language);
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters?.collectionId) {
      query = query.eq('collection_id', filters.collectionId);
    }
    if (filters?.tcgdexId) {
      query = query.eq('tcg_cards.tcgdex_id', filters.tcgdexId);
    }
    if (filters?.setName) {
      query = query.eq('tcg_cards.set_name', filters.setName);
    }

    const { data, error } = await query;

    let variants: TcgCardVariant[] = [];

    if (error) {
      if (isMissingTableError(error)) {
        const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
        const cardMap = new Map(localCards.map((c) => [c.id, c]));
        const localVariants = readLocal<TcgCardVariant[]>(
          LOCAL_STORAGE_KEYS.VARIANTS,
          []
        );
        variants = localVariants
          .map((v) => ({
            ...v,
            card: cardMap.get(v.cardId),
          }))
          .filter((v) => Boolean(v.card));

        if (filters?.condition) {
          variants = variants.filter((v) => v.condition === filters.condition);
        }
        if (filters?.language) {
          variants = variants.filter((v) => v.language === filters.language);
        }
        if (filters?.categoryId) {
          variants = variants.filter((v) => v.categoryId === filters.categoryId);
        }
        if (filters?.collectionId) {
          variants = variants.filter((v) => v.collectionId === filters.collectionId);
        }
        if (filters?.tcgdexId) {
          variants = variants.filter((v) => v.card?.tcgdexId === filters.tcgdexId);
        }
        if (filters?.setName) {
          variants = variants.filter((v) => v.card?.setName === filters.setName);
        }
      } else {
        console.error('Erro ao buscar variantes de cartas:', error);
        throw new Error(error.message);
      }
    } else {
      variants = (data || []).map(mapVariant);
    }

    // Filtro local por nome ou número (ex: "Charizard", "20/156", "006")
    if (filters?.search && filters.search.trim() !== '') {
      const term = filters.search.trim().toLowerCase();
      const normTermNumber = normalizeCardLocalId(term.split('/')[0]);
      variants = variants.filter((v) => {
        const cardName = (v.card?.name || '').toLowerCase();
        const setName = (v.card?.setName || '').toLowerCase();
        const localId = (v.card?.localId || '').toLowerCase();
        const fullNumber = formatCardNumber(localId, v.card?.totalCards).toLowerCase();
        const normCardLocal = normalizeCardLocalId(localId);

        return (
          cardName.includes(term) ||
          setName.includes(term) ||
          localId.includes(term) ||
          fullNumber.includes(term) ||
          (normTermNumber !== '' && normCardLocal === normTermNumber)
        );
      });
    }

    return variants;
  },

  async getStockMapByTcgdexId(): Promise<
    Record<
      string,
      {
        card: TcgCard;
        variants: TcgCardVariant[];
        totalQuantity: number;
      }
    >
  > {
    const allVariants = await this.getVariants();
    const map: Record<
      string,
      {
        card: TcgCard;
        variants: TcgCardVariant[];
        totalQuantity: number;
      }
    > = {};

    for (const v of allVariants) {
      if (!v.card) continue;
      const key = v.card.tcgdexId;
      if (!map[key]) {
        map[key] = {
          card: v.card,
          variants: [],
          totalQuantity: 0,
        };
      }
      map[key].variants.push(v);
      map[key].totalQuantity += v.quantity;
    }

    return map;
  },

  /**
   * Verifica se já existe uma variante idêntica (mesma carta-base + condição + idioma + acabamento).
   */
  async findExistingVariant(params: {
    tcgdexId: string;
    condition: string;
    language: string;
    finish: string;
  }): Promise<TcgCardVariant | null> {
    const variants = await this.getVariants({
      tcgdexId: params.tcgdexId,
      condition: params.condition,
      language: params.language,
    });

    return variants.find((v) => v.finish === params.finish) || null;
  },

  // ==========================================================================
  // CADASTRO DE VARIANTE E ENTRADA ADICIONAL
  // ==========================================================================

  async registerOrAddVariantStock(
    input: RegisterCardVariantInput
  ): Promise<RegisterCardVariantResult> {
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('A quantidade de entrada deve ser um número inteiro positivo.');
    }
    if (!input.condition?.trim()) {
      throw new Error('A condição da carta é obrigatória.');
    }
    if (!input.language?.trim()) {
      throw new Error('O idioma da carta é obrigatório.');
    }
    if (!input.finish?.trim()) {
      throw new Error('O acabamento da carta é obrigatório.');
    }

    const acquisitionCost = normalizeOptionalNumber(input.acquisitionCost);
    const referenceValue = normalizeOptionalNumber(input.referenceValue);
    const salePrice = normalizeOptionalNumber(input.salePrice);
    const referenceDate = input.referenceDate?.trim() || null;
    const notes = input.notes?.trim() || null;

    // 1. Garante que a carta-base exista em tcg_cards (com a coleção original da carta)
    const card = await this.ensureCardFromTcgdex(input.cardDetail, input.ligaPokemonUrl);

    // 2. Verifica se a combinação (cardId + condition + language + finish) já existe no estoque
    const existingVariant = await this.findExistingVariant({
      tcgdexId: card.tcgdexId,
      condition: input.condition,
      language: input.language,
      finish: input.finish,
    });

    if (existingVariant) {
      if (!input.allowAddToExisting) {
        return {
          status: 'DUPLICATE_FOUND',
          variant: existingVariant,
        };
      }

      const movementReason = notes
        ? `Entrada adicional de variante existente • ${notes}`
        : 'Entrada adicional em variante existente';

      const { variant: updatedVariant, movement } = await this.recordMovement({
        variantId: existingVariant.id,
        type: 'ENTRADA',
        quantity,
        reason: movementReason,
        unitCost: acquisitionCost,
      });

      if (
        referenceValue !== null ||
        salePrice !== null ||
        referenceDate !== null ||
        notes !== null
      ) {
        const finalVariant = await this.updateVariantDetails(updatedVariant.id, {
          referenceValue:
            referenceValue !== null ? referenceValue : updatedVariant.referenceValue,
          salePrice: salePrice !== null ? salePrice : updatedVariant.salePrice,
          referenceDate:
            referenceDate !== null ? referenceDate : updatedVariant.referenceDate,
          notes: notes !== null ? notes : updatedVariant.notes,
        });
        return {
          status: 'ADDED_TO_EXISTING',
          variant: finalVariant,
          movement,
        };
      }

      return {
        status: 'ADDED_TO_EXISTING',
        variant: updatedVariant,
        movement,
      };
    }

    // 3. Cria nova variante indo direto para a lista de estoque (prevalecendo a coleção da carta)
    const actor = await this.getCurrentActor();
    const now = new Date().toISOString();

    const insertPayload: Record<string, any> = {
      card_id: card.id,
      condition: input.condition,
      language: input.language,
      finish: input.finish,
      quantity,
      acquisition_cost: acquisitionCost,
      reference_value: referenceValue,
      sale_price: salePrice,
      reference_date: referenceDate,
      notes,
    };

    if (input.collectionId) {
      insertPayload.collection_id = input.collectionId;
    }
    if (input.categoryId) {
      insertPayload.category_id = input.categoryId;
    }

    const { data: createdRow, error: createErr } = await supabase
      .from('tcg_card_variants')
      .insert(insertPayload)
      .select('*, tcg_cards(*)')
      .single();

    if (createErr) {
      if (isMissingTableError(createErr)) {
        const localVariants = readLocal<TcgCardVariant[]>(
          LOCAL_STORAGE_KEYS.VARIANTS,
          []
        );
        const newVariant: TcgCardVariant = {
          id: generateId('var'),
          cardId: card.id,
          collectionId: input.collectionId || null,
          categoryId: input.categoryId || null,
          condition: input.condition,
          language: input.language,
          finish: input.finish,
          quantity,
          acquisitionCost,
          referenceValue,
          salePrice,
          referenceDate,
          notes,
          createdAt: now,
          updatedAt: now,
          card,
        };
        localVariants.unshift(newVariant);
        writeLocal(LOCAL_STORAGE_KEYS.VARIANTS, localVariants);

        const localLots = readLocal<TcgCardStockLot[]>(LOCAL_STORAGE_KEYS.LOTS, []);
        localLots.unshift({
          id: generateId('lot'),
          variantId: newVariant.id,
          quantity,
          unitCost: acquisitionCost,
          entryDate: now,
          notes: notes || 'Cadastro inicial da variante',
          actor,
          createdAt: now,
        });
        writeLocal(LOCAL_STORAGE_KEYS.LOTS, localLots);

        const localMovements = readLocal<TcgCardStockMovement[]>(
          LOCAL_STORAGE_KEYS.MOVEMENTS,
          []
        );
        const initialMovement: TcgCardStockMovement = {
          id: generateId('mov'),
          variantId: newVariant.id,
          type: 'ENTRADA',
          quantity,
          previousStock: 0,
          newStock: quantity,
          unitCost: acquisitionCost,
          reason: notes ? `Cadastro inicial • ${notes}` : 'Cadastro inicial no estoque de cartas',
          actor,
          createdAt: now,
          variant: newVariant,
        };
        localMovements.unshift(initialMovement);
        writeLocal(LOCAL_STORAGE_KEYS.MOVEMENTS, localMovements);

        return {
          status: 'CREATED',
          variant: newVariant,
          movement: initialMovement,
        };
      }

      throw new Error(createErr.message);
    }

    const createdVariant = mapVariant(createdRow);

    await supabase.from('tcg_card_stock_lots').insert({
      variant_id: createdVariant.id,
      quantity,
      unit_cost: acquisitionCost,
      notes: notes || 'Cadastro inicial da variante',
      actor,
    });

    const { data: movRow } = await supabase
      .from('tcg_card_stock_movements')
      .insert({
        variant_id: createdVariant.id,
        type: 'ENTRADA',
        quantity,
        previous_stock: 0,
        new_stock: quantity,
        unit_cost: acquisitionCost,
        reason: notes
          ? `Cadastro inicial • ${notes}`
          : 'Cadastro inicial no estoque de cartas',
        actor,
      })
      .select('*, tcg_card_variants(*, tcg_cards(*))')
      .single();

    return {
      status: 'CREATED',
      variant: createdVariant,
      movement: movRow ? mapMovement(movRow) : undefined,
    };
  },

  /**
   * Cadastra manualmente uma carta que não existe no catálogo oficial da TCGdex
   * (ex: coleções chinesas recentes, kits especiais de Halloween, cartas promocionais exclusivas),
   * inserindo-a diretamente em tcg_cards e criando a sua variante de estoque.
   */
  async registerManualCardAndVariant(
    input: RegisterManualCardInput
  ): Promise<RegisterCardVariantResult> {
    if (!input.name?.trim()) {
      throw new Error('O nome da carta é obrigatório.');
    }
    if (!input.setName?.trim()) {
      throw new Error('A coleção da carta é obrigatória.');
    }
    if (!input.localId?.trim()) {
      throw new Error('O número da carta na coleção é obrigatório.');
    }

    let localId = input.localId.trim();
    let totalCards = input.totalCards ?? null;
    if (localId.includes('/')) {
      const parts = localId.split('/');
      localId = parts[0].trim();
      const parsedTotal = parseInt(parts[1].trim(), 10);
      if (!Number.isNaN(parsedTotal) && parsedTotal > 0 && !totalCards) {
        totalCards = parsedTotal;
      }
    }

    const cleanSetName = input.setName.trim();
    const cleanSetCode = input.setCode?.trim() || cleanSetName.toUpperCase().slice(0, 10);

    const codeSlug = (input.setCode || cleanSetName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const numSlug = localId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tcgdexId = `manual-${codeSlug || 'set'}-${numSlug || generateId('c')}`;

    const syntheticDetail: TcgdexCardDetail = {
      id: tcgdexId,
      localId,
      name: input.name.trim(),
      image: input.imageUrl?.trim() || null,
      rarity: input.rarity?.trim() || null,
      category: 'Pokemon',
      set: {
        id: cleanSetCode,
        name: cleanSetName,
        cardCount: totalCards ? { official: totalCards, total: totalCards } : undefined,
      },
    };

    return this.registerOrAddVariantStock({
      cardDetail: syntheticDetail,
      condition: input.condition,
      language: input.language,
      finish: input.finish,
      quantity: input.quantity,
      collectionId: input.collectionId,
      categoryId: input.categoryId,
      acquisitionCost: input.acquisitionCost,
      referenceValue: input.referenceValue,
      salePrice: input.salePrice,
      referenceDate: input.referenceDate,
      notes: input.notes,
      ligaPokemonUrl: input.ligaPokemonUrl?.trim() || null,
      allowAddToExisting: input.allowAddToExisting !== false,
    });
  },

  /**
   * Atualiza informações financeiras (opcionais, aceitando NULL), observações e
   * vínculo comercial opcional com Linha de Produtos (categoryId) ou Coleção do site (collectionId).
   */
  async updateVariantDetails(
    variantId: string,
    updates: {
      acquisitionCost?: number | null;
      referenceValue?: number | null;
      salePrice?: number | null;
      referenceDate?: string | null;
      notes?: string | null;
      categoryId?: string | null;
      collectionId?: string | null;
      condition?: string | null;
      language?: string | null;
      finish?: string | null;
    }
  ): Promise<TcgCardVariant> {
    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      updated_at: now,
    };

    if ('acquisitionCost' in updates) {
      payload.acquisition_cost = normalizeOptionalNumber(updates.acquisitionCost);
    }
    if ('referenceValue' in updates) {
      payload.reference_value = normalizeOptionalNumber(updates.referenceValue);
    }
    if ('salePrice' in updates) {
      payload.sale_price = normalizeOptionalNumber(updates.salePrice);
    }
    if ('referenceDate' in updates) {
      payload.reference_date = updates.referenceDate?.trim() || null;
    }
    if ('notes' in updates) {
      payload.notes = updates.notes?.trim() || null;
    }
    if ('categoryId' in updates) {
      payload.category_id = updates.categoryId || null;
    }
    if ('collectionId' in updates) {
      payload.collection_id = updates.collectionId || null;
    }
    if ('condition' in updates && updates.condition) {
      payload.condition = updates.condition.trim();
    }
    if ('language' in updates && updates.language) {
      payload.language = updates.language.trim();
    }
    if ('finish' in updates && updates.finish) {
      payload.finish = updates.finish.trim();
    }

    const { data, error } = await supabase
      .from('tcg_card_variants')
      .update(payload)
      .eq('id', variantId)
      .select('*, tcg_cards(*)')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const localVariants = readLocal<TcgCardVariant[]>(
          LOCAL_STORAGE_KEYS.VARIANTS,
          []
        );
        const idx = localVariants.findIndex((v) => v.id === variantId);
        if (idx < 0) throw new Error('Variante não encontrada.');

        const current = localVariants[idx];
        const updated: TcgCardVariant = {
          ...current,
          acquisitionCost:
            'acquisitionCost' in updates
              ? normalizeOptionalNumber(updates.acquisitionCost)
              : current.acquisitionCost,
          referenceValue:
            'referenceValue' in updates
              ? normalizeOptionalNumber(updates.referenceValue)
              : current.referenceValue,
          salePrice:
            'salePrice' in updates
              ? normalizeOptionalNumber(updates.salePrice)
              : current.salePrice,
          referenceDate:
            'referenceDate' in updates
              ? updates.referenceDate?.trim() || null
              : current.referenceDate,
          notes: 'notes' in updates ? updates.notes?.trim() || null : current.notes,
          categoryId:
            'categoryId' in updates ? updates.categoryId || null : current.categoryId,
          collectionId:
            'collectionId' in updates
              ? updates.collectionId || null
              : current.collectionId,
          condition:
            'condition' in updates && updates.condition
              ? updates.condition.trim()
              : current.condition,
          language:
            'language' in updates && updates.language
              ? updates.language.trim()
              : current.language,
          finish:
            'finish' in updates && updates.finish
              ? updates.finish.trim()
              : current.finish,
          updatedAt: now,
        };
        localVariants[idx] = updated;
        writeLocal(LOCAL_STORAGE_KEYS.VARIANTS, localVariants);

        const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
        updated.card = localCards.find((c) => c.id === updated.cardId);
        return updated;
      }
      throw new Error(error.message);
    }

    return mapVariant(data);
  },

  /**
   * Exclui uma variante do estoque, limpando movimentações, lotes e desvinculando de leilões.
   */
  async deleteVariant(variantId: string): Promise<boolean> {
    try {
      // 1. Desvincular de itens de leilão para não violar integridade referencial
      await supabase
        .from('tcg_auction_items')
        .update({ card_variant_id: null })
        .eq('card_variant_id', variantId);

      // 2. Excluir movimentações e lotes da variante
      await supabase
        .from('tcg_card_stock_movements')
        .delete()
        .eq('variant_id', variantId);

      await supabase
        .from('tcg_card_stock_lots')
        .delete()
        .eq('variant_id', variantId);

      // 3. Excluir a própria variante
      const { error } = await supabase
        .from('tcg_card_variants')
        .delete()
        .eq('id', variantId);

      if (error && !isMissingTableError(error)) {
        console.error('Erro ao excluir variante no Supabase:', error);
        throw new Error(error.message);
      }
    } catch (err: any) {
      if (!isMissingTableError(err)) {
        console.warn('[cardStockService.deleteVariant] Aviso Supabase:', err);
      }
    }

    // Limpeza no LocalStorage (fallback offline e sincronia imediata)
    const localVariants = readLocal<TcgCardVariant[]>(LOCAL_STORAGE_KEYS.VARIANTS, []);
    writeLocal(
      LOCAL_STORAGE_KEYS.VARIANTS,
      localVariants.filter((v) => v.id !== variantId)
    );

    const localLots = readLocal<TcgCardStockLot[]>(LOCAL_STORAGE_KEYS.LOTS, []);
    writeLocal(
      LOCAL_STORAGE_KEYS.LOTS,
      localLots.filter((lot) => lot.variantId !== variantId)
    );

    const localMovs = readLocal<TcgCardStockMovement[]>(LOCAL_STORAGE_KEYS.MOVEMENTS, []);
    writeLocal(
      LOCAL_STORAGE_KEYS.MOVEMENTS,
      localMovs.filter((m) => m.variantId !== variantId)
    );

    const localAuctionItems = readLocal<any[]>('trigon_tcg_auction_items_v1', []);
    if (Array.isArray(localAuctionItems) && localAuctionItems.length > 0) {
      let modified = false;
      const updatedAuctionItems = localAuctionItems.map((item) => {
        if (item.cardVariantId === variantId) {
          modified = true;
          return { ...item, cardVariantId: null };
        }
        return item;
      });
      if (modified) {
        writeLocal('trigon_tcg_auction_items_v1', updatedAuctionItems);
      }
    }

    return true;
  },

  /**
   * Atualiza o nome de exibição de uma carta no catálogo interno.
   */
  async updateCardName(cardId: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('O nome da carta não pode ser vazio.');

    try {
      await supabase
        .from('tcg_cards')
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', cardId);
    } catch (err: any) {
      if (!isMissingTableError(err)) {
        console.warn('[cardStockService.updateCardName] Aviso Supabase:', err);
      }
    }

    const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
    const idx = localCards.findIndex((c) => c.id === cardId);
    if (idx >= 0) {
      localCards[idx].name = trimmed;
      localCards[idx].updatedAt = new Date().toISOString();
      writeLocal(LOCAL_STORAGE_KEYS.CARDS, localCards);
    }

    return true;
  },

  // ==========================================================================
  // MOVIMENTAÇÃO DE ESTOQUE ATÔMICA
  // ==========================================================================

  async recordMovement(params: {
    variantId: string;
    type: TcgCardStockMovementType;
    quantity: number;
    reason: string;
    unitCost?: number | null;
    adjustmentDirection?: 'ADD' | 'SUBTRACT';
  }): Promise<{ variant: TcgCardVariant; movement: TcgCardStockMovement }> {
    const quantity = Number(params.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        'A quantidade da movimentação deve ser um número inteiro maior que zero.'
      );
    }
    if (!params.reason?.trim()) {
      throw new Error('Informe o motivo da movimentação de estoque.');
    }

    const unitCost = normalizeOptionalNumber(params.unitCost);
    const actor = await this.getCurrentActor();
    const isAdditiveAdjustment =
      params.type === 'AJUSTE' && params.adjustmentDirection === 'ADD';

    if (params.type === 'ENTRADA' || params.type === 'SAIDA') {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'record_tcg_card_stock_movement',
        {
          p_variant_id: params.variantId,
          p_type: params.type,
          p_quantity: quantity,
          p_reason: params.reason.trim(),
          p_unit_cost: unitCost,
          p_actor: actor,
        }
      );

      if (!rpcErr && rpcData) {
        const [{ data: vRow }, { data: mRow }] = await Promise.all([
          supabase
            .from('tcg_card_variants')
            .select('*, tcg_cards(*)')
            .eq('id', params.variantId)
            .single(),
          supabase
            .from('tcg_card_stock_movements')
            .select('*, tcg_card_variants(*, tcg_cards(*))')
            .eq('id', rpcData.movement_id)
            .single(),
        ]);

        if (vRow && mRow) {
          return {
            variant: mapVariant(vRow),
            movement: mapMovement(mRow),
          };
        }
      } else if (rpcErr && rpcErr.message?.includes('Saldo insuficiente')) {
        throw new Error(rpcErr.message);
      }
    }

    const { data: currentRow, error: fetchErr } = await supabase
      .from('tcg_card_variants')
      .select('*, tcg_cards(*)')
      .eq('id', params.variantId)
      .single();

    if (fetchErr) {
      if (isMissingTableError(fetchErr)) {
        const localVariants = readLocal<TcgCardVariant[]>(
          LOCAL_STORAGE_KEYS.VARIANTS,
          []
        );
        const idx = localVariants.findIndex((v) => v.id === params.variantId);
        if (idx < 0) {
          throw new Error('Variante de carta não encontrada no estoque.');
        }

        const current = localVariants[idx];
        const previousStock = current.quantity;
        let newStock = previousStock;

        if (params.type === 'ENTRADA' || isAdditiveAdjustment) {
          newStock = previousStock + quantity;
        } else {
          if (previousStock < quantity) {
            throw new Error(
              `Estoque insuficiente para esta variante! Saldo disponível: ${previousStock} un., solicitado: ${quantity} un.`
            );
          }
          newStock = previousStock - quantity;
        }

        const now = new Date().toISOString();
        const updatedVariant: TcgCardVariant = {
          ...current,
          quantity: newStock,
          acquisitionCost:
            unitCost !== null && params.type === 'ENTRADA'
              ? unitCost
              : current.acquisitionCost,
          updatedAt: now,
        };
        localVariants[idx] = updatedVariant;
        writeLocal(LOCAL_STORAGE_KEYS.VARIANTS, localVariants);

        const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
        updatedVariant.card = localCards.find((c) => c.id === updatedVariant.cardId);

        if (params.type === 'ENTRADA') {
          const localLots = readLocal<TcgCardStockLot[]>(LOCAL_STORAGE_KEYS.LOTS, []);
          localLots.unshift({
            id: generateId('lot'),
            variantId: updatedVariant.id,
            quantity,
            unitCost,
            entryDate: now,
            notes: params.reason.trim(),
            actor,
            createdAt: now,
          });
          writeLocal(LOCAL_STORAGE_KEYS.LOTS, localLots);
        }

        const localMovements = readLocal<TcgCardStockMovement[]>(
          LOCAL_STORAGE_KEYS.MOVEMENTS,
          []
        );
        const mov: TcgCardStockMovement = {
          id: generateId('mov'),
          variantId: updatedVariant.id,
          type: params.type,
          quantity,
          previousStock,
          newStock,
          unitCost,
          reason: params.reason.trim(),
          actor,
          createdAt: now,
          variant: updatedVariant,
        };
        localMovements.unshift(mov);
        writeLocal(LOCAL_STORAGE_KEYS.MOVEMENTS, localMovements);

        return { variant: updatedVariant, movement: mov };
      }

      throw new Error('Variante não encontrada para movimentação de estoque.');
    }

    const previousStock = Number(currentRow.quantity) || 0;
    let newStock = previousStock;

    if (params.type === 'ENTRADA' || isAdditiveAdjustment) {
      newStock = previousStock + quantity;
    } else {
      if (previousStock < quantity) {
        throw new Error(
          `Estoque insuficiente para esta variante! Saldo disponível: ${previousStock} un., solicitado: ${quantity} un.`
        );
      }
      newStock = previousStock - quantity;
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      quantity: newStock,
      updated_at: now,
    };
    if (unitCost !== null && params.type === 'ENTRADA') {
      updatePayload.acquisition_cost = unitCost;
    }

    const { data: updatedRow, error: updErr } = await supabase
      .from('tcg_card_variants')
      .update(updatePayload)
      .eq('id', params.variantId)
      .eq('quantity', previousStock)
      .select('*, tcg_cards(*)')
      .maybeSingle();

    if (updErr) {
      throw new Error(`Erro ao atualizar saldo da variante: ${updErr.message}`);
    }
    if (!updatedRow) {
      throw new Error(
        'O saldo desta variante foi alterado simultaneamente por outra operação. Atualize a listagem e tente novamente.'
      );
    }

    if (params.type === 'ENTRADA') {
      await supabase.from('tcg_card_stock_lots').insert({
        variant_id: params.variantId,
        quantity,
        unit_cost: unitCost,
        notes: params.reason.trim(),
        actor,
      });
    }

    const { data: movRow, error: movErr } = await supabase
      .from('tcg_card_stock_movements')
      .insert({
        variant_id: params.variantId,
        type: params.type,
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: unitCost,
        reason: params.reason.trim(),
        actor,
      })
      .select('*, tcg_card_variants(*, tcg_cards(*))')
      .single();

    if (movErr) {
      throw new Error(`Erro ao registrar histórico de movimentação: ${movErr.message}`);
    }

    return {
      variant: mapVariant(updatedRow),
      movement: mapMovement(movRow),
    };
  },

  async getMovements(filters?: {
    variantId?: string;
    limit?: number;
  }): Promise<TcgCardStockMovement[]> {
    let query = supabase
      .from('tcg_card_stock_movements')
      .select('*, tcg_card_variants!inner(*, tcg_cards(*))')
      .order('created_at', { ascending: false });

    if (filters?.variantId) {
      query = query.eq('variant_id', filters.variantId);
    }
    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        const localCards = readLocal<TcgCard[]>(LOCAL_STORAGE_KEYS.CARDS, []);
        const cardMap = new Map(localCards.map((c) => [c.id, c]));
        const localVariants = readLocal<TcgCardVariant[]>(
          LOCAL_STORAGE_KEYS.VARIANTS,
          []
        );
        const variantMap = new Map(
          localVariants.map((v) => [v.id, { ...v, card: cardMap.get(v.cardId) }])
        );
        let movs = readLocal<TcgCardStockMovement[]>(
          LOCAL_STORAGE_KEYS.MOVEMENTS,
          []
        ).map((m) => ({
          ...m,
          variant: variantMap.get(m.variantId),
        }));

        if (filters?.variantId) {
          movs = movs.filter((m) => m.variantId === filters.variantId);
        }
        if (filters?.limit && filters.limit > 0) {
          movs = movs.slice(0, filters.limit);
        }
        return movs;
      }
      console.error('Erro ao buscar histórico de movimentações de cartas:', error);
      return [];
    }

    return (data || []).map(mapMovement);
  },

  async getLotsByVariant(variantId: string): Promise<TcgCardStockLot[]> {
    const { data, error } = await supabase
      .from('tcg_card_stock_lots')
      .select('*')
      .eq('variant_id', variantId)
      .order('entry_date', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        const localLots = readLocal<TcgCardStockLot[]>(LOCAL_STORAGE_KEYS.LOTS, []);
        return localLots.filter((l) => l.variantId === variantId);
      }
      console.error('Erro ao buscar lotes da variante:', error);
      return [];
    }

    return (data || []).map(mapLot);
  },
};
