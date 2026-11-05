import {
  CardConditionOption,
  CardLanguageOption,
  CardFinishOption,
} from '../types';
import {
  formatCardNumber,
  translateAsianPokemonName,
} from './tcgSetTranslations';

/**
 * Lista centralizada e configurável de Condições de Carta (Seção 10).
 * Utiliza códigos estáveis (`value`) separados dos rótulos de exibição (`label`).
 * Para atualizar os valores definitivos homologados pelo responsável do projeto,
 * basta alterar este array sem comprometer os registros já salvos no banco.
 */
export const DEFAULT_CARD_CONDITION_OPTIONS: CardConditionOption[] = [
  {
    value: 'M',
    label: 'Mint (M)',
    shortLabel: 'M',
    description: 'Carta em estado impecável, sem marcas de manuseio',
    badgeVariant: 'success',
  },
  {
    value: 'NM',
    label: 'Near Mint (NM)',
    shortLabel: 'NM',
    description: 'Estado próximo ao novo, mínimas marcas imperceptíveis',
    badgeVariant: 'success',
  },
  {
    value: 'SP',
    label: 'Slightly Played (SP)',
    shortLabel: 'SP',
    description: 'Leves sinais de uso ou pequenas marcas nas bordas',
    badgeVariant: 'info',
  },
  {
    value: 'MP',
    label: 'Moderately Played (MP)',
    shortLabel: 'MP',
    description: 'Marcas visíveis de uso moderado nas bordas ou superfície',
    badgeVariant: 'warning',
  },
  {
    value: 'HP',
    label: 'Heavily Played (HP)',
    shortLabel: 'HP',
    description: 'Desgaste acentuado de jogo ou manuseio',
    badgeVariant: 'danger',
  },
  {
    value: 'DMG',
    label: 'Damaged (D)',
    shortLabel: 'DMG',
    description: 'Carta com avarias estruturais, dobras ou marcas severas',
    badgeVariant: 'danger',
  },
];

/**
 * Lista centralizada e configurável de Idiomas (Seção 11).
 */
export const DEFAULT_CARD_LANGUAGE_OPTIONS: CardLanguageOption[] = [
  {
    value: 'PT',
    label: 'Português (PT-BR)',
    shortLabel: 'PT',
    description: 'Edição nacional em Português',
    badgeVariant: 'success',
  },
  {
    value: 'EN',
    label: 'Inglês (EN)',
    shortLabel: 'EN',
    description: 'Edição internacional em Inglês',
    badgeVariant: 'info',
  },
  {
    value: 'JP',
    label: 'Japonês (JP)',
    shortLabel: 'JP',
    description: 'Edição original japonesa',
    badgeVariant: 'crimson',
  },
  {
    value: 'ES',
    label: 'Espanhol (ES)',
    shortLabel: 'ES',
    description: 'Edição em Espanhol',
    badgeVariant: 'warning',
  },
  {
    value: 'FR',
    label: 'Francês (FR)',
    shortLabel: 'FR',
    description: 'Edição em Francês',
    badgeVariant: 'neutral',
  },
  {
    value: 'DE',
    label: 'Alemão (DE)',
    shortLabel: 'DE',
    description: 'Edição em Alemão',
    badgeVariant: 'neutral',
  },
  {
    value: 'IT',
    label: 'Italiano (IT)',
    shortLabel: 'IT',
    description: 'Edição em Italiano',
    badgeVariant: 'neutral',
  },
  {
    value: 'KO',
    label: 'Coreano (KO)',
    shortLabel: 'KO',
    description: 'Edição em Coreano',
    badgeVariant: 'neutral',
  },
  {
    value: 'ZH',
    label: 'Chinês (ZH)',
    shortLabel: 'ZH',
    description: 'Edição em Chinês',
    badgeVariant: 'warning',
  },
  {
    value: 'ZH-TW',
    label: 'Chinês Tradicional (ZH-TW)',
    shortLabel: 'ZH-TW',
    description: 'Edição em Chinês Tradicional (Taiwan / Hong Kong)',
    badgeVariant: 'warning',
  },
  {
    value: 'ZH-CN',
    label: 'Chinês Simplificado (ZH-CN)',
    shortLabel: 'ZH-CN',
    description: 'Edição em Chinês Simplificado (China Continental)',
    badgeVariant: 'warning',
  },
];

/**
 * Lista centralizada e configurável de Acabamentos / Variantes Físicas (Seção 11).
 */
export const DEFAULT_CARD_FINISH_OPTIONS: CardFinishOption[] = [
  {
    value: 'NORMAL',
    label: 'Normal',
    shortLabel: 'Normal',
    description: 'Acabamento padrão não-metalizado',
    badgeVariant: 'neutral',
  },
  {
    value: 'FOIL',
    label: 'Foil / Holo',
    shortLabel: 'Foil',
    description: 'Acabamento holográfico (Holo / Foil)',
    badgeVariant: 'warning',
  },
  {
    value: 'REVERSE_FOIL',
    label: 'Reverse Foil',
    shortLabel: 'Reverse Foil',
    description: 'Holográfico reverso no corpo da carta',
    badgeVariant: 'info',
  },
  {
    value: 'POKEBALL_FOIL',
    label: 'Poké Ball Foil',
    shortLabel: 'Poké Ball Foil',
    description: 'Reverse Foil especial com padrão Poké Ball',
    badgeVariant: 'crimson',
  },
  {
    value: 'MASTERBALL_FOIL',
    label: 'Master Ball Foil',
    shortLabel: 'Master Ball Foil',
    description: 'Reverse Foil especial com padrão Master Ball',
    badgeVariant: 'crimson',
  },
  {
    value: 'FULL_ART_ETCHED',
    label: 'Full Art / Texturizada (Etched)',
    shortLabel: 'Texturizada',
    description: 'Acabamento especial texturizado (SAR / Ultra Rara / Full Art)',
    badgeVariant: 'success',
  },
  {
    value: 'PROMO_STAMPED',
    label: 'Promo / Carimbada (Stamped)',
    shortLabel: 'Promo',
    description: 'Versão promocional ou com carimbo de edição/evento',
    badgeVariant: 'warning',
  },
];

const CUSTOM_CONDITIONS_STORAGE_KEY = 'trigon_tcg_condition_options_v1';

/**
 * Retorna as opções de condição ativas (permite customização centralizada sem quebrar valores antigos).
 */
export function getCardConditionOptions(): CardConditionOption[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CONDITIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignora erro de leitura local
  }
  return DEFAULT_CARD_CONDITION_OPTIONS;
}

export function getCardLanguageOptions(): CardLanguageOption[] {
  return DEFAULT_CARD_LANGUAGE_OPTIONS;
}

export function getCardFinishOptions(): CardFinishOption[] {
  return DEFAULT_CARD_FINISH_OPTIONS;
}

/**
 * Resolve uma condição armazenada para seu rótulo de exibição.
 * Caso as opções sejam alteradas futuramente, preserva o código salvo sem quebrar a UI.
 */
export function resolveCardCondition(value?: string | null): CardConditionOption {
  if (!value) {
    return {
      value: '',
      label: 'Não informado',
      shortLabel: '—',
      badgeVariant: 'neutral',
    };
  }
  const options = getCardConditionOptions();
  const found =
    options.find((opt) => opt.value === value) ||
    DEFAULT_CARD_CONDITION_OPTIONS.find((opt) => opt.value === value);

  if (found) return found;

  return {
    value,
    label: value,
    shortLabel: value,
    badgeVariant: 'neutral',
  };
}

/**
 * Resolve um idioma armazenado para seu rótulo de exibição.
 */
export function resolveCardLanguage(value?: string | null): CardLanguageOption {
  if (!value) {
    return {
      value: '',
      label: 'Não informado',
      shortLabel: '—',
      badgeVariant: 'neutral',
    };
  }
  const found = DEFAULT_CARD_LANGUAGE_OPTIONS.find((opt) => opt.value === value);
  if (found) return found;

  return {
    value,
    label: value,
    shortLabel: value,
    badgeVariant: 'neutral',
  };
}

/**
 * Resolve um acabamento armazenado para seu rótulo de exibição.
 */
export function resolveCardFinish(value?: string | null): CardFinishOption {
  if (!value) {
    return {
      value: '',
      label: 'Não informado',
      shortLabel: '—',
      badgeVariant: 'neutral',
    };
  }
  const found = DEFAULT_CARD_FINISH_OPTIONS.find((opt) => opt.value === value);
  if (found) return found;

  return {
    value,
    label: value,
    shortLabel: value,
    badgeVariant: 'neutral',
  };
}

/**
 * Constrói a URL de consulta manual externa na Liga Pokémon (Seção 8).
 * Prioriza URL exata previamente validada/configurada pelo administrador.
 * Caso não haja URL exata, gera um link de pesquisa manual pelo nome e número da carta,
 * sem presumir equivalência entre os códigos de coleção da TCGdex e da Liga Pokémon.
 */
export function buildLigaPokemonUrl(params: {
  name: string;
  localId?: string | null;
  totalCards?: number | null;
  setId?: string | null;
  setName?: string | null;
  customUrl?: string | null;
}): string {
  if (params.customUrl && params.customUrl.trim().startsWith('http')) {
    return params.customUrl.trim();
  }

  // Garante que o nome esteja no padrão ocidental / Liga Pokémon (ex: ドクケイル -> Dustox)
  const westernName = translateAsianPokemonName(params.name || '').trim();

  const rawSet = (params.setId || '').trim().toUpperCase();
  const rawSetName = (params.setName || '').trim().toLowerCase();
  const isPromoSet =
    rawSet === 'MEP' ||
    rawSet === 'MEP-PROMOS' ||
    rawSet === 'SVP' ||
    rawSet === 'SWSHP' ||
    rawSet === 'SMP' ||
    rawSet.startsWith('PR-') ||
    rawSet.endsWith('-P') ||
    rawSetName.includes('promo');

  // Na Liga Pokémon, coleções promocionais utilizam a estrutura de numerador com infinito (ex: 034/∞)
  const formattedNumber =
    isPromoSet && params.localId
      ? `${params.localId.trim()}/∞`
      : formatCardNumber(params.localId, params.totalCards);

  const cleanNumber =
    formattedNumber && formattedNumber !== '—' && formattedNumber !== 'Não informado'
      ? formattedNumber
      : '';

  const queryText = cleanNumber
    ? (westernName ? `${westernName} (${cleanNumber})` : cleanNumber)
    : westernName;

  return `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(queryText)}`;
}

