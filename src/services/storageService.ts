import { Collection, Product, StockMovement } from '../types';
import { INITIAL_COLLECTIONS } from '../mocks/mockCollections';
import { INITIAL_PRODUCTS } from '../mocks/mockProducts';
import { INITIAL_STOCK_MOVEMENTS } from '../mocks/mockMovements';

const STORAGE_KEYS = {
  COLLECTIONS: 'trigon_collections_v2',
  PRODUCTS: 'trigon_products_v2',
  MOVEMENTS: 'trigon_stock_movements_v2',
};

// Helper para simular delay de rede assíncrono (como Supabase)
export const delay = (ms: number = 80): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class StorageService {
  private static init(): void {
    // Limpeza de versões anteriores com acessórios
    if (localStorage.getItem('trigon_collections_v1')) {
      localStorage.removeItem('trigon_collections_v1');
      localStorage.removeItem('trigon_products_v1');
      localStorage.removeItem('trigon_stock_movements_v1');
    }

    if (!localStorage.getItem(STORAGE_KEYS.COLLECTIONS)) {
      localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(INITIAL_COLLECTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(INITIAL_STOCK_MOVEMENTS));
    }
  }

  // --- COLLECTIONS ---
  static getStoredCollections(): Collection[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      const parsed: Collection[] = data ? JSON.parse(data) : INITIAL_COLLECTIONS;
      // Garante remoção de coleções de acessórios que possam ter ficado em cache
      return parsed.filter((c) => c.id !== 'col-acessorios' && c.slug !== 'acessorios');
    } catch {
      return INITIAL_COLLECTIONS;
    }
  }

  static setStoredCollections(collections: Collection[]): void {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  }

  // --- PRODUCTS ---
  static getStoredProducts(): Product[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const parsed: Product[] = data ? JSON.parse(data) : INITIAL_PRODUCTS;
      return parsed.filter((p) => p.collectionId !== 'col-acessorios');
    } catch {
      return INITIAL_PRODUCTS;
    }
  }

  static setStoredProducts(products: Product[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  // --- MOVEMENTS ---
  static getStoredMovements(): StockMovement[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      return data ? JSON.parse(data) : INITIAL_STOCK_MOVEMENTS;
    } catch {
      return INITIAL_STOCK_MOVEMENTS;
    }
  }

  static setStoredMovements(movements: StockMovement[]): void {
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  }

  // Reset para dados originais de demonstração
  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(INITIAL_COLLECTIONS));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(INITIAL_STOCK_MOVEMENTS));
  }
}
