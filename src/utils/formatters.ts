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
 * Formata data no padrão brasileiro (DD/MM/AAAA) no fuso de São Paulo (UTC-3).
 * Trata datas puras (YYYY-MM-DD) ou com hora zerada UTC para não retroceder 1 dia pelo fuso UTC-3.
 */
export function formatDate(dateString: string): string {
  try {
    if (!dateString) return '';

    // Se a data vier no formato ISO com hora zerada (00:00:00) ou formato puro YYYY-MM-DD
    const dateMatch = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
    );
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return `${day}/${month}/${year}`;
    }

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
 * Formata data e hora no padrão brasileiro (DD/MM/AAAA às HH:mm) no fuso de São Paulo (UTC-3).
 * Trata datas com hora zerada (00:00:00) para exibir apenas o dia sem inventar "às 21:00" da noite anterior.
 */
export function formatDateTime(dateString: string): string {
  try {
    if (!dateString) return '';

    const dateMatch = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
    );
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return `${day}/${month}/${year}`;
    }

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
 * Formata o período de um leilão de forma inteligente:
 * - Se for leilão com data pura (sem hora): "DD/MM/AAAA" ou "DD/MM/AAAA a DD/MM/AAAA"
 * - Se for leilão com data e hora: "DD/MM/AAAA às HH:mm até DD/MM/AAAA às HH:mm"
 */
export function formatAuctionPeriod(startDate: string, endDate?: string | null): string {
  if (!startDate) return '—';

  const isDateOnlyStart =
    /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(
      startDate
    );
  const isDateOnlyEnd = endDate
    ? /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(
        endDate
      )
    : false;

  if (isDateOnlyStart && (!endDate || isDateOnlyEnd)) {
    const startFormatted = formatDate(startDate);
    if (!endDate || startDate === endDate) return startFormatted;
    const endFormatted = formatDate(endDate);
    return `${startFormatted} a ${endFormatted}`;
  }

  const startFormatted = formatDateTime(startDate);
  if (!endDate) return startFormatted;
  const endFormatted = formatDateTime(endDate);
  return `${startFormatted} até ${endFormatted}`;
}

/**
 * Converte data de input (YYYY-MM-DD ou YYYY-MM-DDTHH:mm) para ISO no fuso de São Paulo (-03:00)
 */
export function parseDateInputToIso(val: string, defaultHour = 12): string {
  if (!val) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    // Para data pura sem hora, define meio-dia em São Paulo (-03:00) para nunca sofrer variação de fuso
    return `${val}T${String(defaultHour).padStart(2, '0')}:00:00-03:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
    return `${val}:00-03:00`;
  }
  return new Date(val).toISOString();
}

/**
 * Retorna a data e hora atual no fuso de São Paulo (UTC-3) formatada para input datetime-local (YYYY-MM-DDTHH:mm)
 */
export function getSaoPauloDateTimeLocal(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const spString = d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return spString.replace(' ', 'T').slice(0, 16);
}

/**
 * Adiciona dias a uma string YYYY-MM-DDTHH:mm mantendo exatamente o mesmo horário de início (sem desvios de fuso)
 */
export function addDaysToDateTimeLocal(dateLocalStr: string, days = 1): string {
  if (!dateLocalStr) return '';
  const [datePart, timePart] = dateLocalStr.split('T');
  if (!datePart || !timePart) return '';
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const d = new Date(year, month - 1, day + days, hours, minutes);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:${mm}`;
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
