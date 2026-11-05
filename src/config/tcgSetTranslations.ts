/**
 * Dicionário de tradução e ocidentalização das coleções Japonesas e Chinesas
 * para os nomes oficiais utilizados no mercado internacional e na Liga Pokémon.
 */

export const JAPANESE_AND_CHINESE_SET_TRANSLATIONS: Record<string, string> = {
  // Mega Era / 2025+
  M2a: 'MEGA Dream ex',
  M1S: 'Mega Symphonia',
  M1L: 'Mega Brave',
  M2: 'Inferno X',
  M3: 'Munichis Zero',
  M4: 'Ninja Spinner',
  M5: 'Abyss Eye',
  M6: 'Storm Emeralda',
  MC: 'Start Deck 100 Battle Collection',
  'M-P': 'Mega Promo Cards',

  // Scarlet & Violet (SV)
  SV11W: 'White Flare',
  SV11B: 'Black Bolt',
  SV10: 'Glory of Team Rocket',
  SV9a: 'Heat Wave Arena',
  SV9: 'Battle Partners',
  SV8a: 'Terastal Festival ex',
  SV8: 'Supercharged Breaker',
  SV7a: 'Paradise Dragona',
  SV7: 'Stellar Miracle',
  SV6a: 'Night Wanderer',
  SV6: 'Mask of Change',
  SV5a: 'Crimson Haze',
  SV5M: 'Cyber Judge',
  SV5K: 'Wild Force',
  SV4a: 'Shiny Treasure ex',
  SV4M: 'Future Flash',
  SV4K: 'Ancient Roar',
  SV3a: 'Raging Surf',
  SV3: 'Ruler of the Black Flame',
  SV2a: 'Pokemon Card 151',
  SV2P: 'Snow Hazard',
  SV2D: 'Clay Burst',
  SV1a: 'Triplet Beat',
  SV1V: 'Violet ex',
  SV1S: 'Scarlet ex',
  'SV-P': 'Scarlet & Violet Promos',
  SVK: 'Deck Build Box Stellar Miracle',
  SVLN: 'Starter Set Terastal Sylveon ex',
  SVLS: 'Starter Set Terastal Ceruledge ex',

  // Sword & Shield (S)
  S12a: 'VSTAR Universe',
  S12: 'Paradigm Trigger',
  S11a: 'Incandescent Arcana',
  S11: 'Lost Abyss',
  S10b: 'Pokemon GO',
  S10a: 'Dark Phantasma',
  S10P: 'Space Juggler',
  S10D: 'Time Gazer',
  S9a: 'Battle Region',
  S9: 'Star Birth',
  S8b: 'VMAX Climax',
  S8a: '25th Anniversary Collection',
  S8: 'Fusion Arts',
  S7R: 'Blue Sky Stream',
  S7D: 'Skyscraping Perfection',
  S6a: 'Eevee Heroes',
  S6K: 'Jet-Black Spirit',
  S6H: 'Silver Lance',
  S5a: 'Peerless Fighters',
  S5R: 'Rapid Strike Master',
  S5I: 'Single Strike Master',
  S4a: 'Shiny Star V',
  S4: 'Astonishing Volt Tackle',
  S3a: 'Legendary Heartbeat',
  S3: 'Infinity Zone',
  S2a: 'Explosive Walker',
  S2: 'Rebellion Crash',
  S1a: 'VMAX Rising',
  S1H: 'Shield',
  S1W: 'Sword',
  'S-P': 'Sword & Shield Promos',

  // Sun & Moon (SM)
  SM12a: 'Tag All Stars',
  SM12: 'Alter Genesis',
  SM11b: 'Dream League',
  SM11a: 'Remix Bout',
  SM11: 'Miracle Twin',
  SM10b: 'Sky Legend',
  SM10a: 'GG End',
  SMP2: 'Detective Pikachu',
  SM10: 'Double Blaze',
  SM9b: 'Full Metal Wall',
  SM9a: 'Night Unison',
  SM9: 'Tag Bolt',
  SM8b: 'GX Ultra Shiny',
  SM8a: 'Dark Order',
  SM8: 'Super-Burst Impact',
  SM7b: 'Fairy Rise',
  SM7a: 'Thunderclap Spark',
  SM7: 'Sky-Splitting Charisma',
  SM6b: 'Champion Road',
  SM6a: 'Dragon Storm',
  SM6: 'Forbidden Light',
  SM5p: 'Ultra Force',
  'SM5+': 'Ultra Force',
  SM5M: 'Ultra Moon',
  SM5S: 'Ultra Sun',
  SM4p: 'GX Battle Boost',
  'SM4+': 'GX Battle Boost',
  SM4A: 'Ultradimensional Beasts',
  SM4S: 'Awakening Heroes',
  SM3p: 'Shining Legends',
  'SM3+': 'Shining Legends',
  SM3N: 'Darkness that Consumes Light',
  SM3H: 'Did You See the Fighting Rainbow?',
  sm2p: 'Beyond a New Challenge',
  'sm2+': 'Beyond a New Challenge',
  SM2K: 'Islands Await You',
  SM2L: 'Alolan Moonlight',
  SM1p: 'Sun & Moon Extra',
  'SM1+': 'Sun & Moon Extra',
  SM1M: 'Collection Moon',
  SM1S: 'Collection Sun',
  SM0: 'Pikachu and New Friends',

  // Chinese (Simplified and Traditional)
  SC2D: 'Infinite Power (SC2D)',
  SC2b: 'Infinite Power Set B',
  SC2a: 'Infinite Power Set A',
  CSM1aC: 'Crossing the Sky - Crimson',
  CSM1bC: 'Crossing the Sky - Azure',
  CSM1cC: 'Crossing the Sky - Marsh',
};

import pokemonTranslationsJson from './pokemonNameTranslations.json';
import trainerTranslationsJson from './trainerCardTranslations.json';

const pokemonNameDict: Record<string, string> = {
  ...(pokemonTranslationsJson as Record<string, string>),
  ...(trainerTranslationsJson as Record<string, string>),
};

const TRAINER_PREFIXES: Record<string, string> = {
  'ロケット団の': "Team Rocket's ",
  'シロナの': "Cynthia's ",
  'ナンジャモ de': "Iono's ",
  'ナンジャモの': "Iono's ",
  'ヒビキの': "Ethan's ",
  'リーリエの': "Lillie's ",
  'ホップの': "Hop's ",
  'Nの': "N's ",
  'ダイゴの': "Steven's ",
  'マリィの': "Marnie's ",
  'アイリスの': "Iris's ",
  'カスミの': "Misty's ",
  'タケシの': "Brock's ",
  'マチスの': "Lt. Surge's ",
  'エリカの': "Erika's ",
  'キョウの': "Koga's ",
  'ナツメの': "Sabrina's ",
  'カツラの': "Blaine's ",
  'サカキの': "Giovanni's ",
  'ワタルの': "Lance's ",
};

const REGIONAL_PREFIXES: Record<string, string> = {
  'ガラル ': 'Galarian ',
  'ガラル': 'Galarian ',
  'アローラ ': 'Alolan ',
  'アローラ': 'Alolan ',
  'ヒスイ ': 'Hisuian ',
  'ヒスイ': 'Hisuian ',
  'パルデア ': 'Paldean ',
  'パルデア': 'Paldean ',
  '伽勒尔 ': 'Galarian ',
  '伽勒尔': 'Galarian ',
  '阿罗拉 ': 'Alolan ',
  '阿罗拉': 'Alolan ',
  '洗翠 ': 'Hisuian ',
  '洗翠': 'Hisuian ',
  '帕底亚 ': 'Paldean ',
  '帕底亚': 'Paldean ',
};

/**
 * Traduz nomes de Pokémon em japonês ou chinês para o nome ocidental oficial (inglês/português).
 * Ex: ドクケイル -> Dustox
 *     コイル -> Magnemite
 *     ロケット団のミュウツーex -> Team Rocket's Mewtwo ex
 *     ナンジャモのハラバリーex -> Iono's Bellibolt ex
 *     スピンロトム -> Rotom Ventilador
 *     メガヤンマex -> Yanmega ex
 *     ガラル ジグザグマ -> Galarian Zigzagoon
 */
export function translateAsianPokemonName(rawName?: string | null): string {
  if (!rawName) return 'Não informado';
  const trimmed = rawName.trim();
  if (!/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  // 1. Busca direta no dicionário de Pokémon, Treinadores, Itens e Formas Especiais
  if (pokemonNameDict[trimmed]) {
    return pokemonNameDict[trimmed];
  }

  // 1.1. Correspondência sem espaços extras (ex: "オーガポン かまどのめんex" -> "オーガポンかまどのめんex")
  const compact = trimmed.replace(/\s+/g, '');
  if (pokemonNameDict[compact]) {
    return pokemonNameDict[compact];
  }

  // 2. Verifica prefixo de treinador (ex: ロケット団の..., ナンジャモの...)
  let prefix = '';
  let rest = trimmed;
  for (const [jpPrefix, westernPrefix] of Object.entries(TRAINER_PREFIXES)) {
    if (rest.startsWith(jpPrefix)) {
      prefix = westernPrefix;
      rest = rest.slice(jpPrefix.length);
      break;
    }
  }

  // 2.1. Verifica prefixo regional (ex: ガラル ジグザグマ -> Galarian Zigzagoon)
  for (const [regPrefix, westernReg] of Object.entries(REGIONAL_PREFIXES)) {
    if (rest.startsWith(regPrefix)) {
      prefix = `${prefix}${westernReg}`;
      rest = rest.slice(regPrefix.length).trim();
      break;
    }
  }

  // 3. Verifica sufixo de regra especial (ex: ex, EX, GX, V, VMAX, VSTAR, BREAK)
  let suffix = '';
  const suffixMatch = rest.match(/\s*(ex|EX|Gx|GX|V|VMAX|VSTAR|BREAK)$/i);
  if (suffixMatch) {
    suffix = ` ${suffixMatch[1]}`;
    rest = rest.slice(0, rest.length - suffixMatch[0].length).trim();
  }

  // 4. Verifica forma Mega (ex: メガサーナイト -> Mega Gardevoir, メガズルズキン -> Mega Scrafty)
  // Preserva Pokémon que começam nativamente com "メガ" (ex: メガヤンマ -> Yanmega)
  let isMega = false;
  if (rest.startsWith('メガ') && !pokemonNameDict[rest] && !pokemonNameDict[rest.replace(/\s+/g, '')]) {
    isMega = true;
    rest = rest.slice(2);
  }

  const translatedBase =
    pokemonNameDict[rest] ||
    pokemonNameDict[rest.replace(/\s+/g, '')];

  if (translatedBase) {
    return formatPokemonGenderName(`${prefix}${isMega ? 'Mega ' : ''}${translatedBase}${suffix}`);
  }

  return formatPokemonGenderName(trimmed);
}

/**
 * Padroniza a nomenclatura de gênero dos Pokémon (ex: Nidoran♀ -> Nidoran Fêmea, Nidoran♂ -> Nidoran Macho,
 * Meowstic♀ -> Meowstic Fêmea, Oinkologne♂ -> Oinkologne Macho, Indeedee♀ -> Indeedee Fêmea, Basculegion♀ -> Basculegion Fêmea).
 * Garante distinção clara e legível em mensagens de leilão, catálogo e buscas sem símbolos ilegíveis.
 */
export function formatPokemonGenderName(rawName?: string | null): string {
  if (!rawName) return '';
  let str = rawName.trim();

  // Preserva sufixo especial de carta (ex: " ex", " EX", " V", " VMAX", " VSTAR", " GX", " BREAK")
  const specialSuffixMatch = str.match(/\s+(ex|EX|Gx|GX|V|VMAX|VSTAR|BREAK|Lv\.X|Prime|LEGEND)$/i);
  let specialSuffix = '';
  if (specialSuffixMatch) {
    specialSuffix = specialSuffixMatch[0];
    str = str.slice(0, str.length - specialSuffix.length).trim();
  }

  // 1. Tratamento Fêmea (♀, (♀), (Female), -F, etc.)
  if (/[♀]|[\(\[\{]\s*(?:female|fêmea|femea|♀|f)\s*[\)\]\}]|\b(?:female|fêmea|femea)\b|-F$/i.test(str)) {
    str = str
      .replace(/[\(\[\{]\s*(?:female|fêmea|femea|♀|f)\s*[\)\]\}]/gi, '')
      .replace(/[♀]/g, '')
      .replace(/\b(?:female|fêmea|femea)\b/gi, '')
      .replace(/-F$/i, '')
      .trim();
    return `${str} Fêmea${specialSuffix}`.replace(/\s+/g, ' ').trim();
  }

  // 2. Tratamento Macho (♂, (♂), (Male), -M, etc.)
  if (/[♂]|[\(\[\{]\s*(?:male|macho|♂|m)\s*[\)\]\}]|\b(?:male|macho)\b|-M$/i.test(str)) {
    str = str
      .replace(/[\(\[\{]\s*(?:male|macho|♂|m)\s*[\)\]\}]/gi, '')
      .replace(/[♂]/g, '')
      .replace(/\b(?:male|macho)\b/gi, '')
      .replace(/-M$/i, '')
      .trim();
    return `${str} Macho${specialSuffix}`.replace(/\s+/g, ' ').trim();
  }

  return `${str}${specialSuffix}`.replace(/\s+/g, ' ').trim();
}

/**
 * Gera a URL do scan oficial em japonês da carta através da CDN pública de alta resolução do Limitless TCG.
 * Ex: M1S-027 => https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/M1S/M1S_27_R_JP_LG.png
 *     M2a-195 => https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/M2a/M2a_195_R_JP_LG.png
 */
export function getJapaneseCardScanUrl(
  setId?: string | null,
  localId?: string | null
): string | null {
  if (!setId || !localId) return null;
  const rawSet = setId.trim();
  const rawLocal = localId.trim();

  // Localiza a capitalização canônica da coleção (ex: M1S, M2a, SV9a)
  const canonicalKey = Object.keys(JAPANESE_AND_CHINESE_SET_TRANSLATIONS).find(
    (k) => k.toLowerCase() === rawSet.toLowerCase()
  );
  const canonicalSet = canonicalKey || rawSet;

  // Só gera se for conjunto oriental catalogado ou que siga nomenclatura asiática padrão
  const isOriental =
    canonicalKey !== undefined ||
    /^(M\d|SV\d|S\d|SM\d|XY\d|BW\d|CP\d)/i.test(canonicalSet);

  if (!isOriental) return null;

  const numPart = rawLocal.replace(/\D/g, '');
  if (!numPart) return null;
  const cleanNum = String(parseInt(numPart, 10));

  return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/${canonicalSet}/${canonicalSet}_${cleanNum}_R_JP_LG.png`;
}

/**
 * Gera URL de alta resolução para cartas promocionais ocidentais (MEP, SVP, etc.)
 * a partir do CDN da Limitless TCG quando a TCGdex ainda não possui a imagem hospedada.
 * Exemplo:
 *     MEP-034 => https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP/MEP_034_R_PT_LG.png
 *     SVP-001 => https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_001_R_PT_LG.png
 */
export function getWesternPromoCardScanUrl(
  setId?: string | null,
  localId?: string | null
): string | null {
  if (!setId || !localId) return null;
  const rawSet = setId.trim().toUpperCase();
  let promoSet = '';
  if (rawSet === 'MEP' || rawSet === 'MEP-PROMOS') promoSet = 'MEP';
  else if (rawSet === 'SVP' || rawSet === 'PR-SV' || rawSet === 'SV-P') promoSet = 'SVP';

  if (!promoSet) return null;

  const numPart = localId.replace(/\D/g, '');
  if (!numPart) return null;
  const padNum = numPart.padStart(3, '0');

  return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${promoSet}/${promoSet}_${padNum}_R_PT_LG.png`;
}

/**
 * Recupera o scan ou URL canônica de cartas da Galeria de Treinadores / Galeria de Galar (TG / GG)
 * quando a TCGdex omite a propriedade image por divergência de sufixo no CDN.
 * Exemplo:
 *     swsh10tg-TG08 => https://assets.tcgdex.net/pt/swsh/swsh10/TG08
 *     swsh12.5gg-GG01 => https://assets.tcgdex.net/pt/swsh/swsh12.5/GG01
 */
export function getTrainerGalleryCardScanUrl(
  setId?: string | null,
  localId?: string | null
): string | null {
  if (!setId || !localId) return null;
  const rawSet = setId.trim().toLowerCase();
  const rawLocal = localId.trim();

  // Verifica se é subset TG/GG (ex: swsh10tg, swsh12.5gg, swsh9tg)
  const tgGgMatch = rawSet.match(/^(swsh\d+(?:\.\d+)?)(?:tg|gg)$/i);
  if (tgGgMatch) {
    const baseSet = tgGgMatch[1];
    return `https://assets.tcgdex.net/pt/swsh/${baseSet}/${rawLocal}`;
  }

  if (/^TG\d+$/i.test(rawLocal) && /tg$/i.test(rawSet)) {
    return `https://images.pokemontcg.io/${rawSet}/${rawLocal.toUpperCase()}_hires.png`;
  }

  return null;
}

/**
 * Remove qualquer código ou ID de coleção em parênteses no final do nome.
 * Ex: "Origem Perdida (swsh11)" -> "Origem Perdida"
 *     "Mega Symphonia (M1S)" -> "Mega Symphonia"
 *     "Megaevolução (me01)" -> "Megaevolução"
 */
export function cleanSetName(name?: string | null): string {
  if (!name) return '';
  return name.replace(/\s*\([a-zA-Z0-9.\-_]+\)$/, '').trim();
}

/**
 * Traduz o nome da coleção para a nomenclatura ocidental / Liga Pokémon sem códigos extras.
 * Ex: "Mega Symphonia", "Origem Perdida", "Megaevolução"
 */
export function getTranslatedSetName(
  setId?: string | null,
  rawName?: string | null
): string {
  if (!setId && !rawName) return 'Não informado';
  const cleanSetId = (setId || '').trim();
  const cleanRaw = (rawName || '').trim();

  const translated = JAPANESE_AND_CHINESE_SET_TRANSLATIONS[cleanSetId];
  if (translated) {
    return cleanSetName(translated);
  }

  if (cleanRaw) {
    return cleanSetName(cleanRaw);
  }

  return cleanSetId || 'Não informado';
}

/**
 * Formata o número da carta de acordo com o padrão do TCG e da Liga Pokémon.
 * Se o localId tiver zeros à esquerda (ex: "027", "006"), o total também é
 * preenchido com zeros à esquerda para ter a mesma quantidade de dígitos (ex: "027/063", "006/165").
 */
export function formatCardNumber(
  localId?: string | null,
  totalCards?: number | null
): string {
  if (!localId || localId === '—') return '—';
  const cleanLocal = localId.trim();
  if (!totalCards || totalCards <= 0) return cleanLocal;

  const totalStr = String(totalCards);

  // Se o localId tem prefixo alfanumérico de subset (ex: "TG08", "GG08", "SV01")
  const prefixMatch = cleanLocal.match(/^([a-zA-Z]+)(\d+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const numPart = prefixMatch[2];
    const paddedTotal = totalStr.padStart(numPart.length, '0');
    return `${prefix}${numPart}/${prefix}${paddedTotal}`;
  }

  // Se o localId é numérico com leading zero (ex: "027", "006")
  if (/^\d+$/.test(cleanLocal) && cleanLocal.length > totalStr.length) {
    const paddedTotal = totalStr.padStart(cleanLocal.length, '0');
    return `${cleanLocal}/${paddedTotal}`;
  }

  return `${cleanLocal}/${totalStr}`;
}

/**
 * Compara dois números de carta (localId) para ordenação crescente natural.
 * Garante que a pré-evolução (ex: Dottler 019/196) venha sempre antes da evolução (ex: Orbeetle 020/196).
 * Trata casos como "019", "020", "19", "20", "019/196", "TG01", "TG02".
 */
export function compareCardNumbers(
  aLocalId?: string | null,
  bLocalId?: string | null
): number {
  if (!aLocalId && !bLocalId) return 0;
  if (!aLocalId) return 1;
  if (!bLocalId) return -1;

  const aClean = aLocalId.split('/')[0].trim();
  const bClean = bLocalId.split('/')[0].trim();

  const aNumMatch = aClean.match(/\d+/);
  const bNumMatch = bClean.match(/\d+/);

  if (aNumMatch && bNumMatch) {
    const aVal = parseInt(aNumMatch[0], 10);
    const bVal = parseInt(bNumMatch[0], 10);
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }

  return aClean.localeCompare(bClean, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Detecta automaticamente o idioma da carta a partir da coleção, metadados e IDs da API.
 * - Coleções da China (CS, SC, CSM, AC, AS) -> ZH-CN ou ZH-TW
 * - Coleções do Japão (M2a, M1S, SV9a, S12a, M..., etc. ou imagem CDN japonesa) -> JP
 * - Coleções Ocidentais (sv03.5, base1, swsh12, etc.) -> PT (padrão nacional)
 */
export function inferCardDefaultLanguage(card?: {
  id?: string | null;
  set?: { id?: string | null } | null;
  setId?: string | null;
  image?: string | null;
  name?: string | null;
} | null): string {
  if (!card) return 'PT';

  const rawSetId = (card.set?.id || card.setId || '').trim();
  const rawId = (card.id || '').trim();
  const rawImage = (card.image || '').trim();
  const rawName = (card.name || '').trim();

  // 1. Chinês Simplificado / Continental
  if (/^(CS|SC|CSM)/i.test(rawSetId) || rawImage.includes('/zh-cn/')) {
    return 'ZH-CN';
  }

  // 2. Chinês Tradicional (Taiwan / Hong Kong)
  if (/^(AC|AS)/i.test(rawSetId) || rawImage.includes('/zh-tw/')) {
    return 'ZH-TW';
  }

  // 3. Coreano
  if (rawImage.includes('/ko/') || /^[A-Z0-9]+_ko/i.test(rawId)) {
    return 'KO';
  }

  // 4. Japonês:
  if (rawImage.includes('digitaloceanspaces.com/tpc/') || rawImage.includes('/ja/')) {
    return 'JP';
  }

  const isCatalogedAsianSet = Object.keys(JAPANESE_AND_CHINESE_SET_TRANSLATIONS).some(
    (k) => k.toLowerCase() === rawSetId.toLowerCase()
  );
  if (isCatalogedAsianSet) {
    return 'JP';
  }

  if (/^(M\d|SV\d+[a-z]|S\d+[a-z]|SM\d+[a-z]|XY\d+[a-z]|BW\d+[a-z])/i.test(rawSetId)) {
    return 'JP';
  }

  if (/[\u3040-\u30ff]/.test(rawName)) {
    return 'JP';
  }

  return 'PT';
}


