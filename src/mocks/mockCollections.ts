import { Collection } from '../types';

export const INITIAL_COLLECTIONS: Collection[] = [
  {
    id: 'col-pkmn-30',
    name: 'Pokémon 30 Anos',
    slug: 'pokemon-30-anos',
    description: 'Celebração histórica das três décadas de Pokémon TCG. Edições comemorativas, artes alternativas lendárias e itens de colecionador ultrarraros.',
    coverImage: 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1200&auto=format&fit=crop',
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'col-pkmn-151',
    name: 'Pokémon 151',
    slug: 'pokemon-151',
    description: 'A mais aclamada coleção nostálgica de Kanto. Todos os 151 primeiros Pokémon reimaginados com foilings especiais, SARs e ilustrações deslumbrantes.',
    coverImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1200&auto=format&fit=crop',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'col-pkmn-outras',
    name: 'Pokémon TCG — Outras Coleções',
    slug: 'pokemon-tcg-outras-colecoes',
    description: 'Explore caixas seladas, Elite Trainer Boxes e singles das principais expansões oficiais: Destinos de Paldea, Fagulhas Impetuosas, Coroa Estelar e mais.',
    coverImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
    isActive: true,
    createdAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-01-05T10:00:00Z',
  },
];
