export const SITE_CONFIG = {
  name: 'TRIGON',
  subtitle: 'Pokémon TCG & Colecionáveis de Elite',
  description: 'Catálogo oficial TRIGON. Encontre cartas raras de Pokémon TCG, coleções lendárias, caixas seladas e acessórios premium com atendimento direto pelo WhatsApp.',
  
  // ==========================================
  // CONFIGURAÇÃO DO WHATSAPP
  // ==========================================
  // Altere aqui para o número de WhatsApp da sua loja (somente números, com DDI + DDD)
  whatsapp: {
    number: '5531983410432',
    formattedNumber: '(31) 98341-0432',
    buildPurchaseMessage: (productName: string, price: number, productUrl?: string): string => {
      const formattedPrice = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(price);

      let msg = `Olá, equipe TRIGON! 👋\n\n`;
      msg += `Tenho interesse no produto:\n`;
      msg += `🏷️ *${productName}*\n`;
      msg += `💰 *${formattedPrice}*\n`;
      if (productUrl) {
        msg += `🔗 ${productUrl}\n`;
      }
      msg += `\nGostaria de confirmar a disponibilidade e combinar a compra.`;
      return encodeURIComponent(msg);
    },
  },

  // ==========================================
  // COMUNIDADE OFICIAL (GRUPO DE WHATSAPP)
  // ==========================================
  community: {
    name: 'Comunidade VIP TRIGON',
    url: 'https://chat.whatsapp.com/E02OoSUQgvgBAPI4IfMQ3J?s=cl&p=a&mlu=4&ilr=4',
    description: 'Faça parte do grupo exclusivo de colecionadores e receba drops e novidades em primeira mão.',
  },

  // Assets da Marca
  assets: {
    logo: '/images/trigon-logo-no-bg.png',
    heroBg: '/images/trigon-hero-bg.jpg',
  },

  // Redes Sociais e Contatos
  socials: {
    instagram: 'https://www.instagram.com/trigon_tcg?psln=bXkxM2E5c2xoa3dm',
    discord: 'https://discord.gg/trigon',
    email: 'contato@trigontcg.com.br',
  },
};
