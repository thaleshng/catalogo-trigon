/**
 * Transforma uma string em um slug amigável para URLs
 * Ex: "Pokémon 30 Anos" -> "pokemon-30-anos"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Normaliza acentos
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '') // Remove caracteres inválidos
    .replace(/\s+/g, '-') // Substitui espaços por hífen
    .replace(/-+/g, '-'); // Remove hífens múltiplos
}
