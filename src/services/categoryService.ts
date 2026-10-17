import { Category } from '../types';
import { supabase } from '../lib/supabase';
import { slugify } from '../utils/slugify';

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    coverImage: row.cover_image || '',
    isActive: row.is_active,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const categoryService = {
  /**
   * Retorna todas as categorias/linhas de produtos do Supabase
   */
  async getCategories(onlyActive: boolean = false): Promise<Category[]> {
    let query = supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar linhas de produtos do Supabase:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapCategory);
  },

  /**
   * Busca uma categoria por slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar linha por slug ${slug}:`, error);
      throw new Error(error.message);
    }

    return data ? mapCategory(data) : null;
  },

  /**
   * Busca uma categoria por ID
   */
  async getCategoryById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar linha por ID ${id}:`, error);
      throw new Error(error.message);
    }

    return data ? mapCategory(data) : null;
  },

  /**
   * Cria uma nova categoria/linha de produtos
   */
  async createCategory(
    data: Omit<Category, 'id' | 'slug' | 'sortOrder' | 'createdAt' | 'updatedAt'> & {
      slug?: string;
    }
  ): Promise<Category> {
    const finalSlug = data.slug?.trim() || slugify(data.name);

    const { data: lastCat, error: orderError } = await supabase
      .from('categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      console.error('Erro ao obter ordem das linhas:', orderError);
      throw new Error(orderError.message);
    }

    const { data: created, error } = await supabase
      .from('categories')
      .insert({
        name: data.name.trim(),
        slug: finalSlug,
        description: data.description || '',
        cover_image: data.coverImage || '',
        is_active: data.isActive ?? true,
        sort_order: (lastCat?.sort_order ?? -1) + 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar linha no Supabase:', error);
      throw new Error(error.message);
    }

    return mapCategory(created);
  },

  /**
   * Atualiza uma categoria/linha de produtos
   */
  async updateCategory(
    id: string,
    data: Partial<Omit<Category, 'id' | 'createdAt'>>
  ): Promise<Category> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.slug !== undefined) payload.slug = data.slug.trim();
    if (data.description !== undefined) payload.description = data.description;
    if (data.coverImage !== undefined) payload.cover_image = data.coverImage;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;

    const { data: updated, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar linha no Supabase:', error);
      throw new Error(error.message);
    }

    return mapCategory(updated);
  },

  /**
   * Reordena a ordem de exibição das categorias
   */
  async reorderCategories(categoryIds: string[]): Promise<void> {
    const updates = categoryIds.map((id, index) =>
      supabase.from('categories').update({ sort_order: index }).eq('id', id)
    );
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      console.error('Erro ao reordenar linhas:', firstError.error);
      throw new Error(firstError.error.message);
    }
  },

  /**
   * Exclui uma categoria somente se não houver produtos vinculados
   */
  async deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countError) {
      throw new Error(countError.message);
    }

    if (count && count > 0) {
      return {
        success: false,
        error: `Não é possível excluir: existem ${count} produto(s) vinculados a esta Linha de Produtos. Transfira ou desvincule os produtos primeiro.`,
      };
    }

    const { error: delError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (delError) {
      return { success: false, error: delError.message };
    }

    return { success: true };
  },

  /**
   * Retorna a contagem de produtos ativos por categoria
   */
  async getCategoryProductCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('products')
      .select('category_id')
      .eq('is_active', true);

    if (error) {
      console.error('Erro ao calcular contagem de produtos por linha:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const catId = row.category_id;
      if (catId) {
        counts[catId] = (counts[catId] || 0) + 1;
      }
    });

    return counts;
  },
};
