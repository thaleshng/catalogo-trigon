import {
  TcgdexCardBrief,
  TcgdexCardDetail,
  TcgdexSetSummary,
} from '../types';
import { supabase } from '../lib/supabase';
import {
  getTranslatedSetName,
  formatCardNumber,
  getJapaneseCardScanUrl,
  getWesternPromoCardScanUrl,
  getTrainerGalleryCardScanUrl,
  translateAsianPokemonName,
  formatPokemonGenderName,
} from '../config/tcgSetTranslations';

export { formatCardNumber };

const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2';

// Caches em memória para evitar chamadas redundantes à API TCGdex
const setsCache: {
  list: TcgdexSetSummary[] | null;
  map: Map<string, TcgdexSetSummary>;
  promise: Promise<TcgdexSetSummary[]> | null;
} = {
  list: null,
  map: new Map(),
  promise: null,
};

const raritiesCache: {
  list: string[] | null;
  promise: Promise<string[]> | null;
} = {
  list: null,
  promise: null,
};

const searchListCache = new Map<string, TcgdexCardBrief[]>();
const cardDetailCache = new Map<string, TcgdexCardDetail>();
const dexEnCardsCache = new Map<number, any[]>();

function hasAsianChars(text?: string | null): boolean {
  if (!text) return false;
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text);
}

/**
 * Formata a URL de imagem da TCGdex v2.
 * A API retorna o caminho-base (ex: https://assets.tcgdex.net/pt/sv/sv03.5/006),
 * que requer o sufixo /{quality}.{ext} (low.webp ou high.webp).
 */
export function formatTcgdexImageUrl(
  rawImage?: string | null,
  quality: 'low' | 'high' = 'low'
): string | null {
  if (!rawImage || typeof rawImage !== 'string') return null;
  const trimmed = rawImage.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || /\.(webp|png|jpg|jpeg)$/i.test(trimmed)) {
    if (quality === 'high' && trimmed.endsWith('/low.webp')) {
      return trimmed.replace(/\/low\.webp$/, '/high.webp');
    }
    if (quality === 'low' && trimmed.endsWith('/high.webp')) {
      return trimmed.replace(/\/high\.webp$/, '/low.webp');
    }
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/, '')}/${quality}.webp`;
}

/**
 * Extrai o código do set a partir do ID único da carta e seu localId.
 * Exemplo: id = "sv03.5-006", localId = "006" => setId = "sv03.5"
 */
export function extractSetIdFromCardId(cardId: string, localId?: string): string {
  if (localId && cardId.endsWith(`-${localId}`)) {
    return cardId.slice(0, cardId.length - localId.length - 1);
  }
  const lastDash = cardId.lastIndexOf('-');
  return lastDash > 0 ? cardId.slice(0, lastDash) : cardId;
}

/**
 * Normaliza o número da carta removendo zeros à esquerda para comparação consistente
 * Ex: "020" -> "20", "006" -> "6", "TG05" -> "tg5"
 */
export function normalizeCardLocalId(value?: string | null): string {
  if (!value) return '';
  const clean = value.trim().toLowerCase().replace(/^#/, '');
  if (/^\d+$/.test(clean)) {
    return clean.replace(/^0+/, '') || '0';
  }
  return clean.replace(/^([a-z]+)0+(\d+)$/, '$1$2');
}

/**
 * Interpreta o texto de busca permitindo pesquisar por:
 * - Nome ("Charizard")
 * - Número completo com total da coleção ("20/156", "006/165")
 * - Nome + Número ("Charizard 006/165", "Pikachu 025", "20/156 Chimchar")
 * - Apenas Número ("006", "20", "#20")
 */
export function parseCardSearchQuery(rawQuery: string): {
  nameQuery: string;
  localIdQuery: string | null;
  totalCardsQuery: number | null;
} {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { nameQuery: '', localIdQuery: null, totalCardsQuery: null };
  }

  // 1. Verifica padrão "numero/total" com ou sem parênteses (ex: "20/156", "Dustox (195/193)", "Charizard 006/165", "Mega Meganium ex (034/∞)", "Kleavor (TG08/TG30)")
  const fractionRegex =
    /(?:^|\s|[(\[])#?([a-zA-Z]*\d+[a-zA-Z]*)\s*\/\s*([a-zA-Z]*\d+|∞|inf|infinity|\?)[)\]]?(?=\s|$)/i;
  const fractionMatch = trimmed.match(fractionRegex);
  if (fractionMatch) {
    const localIdQuery = fractionMatch[1].trim();
    const rawTotal = fractionMatch[2].trim();
    const digitsOnly = rawTotal.replace(/\D/g, '');
    const totalCardsQuery = digitsOnly ? parseInt(digitsOnly, 10) : null;
    const nameQuery = trimmed
      .replace(fractionMatch[0], ' ')
      .replace(/[()[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { nameQuery, localIdQuery, totalCardsQuery };
  }

  // 2. Verifica se a busca inteira é apenas um número (ex: "20", "006", "#25", "(195)")
  const onlyNumberMatch = trimmed.match(/^[(\[]?#?(\d+[a-zA-Z]?)[)\]]?$/);
  if (onlyNumberMatch) {
    return {
      nameQuery: '',
      localIdQuery: onlyNumberMatch[1],
      totalCardsQuery: null,
    };
  }

  // 3. Verifica se há nome + número separado por espaço ou parênteses (ex: "Charizard 006", "Dustox (195)")
  const nameAndNumberMatch = trimmed.match(/^(.*?)\s+[(\[]?#?(\d+[a-zA-Z]?)[)\]]?$/);
  if (nameAndNumberMatch && nameAndNumberMatch[1].trim().length > 0) {
    return {
      nameQuery: nameAndNumberMatch[1].replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim(),
      localIdQuery: nameAndNumberMatch[2].trim(),
      totalCardsQuery: null,
    };
  }

  return { nameQuery: trimmed, localIdQuery: null, totalCardsQuery: null };
}

/**
 * Avalia se uma carta atende aos critérios de pesquisa, suportando:
 * - Número exato com ou sem total ("047/217", "47/217", "047", "47", "#047")
 * - Nome + número ("Froslass 047", "Mega Froslass 47/217")
 * - Nome da carta ou Pokémon ("Froslass", "Charizard")
 * - Nome da coleção ("Heróis Excelsos", "151")
 * - Identificadores especiais com letras ("TG08/TG30", "096C/151")
 */
export function matchesCardQuery(
  rawQuery: string,
  card?: {
    name?: string | null;
    setName?: string | null;
    localId?: string | null;
    totalCards?: number | null;
  } | null
): boolean {
  if (!card) return false;
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const rawLower = trimmed.toLowerCase();
  const cardName = (card.name || '').toLowerCase();
  const setName = (card.setName || '').toLowerCase();
  const localId = (card.localId || '').toLowerCase();
  const totalCards = card.totalCards;

  const formattedFraction = totalCards ? `${localId}/${totalCards}` : localId;
  const normLocal = normalizeCardLocalId(localId);
  const normFraction = totalCards ? `${normLocal}/${totalCards}` : normLocal;

  const { nameQuery, localIdQuery, totalCardsQuery } = parseCardSearchQuery(trimmed);

  // 1. Caso com Nome + Número combinados (ex: "Froslass 047" ou "Charizard 20/156")
  if (nameQuery && localIdQuery) {
    const normLocalTarget = normalizeCardLocalId(localIdQuery);
    const matchesName =
      cardName.includes(nameQuery.toLowerCase()) ||
      setName.includes(nameQuery.toLowerCase());
    const matchesNumber =
      localId.includes(localIdQuery.toLowerCase()) ||
      normLocal === normLocalTarget;
    const matchesTotal = !totalCardsQuery || totalCards === totalCardsQuery;
    if (matchesName && matchesNumber && matchesTotal) return true;
    return false;
  }

  // 2. Caso de apenas número ou fração (ex: "047", "47", "047/217", "47/217", "#047")
  if (localIdQuery) {
    const normLocalTarget = normalizeCardLocalId(localIdQuery);
    const matchesNumber =
      localId.includes(localIdQuery.toLowerCase()) ||
      normLocal === normLocalTarget;
    const matchesTotal = !totalCardsQuery || totalCards === totalCardsQuery;
    if (matchesNumber && matchesTotal) return true;
  }

  // 3. Fallback genérico:
  // - Nome contém a busca
  // - Coleção contém a busca
  // - Número cru contém a busca (ex: "047")
  // - Fração crua contém a busca (ex: "047/217")
  // - Fração normalizada contém a busca (ex: "47/217")
  // - Número normalizado bate exatamente (ex: "47" === "47")
  return (
    cardName.includes(rawLower) ||
    setName.includes(rawLower) ||
    localId.includes(rawLower) ||
    formattedFraction.includes(rawLower) ||
    normFraction.includes(rawLower) ||
    (normLocal !== '' && normLocal === normalizeCardLocalId(rawLower))
  );
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`TCGdex HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Busca na base em inglês as cartas do mesmo Pokémon (pelo National Pokédex ID)
 * para traduzir nomes de cartas japonesas (ex: ドクケイル -> Dustox) e recuperar
 * a arte oficial quando a entrada japonesa ainda não possui imagem própria.
 */
async function getEnglishCardsByDexId(
  dexId: number,
  signal?: AbortSignal
): Promise<any[]> {
  if (dexEnCardsCache.has(dexId)) {
    return dexEnCardsCache.get(dexId)!;
  }

  try {
    const list = await fetchJson<any[]>(
      `${TCGDEX_API_BASE}/en/cards?dexId=${dexId}`,
      signal
    );
    const valid = Array.isArray(list) ? list : [];
    dexEnCardsCache.set(dexId, valid);
    return valid;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
}

function normalizeCardDetail(raw: any, fallbackEn?: any): TcgdexCardDetail {
  const setObj = raw.set || fallbackEn?.set || {};
  const inferredSetId = setObj.id || extractSetIdFromCardId(raw.id || '', raw.localId);
  const rawSetName = setObj.name || fallbackEn?.set?.name;
  const translatedSetName = getTranslatedSetName(inferredSetId, rawSetName);
  const jpScan = getJapaneseCardScanUrl(inferredSetId, raw.localId || fallbackEn?.localId);
  const promoScan = getWesternPromoCardScanUrl(inferredSetId, raw.localId || fallbackEn?.localId);
  const tgScan = getTrainerGalleryCardScanUrl(inferredSetId, raw.localId || fallbackEn?.localId);
  const rawImage = raw.image || jpScan || promoScan || tgScan || fallbackEn?.image || null;

  const rawCardName = raw.name || fallbackEn?.name || 'Não informado';
  const resolvedCardName = formatPokemonGenderName(
    hasAsianChars(rawCardName)
      ? translateAsianPokemonName(rawCardName)
      : rawCardName
  );

  return {
    id: raw.id || fallbackEn?.id || '',
    localId: String(raw.localId ?? fallbackEn?.localId ?? '—'),
    name: resolvedCardName,
    image: rawImage,
    category: raw.category || fallbackEn?.category || null,
    illustrator: raw.illustrator || fallbackEn?.illustrator || null,
    rarity:
      raw.rarity && raw.rarity !== 'None'
        ? raw.rarity
        : fallbackEn?.rarity && fallbackEn.rarity !== 'None'
          ? fallbackEn.rarity
          : null,
    hp: typeof raw.hp === 'number' ? raw.hp : typeof fallbackEn?.hp === 'number' ? fallbackEn.hp : null,
    types: Array.isArray(raw.types)
      ? raw.types
      : Array.isArray(fallbackEn?.types)
        ? fallbackEn.types
        : [],
    evolveFrom: raw.evolveFrom || fallbackEn?.evolveFrom || null,
    stage: raw.stage || fallbackEn?.stage || null,
    description: raw.description || fallbackEn?.description || null,
    effect: raw.effect || fallbackEn?.effect || null,
    trainerType: raw.trainerType || fallbackEn?.trainerType || null,
    energyType: raw.energyType || fallbackEn?.energyType || null,
    retreat:
      typeof raw.retreat === 'number'
        ? raw.retreat
        : typeof fallbackEn?.retreat === 'number'
          ? fallbackEn.retreat
          : null,
    regulationMark: raw.regulationMark || fallbackEn?.regulationMark || null,
    set: {
      id: inferredSetId,
      name: translatedSetName,
      logo: setObj.logo || fallbackEn?.set?.logo,
      symbol: setObj.symbol || fallbackEn?.set?.symbol,
      cardCount: setObj.cardCount || fallbackEn?.set?.cardCount,
    },
    variants: raw.variants || fallbackEn?.variants,
    attacks: Array.isArray(raw.attacks)
      ? raw.attacks
      : Array.isArray(fallbackEn?.attacks)
        ? fallbackEn.attacks
        : [],
    abilities: Array.isArray(raw.abilities)
      ? raw.abilities
      : Array.isArray(fallbackEn?.abilities)
        ? fallbackEn.abilities
        : [],
    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses
      : Array.isArray(fallbackEn?.weaknesses)
        ? fallbackEn.weaknesses
        : [],
    resistances: Array.isArray(raw.resistances)
      ? raw.resistances
      : Array.isArray(fallbackEn?.resistances)
        ? fallbackEn.resistances
        : [],
  };
}

export interface TcgdexSearchParams {
  query?: string;
  setId?: string;
  rarity?: string;
  page?: number;
  pageSize?: number;
}

export interface TcgdexSearchResult {
  items: TcgdexCardBrief[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const tcgdexService = {
  formatImageUrl: formatTcgdexImageUrl,

  /**
   * Obtém e armazena em cache todas as coleções/edições da TCGdex (PT, EN e JA).
   */
  async getSets(): Promise<TcgdexSetSummary[]> {
    if (setsCache.list) {
      return setsCache.list;
    }

    if (setsCache.promise) {
      return setsCache.promise;
    }

    setsCache.promise = (async () => {
      try {
        const [ptSets, enSets, jaSets, zhTwSets, zhCnSets, koSets] = await Promise.all([
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/pt/sets`).catch(() => []),
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/en/sets`).catch(() => []),
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/ja/sets`).catch(() => []),
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/zh-tw/sets`).catch(() => []),
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/zh-cn/sets`).catch(() => []),
          fetchJson<TcgdexSetSummary[]>(`${TCGDEX_API_BASE}/ko/sets`).catch(() => []),
        ]);

        const mergedMap = new Map<string, TcgdexSetSummary>();

        // 1. Coleções Asiáticas (Japão, Chinês Tradicional, Chinês Simplificado, Coreia)
        for (const s of zhCnSets) {
          if (s && s.id) {
            mergedMap.set(s.id, {
              ...s,
              name: getTranslatedSetName(s.id, s.name),
            });
          }
        }

        for (const s of zhTwSets) {
          if (s && s.id) {
            mergedMap.set(s.id, {
              ...s,
              name: getTranslatedSetName(s.id, s.name),
            });
          }
        }

        for (const s of koSets) {
          if (s && s.id) {
            mergedMap.set(s.id, {
              ...s,
              name: getTranslatedSetName(s.id, s.name),
            });
          }
        }

        for (const s of jaSets) {
          if (s && s.id) {
            mergedMap.set(s.id, {
              ...s,
              name: getTranslatedSetName(s.id, s.name),
            });
          }
        }

        // 2. Coleções em Inglês
        for (const s of enSets) {
          if (s && s.id) {
            mergedMap.set(s.id, s);
          }
        }

        // 3. Coleções em Português (prioridade para o nome em PT quando existir)
        for (const s of ptSets) {
          if (s && s.id) {
            const existing = mergedMap.get(s.id);
            mergedMap.set(s.id, {
              ...existing,
              ...s,
              symbol: s.symbol || existing?.symbol,
              logo: s.logo || existing?.logo,
              cardCount: s.cardCount || existing?.cardCount,
            });
          }
        }

        const allSets = Array.from(mergedMap.values()).reverse();
        setsCache.list = allSets;
        setsCache.map = mergedMap;
        return allSets;
      } finally {
        setsCache.promise = null;
      }
    })();

    return setsCache.promise;
  },

  /**
   * Obtém a lista de raridades suportadas pela TCGdex (em PT).
   */
  async getRarities(): Promise<string[]> {
    if (raritiesCache.list) {
      return raritiesCache.list;
    }

    if (raritiesCache.promise) {
      return raritiesCache.promise;
    }

    raritiesCache.promise = (async () => {
      try {
        const ptRarities = await fetchJson<string[]>(`${TCGDEX_API_BASE}/pt/rarities`).catch(
          () => []
        );
        const filtered = (ptRarities || []).filter(
          (r) => Boolean(r) && r !== 'None' && r.trim() !== ''
        );
        raritiesCache.list = filtered;
        return filtered;
      } finally {
        raritiesCache.promise = null;
      }
    })();

    return raritiesCache.promise;
  },

  /**
   * Busca os detalhes completos de uma carta na TCGdex pelo ID único (PT, EN, JA, ZH-TW, ZH-CN, KO).
   */
  async getCardById(cardId: string, signal?: AbortSignal): Promise<TcgdexCardDetail> {
    const cleanId = cardId.trim();
    const cached = cardDetailCache.get(cleanId);
    if (cached) {
      return cached;
    }

    // Se for uma carta cadastrada manualmente no estoque (iniciando em "manual-"):
    // resolve direto do banco de dados local da Trigon sem tentar a API internacional
    if (cleanId.startsWith('manual-')) {
      try {
        const { data: dbCard } = await supabase
          .from('tcg_cards')
          .select('*')
          .eq('tcgdex_id', cleanId)
          .maybeSingle();

        if (dbCard) {
          const detail: TcgdexCardDetail = {
            id: dbCard.tcgdex_id,
            localId: dbCard.local_id || '—',
            name: dbCard.name,
            image: dbCard.image_url,
            rarity: dbCard.rarity || null,
            category: dbCard.category || 'Pokemon',
            set: {
              id: dbCard.set_code || 'MANUAL',
              name: dbCard.set_name || 'Coleção Manual',
              cardCount: dbCard.total_cards
                ? { official: dbCard.total_cards, total: dbCard.total_cards }
                : undefined,
            },
          };
          cardDetailCache.set(cleanId, detail);
          return detail;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
      }

      // Fallback em LocalStorage se o Supabase estiver offline
      try {
        const localCardsRaw = localStorage.getItem('trigon_tcg_cards_v1');
        if (localCardsRaw) {
          const localCards = JSON.parse(localCardsRaw);
          const found = localCards.find((c: any) => c.tcgdexId === cleanId);
          if (found) {
            const detail: TcgdexCardDetail = {
              id: found.tcgdexId,
              localId: found.localId || '—',
              name: found.name,
              image: found.imageUrl,
              rarity: found.rarity || null,
              category: found.category || 'Pokemon',
              set: {
                id: found.setCode || 'MANUAL',
                name: found.setName || 'Coleção Manual',
                cardCount: found.totalCards
                  ? { official: found.totalCards, total: found.totalCards }
                  : undefined,
              },
            };
            cardDetailCache.set(cleanId, detail);
            return detail;
          }
        }
      } catch {}

      throw new Error(`Carta manual "${cleanId}" não encontrada no banco de dados local.`);
    }

    let ptData: any = null;
    let enData: any = null;
    let asianData: any = null;

    try {
      ptData = await fetchJson<any>(
        `${TCGDEX_API_BASE}/pt/cards/${encodeURIComponent(cleanId)}`,
        signal
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    if (!ptData || !ptData.image || !ptData.rarity) {
      try {
        enData = await fetchJson<any>(
          `${TCGDEX_API_BASE}/en/cards/${encodeURIComponent(cleanId)}`,
          signal
        );
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
      }
    }

    if (!ptData && !enData) {
      const asianLangs = ['ja', 'zh-tw', 'zh-cn', 'ko'];
      for (const lang of asianLangs) {
        try {
          const res = await fetchJson<any>(
            `${TCGDEX_API_BASE}/${lang}/cards/${encodeURIComponent(cleanId)}`,
            signal
          );
          if (res && res.id) {
            asianData = res;
            break;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
        }
      }
    }

    if (!ptData && !enData && !asianData) {
      throw new Error(`Carta "${cleanId}" não encontrada na TCGdex.`);
    }

    // Se a carta veio de endpoint asiático (Japão, China ou Coreia), traduz o nome do Pokémon
    // priorizando o dicionário oficial local de 1025 Pokémon e formas regionais.
    if (asianData) {
      if (hasAsianChars(asianData.name)) {
        const translated = translateAsianPokemonName(asianData.name);
        if (translated && !hasAsianChars(translated)) {
          asianData.name = translated;
        }
      }

      const dexId =
        Array.isArray(asianData.dexId) && asianData.dexId.length > 0
          ? Number(asianData.dexId[0])
          : null;

      // Se ainda contiver caracteres asiáticos e houver dexId, tenta fallback estrito
      if (dexId && hasAsianChars(asianData.name)) {
        const enSameDex = await getEnglishCardsByDexId(dexId, signal);
        // Filtra estritamente cartas cujo dexId confira (a API TCGdex v2 tem bug no filtro ?dexId=)
        const strictlyMatchingDex = enSameDex.filter(
          (c) => Array.isArray(c.dexId) && c.dexId.includes(dexId)
        );

        if (strictlyMatchingDex.length > 0) {
          let matchedEnCard: any = null;
          if (asianData.illustrator) {
            matchedEnCard = strictlyMatchingDex.find(
              (c) => c.illustrator && c.illustrator.toLowerCase() === asianData.illustrator.toLowerCase()
            );
          }

          const refEn = matchedEnCard || strictlyMatchingDex[0];
          if (refEn?.name && hasAsianChars(asianData.name)) {
            const baseWesternName = String(refEn.name).replace(/\s+(ex|GX|V|VMAX|VSTAR)$/i, '');
            const hasExSuffix = /ex$/i.test(String(asianData.name));
            asianData.name =
              hasExSuffix && !/ex$/i.test(baseWesternName)
                ? `${baseWesternName} ex`
                : matchedEnCard?.name || baseWesternName;
          }

          if (!asianData.image && matchedEnCard?.image) {
            asianData.image = matchedEnCard.image;
          }
        }
      }

      if (asianData.set && asianData.set.id && !asianData.set.name.includes(asianData.set.id)) {
        asianData.set.name = `${asianData.set.name} (${asianData.set.id})`;
      }
    }

    const detail = normalizeCardDetail(ptData || enData || asianData, enData);
    cardDetailCache.set(cleanId, detail);
    return detail;
  },

  /**
   * Pesquisa cartas na TCGdex sob demanda em todas as regiões (PT, EN, JA, ZH-TW, ZH-CN, KO)
   * com suporte a busca livre por nome e número (ex: "195/193", "Dustox (195/193)", "Charizard 006/165").
   */
  async searchCards(
    params: TcgdexSearchParams,
    signal?: AbortSignal
  ): Promise<TcgdexSearchResult> {
    const rawQuery = (params.query || '').trim();
    const setId = (params.setId || '').trim();
    const rarity = (params.rarity || '').trim();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 15);

    await this.getSets();

    const cacheKey = JSON.stringify({ query: rawQuery.toLowerCase(), setId, rarity });
    let allMatchingBriefs = searchListCache.get(cacheKey);

    if (!allMatchingBriefs) {
      const { nameQuery, localIdQuery, totalCardsQuery } = parseCardSearchQuery(rawQuery);
      const normLocalTarget = normalizeCardLocalId(localIdQuery);

      const buildQueryUrl = (
        lang: 'pt' | 'en' | 'ja' | 'zh-tw' | 'zh-cn' | 'ko',
        overrideParams?: { useLocalIdOnly?: boolean }
      ) => {
        const searchParams = new URLSearchParams();
        if (overrideParams?.useLocalIdOnly && normLocalTarget) {
          searchParams.set('localId', normLocalTarget);
        } else if (nameQuery && !['ja', 'zh-tw', 'zh-cn', 'ko'].includes(lang)) {
          // Limpa marcadores de gênero para buscar pelo nome base na TCGdex
          const apiNameQuery = nameQuery
            .replace(/\b(?:female|fêmea|femea|macho|male)\b/gi, '')
            .replace(/[♀♂]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          searchParams.set('name', apiNameQuery || nameQuery);
        } else if (normLocalTarget) {
          searchParams.set('localId', normLocalTarget);
        }
        if (setId) {
          searchParams.set('set.id', `eq:${setId}`);
        }
        if (rarity && lang === 'pt') {
          searchParams.set('rarity', `eq:${rarity}`);
        }
        const qs = searchParams.toString();
        return `${TCGDEX_API_BASE}/${lang}/cards${qs ? `?${qs}` : ''}`;
      };

      const mergedById = new Map<string, any>();

      // Se a busca envolve número (ex: "195/193", "Dustox (195/193)", "20/156"):
      // consultamos todas as bases mundiais em paralelo (PT, EN, JA, ZH-TW, ZH-CN, KO)
      if (normLocalTarget) {
        const [resPt, resEn, resJa, resZhTw, resZhCn, resKo] = await Promise.all([
          fetchJson<any[]>(buildQueryUrl('pt'), signal).catch(() => []),
          !rarity ? fetchJson<any[]>(buildQueryUrl('en'), signal).catch(() => []) : Promise.resolve([]),
          !rarity ? fetchJson<any[]>(buildQueryUrl('ja', { useLocalIdOnly: true }), signal).catch(() => []) : Promise.resolve([]),
          !rarity ? fetchJson<any[]>(buildQueryUrl('zh-tw', { useLocalIdOnly: true }), signal).catch(() => []) : Promise.resolve([]),
          !rarity ? fetchJson<any[]>(buildQueryUrl('zh-cn', { useLocalIdOnly: true }), signal).catch(() => []) : Promise.resolve([]),
          !rarity ? fetchJson<any[]>(buildQueryUrl('ko', { useLocalIdOnly: true }), signal).catch(() => []) : Promise.resolve([]),
        ]);

        for (const list of [resPt, resEn, resJa, resZhTw, resZhCn, resKo]) {
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !mergedById.has(item.id)) {
                mergedById.set(item.id, item);
              }
            }
          }
        }
      } else if (nameQuery) {
        // Busca por nome (ex: "Charizard", "Dustox"): consulta PT e EN em paralelo e também busca cartas JA, ZH e KO via dexId
        const [resPt, resEn] = await Promise.all([
          fetchJson<any[]>(buildQueryUrl('pt'), signal).catch(() => []),
          !rarity ? fetchJson<any[]>(buildQueryUrl('en'), signal).catch(() => []) : Promise.resolve([]),
        ]);

        for (const list of [resPt, resEn]) {
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !mergedById.has(item.id)) {
                mergedById.set(item.id, item);
              }
            }
          }
        }

        // Descobre o dexId do Pokémon pesquisado para incluir cartas asiáticas exclusivas (Japão, China e Coreia)
        if (!rarity && mergedById.size > 0) {
          const firstItem = Array.from(mergedById.values())[0];
          try {
            const firstDetail = await fetchJson<any>(
              `${TCGDEX_API_BASE}/en/cards/${encodeURIComponent(firstItem.id)}`,
              signal
            );
            const dexId =
              Array.isArray(firstDetail?.dexId) && firstDetail.dexId.length > 0
                ? Number(firstDetail.dexId[0])
                : null;

            if (dexId) {
              const setParam = setId ? `&set.id=eq:${encodeURIComponent(setId)}` : '';
              const [jaByDex, zhTwByDex, zhCnByDex, koByDex] = await Promise.all([
                fetchJson<any[]>(`${TCGDEX_API_BASE}/ja/cards?dexId=${dexId}${setParam}`, signal).catch(() => []),
                fetchJson<any[]>(`${TCGDEX_API_BASE}/zh-tw/cards?dexId=${dexId}${setParam}`, signal).catch(() => []),
                fetchJson<any[]>(`${TCGDEX_API_BASE}/zh-cn/cards?dexId=${dexId}${setParam}`, signal).catch(() => []),
                fetchJson<any[]>(`${TCGDEX_API_BASE}/ko/cards?dexId=${dexId}${setParam}`, signal).catch(() => []),
              ]);

              for (const asianList of [jaByDex, zhTwByDex, zhCnByDex, koByDex]) {
                if (Array.isArray(asianList)) {
                  for (const asianItem of asianList) {
                    if (asianItem && asianItem.id && !mergedById.has(asianItem.id)) {
                      mergedById.set(asianItem.id, {
                        ...asianItem,
                        name: hasAsianChars(asianItem.name)
                          ? translateAsianPokemonName(asianItem.name) || firstDetail.name || asianItem.name
                          : asianItem.name,
                      });
                    }
                  }
                }
              }
            }
          } catch (err: any) {
            if (err?.name === 'AbortError') throw err;
          }
        }
      } else {
        // Listagem padrão (sem texto de busca, ou apenas filtro de set/raridade)
        const [resPt, resEn, resJa, resZhTw, resZhCn] = await Promise.all([
          fetchJson<any[]>(buildQueryUrl('pt'), signal).catch(() => []),
          setId && !rarity ? fetchJson<any[]>(buildQueryUrl('en'), signal).catch(() => []) : Promise.resolve([]),
          setId && !rarity ? fetchJson<any[]>(buildQueryUrl('ja'), signal).catch(() => []) : Promise.resolve([]),
          setId && !rarity ? fetchJson<any[]>(buildQueryUrl('zh-tw'), signal).catch(() => []) : Promise.resolve([]),
          setId && !rarity ? fetchJson<any[]>(buildQueryUrl('zh-cn'), signal).catch(() => []) : Promise.resolve([]),
        ]);

        for (const list of [resPt, resEn, resJa, resZhTw, resZhCn]) {
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !mergedById.has(item.id)) {
                mergedById.set(item.id, item);
              }
            }
          }
        }
      }

      const rawList = Array.from(mergedById.values());
      const orderedRaw = !rawQuery && !setId && !rarity ? [...rawList].reverse() : rawList;

      let mappedBriefs: TcgdexCardBrief[] = orderedRaw.map((item) => {
        const inferredSetId = extractSetIdFromCardId(
          String(item.id || ''),
          String(item.localId || '')
        );
        const setInfo = setsCache.map.get(inferredSetId);
        const rawName = setInfo?.name || item.set?.name || inferredSetId;
        const translatedSetName = getTranslatedSetName(inferredSetId, rawName);
        const jpScan = getJapaneseCardScanUrl(inferredSetId, item.localId);
        const promoScan = getWesternPromoCardScanUrl(inferredSetId, item.localId);
        const tgScan = getTrainerGalleryCardScanUrl(inferredSetId, item.localId);
        const rawItemName = String(item.name ?? 'Não informado');
        const resolvedName = formatPokemonGenderName(
          hasAsianChars(rawItemName)
            ? translateAsianPokemonName(rawItemName)
            : rawItemName
        );

        return {
          id: String(item.id),
          localId: String(item.localId ?? '—'),
          name: resolvedName,
          image: item.image || jpScan || promoScan || tgScan || null,
          setId: setInfo?.id || inferredSetId || 'Não informado',
          setName: translatedSetName,
          totalCards: setInfo?.cardCount?.official || setInfo?.cardCount?.total || null,
          rarity: rarity || null,
        };
      });

      // Se o usuário informou número da carta (ex: "195/193", "20/156" ou "006"), filtra pelo número e total da coleção
      if (normLocalTarget) {
        const exactNumberMatches = mappedBriefs.filter((b) => {
          const itemNormLocal = normalizeCardLocalId(b.localId);
          if (itemNormLocal !== normLocalTarget) return false;

          if (totalCardsQuery !== null) {
            const setInfo = b.setId ? setsCache.map.get(b.setId) : undefined;
            const officialCount = setInfo?.cardCount?.official;
            const totalCount = setInfo?.cardCount?.total;

            // No Pokémon TCG, o denominador impresso na carta física é SEMPRE o officialCount!
            // Ex: Em SM5p, official é 50 e total com secretas é 63. A carta impressa é 027/050, nunca 027/063.
            // Por isso, priorizamos estritamente officialCount.
            if (officialCount !== undefined && officialCount !== null) {
              return officialCount === totalCardsQuery;
            }
            if (b.totalCards !== null && b.totalCards !== undefined) {
              return b.totalCards === totalCardsQuery;
            }
            return totalCount === totalCardsQuery;
          }

          return true;
        });

        if (exactNumberMatches.length > 0 || totalCardsQuery !== null) {
          mappedBriefs = exactNumberMatches;
        }

        // Quando o usuário digitou Nome + Número (ex: "Dustox (195/193)"), traduzimos os candidatos asiáticos
        // e filtramos pelo nome informado para retornar exatamente a carta desejada
        if (nameQuery && mappedBriefs.length > 0) {
          const enrichedCandidates = await Promise.all(
            mappedBriefs.map(async (b) => {
              if (!hasAsianChars(b.name)) return b;
              try {
                const detail = await this.getCardById(b.id, signal);
                return {
                  ...b,
                  name: detail.name || b.name,
                  image: b.image || detail.image || null,
                  setName: detail.set.name || b.setName,
                  rarity: detail.rarity || b.rarity || null,
                };
              } catch {
                return b;
              }
            })
          );

          const normalizeStr = (s: string) =>
            s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const normSearchTarget = normalizeStr(nameQuery);

          mappedBriefs = enrichedCandidates.filter((b) =>
            normalizeStr(b.name).includes(normSearchTarget)
          );
        }
      }

      allMatchingBriefs = mappedBriefs;
      searchListCache.set(cacheKey, allMatchingBriefs);
    }

    const total = allMatchingBriefs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pageSlice = allMatchingBriefs.slice(startIndex, startIndex + pageSize);

    const enrichedSlice = await Promise.all(
      pageSlice.map(async (brief) => {
        const cachedDetail = cardDetailCache.get(brief.id);
        if (cachedDetail) {
          return {
            ...brief,
            name: cachedDetail.name || brief.name,
            image: brief.image || cachedDetail.image || null,
            setId: cachedDetail.set.id || brief.setId,
            setName: cachedDetail.set.name || brief.setName,
            totalCards:
              cachedDetail.set.cardCount?.official ||
              cachedDetail.set.cardCount?.total ||
              brief.totalCards ||
              null,
            rarity: cachedDetail.rarity || brief.rarity || null,
          };
        }

        try {
          const detail = await this.getCardById(brief.id, signal);
          return {
            ...brief,
            name: detail.name || brief.name,
            image: brief.image || detail.image || null,
            setId: detail.set.id || brief.setId,
            setName: detail.set.name || brief.setName,
            totalCards:
              detail.set.cardCount?.official ||
              detail.set.cardCount?.total ||
              brief.totalCards ||
              null,
            rarity: detail.rarity || brief.rarity || null,
          };
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          return brief;
        }
      })
    );

    return {
      items: enrichedSlice,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  },
};
