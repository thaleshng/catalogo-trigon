import {
  StockMovement,
  StockMovementType,
  Product,
  DashboardStats,
  SaleRegistrationData,
} from '../types';
import { supabase } from '../lib/supabase';

function mapStockMovement(row: any): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name || row.product_name || 'Produto',
    type: row.type as StockMovementType,
    quantity: row.quantity,
    reason: row.reason,
    date: row.created_at,
    previousStock: row.previous_stock,
    newStock: row.new_stock,
    unitPrice: row.unit_price ? Number(row.unit_price) : undefined,
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    totalValue: row.total_value ? Number(row.total_value) : undefined,
    channel: row.channel || undefined,
    customerId: row.customer_id || undefined,
    customerName: row.customer_name || undefined,
    paymentMethod: row.payment_method || undefined,
  };
}

export const stockService = {
  /**
   * Registra uma movimentação de estoque (ENTRADA ou SAÍDA) no Supabase
   * e atualiza o saldo do produto.
   */
  async recordMovement(
    productId: string,
    type: StockMovementType,
    quantity: number,
    reason: string
  ): Promise<{ movement: StockMovement; updatedProduct: Product }> {
    if (quantity <= 0) {
      throw new Error('A quantidade da movimentação deve ser maior que zero.');
    }

    // Busca produto atual
    const { data: currentProduct, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodError || !currentProduct) {
      throw new Error('Produto não encontrado para atualização de estoque.');
    }

    const previousStock = currentProduct.stock_quantity;
    let newStock = previousStock;

    if (type === 'ENTRADA') {
      newStock = previousStock + quantity;
    } else if (type === 'SAIDA') {
      if (previousStock < quantity) {
        throw new Error(
          `Estoque insuficiente. O estoque atual é de ${previousStock} unidade(s), não sendo possível retirar ${quantity}.`
        );
      }
      newStock = previousStock - quantity;
    }

    // Atualiza o estoque do produto
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);
    }

    // Insere movimentação no histórico
    const { data: movementRow, error: movError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        type,
        quantity,
        reason,
        previous_stock: previousStock,
        new_stock: newStock,
      })
      .select('*, products(name)')
      .single();

    if (movError) {
      throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
    }

    const mappedProd: Product = {
      id: updatedProduct.id,
      collectionId: updatedProduct.collection_id,
      name: updatedProduct.name,
      slug: updatedProduct.slug,
      description: updatedProduct.description || '',
      price: Number(updatedProduct.price),
      stockQuantity: Number(updatedProduct.stock_quantity),
      images: Array.isArray(updatedProduct.images) ? updatedProduct.images : [],
      isActive: updatedProduct.is_active,
      featured: updatedProduct.featured,
      rarity: updatedProduct.rarity,
      language: updatedProduct.language,
      condition: updatedProduct.condition,
      createdAt: updatedProduct.created_at,
      updatedAt: updatedProduct.updated_at,
    };

    return {
      movement: mapStockMovement(movementRow),
      updatedProduct: mappedProd,
    };
  },

  /**
   * Registra uma VENDA com rastreabilidade de preço real negociado
   */
  async recordSale(
    data: SaleRegistrationData
  ): Promise<{ movement: StockMovement; updatedProduct: Product }> {
    if (data.quantity <= 0) {
      throw new Error('A quantidade vendida deve ser maior que zero.');
    }

    if (data.unitPrice < 0) {
      throw new Error('O preço praticado não pode ser negativo.');
    }

    // Busca o produto no Supabase
    const { data: currentProduct, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', data.productId)
      .single();

    if (prodError || !currentProduct) {
      throw new Error('Produto não encontrado para registro da venda.');
    }

    const previousStock = currentProduct.stock_quantity;
    if (previousStock < data.quantity) {
      throw new Error(
        `Estoque insuficiente! Disponível: ${previousStock} unidade(s), solicitada(s): ${data.quantity}.`
      );
    }

    const newStock = previousStock - data.quantity;
    const catalogPrice = Number(currentProduct.price);
    const totalValue = data.quantity * data.unitPrice;
    const priceDiff = data.unitPrice - catalogPrice;

    let priceNote = '';
    if (priceDiff > 0) {
      priceNote = ` (+R$ ${priceDiff.toFixed(2)} ágio)`;
    } else if (priceDiff < 0) {
      priceNote = ` (-R$ ${Math.abs(priceDiff).toFixed(2)} desconto)`;
    }

    const channelLabel = data.channel || 'WhatsApp';
    const reasonParts = [`Venda via ${channelLabel}${priceNote}`];
    if (data.customerName?.trim()) {
      reasonParts.push(`Cliente: ${data.customerName.trim()}`);
    }
    if (data.paymentMethod?.trim()) {
      reasonParts.push(`Pagto: ${data.paymentMethod.trim()}`);
    }
    if (data.notes?.trim()) {
      reasonParts.push(`Obs: ${data.notes.trim()}`);
    }

    // Atualiza saldo de estoque do produto
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Erro ao dar baixa no estoque: ${updateError.message}`);
    }

    // Registra a venda com rastreabilidade completa
    const { data: movementRow, error: movError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: currentProduct.id,
        customer_id: data.customerId || null,
        customer_name: data.customerName?.trim() || '',
        type: 'SAIDA',
        quantity: data.quantity,
        reason: reasonParts.join(' • '),
        previous_stock: previousStock,
        new_stock: newStock,
        unit_price: data.unitPrice,
        original_price: catalogPrice,
        total_value: totalValue,
        channel: channelLabel,
        payment_method: data.paymentMethod?.trim() || 'Pix',
      })
      .select('*, products(name)')
      .single();

    if (movError) {
      throw new Error(`Erro ao registrar movimentação de venda: ${movError.message}`);
    }

    const mappedProd: Product = {
      id: updatedProduct.id,
      collectionId: updatedProduct.collection_id,
      name: updatedProduct.name,
      slug: updatedProduct.slug,
      description: updatedProduct.description || '',
      price: Number(updatedProduct.price),
      stockQuantity: Number(updatedProduct.stock_quantity),
      images: Array.isArray(updatedProduct.images) ? updatedProduct.images : [],
      isActive: updatedProduct.is_active,
      featured: updatedProduct.featured,
      rarity: updatedProduct.rarity,
      language: updatedProduct.language,
      condition: updatedProduct.condition,
      createdAt: updatedProduct.created_at,
      updatedAt: updatedProduct.updated_at,
    };

    return {
      movement: mapStockMovement(movementRow),
      updatedProduct: mappedProd,
    };
  },

  /**
   * Retorna o histórico de movimentações ordenado das mais recentes para as mais antigas
   */
  async getMovements(limit?: number): Promise<StockMovement[]> {
    let query = supabase
      .from('stock_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false });

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar movimentações:', error);
      return [];
    }

    return (data || []).map(mapStockMovement);
  },

  /**
   * Calcula indicadores para o Dashboard usando agregação do Supabase
   */
  async getStats(): Promise<DashboardStats> {
    const [
      { data: products, error: prodError },
      { count: collectionsCount },
      { data: movements, error: movError },
    ] = await Promise.all([
      supabase.from('products').select('price, stock_quantity, is_active'),
      supabase.from('collections').select('*', { count: 'exact', head: true }),
      supabase
        .from('stock_movements')
        .select('type, quantity, total_value')
        .eq('type', 'SAIDA'),
    ]);

    if (prodError) console.error('Erro ao carregar estatísticas de produtos:', prodError);
    if (movError) console.error('Erro ao carregar estatísticas de movimentos:', movError);

    const prods = products || [];
    const totalProducts = prods.length;
    const availableProducts = prods.filter((p) => p.stock_quantity > 0 && p.is_active).length;
    const outOfStockProducts = prods.filter((p) => p.stock_quantity === 0).length;
    const totalCollections = collectionsCount || 0;

    const totalStockValue = prods.reduce(
      (acc, p) => acc + (Number(p.price) || 0) * (Number(p.stock_quantity) || 0),
      0
    );

    const saleMovements = (movements || []).filter((m) => m.total_value !== null);
    const totalSalesCount = saleMovements.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
    const totalRevenue = saleMovements.reduce((acc, m) => acc + (Number(m.total_value) || 0), 0);

    return {
      totalProducts,
      availableProducts,
      outOfStockProducts,
      totalCollections,
      totalStockValue,
      totalSalesCount,
      totalRevenue,
    };
  },
};
