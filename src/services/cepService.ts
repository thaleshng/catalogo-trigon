export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean | string;
}

export interface CepAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export const cepService = {
  /**
   * Consulta dados de endereço a partir de um CEP na API pública ViaCEP
   * Retorna null se CEP for inválido ou não encontrado
   */
  async searchCep(rawCep: string): Promise<CepAddress | null> {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) {
      return null;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: ViaCepResponse = await response.json();

      if (data.erro === true || data.erro === 'true') {
        return null;
      }

      return {
        cep: data.cep || `${digits.slice(0, 5)}-${digits.slice(5)}`,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      };
    } catch (err) {
      console.error('Erro ao consultar ViaCEP:', err);
      return null;
    }
  },
};
