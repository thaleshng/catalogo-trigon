import { supabase } from '../lib/supabase';
import { INITIAL_COLLECTIONS } from '../mocks/mockCollections';
import { INITIAL_PRODUCTS } from '../mocks/mockProducts';

export const seedService = {
  /**
   * Verifica se o banco está vazio e povoa as coleções e produtos iniciais de Pokémon
   */
  async seedIfEmpty(): Promise<{ seeded: boolean; collectionsCount: number; productsCount: number }> {
    try {
      const { count: colCount, error: colError } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true });

      if (colError) {
        console.warn('Erro ao verificar coleções no Supabase:', colError);
        return { seeded: false, collectionsCount: 0, productsCount: 0 };
      }

      if (colCount && colCount > 0) {
        return { seeded: false, collectionsCount: colCount, productsCount: 0 };
      }

      console.log('Banco de dados vazio detectado. Populando dados iniciais no Supabase...');

      // Mapa de mockId -> Supabase UUID
      const colIdMap: Record<string, string> = {};

      for (const col of INITIAL_COLLECTIONS) {
        const { data: createdCol, error: insertColErr } = await supabase
          .from('collections')
          .insert({
            name: col.name,
            slug: col.slug,
            description: col.description,
            cover_image: col.coverImage,
            is_active: col.isActive,
          })
          .select()
          .single();

        if (insertColErr) {
          console.error(`Erro ao inserir coleção ${col.name}:`, insertColErr);
          continue;
        }

        colIdMap[col.id] = createdCol.id;
      }

      let insertedProducts = 0;
      for (const prod of INITIAL_PRODUCTS) {
        if (!prod.collectionId) continue;
        const targetColId = colIdMap[prod.collectionId];
        if (!targetColId) continue;

        const { error: insertProdErr } = await supabase.from('products').insert({
          collection_id: targetColId,
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          price: prod.price,
          stock_quantity: prod.stockQuantity,
          images: prod.images,
          is_active: prod.isActive,
          featured: prod.featured ?? false,
          rarity: prod.rarity || '',
          language: prod.language || 'Português',
          condition: prod.condition || 'Mint / Fresh Pack',
        });

        if (!insertProdErr) {
          insertedProducts++;
        }
      }

      console.log(`Povoamento concluído: ${Object.keys(colIdMap).length} coleções e ${insertedProducts} produtos.`);
      return {
        seeded: true,
        collectionsCount: Object.keys(colIdMap).length,
        productsCount: insertedProducts,
      };
    } catch (err) {
      console.error('Erro durante o povoamento automático do Supabase:', err);
      return { seeded: false, collectionsCount: 0, productsCount: 0 };
    }
  },
};
