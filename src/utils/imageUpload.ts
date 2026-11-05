/**
 * Utilitário para conversão de arquivos de imagem locais para Data URL (Base64).
 * Isso permite pré-visualização instantânea no navegador e persistência local,
 * simulando perfeitamente a futura integração com o Supabase Storage.
 */

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado deve ser uma imagem.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona e otimiza uma imagem Base64 antes de salvar,
 * garantindo carregamento rápido e leveza no armazenamento.
 */
export async function optimizeImage(file: File, maxWidth: number = 1200): Promise<string> {
  const dataUrl = await fileToDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Converte e comprime um arquivo de imagem bruto de câmera de celular (5MB a 10MB)
 * para um arquivo WebP/JPEG leve (~80KB a 150KB), mantendo resolução e nitidez ideais.
 * Reduz em ~97% o consumo do Supabase Storage.
 */
export async function optimizeImageFile(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = Math.max(img.width, img.height);
        const scale = maxDimension > maxWidth ? maxWidth / maxDimension : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const optimizedFile = new File([blob], cleanName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Copia uma imagem diretamente para a Área de Transferência (Clipboard) em formato PNG,
 * permitindo colar com Ctrl+V diretamente no WhatsApp Web, Telegram, Discord, etc.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    // A maioria dos navegadores exige 'image/png' no ClipboardItem
    if (blob.type === 'image/png') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    }

    // Se for WebP ou JPEG, converte para PNG via canvas antes de copiar
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(false);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(async (pngBlob) => {
            if (!pngBlob) return resolve(false);
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob }),
              ]);
              resolve(true);
            } catch {
              resolve(false);
            }
          }, 'image/png');
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  } catch {
    return false;
  }
}

/**
 * Compartilha a imagem com a legenda já embutida nativamente pelo celular (Web Share API).
 * No Android / iOS, abre o WhatsApp com a foto e a legenda já prontas no mesmo envio!
 */
export async function shareImageWithCaption(
  imageUrl: string,
  caption: string,
  title: string = 'Lote do Leilão'
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;

  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const file = new File([blob], `lote_${Date.now()}.${ext}`, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: caption,
        title,
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return true; // usuário cancelou
    console.warn('Erro ao compartilhar via Web Share:', err);
  }
  return false;
}
