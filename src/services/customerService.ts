import { Customer } from '../types';
import { supabase } from '../lib/supabase';

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    notes: row.notes || '',
    cep: row.cep || '',
    street: row.street || '',
    number: row.number || '',
    complement: row.complement || '',
    neighborhood: row.neighborhood || '',
    city: row.city || '',
    state: row.state || '',
    referencePoint: row.reference_point || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const customerService = {
  /**
   * Retorna todos os clientes ordenados pelo mais recente
   */
  async getCustomers(search?: string): Promise<Customer[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (search && search.trim() !== '') {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar clientes:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapCustomer);
  },

  /**
   * Busca um cliente por ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar cliente por ID:', error);
      throw new Error(error.message);
    }

    return data ? mapCustomer(data) : null;
  },

  /**
   * Cadastra um novo cliente
   * Nome e Telefone obrigatórios
   */
  async createCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    referencePoint?: string;
  }): Promise<Customer> {
    if (!data.name?.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }
    if (!data.phone?.trim()) {
      throw new Error('O telefone / WhatsApp é obrigatório.');
    }

    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        notes: data.notes?.trim() || '',
        cep: data.cep?.trim() || '',
        street: data.street?.trim() || '',
        number: data.number?.trim() || '',
        complement: data.complement?.trim() || '',
        neighborhood: data.neighborhood?.trim() || '',
        city: data.city?.trim() || '',
        state: data.state?.trim() || '',
        reference_point: data.referencePoint?.trim() || '',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      throw new Error(error.message);
    }

    return mapCustomer(created);
  },

  /**
   * Atualiza os dados de um cliente existente
   */
  async updateCustomer(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      email: string;
      notes: string;
      cep: string;
      street: string;
      number: string;
      complement: string;
      neighborhood: string;
      city: string;
      state: string;
      referencePoint: string;
    }>
  ): Promise<Customer> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.phone !== undefined) payload.phone = data.phone.trim();
    if (data.email !== undefined) payload.email = data.email.trim();
    if (data.notes !== undefined) payload.notes = data.notes.trim();
    if (data.cep !== undefined) payload.cep = data.cep.trim();
    if (data.street !== undefined) payload.street = data.street.trim();
    if (data.number !== undefined) payload.number = data.number.trim();
    if (data.complement !== undefined) payload.complement = data.complement.trim();
    if (data.neighborhood !== undefined) payload.neighborhood = data.neighborhood.trim();
    if (data.city !== undefined) payload.city = data.city.trim();
    if (data.state !== undefined) payload.state = data.state.trim();
    if (data.referencePoint !== undefined) payload.reference_point = data.referencePoint.trim();

    const { data: updated, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw new Error(error.message);
    }

    return mapCustomer(updated);
  },

  /**
   * Exclui um cliente
   */
  async deleteCustomer(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir cliente:', error);
      throw new Error(error.message);
    }

    return true;
  },
};
