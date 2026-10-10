import { Collection } from '../types';
import { supabase } from '../lib/supabase';
import { slugify } from '../utils/slugify';

function mapCollection(row: any): Collection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    coverImage: row.cover_image || '',
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const collectionService = {
  /**
   * Retorna todas as coleções do Supabase
   */
  async getCollections(onlyActive: boolean = false): Promise<Collection[]> {
    let query = supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar coleções do Supabase:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapCollection);
  },

  /**
   * Busca uma coleção pelo slug
   */
  async getCollectionBySlug(slug: string): Promise<Collection | null> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar coleção por slug ${slug}:`, error);
      throw new Error(error.message);
    }

    return data ? mapCollection(data) : null;
  },

  /**
   * Busca uma coleção por ID
   */
  async getCollectionById(id: string): Promise<Collection | null> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar coleção por ID ${id}:`, error);
      throw new Error(error.message);
    }

    return data ? mapCollection(data) : null;
  },

  /**
   * Cria uma nova coleção no Supabase
   */
  async createCollection(
    data: Omit<Collection, 'id' | 'slug' | 'createdAt' | 'updatedAt'> & { slug?: string }
  ): Promise<Collection> {
    const finalSlug = data.slug?.trim() || slugify(data.name);

    const { data: created, error } = await supabase
      .from('collections')
      .insert({
        name: data.name.trim(),
        slug: finalSlug,
        description: data.description || '',
        cover_image: data.coverImage || '',
        is_active: data.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar coleção no Supabase:', error);
      throw new Error(error.message);
    }

    return mapCollection(created);
  },

  /**
   * Atualiza uma coleção existente
   */
  async updateCollection(
    id: string,
    data: Partial<Omit<Collection, 'id' | 'createdAt'>>
  ): Promise<Collection> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.description !== undefined) payload.description = data.description;
    if (data.coverImage !== undefined) payload.cover_image = data.coverImage;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: updated, error } = await supabase
      .from('collections')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar coleção no Supabase:', error);
      throw new Error(error.message);
    }

    return mapCollection(updated);
  },

  /**
   * Exclui uma coleção com verificação de produtos vinculados
   */
  async deleteCollection(
    id: string,
    forceDeleteWithProducts: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    // Verifica produtos vinculados
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', id);

    if (countError) {
      throw new Error(countError.message);
    }

    if (count && count > 0 && !forceDeleteWithProducts) {
      return {
        success: false,
        error: `Não é possível excluir: existem ${count} produto(s) vinculados a esta coleção. Remova ou transfira os produtos primeiro.`,
      };
    }

    if (forceDeleteWithProducts && count && count > 0) {
      await supabase.from('products').delete().eq('collection_id', id);
    }

    const { error: delError } = await supabase
      .from('collections')
      .delete()
      .eq('id', id);

    if (delError) {
      return { success: false, error: delError.message };
    }

    return { success: true };
  },

  /**
   * Retorna a contagem de produtos ativos por coleção
   */
  async getCollectionProductCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('products')
      .select('collection_id')
      .eq('is_active', true);

    if (error) {
      console.error('Erro ao calcular contagem de produtos:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const colId = row.collection_id;
      counts[colId] = (counts[colId] || 0) + 1;
    });

    return counts;
  },
};
