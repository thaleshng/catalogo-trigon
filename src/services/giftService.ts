import { Gift, CustomerGift, GiftStatus } from '../types';
import { supabase } from '../lib/supabase';

function mapGift(row: any): Gift {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || '',
    isAvailable: row.is_available ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomerGift(row: any): CustomerGift {
  return {
    id: row.id,
    customerId: row.customer_id,
    giftId: row.gift_id,
    status: row.status as GiftStatus,
    giftedAt: row.gifted_at || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gift: row.gifts ? mapGift(row.gifts) : undefined,
    customer: row.customers
      ? {
          id: row.customers.id,
          name: row.customers.name,
          phone: row.customers.phone,
          email: row.customers.email,
        } as any
      : undefined,
  };
}

export const giftService = {
  // =========================================================================
  // GERENCIAMENTO DE BRINDES (GIFTS)
  // =========================================================================

  /**
   * Lista todos os brindes cadastrados com filtros opcionais
   */
  async getGifts(filter?: { search?: string; availableOnly?: boolean }): Promise<Gift[]> {
    let query = supabase
      .from('gifts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.availableOnly) {
      query = query.eq('is_available', true);
    }

    if (filter?.search && filter.search.trim() !== '') {
      const term = filter.search.trim();
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar brindes:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapGift);
  },

  /**
   * Busca um brinde específico pelo ID
   */
  async getGiftById(id: string): Promise<Gift | null> {
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar brinde por ID ${id}:`, error);
      throw new Error(error.message);
    }

    return data ? mapGift(data) : null;
  },

  /**
   * Cadastra um novo brinde
   */
  async createGift(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  }): Promise<Gift> {
    if (!data.name?.trim()) {
      throw new Error('O nome do brinde é obrigatório.');
    }

    const { data: created, error } = await supabase
      .from('gifts')
      .insert({
        name: data.name.trim(),
        description: data.description?.trim() || '',
        image_url: data.imageUrl?.trim() || '',
        is_available: data.isAvailable ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao cadastrar brinde:', error);
      throw new Error(error.message);
    }

    return mapGift(created);
  },

  /**
   * Atualiza os dados de um brinde existente
   */
  async updateGift(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      isAvailable: boolean;
    }>
  ): Promise<Gift> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.imageUrl !== undefined) payload.image_url = data.imageUrl.trim();
    if (data.isAvailable !== undefined) payload.is_available = data.isAvailable;

    const { data: updated, error } = await supabase
      .from('gifts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar brinde ${id}:`, error);
      throw new Error(error.message);
    }

    return mapGift(updated);
  },

  /**
   * Alterna manualmente a disponibilidade do brinde (habilitar / desabilitar)
   */
  async toggleAvailability(id: string, currentStatus: boolean): Promise<Gift> {
    return this.updateGift(id, { isAvailable: !currentStatus });
  },

  /**
   * Exclui um brinde caso ele nunca tenha sido vinculado a clientes.
   * Se já existirem vínculos, bloqueia a exclusão para preservar o histórico.
   */
  async deleteGift(id: string): Promise<{ success: boolean; error?: string }> {
    const { count, error: countError } = await supabase
      .from('customer_gifts')
      .select('*', { count: 'exact', head: true })
      .eq('gift_id', id);

    if (countError) {
      console.error('Erro ao verificar vínculos do brinde:', countError);
      throw new Error(countError.message);
    }

    if (count && count > 0) {
      return {
        success: false,
        error: `Este brinde possui ${count} registro(s) no histórico de clientes e não pode ser excluído para preservar os dados. Desabilite o brinde para impedir novos vínculos.`,
      };
    }

    const { error: deleteError } = await supabase
      .from('gifts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error(`Erro ao excluir brinde ${id}:`, deleteError);
      throw new Error(deleteError.message);
    }

    return { success: true };
  },

  // =========================================================================
  // VÍNCULOS E HISTÓRICO COM CLIENTES (CUSTOMER_GIFTS)
  // =========================================================================

  /**
   * Retorna todo o histórico de brindes de um cliente específico
   */
  async getCustomerGifts(customerId: string): Promise<CustomerGift[]> {
    const { data, error } = await supabase
      .from('customer_gifts')
      .select('*, gifts (*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Erro ao buscar histórico de brindes do cliente ${customerId}:`, error);
      throw new Error(error.message);
    }

    return (data || []).map(mapCustomerGift);
  },

  /**
   * Verifica se o cliente já possui registro (reservado ou enviado) daquele brinde
   */
  async checkDuplicateGift(
    customerId: string,
    giftId: string
  ): Promise<{ hasDuplicate: boolean; previousGifts: CustomerGift[] }> {
    const { data, error } = await supabase
      .from('customer_gifts')
      .select('*, gifts (*)')
      .eq('customer_id', customerId)
      .eq('gift_id', giftId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao consultar duplicidade de brinde para o cliente:', error);
      throw new Error(error.message);
    }

    const previousGifts = (data || []).map(mapCustomerGift);
    return {
      hasDuplicate: previousGifts.length > 0,
      previousGifts,
    };
  },

  /**
   * Vincula um brinde habilitado a um cliente
   */
  async linkGiftToCustomer(data: {
    customerId: string;
    giftId: string;
    status: GiftStatus;
    giftedAt?: string | null;
    notes?: string;
  }): Promise<CustomerGift> {
    // 1. Garantir que o brinde está ativo antes de persistir
    const gift = await this.getGiftById(data.giftId);
    if (!gift) {
      throw new Error('Brinde não encontrado.');
    }
    if (!gift.isAvailable) {
      throw new Error('Este brinde está desabilitado e não pode ser vinculado a novos clientes.');
    }

    const payload: any = {
      customer_id: data.customerId,
      gift_id: data.giftId,
      status: data.status,
      notes: data.notes?.trim() || '',
      gifted_at:
        data.status === 'enviado'
          ? (data.giftedAt || new Date().toISOString())
          : (data.giftedAt || null),
    };

    const { data: created, error } = await supabase
      .from('customer_gifts')
      .insert(payload)
      .select('*, gifts (*)')
      .single();

    if (error) {
      console.error('Erro ao vincular brinde ao cliente:', error);
      throw new Error(error.message);
    }

    return mapCustomerGift(created);
  },

  /**
   * Atualiza a situação de um vínculo existente (ex: de 'reservado' para 'enviado')
   */
  async updateCustomerGift(
    id: string,
    data: {
      status?: GiftStatus;
      giftedAt?: string | null;
      notes?: string;
    }
  ): Promise<CustomerGift> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.status !== undefined) {
      payload.status = data.status;
      if (data.status === 'enviado' && !data.giftedAt) {
        payload.gifted_at = new Date().toISOString();
      } else if (data.status === 'reservado' && data.giftedAt === undefined) {
        payload.gifted_at = null;
      }
    }

    if (data.giftedAt !== undefined) payload.gifted_at = data.giftedAt;
    if (data.notes !== undefined) payload.notes = data.notes.trim();

    const { data: updated, error } = await supabase
      .from('customer_gifts')
      .update(payload)
      .eq('id', id)
      .select('*, gifts (*)')
      .single();

    if (error) {
      console.error(`Erro ao atualizar situação do brinde ${id}:`, error);
      throw new Error(error.message);
    }

    return mapCustomerGift(updated);
  },

  /**
   * Remove um vínculo cadastrado incorretamente
   */
  async removeCustomerGift(id: string): Promise<void> {
    const { error } = await supabase
      .from('customer_gifts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao remover vínculo de brinde ${id}:`, error);
      throw new Error(error.message);
    }
  },
};
