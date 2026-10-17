/**
 * Formata um valor numérico para Moeda Brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data no padrão brasileiro (DD/MM/AAAA) no fuso de São Paulo (UTC-3)
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formata data e hora no padrão brasileiro (DD/MM/AAAA às HH:mm) no fuso de São Paulo (UTC-3)
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Retorna a data e hora atual no fuso de São Paulo (UTC-3) formatada para input datetime-local (YYYY-MM-DDTHH:mm)
 */
export function getSaoPauloDateTimeLocal(date: Date = new Date()): string {
  const spString = date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return spString.replace(' ', 'T').slice(0, 16);
}

/**
 * Converte um valor de datetime-local (YYYY-MM-DDTHH:mm) considerando o fuso de São Paulo (-03:00) para ISO string
 */
export function parseSaoPauloDateTime(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.includes('Z') || dateStr.includes('+') || (dateStr.length > 19 && dateStr.includes('-'))) {
    return new Date(dateStr).toISOString();
  }
  const parts = dateStr.split(':');
  const fullStr = parts.length === 3 ? `${dateStr}-03:00` : `${dateStr}:00-03:00`;
  return new Date(fullStr).toISOString();
}

/**
 * Aplica máscara de telefone celular brasileiro (XX) XXXXX-XXXX limitada a 11 dígitos (15 caracteres)
 */
export function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Aplica máscara de CEP brasileiro (XXXXX-XXX) limitada a 8 dígitos (9 caracteres)
 */
export function formatCepMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
