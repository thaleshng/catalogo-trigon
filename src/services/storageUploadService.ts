import { supabase } from '../lib/supabase';

export const storageUploadService = {
  /**
   * Faz upload de arquivo diretamente para o Supabase Storage (bucket trigon-catalog-images)
   * e retorna a URL pública permanente na CDN.
   */
  async uploadImage(file: File, folder: 'products' | 'collections' = 'products'): Promise<string> {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const cleanFileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('trigon-catalog-images')
      .upload(cleanFileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.warn('Erro ao fazer upload no Supabase Storage:', uploadError);
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('trigon-catalog-images').getPublicUrl(cleanFileName);

    return publicUrl;
  },
};
