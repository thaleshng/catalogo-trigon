import { Product } from '../types';
import { supabase } from '../lib/supabase';
import { slugify } from '../utils/slugify';

export interface ProductFilters {
  collectionId?: string;
  search?: string;
  onlyActive?: boolean;
  inStockOnly?: boolean;
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    price: Number(row.price) || 0,
    stockQuantity: Number(row.stock_quantity) || 0,
    images: Array.isArray(row.images) ? row.images : [],
    isActive: row.is_active,
    featured: row.featured ?? false,
    rarity: row.rarity || '',
    language: row.language || 'Português',
    condition: row.condition || 'Mint / Fresh Pack',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const productService = {
  /**
   * Busca lista de produtos no Supabase com filtros
   */
  async getProducts(filters: ProductFilters = {}): Promise<Product[]> {
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.onlyActive) {
      query = query.eq('is_active', true);
    }

    if (filters.collectionId) {
      query = query.eq('collection_id', filters.collectionId);
    }

    if (filters.inStockOnly) {
      query = query.gt('stock_quantity', 0);
    }

    if (filters.search && filters.search.trim() !== '') {
      const term = filters.search.trim();
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,rarity.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar produtos no Supabase:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapProduct);
  },

  /**
   * Busca um produto pelo slug (catálogo público)
   */
  async getProductBySlug(slug: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar produto por slug ${slug}:`, error);
      throw new Error(error.message);
    }

    return data ? mapProduct(data) : null;
  },

  /**
   * Busca um produto por ID
   */
  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar produto por ID ${id}:`, error);
      throw new Error(error.message);
    }

    return data ? mapProduct(data) : null;
  },

  /**
   * Cria um novo produto no Supabase
   */
  async createProduct(
    data: Omit<Product, 'id' | 'slug' | 'createdAt' | 'updatedAt'> & { slug?: string }
  ): Promise<Product> {
    const finalSlug = data.slug?.trim() || slugify(data.name);

    const { data: created, error } = await supabase
      .from('products')
      .insert({
        collection_id: data.collectionId,
        name: data.name.trim(),
        slug: finalSlug,
        description: data.description || '',
        price: Math.max(0, Number(data.price) || 0),
        stock_quantity: Math.max(0, Number(data.stockQuantity) || 0),
        images: Array.isArray(data.images) && data.images.length > 0 ? data.images : [],
        is_active: data.isActive ?? true,
        featured: data.featured ?? false,
        rarity: data.rarity || '',
        language: data.language || 'Português',
        condition: data.condition || 'Mint / Fresh Pack',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar produto no Supabase:', error);
      throw new Error(error.message);
    }

    return mapProduct(created);
  },

  /**
   * Atualiza um produto no Supabase
   */
  async updateProduct(
    id: string,
    data: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): Promise<Product> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.collectionId !== undefined) payload.collection_id = data.collectionId;
    if (data.description !== undefined) payload.description = data.description;
    if (data.price !== undefined) payload.price = Math.max(0, Number(data.price));
    if (data.stockQuantity !== undefined) payload.stock_quantity = Math.max(0, Number(data.stockQuantity));
    if (data.images !== undefined) payload.images = data.images;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.featured !== undefined) payload.featured = data.featured;
    if (data.rarity !== undefined) payload.rarity = data.rarity;
    if (data.language !== undefined) payload.language = data.language;
    if (data.condition !== undefined) payload.condition = data.condition;

    const { data: updated, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar produto no Supabase:', error);
      throw new Error(error.message);
    }

    return mapProduct(updated);
  },

  /**
   * Remove um produto do Supabase
   */
  async deleteProduct(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir produto no Supabase:', error);
      throw new Error(error.message);
    }

    return true;
  },
};
